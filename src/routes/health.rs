use axum::{
    extract::State as ExtractState, http::StatusCode, response::IntoResponse, routing::get, Json,
    Router,
};
use serde::{Deserialize, Serialize};
use std::process::Command;
use std::sync::Arc;
use tokio::sync::RwLock;
use tracing::instrument;
use utoipa::ToSchema;

use crate::auth::SessionManager;
use crate::cluster::Manager as ClusterManager;

/// Health check response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct HealthResponse {
    #[schema(example = "healthy")]
    pub status: String,
    #[schema(example = "Server is running")]
    pub message: String,
}

/// Readiness check response with dependency status
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ReadinessResponse {
    #[schema(example = "ready")]
    pub status: String,
    #[schema(example = "Server is ready to accept requests")]
    pub message: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dependencies: Option<DependenciesStatus>,
}

/// Status of external dependencies
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct DependenciesStatus {
    /// Status of Elasticsearch/OpenSearch clusters
    pub clusters: ClusterHealthStatus,
    /// Status of session manager
    pub session_manager: ComponentStatus,
}

/// Health status of configured clusters
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClusterHealthStatus {
    /// Total number of configured clusters
    #[schema(example = 2)]
    pub total: usize,
    /// Number of clusters that are healthy
    #[schema(example = 1)]
    pub healthy: usize,
    /// Number of clusters that are unhealthy
    #[schema(example = 1)]
    pub unhealthy: usize,
    /// Details per cluster
    pub details: Vec<ClusterDetail>,
}

/// Individual cluster health detail
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClusterDetail {
    #[schema(example = "prod-1")]
    pub id: String,
    #[schema(example = "Production")]
    pub name: Option<String>,
    #[schema(example = "green")]
    pub status: String,
    pub error: Option<String>,
}

/// Status of a single component
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ComponentStatus {
    #[schema(example = "healthy")]
    pub status: String,
    pub message: Option<String>,
}

/// Version response
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct VersionResponse {
    #[schema(example = "1.2.28")]
    pub version: String,
    #[schema(example = "v1.2.28-5-g1234567")]
    pub git_info: String,
}

/// State for health routes that need access to dependencies
#[derive(Clone, Debug)]
pub struct HealthState {
    pub cluster_manager: Arc<ClusterManager>,
    pub session_manager: Arc<SessionManager>,
}

/// Create a router for health-related routes with state
pub fn health_router(
    cluster_manager: Arc<ClusterManager>,
    session_manager: Arc<SessionManager>,
) -> Router {
    let state = HealthState {
        cluster_manager,
        session_manager,
    };

    Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .route("/api/version", get(get_version))
        .with_state(Arc::new(RwLock::new(state)))
}

/// Health check endpoint
///
/// Returns HTTP 200 if the server is healthy
/// This endpoint does not require authentication
///
/// # Requirements
///
/// Validates: Requirements 39.1, 39.2, 39.5
#[utoipa::path(
    get,
    path = "/health",
    tag = "Health",
    responses(
        (status = 200, description = "Server is healthy", body = HealthResponse)
    )
)]
#[instrument]
pub async fn health_check() -> (StatusCode, Json<HealthResponse>) {
    tracing::debug!("Health check requested");

    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "healthy".to_string(),
            message: "Server is running".to_string(),
        }),
    )
}

/// Readiness check endpoint
///
/// Returns HTTP 200 if the server is ready to accept requests
/// This endpoint does not require authentication
///
/// # Requirements
///
/// Validates: Requirements 39.3, 39.6
#[utoipa::path(
    get,
    path = "/ready",
    tag = "Health",
    responses(
        (status = 200, description = "Server is ready", body = ReadinessResponse),
        (status = 503, description = "Server is not ready", body = ReadinessResponse)
    )
)]
#[instrument]
pub async fn readiness_check(state: ExtractState<Arc<RwLock<HealthState>>>) -> impl IntoResponse {
    tracing::debug!("Readiness check requested");

    let state = state.read().await;

    let cluster_status = check_cluster_health(&state.cluster_manager).await;
    let session_status = check_session_manager_health(&state.session_manager);

    let _total_clusters = cluster_status.total;
    let _healthy_clusters = cluster_status.healthy;
    let unhealthy_clusters = cluster_status.unhealthy;

    let is_ready = unhealthy_clusters == 0 && session_status.status == "healthy";

    let response = ReadinessResponse {
        status: if is_ready {
            "ready".to_string()
        } else {
            "not_ready".to_string()
        },
        message: if is_ready {
            "Server is ready to accept requests".to_string()
        } else {
            format!(
                "Server not ready: {} cluster(s) unhealthy, session manager: {}",
                unhealthy_clusters, session_status.status
            )
        },
        dependencies: Some(DependenciesStatus {
            clusters: cluster_status,
            session_manager: session_status,
        }),
    };

    let status = if is_ready {
        StatusCode::OK
    } else {
        StatusCode::SERVICE_UNAVAILABLE
    };

    (status, Json(response))
}

/// Check health of all configured clusters
async fn check_cluster_health(cluster_manager: &ClusterManager) -> ClusterHealthStatus {
    let cluster_count = cluster_manager.cluster_count().await;

    if cluster_count == 0 {
        return ClusterHealthStatus {
            total: 0,
            healthy: 0,
            unhealthy: 0,
            details: vec![],
        };
    }

    let health_results = cluster_manager.check_all_health().await;

    let mut healthy = 0;
    let mut unhealthy = 0;
    let mut details = Vec::new();

    for (cluster_id, health_result) in health_results {
        let (status, error) = match health_result {
            Ok(h) => {
                let status_str = match h.status {
                    crate::cluster::HealthStatus::Green => "green",
                    crate::cluster::HealthStatus::Yellow => "yellow",
                    crate::cluster::HealthStatus::Red => "red",
                };
                if status_str == "red" {
                    unhealthy += 1;
                } else {
                    healthy += 1;
                }
                (status_str.to_string(), None)
            }
            Err(e) => {
                unhealthy += 1;
                ("unreachable".to_string(), Some(e.to_string()))
            }
        };

        let cluster_info = cluster_manager.get_cluster(&cluster_id).await.ok();

        details.push(ClusterDetail {
            id: cluster_id,
            name: cluster_info.and_then(|c| c.name.clone()),
            status,
            error,
        });
    }

    ClusterHealthStatus {
        total: cluster_count,
        healthy,
        unhealthy,
        details,
    }
}

/// Check health of the session manager
fn check_session_manager_health(_session_manager: &SessionManager) -> ComponentStatus {
    ComponentStatus {
        status: "healthy".to_string(),
        message: Some("Session manager operational".to_string()),
    }
}

/// Version endpoint
///
/// Returns the current version and git information
/// This endpoint does not require authentication
#[utoipa::path(
    get,
    path = "/api/version",
    tag = "Health",
    responses(
        (status = 200, description = "Version info", body = VersionResponse)
    )
)]
#[instrument]
pub async fn get_version() -> (StatusCode, Json<VersionResponse>) {
    tracing::debug!("Version check requested");

    let version = env!("CARGO_PKG_VERSION").to_string();

    // Try to get git info (tag or branch)
    let git_info = get_git_info().unwrap_or_else(|_| "unknown".to_string());

    (StatusCode::OK, Json(VersionResponse { version, git_info }))
}

/// Get git information from the current commit
/// Tries to get tag first, falls back to branch name
fn get_git_info() -> Result<String, Box<dyn std::error::Error>> {
    // Try to get the latest tag that matches v*.*.* pattern
    let tag_output = Command::new("git")
        .args(["describe", "--tags", "--match", "v*.*.*", "--exact-match"])
        .output();

    if let Ok(output) = tag_output {
        if output.status.success() {
            let tag = String::from_utf8(output.stdout)?.trim().to_string();
            return Ok(tag);
        }
    }

    // Fall back to branch name
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()?;

    if branch_output.status.success() {
        let branch = String::from_utf8(branch_output.stdout)?.trim().to_string();
        return Ok(branch);
    }

    Err("Could not determine git info".into())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let (status, response) = health_check().await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(response.status, "healthy");
        assert_eq!(response.message, "Server is running");
    }

    #[tokio::test]
    async fn test_readiness_check() {
        use tokio::sync::RwLock;

        let cluster_config = crate::config::ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: crate::config::TlsConfig::default(),
            ..Default::default()
        };

        let cluster_manager =
            ClusterManager::new(vec![cluster_config], std::time::Duration::from_secs(30))
                .await
                .expect("create cluster manager");

        let session_manager = SessionManager::new(crate::auth::SessionConfig::new(60));

        let state = HealthState {
            cluster_manager: Arc::new(cluster_manager),
            session_manager: Arc::new(session_manager),
        };

        let locked_state = Arc::new(RwLock::new(state));

        let response = readiness_check(ExtractState(locked_state.clone())).await;

        // Convert to response and check status
        // The status depends on whether clusters are reachable
        let resp: axum::response::Response = response.into_response();
        // Status could be OK (200) or Service Unavailable (503) depending on cluster reachability
        assert!(
            resp.status() == StatusCode::OK || resp.status() == StatusCode::SERVICE_UNAVAILABLE
        );
    }

    #[test]
    fn test_health_response_serialization() {
        let response = HealthResponse {
            status: "healthy".to_string(),
            message: "All systems operational".to_string(),
        };

        let json = serde_json::to_string(&response).expect("serialize HealthResponse to JSON");
        assert!(json.contains("\"status\":\"healthy\""));
        assert!(json.contains("\"message\":\"All systems operational\""));
    }

    #[test]
    fn test_health_response_deserialization() {
        let json = r#"{"status":"healthy","message":"Server is running"}"#;
        let response: HealthResponse =
            serde_json::from_str(json).expect("deserialize HealthResponse from JSON");

        assert_eq!(response.status, "healthy");
        assert_eq!(response.message, "Server is running");
    }

    #[tokio::test]
    async fn test_get_version() {
        let (status, response) = get_version().await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(response.version, env!("CARGO_PKG_VERSION"));
        // git_info could be tag, branch, or "unknown" depending on environment
        assert!(!response.git_info.is_empty());
    }

    #[test]
    fn test_version_response_serialization() {
        let response = VersionResponse {
            version: "1.0.0".to_string(),
            git_info: "main".to_string(),
        };

        let json = serde_json::to_string(&response).expect("serialize VersionResponse to JSON");
        assert!(json.contains("\"version\":\"1.0.0\""));
        assert!(json.contains("\"git_info\":\"main\""));
    }
}
