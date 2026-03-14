use crate::auth::middleware::AuthenticatedUser;
use crate::cluster::{ClusterInfo, ElasticsearchClient, Manager as ClusterManager};
use axum::{
    extract::{Path, Query, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;

mod pagination;
pub mod tasks;
mod transform;

use pagination::{paginate_vec, PaginatedResponse};
use transform::{
    transform_cluster_stats, transform_indices_from_cat, transform_node_detail_stats,
    transform_nodes, transform_shards, ClusterStatsResponse, IndexInfoResponse,
    NodeDetailStatsResponse, NodeInfoResponse, ShardInfoResponse,
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
/// Returns a list of all clusters with filtering and pagination
///
/// # Requirements
///
/// Validates: Requirements 2.15
#[derive(Debug, Deserialize)]
pub struct ClustersQueryParams {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub health: String, // comma-separated: green,yellow,red
    #[serde(default)]
    pub version: String,
}

pub async fn list_clusters(
    State(state): State<ClusterState>,
    Query(params): Query<ClustersQueryParams>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<PaginatedResponse<ClusterInfo>>, ClusterErrorResponse> {
    tracing::debug!(
        page = params.page,
        page_size = params.page_size,
        search = %params.search,
        health = %params.health,
        version = %params.version,
        "Listing clusters with filters"
    );

    // Get all clusters from manager
    let all_clusters = state.cluster_manager.list_clusters().await;

    // Extract authenticated user if available (Open mode may not have it)
    let Some(user) = user_ext else {
        tracing::debug!("No authenticated user, returning all clusters (Open mode)");
        // Apply filters even in open mode
        let filtered = filter_clusters(&all_clusters, &params);
        let response = paginate_vec(filtered, params.page as usize, params.page_size as usize);
        return Ok(Json(response));
    };

    tracing::debug!(
        user = %user.0.0.username,
        accessible_clusters = ?user.0.0.accessible_clusters,
        "Filtering clusters for user"
    );

    // Filter clusters based on user's accessible clusters
    let user_filtered = filter_clusters_by_access(&all_clusters, &user.0 .0.accessible_clusters);

    // Apply additional filters
    let filtered = filter_clusters(&user_filtered, &params);

    tracing::debug!(
        total = all_clusters.len(),
        accessible = user_filtered.len(),
        filtered = filtered.len(),
        "Returning filtered cluster list"
    );

    // Fetch actual cluster names and stats for filtered clusters
    let mut result_clusters = Vec::new();
    for cluster_info in filtered {
        if let Ok(cluster) = state.cluster_manager.get_cluster(&cluster_info.id).await {
            // Get health for health filter
            let health = cluster.health().await.ok();

            // Get version for version filter
            let version = cluster.client.es_version();

            // Fetch cluster name if not in config
            let cluster_name = cluster_info
                .name
                .clone()
                .or_else(|| {
                    health
                        .as_ref()
                        .and_then(|h: &serde_json::Value| h["cluster_name"].as_str())
                        .map(|s| s.to_string())
                })
                .unwrap_or(cluster_info.id.clone());

            result_clusters.push(ClusterInfo {
                id: cluster_info.id,
                name: Some(cluster_name),
                nodes: cluster_info.nodes,
                accessible: cluster_info.accessible,
                es_version: version,
                metrics_source: cluster_info.metrics_source,
            });
        }
    }

    // Apply pagination
    let response = paginate_vec(
        result_clusters,
        params.page as usize,
        params.page_size as usize,
    );

    tracing::debug!(
        total = response.total,
        page_items = response.items.len(),
        "Clusters retrieved successfully"
    );

    Ok(Json(response))
}

/// Apply filters to clusters list
fn filter_clusters(clusters: &[ClusterInfo], params: &ClustersQueryParams) -> Vec<ClusterInfo> {
    let _health_filter: Vec<&str> = params.health.split(',').filter(|s| !s.is_empty()).collect();

    clusters
        .iter()
        .filter(|cluster| {
            // Search filter (cluster name or ID)
            if !params.search.is_empty() {
                let search_lower = params.search.to_lowercase();
                let matches_name = cluster
                    .name
                    .as_ref()
                    .map(|n| n.to_lowercase().contains(&search_lower))
                    .unwrap_or(false);
                let matches_id = cluster.id.to_lowercase().contains(&search_lower);
                if !matches_name && !matches_id {
                    return false;
                }
            }

            // Health filter - would need to fetch health for each cluster
            // For now, skip health filtering at this level (done in frontend or with cached stats)

            // Version filter
            if !params.version.is_empty() {
                let version_str = cluster.es_version.to_string();
                if !version_str.contains(&params.version) {
                    return false;
                }
            }

            true
        })
        .cloned()
        .collect()
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

    // Get nodes stats for CPU metrics
    let nodes_stats = cluster.nodes_stats().await.unwrap_or_else(|e| {
        tracing::warn!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get nodes stats, CPU metrics will be unavailable"
        );
        serde_json::Value::Object(serde_json::Map::new())
    });

    // Fetch Prometheus metrics for all nodes if Prometheus is configured
    let prometheus_node_metrics = if matches!(
        cluster.metrics_source,
        crate::config::MetricsSource::Prometheus
    ) {
        if let Some(prom_config) = &cluster.prometheus {
            // Create Prometheus client
            match crate::prometheus::client::Client::new(
                crate::prometheus::client::PrometheusConfig {
                    url: prom_config.url.clone(),
                    auth: None,
                    timeout: std::time::Duration::from_secs(10),
                },
            ) {
                Ok(prom_client) => {
                    // Build query for all nodes
                    let labels_query = if let Some(labels) = &prom_config.labels {
                        let extra: Vec<String> = labels
                            .iter()
                            .map(|(k, v)| format!("{}=\"{}\"", k, v))
                            .collect();
                        if extra.is_empty() {
                            String::new()
                        } else {
                            extra.join(",")
                        }
                    } else {
                        String::new()
                    };

                    // Query CPU, memory, and load averages for all nodes
                    let cpu_query = format!("elasticsearch_os_cpu_percent{{{}}}", labels_query);
                    let mem_query =
                        format!("elasticsearch_jvm_memory_used_bytes{{{}}}", labels_query);
                    let load1_query = format!("elasticsearch_os_load1{{{}}}", labels_query);
                    let load5_query = format!("elasticsearch_os_load5{{{}}}", labels_query);
                    let load15_query = format!("elasticsearch_os_load15{{{}}}", labels_query);

                    // Execute queries in parallel
                    let now = chrono::Utc::now().timestamp();
                    let cpu_fut = prom_client.query_instant(&cpu_query, Some(now));
                    let mem_fut = prom_client.query_instant(&mem_query, Some(now));
                    let load1_fut = prom_client.query_instant(&load1_query, Some(now));
                    let load5_fut = prom_client.query_instant(&load5_query, Some(now));
                    let load15_fut = prom_client.query_instant(&load15_query, Some(now));

                    let (cpu_result, mem_result, load1_result, load5_result, load15_result) =
                        tokio::join!(cpu_fut, mem_fut, load1_fut, load5_fut, load15_fut);

                    // Build map: node_name -> {cpu_percent, memory_used_bytes, load1, load5, load15}
                    let mut metrics_map: std::collections::HashMap<String, serde_json::Value> =
                        std::collections::HashMap::new();

                    // Log errors if queries failed
                    if let Err(ref e) = cpu_result {
                        tracing::error!(cluster_id = %cluster_id, error = %e, "CPU query failed");
                    }
                    if let Err(ref e) = mem_result {
                        tracing::error!(cluster_id = %cluster_id, error = %e, "Memory query failed");
                    }

                    tracing::debug!(
                        cluster_id = %cluster_id,
                        cpu_query = %cpu_query,
                        mem_query = %mem_query,
                        cpu_ok = cpu_result.is_ok(),
                        mem_ok = mem_result.is_ok(),
                        "Prometheus query results"
                    );

                    if let Ok(cpu_series) = cpu_result {
                        tracing::debug!(
                            cluster_id = %cluster_id,
                            series_count = cpu_series.len(),
                            "CPU metrics series"
                        );
                        for series in cpu_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let cpu_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    tracing::debug!(
                                        cluster_id = %cluster_id,
                                        node = %name,
                                        cpu = cpu_val,
                                        "Found CPU metric for node"
                                    );
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "cpu_percent".to_string(),
                                            serde_json::json!(cpu_val),
                                        );
                                    }
                                }
                            } else {
                                tracing::warn!(
                                    cluster_id = %cluster_id,
                                    metric = ?series.metric,
                                    "CPU metric missing node identifier label"
                                );
                            }
                        }
                    }

                    if let Ok(mem_series) = mem_result {
                        for series in mem_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let mem_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "memory_used_bytes".to_string(),
                                            serde_json::json!((mem_val as u64)),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Process load1 metrics
                    if let Ok(load1_series) = load1_result {
                        for series in load1_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let load1_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "load1".to_string(),
                                            serde_json::json!(load1_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Process load5 metrics
                    if let Ok(load5_series) = load5_result {
                        for series in load5_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let load5_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "load5".to_string(),
                                            serde_json::json!(load5_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Process load15 metrics
                    if let Ok(load15_series) = load15_result {
                        for series in load15_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let load15_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "load15".to_string(),
                                            serde_json::json!(load15_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Debug: Print actual metric values
                    tracing::debug!(
                        cluster_id = %cluster_id,
                        cpu_query = %cpu_query,
                        mem_query = %mem_query,
                        "Prometheus queries executed"
                    );
                    for (node_name, metrics) in &metrics_map {
                        tracing::debug!(
                            cluster_id = %cluster_id,
                            node = %node_name,
                            metrics = %metrics,
                            "Prometheus metrics for node"
                        );
                    }

                    tracing::debug!(
                        cluster_id = %cluster_id,
                        nodes_with_metrics = metrics_map.len(),
                        "Fetched Prometheus metrics for cluster overview"
                    );

                    if metrics_map.is_empty() {
                        tracing::warn!(
                            cluster_id = %cluster_id,
                            "No Prometheus metrics found for any nodes - check metric names and labels"
                        );
                    }

                    Some(metrics_map)
                }
                Err(e) => {
                    tracing::warn!(
                        cluster_id = %cluster_id,
                        error = %e,
                        "Failed to create Prometheus client for cluster overview"
                    );
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };

    tracing::debug!(
        cluster_id = %cluster_id,
        has_prometheus_metrics = prometheus_node_metrics.is_some(),
        metrics_count = prometheus_node_metrics.as_ref().map(|m| m.len()).unwrap_or(0),
        "Prometheus metrics before transform"
    );

    // Get cluster version from the info endpoint
    let es_version: Option<String> = cluster.client.info().await.ok().and_then(|info| {
        info["version"]["number"]
            .as_str()
            .map(|v| format!("v{}", v))
    });

    // Combine stats with nodes_stats for transform
    let mut combined_stats = stats.clone();
    combined_stats["nodes_stats"] = nodes_stats.clone();

    // Transform to frontend format
    let response = transform_cluster_stats(
        &combined_stats,
        &health,
        es_version,
        prometheus_node_metrics.as_ref(),
    )
    .map_err(|e| {
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

/// Get cluster settings
///
/// Returns cluster settings in JSON format
/// Optionally includes default settings with `include_defaults` query parameter
pub async fn get_cluster_settings(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
    Query(params): Query<std::collections::HashMap<String, String>>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    let include_defaults = params.contains_key("include_defaults");

    tracing::debug!(
        cluster_id = %cluster_id,
        include_defaults = %include_defaults,
        "Getting cluster settings"
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

    // Get cluster settings
    let settings = cluster
        .client
        .cluster_settings(include_defaults)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "Failed to get cluster settings"
            );
            ClusterErrorResponse {
                error: "settings_failed".to_string(),
                message: format!("Failed to get cluster settings: {}", e),
            }
        })?;

    tracing::debug!(
        cluster_id = %cluster_id,
        "Cluster settings retrieved successfully"
    );

    Ok(Json(settings))
}

/// Update cluster settings
///
/// Updates persistent and/or transient cluster settings
/// Only modified settings need to be provided in the request body
pub async fn update_cluster_settings(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
    Json(request): Json<ClusterSettingsUpdateRequest>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        "Updating cluster settings"
    );

    // Check cluster access
    check_cluster_access(&cluster_id, &user_ext)?;

    // Get the cluster (verify it exists)
    let _cluster = state
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

    // Build request body for Elasticsearch
    let mut settings_body = serde_json::Map::new();

    // Add persistent settings if provided
    if let Some(persistent) = request.persistent {
        settings_body.insert("persistent".to_string(), persistent);
    }

    // Add transient settings if provided
    if let Some(transient) = request.transient {
        settings_body.insert("transient".to_string(), transient);
    }

    if settings_body.is_empty() {
        return Err(ClusterErrorResponse {
            error: "no_settings".to_string(),
            message: "At least one of 'persistent' or 'transient' settings must be provided"
                .to_string(),
        });
    }

    // Update cluster settings via cluster manager proxy request
    let response = state
        .cluster_manager
        .proxy_request(
            &cluster_id,
            Method::PUT,
            "/_cluster/settings",
            Some(serde_json::Value::Object(settings_body)),
        )
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "Failed to update cluster settings"
            );
            ClusterErrorResponse {
                error: "update_failed".to_string(),
                message: format!("Failed to update cluster settings: {}", e),
            }
        })?;

    let response_value = response.json::<Value>().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to parse update response"
        );
        ClusterErrorResponse {
            error: "parse_failed".to_string(),
            message: format!("Failed to parse update response: {}", e),
        }
    })?;

    tracing::info!(
        cluster_id = %cluster_id,
        "Cluster settings updated successfully"
    );

    Ok(Json(response_value))
}

/// Request body for updating cluster settings
#[derive(Debug, Deserialize)]
pub struct ClusterSettingsUpdateRequest {
    /// Persistent settings (survive cluster restarts)
    pub persistent: Option<Value>,
    /// Transient settings (do not survive cluster restarts)
    pub transient: Option<Value>,
}

/// Get nodes information using SDK typed methods with pagination
///
/// Returns paginated nodes info in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.6, 14.1, 14.2
#[derive(Debug, Deserialize)]
pub struct NodesQueryParams {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[serde(default)]
    pub search: String,
    pub roles: Option<String>, // comma-separated: master,data,ingest; None = not set, Some("") = explicitly empty
}

pub async fn get_nodes(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<NodesQueryParams>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<PaginatedResponse<NodeInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        page = params.page,
        page_size = params.page_size,
        search = %params.search,
        roles = ?params.roles,
        "Getting nodes with filters"
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

    // Get master node ID using lightweight _cat/master API instead of full cluster state
    let master_node_id = match cluster.cat_master().await {
        Ok(master_id) => Some(master_id),
        Err(e) => {
            tracing::warn!(
                cluster_id = %cluster_id,
                error = %e,
                "Failed to get master node ID"
            );
            None
        }
    };

    // Fetch Prometheus metrics for all nodes if Prometheus is configured
    let prometheus_node_metrics = if matches!(
        cluster.metrics_source,
        crate::config::MetricsSource::Prometheus
    ) {
        if let Some(prom_config) = &cluster.prometheus {
            // Create Prometheus client
            match crate::prometheus::client::Client::new(
                crate::prometheus::client::PrometheusConfig {
                    url: prom_config.url.clone(),
                    auth: None,
                    timeout: std::time::Duration::from_secs(10),
                },
            ) {
                Ok(prom_client) => {
                    // Build query for all nodes
                    let labels_query = if let Some(labels) = &prom_config.labels {
                        let extra: Vec<String> = labels
                            .iter()
                            .map(|(k, v)| format!("{}=\"{}\"", k, v))
                            .collect();
                        if extra.is_empty() {
                            String::new()
                        } else {
                            extra.join(",")
                        }
                    } else {
                        String::new()
                    };

                    // Query CPU, memory, and load averages for all nodes
                    let cpu_query = format!("elasticsearch_os_cpu_percent{{{}}}", labels_query);
                    let mem_query =
                        format!("elasticsearch_jvm_memory_used_bytes{{{}}}", labels_query);
                    let load1_query = format!("elasticsearch_os_load1{{{}}}", labels_query);
                    let load5_query = format!("elasticsearch_os_load5{{{}}}", labels_query);
                    let load15_query = format!("elasticsearch_os_load15{{{}}}", labels_query);

                    // Execute queries in parallel
                    let now = chrono::Utc::now().timestamp();
                    let cpu_fut = prom_client.query_instant(&cpu_query, Some(now));
                    let mem_fut = prom_client.query_instant(&mem_query, Some(now));
                    let load1_fut = prom_client.query_instant(&load1_query, Some(now));
                    let load5_fut = prom_client.query_instant(&load5_query, Some(now));
                    let load15_fut = prom_client.query_instant(&load15_query, Some(now));

                    let (cpu_result, mem_result, load1_result, load5_result, load15_result) =
                        tokio::join!(cpu_fut, mem_fut, load1_fut, load5_fut, load15_fut);

                    // Build map: node_name -> {cpu_percent, memory_used_bytes}
                    let mut metrics_map: std::collections::HashMap<String, serde_json::Value> =
                        std::collections::HashMap::new();

                    if let Ok(cpu_series) = cpu_result {
                        for series in cpu_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let cpu_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "cpu_percent".to_string(),
                                            serde_json::json!(cpu_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    if let Ok(mem_series) = mem_result {
                        for series in mem_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let mem_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "memory_used_bytes".to_string(),
                                            serde_json::json!((mem_val as u64)),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Process load1 metrics
                    if let Ok(load1_series) = load1_result {
                        for series in load1_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let load1_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "load1".to_string(),
                                            serde_json::json!(load1_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Process load5 metrics
                    if let Ok(load5_series) = load5_result {
                        for series in load5_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let load5_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "load5".to_string(),
                                            serde_json::json!(load5_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    // Process load15 metrics
                    if let Ok(load15_series) = load15_result {
                        for series in load15_series {
                            // Try multiple possible label names for node identification
                            let name_opt: Option<&str> = series
                                .metric
                                .get("name")
                                .or_else(|| series.metric.get("node"))
                                .or_else(|| series.metric.get("nodename"))
                                .or_else(|| series.metric.get("instance"))
                                .map(|v| v.as_str());
                            if let Some(name) = name_opt {
                                if let Some(values) = &series.value {
                                    let load15_val = values.1.parse::<f64>().unwrap_or(0.0);
                                    let entry = metrics_map
                                        .entry(name.to_string())
                                        .or_insert_with(|| serde_json::json!({}));
                                    if let Some(obj) = entry.as_object_mut() {
                                        obj.insert(
                                            "load15".to_string(),
                                            serde_json::json!(load15_val),
                                        );
                                    }
                                }
                            }
                        }
                    }

                    tracing::debug!(
                        cluster_id = %cluster_id,
                        nodes_with_metrics = metrics_map.len(),
                        "Fetched Prometheus metrics for nodes"
                    );

                    Some(metrics_map)
                }
                Err(e) => {
                    tracing::warn!(
                        cluster_id = %cluster_id,
                        error = %e,
                        "Failed to create Prometheus client for node metrics"
                    );
                    None
                }
            }
        } else {
            None
        }
    } else {
        None
    };

    // Transform to frontend format
    let all_nodes = transform_nodes(
        &nodes_info,
        &nodes_stats,
        master_node_id.as_deref(),
        prometheus_node_metrics.as_ref(),
    );

    // Apply filters
    // Roles filter: None = not set (show all), Some("") = explicitly empty (show none), Some("x,y") = filter by roles
    let roles_filter: Option<Vec<&str>> = params.roles.as_ref().map(|r| {
        let filtered: Vec<&str> = r.split(',').filter(|s| !s.is_empty()).collect();
        filtered
    });

    let filtered_nodes: Vec<NodeInfoResponse> = all_nodes
        .into_iter()
        .filter(|node| {
            // Search filter (name, IP)
            if !params.search.is_empty() {
                let search_lower = params.search.to_lowercase();
                let matches_name = node.name.to_lowercase().contains(&search_lower);
                let matches_ip = node
                    .ip
                    .as_ref()
                    .map(|ip| ip.to_lowercase().contains(&search_lower))
                    .unwrap_or(false);
                if !matches_name && !matches_ip {
                    return false;
                }
            }

            // Roles filter
            // - None: filter not set, show all nodes
            // - Some([]): explicitly empty, filter out all nodes
            // - Some([...]): filter by specified roles
            match &roles_filter {
                None => {} // No filter set, show all
                Some(roles) if roles.is_empty() => {
                    // Explicitly empty filter - no nodes should match
                    return false;
                }
                Some(roles) => {
                    let has_matching_role =
                        node.roles.iter().any(|role| roles.contains(&role.as_str()));
                    if !has_matching_role {
                        return false;
                    }
                }
            }

            true
        })
        .collect();

    tracing::debug!(
        cluster_id = %cluster_id,
        total = filtered_nodes.len(),
        "Nodes filtered"
    );

    // Apply pagination
    let response = paginate_vec(
        filtered_nodes,
        params.page as usize,
        params.page_size as usize,
    );

    tracing::debug!(
        cluster_id = %cluster_id,
        total_nodes = response.total,
        page_nodes = response.items.len(),
        page = params.page,
        page_size = params.page_size,
        master_node = ?master_node_id,
        "Nodes retrieved successfully"
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

    // Get shards for data nodes using lightweight _cat/shards API
    // Note: _cat/shards API uses node NAMES, not node IDs for filtering
    let node_name = nodes_info["nodes"][&node_id]["name"].as_str();
    tracing::debug!(
        cluster_id = %cluster_id,
        node_id = %node_id,
        node_name = ?node_name,
        "Looking up node for shard stats"
    );
    let shards = if let Some(node_info) = nodes_info["nodes"][&node_id].as_object() {
        if let Some(roles) = node_info.get("roles").and_then(|r| r.as_array()) {
            let has_data_role = roles.iter().any(|r| r.as_str() == Some("data"));
            tracing::debug!(
                cluster_id = %cluster_id,
                node_id = %node_id,
                has_data_role = has_data_role,
                "Checking if node has data role"
            );
            if has_data_role {
                if let Some(name) = node_name {
                    tracing::debug!(
                        cluster_id = %cluster_id,
                        node_id = %node_id,
                        node_name = %name,
                        "Fetching shards for node"
                    );
                    match cluster.cat_shards_for_node(name).await {
                        Ok(shards_data) => {
                            let count = shards_data.as_array().map(|a| a.len()).unwrap_or(0);
                            tracing::debug!(
                                cluster_id = %cluster_id,
                                node_id = %node_id,
                                node_name = %name,
                                shard_count = count,
                                "Successfully fetched shards for node"
                            );
                            Some(shards_data)
                        }
                        Err(e) => {
                            tracing::warn!(
                                cluster_id = %cluster_id,
                                node_id = %node_id,
                                node_name = %name,
                                error = %e,
                                "Failed to get shards for node"
                            );
                            None
                        }
                    }
                } else {
                    tracing::warn!(
                        cluster_id = %cluster_id,
                        node_id = %node_id,
                        "Node name not found, cannot fetch shards"
                    );
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    } else {
        tracing::warn!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            "Node not found in nodes_info"
        );
        None
    };

    // Transform to frontend format (dummy cluster_state for compatibility)
    let dummy_cluster_state = serde_json::json!({});
    let response = transform_node_detail_stats(
        &node_id,
        &nodes_info,
        &node_stats,
        &dummy_cluster_state,
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

/// Get indices information using SDK typed methods with pagination
///
/// Returns paginated indices info in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.7
#[derive(Debug, Deserialize)]
pub struct IndicesQueryParams {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[serde(default)]
    pub search: String,
    #[serde(default)]
    pub health: String, // comma-separated: green,yellow,red
    #[serde(default)]
    pub status: String, // comma-separated: open,close
    #[serde(default)]
    pub show_special: bool, // show indices starting with .
    #[serde(default)]
    pub affected: bool, // show only indices with problems
}

fn default_page() -> u32 {
    1
}
fn default_page_size() -> u32 {
    50
}

pub async fn get_indices(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<IndicesQueryParams>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<PaginatedResponse<IndexInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        page = params.page,
        page_size = params.page_size,
        search = %params.search,
        health = %params.health,
        status = %params.status,
        show_special = params.show_special,
        affected = params.affected,
        "Getting indices with filters"
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

    // Use lightweight _cat/indices API instead of heavy _stats API
    // This is MUCH faster for large clusters with many indices
    let cat_indices = cluster.cat_indices().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get indices information"
        );
        ClusterErrorResponse {
            error: "indices_failed".to_string(),
            message: format!("Failed to get indices information: {}", e),
        }
    })?;

    // Transform to frontend format
    let all_indices = transform_indices_from_cat(&cat_indices);

    // Apply filters
    let health_filter: Vec<&str> = params.health.split(',').filter(|s| !s.is_empty()).collect();
    let status_filter: Vec<&str> = params.status.split(',').filter(|s| !s.is_empty()).collect();

    let filtered_indices: Vec<IndexInfoResponse> = all_indices
        .into_iter()
        .filter(|index| {
            // Search filter
            if !params.search.is_empty()
                && !index
                    .name
                    .to_lowercase()
                    .contains(&params.search.to_lowercase())
            {
                return false;
            }

            // Health filter
            if !health_filter.is_empty() && !health_filter.contains(&index.health.as_str()) {
                return false;
            }

            // Status filter
            if !status_filter.is_empty() && !status_filter.contains(&index.status.as_str()) {
                return false;
            }

            // Special indices filter
            if !params.show_special && index.name.starts_with('.') {
                return false;
            }

            // Note: "affected" filter removed - requires shard-level data which is expensive
            // Users can use shards view with index filter instead

            true
        })
        .collect();

    tracing::debug!(
        cluster_id = %cluster_id,
        total = filtered_indices.len(),
        "Indices filtered"
    );

    // Apply pagination
    let response = paginate_vec(
        filtered_indices,
        params.page as usize,
        params.page_size as usize,
    );

    tracing::debug!(
        cluster_id = %cluster_id,
        total_indices = response.total,
        page_indices = response.items.len(),
        page = params.page,
        page_size = params.page_size,
        "Indices retrieved successfully"
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

/// Get shards information for a cluster with pagination and filtering
///
/// # Requirements
///
/// Validates: Requirements 4.8
#[derive(Debug, Deserialize)]
pub struct ShardsQueryParams {
    #[serde(default = "default_page")]
    pub page: u32,
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[serde(default)]
    pub state: String, // comma-separated: UNASSIGNED,STARTED,etc
    #[serde(default)]
    pub index: String,
    #[serde(default)]
    pub node: String,
    #[serde(default)]
    pub search: String, // search both index and node (OR logic)
}

pub async fn get_shards(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<ShardsQueryParams>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<PaginatedResponse<ShardInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        page = params.page,
        page_size = params.page_size,
        state = %params.state,
        index = %params.index,
        node = %params.node,
        search = %params.search,
        "Getting shards with filters"
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

    // Use _cat/shards API for memory-efficient shard retrieval
    let cat_shards = cluster.cat_shards().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get shard information"
        );
        ClusterErrorResponse {
            error: "shards_failed".to_string(),
            message: format!("Failed to get shard information: {}", e),
        }
    })?;

    // Transform to frontend format
    let all_shards = transform_shards(&cat_shards);

    // Apply filters
    let state_filter: Vec<&str> = params.state.split(',').filter(|s| !s.is_empty()).collect();

    let filtered_shards: Vec<ShardInfoResponse> = all_shards
        .into_iter()
        .filter(|shard| {
            // State filter
            if !state_filter.is_empty() && !state_filter.contains(&shard.state.as_str()) {
                return false;
            }

            // Search filter (OR logic: matches either index OR node)
            if !params.search.is_empty() {
                let search_lower = params.search.to_lowercase();
                let index_matches = shard.index.to_lowercase().contains(&search_lower);
                let node_matches = shard
                    .node
                    .as_deref()
                    .unwrap_or("")
                    .to_lowercase()
                    .contains(&search_lower);

                if !index_matches && !node_matches {
                    return false;
                }
            }

            // Index filter (substring match) - only if search is not used
            if params.search.is_empty()
                && !params.index.is_empty()
                && !shard
                    .index
                    .to_lowercase()
                    .contains(&params.index.to_lowercase())
            {
                return false;
            }

            // Node filter (substring match on node name) - only if search is not used
            if params.search.is_empty() && !params.node.is_empty() {
                let node_name = shard.node.as_deref().unwrap_or("");
                if !node_name
                    .to_lowercase()
                    .contains(&params.node.to_lowercase())
                {
                    return false;
                }
            }

            true
        })
        .collect();

    tracing::debug!(
        cluster_id = %cluster_id,
        total = filtered_shards.len(),
        "Shards filtered"
    );

    // Apply pagination
    let response = paginate_vec(
        filtered_shards,
        params.page as usize,
        params.page_size as usize,
    );

    tracing::debug!(
        cluster_id = %cluster_id,
        total_shards = response.total,
        page_shards = response.items.len(),
        page = params.page,
        page_size = params.page_size,
        "Shards retrieved successfully"
    );

    Ok(Json(response))
}

/// Get shards allocated on a specific node
///
/// Returns shard information for shards on the specified node only.
/// This is more efficient than fetching all shards and filtering client-side.
///
/// # Requirements
///
/// Validates: Requirements 4.8
pub async fn get_node_shards(
    State(state): State<ClusterState>,
    Path((cluster_id, node_id)): Path<(String, String)>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Vec<ShardInfoResponse>>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        node_id = %node_id,
        "Getting shards for node"
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

    // Use _cat/shards API with node filter for efficient retrieval
    let cat_shards = cluster.cat_shards_for_node(&node_id).await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            error = %e,
            "Failed to get shard information for node"
        );
        ClusterErrorResponse {
            error: "shards_failed".to_string(),
            message: format!("Failed to get shard information: {}", e),
        }
    })?;

    // Transform to frontend format
    let shards = transform_shards(&cat_shards);

    tracing::debug!(
        cluster_id = %cluster_id,
        node_id = %node_id,
        shard_count = shards.len(),
        "Node shards retrieved successfully"
    );

    Ok(Json(shards))
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
        "PROXY: Starting Elasticsearch request"
    );

    // TODO: Extract authenticated user from request
    // TODO: Check RBAC authorization

    tracing::debug!(
        cluster_id = %cluster_id,
        "PROXY: Getting cluster connection"
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

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        "PROXY: Sending request to Elasticsearch"
    );

    // Proxy the request with timeout
    let response = tokio::time::timeout(
        std::time::Duration::from_secs(30),
        cluster.request(method.clone(), &full_path, body.map(|j| j.0)),
    )
    .await
    .map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            method = %method,
            path = %full_path,
            error = %e,
            "PROXY TIMEOUT: Elasticsearch request timed out"
        );
        ClusterErrorResponse {
            error: "proxy_timeout".to_string(),
            message: format!(
                "Elasticsearch request timed out: {} {} (timeout: 30s)",
                method, full_path,
            ),
        }
    })?
    .map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            method = %method,
            path = %full_path,
            error = %e,
            "PROXY FAILED: Elasticsearch API request failed"
        );
        ClusterErrorResponse {
            error: "proxy_failed".to_string(),
            message: format!(
                "Elasticsearch request failed: {} {} - {}",
                method, full_path, e
            ),
        }
    })?;

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        status = %response.status(),
        "PROXY: Elasticsearch response received"
    );

    // Convert reqwest::Response to axum::Response
    let status = response.status();
    let headers = response.headers().clone();

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        "PROXY: Reading response body..."
    );

    // Read response body with timeout
    let body_bytes = tokio::time::timeout(std::time::Duration::from_secs(10), response.bytes())
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "PROXY: Timeout reading response body"
            );
            ClusterErrorResponse {
                error: "response_read_timeout".to_string(),
                message: "Timeout reading Elasticsearch response body".to_string(),
            }
        })?
        .map_err(|e| {
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

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        bytes = body_bytes.len(),
        "PROXY: Response body read successfully"
    );

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

    // Copy headers from Elasticsearch response, filtering out HTTP/2 specific headers
    let mut has_content_type = false;
    for (key, value) in headers.iter() {
        let key_lower = key.to_string().to_lowercase();

        // Skip HTTP/2 pseudo-headers and connection-specific headers
        if key_lower.starts_with(':')
            || key_lower == "connection"
            || key_lower == "transfer-encoding"
            || key_lower == "keep-alive"
        {
            continue;
        }

        if key_lower == "content-type" {
            has_content_type = true;
        }

        axum_response = axum_response.header(key, value);
    }

    // Ensure we have a content-type header
    if !has_content_type {
        axum_response = axum_response.header("content-type", "application/json");
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

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        "PROXY: Response sent to client"
    );

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
