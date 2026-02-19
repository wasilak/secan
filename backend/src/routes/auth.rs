//! Authentication route handlers
//!
//! This module implements HTTP route handlers for authentication operations:
//! - Local user login
//! - OIDC login initiation and callback
//! - Logout
//!
//! All routes handle cookie management, error responses, and logging.

use axum::{
    extract::State,
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{error, info, warn};

use crate::auth::{
    config::{AuthConfig, SessionConfig},
    oidc::OidcAuthProvider,
    provider::{AuthProvider, AuthRequest},
    session::SessionManager,
};

/// Shared application state for authentication routes
#[derive(Clone)]
pub struct AuthState {
    pub provider: Arc<dyn AuthProvider>,
    pub oidc_provider: Option<Arc<OidcAuthProvider>>,
    pub session_manager: Arc<SessionManager>,
    pub auth_config: AuthConfig,
}

/// Request body for local login
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Response body for successful login
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub user: Option<UserResponse>,
}

/// User information in response
#[derive(Debug, Serialize)]
pub struct UserResponse {
    pub id: String,
    pub username: String,
    pub email: Option<String>,
    pub roles: Vec<String>,
}

/// Error response body
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
}

/// POST /api/auth/login - Local user authentication
///
/// Authenticates a user with username and password, creates a session,
/// and sets a session cookie.
pub async fn login(
    State(state): State<AuthState>,
    axum::extract::ConnectInfo(addr): axum::extract::ConnectInfo<std::net::SocketAddr>,
    Json(req): Json<LoginRequest>,
) -> Result<Response, StatusCode> {
    info!("Login attempt for user: {} from IP: {}", req.username, addr.ip());

    // Check rate limit
    if let Err(e) = state.session_manager.check_rate_limit(&req.username) {
        warn!("Rate limit exceeded for user: {} from IP: {}", req.username, addr.ip());
        return Err(StatusCode::TOO_MANY_REQUESTS);
    }

    // Authenticate user
    let auth_request = AuthRequest::LocalCredentials {
        username: req.username.clone(),
        password: req.password,
    };

    let auth_response = match state.provider.authenticate(auth_request).await {
        Ok(response) => response,
        Err(e) => {
            // Log detailed error server-side
            error!(
                "Authentication failed for user {} from IP {}: {}",
                req.username, addr.ip(), e
            );
            
            // Return generic error to client
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Invalid credentials".to_string(),
                }),
            )
                .into_response());
        }
    };

    info!(
        "Successful login for user: {} (id: {}) from IP: {}",
        auth_response.user_info.username, auth_response.user_info.id, addr.ip()
    );

    // Create response with session cookie
    let cookie = create_session_cookie(
        &state.auth_config.session,
        &auth_response.session_token,
    );

    let response = LoginResponse {
        success: true,
        user: Some(UserResponse {
            id: auth_response.user_info.id,
            username: auth_response.user_info.username,
            email: auth_response.user_info.email,
            roles: auth_response.user_info.roles,
        }),
    };

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, cookie)],
        Json(response),
    )
        .into_response())
}

/// GET /api/auth/oidc/login - Initiate OIDC authentication flow
///
/// Generates an authorization URL and redirects the user to the OIDC provider.
/// Note: This endpoint requires the OIDC provider to be configured.
pub async fn oidc_login(State(state): State<AuthState>) -> Result<Response, StatusCode> {
    info!("Initiating OIDC login flow");

    // Get OIDC provider from state
    let oidc_provider = state.oidc_provider.as_ref().ok_or_else(|| {
        error!("OIDC login requested but OIDC provider is not configured");
        StatusCode::NOT_FOUND
    })?;

    // Generate authorization URL
    let (auth_url, csrf_token) = oidc_provider.authorization_url();

    info!("Generated OIDC authorization URL with CSRF token");

    // Store CSRF token in a cookie for validation in callback
    let csrf_cookie = format!(
        "{}={}; Path=/; HttpOnly; SameSite=Lax{}",
        "oidc_csrf",
        csrf_token.secret(),
        if state.auth_config.session.secure_only {
            "; Secure"
        } else {
            ""
        }
    );

    Ok((
        StatusCode::FOUND,
        [
            (header::SET_COOKIE, csrf_cookie),
            (header::LOCATION, auth_url.to_string()),
        ],
    )
        .into_response())
}

/// GET /api/auth/oidc/callback - Handle OIDC provider callback
///
/// Exchanges the authorization code for tokens, validates the ID token,
/// creates a session, and sets a session cookie.
pub async fn oidc_callback(
    State(state): State<AuthState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> Result<Response, StatusCode> {
    info!("Received OIDC callback");

    // Extract code and state from query parameters
    let code = params
        .get("code")
        .ok_or_else(|| {
            error!("OIDC callback missing 'code' parameter");
            StatusCode::BAD_REQUEST
        })?
        .clone();

    let state_param = params
        .get("state")
        .ok_or_else(|| {
            error!("OIDC callback missing 'state' parameter");
            StatusCode::BAD_REQUEST
        })?
        .clone();

    // TODO: Validate CSRF token from cookie against state parameter
    // For now, we'll proceed with the authentication

    // Authenticate with OIDC
    let auth_request = AuthRequest::OidcCallback {
        code,
        state: state_param,
    };

    let auth_response = match state.provider.authenticate(auth_request).await {
        Ok(response) => response,
        Err(e) => {
            // Log detailed error server-side
            error!("OIDC authentication failed: {}", e);
            
            // Return generic error to client
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(ErrorResponse {
                    error: "Authentication failed".to_string(),
                }),
            )
                .into_response());
        }
    };

    info!(
        "Successful OIDC login for user: {} (id: {})",
        auth_response.user_info.username, auth_response.user_info.id
    );

    // Create response with session cookie
    let cookie = create_session_cookie(
        &state.auth_config.session,
        &auth_response.session_token,
    );

    // Redirect to dashboard
    Ok((
        StatusCode::FOUND,
        [
            (header::SET_COOKIE, cookie),
            (header::LOCATION, "/".to_string()),
        ],
    )
        .into_response())
}

/// POST /api/auth/logout - Logout and clear session
///
/// Deletes the user's session and clears the session cookie.
pub async fn logout(
    State(state): State<AuthState>,
    headers: axum::http::HeaderMap,
) -> Result<Response, StatusCode> {
    info!("Logout request received");

    // Extract session token from cookie
    if let Some(token) = extract_session_token(&headers, &state.auth_config.session.cookie_name) {
        // Delete session
        if let Err(e) = state.session_manager.delete_session(&token).await {
            error!("Failed to delete session: {}", e);
        } else {
            info!("Session deleted successfully");
        }
    }

    // Clear session cookie
    let clear_cookie = format!(
        "{}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0{}",
        state.auth_config.session.cookie_name,
        if state.auth_config.session.secure_only {
            "; Secure"
        } else {
            ""
        }
    );

    Ok((
        StatusCode::OK,
        [(header::SET_COOKIE, clear_cookie)],
        Json(serde_json::json!({ "success": true })),
    )
        .into_response())
}

/// Create a session cookie with appropriate security attributes
fn create_session_cookie(config: &SessionConfig, token: &str) -> String {
    format!(
        "{}={}; Path=/; HttpOnly; SameSite=Lax{}",
        config.cookie_name,
        token,
        if config.secure_only { "; Secure" } else { "" }
    )
}

/// Extract session token from request headers
fn extract_session_token(headers: &axum::http::HeaderMap, cookie_name: &str) -> Option<String> {
    let cookies = headers.get(header::COOKIE)?;
    let cookies_str = cookies.to_str().ok()?;

    for cookie in cookies_str.split(';') {
        let parts: Vec<&str> = cookie.trim().splitn(2, '=').collect();
        if parts.len() == 2 && parts[0] == cookie_name {
            return Some(parts[1].to_string());
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_session_cookie_secure() {
        let config = SessionConfig {
            timeout_seconds: 3600,
            renewal_mode: crate::auth::config::RenewalMode::SlidingWindow,
            cookie_name: "session_token".to_string(),
            secure_only: true,
        };

        let cookie = create_session_cookie(&config, "test_token_123");
        
        assert!(cookie.contains("session_token=test_token_123"));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        assert!(cookie.contains("Secure"));
        assert!(cookie.contains("Path=/"));
    }

    #[test]
    fn test_create_session_cookie_not_secure() {
        let config = SessionConfig {
            timeout_seconds: 3600,
            renewal_mode: crate::auth::config::RenewalMode::SlidingWindow,
            cookie_name: "session_token".to_string(),
            secure_only: false,
        };

        let cookie = create_session_cookie(&config, "test_token_123");
        
        assert!(cookie.contains("session_token=test_token_123"));
        assert!(cookie.contains("HttpOnly"));
        assert!(cookie.contains("SameSite=Lax"));
        assert!(!cookie.contains("Secure"));
    }

    #[test]
    fn test_extract_session_token() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            header::COOKIE,
            "session_token=abc123; other_cookie=value".parse().unwrap(),
        );

        let token = extract_session_token(&headers, "session_token");
        assert_eq!(token, Some("abc123".to_string()));
    }

    #[test]
    fn test_extract_session_token_not_found() {
        let mut headers = axum::http::HeaderMap::new();
        headers.insert(
            header::COOKIE,
            "other_cookie=value".parse().unwrap(),
        );

        let token = extract_session_token(&headers, "session_token");
        assert_eq!(token, None);
    }

    #[test]
    fn test_extract_session_token_no_cookies() {
        let headers = axum::http::HeaderMap::new();
        let token = extract_session_token(&headers, "session_token");
        assert_eq!(token, None);
    }
}
