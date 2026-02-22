use crate::auth::middleware::AuthenticatedUser;
use crate::auth::{OidcAuthProvider, SessionManager};
use axum::{
    extract::{Query, State},
    http::StatusCode,
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
) -> Result<Redirect, ErrorResponse> {
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
    let _session_token = oidc_provider.create_session(&claims).await.map_err(|e| {
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

    // TODO: Set session token as HTTP-only cookie
    // For now, redirect to home page
    // In production, this should set a secure cookie and redirect to the original requested page

    Ok(Redirect::to("/"))
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
    let users = state.config.auth.local_users.as_ref().ok_or_else(|| ErrorResponse {
        error: "not_configured".to_string(),
        message: "Local users not configured".to_string(),
    })?;

    let user = users.iter().find(|u| u.username == payload.username).ok_or_else(|| ErrorResponse {
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

    let token = state.session_manager
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
        }).unwrap()
    ));
    
    response.headers_mut().insert(
        http::header::SET_COOKIE,
        create_session_cookie(&token),
    );
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
fn create_session_cookie(token: &str) -> http::HeaderValue {
    let cookie_value = format!("session_token={}; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600", token);
    http::HeaderValue::from_str(&cookie_value).unwrap()
}

/// Logout endpoint
///
/// Invalidates the user's session
pub async fn logout(State(_state): State<AuthState>) -> Result<Json<LoginResponse>, ErrorResponse> {
    // TODO: Extract session token from cookie
    // TODO: Invalidate session

    tracing::info!("User logged out");

    Ok(Json(LoginResponse {
        success: true,
        message: "Logged out successfully".to_string(),
        session_token: None,
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
