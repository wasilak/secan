use crate::auth::middleware::AuthenticatedUser;
use crate::auth::{OidcAuthProvider, SessionManager};
use axum::body::Body;
use axum::{
    extract::{Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Redirect, Response},
    Extension, Json,
};
use base64::Engine;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::instrument;
use utoipa::{IntoParams, ToSchema};

/// Shared application state for authentication routes
#[derive(Clone)]
pub struct AuthState {
    pub oidc_provider: Option<Arc<OidcAuthProvider>>,
    pub ldap_provider: Option<Arc<crate::auth::LdapAuthProvider>>,
    pub session_manager: Arc<SessionManager>,
    pub config: Arc<crate::config::Config>,
}

/// Login request for local users
#[derive(Debug, Deserialize, ToSchema)]
pub struct LoginRequest {
    #[schema(example = "admin")]
    pub username: String,
    #[schema(example = "password123")]
    pub password: String,
}

/// Login response
#[derive(Debug, Serialize, ToSchema)]
pub struct LoginResponse {
    pub success: bool,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_token: Option<String>,
}

/// OIDC callback query parameters
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct OidcCallbackQuery {
    #[schema(example = "auth_code_from_provider")]
    pub code: String,
    #[schema(example = "random_state_string")]
    pub state: String,
}

/// OIDC login query parameters
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct OidcLoginQuery {
    #[schema(example = "/clusters")]
    pub redirect_to: Option<String>,
}

/// Collapse consecutive slashes in a path or URL while preserving the scheme
/// (e.g., "http://"). This prevents redirect targets like "/api/clusters//stats"
/// from being sent to clients.
fn collapse_duplicate_slashes(input: &str) -> String {
    fn collapse(s: &str) -> String {
        let mut out = String::with_capacity(s.len());
        let mut prev_slash = false;
        for ch in s.chars() {
            if ch == '/' {
                if !prev_slash {
                    out.push(ch);
                    prev_slash = true;
                } else {
                    // skip duplicate slash
                }
            } else {
                out.push(ch);
                prev_slash = false;
            }
        }
        out
    }

    if input.is_empty() {
        return input.to_string();
    }

    if let Some(pos) = input.find("://") {
        // Preserve scheme (including '://') and collapse the rest
        let (scheme, rest) = input.split_at(pos + 3);
        format!("{}{}", scheme, collapse(rest))
    } else {
        collapse(input)
    }
}

/// Error response
#[derive(Debug, Serialize, ToSchema)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

/// User info response
#[derive(Debug, Serialize, ToSchema)]
pub struct UserInfoResponse {
    #[schema(example = "admin")]
    pub username: String,
    /// User groups/roles
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
#[utoipa::path(
    get,
    path = "/auth/oidc/login",
    params(OidcLoginQuery),
    responses(
        (status = 302, description = "Redirect to OIDC provider"),
        (status = 400, body = ErrorResponse)
    ),
    tag = "Authentication"
)]
#[instrument(skip(state))]
pub async fn oidc_login(
    State(state): State<AuthState>,
    Query(params): Query<OidcLoginQuery>,
) -> Result<Redirect, ErrorResponse> {
    let oidc_provider = state.oidc_provider.ok_or_else(|| ErrorResponse {
        error: "oidc_not_configured".to_string(),
        message: "OIDC authentication is not configured".to_string(),
    })?;

    // Generate a random state parameter for CSRF protection
    let state_param = crate::auth::generate_token();

    // Encode redirect_to in state parameter (base64 encode to preserve special chars)
    let state_with_redirect = if let Some(redirect_to) = params.redirect_to {
        // Normalize redirect path to avoid sending duplicate slashes to the client
        let normalized = collapse_duplicate_slashes(&redirect_to);
        let combined = format!("{}|{}", normalized, state_param);
        base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(combined.as_bytes())
    } else {
        state_param
    };

    // TODO: Store state parameter in a temporary cache for validation in callback
    // For now, we'll just generate it

    let auth_url = oidc_provider.get_authorization_url(&state_with_redirect);

    tracing::debug!(auth_method = "oidc", "Initiating OIDC authentication flow");

    Ok(Redirect::to(&auth_url))
}

/// Handle OIDC callback
///
/// Exchanges the authorization code for tokens and creates a session
///
/// # Requirements
///
/// Validates: Requirements 29.2, 30.4
#[utoipa::path(
    get,
    path = "/auth/oidc/callback",
    params(OidcCallbackQuery),
    responses(
        (status = 302, description = "Redirect after successful login"),
        (status = 400, body = ErrorResponse)
    ),
    tag = "Authentication"
)]
#[instrument(skip(state))]
pub async fn oidc_callback(
    State(state): State<AuthState>,
    Query(params): Query<OidcCallbackQuery>,
) -> Result<Response, ErrorResponse> {
    let oidc_provider = state.oidc_provider.ok_or_else(|| ErrorResponse {
        error: "oidc_not_configured".to_string(),
        message: "OIDC authentication is not configured".to_string(),
    })?;

    tracing::debug!(auth_method = "oidc", "Processing OIDC callback");

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

    // Create session with token response
    let session_token = oidc_provider
        .create_session(&claims, &token_response)
        .await
        .map_err(|e| {
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

    tracing::debug!(
        auth_method = "oidc",
        user_id = %claims.sub,
        "Authentication successful"
    );

    // Decode redirect_to from state parameter
    let redirect_to = if let Ok(decoded_bytes) =
        base64::engine::general_purpose::URL_SAFE_NO_PAD.decode(&params.state)
    {
        if let Ok(decoded) = String::from_utf8(decoded_bytes) {
            // State format: redirect_to|csrf_token
            decoded
                .split('|')
                .next()
                .filter(|s| !s.is_empty())
                .map(String::from)
        } else {
            None
        }
    } else {
        None
    };

    // Default to home page if no redirect or invalid redirect
    let redirect_path = redirect_to.unwrap_or_else(|| "/".to_string());
    // Normalize redirect path to collapse duplicate slashes (defensive)
    let redirect_path = collapse_duplicate_slashes(&redirect_path);

    // Get session timeout from config
    let max_age_seconds = state.config.auth.session_timeout_minutes * 60;

    // Set session token as HTTP-only cookie and redirect
    let mut response = Response::new(Body::empty());
    response.headers_mut().insert(
        http::header::SET_COOKIE,
        crate::auth::build_session_cookie_header(&session_token, max_age_seconds),
    );
    response.headers_mut().insert(
        http::header::LOCATION,
        http::HeaderValue::from_str(&redirect_path)
            .unwrap_or_else(|_| http::HeaderValue::from_static("/")),
    );
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
#[utoipa::path(
    post,
    path = "/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, body = LoginResponse, description = "Login successful"),
        (status = 400, body = ErrorResponse),
        (status = 401, body = ErrorResponse)
    ),
    tag = "Authentication"
)]
#[instrument(skip(state, payload))]
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

    // Handle LDAP authentication
    if let Some(ldap_provider) = &state.ldap_provider {
        let session_token = ldap_provider
            .authenticate(&payload.username, &payload.password)
            .await
            .map_err(|e| {
                tracing::warn!(username = %payload.username, error = %e, "LDAP authentication failed");
                ErrorResponse {
                    error: "invalid_credentials".to_string(),
                    message: "Invalid username or password".to_string(),
                }
            })?
            .ok_or_else(|| ErrorResponse {
                error: "invalid_credentials".to_string(),
                message: "Invalid username or password".to_string(),
            })?;

        tracing::info!(username = %payload.username, "LDAP user authenticated successfully");

        let body = serde_json::to_string(&LoginResponse {
            success: true,
            message: "Login successful".to_string(),
            session_token: Some(session_token.clone()),
        })
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to serialize login response");
            ErrorResponse {
                error: "internal_error".to_string(),
                message: "Failed to create login response".to_string(),
            }
        })?;

        let max_age_seconds = state.config.auth.session_timeout_minutes * 60;
        let mut response = axum::response::Response::new(axum::body::Body::from(body));
        response.headers_mut().insert(
            http::header::SET_COOKIE,
            crate::auth::build_session_cookie_header(&session_token, max_age_seconds),
        );
        response.headers_mut().insert(
            http::header::CONTENT_TYPE,
            http::HeaderValue::from_static("application/json"),
        );
        return Ok(response);
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
    let body = match serde_json::to_string(&LoginResponse {
        success: true,
        message: "Login successful".to_string(),
        session_token: Some(token.clone()),
    }) {
        Ok(json) => axum::body::Body::from(json),
        Err(e) => {
            tracing::error!(error = %e, "Failed to serialize login response");
            return Err(ErrorResponse {
                error: "internal_error".to_string(),
                message: "Failed to create login response".to_string(),
            });
        }
    };
    let mut response = axum::response::Response::new(body);
    let max_age_seconds = state.config.auth.session_timeout_minutes * 60;

    response.headers_mut().insert(
        http::header::SET_COOKIE,
        crate::auth::build_session_cookie_header(&token, max_age_seconds),
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
#[utoipa::path(
    get,
    path = "/auth/me",
    responses(
        (status = 200, body = UserInfoResponse),
        (status = 401, description = "Not authenticated")
    ),
    tag = "Authentication"
)]
#[instrument(fields(username = %user.0.username))]
pub async fn get_current_user(
    Extension(user): Extension<AuthenticatedUser>,
) -> Json<UserInfoResponse> {
    Json(UserInfoResponse {
        username: user.0.username.clone(),
        groups: user.0.roles.clone(),
    })
}

/// Logout endpoint
///
/// Invalidates the user's session and clears the session cookie
#[utoipa::path(
    post,
    path = "/auth/logout",
    responses(
        (status = 302, description = "Redirect to login page")
    ),
    tag = "Authentication"
)]
#[instrument(skip(state, headers))]
pub async fn logout(
    State(state): State<AuthState>,
    headers: axum::http::HeaderMap,
) -> Result<Response, ErrorResponse> {
    // Extract session token from cookie
    if let Some(token) = extract_session_token(&headers) {
        // Invalidate session
        if let Err(e) = state.session_manager.invalidate_session(&token).await {
            tracing::error!(error = %e, "Failed to invalidate session");
        } else {
            tracing::debug!("Session invalidated for user logout");
        }
    }

    // Clear session cookie using the same Secure flag as the one used when
    // setting the cookie so browsers will correctly remove it.
    let clear_cookie = crate::auth::build_clear_session_cookie_header();

    tracing::debug!("User logged out");

    // Redirect to login page with logout flag to prevent auto-redirect to OIDC
    let mut response = Response::new(Body::empty());
    response
        .headers_mut()
        .insert(header::SET_COOKIE, clear_cookie);
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
#[derive(Debug, Serialize, ToSchema)]
pub struct AuthStatusResponse {
    #[schema(example = "open")]
    pub mode: String, // "open", "local_users", or "oidc"
    #[schema(example = false)]
    pub oidc_enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oidc_redirect_delay: Option<u64>,
}

/// Get authentication status
#[utoipa::path(
    get,
    path = "/auth/status",
    responses(
        (status = 200, body = AuthStatusResponse),
        (status = 400, body = ErrorResponse)
    ),
    tag = "Authentication"
)]
#[instrument(skip(state))]
pub async fn get_auth_status(
    State(state): State<AuthState>,
) -> Result<Json<AuthStatusResponse>, ErrorResponse> {
    use crate::config::AuthMode;

    let mode = match &state.config.auth.mode {
        AuthMode::Open => "open",
        AuthMode::LocalUsers => "local_users",
        AuthMode::Oidc => "oidc",
        AuthMode::Ldap => "ldap",
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
        // SAFETY: Test data is valid JSON matching the struct
        let request: LoginRequest = serde_json::from_str(json).expect("parse test JSON");
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
        // SAFETY: Serializing a simple struct always succeeds
        let json = serde_json::to_string(&response).expect("serialize test response");
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"session_token\":\"token123\""));
    }

    #[test]
    fn test_oidc_callback_query_deserialization() {
        let json = r#"{"code":"auth_code_123","state":"random_state"}"#;
        // SAFETY: Test data is valid JSON matching the struct
        let query: OidcCallbackQuery = serde_json::from_str(json).expect("parse test JSON");
        assert_eq!(query.code, "auth_code_123");
        assert_eq!(query.state, "random_state");
    }

    #[test]
    fn test_error_response_serialization() {
        let error = ErrorResponse {
            error: "invalid_credentials".to_string(),
            message: "Username or password is incorrect".to_string(),
        };
        // SAFETY: Serializing a simple struct always succeeds
        let json = serde_json::to_string(&error).expect("serialize test error");
        assert!(json.contains("\"error\":\"invalid_credentials\""));
        assert!(json.contains("\"message\":\"Username or password is incorrect\""));
    }
}
