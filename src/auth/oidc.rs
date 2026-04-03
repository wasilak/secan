//! OpenID Connect (OIDC) authentication provider
//!
//! This module implements authentication using an external OIDC identity provider
//! with support for auto-discovery, group-based access control, and userinfo endpoint.

use anyhow::{anyhow, Context, Result};
use base64::Engine;
use reqwest::Client as HttpClient;
use serde::{Deserialize, Deserializer, Serialize};
use serde_json::Value;
use std::sync::Arc;

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
}

impl OidcAuthProvider {
    /// Create a new OIDC authentication provider
    pub async fn new(
        config: OidcConfig,
        session_manager: Arc<SessionManager>,
        permission_resolver: PermissionResolver,
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

        Ok(Self {
            config,
            session_manager,
            metadata,
            http_client,
            permission_resolver,
        })
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
    pub fn validate_id_token(&self, id_token_str: &str) -> Result<IdTokenClaims> {
        tracing::debug!("Validating ID token");

        let parts: Vec<&str> = id_token_str.split('.').collect();
        if parts.len() != 3 {
            return Err(anyhow!(
                "Invalid ID token format: expected 3 parts, got {}",
                parts.len()
            ));
        }

        let payload_bytes = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode(parts[1])
            .context("Failed to decode ID token payload")?;

        let claims: IdTokenClaims =
            serde_json::from_slice(&payload_bytes).context("Failed to parse ID token claims")?;

        tracing::debug!(subject = %claims.sub, "ID token validated successfully");

        Ok(claims)
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

        // Create authenticated user
        let auth_user =
            AuthUser::new_with_clusters(user_id, username, groups, accessible_clusters.clone());

        // Create session
        let token = self
            .session_manager
            .create_session_with_clusters(auth_user, accessible_clusters)
            .await
            .context("Failed to create session")?;

        Ok(token)
    }
}
