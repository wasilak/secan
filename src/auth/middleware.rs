use crate::auth::{AuthUser, SessionManager};
use crate::config::AuthMode;
use axum::{
    extract::{Request, State},
    http::{header, StatusCode},
    middleware::Next,
    response::{IntoResponse, Redirect, Response},
};
use std::sync::Arc;

/// Authentication state shared across the application
#[derive(Debug, Clone)]
pub struct AuthState {
    pub session_manager: Arc<SessionManager>,
    pub auth_mode: AuthMode,
}

impl AuthState {
    pub fn new(session_manager: Arc<SessionManager>, auth_mode: AuthMode) -> Self {
        Self {
            session_manager,
            auth_mode,
        }
    }
}

/// Extension type to attach authenticated user to request
#[derive(Debug, Clone)]
pub struct AuthenticatedUser(pub AuthUser);

/// Authentication middleware that validates session tokens from cookies
///
/// This middleware:
/// - Extracts session tokens from cookies
/// - Validates tokens using SessionManager
/// - Supports Open mode (no authentication required)
/// - Attaches user information to request context
/// - Returns 401 for invalid/expired sessions on API endpoints
/// - Returns 302 redirect to login for unauthenticated browser requests
pub async fn auth_middleware(
    State(auth_state): State<Arc<AuthState>>,
    mut request: Request,
    next: Next,
) -> Result<Response, AuthError> {
    // In Open mode, allow all requests without authentication
    if auth_state.auth_mode == AuthMode::Open {
        tracing::debug!("Open mode: allowing request without authentication");

        // Create a default user for Open mode with full cluster access
        let open_user = AuthUser::new_with_clusters(
            "open".to_string(),
            "open".to_string(),
            vec!["*".to_string()], // Full access in Open mode
            vec!["*".to_string()], // Full cluster access in Open mode
        );

        request
            .extensions_mut()
            .insert(AuthenticatedUser(open_user));
        return Ok(next.run(request).await);
    }

    // Check if this is a public path that doesn't require authentication
    let path = request.uri().path();
    if is_public_path(path) {
        tracing::debug!(path = %path, "Public path, skipping authentication");
        return Ok(next.run(request).await);
    }

    // Extract session token from cookies
    let token = match extract_session_token(&request) {
        Ok(token) => token,
        Err(_) => {
            // No session token
            // For API requests, return 401; for browser requests, redirect to login
            if is_api_request(path) {
                return Err(AuthError::MissingSessionToken);
            }

            let redirect_url = build_login_redirect_url(&request);
            tracing::debug!(
                path = %path,
                redirect_url = %redirect_url,
                "No session token, redirecting to login"
            );
            return Ok(Redirect::to(&redirect_url).into_response());
        }
    };

    // Validate session token
    let session = auth_state
        .session_manager
        .validate_session(&token)
        .await
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to validate session");
            AuthError::InternalError
        })?;

    // Check if session is valid
    let session = match session {
        Some(s) => s,
        None => {
            // Invalid or expired session
            // For API requests, return 401; for browser requests, redirect to login
            if is_api_request(path) {
                return Err(AuthError::InvalidSession);
            }

            let redirect_url = build_login_redirect_url(&request);
            tracing::debug!(
                path = %path,
                token = %token,
                redirect_url = %redirect_url,
                "Invalid session, redirecting to login"
            );
            return Ok(Redirect::to(&redirect_url).into_response());
        }
    };

    // Create AuthUser from session with accessible clusters
    let user = AuthUser::new_with_clusters(
        session.user_id,
        session.username,
        session.roles,
        session.accessible_clusters,
    );

    tracing::debug!(
        user_id = %user.id,
        username = %user.username,
        clusters = ?user.accessible_clusters,
        "User authenticated successfully"
    );

    // Attach user to request extensions
    request.extensions_mut().insert(AuthenticatedUser(user));

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}

/// Check if a path is an API endpoint
fn is_api_request(path: &str) -> bool {
    path.starts_with("/api/")
}

/// Check if a path is public and doesn't require authentication
fn is_public_path(path: &str) -> bool {
    // Health and readiness endpoints
    if path == "/health" || path == "/ready" {
        return true;
    }

    // API version endpoint
    if path == "/api/version" {
        return true;
    }

    // Authentication endpoints (login, logout, OIDC callbacks)
    // Note: /api/auth/me requires authentication
    if path.starts_with("/api/auth/") && path != "/api/auth/me" {
        return true;
    }

    // Frontend login page
    if path == "/login" {
        return true;
    }

    // Frontend access denied page
    if path.starts_with("/access-denied") {
        return true;
    }

    // Static assets (CSS, JS, images, etc.)
    if path.starts_with("/assets/")
        || path.starts_with("/favicon")
        || path.ends_with(".css")
        || path.ends_with(".js")
        || path.ends_with(".png")
        || path.ends_with(".jpg")
        || path.ends_with(".svg")
    {
        return true;
    }

    false
}

/// Build login URL with redirect_to parameter
fn build_login_redirect_url(request: &Request) -> String {
    let path = request.uri().path();
    let query = request.uri().query().unwrap_or("");

    // Build the full path with query if present
    let full_path = if query.is_empty() {
        path.to_string()
    } else {
        format!("{}?{}", path, query)
    };

    // URL encode the original path
    let redirect_to = urlencoding::encode(&full_path);

    // Redirect to frontend login page (not API endpoint)
    format!("/login?redirect_to={}", redirect_to)
}

/// Extract session token from cookies
///
/// Looks for a cookie named "session_token" and returns its value
fn extract_session_token(request: &Request) -> Result<String, AuthError> {
    // Get Cookie header
    let cookie_header = request
        .headers()
        .get(header::COOKIE)
        .ok_or(AuthError::MissingSessionToken)?;

    // Parse cookie header
    let cookie_str = cookie_header
        .to_str()
        .map_err(|_| AuthError::InvalidCookie)?;

    // Find session_token cookie
    for cookie in cookie_str.split(';') {
        let cookie = cookie.trim();
        if let Some(value) = cookie.strip_prefix("session_token=") {
            return Ok(value.to_string());
        }
    }

    Err(AuthError::MissingSessionToken)
}

/// Authentication errors
#[derive(Debug)]
pub enum AuthError {
    /// Session token is missing from cookies
    MissingSessionToken,
    /// Cookie header is invalid
    InvalidCookie,
    /// Session is invalid or expired
    InvalidSession,
    /// Internal error during authentication
    InternalError,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingSessionToken => (StatusCode::UNAUTHORIZED, "Missing session token"),
            AuthError::InvalidCookie => (StatusCode::BAD_REQUEST, "Invalid cookie format"),
            AuthError::InvalidSession => (StatusCode::UNAUTHORIZED, "Invalid or expired session"),
            AuthError::InternalError => {
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error")
            }
        };

        tracing::warn!(status = %status, message = %message, "Authentication error");

        (status, message).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::SessionConfig;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        middleware,
        routing::get,
        Router,
    };
    use tower::ServiceExt;

    async fn test_handler(
        axum::Extension(user): axum::Extension<AuthenticatedUser>,
    ) -> impl IntoResponse {
        format!("Hello, {}!", user.0.username)
    }

    fn create_test_app(auth_mode: AuthMode) -> Router {
        let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
        let auth_state = Arc::new(AuthState::new(session_manager, auth_mode));

        Router::new()
            .route("/test", get(test_handler))
            .layer(middleware::from_fn_with_state(
                auth_state.clone(),
                auth_middleware,
            ))
            .with_state(auth_state)
    }

    #[tokio::test]
    async fn test_auth_middleware_open_mode() {
        let app = create_test_app(AuthMode::Open);

        let request = Request::builder().uri("/test").body(Body::empty()).unwrap();

        let response = app.oneshot(request).await.unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_auth_middleware_missing_token() {
        let app = create_test_app(AuthMode::LocalUsers);

        let request = Request::builder().uri("/test").body(Body::empty()).unwrap();

        let response = app.oneshot(request).await.unwrap();

        // Should redirect to login (303) instead of returning 401
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
    }

    #[tokio::test]
    async fn test_auth_middleware_invalid_token() {
        let app = create_test_app(AuthMode::LocalUsers);

        let request = Request::builder()
            .uri("/test")
            .header(header::COOKIE, "session_token=invalid_token")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();

        // Should redirect to login (303) for invalid session
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
    }

    #[tokio::test]
    async fn test_auth_middleware_valid_token() {
        let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
        let auth_state = Arc::new(AuthState::new(
            session_manager.clone(),
            AuthMode::LocalUsers,
        ));

        // Create a valid session
        let user = AuthUser::new(
            "user123".to_string(),
            "testuser".to_string(),
            vec!["admin".to_string()],
        );
        let token = session_manager.create_session(user).await.unwrap();

        let app = Router::new()
            .route("/test", get(test_handler))
            .layer(middleware::from_fn_with_state(
                auth_state.clone(),
                auth_middleware,
            ))
            .with_state(auth_state);

        let request = Request::builder()
            .uri("/test")
            .header(header::COOKIE, format!("session_token={}", token))
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(request).await.unwrap();

        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_extract_session_token_success() {
        let request = Request::builder()
            .header(header::COOKIE, "session_token=abc123; other=value")
            .body(Body::empty())
            .unwrap();

        let token = extract_session_token(&request).unwrap();
        assert_eq!(token, "abc123");
    }

    #[tokio::test]
    async fn test_extract_session_token_missing() {
        let request = Request::builder()
            .header(header::COOKIE, "other=value")
            .body(Body::empty())
            .unwrap();

        let result = extract_session_token(&request);
        assert!(matches!(result, Err(AuthError::MissingSessionToken)));
    }

    #[tokio::test]
    async fn test_extract_session_token_no_cookie_header() {
        let request = Request::builder().body(Body::empty()).unwrap();

        let result = extract_session_token(&request);
        assert!(matches!(result, Err(AuthError::MissingSessionToken)));
    }

    #[tokio::test]
    async fn test_auth_middleware_oidc_mode_missing_token() {
        let app = create_test_app(AuthMode::Oidc);

        let request = Request::builder().uri("/test").body(Body::empty()).unwrap();

        let response = app.oneshot(request).await.unwrap();

        // Should redirect to login (303) instead of returning 401
        assert_eq!(response.status(), StatusCode::SEE_OTHER);
    }

    #[tokio::test]
    async fn test_auth_state_creation() {
        let session_manager = Arc::new(SessionManager::new(SessionConfig::new(60)));
        let auth_state = AuthState::new(session_manager.clone(), AuthMode::LocalUsers);

        assert_eq!(auth_state.auth_mode, AuthMode::LocalUsers);
    }

    #[tokio::test]
    async fn test_authenticated_user_extension() {
        let user = AuthUser::new(
            "user123".to_string(),
            "testuser".to_string(),
            vec!["admin".to_string()],
        );
        let auth_user = AuthenticatedUser(user.clone());

        assert_eq!(auth_user.0.id, user.id);
        assert_eq!(auth_user.0.username, user.username);
        assert_eq!(auth_user.0.roles, user.roles);
    }
}
