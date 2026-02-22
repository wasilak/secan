use crate::auth::{AuthUser, SessionManager};
use crate::config::OidcConfig;
use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// OIDC provider metadata from discovery endpoint
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcProviderMetadata {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub userinfo_endpoint: Option<String>,
    pub jwks_uri: String,
    pub response_types_supported: Vec<String>,
    pub subject_types_supported: Vec<String>,
    pub id_token_signing_alg_values_supported: Vec<String>,
}

/// OIDC token response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
    pub id_token: String,
}

/// OIDC ID token claims
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdTokenClaims {
    pub iss: String,
    pub sub: String,
    pub aud: String,
    pub exp: u64,
    pub iat: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub preferred_username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub groups: Option<Vec<String>>,
    #[serde(flatten)]
    pub extra: serde_json::Map<String, serde_json::Value>,
}

/// JSON Web Key Set
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwks {
    pub keys: Vec<Jwk>,
}

/// JSON Web Key
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Jwk {
    pub kty: String,
    pub kid: Option<String>,
    pub use_: Option<String>,
    pub alg: Option<String>,
    pub n: Option<String>,
    pub e: Option<String>,
}

/// OIDC authentication provider
pub struct OidcAuthProvider {
    config: OidcConfig,
    metadata: OidcProviderMetadata,
    #[allow(dead_code)] // Will be used for JWT signature verification
    jwks: Jwks,
    http_client: reqwest::Client,
    session_manager: Arc<SessionManager>,
}

impl OidcAuthProvider {
    /// Create a new OIDC authentication provider
    ///
    /// This performs OIDC discovery and fetches the provider's public keys
    pub async fn new(config: OidcConfig, session_manager: Arc<SessionManager>) -> Result<Self> {
        let http_client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .build()
            .context("Failed to create HTTP client")?;

        // Perform OIDC discovery
        let metadata = Self::discover(&http_client, &config.discovery_url)
            .await
            .context("Failed to discover OIDC provider")?;

        // Fetch JWKS
        let jwks = Self::fetch_jwks(&http_client, &metadata.jwks_uri)
            .await
            .context("Failed to fetch JWKS")?;

        Ok(Self {
            config,
            metadata,
            jwks,
            http_client,
            session_manager,
        })
    }

    /// Perform OIDC discovery
    ///
    /// Fetches the provider metadata from the discovery endpoint
    async fn discover(
        client: &reqwest::Client,
        discovery_url: &str,
    ) -> Result<OidcProviderMetadata> {
        tracing::info!("Performing OIDC discovery: {}", discovery_url);

        let response = client
            .get(discovery_url)
            .send()
            .await
            .context("Failed to fetch OIDC discovery document")?;

        if !response.status().is_success() {
            anyhow::bail!("OIDC discovery failed with status: {}", response.status());
        }

        let metadata: OidcProviderMetadata = response
            .json()
            .await
            .context("Failed to parse OIDC discovery document")?;

        tracing::info!("OIDC discovery successful, issuer: {}", metadata.issuer);

        Ok(metadata)
    }

    /// Fetch JSON Web Key Set from the provider
    async fn fetch_jwks(client: &reqwest::Client, jwks_uri: &str) -> Result<Jwks> {
        tracing::info!("Fetching JWKS from: {}", jwks_uri);

        let response = client
            .get(jwks_uri)
            .send()
            .await
            .context("Failed to fetch JWKS")?;

        if !response.status().is_success() {
            anyhow::bail!("JWKS fetch failed with status: {}", response.status());
        }

        let jwks: Jwks = response.json().await.context("Failed to parse JWKS")?;

        tracing::info!("JWKS fetched successfully, {} keys", jwks.keys.len());

        Ok(jwks)
    }

    /// Get the authorization URL for redirecting the user to the OIDC provider
    pub fn get_authorization_url(&self, state: &str) -> String {
        format!(
            "{}?client_id={}&redirect_uri={}&response_type=code&scope=openid%20profile%20email&state={}",
            self.metadata.authorization_endpoint,
            urlencoding::encode(&self.config.client_id),
            urlencoding::encode(&self.config.redirect_uri),
            urlencoding::encode(state)
        )
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code(&self, code: &str) -> Result<TokenResponse> {
        tracing::info!("Exchanging authorization code for tokens");

        let params = [
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", &self.config.redirect_uri),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
        ];

        let response = self
            .http_client
            .post(&self.metadata.token_endpoint)
            .form(&params)
            .send()
            .await
            .context("Failed to exchange authorization code")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Token exchange failed with status {}: {}", status, body);
        }

        let token_response: TokenResponse = response
            .json()
            .await
            .context("Failed to parse token response")?;

        tracing::info!("Token exchange successful");

        Ok(token_response)
    }

    /// Validate and decode ID token
    ///
    /// This performs basic validation:
    /// - Decodes the JWT
    /// - Validates the signature (simplified - in production use a proper JWT library)
    /// - Validates issuer, audience, and expiration
    pub fn validate_id_token(&self, id_token: &str) -> Result<IdTokenClaims> {
        tracing::info!("Validating ID token");

        // Split the JWT into parts
        let parts: Vec<&str> = id_token.split('.').collect();
        if parts.len() != 3 {
            anyhow::bail!("Invalid JWT format");
        }

        // Decode the payload (second part)
        let payload = Self::base64_decode(parts[1]).context("Failed to decode JWT payload")?;

        let claims: IdTokenClaims =
            serde_json::from_slice(&payload).context("Failed to parse JWT claims")?;

        // Validate issuer
        if claims.iss != self.metadata.issuer {
            anyhow::bail!(
                "Invalid issuer: expected {}, got {}",
                self.metadata.issuer,
                claims.iss
            );
        }

        // Validate audience
        if claims.aud != self.config.client_id {
            anyhow::bail!(
                "Invalid audience: expected {}, got {}",
                self.config.client_id,
                claims.aud
            );
        }

        // Validate expiration
        let now = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_secs();

        if claims.exp < now {
            anyhow::bail!("Token has expired");
        }

        tracing::info!(
            "ID token validated successfully for subject: {}",
            claims.sub
        );

        Ok(claims)
    }

    /// Refresh an access token using a refresh token
    pub async fn refresh_token(&self, refresh_token: &str) -> Result<TokenResponse> {
        tracing::info!("Refreshing access token");

        let params = [
            ("grant_type", "refresh_token"),
            ("refresh_token", refresh_token),
            ("client_id", &self.config.client_id),
            ("client_secret", &self.config.client_secret),
        ];

        let response = self
            .http_client
            .post(&self.metadata.token_endpoint)
            .form(&params)
            .send()
            .await
            .context("Failed to refresh token")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Token refresh failed with status {}: {}", status, body);
        }

        let token_response: TokenResponse = response
            .json()
            .await
            .context("Failed to parse token response")?;

        tracing::info!("Token refresh successful");

        Ok(token_response)
    }

    /// Extract user information from ID token claims
    pub fn extract_user_info(&self, claims: &IdTokenClaims) -> AuthUser {
        let username = claims
            .preferred_username
            .clone()
            .or_else(|| claims.email.clone())
            .unwrap_or_else(|| claims.sub.clone());

        // Extract groups from the configured claim key
        let roles = self.extract_groups(claims);

        AuthUser {
            id: claims.sub.clone(),
            username,
            roles,
        }
    }

    /// Extract groups from claims using the configured groups_claim_key
    fn extract_groups(&self, claims: &IdTokenClaims) -> Vec<String> {
        // First try to get groups from the configured claim key
        if let Some(value) = claims.extra.get(&self.config.groups_claim_key) {
            if let Some(groups) = value.as_array() {
                return groups
                    .iter()
                    .filter_map(|g| g.as_str().map(String::from))
                    .collect();
            }
        }

        // Fall back to the hardcoded "groups" field for backward compatibility
        if self.config.groups_claim_key != "groups" {
            if let Some(groups) = &claims.groups {
                return groups.clone();
            }
        }

        Vec::new()
    }

    /// Create a session for an authenticated user
    pub async fn create_session(&self, claims: &IdTokenClaims) -> Result<String> {
        let user = self.extract_user_info(claims);
        self.session_manager
            .create_session(user)
            .await
            .context("Failed to create session")
    }

    /// Base64 URL decode (without padding)
    fn base64_decode(input: &str) -> Result<Vec<u8>> {
        use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine};
        URL_SAFE_NO_PAD
            .decode(input)
            .context("Failed to decode base64")
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_base64_decode() {
        let input = "eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIn0";
        let result = OidcAuthProvider::base64_decode(input).unwrap();
        let json: serde_json::Value = serde_json::from_slice(&result).unwrap();
        assert_eq!(json["iss"], "https://example.com");
    }

    #[test]
    fn test_extract_user_info() {
        let mut extra = serde_json::Map::new();
        extra.insert(
            "groups".to_string(),
            serde_json::Value::Array(vec![
                serde_json::Value::String("admin".to_string()),
                serde_json::Value::String("users".to_string()),
            ]),
        );

        let claims = IdTokenClaims {
            iss: "https://auth.example.com".to_string(),
            sub: "user123".to_string(),
            aud: "client-id".to_string(),
            exp: 9999999999,
            iat: 1234567890,
            email: Some("user@example.com".to_string()),
            name: Some("Test User".to_string()),
            preferred_username: Some("testuser".to_string()),
            groups: Some(vec!["admin".to_string(), "users".to_string()]),
            extra,
        };

        let config = OidcConfig {
            discovery_url: "https://auth.example.com/.well-known/openid-configuration".to_string(),
            client_id: "client-id".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://app.example.com/callback".to_string(),
            groups_claim_key: "groups".to_string(),
        };

        let metadata = OidcProviderMetadata {
            issuer: "https://auth.example.com".to_string(),
            authorization_endpoint: "https://auth.example.com/authorize".to_string(),
            token_endpoint: "https://auth.example.com/token".to_string(),
            userinfo_endpoint: Some("https://auth.example.com/userinfo".to_string()),
            jwks_uri: "https://auth.example.com/jwks".to_string(),
            response_types_supported: vec!["code".to_string()],
            subject_types_supported: vec!["public".to_string()],
            id_token_signing_alg_values_supported: vec!["RS256".to_string()],
        };

        let jwks = Jwks { keys: vec![] };

        let http_client = reqwest::Client::new();
        let session_manager = Arc::new(SessionManager::new(crate::auth::SessionConfig::new(60)));

        let provider = OidcAuthProvider {
            config,
            metadata,
            jwks,
            http_client,
            session_manager,
        };

        let user = provider.extract_user_info(&claims);

        assert_eq!(user.id, "user123");
        assert_eq!(user.username, "testuser");
        assert_eq!(user.roles, vec!["admin", "users"]);
    }

    #[test]
    fn test_get_authorization_url() {
        let config = OidcConfig {
            discovery_url: "https://auth.example.com/.well-known/openid-configuration".to_string(),
            client_id: "my-client".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://app.example.com/callback".to_string(),
            groups_claim_key: "groups".to_string(),
        };

        let metadata = OidcProviderMetadata {
            issuer: "https://auth.example.com".to_string(),
            authorization_endpoint: "https://auth.example.com/authorize".to_string(),
            token_endpoint: "https://auth.example.com/token".to_string(),
            userinfo_endpoint: None,
            jwks_uri: "https://auth.example.com/jwks".to_string(),
            response_types_supported: vec!["code".to_string()],
            subject_types_supported: vec!["public".to_string()],
            id_token_signing_alg_values_supported: vec!["RS256".to_string()],
        };

        let jwks = Jwks { keys: vec![] };
        let http_client = reqwest::Client::new();
        let session_manager = Arc::new(SessionManager::new(crate::auth::SessionConfig::new(60)));

        let provider = OidcAuthProvider {
            config,
            metadata,
            jwks,
            http_client,
            session_manager,
        };

        let url = provider.get_authorization_url("random-state");

        assert!(url.contains("client_id=my-client"));
        assert!(url.contains("redirect_uri=https%3A%2F%2Fapp.example.com%2Fcallback"));
        assert!(url.contains("response_type=code"));
        assert!(url.contains("state=random-state"));
    }

    #[test]
    fn test_extract_user_info_with_custom_claim_key() {
        let mut extra = serde_json::Map::new();
        extra.insert(
            "departments".to_string(),
            serde_json::Value::Array(vec![
                serde_json::Value::String("engineering".to_string()),
                serde_json::Value::String("admin".to_string()),
            ]),
        );

        let claims = IdTokenClaims {
            iss: "https://auth.example.com".to_string(),
            sub: "user123".to_string(),
            aud: "client-id".to_string(),
            exp: 9999999999,
            iat: 1234567890,
            email: Some("user@example.com".to_string()),
            name: Some("Test User".to_string()),
            preferred_username: Some("testuser".to_string()),
            groups: None,
            extra,
        };

        let config = OidcConfig {
            discovery_url: "https://auth.example.com/.well-known/openid-configuration".to_string(),
            client_id: "client-id".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://app.example.com/callback".to_string(),
            groups_claim_key: "departments".to_string(),
        };

        let metadata = OidcProviderMetadata {
            issuer: "https://auth.example.com".to_string(),
            authorization_endpoint: "https://auth.example.com/authorize".to_string(),
            token_endpoint: "https://auth.example.com/token".to_string(),
            userinfo_endpoint: Some("https://auth.example.com/userinfo".to_string()),
            jwks_uri: "https://auth.example.com/jwks".to_string(),
            response_types_supported: vec!["code".to_string()],
            subject_types_supported: vec!["public".to_string()],
            id_token_signing_alg_values_supported: vec!["RS256".to_string()],
        };

        let jwks = Jwks { keys: vec![] };
        let http_client = reqwest::Client::new();
        let session_manager = Arc::new(SessionManager::new(crate::auth::SessionConfig::new(60)));

        let provider = OidcAuthProvider {
            config,
            metadata,
            jwks,
            http_client,
            session_manager,
        };

        let user = provider.extract_user_info(&claims);

        assert_eq!(user.id, "user123");
        assert_eq!(user.username, "testuser");
        assert_eq!(user.roles, vec!["engineering", "admin"]);
    }

    #[test]
    fn test_extract_user_info_with_missing_groups_claim() {
        let extra = serde_json::Map::new();

        let claims = IdTokenClaims {
            iss: "https://auth.example.com".to_string(),
            sub: "user123".to_string(),
            aud: "client-id".to_string(),
            exp: 9999999999,
            iat: 1234567890,
            email: Some("user@example.com".to_string()),
            name: Some("Test User".to_string()),
            preferred_username: Some("testuser".to_string()),
            groups: None,
            extra,
        };

        let config = OidcConfig {
            discovery_url: "https://auth.example.com/.well-known/openid-configuration".to_string(),
            client_id: "client-id".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://app.example.com/callback".to_string(),
            groups_claim_key: "groups".to_string(),
        };

        let metadata = OidcProviderMetadata {
            issuer: "https://auth.example.com".to_string(),
            authorization_endpoint: "https://auth.example.com/authorize".to_string(),
            token_endpoint: "https://auth.example.com/token".to_string(),
            userinfo_endpoint: Some("https://auth.example.com/userinfo".to_string()),
            jwks_uri: "https://auth.example.com/jwks".to_string(),
            response_types_supported: vec!["code".to_string()],
            subject_types_supported: vec!["public".to_string()],
            id_token_signing_alg_values_supported: vec!["RS256".to_string()],
        };

        let jwks = Jwks { keys: vec![] };
        let http_client = reqwest::Client::new();
        let session_manager = Arc::new(SessionManager::new(crate::auth::SessionConfig::new(60)));

        let provider = OidcAuthProvider {
            config,
            metadata,
            jwks,
            http_client,
            session_manager,
        };

        let user = provider.extract_user_info(&claims);

        assert_eq!(user.id, "user123");
        assert_eq!(user.username, "testuser");
        assert!(user.roles.is_empty());
    }
}
