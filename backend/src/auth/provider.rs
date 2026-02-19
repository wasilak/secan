//! Authentication provider interface and factory
//!
//! This module defines the core authentication provider trait and factory for creating
//! provider instances based on configuration. It supports local users, OIDC, and open
//! authentication modes.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use super::config::{AuthConfig, AuthMode};
use super::local::LocalAuthProvider;
use super::oidc::OidcAuthProvider;
use super::open::OpenAuthProvider;
use super::session::{SessionManager, UserInfo};

/// Authentication request types for different authentication modes
#[derive(Debug, Clone)]
pub enum AuthRequest {
    /// Local authentication with username and password
    LocalCredentials { username: String, password: String },
    /// OIDC callback with authorization code and state
    OidcCallback { code: String, state: String },
    /// Open mode authentication (no credentials required)
    Open,
}

/// Authentication response containing user information and session token
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthResponse {
    pub user_info: UserInfo,
    pub session_token: String,
}

/// Authentication provider trait
///
/// This trait defines the interface that all authentication providers must implement.
/// Different authentication modes (local, OIDC, open) implement this trait to provide
/// their specific authentication logic.
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Authenticate a user based on the provided request
    ///
    /// Returns an AuthResponse containing user information and a session token on success.
    async fn authenticate(&self, request: AuthRequest) -> Result<AuthResponse>;

    /// Get the provider type identifier
    ///
    /// Returns a string identifying the provider type (e.g., "local", "oidc", "open").
    fn provider_type(&self) -> &str;
}

/// Factory for creating authentication provider instances
///
/// The factory creates the appropriate authentication provider based on the
/// configured authentication mode.
pub struct AuthProviderFactory {
    config: AuthConfig,
    session_manager: Arc<SessionManager>,
}

impl AuthProviderFactory {
    /// Create a new AuthProviderFactory
    ///
    /// # Arguments
    ///
    /// * `config` - Authentication configuration
    /// * `session_manager` - Shared session manager instance
    pub fn new(config: AuthConfig, session_manager: Arc<SessionManager>) -> Self {
        Self {
            config,
            session_manager,
        }
    }

    /// Create an authentication provider based on the configured mode
    ///
    /// Returns a boxed trait object implementing the AuthProvider trait.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - The required configuration for the selected mode is missing
    /// - Provider initialization fails (e.g., OIDC discovery fails)
    pub fn create(&self) -> Result<Box<dyn AuthProvider>> {
        match self.config.mode {
            AuthMode::Local => {
                let local_config = self
                    .config
                    .local
                    .as_ref()
                    .ok_or_else(|| anyhow!("Local auth mode requires local configuration"))?;

                Ok(Box::new(LocalAuthProvider::new(
                    local_config.clone(),
                    self.session_manager.clone(),
                )))
            }
            AuthMode::Oidc => {
                let oidc_config = self
                    .config
                    .oidc
                    .as_ref()
                    .ok_or_else(|| anyhow!("OIDC auth mode requires OIDC configuration"))?;

                Ok(Box::new(OidcAuthProvider::new(
                    oidc_config.clone(),
                    self.session_manager.clone(),
                )?))
            }
            AuthMode::Open => Ok(Box::new(OpenAuthProvider::new(
                self.session_manager.clone(),
            ))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::config::{
        HashAlgorithm, LocalAuthConfig, LocalUser, RenewalMode, SecurityConfig, SessionConfig,
    };

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
    fn test_factory_create_local_provider() {
        let config = AuthConfig {
            mode: AuthMode::Local,
            local: Some(LocalAuthConfig {
                users: vec![LocalUser {
                    username: "admin".to_string(),
                    password_hash: "$2b$12$abcdefghijklmnopqrstuv".to_string(),
                    hash_algorithm: HashAlgorithm::Bcrypt,
                    roles: vec!["admin".to_string()],
                }],
            }),
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };

        let session_manager = Arc::new(SessionManager::new(
            config.session.clone(),
            config.security.clone(),
        ));

        let factory = AuthProviderFactory::new(config, session_manager);
        let provider = factory.create().unwrap();

        assert_eq!(provider.provider_type(), "local");
    }

    #[test]
    fn test_factory_create_open_provider() {
        let config = AuthConfig {
            mode: AuthMode::Open,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };

        let session_manager = Arc::new(SessionManager::new(
            config.session.clone(),
            config.security.clone(),
        ));

        let factory = AuthProviderFactory::new(config, session_manager);
        let provider = factory.create().unwrap();

        assert_eq!(provider.provider_type(), "open");
    }

    #[test]
    fn test_factory_create_local_provider_missing_config() {
        let config = AuthConfig {
            mode: AuthMode::Local,
            local: None, // Missing local config
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };

        let session_manager = Arc::new(SessionManager::new(
            config.session.clone(),
            config.security.clone(),
        ));

        let factory = AuthProviderFactory::new(config, session_manager);
        let result = factory.create();

        assert!(result.is_err());
        assert!(result
            .unwrap_err()
            .to_string()
            .contains("Local auth mode requires local configuration"));
    }

    #[test]
    fn test_auth_request_variants() {
        let local_req = AuthRequest::LocalCredentials {
            username: "admin".to_string(),
            password: "password".to_string(),
        };

        let oidc_req = AuthRequest::OidcCallback {
            code: "auth_code".to_string(),
            state: "csrf_token".to_string(),
        };

        let open_req = AuthRequest::Open;

        // Verify variants can be created
        match local_req {
            AuthRequest::LocalCredentials { username, password } => {
                assert_eq!(username, "admin");
                assert_eq!(password, "password");
            }
            _ => panic!("Expected LocalCredentials variant"),
        }

        match oidc_req {
            AuthRequest::OidcCallback { code, state } => {
                assert_eq!(code, "auth_code");
                assert_eq!(state, "csrf_token");
            }
            _ => panic!("Expected OidcCallback variant"),
        }

        match open_req {
            AuthRequest::Open => {}
            _ => panic!("Expected Open variant"),
        }
    }
}
