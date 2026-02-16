use crate::cluster::{ClusterInfo, Manager as ClusterManager};
use axum::{
    extract::{Path, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

mod transform;
use transform::{
    transform_cluster_stats, transform_indices, transform_node_detail_stats, transform_nodes,
    transform_shards, ClusterStatsResponse, IndexInfoResponse, NodeDetailStatsResponse,
    NodeInfoResponse, ShardInfoResponse,
};

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

/// Get cluster statistics using SDK typed methods
///
/// Returns cluster stats in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.1, 4.2, 4.3
pub async fn get_cluster_stats(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
) -> Result<Json<ClusterStatsResponse>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting cluster stats");

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

    // Get cluster stats and health using SDK typed methods
    let stats = cluster.cluster_stats().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get cluster stats"
        );
        ClusterErrorResponse {
            error: "stats_failed".to_string(),
            message: format!("Failed to get cluster stats: {}", e),
        }
    })?;

    let health = cluster.health().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get cluster health"
        );
        ClusterErrorResponse {
            error: "health_failed".to_string(),
            message: format!("Failed to get cluster health: {}", e),
        }
    })?;

    // Transform to frontend format
    let response = transform_cluster_stats(&stats, &health).map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to transform cluster stats"
        );
        ClusterErrorResponse {
            error: "transform_failed".to_string(),
            message: format!("Failed to transform cluster stats: {}", e),
        }
    })?;

    tracing::debug!(
        cluster_id = %cluster_id,
        health = %response.health,
        "Cluster stats retrieved successfully"
    );

    Ok(Json(response))
}

/// Get nodes information using SDK typed methods
///
/// Returns nodes info in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.6, 14.1, 14.2
pub async fn get_nodes(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
) -> Result<Json<Vec<NodeInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting nodes info");

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

    // Get nodes info and stats using SDK typed methods
    let nodes_info = cluster.nodes_info().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get nodes info"
        );
        ClusterErrorResponse {
            error: "nodes_info_failed".to_string(),
            message: format!("Failed to get nodes info: {}", e),
        }
    })?;

    let nodes_stats = cluster.nodes_stats().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get nodes stats"
        );
        ClusterErrorResponse {
            error: "nodes_stats_failed".to_string(),
            message: format!("Failed to get nodes stats: {}", e),
        }
    })?;

    // Get cluster state to determine master node
    let master_node_id = match cluster.cluster_state().await {
        Ok(cluster_state) => cluster_state
            .get("master_node")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        Err(e) => {
            tracing::warn!(
                cluster_id = %cluster_id,
                error = %e,
                "Failed to get cluster state for master node detection"
            );
            None
        }
    };

    // Transform to frontend format
    let response = transform_nodes(&nodes_info, &nodes_stats, master_node_id.as_deref());

    tracing::debug!(
        cluster_id = %cluster_id,
        node_count = response.len(),
        master_node = ?master_node_id,
        "Nodes info retrieved successfully"
    );

    Ok(Json(response))
}

/// Get detailed stats for a specific node
///
/// Returns comprehensive node statistics including thread pools, shards, and metrics
///
/// # Requirements
///
/// Validates: Requirements 14.3, 14.4, 14.5
pub async fn get_node_stats(
    State(state): State<ClusterState>,
    Path((cluster_id, node_id)): Path<(String, String)>,
) -> Result<Json<NodeDetailStatsResponse>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        node_id = %node_id,
        "Getting detailed node stats"
    );

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

    // Get nodes info for the specific node
    let nodes_info = cluster.nodes_info().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            error = %e,
            "Failed to get node info"
        );
        ClusterErrorResponse {
            error: "node_info_failed".to_string(),
            message: format!("Failed to get node info: {}", e),
        }
    })?;

    // Get detailed node stats for the specific node using SDK
    let node_stats = cluster.node_stats(&node_id).await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            error = %e,
            "Failed to get node stats"
        );
        ClusterErrorResponse {
            error: "node_stats_failed".to_string(),
            message: format!("Failed to get node stats: {}", e),
        }
    })?;

    // Get cluster state for master info
    let cluster_state = cluster.cluster_state().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get cluster state"
        );
        ClusterErrorResponse {
            error: "cluster_state_failed".to_string(),
            message: format!("Failed to get cluster state: {}", e),
        }
    })?;

    // Get shards for data nodes
    let shards = if let Some(node_info) = nodes_info["nodes"][&node_id].as_object() {
        if let Some(roles) = node_info.get("roles").and_then(|r| r.as_array()) {
            let has_data_role = roles.iter().any(|r| r.as_str() == Some("data"));
            if has_data_role {
                Some(cluster_state.clone())
            } else {
                None
            }
        } else {
            None
        }
    } else {
        None
    };

    // Transform to frontend format
    let response = transform_node_detail_stats(
        &node_id,
        &nodes_info,
        &node_stats,
        &cluster_state,
        shards.as_ref(),
    )
    .map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            error = %e,
            "Failed to transform node stats"
        );
        ClusterErrorResponse {
            error: "transform_failed".to_string(),
            message: format!("Failed to transform node stats: {}", e),
        }
    })?;

    tracing::debug!(
        cluster_id = %cluster_id,
        node_id = %node_id,
        "Node stats retrieved successfully"
    );

    Ok(Json(response))
}

/// Get indices information using SDK typed methods
///
/// Returns indices info in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.7
pub async fn get_indices(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
) -> Result<Json<Vec<IndexInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting indices info");

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

    // Get indices stats using SDK typed method
    let indices_stats = cluster.indices_stats().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get indices stats"
        );
        ClusterErrorResponse {
            error: "indices_stats_failed".to_string(),
            message: format!("Failed to get indices stats: {}", e),
        }
    })?;

    // Transform to frontend format
    let response = transform_indices(&indices_stats);

    tracing::debug!(
        cluster_id = %cluster_id,
        index_count = response.len(),
        "Indices info retrieved successfully"
    );

    Ok(Json(response))
}

/// Get shards information using SDK typed methods
///
/// Returns shards info in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.8
pub async fn get_shard_stats(
    State(state): State<ClusterState>,
    Path((cluster_id, index_name, shard_num)): Path<(String, String, String)>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        index = %index_name,
        shard = %shard_num,
        "Getting detailed shard stats"
    );

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

    // Use the SDK method to get shard-level stats
    let indices_stats = cluster
        .indices_stats_with_shards(&index_name)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                index = %index_name,
                error = %e,
                "Failed to get indices stats with shards"
            );
            ClusterErrorResponse {
                error: "indices_stats_failed".to_string(),
                message: format!("Failed to get indices stats with shards: {}", e),
            }
        })?;

    tracing::info!(
        cluster_id = %cluster_id,
        index = %index_name,
        "Raw indices_stats response: {}",
        serde_json::to_string_pretty(&indices_stats).unwrap_or_else(|_| "failed to serialize".to_string())
    );

    // Navigate to the specific shard in the response
    // Structure: indices -> {index_name} -> shards -> {shard_num} -> [array of shard copies]
    if let Some(indices) = indices_stats.get("indices") {
        if let Some(index_obj) = indices.get(&index_name) {
            if let Some(shards_obj) = index_obj.get("shards") {
                if let Some(shard_array) = shards_obj.get(&shard_num) {
                    if let Some(arr) = shard_array.as_array() {
                        // Return the first shard (primary or replica)
                        if let Some(shard_stats) = arr.first() {
                            tracing::info!(
                                cluster_id = %cluster_id,
                                index = %index_name,
                                shard = %shard_num,
                                "Successfully found shard stats"
                            );
                            return Ok(Json(shard_stats.clone()));
                        }
                    }
                }
            }
        }
    }

    // If not found, return empty object
    tracing::warn!(
        cluster_id = %cluster_id,
        index = %index_name,
        shard = %shard_num,
        "Shard stats not found in expected structure"
    );
    Ok(Json(serde_json::json!({})))
}

/// Get shards information for a cluster
///
/// # Requirements
///
/// Validates: Requirements 4.8
pub async fn get_shards(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
) -> Result<Json<Vec<ShardInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting shards info");

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

    // Get cluster state and indices stats using SDK typed methods
    let cluster_state = cluster.cluster_state().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get cluster state"
        );
        ClusterErrorResponse {
            error: "cluster_state_failed".to_string(),
            message: format!("Failed to get cluster state: {}", e),
        }
    })?;

    let indices_stats = cluster.indices_stats().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get indices stats"
        );
        ClusterErrorResponse {
            error: "indices_stats_failed".to_string(),
            message: format!("Failed to get indices stats: {}", e),
        }
    })?;

    // Transform to frontend format
    let response = transform_shards(&cluster_state, &indices_stats);

    tracing::debug!(
        cluster_id = %cluster_id,
        shard_count = response.len(),
        "Shards info retrieved successfully"
    );

    Ok(Json(response))
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
    // Ensure path starts with / for Elasticsearch API
    let normalized_path = if path.starts_with('/') {
        path.clone()
    } else {
        format!("/{}", path)
    };

    let full_path = if let Some(q) = query {
        format!("{}?{}", normalized_path, q)
    } else {
        normalized_path
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

    // Log Elasticsearch API errors (4xx and 5xx responses) with response body
    if status.is_client_error() || status.is_server_error() {
        // Try to parse the error response body for better logging
        let error_body = String::from_utf8_lossy(&body_bytes);
        tracing::warn!(
            cluster_id = %cluster_id,
            method = %method,
            path = %full_path,
            status = status.as_u16(),
            response_body = %error_body,
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
