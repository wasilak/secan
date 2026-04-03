//! OpenID Connect (OIDC) authentication provider
//!
//! This module implements authentication using an external OIDC identity provider
//! with support for auto-discovery, group-based access control, and userinfo endpoint.

use anyhow::{anyhow, Context, Result};
use base64::Engine;
use dashmap::DashMap;
use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
// Metrics are reported via the metrics crate (Prometheus exporter). We no
// longer maintain redundant in-process atomics for JWKS refresh metrics.
// Use rand for jitter/backoff randomness.
use reqwest::Client as HttpClient;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::sync::{Arc, RwLock};

use crate::config::OidcConfig;

use super::permissions::PermissionResolver;
use super::session::{AuthUser, SessionManager};

/// OIDC Provider Metadata from discovery
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcProviderMetadata {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub userinfo_endpoint: Option<String>,
    pub jwks_uri: String,
}

/// Helper function to deserialize audience claim which can be string or array
fn deserialize_aud<'de, D>(deserializer: D) -> Result<Vec<String>, D::Error>
where
    D: Deserializer<'de>,
{
    use serde::de::Error;

    let value = Value::deserialize(deserializer)?;
    match value {
        Value::String(s) => Ok(vec![s]),
        Value::Array(arr) => arr
            .into_iter()
            .map(|v| {
                v.as_str()
                    .map(String::from)
                    .ok_or_else(|| Error::custom("audience must be string or array of strings"))
            })
            .collect(),
        _ => Err(Error::custom("audience must be string or array of strings")),
    }
}

/// ID Token claims extracted from JWT
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdTokenClaims {
    pub sub: String,
    #[serde(deserialize_with = "deserialize_aud")]
    pub aud: Vec<String>,
    pub exp: u64,
    pub iat: u64,
    #[serde(flatten)]
    pub additional_claims: Value,
}

/// Token response from OIDC provider
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub id_token: String,
    pub refresh_token: Option<String>,
}

/// OIDC authentication provider using HTTP-based implementation
pub struct OidcAuthProvider {
    config: OidcConfig,
    session_manager: Arc<SessionManager>,
    metadata: OidcProviderMetadata,
    http_client: HttpClient,
    permission_resolver: PermissionResolver,
    // Names of RBAC roles from the global configuration. May be empty.
    rbac_role_names: Vec<String>,
    // Pending CSRF states mapped to creation time
    pending_states: Arc<DashMap<String, std::time::Instant>>,
    // Cached JWKS (raw JSON) along with fetch timestamp for TTL/refresh
    jwks: Arc<RwLock<Option<(std::time::Instant, serde_json::Value)>>>,
}

impl OidcAuthProvider {
    /// Create a new OIDC authentication provider
    pub async fn new(
        config: OidcConfig,
        session_manager: Arc<SessionManager>,
        permission_resolver: PermissionResolver,
        rbac_role_names: Vec<String>,
    ) -> Result<Self> {
        tracing::debug!("Initializing OIDC authentication provider");
        tracing::debug!(client_id = %config.client_id, "OIDC client configured");
        tracing::debug!(redirect_uri = %config.redirect_uri, "OIDC redirect URI configured");

        let http_client = HttpClient::new();

        // Discover OIDC provider metadata
        let discovery_url = &config.discovery_url;
        tracing::debug!(discovery_url = %discovery_url, "Discovering OIDC provider metadata");

        let metadata_response = http_client
            .get(discovery_url)
            .send()
            .await
            .context("Failed to fetch OIDC discovery document")?;

        if !metadata_response.status().is_success() {
            anyhow::bail!(
                "OIDC discovery failed with status {}: {}",
                metadata_response.status(),
                metadata_response.text().await.unwrap_or_default()
            );
        }

        let metadata_json: Value = metadata_response
            .json()
            .await
            .context("Failed to parse OIDC discovery document")?;

        let metadata = OidcProviderMetadata {
            issuer: metadata_json
                .get("issuer")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing issuer in OIDC metadata"))?
                .to_string(),
            authorization_endpoint: metadata_json
                .get("authorization_endpoint")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing authorization_endpoint in OIDC metadata"))?
                .to_string(),
            token_endpoint: metadata_json
                .get("token_endpoint")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing token_endpoint in OIDC metadata"))?
                .to_string(),
            userinfo_endpoint: metadata_json
                .get("userinfo_endpoint")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string()),
            jwks_uri: metadata_json
                .get("jwks_uri")
                .and_then(|v| v.as_str())
                .ok_or_else(|| anyhow!("Missing jwks_uri in OIDC metadata"))?
                .to_string(),
        };

        tracing::debug!("OIDC provider metadata discovered successfully");

        // Initialize empty JWKS cache and pending states map
        let pending_states = Arc::new(DashMap::new());
        let jwks = Arc::new(RwLock::new(None));

        // Compute JWKS TTL to use for background refresh. Prefer human-friendly
        // `jwks_ttl` if configured, otherwise use numeric seconds.
        let ttl_seconds = if let Some(ref s) = config.jwks_ttl {
            match humantime::parse_duration(s) {
                Ok(dur) => dur.as_secs(),
                Err(e) => {
                    tracing::warn!(jwks_ttl = %s, error = %e, "Failed to parse jwks_ttl - falling back to jwks_ttl_seconds");
                    config.jwks_ttl_seconds
                }
            }
        } else {
            config.jwks_ttl_seconds
        };

        // Build provider instance
        let provider = Self {
            config: config.clone(),
            session_manager: session_manager.clone(),
            metadata: metadata.clone(),
            http_client: http_client.clone(),
            permission_resolver,
            rbac_role_names,
            pending_states: pending_states.clone(),
            jwks: jwks.clone(),
        };

        // Spawn background JWKS refresher task. It periodically refreshes the
        // JWKS based on ttl_seconds and updates the shared cache. Use clones
        // of only the required pieces to avoid moving provider into the task.
        let jwks_uri = provider.metadata.jwks_uri.clone();
        let jwks_cache = jwks.clone();
        let client_for_task = http_client.clone();
        let refresh_ttl = std::time::Duration::from_secs(ttl_seconds);

        tokio::spawn(async move {
            // Background refresher with initial immediate fetch, jitter and
            // exponential backoff on failures to avoid thundering-herd and
            // rapid retries when the provider is unavailable.
            let mut consecutive_failures: u32;
            // Use the rand top-level helper for jitter/backoff
            // Initial immediate fetch
            metrics::counter!("oidc.jwks.refresh.attempts").increment(1);
            tracing::debug!(jwks_uri = %jwks_uri, "Initial background JWKS refresh starting");

            let initial_success = match client_for_task.get(&jwks_uri).send().await {
                Ok(resp) => match resp.error_for_status() {
                    Ok(success_resp) => match success_resp.json::<serde_json::Value>().await {
                        Ok(jwks_json) => {
                            let mut guard = jwks_cache.write().unwrap();
                            *guard = Some((std::time::Instant::now(), jwks_json));
                            metrics::counter!("oidc.jwks.refresh.success").increment(1);
                            metrics::gauge!("oidc.jwks.last_refresh")
                                .set(chrono::Utc::now().timestamp() as f64);
                            tracing::debug!(jwks_uri = %jwks_uri, "JWKS refreshed successfully (initial)");
                            true
                        }
                        Err(e) => {
                            metrics::counter!("oidc.jwks.refresh.failure").increment(1);
                            tracing::warn!(error = %e, jwks_uri = %jwks_uri, "Failed to parse JWKS JSON in background refresher (initial)");
                            false
                        }
                    },
                    Err(e) => {
                        metrics::counter!("oidc.jwks.refresh.failure").increment(1);
                        tracing::warn!(error = %e, jwks_uri = %jwks_uri, "JWKS HTTP request returned error status in background refresher (initial)");
                        false
                    }
                },
                Err(e) => {
                    metrics::counter!("oidc.jwks.refresh.failure").increment(1);
                    tracing::warn!(error = %e, jwks_uri = %jwks_uri, "Failed to fetch JWKS in background refresher (initial)");
                    false
                }
            };

            consecutive_failures = if initial_success { 0 } else { 1 };

            loop {
                // Compute delay: base TTL with jitter when healthy; on failures
                // use exponential backoff with a cap plus jitter.
                let base = refresh_ttl;
                let jitter_ms = (base.as_millis() as u64 / 10).min(30_000);
                // Jitter is random between 0 and jitter_ms inclusive
                let jitter = if jitter_ms == 0 {
                    std::time::Duration::from_millis(0)
                } else {
                    // Use rand::random_range to avoid importing thread_rng directly
                    // Use thread-local RNG via rand::rng() helper
                    let ms: u64 = rand::random_range(0..=jitter_ms);
                    std::time::Duration::from_millis(ms)
                };

                let delay = if consecutive_failures == 0 {
                    base + jitter
                } else {
                    // Exponential backoff capped at 1 hour
                    let exp = std::cmp::min(consecutive_failures, 6);
                    let multiplier = 1u128 << exp;
                    let base_ms = base.as_millis() as u128;
                    let max_backoff_ms: u128 = 3_600_000; // 1 hour
                    let backoff_ms = base_ms.saturating_mul(multiplier).min(max_backoff_ms);
                    std::time::Duration::from_millis(backoff_ms as u64) + jitter
                };

                tokio::time::sleep(delay).await;

                metrics::counter!("oidc.jwks.refresh.attempts").increment(1);
                tracing::debug!(jwks_uri = %jwks_uri, "Background JWKS refresh starting");

                match client_for_task.get(&jwks_uri).send().await {
                    Ok(resp) => match resp.error_for_status() {
                        Ok(success_resp) => match success_resp.json::<serde_json::Value>().await {
                            Ok(jwks_json) => {
                                let mut guard = jwks_cache.write().unwrap();
                                *guard = Some((std::time::Instant::now(), jwks_json));
                                metrics::counter!("oidc.jwks.refresh.success").increment(1);
                                metrics::gauge!("oidc.jwks.last_refresh")
                                    .set(chrono::Utc::now().timestamp() as f64);
                                tracing::debug!(jwks_uri = %jwks_uri, "JWKS refreshed successfully");
                                consecutive_failures = 0;
                            }
                            Err(e) => {
                                metrics::counter!("oidc.jwks.refresh.failure").increment(1);
                                tracing::warn!(error = %e, jwks_uri = %jwks_uri, "Failed to parse JWKS JSON in background refresher");
                                consecutive_failures = consecutive_failures.saturating_add(1);
                            }
                        },
                        Err(e) => {
                            metrics::counter!("oidc.jwks.refresh.failure").increment(1);
                            tracing::warn!(error = %e, jwks_uri = %jwks_uri, "JWKS HTTP request returned error status in background refresher");
                            consecutive_failures = consecutive_failures.saturating_add(1);
                        }
                    },
                    Err(e) => {
                        metrics::counter!("oidc.jwks.refresh.failure").increment(1);
                        tracing::warn!(error = %e, jwks_uri = %jwks_uri, "Failed to fetch JWKS in background refresher");
                        consecutive_failures = consecutive_failures.saturating_add(1);
                    }
                }
            }
        });

        Ok(provider)
    }

    /// Public helper to read the cached JWKS JSON (used by integration tests).
    pub fn get_cached_jwks(&self) -> Option<serde_json::Value> {
        let guard = self.jwks.read().unwrap();
        guard.as_ref().map(|(_, v)| v.clone())
    }

    /// Test-only helper to inspect the cached JWKS JSON
    #[cfg(test)]
    pub fn test_get_cached_jwks(&self) -> Option<serde_json::Value> {
        let guard = self.jwks.read().unwrap();
        guard.as_ref().map(|(_, v)| v.clone())
    }

    /// Get the authorization URL for redirecting the user to the OIDC provider
    pub fn get_authorization_url(&self, state: &str) -> String {
        use urlencoding::encode;

        let params = [
            ("client_id", self.config.client_id.as_str()),
            ("redirect_uri", self.config.redirect_uri.as_str()),
            ("response_type", "code"),
            ("scope", "openid profile email groups"),
            ("state", state),
        ];

        let query_string = params
            .iter()
            .map(|(k, v)| format!("{}={}", k, encode(v)))
            .collect::<Vec<_>>()
            .join("&");

        format!("{}?{}", self.metadata.authorization_endpoint, query_string)
    }

    /// Initiate auth: store state and return authorization URL + encoded state
    pub fn initiate_auth(&self, redirect_to: Option<String>) -> (String, String) {
        let csrf = crate::auth::generate_token();
        let state_payload = if let Some(redirect) = redirect_to {
            let normalized = crate::routes::auth::collapse_duplicate_slashes(&redirect);
            format!("{}|{}", normalized, csrf)
        } else {
            csrf.clone()
        };

        // Base64 encode the state payload
        let encoded =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(state_payload.as_bytes());

        // Store CSRF token (we store csrf itself so callback can validate TTL)
        let key = csrf.clone();
        self.pending_states.insert(key, std::time::Instant::now());

        let url = self.get_authorization_url(&encoded);
        (url, encoded)
    }

    /// Validate and consume a state parameter encoded by initiate_auth
    /// Returns optional redirect_to if provided
    pub fn validate_and_consume_state(&self, state_param: &str) -> Result<Option<String>> {
        // Try base64 decode
        let decoded = if let Ok(bytes) =
            base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(state_param)
        {
            String::from_utf8(bytes).unwrap_or_default()
        } else {
            state_param.to_string()
        };

        // Extract csrf token as last segment after '|'
        let parts: Vec<&str> = decoded.split('|').collect();
        let csrf = parts.last().unwrap_or(&decoded.as_str()).to_string();

        // Remove pending state and enforce TTL (10 minutes)
        if let Some((_, created)) = self.pending_states.remove(&csrf) {
            let now = std::time::Instant::now();
            let ttl = std::time::Duration::from_secs(10 * 60);
            if now.duration_since(created) > ttl {
                anyhow::bail!("state expired");
            }
        } else {
            anyhow::bail!("state not found or expired");
        }

        // If decoded contains redirect part, return it
        if parts.len() >= 2 {
            let redirect = parts[0].to_string();
            Ok(Some(redirect))
        } else {
            Ok(None)
        }
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code(&self, code: &str) -> Result<TokenResponse> {
        tracing::debug!("Exchanging authorization code for tokens");

        let params = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
            ("redirect_uri", &self.config.redirect_uri),
        ];

        let response = self
            .http_client
            .post(&self.metadata.token_endpoint)
            .form(&params)
            .send()
            .await
            .context("Failed to exchange authorization code")?;

        if !response.status().is_success() {
            anyhow::bail!(
                "Token exchange failed with status {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            );
        }

        let token_response: TokenResponse = response
            .json()
            .await
            .context("Failed to parse token response")?;

        tracing::debug!("Token exchange successful");

        Ok(token_response)
    }

    /// Validate and decode ID token
    /// Validate and decode ID token using JWKS verification
    pub async fn validate_id_token(&self, id_token_str: &str) -> Result<IdTokenClaims> {
        tracing::debug!("Validating ID token using JWKS");

        let header = decode_header(id_token_str).context("Failed to decode JWT header")?;
        let kid = header
            .kid
            .ok_or_else(|| anyhow!("ID token missing kid in header"))?;

        // Ensure JWKS is loaded; try refresh if missing or expired.
        // Avoid holding the RwLock guard across an await to keep the returned
        // future Send. If refresh fails we'll still try to use existing keys.
        let need_fetch = {
            let jwks_guard = self.jwks.read().unwrap();
            match jwks_guard.as_ref() {
                None => true,
                Some((fetched_at, _)) => {
                    // TTL for JWKS cache: use configured value from OIDC config
                    let ttl = std::time::Duration::from_secs(self.config.jwks_ttl_seconds);
                    fetched_at.elapsed() > ttl
                }
            }
        };

        if need_fetch {
            if let Err(e) = self.refresh_jwks().await {
                tracing::warn!(error = %e, "JWKS refresh failed; proceeding with cached keys if any");
            }
        }

        // Find key by kid in cached value
        let jwks_value = {
            let jwks_guard = self.jwks.read().unwrap();
            jwks_guard
                .as_ref()
                .map(|(_, v)| v.clone())
                .ok_or_else(|| anyhow!("JWKS not available"))?
        };

        // JWKS is stored as raw JSON in the cache. Find matching JWK by kid.
        let keys = jwks_value
            .get("keys")
            .and_then(|v| v.as_array())
            .ok_or_else(|| anyhow!("Invalid JWKS: missing keys array"))?;

        // Try finding the JWK in the current cache. If not found, perform one
        // immediate refresh and retry once. Avoid holding locks across awaits.
        let mut jwk_value_opt = keys
            .iter()
            .find(|k| k.get("kid").and_then(|v| v.as_str()) == Some(kid.as_str()))
            .cloned();

        if jwk_value_opt.is_none() {
            tracing::debug!(kid = %kid, "JWK for kid not found in cache - attempting immediate refresh");
            if let Err(e) = self.refresh_jwks().await {
                tracing::warn!(error = %e, kid = %kid, "Immediate JWKS refresh failed during kid lookup; will proceed to final error");
            } else {
                // Re-read JWKS from cache and try to find the kid again
                let jwks_value_after = {
                    let guard = self.jwks.read().unwrap();
                    guard
                        .as_ref()
                        .map(|(_, v)| v.clone())
                        .ok_or_else(|| anyhow!("JWKS not available after refresh"))?
                };

                let keys_after = jwks_value_after
                    .get("keys")
                    .and_then(|v| v.as_array())
                    .ok_or_else(|| anyhow!("Invalid JWKS: missing keys array after refresh"))?;

                jwk_value_opt = keys_after
                    .iter()
                    .find(|k| k.get("kid").and_then(|v| v.as_str()) == Some(kid.as_str()))
                    .cloned();
            }
        }

        let jwk_value = jwk_value_opt.ok_or_else(|| anyhow!("No matching JWK for kid"))?;

        // Deserialize into jsonwebtoken::jwk::Jwk and build decoding key
        let jwk: jsonwebtoken::jwk::Jwk = serde_json::from_value(jwk_value)
            .context("Failed to deserialize JWK JSON into Jwk type")?;
        let decoding_key =
            DecodingKey::from_jwk(&jwk).context("Failed to build decoding key from JWK")?;

        let mut validation = Validation::new(Algorithm::RS256);
        validation.set_audience(&[self.config.client_id.clone()]);

        let token_data = decode::<IdTokenClaims>(id_token_str, &decoding_key, &validation)
            .context("JWT verification failed")?;

        Ok(token_data.claims)
    }

    /// Refresh JWKS from provider
    async fn refresh_jwks(&self) -> Result<()> {
        tracing::debug!(jwks_uri = %self.metadata.jwks_uri, "Refreshing JWKS");

        let resp = self
            .http_client
            .get(&self.metadata.jwks_uri)
            .send()
            .await
            .context("Failed to fetch JWKS")?
            .error_for_status()
            .context("JWKS fetch returned error status")?;

        let jwks_json: serde_json::Value =
            resp.json().await.context("Failed to parse JWKS JSON")?;
        let mut guard = self.jwks.write().unwrap();
        *guard = Some((std::time::Instant::now(), jwks_json));
        Ok(())
    }

    /// Extract user groups from ID token claims
    fn extract_groups_from_claims(&self, claims: &IdTokenClaims) -> Vec<String> {
        // Try standard "groups" claim first
        if let Some(groups) = claims.additional_claims.get("groups") {
            if let Ok(groups_array) = serde_json::from_value::<Vec<String>>(groups.clone()) {
                tracing::debug!("Found groups in ID token claims: {:?}", groups_array);
                return groups_array;
            }
        }

        // Try configured groups claim key
        if let Some(groups) = claims.additional_claims.get(&self.config.groups_claim_key) {
            if let Ok(groups_array) = serde_json::from_value::<Vec<String>>(groups.clone()) {
                tracing::debug!(
                    "Found groups in ID token claims (key: {}): {:?}",
                    self.config.groups_claim_key,
                    groups_array
                );
                return groups_array;
            }
        }

        Vec::new()
    }

    /// Fetch user groups from the userinfo endpoint
    pub async fn fetch_user_groups(&self, access_token: &str) -> Result<Vec<String>> {
        let userinfo_endpoint = self
            .metadata
            .userinfo_endpoint
            .as_ref()
            .ok_or_else(|| anyhow!("UserInfo endpoint not available"))?;

        tracing::debug!(
            "Fetching groups from userinfo endpoint: {}",
            userinfo_endpoint
        );

        let response = self
            .http_client
            .get(userinfo_endpoint)
            .bearer_auth(access_token)
            .send()
            .await
            .context("Failed to fetch userinfo")?;

        if !response.status().is_success() {
            anyhow::bail!(
                "UserInfo endpoint returned status {}: {}",
                response.status(),
                response.text().await.unwrap_or_default()
            );
        }

        let userinfo: Value = response
            .json()
            .await
            .context("Failed to parse userinfo response")?;

        // Try to extract groups from the userinfo response
        let groups = if let Some(groups_value) = userinfo.get(&self.config.groups_claim_key) {
            if let Some(groups_array) = groups_value.as_array() {
                groups_array
                    .iter()
                    .filter_map(|g| g.as_str().map(String::from))
                    .collect()
            } else {
                Vec::new()
            }
        } else if let Some(groups_value) = userinfo.get("groups") {
            if let Some(groups_array) = groups_value.as_array() {
                groups_array
                    .iter()
                    .filter_map(|g| g.as_str().map(String::from))
                    .collect()
            } else {
                Vec::new()
            }
        } else {
            Vec::new()
        };

        if !groups.is_empty() {
            tracing::debug!("Fetched groups from userinfo endpoint: {:?}", groups);
        }

        Ok(groups)
    }

    /// Create a session for an authenticated user
    pub async fn create_session(
        &self,
        claims: &IdTokenClaims,
        token_response: &TokenResponse,
    ) -> Result<String> {
        // Extract user information
        let user_id = claims.sub.clone();
        let username = claims
            .additional_claims
            .get("preferred_username")
            .and_then(|v| v.as_str())
            .or_else(|| {
                claims
                    .additional_claims
                    .get("email")
                    .and_then(|v| v.as_str())
            })
            .unwrap_or(&user_id)
            .to_string();

        // Extract groups from ID token first
        let mut groups = self.extract_groups_from_claims(claims);

        tracing::debug!("Extracted groups from ID token: {:?}", groups);

        // If no groups in ID token, fetch from userinfo endpoint
        if groups.is_empty() {
            groups = self
                .fetch_user_groups(&token_response.access_token)
                .await
                .unwrap_or_default();
        }

        // Resolve accessible clusters based on groups
        let accessible_clusters = self.permission_resolver.resolve_cluster_access(&groups);

        tracing::debug!(
            "Resolved cluster access - groups: {:?}, accessible_clusters: {:?}",
            groups,
            accessible_clusters
        );

        // Filter groups to only those referenced in permission mappings or
        // RBAC role names. We don't have RBAC role names here, so pass an
        // empty list — this keeps JWTs small while preserving authorization
        // behaviour driven by `permissions:` mappings.
        let filtered_groups = self
            .permission_resolver
            .filter_relevant_groups(&groups, &self.rbac_role_names);

        // Create authenticated user with filtered groups but explicit
        // accessible_clusters so downstream checks remain correct.
        let auth_user = AuthUser::new_with_clusters(
            user_id,
            username,
            filtered_groups.clone(),
            accessible_clusters.clone(),
        );

        // Create session embedding only filtered groups + accessible clusters
        let token = self
            .session_manager
            .create_session_with_clusters(auth_user, accessible_clusters)
            .await
            .context("Failed to create session")?;

        Ok(token)
    }
}
