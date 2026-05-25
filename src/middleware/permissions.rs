use crate::auth::middleware::AuthenticatedUser;
use crate::auth::RbacManager;
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
    pub auth_mode: crate::config::AuthMode,
    /// RBAC manager used to resolve cluster access from user roles/groups.
    /// Constructed once at startup from config.auth.roles.
    pub rbac: RbacManager,
}

impl PermissionState {
    pub fn new(auth_mode: crate::config::AuthMode, rbac: RbacManager) -> Self {
        Self { auth_mode, rbac }
    }
}

/// Permission enforcement middleware that checks cluster access via RbacManager.
///
/// Skips checks in Open mode. For all other modes, resolves cluster access
/// from the authenticated user's roles against the configured RBAC rules.
pub async fn permission_middleware(
    State(state): State<Arc<PermissionState>>,
    request: Request,
    next: Next,
) -> Result<Response, PermissionError> {
    if state.auth_mode == crate::config::AuthMode::Open {
        return Ok(next.run(request).await);
    }

    if let Some(cluster_id) = extract_cluster_id_from_path(request.uri().path()) {
        let user = request
            .extensions()
            .get::<AuthenticatedUser>()
            .ok_or(PermissionError::Unauthenticated)?;

        if !state.rbac.can_access_cluster(&user.0, &cluster_id) {
            return Err(PermissionError::Forbidden(cluster_id));
        }
    }

    Ok(next.run(request).await)
}

/// Extract cluster ID from paths like /api/clusters/{cluster_id}/...
fn extract_cluster_id_from_path(path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('/').collect();
    if parts.len() >= 4 && parts[1] == "api" && parts[2] == "clusters" && !parts[3].is_empty() {
        return Some(parts[3].to_string());
    }
    None
}

/// Permission enforcement errors
#[derive(Debug)]
pub enum PermissionError {
    Unauthenticated,
    Forbidden(String),
}

impl IntoResponse for PermissionError {
    fn into_response(self) -> Response {
        match self {
            PermissionError::Unauthenticated => (
                StatusCode::UNAUTHORIZED,
                serde_json::json!({"error":"unauthenticated","message":"Authentication required"})
                    .to_string(),
            )
                .into_response(),
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
    use crate::config::RoleConfig;

    fn make_rbac(patterns: &[(&str, &str)]) -> RbacManager {
        let roles = patterns
            .iter()
            .map(|(name, pattern)| RoleConfig {
                name: name.to_string(),
                cluster_patterns: vec![pattern.to_string()],
            })
            .collect();
        RbacManager::new(roles)
    }

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
    fn test_permission_state_creation() {
        let rbac = make_rbac(&[]);
        let state = PermissionState::new(crate::config::AuthMode::Open, rbac);
        assert_eq!(state.auth_mode, crate::config::AuthMode::Open);
    }

    #[test]
    fn test_rbac_wildcard_access() {
        let rbac = make_rbac(&[("admin", "*")]);
        let user = crate::auth::AuthUser::new(
            "u1".to_string(),
            "u1".to_string(),
            vec!["admin".to_string()],
        );
        assert!(rbac.can_access_cluster(&user, "any-cluster"));
        assert!(rbac.can_access_cluster(&user, "prod-1"));
    }

    #[test]
    fn test_rbac_pattern_access() {
        let rbac = make_rbac(&[("prod-viewer", "prod-*")]);
        let user = crate::auth::AuthUser::new(
            "u1".to_string(),
            "u1".to_string(),
            vec!["prod-viewer".to_string()],
        );
        assert!(rbac.can_access_cluster(&user, "prod-cluster-1"));
        assert!(!rbac.can_access_cluster(&user, "dev-cluster-1"));
    }
}
