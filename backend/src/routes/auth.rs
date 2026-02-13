use crate::auth::{OidcAuthProvider, SessionManager};
use axum::{
    extract::{Query, State},
    http::StatusCode,
    response::{IntoResponse, Redirect, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Shared application state for authentication routes
#[derive(Clone)]
pub struct AuthState {
    pub oidc_provider: Option<Arc<OidcAuthProvider>>,
    pub session_manager: Arc<SessionManager>,
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

impl IntoResponse for ErrorResponse {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

/// Initiate OIDC authentication flow
///
/// Redirects the user to the OIDC provider's authorization endpoint
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

    tracing::info!("Redirecting to OIDC provider for authentication");

    Ok(Redirect::to(&auth_url))
}

/// Handle OIDC callback
///
/// Exchanges the authorization code for tokens and creates a session
pub async fn oidc_callback(
    State(state): State<AuthState>,
    Query(params): Query<OidcCallbackQuery>,
) -> Result<Redirect, ErrorResponse> {
    let oidc_provider = state.oidc_provider.ok_or_else(|| ErrorResponse {
        error: "oidc_not_configured".to_string(),
        message: "OIDC authentication is not configured".to_string(),
    })?;

    tracing::info!("Handling OIDC callback");

    // TODO: Validate state parameter against stored value for CSRF protection

    // Exchange authorization code for tokens
    let token_response = oidc_provider
        .exchange_code(&params.code)
        .await
        .map_err(|e| {
            tracing::error!("Failed to exchange authorization code: {}", e);
            ErrorResponse {
                error: "token_exchange_failed".to_string(),
                message: format!("Failed to exchange authorization code: {}", e),
            }
        })?;

    // Validate and decode ID token
    let claims = oidc_provider
        .validate_id_token(&token_response.id_token)
        .map_err(|e| {
            tracing::error!("Failed to validate ID token: {}", e);
            ErrorResponse {
                error: "token_validation_failed".to_string(),
                message: format!("Failed to validate ID token: {}", e),
            }
        })?;

    // Create session
    let _session_token = oidc_provider.create_session(&claims).await.map_err(|e| {
        tracing::error!("Failed to create session: {}", e);
        ErrorResponse {
            error: "session_creation_failed".to_string(),
            message: format!("Failed to create session: {}", e),
        }
    })?;

    tracing::info!("OIDC authentication successful for user: {}", claims.sub);

    // TODO: Set session token as HTTP-only cookie
    // For now, redirect to home page
    // In production, this should set a secure cookie and redirect to the original requested page

    Ok(Redirect::to("/"))
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
