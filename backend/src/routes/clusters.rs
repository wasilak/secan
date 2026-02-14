use crate::cluster::{ClusterInfo, Manager as ClusterManager};
use axum::{
    extract::{Path, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

/// Shared application state for cluster routes
#[derive(Clone)]
pub struct ClusterState {
    pub cluster_manager: Arc<ClusterManager>,
}

/// Error response for cluster operations
#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterErrorResponse {
    pub error: String,
    pub message: String,
}

impl IntoResponse for ClusterErrorResponse {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

/// List all configured clusters
///
/// Returns a list of all clusters the user has access to
///
/// # Requirements
///
/// Validates: Requirements 2.15
pub async fn list_clusters(
    State(state): State<ClusterState>,
) -> Result<Json<Vec<ClusterInfo>>, ClusterErrorResponse> {
    tracing::debug!("Listing all clusters");

    // TODO: Extract authenticated user from request
    // TODO: Filter clusters based on RBAC

    let clusters = state.cluster_manager.list_clusters().await;

    tracing::info!("Returning {} cluster(s)", clusters.len());

    Ok(Json(clusters))
}

/// Proxy request to Elasticsearch cluster
///
/// Forwards the request to the specified cluster and returns the response
///
/// # Requirements
///
/// Validates: Requirements 2.16, 29.3
pub async fn proxy_request(
    State(state): State<ClusterState>,
    Path((cluster_id, path)): Path<(String, String)>,
    method: Method,
    axum::extract::RawQuery(query): axum::extract::RawQuery,
    body: Option<Json<serde_json::Value>>,
) -> Result<Response, ClusterErrorResponse> {
    // Construct full path with query string if present
    let full_path = if let Some(q) = query {
        format!("{}?{}", path, q)
    } else {
        path.clone()
    };

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        "Proxying request to Elasticsearch"
    );

    // TODO: Extract authenticated user from request
    // TODO: Check RBAC authorization

    // Get the cluster
    let cluster = state
        .cluster_manager
        .get_cluster(&cluster_id)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "Cluster not found"
            );
            ClusterErrorResponse {
                error: "cluster_not_found".to_string(),
                message: format!("Cluster '{}' not found: {}", cluster_id, e),
            }
        })?;

    // Proxy the request
    let response = cluster
        .request(method.clone(), &full_path, body.map(|j| j.0))
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                method = %method,
                path = %full_path,
                error = %e,
                "Elasticsearch API request failed"
            );
            ClusterErrorResponse {
                error: "proxy_failed".to_string(),
                message: format!("Failed to proxy request: {}", e),
            }
        })?;

    // Convert reqwest::Response to axum::Response
    let status = response.status();
    let headers = response.headers().clone();
    let body_bytes = response.bytes().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to read Elasticsearch response body"
        );
        ClusterErrorResponse {
            error: "response_read_failed".to_string(),
            message: format!("Failed to read response body: {}", e),
        }
    })?;

    // Log Elasticsearch API errors (4xx and 5xx responses)
    if status.is_client_error() || status.is_server_error() {
        tracing::warn!(
            cluster_id = %cluster_id,
            method = %method,
            path = %full_path,
            status = status.as_u16(),
            "Elasticsearch API returned error status"
        );
    } else {
        tracing::debug!(
            cluster_id = %cluster_id,
            method = %method,
            path = %full_path,
            status = status.as_u16(),
            "Elasticsearch API request successful"
        );
    }

    let mut axum_response = Response::builder().status(status);

    // Copy headers
    for (key, value) in headers.iter() {
        axum_response = axum_response.header(key, value);
    }

    let axum_response = axum_response
        .body(axum::body::Body::from(body_bytes))
        .map_err(|e| {
            tracing::error!(
                error = %e,
                "Failed to build response"
            );
            ClusterErrorResponse {
                error: "response_build_failed".to_string(),
                message: format!("Failed to build response: {}", e),
            }
        })?;

    Ok(axum_response)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cluster_error_response_serialization() {
        let error = ClusterErrorResponse {
            error: "cluster_not_found".to_string(),
            message: "Cluster 'test' not found".to_string(),
        };

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"error\":\"cluster_not_found\""));
        assert!(json.contains("\"message\":\"Cluster 'test' not found\""));
    }

    #[test]
    fn test_cluster_error_response_deserialization() {
        let json = r#"{"error":"proxy_failed","message":"Connection timeout"}"#;
        let error: ClusterErrorResponse = serde_json::from_str(json).unwrap();

        assert_eq!(error.error, "proxy_failed");
        assert_eq!(error.message, "Connection timeout");
    }
}
