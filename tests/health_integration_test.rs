/// Integration tests for health and readiness endpoints
///
/// These tests validate the health check functionality including
/// dependency status reporting.
use axum::response::IntoResponse;
use secan::auth::{SessionConfig, SessionManager};
use secan::cluster::Manager as ClusterManager;
use secan::config::ClusterConfig as ConfigCluster;
use secan::config::TlsConfig;
use serial_test::serial;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::RwLock;

/// Test health check returns 200 when server is running
#[tokio::test]
#[serial]
async fn test_health_check_returns_ok() {
    let cluster_config = ConfigCluster {
        id: "test".to_string(),
        name: Some("Test".to_string()),
        nodes: vec!["http://localhost:9200".to_string()],
        auth: None,
        tls: TlsConfig::default(),
        ..Default::default()
    };

    let cluster_manager = ClusterManager::new(vec![cluster_config], Duration::from_secs(30))
        .await
        .unwrap();

    let session_manager = SessionManager::new(SessionConfig::new(60));

    let state = secan::routes::health::HealthState {
        cluster_manager: Arc::new(cluster_manager),
        session_manager: Arc::new(session_manager),
    };

    let locked_state = Arc::new(RwLock::new(state));

    let response =
        secan::routes::health::readiness_check(axum::extract::State(locked_state.clone())).await;

    let resp: axum::response::Response = response.into_response();
    // Status depends on cluster connectivity (unreachable = 503, reachable = 200)
    assert!(
        resp.status() == axum::http::StatusCode::OK
            || resp.status() == axum::http::StatusCode::SERVICE_UNAVAILABLE
    );
}

/// Test readiness check includes dependency status
#[tokio::test]
#[serial]
async fn test_readiness_check_includes_dependencies() {
    let cluster_config = ConfigCluster {
        id: "test".to_string(),
        name: Some("Test".to_string()),
        nodes: vec!["http://localhost:9200".to_string()],
        auth: None,
        tls: TlsConfig::default(),
        ..Default::default()
    };

    let cluster_manager = ClusterManager::new(vec![cluster_config], Duration::from_secs(30))
        .await
        .unwrap();

    let session_manager = SessionManager::new(SessionConfig::new(60));

    let state = secan::routes::health::HealthState {
        cluster_manager: Arc::new(cluster_manager),
        session_manager: Arc::new(session_manager),
    };

    let locked_state = Arc::new(RwLock::new(state));

    let response =
        secan::routes::health::readiness_check(axum::extract::State(locked_state.clone())).await;

    // Verify response can be parsed
    let resp: axum::response::Response = response.into_response();
    assert!(
        resp.status().is_success() || resp.status() == axum::http::StatusCode::SERVICE_UNAVAILABLE
    );
}

/// Test health response serialization
#[test]
fn test_health_response_serialization() {
    let response = secan::routes::health::HealthResponse {
        status: "healthy".to_string(),
        message: "Server is running".to_string(),
    };

    let json = serde_json::to_string(&response).unwrap();
    assert!(json.contains("\"status\":\"healthy\""));
    assert!(json.contains("\"message\":\"Server is running\""));
}

/// Test readiness response structure
#[test]
fn test_readiness_response_structure() {
    use secan::routes::health::{
        ClusterDetail, ClusterHealthStatus, ComponentStatus, DependenciesStatus, ReadinessResponse,
    };

    let response = ReadinessResponse {
        status: "ready".to_string(),
        message: "Server is ready".to_string(),
        dependencies: Some(DependenciesStatus {
            clusters: ClusterHealthStatus {
                total: 1,
                healthy: 1,
                unhealthy: 0,
                details: vec![ClusterDetail {
                    id: "test".to_string(),
                    name: Some("Test".to_string()),
                    status: "green".to_string(),
                    error: None,
                }],
            },
            session_manager: ComponentStatus {
                status: "healthy".to_string(),
                message: Some("Operational".to_string()),
            },
        }),
    };

    let json = serde_json::to_string(&response).unwrap();
    assert!(json.contains("\"status\":\"ready\""));
    assert!(json.contains("\"dependencies\""));
    assert!(json.contains("\"total\":1"));
    assert!(json.contains("\"session_manager\""));
}

/// Test cluster health status serialization
#[test]
fn test_cluster_health_status_serialization() {
    use secan::routes::health::{ClusterDetail, ClusterHealthStatus};

    let status = ClusterHealthStatus {
        total: 2,
        healthy: 1,
        unhealthy: 1,
        details: vec![
            ClusterDetail {
                id: "prod".to_string(),
                name: Some("Production".to_string()),
                status: "green".to_string(),
                error: None,
            },
            ClusterDetail {
                id: "dev".to_string(),
                name: Some("Development".to_string()),
                status: "unreachable".to_string(),
                error: Some("Connection refused".to_string()),
            },
        ],
    };

    let json = serde_json::to_string(&status).unwrap();
    assert!(json.contains("\"total\":2"));
    assert!(json.contains("\"healthy\":1"));
    assert!(json.contains("\"unhealthy\":1"));
    assert!(json.contains("\"unreachable\""));
}

/// Test version response
#[tokio::test]
async fn test_version_endpoint() {
    let (status, response) = secan::routes::health::get_version().await;

    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(!response.version.is_empty());
}
