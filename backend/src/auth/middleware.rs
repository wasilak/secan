//! Authentication middleware
//!
//! This module provides Axum middleware for authenticating HTTP requests
//! and adding user information to request extensions.

use super::config::AuthConfig;
use super::session::{SessionManager, UserInfo};
use axum::{
    body::Body,
    extract::Request,
    http::{header, StatusCode},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;
use tracing::{debug, warn};

/// Authentication middleware for validating sessions and protecting routes
pub struct AuthMiddleware {
    session_manager: Arc<SessionManager>,
    config: AuthConfig,
}

impl AuthMiddleware {
    /// Create a new authentication middleware
    pub fn new(session_manager: Arc<SessionManager>, config: AuthConfig) -> Self {
        Self {
            session_manager,
            config,
        }
    }

    /// Authenticate a request by validating the session token
    ///
    /// This middleware:
    /// - Skips authentication for open mode
    /// - Skips authentication for public endpoints (login, OIDC callback)
    /// - Extracts session token from cookies
    /// - Validates the session and adds user info to request extensions
    /// - Returns 401 Unauthorized for invalid sessions
    pub async fn authenticate(
        &self,
        mut req: Request<Body>,
        next: Next,
    ) -> Result<Response, StatusCode> {
        // Skip authentication for open mode
        if self.config.mode == super::config::AuthMode::Open {
            debug!("Skipping authentication (open mode)");
            return Ok(next.run(req).await);
        }

        // Skip authentication for public endpoints
        if self.is_public_endpoint(req.uri().path()) {
            debug!("Skipping authentication for public endpoint: {}", req.uri().path());
            return Ok(next.run(req).await);
        }

        // Extract session token from cookie
        let token = self
            .extract_session_token(&req)
            .ok_or_else(|| {
                warn!("Authentication failed: no session cookie found");
                StatusCode::UNAUTHORIZED
            })?;

        // Validate session
        let user_info = self
            .session_manager
            .validate_session(&token)
            .await
            .map_err(|e| {
                warn!("Session validation failed: {}", e);
                StatusCode::UNAUTHORIZED
            })?;

        debug!("Request authenticated for user: {}", user_info.username);

        // Add user info to request extensions
        req.extensions_mut().insert(user_info);

        Ok(next.run(req).await)
    }

    /// Check if the request path is a public endpoint that doesn't require authentication
    fn is_public_endpoint(&self, path: &str) -> bool {
        matches!(
            path,
            "/api/auth/login" | "/api/auth/oidc/login" | "/api/auth/oidc/callback"
        )
    }

    /// Extract session token from the Cookie header
    ///
    /// Parses the Cookie header and looks for the configured cookie name.
    fn extract_session_token(&self, req: &Request<Body>) -> Option<String> {
        let cookies = req.headers().get(header::COOKIE)?;
        let cookies_str = cookies.to_str().ok()?;

        for cookie in cookies_str.split(';') {
            let parts: Vec<&str> = cookie.trim().splitn(2, '=').collect();
            if parts.len() == 2 && parts[0] == self.config.session.cookie_name {
                return Some(parts[1].to_string());
            }
        }

        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::config::{RenewalMode, SecurityConfig, SessionConfig};
    use axum::{
        body::Body,
        http::{Request, StatusCode},
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

    fn create_test_user_info() -> UserInfo {
        UserInfo {
            id: "test-user-id".to_string(),
            username: "testuser".to_string(),
            email: Some("test@example.com".to_string()),
            roles: vec!["admin".to_string()],
            groups: vec!["developers".to_string()],
        }
    }

    #[test]
    fn test_is_public_endpoint() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Local,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager, config);

        assert!(middleware.is_public_endpoint("/api/auth/login"));
        assert!(middleware.is_public_endpoint("/api/auth/oidc/login"));
        assert!(middleware.is_public_endpoint("/api/auth/oidc/callback"));
        assert!(!middleware.is_public_endpoint("/api/clusters"));
        assert!(!middleware.is_public_endpoint("/api/auth/logout"));
    }

    #[test]
    fn test_extract_session_token() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Local,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager, config);

        // Test with valid cookie
        let req = Request::builder()
            .header(header::COOKIE, "session_token=abc123")
            .body(Body::empty())
            .unwrap();
        assert_eq!(middleware.extract_session_token(&req), Some("abc123".to_string()));

        // Test with multiple cookies
        let req = Request::builder()
            .header(header::COOKIE, "other=value; session_token=xyz789; another=data")
            .body(Body::empty())
            .unwrap();
        assert_eq!(middleware.extract_session_token(&req), Some("xyz789".to_string()));

        // Test with no matching cookie
        let req = Request::builder()
            .header(header::COOKIE, "other=value")
            .body(Body::empty())
            .unwrap();
        assert_eq!(middleware.extract_session_token(&req), None);

        // Test with no cookie header
        let req = Request::builder()
            .body(Body::empty())
            .unwrap();
        assert_eq!(middleware.extract_session_token(&req), None);
    }

    #[tokio::test]
    async fn test_authenticate_open_mode() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Open,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager, config);

        let req = Request::builder()
            .uri("/api/clusters")
            .body(Body::empty())
            .unwrap();

        // Create a simple next handler that returns OK
        let next = Next::new(|_req: Request<Body>| async {
            Ok::<Response, StatusCode>(Response::new(Body::empty()))
        });

        let result = middleware.authenticate(req, next).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_authenticate_public_endpoint() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Local,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager, config);

        let req = Request::builder()
            .uri("/api/auth/login")
            .body(Body::empty())
            .unwrap();

        let next = Next::new(|_req: Request<Body>| async {
            Ok::<Response, StatusCode>(Response::new(Body::empty()))
        });

        let result = middleware.authenticate(req, next).await;
        assert!(result.is_ok());
    }

    #[tokio::test]
    async fn test_authenticate_missing_cookie() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Local,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager, config);

        let req = Request::builder()
            .uri("/api/clusters")
            .body(Body::empty())
            .unwrap();

        let next = Next::new(|_req: Request<Body>| async {
            Ok::<Response, StatusCode>(Response::new(Body::empty()))
        });

        let result = middleware.authenticate(req, next).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_authenticate_invalid_session() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Local,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager, config);

        let req = Request::builder()
            .uri("/api/clusters")
            .header(header::COOKIE, "session_token=invalid-token")
            .body(Body::empty())
            .unwrap();

        let next = Next::new(|_req: Request<Body>| async {
            Ok::<Response, StatusCode>(Response::new(Body::empty()))
        });

        let result = middleware.authenticate(req, next).await;
        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), StatusCode::UNAUTHORIZED);
    }

    #[tokio::test]
    async fn test_authenticate_valid_session() {
        let session_manager = Arc::new(SessionManager::new(
            create_test_session_config(),
            create_test_security_config(),
        ));
        let config = AuthConfig {
            mode: super::super::config::AuthMode::Local,
            local: None,
            oidc: None,
            session: create_test_session_config(),
            security: create_test_security_config(),
        };
        let middleware = AuthMiddleware::new(session_manager.clone(), config);

        // Create a valid session
        let user_info = create_test_user_info();
        let token = session_manager.create_session(user_info.clone()).await.unwrap();

        let req = Request::builder()
            .uri("/api/clusters")
            .header(header::COOKIE, format!("session_token={}", token))
            .body(Body::empty())
            .unwrap();

        let next = Next::new(|req: Request<Body>| async move {
            // Verify user info was added to extensions
            let user_info = req.extensions().get::<UserInfo>().cloned();
            assert!(user_info.is_some());
            assert_eq!(user_info.unwrap().username, "testuser");
            Ok::<Response, StatusCode>(Response::new(Body::empty()))
        });

        let result = middleware.authenticate(req, next).await;
        assert!(result.is_ok());
    }
}
