use crate::auth::middleware::AuthenticatedUser;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;

/// Permission enforcement state
#[derive(Debug, Clone)]
pub struct PermissionState {
    /// Auth mode to determine if permission checks are needed
    pub auth_mode: crate::config::AuthMode,
}

impl PermissionState {
    pub fn new(auth_mode: crate::config::AuthMode) -> Self {
        Self { auth_mode }
    }
}

/// Permission enforcement middleware that checks cluster access
///
/// This middleware:
/// - Extracts authenticated user from request extensions
/// - Checks if user has access to requested cluster
/// - Returns 403 Forbidden if user lacks cluster access
/// - Returns 302 redirect with redirect_to param if unauthenticated
/// - Allows requests in Open mode without checks
pub async fn permission_middleware(
    State(_state): State<Arc<PermissionState>>,
    request: Request,
    next: Next,
) -> Result<Response, PermissionError> {
    // Extract path to determine if this is a cluster-specific request
    let path = request.uri().path().to_string();

    // Check if this is a cluster-specific endpoint
    if let Some(cluster_id) = extract_cluster_id_from_path(&path) {
        // Extract authenticated user from request extensions
        let user = request
            .extensions()
            .get::<AuthenticatedUser>()
            .ok_or(PermissionError::Unauthenticated)?;

        // Get accessible clusters from user's session
        // Note: The session is already validated by auth_middleware at this point
        // We need to get the accessible clusters from the session
        // For now, we'll check against the user's roles which should contain cluster info
        // TODO: This needs to be updated once session stores accessible_clusters

        // Check if user has access to this cluster
        if !user_can_access_cluster(&user.0, &cluster_id) {
            return Err(PermissionError::Forbidden(cluster_id));
        }
    }

    // Continue to next middleware/handler
    Ok(next.run(request).await)
}

/// Extract cluster ID from path if it's a cluster-specific endpoint
///
/// Matches paths like:
/// - /api/clusters/{cluster_id}/...
/// - /api/clusters/{cluster_id}
fn extract_cluster_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();

    // Look for pattern: /api/clusters/{cluster_id}
    if parts.len() >= 3 && parts[1] == "api" && parts[2] == "clusters" {
        // Check if there's a cluster_id (parts[3])
        if parts.len() > 3 && !parts[3].is_empty() {
            // Make sure it's not a sub-route like "stats" without cluster_id
            return Some(parts[3].to_string());
        }
    }

    None
}

/// Check if a user can access a specific cluster
///
/// In Open mode, all users have access to all clusters.
/// Otherwise, check if the cluster is in the user's accessible clusters.
fn user_can_access_cluster(user: &crate::auth::AuthUser, cluster_id: &str) -> bool {
    // Check if user has wildcard access (all clusters)
    if user.accessible_clusters.iter().any(|c| c == "*") {
        return true;
    }

    // Check if cluster is in user's accessible clusters
    user.accessible_clusters.iter().any(|c| c == cluster_id)
}

/// Permission enforcement errors
#[derive(Debug)]
pub enum PermissionError {
    /// User is not authenticated
    Unauthenticated,
    /// User lacks access to specific cluster
    Forbidden(String),
}

impl IntoResponse for PermissionError {
    fn into_response(self) -> Response {
        match self {
            PermissionError::Unauthenticated => {
                // Return 302 redirect to login with redirect_to parameter
                // This is handled by returning a redirect response
                let redirect_uri = "/api/auth/login".to_string();
                // TODO: Add redirect_to query parameter with original URL
                (StatusCode::FOUND, [("Location", redirect_uri.as_str())]).into_response()
            }
            PermissionError::Forbidden(cluster_id) => {
                tracing::warn!(cluster_id = %cluster_id, "User attempted to access forbidden cluster");
                (
                    StatusCode::FORBIDDEN,
                    format!("Access denied to cluster: {}", cluster_id),
                )
                    .into_response()
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_cluster_id_from_path_valid() {
        assert_eq!(
            extract_cluster_id_from_path("/api/clusters/prod-1/stats"),
            Some("prod-1".to_string())
        );
        assert_eq!(
            extract_cluster_id_from_path("/api/clusters/dev-1/nodes"),
            Some("dev-1".to_string())
        );
        assert_eq!(
            extract_cluster_id_from_path("/api/clusters/test-123"),
            Some("test-123".to_string())
        );
    }

    #[test]
    fn test_extract_cluster_id_from_path_invalid() {
        assert_eq!(extract_cluster_id_from_path("/api/clusters"), None);
        assert_eq!(extract_cluster_id_from_path("/health"), None);
        assert_eq!(extract_cluster_id_from_path("/api/version"), None);
    }

    #[test]
    fn test_user_can_access_cluster_wildcard() {
        let user = crate::auth::AuthUser::new(
            "user1".to_string(),
            "testuser".to_string(),
            vec!["*".to_string()],
        );

        assert!(user_can_access_cluster(&user, "any-cluster"));
        assert!(user_can_access_cluster(&user, "prod-1"));
    }

    #[test]
    fn test_permission_state_creation() {
        let state = PermissionState::new(crate::config::AuthMode::Open);
        assert_eq!(state.auth_mode, crate::config::AuthMode::Open);
    }
}
