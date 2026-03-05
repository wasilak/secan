use crate::auth::middleware::AuthenticatedUser;
use crate::auth::{OidcAuthProvider, SessionManager};
use axum::body::Body;
use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Shared application state for authentication routes
#[derive(Clone)]
pub struct AuthState {
    pub oidc_provider: Option<Arc<OidcAuthProvider>>,
    pub session_manager: Arc<SessionManager>,
    pub config: Arc<crate::config::Config>,
}

/// Login request for local users
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Login response
#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
}

/// OIDC callback query parameters
#[derive(Debug, Deserialize)]
pub struct OidcCallbackQuery {
    pub code: String,
    pub state: String,
}

/// Error response
#[derive(Debug, Serialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

/// User info response
#[derive(Debug, Serialize)]
pub struct UserInfoResponse {
    pub username: String,
    pub groups: Vec<String>,
}

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

/// Initiate OIDC authentication flow
///
/// Redirects the user to the OIDC provider's authorization endpoint
///
/// # Requirements
///
/// Validates: Requirements 29.2
pub async fn oidc_login(State(state): State<AuthState>) -> Result<Redirect, ErrorResponse> {
    let oidc_provider = state.oidc_provider.ok_or_else(|| ErrorResponse {
        error: "oidc_not_configured".to_string(),
        message: "OIDC authentication is not configured".to_string(),
    })?;

    // Generate a random state parameter for CSRF protection
    let state_param = crate::auth::generate_token();

    // TODO: Store state parameter in a temporary cache for validation in callback
    // For now, we'll just generate it

    let auth_url = oidc_provider.get_authorization_url(&state_param);

    tracing::info!(auth_method = "oidc", "Initiating OIDC authentication flow");

    Ok(Redirect::to(&auth_url))
}

/// Handle OIDC callback
///
/// Exchanges the authorization code for tokens and creates a session
///
/// # Requirements
///
/// Validates: Requirements 29.2, 30.4
pub async fn oidc_callback(
    State(state): State<AuthState>,
    Query(params): Query<OidcCallbackQuery>,
) -> Result<Response, ErrorResponse> {
    let oidc_provider = state.oidc_provider.ok_or_else(|| ErrorResponse {
        error: "oidc_not_configured".to_string(),
        message: "OIDC authentication is not configured".to_string(),
    })?;

    tracing::info!(auth_method = "oidc", "Processing OIDC callback");

    // TODO: Validate state parameter against stored value for CSRF protection

    // Exchange authorization code for tokens
    let token_response = oidc_provider
        .exchange_code(&params.code)
        .await
        .map_err(|e| {
            tracing::error!(
                auth_method = "oidc",
                error = %e,
                "Failed to exchange authorization code"
            );
            ErrorResponse {
                error: "token_exchange_failed".to_string(),
                message: format!("Failed to exchange authorization code: {}", e),
            }
        })?;

    // Validate and decode ID token
    let claims = oidc_provider
        .validate_id_token(&token_response.id_token)
        .map_err(|e| {
            tracing::error!(
                auth_method = "oidc",
                error = %e,
                "Failed to validate ID token"
            );
            ErrorResponse {
                error: "token_validation_failed".to_string(),
                message: format!("Failed to validate ID token: {}", e),
            }
        })?;

    // Create session
    let session_token = oidc_provider.create_session(&claims).await.map_err(|e| {
        tracing::error!(
            auth_method = "oidc",
            user_id = %claims.sub,
            error = %e,
            "Failed to create session"
        );
        ErrorResponse {
            error: "session_creation_failed".to_string(),
            message: format!("Failed to create session: {}", e),
        }
    })?;

    tracing::info!(
        auth_method = "oidc",
        user_id = %claims.sub,
        "Authentication successful"
    );

    // Set session token as HTTP-only cookie and redirect to home page
    let mut response = Response::new(Body::empty());
    response.headers_mut().insert(
        http::header::SET_COOKIE,
        create_session_cookie(&session_token),
    );
    response
        .headers_mut()
        .insert(http::header::LOCATION, http::HeaderValue::from_static("/"));
    *response.status_mut() = StatusCode::FOUND;

    Ok(response)
}

/// Login endpoint for local users
///
/// Authenticates a user with username and password
///
/// # Requirements
///
/// Validates: Requirements 29.2, 30.4
pub async fn login(
    State(state): State<AuthState>,
    Json(payload): Json<LoginRequest>,
) -> Result<Response, ErrorResponse> {
    use crate::auth::local::verify_password;
    use crate::auth::AuthUser;
    use crate::auth::PermissionResolver;

    // Only support local users mode for now
    if state.oidc_provider.is_some() {
        return Err(ErrorResponse {
            error: "not_supported".to_string(),
            message: "OIDC login not implemented yet".to_string(),
        });
    }

    // Find user in config
    let users = state
        .config
        .auth
        .local_users
        .as_ref()
        .ok_or_else(|| ErrorResponse {
            error: "not_configured".to_string(),
            message: "Local users not configured".to_string(),
        })?;

    let user = users
        .iter()
        .find(|u| u.username == payload.username)
        .ok_or_else(|| ErrorResponse {
            error: "invalid_credentials".to_string(),
            message: "Invalid username or password".to_string(),
        })?;

    // Verify password
    let password_valid = verify_password(&payload.password, &user.password_hash).map_err(|e| {
        tracing::error!(error = %e, "Password verification failed");
        ErrorResponse {
            error: "internal_error".to_string(),
            message: "Authentication error".to_string(),
        }
    })?;

    if !password_valid {
        tracing::warn!(username = %payload.username, "Invalid password");
        return Err(ErrorResponse {
            error: "invalid_credentials".to_string(),
            message: "Invalid username or password".to_string(),
        });
    }

    // Resolve accessible clusters
    let permission_resolver = PermissionResolver::new(state.config.auth.permissions.clone());
    tracing::debug!(
        permissions_count = state.config.auth.permissions.len(),
        user_groups = ?user.groups,
        "Resolving cluster access"
    );
    let accessible_clusters = permission_resolver.resolve_cluster_access(&user.groups);

    tracing::debug!(
        accessible_clusters = ?accessible_clusters,
        "Resolved cluster access"
    );

    // Create session with accessible clusters
    let auth_user = AuthUser::new_with_clusters(
        user.username.clone(),
        user.username.clone(),
        user.groups.clone(),
        accessible_clusters.clone(),
    );

    let token = state
        .session_manager
        .create_session_with_clusters(auth_user, accessible_clusters.clone())
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Session creation failed");
            ErrorResponse {
                error: "internal_error".to_string(),
                message: "Failed to create session".to_string(),
            }
        })?;

    tracing::info!(
        username = %payload.username,
        groups = ?user.groups,
        accessible_clusters = ?accessible_clusters,
        "User authenticated successfully"
    );

    // Create response with session cookie
    let mut response = axum::response::Response::new(axum::body::Body::from(
        serde_json::to_string(&LoginResponse {
            success: true,
            message: "Login successful".to_string(),
            session_token: Some(token.clone()),
        })
        .unwrap(),
    ));

    response
        .headers_mut()
        .insert(http::header::SET_COOKIE, create_session_cookie(&token));
    response.headers_mut().insert(
        http::header::CONTENT_TYPE,
        http::HeaderValue::from_static("application/json"),
    );

    Ok(response)
}

/// Get current user info
///
/// Returns authenticated user information or 401 if not authenticated
pub async fn get_current_user(
    Extension(user): Extension<AuthenticatedUser>,
) -> Json<UserInfoResponse> {
    Json(UserInfoResponse {
        username: user.0.username.clone(),
        groups: user.0.roles.clone(),
    })
}

/// Build session cookie
///
/// The Secure flag is only set when explicitly enabled via environment variable.
/// In production behind an HTTPS reverse proxy, set SECAN_SECURE_COOKIES=true
/// For local development over HTTP, leave it unset or set to false
fn create_session_cookie(token: &str) -> http::HeaderValue {
    // Only set Secure flag if explicitly enabled via environment variable
    // Default to false to allow local HTTP development
    // In production, use SECAN_SECURE_COOKIES=true when behind HTTPS reverse proxy
    let secure_flag = std::env::var("SECAN_SECURE_COOKIES")
        .map(|v| v.to_lowercase() == "true")
        .unwrap_or(false);

    let cookie_value = if secure_flag {
        format!(
            "session_token={}; Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=3600",
            token
        )
    } else {
        format!(
            "session_token={}; Path=/; HttpOnly; SameSite=Lax; Max-Age=3600",
            token
        )
    };
    http::HeaderValue::from_str(&cookie_value).unwrap()
}

/// Logout endpoint
///
/// Invalidates the user's session and clears the session cookie
pub async fn logout(
    State(state): State<AuthState>,
    headers: axum::http::HeaderMap,
) -> Result<Response, ErrorResponse> {
    // Extract session token from cookie
    if let Some(token) = extract_session_token(&headers) {
        // Invalidate session
        if let Err(e) = state.session_manager.invalidate_session(&token).await {
            tracing::error!("Failed to invalidate session: {}", e);
        } else {
            tracing::info!("Session invalidated for user logout");
        }
    }

    // Clear session cookie
    let clear_cookie = format!(
        "session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0"
    );

    tracing::info!("User logged out");

    // Redirect to login page with logout flag to prevent auto-redirect to OIDC
    let mut response = Response::new(Body::empty());
    response.headers_mut().insert(
        header::SET_COOKIE,
        clear_cookie.parse().unwrap_or_else(|_| {
            header::HeaderValue::from_static("session_token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0")
        }),
    );
    response.headers_mut().insert(
        header::LOCATION,
        header::HeaderValue::from_static("/login?logged_out=true"),
    );
    *response.status_mut() = StatusCode::FOUND;

    Ok(response)
}

/// Extract session token from request headers
fn extract_session_token(headers: &axum::http::HeaderMap) -> Option<String> {
    let cookies = headers.get(header::COOKIE)?;
    let cookies_str = cookies.to_str().ok()?;

    for cookie in cookies_str.split(';') {
        let parts: Vec<&str> = cookie.trim().splitn(2, '=').collect();
        if parts.len() == 2 && parts[0] == "session_token" {
            return Some(parts[1].to_string());
        }
    }

    None
}

/// Auth status response
#[derive(Debug, Serialize)]
pub struct AuthStatusResponse {
    pub mode: String, // "open", "local_users", or "oidc"
    pub oidc_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oidc_redirect_delay: Option<u64>,
}

/// Get authentication status
pub async fn get_auth_status(
    State(state): State<AuthState>,
) -> Result<Json<AuthStatusResponse>, ErrorResponse> {
    use crate::config::AuthMode;

    let mode = match &state.config.auth.mode {
        AuthMode::Open => "open",
        AuthMode::LocalUsers => "local_users",
        AuthMode::Oidc => "oidc",
    };

    let oidc_enabled = state.oidc_provider.is_some();
    let oidc_redirect_delay = state
        .config
        .auth
        .oidc
        .as_ref()
        .map(|c| c.redirect_delay_seconds);

    Ok(Json(AuthStatusResponse {
        mode: mode.to_string(),
        oidc_enabled,
        oidc_redirect_delay,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_login_request_deserialization() {
        let json = r#"{"username":"testuser","password":"testpass"}"#;
        let request: LoginRequest = serde_json::from_str(json).unwrap();
        assert_eq!(request.username, "testuser");
        assert_eq!(request.password, "testpass");
    }

    #[test]
    fn test_login_response_serialization() {
        let response = LoginResponse {
            success: true,
            message: "Login successful".to_string(),
            session_token: Some("token123".to_string()),
        };
        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"session_token\":\"token123\""));
    }

    #[test]
    fn test_oidc_callback_query_deserialization() {
        let json = r#"{"code":"auth_code_123","state":"random_state"}"#;
        let query: OidcCallbackQuery = serde_json::from_str(json).unwrap();
        assert_eq!(query.code, "auth_code_123");
        assert_eq!(query.state, "random_state");
    }

    #[test]
    fn test_error_response_serialization() {
        let error = ErrorResponse {
            error: "invalid_credentials".to_string(),
            message: "Username or password is incorrect".to_string(),
        };
        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"error\":\"invalid_credentials\""));
        assert!(json.contains("\"message\":\"Username or password is incorrect\""));
    }
}
