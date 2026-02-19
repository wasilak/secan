//! Open authentication provider
//!
//! This module implements a development-only authentication mode that allows
//! all requests without requiring credentials. This mode is intended for
//! development and testing purposes only and should never be used in production.

use anyhow::Result;
use async_trait::async_trait;
use std::sync::Arc;

use super::provider::{AuthProvider, AuthRequest, AuthResponse};
use super::session::{SessionManager, UserInfo};

/// Open authentication provider for development mode
///
/// This provider creates a default development user session without requiring
/// any credentials. It should only be used in development environments.
pub struct OpenAuthProvider {
    session_manager: Arc<SessionManager>,
}

impl OpenAuthProvider {
    /// Create a new open authentication provider
    ///
    /// # Arguments
    ///
    /// * `session_manager` - Shared session manager instance
    pub fn new(session_manager: Arc<SessionManager>) -> Self {
        Self { session_manager }
    }
}

#[async_trait]
impl AuthProvider for OpenAuthProvider {
    async fn authenticate(&self, _request: AuthRequest) -> Result<AuthResponse> {
        // Create a default development user
        let user_info = UserInfo {
            id: "dev-user".to_string(),
            username: "dev-user".to_string(),
            email: Some("dev@localhost".to_string()),
            roles: vec!["admin".to_string()],
            groups: vec![],
        };

        // Create a session for the dev user
        let session_token = self.session_manager.create_session(user_info.clone()).await?;

        Ok(AuthResponse {
            user_info,
            session_token,
        })
    }

    fn provider_type(&self) -> &str {
        "open"
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

    #[tokio::test]
    async fn test_open_auth_creates_dev_user() {
        let session_config = create_test_session_config();
        let security_config = create_test_security_config();
        let session_manager = Arc::new(SessionManager::new(session_config, security_config));

        let provider = OpenAuthProvider::new(session_manager.clone());

        let response = provider
            .authenticate(AuthRequest::Open)
            .await
            .expect("Open authentication should succeed");

        // Verify dev user information
        assert_eq!(response.user_info.id, "dev-user");
        assert_eq!(response.user_info.username, "dev-user");
        assert_eq!(response.user_info.email, Some("dev@localhost".to_string()));
        assert_eq!(response.user_info.roles, vec!["admin"]);
        assert!(response.user_info.groups.is_empty());

        // Verify session token is not empty
        assert!(!response.session_token.is_empty());

        // Verify session can be validated
        let validated_user = session_manager
            .validate_session(&response.session_token)
            .await
            .expect("Session should be valid");

        assert_eq!(validated_user.id, "dev-user");
        assert_eq!(validated_user.username, "dev-user");
    }

    #[test]
    fn test_provider_type() {
        let session_config = create_test_session_config();
        let security_config = create_test_security_config();
        let session_manager = Arc::new(SessionManager::new(session_config, security_config));

        let provider = OpenAuthProvider::new(session_manager);

        assert_eq!(provider.provider_type(), "open");
    }
}
