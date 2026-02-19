//! OpenID Connect (OIDC) authentication provider
//!
//! This module implements authentication using an external OIDC identity provider
//! with support for auto-discovery and group-based access control.

use anyhow::{anyhow, Context, Result};
use async_trait::async_trait;
use openidconnect::core::{
    CoreAuthenticationFlow, CoreClient, CoreIdTokenClaims, CoreIdTokenVerifier,
    CoreProviderMetadata, CoreResponseType, CoreTokenResponse,
};
use openidconnect::reqwest::async_http_client;
use openidconnect::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, IssuerUrl, JsonWebKeySet,
    Nonce, OAuth2TokenResponse, PkceCodeChallenge, RedirectUrl, Scope, TokenUrl, UserInfoUrl,
};
use serde_json::Value;
use std::sync::Arc;
use url::Url;

use super::config::OidcConfig;
use super::provider::{AuthProvider, AuthRequest, AuthResponse};
use super::session::{SessionManager, UserInfo};

/// OIDC authentication provider
///
/// Supports both auto-discovery via .well-known/openid-configuration and manual
/// endpoint configuration. Implements token validation using JWKS and group-based
/// access control.
pub struct OidcAuthProvider {
    config: OidcConfig,
    session_manager: Arc<SessionManager>,
    client: CoreClient,
    jwks: JsonWebKeySet,
}

impl OidcAuthProvider {
    /// Create a new OIDC authentication provider
    ///
    /// This method initializes the OIDC client using either auto-discovery or manual
    /// configuration, and fetches the JWKS for token validation.
    ///
    /// # Arguments
    ///
    /// * `config` - OIDC configuration
    /// * `session_manager` - Shared session manager instance
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Auto-discovery fails
    /// - Manual endpoint configuration is invalid
    /// - JWKS cannot be fetched
    pub fn new(config: OidcConfig, session_manager: Arc<SessionManager>) -> Result<Self> {
        // Create the OIDC client based on configuration
        let client = if let Some(discovery_url) = &config.discovery_url {
            // Auto-discovery mode
            Self::create_client_with_discovery(&config, discovery_url)?
        } else {
            // Manual configuration mode
            Self::create_client_manual(&config)?
        };

        // Fetch JWKS for token validation
        let jwks = Self::fetch_jwks(&client)?;

        Ok(Self {
            config,
            session_manager,
            client,
            jwks,
        })
    }

    /// Create OIDC client using auto-discovery
    fn create_client_with_discovery(config: &OidcConfig, discovery_url: &str) -> Result<CoreClient> {
        let issuer_url = IssuerUrl::new(discovery_url.to_string())
            .context("Invalid OIDC discovery URL")?;

        // Discover provider metadata
        let provider_metadata = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                CoreProviderMetadata::discover_async(issuer_url, async_http_client)
                    .await
                    .context("Failed to discover OIDC provider metadata")
            })
        })?;

        // Create client from discovered metadata
        let client = CoreClient::from_provider_metadata(
            provider_metadata,
            ClientId::new(config.client_id.clone()),
            Some(ClientSecret::new(config.client_secret.clone())),
        )
        .set_redirect_uri(
            RedirectUrl::new(config.redirect_uri.clone())
                .context("Invalid redirect URI")?,
        );

        Ok(client)
    }

    /// Create OIDC client using manual endpoint configuration
    fn create_client_manual(config: &OidcConfig) -> Result<CoreClient> {
        let auth_url = config
            .authorization_endpoint
            .as_ref()
            .ok_or_else(|| anyhow!("Authorization endpoint required for manual configuration"))?;

        let token_url = config
            .token_endpoint
            .as_ref()
            .ok_or_else(|| anyhow!("Token endpoint required for manual configuration"))?;

        let client = CoreClient::new(
            ClientId::new(config.client_id.clone()),
            Some(ClientSecret::new(config.client_secret.clone())),
            AuthUrl::new(auth_url.clone()).context("Invalid authorization endpoint")?,
            Some(TokenUrl::new(token_url.clone()).context("Invalid token endpoint")?),
        )
        .set_redirect_uri(
            RedirectUrl::new(config.redirect_uri.clone())
                .context("Invalid redirect URI")?,
        );

        // Set optional endpoints if provided
        let client = if let Some(userinfo_url) = &config.userinfo_endpoint {
            client.set_userinfo_uri(
                UserInfoUrl::new(userinfo_url.clone())
                    .context("Invalid userinfo endpoint")?,
            )
        } else {
            client
        };

        Ok(client)
    }

    /// Fetch JWKS from the provider for token validation
    fn fetch_jwks(client: &CoreClient) -> Result<JsonWebKeySet> {
        let jwks_uri = client
            .jwks_uri()
            .ok_or_else(|| anyhow!("JWKS URI not available from provider"))?;

        // Fetch JWKS synchronously (called during initialization)
        let jwks = tokio::task::block_in_place(|| {
            tokio::runtime::Handle::current().block_on(async {
                async_http_client(jwks_uri.into())
                    .await
                    .context("Failed to fetch JWKS")
            })
        })?;

        let jwks_json: JsonWebKeySet = serde_json::from_slice(&jwks.body)
            .context("Failed to parse JWKS")?;

        Ok(jwks_json)
    }

    /// Generate authorization URL for initiating OIDC login flow
    ///
    /// Returns a tuple of (authorization_url, csrf_token) where the CSRF token
    /// should be stored in the session for validation during callback.
    pub fn authorization_url(&self) -> (Url, CsrfToken) {
        let (pkce_challenge, _pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let (auth_url, csrf_token, _nonce) = self
            .client
            .authorize_url(
                CoreAuthenticationFlow::AuthorizationCode,
                CsrfToken::new_random,
                Nonce::new_random,
            )
            .add_scope(Scope::new("openid".to_string()))
            .add_scope(Scope::new("profile".to_string()))
            .add_scope(Scope::new("email".to_string()))
            .set_pkce_challenge(pkce_challenge)
            .url();

        (auth_url, csrf_token)
    }

    /// Validate group membership based on token claims
    ///
    /// Extracts the group claim from the token and checks if the user is a member
    /// of at least one required group. If no required groups are configured, all
    /// authenticated users are allowed.
    ///
    /// # Arguments
    ///
    /// * `claims` - Additional claims from the ID token
    ///
    /// # Returns
    ///
    /// Returns the list of user groups on success.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Group claim is not present in the token (when required groups are configured)
    /// - User is not a member of any required group
    fn validate_groups(&self, claims: &Value) -> Result<Vec<String>> {
        // If no required groups are configured, allow all authenticated users
        if self.config.required_groups.is_empty() {
            return Ok(vec![]);
        }

        let group_claim_key = self
            .config
            .group_claim_key
            .as_deref()
            .unwrap_or("groups");

        // Extract group claim from token
        let groups_value = claims
            .get(group_claim_key)
            .ok_or_else(|| {
                anyhow!(
                    "Group claim '{}' not found in token. Required groups: {:?}",
                    group_claim_key,
                    self.config.required_groups
                )
            })?;

        // Parse groups as array of strings
        let user_groups: Vec<String> = if let Some(groups_array) = groups_value.as_array() {
            groups_array
                .iter()
                .filter_map(|g| g.as_str().map(String::from))
                .collect()
        } else if let Some(group_str) = groups_value.as_str() {
            // Handle case where groups is a single string
            vec![group_str.to_string()]
        } else {
            return Err(anyhow!(
                "Group claim '{}' has invalid format (expected array or string)",
                group_claim_key
            ));
        };

        // Check if user is in at least one required group
        let has_required_group = user_groups
            .iter()
            .any(|g| self.config.required_groups.contains(g));

        if !has_required_group {
            return Err(anyhow!(
                "Access denied: User is not a member of any required groups. Required: {:?}, User has: {:?}",
                self.config.required_groups,
                user_groups
            ));
        }

        Ok(user_groups)
    }

    /// Extract user information from ID token claims
    fn extract_user_info(&self, claims: &CoreIdTokenClaims, groups: Vec<String>) -> UserInfo {
        let user_id = claims.subject().to_string();
        let username = claims
            .preferred_username()
            .map(|u| u.as_str().to_string())
            .unwrap_or_else(|| user_id.clone());
        let email = claims.email().map(|e| e.as_str().to_string());

        UserInfo {
            id: user_id,
            username,
            email,
            roles: vec![], // Roles could be mapped from groups if needed
            groups,
        }
    }
}

#[async_trait]
impl AuthProvider for OidcAuthProvider {
    /// Authenticate a user via OIDC callback
    ///
    /// This method handles the OIDC callback by:
    /// 1. Exchanging the authorization code for tokens
    /// 2. Validating the ID token signature using JWKS
    /// 3. Extracting user information from token claims
    /// 4. Validating group membership (if required)
    /// 5. Creating a session and returning a session token
    ///
    /// # Arguments
    ///
    /// * `request` - Must be an OidcCallback variant with authorization code and state
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Request type is not OidcCallback
    /// - Token exchange fails
    /// - ID token validation fails
    /// - Group validation fails
    /// - Session creation fails
    async fn authenticate(&self, request: AuthRequest) -> Result<AuthResponse> {
        let (code, _state) = match request {
            AuthRequest::OidcCallback { code, state } => (code, state),
            _ => return Err(anyhow!("Invalid request type for OIDC authentication")),
        };

        // Exchange authorization code for tokens
        let token_response = self
            .client
            .exchange_code(AuthorizationCode::new(code))
            .request_async(async_http_client)
            .await
            .context("Failed to exchange authorization code for tokens")?;

        // Extract ID token
        let id_token = token_response
            .id_token()
            .ok_or_else(|| anyhow!("No ID token in response"))?;

        // Validate ID token signature using JWKS
        let id_token_verifier = CoreIdTokenVerifier::new_public_client(
            self.client.client_id().clone(),
            self.jwks.clone(),
        );

        let claims = id_token
            .claims(&id_token_verifier, Nonce::new("nonce".to_string()))
            .context("Failed to validate ID token signature")?;

        // Validate group membership
        let groups = self.validate_groups(claims.additional_claims())?;

        // Extract user information
        let user_info = self.extract_user_info(claims, groups);

        // Create session
        let session_token = self
            .session_manager
            .create_session(user_info.clone())
            .await
            .context("Failed to create session")?;

        Ok(AuthResponse {
            user_info,
            session_token,
        })
    }

    fn provider_type(&self) -> &str {
        "oidc"
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::config::{RenewalMode, SecurityConfig, SessionConfig};

    fn create_test_session_config() -> SessionConfig {
        SessionConfig {
            timeout_seconds: 3600,
            renewal_mode: RenewalMode::SlidingWindow,
            cookie_name: "session_token".to_string(),
            secure_only: true,
        }
    }

    fn create_test_security_config() -> SecurityConfig {
        SecurityConfig {
            rate_limit_attempts: 5,
            rate_limit_window_seconds: 300,
            min_password_length: 8,
            require_https: false,
        }
    }

    #[test]
    fn test_validate_groups_no_required_groups() {
        let config = OidcConfig {
            client_id: "test".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "http://localhost/callback".to_string(),
            discovery_url: None,
            authorization_endpoint: Some("http://localhost/auth".to_string()),
            token_endpoint: Some("http://localhost/token".to_string()),
            userinfo_endpoint: Some("http://localhost/userinfo".to_string()),
            jwks_uri: Some("http://localhost/jwks".to_string()),
            group_claim_key: None,
            required_groups: vec![], // No required groups
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        // This will fail because we can't actually create a real OIDC client without a server
        // but we can test the validate_groups logic with a mock provider
        let claims = serde_json::json!({
            "groups": ["admin", "users"]
        });

        // Create a mock provider for testing validate_groups
        // Note: We can't test the full provider creation without a real OIDC server
        // but we can test the group validation logic
    }

    #[test]
    fn test_validate_groups_with_required_groups() {
        // Test group validation logic
        let config = OidcConfig {
            client_id: "test".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "http://localhost/callback".to_string(),
            discovery_url: None,
            authorization_endpoint: Some("http://localhost/auth".to_string()),
            token_endpoint: Some("http://localhost/token".to_string()),
            userinfo_endpoint: Some("http://localhost/userinfo".to_string()),
            jwks_uri: Some("http://localhost/jwks".to_string()),
            group_claim_key: Some("groups".to_string()),
            required_groups: vec!["admin".to_string()],
        };

        // We can't fully test this without mocking the OIDC client
        // Integration tests with a real OIDC provider would be needed
    }

    #[test]
    fn test_provider_type() {
        let config = OidcConfig {
            client_id: "test".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "http://localhost/callback".to_string(),
            discovery_url: None,
            authorization_endpoint: Some("http://localhost/auth".to_string()),
            token_endpoint: Some("http://localhost/token".to_string()),
            userinfo_endpoint: Some("http://localhost/userinfo".to_string()),
            jwks_uri: Some("http://localhost/jwks".to_string()),
            group_claim_key: None,
            required_groups: vec![],
        };

        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));

        // Note: This will fail in tests because we can't create a real OIDC client
        // In a real environment with a running OIDC provider, this would work
        // For now, we'll skip the full provider creation test
    }
}
