use crate::auth::middleware::AuthenticatedUser;
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

/// Request body for shard relocation
///
/// # Requirements
///
/// Validates: Requirements 6.1, 6.2
#[derive(Debug, Serialize, Deserialize)]
pub struct RelocateShardRequest {
    /// Index name
    pub index: String,
    /// Shard number
    pub shard: u32,
    /// Source node ID
    pub from_node: String,
    /// Destination node ID
    pub to_node: String,
}

/// List all configured clusters
///
/// Returns a list of all clusters the user has access to.
/// If cluster name is not provided in config, fetches it from Elasticsearch API.
///
/// # Requirements
///
/// Validates: Requirements 2.15
pub async fn list_clusters(
    State(state): State<ClusterState>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Vec<ClusterInfo>>, ClusterErrorResponse> {
    tracing::debug!("Listing all clusters");

    // Get all clusters from manager
    let all_clusters = state.cluster_manager.list_clusters().await;

    // Extract authenticated user if available (Open mode may not have it)
    let Some(user) = user_ext else {
        tracing::debug!("No authenticated user, returning all clusters (Open mode)");
        return Ok(Json(all_clusters));
    };

    tracing::debug!(
        user = %user.0.0.username,
        accessible_clusters = ?user.0.0.accessible_clusters,
        "Filtering clusters for user"
    );

    // Filter clusters based on user's accessible clusters
    let filtered_clusters =
        filter_clusters_by_access(&all_clusters, &user.0 .0.accessible_clusters);

    tracing::debug!(
        total = all_clusters.len(),
        accessible = filtered_clusters.len(),
        "Returning filtered cluster list"
    );

    // Fetch actual cluster names from health API for clusters without name in config
    let mut result_clusters = Vec::new();
    for cluster_info in filtered_clusters {
        if cluster_info.name.is_none() {
            // Fetch cluster name from health API
            if let Ok(cluster) = state.cluster_manager.get_cluster(&cluster_info.id).await {
                if let Ok(health) = cluster.health().await {
                    let cluster_name = health["cluster_name"]
                        .as_str()
                        .unwrap_or(&cluster_info.id)
                        .to_string();

                    result_clusters.push(ClusterInfo {
                        id: cluster_info.id,
                        name: Some(cluster_name),
                        nodes: cluster_info.nodes,
                        accessible: cluster_info.accessible,
                    });
                    continue;
                }
            }
        }
        result_clusters.push(cluster_info);
    }

    Ok(Json(result_clusters))
}

/// Filter clusters based on user's accessible cluster IDs
///
/// If user has wildcard ("*") access, return all clusters.
/// Otherwise, return only clusters whose ID is in the accessible list.
fn filter_clusters_by_access(
    all_clusters: &[ClusterInfo],
    accessible_clusters: &[String],
) -> Vec<ClusterInfo> {
    // Check for wildcard access
    if accessible_clusters.iter().any(|c| c == "*") {
        return all_clusters.to_vec();
    }

    // Filter to only accessible clusters
    all_clusters
        .iter()
        .filter(|cluster| accessible_clusters.contains(&cluster.id))
        .cloned()
        .collect()
}

/// Check if a user can access a specific cluster
///
/// Returns Ok(()) if the user has access, Err with 403 response otherwise.
/// If no user is provided (Open mode), access is granted to all clusters.
fn check_cluster_access(
    cluster_id: &str,
    user_ext: &Option<axum::Extension<AuthenticatedUser>>,
) -> Result<(), ClusterErrorResponse> {
    // No user extension means Open mode - allow all access
    let Some(user) = user_ext else {
        return Ok(());
    };

    let accessible = &user.0 .0.accessible_clusters;

    // Check for wildcard access
    if accessible.iter().any(|c| c == "*") {
        return Ok(());
    }

    // Check if cluster is in user's accessible clusters
    if accessible.iter().any(|c| c == cluster_id) {
        return Ok(());
    }

    // Access denied
    tracing::warn!(
        cluster_id = %cluster_id,
        user = %user.0.0.username,
        "User attempted to access forbidden cluster"
    );

    Err(ClusterErrorResponse {
        error: "access_denied".to_string(),
        message: format!("Access denied to cluster: {}", cluster_id),
    })
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
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<ClusterStatsResponse>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting cluster stats");

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

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
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Vec<NodeInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting nodes info");

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

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
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<NodeDetailStatsResponse>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        node_id = %node_id,
        "Getting detailed node stats"
    );

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

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
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Vec<IndexInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting indices info");

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

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
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        index = %index_name,
        shard = %shard_num,
        "Getting detailed shard stats"
    );

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

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

    // Navigate to the specific shard in the response
    // Structure: indices -> {index_name} -> shards -> {shard_num} -> [array of shard copies]
    if let Some(indices) = indices_stats.get("indices") {
        if let Some(index_obj) = indices.get(&index_name) {
            if let Some(shards_obj) = index_obj.get("shards") {
                if let Some(shard_array) = shards_obj.get(&shard_num) {
                    if let Some(arr) = shard_array.as_array() {
                        // Return the first shard (primary or replica)
                        if let Some(shard_stats) = arr.first() {
                            tracing::debug!(
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
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Vec<ShardInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting shards info");

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

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

    // Copy headers including content-type for proper response formatting in frontend
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

/// Relocate a shard from one node to another
///
/// Executes the Elasticsearch cluster reroute API to move a shard
///
/// # Requirements
///
/// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 8.1, 8.2, 8.3, 8.4
pub async fn relocate_shard(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<crate::auth::middleware::AuthenticatedUser>>,
    Json(req): Json<RelocateShardRequest>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    tracing::info!(
        cluster_id = %cluster_id,
        index = %req.index,
        shard = req.shard,
        from_node = %req.from_node,
        to_node = %req.to_node,
        "Shard relocation requested"
    );

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

    // Extract authenticated user (if authentication is enabled)
    // In Open mode, the middleware provides a default user
    let user = user_ext.map(|ext| ext.0 .0).ok_or_else(|| {
        tracing::error!("Authentication required but user not found in request");
        ClusterErrorResponse {
            error: "authentication_required".to_string(),
            message: "Authentication is required for this operation".to_string(),
        }
    })?;

    tracing::debug!(
        user_id = %user.id,
        username = %user.username,
        roles = ?user.roles,
        "User authenticated for shard relocation"
    );

    // TODO: Check RBAC - verify user has access to this cluster
    // For now, we log the user info and proceed
    // Full RBAC implementation will be added when RbacManager is integrated into ClusterState

    // Validate request parameters
    validate_relocation_request(&req)?;

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
                message: format!("Cluster '{}' not found. Please verify the cluster ID and ensure the cluster is configured.", cluster_id),
            }
        })?;

    // Build the reroute command
    let reroute_command = serde_json::json!({
        "commands": [{
            "move": {
                "index": req.index,
                "shard": req.shard,
                "from_node": req.from_node,
                "to_node": req.to_node
            }
        }]
    });

    tracing::debug!(
        cluster_id = %cluster_id,
        command = ?reroute_command,
        "Executing cluster reroute"
    );

    // Execute the reroute command
    let response = cluster
        .request(Method::POST, "/_cluster/reroute", Some(reroute_command))
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                index = %req.index,
                shard = req.shard,
                error = %e,
                "Shard relocation failed"
            );

            // Provide actionable error messages based on error type - Requirements: 8.10
            let error_str = e.to_string();
            let message = if error_str.contains("timeout") || error_str.contains("timed out") {
                "Shard relocation request timed out. The cluster may be slow or unreachable. Please check cluster health and try again.".to_string()
            } else if error_str.contains("connection") || error_str.contains("connect") {
                "Cannot connect to cluster. Please verify the cluster is running and accessible.".to_string()
            } else if error_str.contains("unauthorized") || error_str.contains("401") {
                "Authentication failed. Please check your cluster credentials.".to_string()
            } else if error_str.contains("forbidden") || error_str.contains("403") {
                "Permission denied. You may not have the required permissions to relocate shards.".to_string()
            } else {
                format!("Failed to relocate shard: {}. Please check cluster logs for more details.", e)
            };

            ClusterErrorResponse {
                error: "relocation_failed".to_string(),
                message,
            }
        })?;

    // Check response status
    let status = response.status();
    let body_bytes = response.bytes().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to read reroute response"
        );
        ClusterErrorResponse {
            error: "response_read_failed".to_string(),
            message: format!("Failed to read response: {}", e),
        }
    })?;

    // Parse response body
    let body: Value = serde_json::from_slice(&body_bytes).map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to parse reroute response"
        );
        ClusterErrorResponse {
            error: "response_parse_failed".to_string(),
            message: format!("Failed to parse response: {}", e),
        }
    })?;

    // Check if the request was successful
    if !status.is_success() {
        let error_msg = body
            .get("error")
            .and_then(|e| e.get("reason"))
            .and_then(|r| r.as_str())
            .unwrap_or("Unknown error");

        tracing::error!(
            cluster_id = %cluster_id,
            index = %req.index,
            shard = req.shard,
            status = status.as_u16(),
            error = %error_msg,
            "Elasticsearch rejected shard relocation"
        );

        // Provide actionable error messages - Requirements: 8.10
        let user_message = if error_msg.contains("no such shard")
            || error_msg.contains("shard not found")
        {
            format!("Shard {} of index '{}' not found. The shard may have been deleted or the index may not exist.", req.shard, req.index)
        } else if error_msg.contains("node not found") || error_msg.contains("unknown node") {
            format!(
                "Node '{}' or '{}' not found. One of the nodes may have left the cluster.",
                req.from_node, req.to_node
            )
        } else if error_msg.contains("already relocating") {
            format!("Shard {} of index '{}' is already being relocated. Please wait for the current relocation to complete.", req.shard, req.index)
        } else if error_msg.contains("same node") {
            "Cannot relocate shard to the same node. Please select a different destination node."
                .to_string()
        } else if error_msg.contains("allocation") {
            format!(
                "Shard allocation failed: {}. Check cluster allocation settings and node capacity.",
                error_msg
            )
        } else {
            format!(
                "Elasticsearch rejected the relocation: {}. Check cluster logs for more details.",
                error_msg
            )
        };

        return Err(ClusterErrorResponse {
            error: "elasticsearch_error".to_string(),
            message: user_message,
        });
    }

    tracing::info!(
        cluster_id = %cluster_id,
        index = %req.index,
        shard = req.shard,
        from_node = %req.from_node,
        to_node = %req.to_node,
        user_id = %user.id,
        username = %user.username,
        "Shard relocation initiated successfully"
    );

    Ok(Json(body))
}

/// Validate shard relocation request parameters
///
/// # Requirements
///
/// Validates: Requirements 6.3, 6.4, 8.1, 8.2, 8.3, 8.4
fn validate_relocation_request(req: &RelocateShardRequest) -> Result<(), ClusterErrorResponse> {
    // Validate index name is not empty
    if req.index.is_empty() {
        tracing::warn!("Validation failed: index name is empty");
        return Err(ClusterErrorResponse {
            error: "validation_failed".to_string(),
            message: "Index name is required. Please provide a valid index name.".to_string(),
        });
    }

    // Validate index name format (basic validation)
    // Elasticsearch index names must be lowercase and cannot contain certain characters
    if req.index.chars().any(|c| c.is_uppercase()) {
        tracing::warn!(index = %req.index, "Validation failed: index name contains uppercase characters");
        return Err(ClusterErrorResponse {
            error: "validation_failed".to_string(),
            message: format!(
                "Index name '{}' contains uppercase characters. Elasticsearch index names must be lowercase.",
                req.index
            ),
        });
    }

    // Check for invalid characters in index name
    let invalid_chars = ['\\', '/', '*', '?', '"', '<', '>', '|', ' ', ',', '#'];
    if let Some(invalid_char) = req.index.chars().find(|c| invalid_chars.contains(c)) {
        tracing::warn!(index = %req.index, "Validation failed: index name contains invalid characters");
        return Err(ClusterErrorResponse {
            error: "validation_failed".to_string(),
            message: format!(
                "Index name '{}' contains invalid character '{}'. Index names cannot contain: \\ / * ? \" < > | space , #",
                req.index, invalid_char
            ),
        });
    }

    // Validate from_node is not empty
    if req.from_node.is_empty() {
        tracing::warn!("Validation failed: from_node is empty");
        return Err(ClusterErrorResponse {
            error: "validation_failed".to_string(),
            message: "Source node ID is required. Please select a source node.".to_string(),
        });
    }

    // Validate to_node is not empty
    if req.to_node.is_empty() {
        tracing::warn!("Validation failed: to_node is empty");
        return Err(ClusterErrorResponse {
            error: "validation_failed".to_string(),
            message: "Destination node ID is required. Please select a destination node."
                .to_string(),
        });
    }

    // Validate source and destination are different
    if req.from_node == req.to_node {
        tracing::warn!(
            from_node = %req.from_node,
            to_node = %req.to_node,
            "Validation failed: source and destination nodes are the same"
        );
        return Err(ClusterErrorResponse {
            error: "validation_failed".to_string(),
            message: format!(
                "Source and destination nodes must be different (both are {}). Please select a different destination node.",
                req.from_node
            ),
        });
    }

    tracing::debug!(
        index = %req.index,
        shard = req.shard,
        from_node = %req.from_node,
        to_node = %req.to_node,
        "Request validation passed"
    );

    Ok(())
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

    #[test]
    fn test_relocate_shard_request_serialization() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"index\":\"test-index\""));
        assert!(json.contains("\"shard\":0"));
        assert!(json.contains("\"from_node\":\"node-1\""));
        assert!(json.contains("\"to_node\":\"node-2\""));
    }

    #[test]
    fn test_relocate_shard_request_deserialization() {
        let json = r#"{"index":"logs-2024","shard":1,"from_node":"node-a","to_node":"node-b"}"#;
        let req: RelocateShardRequest = serde_json::from_str(json).unwrap();

        assert_eq!(req.index, "logs-2024");
        assert_eq!(req.shard, 1);
        assert_eq!(req.from_node, "node-a");
        assert_eq!(req.to_node, "node-b");
    }

    #[test]
    fn test_validate_relocation_request_valid() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };

        let result = validate_relocation_request(&req);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_relocation_request_empty_index() {
        let req = RelocateShardRequest {
            index: "".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };

        let result = validate_relocation_request(&req);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("Index name is required"));
    }

    #[test]
    fn test_validate_relocation_request_uppercase_index() {
        let req = RelocateShardRequest {
            index: "Test-Index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };

        let result = validate_relocation_request(&req);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("lowercase"));
    }

    #[test]
    fn test_validate_relocation_request_invalid_chars() {
        let invalid_indices = vec![
            "test index",  // space
            "test/index",  // slash
            "test\\index", // backslash
            "test*index",  // asterisk
            "test?index",  // question mark
            "test\"index", // quote
            "test<index",  // less than
            "test>index",  // greater than
            "test|index",  // pipe
            "test,index",  // comma
            "test#index",  // hash
        ];

        for index in invalid_indices {
            let req = RelocateShardRequest {
                index: index.to_string(),
                shard: 0,
                from_node: "node-1".to_string(),
                to_node: "node-2".to_string(),
            };

            let result = validate_relocation_request(&req);
            assert!(
                result.is_err(),
                "Expected validation to fail for index: {}",
                index
            );
        }
    }

    #[test]
    fn test_validate_relocation_request_empty_from_node() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "".to_string(),
            to_node: "node-2".to_string(),
        };

        let result = validate_relocation_request(&req);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("Source node ID is required"));
    }

    #[test]
    fn test_validate_relocation_request_empty_to_node() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "".to_string(),
        };

        let result = validate_relocation_request(&req);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("Destination node ID is required"));
    }

    #[test]
    fn test_validate_relocation_request_same_nodes() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-1".to_string(),
        };

        let result = validate_relocation_request(&req);
        assert!(result.is_err());
        let err = result.unwrap_err();
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("must be different"));
    }

    #[test]
    fn test_validate_relocation_request_valid_index_names() {
        let valid_indices = vec![
            "test-index",
            "logs-2024.01.01",
            "my_index",
            "index123",
            "a",
            "test.index.name",
        ];

        for index in valid_indices {
            let req = RelocateShardRequest {
                index: index.to_string(),
                shard: 0,
                from_node: "node-1".to_string(),
                to_node: "node-2".to_string(),
            };

            let result = validate_relocation_request(&req);
            assert!(
                result.is_ok(),
                "Expected validation to pass for index: {}",
                index
            );
        }
    }
}
