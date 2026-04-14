use crate::auth::middleware::AuthenticatedUser;
use crate::cache::MetadataCache;
use crate::cluster::{ClusterInfo, Manager as ClusterManager};
use crate::middleware::logging::RequestId;
use anyhow::Context;
// InstrumentedElasticsearchClient is used by ClusterConnection/Client but
// after migrating handlers to Manager::proxy_request_with_audit it's no
// longer directly referenced in this file. Keep import commented for now.
use axum::{
    extract::{Extension, Path, Query, State},
    http::{Method, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use moka::future::Cache as MokaCache;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tokio::sync::Semaphore;
use tracing::instrument;
use utoipa::{IntoParams, ToSchema};

mod pagination;
pub mod tasks;
pub mod transform;

use pagination::{paginate_vec, PaginatedResponse};
use transform::{
    aggregate_shards_by_node, transform_cluster_stats, transform_indices_from_cat,
    transform_node_detail_stats, transform_nodes, transform_routing_nodes_to_shards,
    transform_shards, ClusterStatsResponse, IndexInfoResponse, NodeDetailStatsResponse,
    NodeInfoResponse, NodeShardSummary, PaginatedShardsResponse, PaginatedShardsWithNodes,
    ShardInfoResponse,
};

/// Shared application state for cluster routes
#[derive(Clone)]
pub struct ClusterState {
    pub cluster_manager: Arc<ClusterManager>,
    /// Cache for per-cluster details responses (TTL configured by server)
    pub details_cache: Arc<MetadataCache<serde_json::Value>>,
    /// Concurrency limiter for per-cluster detail fan-outs
    pub details_semaphore: Arc<Semaphore>,
    /// Cache for generated topology tiles (per-cluster)
    /// Uses moka::future::Cache for TTL + capacity (LRU-ish) semantics.
    pub tile_cache: Arc<MokaCache<String, serde_json::Value>>,
    /// Maximum number of tiles allowed per /topology/tiles request
    pub topology_max_tiles_per_request: usize,
    /// Semaphore limiting concurrent uncached topology generation tasks across the server
    pub topology_generation_semaphore: Arc<Semaphore>,
    /// Timeout (in seconds) to wait for a generation permit before returning an error.
    /// Default: 8 seconds when not configured.
    pub topology_generation_acquire_timeout_seconds: u64,
    /// Whether to emit structured audit entries for proxied Elasticsearch calls
    pub audit_log: bool,
}

/// Error response for cluster operations
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClusterErrorResponse {
    pub error: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accessible_reason: Option<String>,
}

impl ClusterErrorResponse {
    /// Helper to build a simple error response with no accessible reason.
    pub fn simple<S: Into<String>>(error: &str, message: S) -> Self {
        ClusterErrorResponse {
            error: error.to_string(),
            message: message.into(),
            accessible_reason: None,
        }
    }

    /// Helper to build a cluster_unavailable error including an optional reason.
    pub fn unavailable(cluster_id: &str, reason: Option<String>) -> Self {
        ClusterErrorResponse {
            error: "cluster_unavailable".to_string(),
            message: format!("Cluster '{}' is inaccessible", cluster_id),
            accessible_reason: reason,
        }
    }
}

impl IntoResponse for ClusterErrorResponse {
    fn into_response(self) -> Response {
        // Map certain error codes to more appropriate HTTP status codes.
        // In particular, generation concurrency limits should return 429
        // so clients can retry later, while other errors remain 400.
        let status = match self.error.as_str() {
            // Client / auth errors
            "access_denied" => StatusCode::FORBIDDEN,
            "unauthorized" | "authentication_required" => StatusCode::UNAUTHORIZED,
            // Not found
            "cluster_not_found" => StatusCode::NOT_FOUND,

            // Rate / concurrency
            "generation_concurrency_limited" => StatusCode::TOO_MANY_REQUESTS,

            // Upstream/proxy errors
            "proxy_timeout" | "response_read_timeout" => StatusCode::GATEWAY_TIMEOUT,
            "proxy_failed"
            | "elasticsearch_error"
            | "response_read_failed"
            | "response_build_failed" => StatusCode::BAD_GATEWAY,
            // Cluster inaccessible - return 503 so frontend can show why
            "cluster_unavailable" => StatusCode::SERVICE_UNAVAILABLE,

            // Server errors
            "semaphore_error" | "internal_error" => StatusCode::INTERNAL_SERVER_ERROR,

            // Validation / client input
            "validation_failed" | "parse_failed" | "parse_error" | "no_settings"
            | "too_many_tiles" => StatusCode::BAD_REQUEST,

            // Default to 400 for other structured errors
            _ => StatusCode::BAD_REQUEST,
        };
        (status, Json(self)).into_response()
    }
}

/// Request body for shard relocation
///
/// # Requirements
///
/// Validates: Requirements 6.1, 6.2
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RelocateShardRequest {
    /// Index name
    #[schema(example = "my-index")]
    pub index: String,
    /// Shard number
    #[schema(example = 0)]
    pub shard: u32,
    /// Source node ID
    #[schema(example = "node-1")]
    pub from_node: String,
    /// Destination node ID
    #[schema(example = "node-2")]
    pub to_node: String,
}

/// List all configured clusters
///
/// Returns a list of all clusters with filtering and pagination
///
/// # Requirements
///
/// Validates: Requirements 2.15
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ClustersQueryParams {
    #[schema(default = 1, example = 1)]
    #[serde(default = "default_page")]
    pub page: u32,
    #[schema(default = 50, example = 50)]
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[schema(example = "production")]
    #[serde(default)]
    pub search: String,
    #[schema(example = "green,yellow")]
    #[serde(default)]
    pub health: String, // comma-separated: green,yellow,red
    #[schema(example = "8.0.0")]
    #[serde(default)]
    pub version: String,
}

#[utoipa::path(
    get,
    path = "/clusters",
    params(ClustersQueryParams),
    responses(
        (status = 200, body = PaginatedResponse<ClusterInfo>),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext))]
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

    // At this stage return configured cluster info only (config-only response).
    // Do NOT perform network calls (health/stats) here — those are performed
    // by per-cluster detail endpoints. This makes the clusters list non-blocking
    // when a cluster is slow or unreachable.
    let response = paginate_vec(filtered, params.page as usize, params.page_size as usize);

    tracing::debug!(
        total = response.total,
        page_items = response.items.len(),
        "Clusters retrieved (config-only)"
    );

    Ok(Json(response))
}

/// Permission entry for a single cluster
#[derive(Debug, Serialize, ToSchema)]
pub struct ClusterPermission {
    /// Cluster ID
    #[schema(example = "prod-cluster")]
    pub id: String,
    /// Cluster name (if set in config)
    #[schema(example = "Production Cluster")]
    pub name: Option<String>,
    /// Whether the user has a matching credential for this cluster
    #[schema(example = true)]
    pub accessible: bool,
    /// The matched role label if accessible, null otherwise
    #[schema(example = "admin", nullable = true)]
    pub matched_role: Option<String>,
}

/// Response for user permissions endpoint
#[derive(Debug, Serialize, ToSchema)]
pub struct UserPermissionsResponse {
    /// List of clusters with permission info
    pub permissions: Vec<ClusterPermission>,
}

/// Get current user's cluster permissions
///
/// Returns for each cluster: { id, name, accessible, matched_role }.
/// This allows the frontend to show which credential will be used for each cluster.
///
/// # Requirements
///
/// Validates: Requirements R5.1, R5.2
#[utoipa::path(
    get,
    path = "/api/users/me/permissions",
    responses(
        (status = 200, body = UserPermissionsResponse, description = "User's cluster permissions"),
        (status = 401, description = "Not authenticated")
    ),
    tag = "Authentication"
)]
#[instrument(skip(state, user), fields(username = %user.0.username))]
pub async fn get_user_permissions(
    State(state): State<ClusterState>,
    Extension(user): Extension<AuthenticatedUser>,
) -> Json<UserPermissionsResponse> {
    // Get all clusters
    let all_clusters = state.cluster_manager.list_clusters().await;

    // Build permissions for each cluster based on role credential matching
    let mut permissions: Vec<ClusterPermission> = Vec::new();

    for cluster in all_clusters {
        // Try to match a role credential for this user
        let result = state
            .cluster_manager
            .get_client_for_user(&cluster.id, &user.0.roles)
            .await;

        let permission = match result {
            Ok((_, matched_role)) => ClusterPermission {
                id: cluster.id,
                name: cluster.name,
                accessible: true,
                matched_role: Some(matched_role),
            },
            Err(_) => ClusterPermission {
                id: cluster.id,
                name: cluster.name,
                accessible: false,
                matched_role: None,
            },
        };
        permissions.push(permission);
    }

    Json(UserPermissionsResponse { permissions })
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

            // Version filter - disabled (version fetched dynamically from cluster)
            // Version filtering can be done client-side or with cached data

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
pub(crate) fn check_cluster_access(
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

    Err(ClusterErrorResponse::simple(
        "access_denied",
        format!("Access denied to cluster: {}", cluster_id),
    ))
}

/// Validate cluster id and return a clear client error when empty.
fn validate_cluster_id(cluster_id: &str) -> Result<(), ClusterErrorResponse> {
    if cluster_id.is_empty() {
        tracing::debug!(cluster_id = %cluster_id, "Empty cluster id in request");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Cluster id is empty",
        ));
    }
    Ok(())
}

/// Get cluster statistics using SDK typed methods
///
/// Returns cluster stats in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.1, 4.2, 4.3
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/stats",
    params(("cluster_id" = String, Path, description = "Cluster ID")),
    responses(
        (status = 200, body = ClusterStatsResponse),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext), fields(cluster_id = %cluster_id))]
pub async fn get_cluster_stats(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<ClusterStatsResponse>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting cluster stats");

    // Validate cluster id (defensive) and check cluster access
    validate_cluster_id(&cluster_id)?;
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Short-circuit if cluster is known to be inaccessible
    if !cluster.accessible {
        return Err(ClusterErrorResponse::unavailable(
            &cluster_id,
            cluster.accessible_reason.clone(),
        ));
    }

    // Get cluster stats and health using SDK typed methods
    let stats = cluster.cluster_stats().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get cluster stats"
        );
        ClusterErrorResponse::simple(
            "stats_failed",
            format!("Failed to get cluster stats: {}", e),
        )
    })?;

    let health = cluster.health().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get cluster health"
        );
        ClusterErrorResponse::simple(
            "health_failed",
            format!("Failed to get cluster health: {}", e),
        )
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
    let es_version: Option<String> = cluster.info().await.ok().and_then(|info| {
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
        ClusterErrorResponse::simple(
            "transform_failed",
            format!("Failed to transform cluster stats: {}", e),
        )
    })?;

    tracing::debug!(
        cluster_id = %cluster_id,
        health = %response.health,
        "Cluster stats retrieved successfully"
    );

    Ok(Json(response))
}

/// Per-cluster details response wrapper
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClusterDetailsResponse {
    pub status: String, // "ok" | "error"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<serde_json::Value>,
    pub fetched_at: String,
}

/// Get cluster details (non-blocking list-friendly endpoint)
///
/// Returns a structured JSON envelope with status and either data or error.
/// Always returns HTTP 200.
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/details",
    params(("cluster_id" = String, Path, description = "Cluster ID")),
    responses(
        (status = 200, body = ClusterDetailsResponse),
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext), fields(cluster_id = %cluster_id))]
pub async fn get_cluster_details(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<ClusterDetailsResponse>, ClusterErrorResponse> {
    tracing::debug!(cluster_id = %cluster_id, "Getting cluster details");

    // Validate cluster id (defensive) and RBAC check
    validate_cluster_id(&cluster_id)?;
    check_cluster_access(&cluster_id, &user_ext)?;

    // Try cache first
    if let Some(cached) = state.details_cache.get(&cluster_id).await {
        tracing::debug!(cluster_id = %cluster_id, "Returning cached cluster details");
        let resp = ClusterDetailsResponse {
            status: "ok".to_string(),
            data: Some(cached),
            error: None,
            fetched_at: chrono::Utc::now().to_rfc3339(),
        };
        return Ok(Json(resp));
    }

    // Cache miss -> record a proxy call metric and start timer
    // metrics_cluster was previously used for per-cluster labels. Keep clone if needed later.
    let _metrics_cluster = cluster_id.clone();
    // Record a proxy call counter
    metrics::counter!("proxy.calls").increment(1);
    let start = std::time::Instant::now();

    // Acquire permit from semaphore (fan-out concurrency limiter)
    let permit = match state.details_semaphore.clone().acquire_owned().await {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, cluster_id = %cluster_id, "Failed to acquire semaphore permit");
            // Return structured error
            let resp = ClusterDetailsResponse {
                status: "error".to_string(),
                data: None,
                error: Some(
                    serde_json::json!({"error": "semaphore_acquire_failed", "message": format!("{}", e)}),
                ),
                fetched_at: chrono::Utc::now().to_rfc3339(),
            };
            return Ok(Json(resp));
        }
    };

    // Ensure permit is dropped at the end of scope
    let cluster_id_clone = cluster_id.clone();
    let manager = state.cluster_manager.clone();
    // Overall timeout for the fan-out
    let overall_timeout = std::time::Duration::from_secs(8);

    let fut = async move {
        // Get cluster connection (with auth if required)
        let cluster_conn = if let Some(user) = user_ext {
            manager
                .get_cluster_with_auth(&cluster_id_clone, Some(&user.0 .0))
                .await
                .map_err(|e| anyhow::anyhow!("{}", e))?
        } else {
            manager
                .get_cluster(&cluster_id_clone)
                .await
                .map_err(|e| anyhow::anyhow!("{}", e))?
        };

        // Perform fan-out calls in parallel: cluster_stats, health, nodes_info, nodes_stats
        let stats_fut = cluster_conn.cluster_stats();
        let health_fut = cluster_conn.health();
        let nodes_info_fut = cluster_conn.nodes_info();
        let nodes_stats_fut = cluster_conn.nodes_stats();

        let (stats_res, health_res, nodes_info_res, nodes_stats_res) =
            tokio::join!(stats_fut, health_fut, nodes_info_fut, nodes_stats_fut);

        // Build response object
        let mut data = serde_json::Map::new();

        match stats_res {
            Ok(s) => {
                data.insert("cluster_stats".to_string(), s);
            }
            Err(e) => {
                tracing::warn!(cluster_id = %cluster_id_clone, error = %e, "cluster_stats failed");
                data.insert(
                    "cluster_stats".to_string(),
                    serde_json::json!({"error": format!("{}", e)}),
                );
            }
        }

        match health_res {
            Ok(h) => {
                data.insert("health".to_string(), h);
            }
            Err(e) => {
                tracing::warn!(cluster_id = %cluster_id_clone, error = %e, "health failed");
                data.insert(
                    "health".to_string(),
                    serde_json::json!({"error": format!("{}", e)}),
                );
            }
        }

        match nodes_info_res {
            Ok(n) => {
                data.insert("nodes_info".to_string(), n);
            }
            Err(e) => {
                tracing::warn!(cluster_id = %cluster_id_clone, error = %e, "nodes_info failed");
                data.insert(
                    "nodes_info".to_string(),
                    serde_json::json!({"error": format!("{}", e)}),
                );
            }
        }

        match nodes_stats_res {
            Ok(ns) => {
                data.insert("nodes_stats".to_string(), ns);
            }
            Err(e) => {
                tracing::warn!(cluster_id = %cluster_id_clone, error = %e, "nodes_stats failed");
                data.insert(
                    "nodes_stats".to_string(),
                    serde_json::json!({"error": format!("{}", e)}),
                );
            }
        }

        Ok::<serde_json::Value, anyhow::Error>(serde_json::Value::Object(data))
    };

    // Run with timeout
    match tokio::time::timeout(overall_timeout, fut).await {
        Ok(Ok(data_value)) => {
            // Record latency histogram for successful calls (ms)
            let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
            metrics::histogram!("proxy.latency_ms").record(elapsed_ms);
            // Cache successful result
            state
                .details_cache
                .insert(cluster_id.clone(), data_value.clone())
                .await;

            // Release permit by dropping 'permit'
            drop(permit);

            let resp = ClusterDetailsResponse {
                status: "ok".to_string(),
                data: Some(data_value),
                error: None,
                fetched_at: chrono::Utc::now().to_rfc3339(),
            };
            Ok(Json(resp))
        }
        Ok(Err(e)) => {
            tracing::error!(cluster_id = %cluster_id, error = %e, "Failed to get cluster details");
            // Failure metric (increment and record latency)
            metrics::counter!("proxy.failures").increment(1);
            let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
            metrics::histogram!("proxy.latency_ms").record(elapsed_ms);
            drop(permit);
            let resp = ClusterDetailsResponse {
                status: "error".to_string(),
                data: None,
                error: Some(
                    serde_json::json!({"error": "fetch_failed", "message": format!("{}", e)}),
                ),
                fetched_at: chrono::Utc::now().to_rfc3339(),
            };
            Ok(Json(resp))
        }
        Err(_elapsed) => {
            tracing::warn!(cluster_id = %cluster_id, "Cluster details request timed out");
            // Timeout metric (increment and record latency)
            metrics::counter!("proxy.timeouts").increment(1);
            let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;
            metrics::histogram!("proxy.latency_ms").record(elapsed_ms);
            drop(permit);
            let resp = ClusterDetailsResponse {
                status: "error".to_string(),
                data: None,
                error: Some(
                    serde_json::json!({"error": "timeout", "message": "Request timed out"}),
                ),
                fetched_at: chrono::Utc::now().to_rfc3339(),
            };
            Ok(Json(resp))
        }
    }
}

/// Get cluster settings
///
/// Returns cluster settings in JSON format
/// Optionally includes default settings with `include_defaults` query parameter
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/settings",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("include_defaults" = bool, Query, description = "Include default settings")
    ),
    responses(
        (status = 200, description = "Cluster settings"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext, params), fields(cluster_id = %cluster_id))]
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

    // Validate cluster id (defensive) and check cluster access
    validate_cluster_id(&cluster_id)?;
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Get cluster settings via ClusterConnection proxy
    let settings = cluster
        .cluster_settings(include_defaults)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "Failed to get cluster settings"
            );
            ClusterErrorResponse::simple(
                "settings_failed",
                format!("Failed to get cluster settings: {}", e),
            )
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
#[utoipa::path(
    put,
    path = "/clusters/{cluster_id}/settings",
    params(("cluster_id" = String, Path, description = "Cluster ID")),
    request_body = ClusterSettingsUpdateRequest,
    responses(
        (status = 200, description = "Settings updated"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext, request, request_id_ext), fields(cluster_id = %cluster_id))]
pub async fn update_cluster_settings(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
    request_id_ext: Option<axum::Extension<crate::middleware::logging::RequestId>>,
    Json(request): Json<ClusterSettingsUpdateRequest>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        "Updating cluster settings"
    );

    // Validate cluster id (defensive) and check cluster access
    validate_cluster_id(&cluster_id)?;
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
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
        return Err(ClusterErrorResponse::simple(
            "no_settings",
            "At least one of 'persistent' or 'transient' settings must be provided",
        ));
    }

    // Build JSON body value
    let body_value = serde_json::Value::Object(settings_body);

    // Extract user roles and id for client selection and audit
    let user = user_ext.as_ref().map(|u| u.0 .0.clone()).ok_or_else(|| {
        tracing::error!("Authentication required but user not found in request");
        ClusterErrorResponse::simple(
            "authentication_required",
            "Authentication is required for this operation",
        )
    })?;

    let request_id = request_id_ext
        .as_ref()
        .map(|r| r.0.as_str().to_string())
        .unwrap_or_default();

    // Use centralized proxy helper which performs client selection, timeouts,
    // response read timeout, and emits an audit entry when the request is
    // actually forwarded to Elasticsearch.
    let (_status, _headers, body_vec, _matched_role_label) = match state
        .cluster_manager
        .proxy_request_with_audit(
            &cluster_id,
            Method::PUT,
            "/_cluster/settings",
            Some(body_value.clone()),
            Some(user.id.clone()),
            &user.roles,
            &request_id,
            state.audit_log,
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            use crate::cluster::ProxyRequestError;

            match e {
                ProxyRequestError::AccessDenied => {
                    tracing::warn!(error = %"access_denied", cluster_id = %cluster_id, "Access denied: no matching role client");
                    return Err(ClusterErrorResponse::simple(
                        "access_denied",
                        "You do not have permissions to perform this operation on the requested cluster",
                    ));
                }
                ProxyRequestError::ProxyTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "UPDATE SETTINGS: request timed out");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_timeout",
                        "Elasticsearch request timed out: PUT /_cluster/settings (timeout: 30s)"
                            .to_string(),
                    ));
                }
                ProxyRequestError::RequestFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "UPDATE SETTINGS: request failed");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_failed",
                        format!("Failed to update cluster settings: {}", reason),
                    ));
                }
                ProxyRequestError::ResponseReadTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "Timeout reading update response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_timeout",
                        "Timeout reading Elasticsearch response body",
                    ));
                }
                ProxyRequestError::ResponseReadFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "Failed to read update response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_failed",
                        format!("Failed to read response body: {}", reason),
                    ));
                }
                ProxyRequestError::Other(reason) => {
                    tracing::warn!(error = %reason, "UPDATE SETTINGS: Unexpected error");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_failed",
                        format!("Failed to proxy request: {}", reason),
                    ));
                }
            }
        }
    };

    let response_value = serde_json::from_slice::<Value>(&body_vec).map_err(|e| {
        tracing::error!(cluster_id = %cluster_id, error = %e, "Failed to parse update response");
        ClusterErrorResponse::simple(
            "parse_failed",
            format!("Failed to parse update response: {}", e),
        )
    })?;

    tracing::info!(
        cluster_id = %cluster_id,
        "Cluster settings updated successfully"
    );

    Ok(Json(response_value))
}

/// Request body for updating cluster settings
#[derive(Debug, Deserialize, ToSchema)]
pub struct ClusterSettingsUpdateRequest {
    /// Persistent settings (survive cluster restarts)
    #[schema(example = "{\"indices.queries.cache.size\": \"20%\"}")]
    pub persistent: Option<Value>,
    /// Transient settings (do not survive cluster restarts)
    #[schema(example = "{\"indices.queries.cache.size\": \"30%\"}")]
    pub transient: Option<Value>,
}

/// Get nodes information using SDK typed methods with pagination
///
/// Returns paginated nodes info in frontend-compatible format
///
/// # Requirements
///
/// Validates: Requirements 4.6, 14.1, 14.2
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct NodesQueryParams {
    #[schema(default = 1, example = 1)]
    #[serde(default = "default_page")]
    pub page: u32,
    #[schema(default = 50, example = 50)]
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[schema(example = "node-1")]
    #[serde(default)]
    pub search: String,
    #[schema(example = "master,data")]
    pub roles: Option<String>, // comma-separated: master,data,ingest; None = not set, Some("") = explicitly empty
    #[schema(example = "node-1,node-2")]
    #[serde(default)]
    pub nodes: Option<String>, // comma-separated node ids or names
}

#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/nodes",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        NodesQueryParams
    ),
    responses(
        (status = 200, body = PaginatedResponse<NodeInfoResponse>),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext, params), fields(cluster_id = %cluster_id))]
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
        nodes = ?params.nodes,
        "Getting nodes with filters"
    );

    // Validate cluster id (defensive) and check cluster access
    validate_cluster_id(&cluster_id)?;
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Get nodes info and stats using SDK typed methods
    let nodes_info = cluster.nodes_info().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get nodes info"
        );
        ClusterErrorResponse::simple(
            "nodes_info_failed",
            format!("Failed to get nodes info: {}", e),
        )
    })?;

    let nodes_stats = cluster.nodes_stats().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get nodes stats"
        );
        ClusterErrorResponse::simple(
            "nodes_stats_failed",
            format!("Failed to get nodes stats: {}", e),
        )
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

    // Nodes filter: None = not set (show all), Some("") = explicitly empty (show none), Some("n1,n2") = filter by node id or name
    let nodes_filter: Option<Vec<&str>> = params.nodes.as_ref().map(|n| {
        let filtered: Vec<&str> = n.split(',').filter(|s| !s.is_empty()).collect();
        filtered
    });

    let filtered_nodes: Vec<NodeInfoResponse> = all_nodes
        .into_iter()
        .filter(|node| {
            // Nodes filter: apply first
            match &nodes_filter {
                None => {} // no filter, show all
                Some(v) if v.is_empty() => {
                    // explicit empty filter => no nodes match
                    return false;
                }
                Some(list) => {
                    // match by id OR name (case-insensitive)
                    let id_lower = node.id.to_lowercase();
                    let name_lower = node.name.to_lowercase();
                    let mut found = false;
                    for val in list {
                        if id_lower == val.to_lowercase() || name_lower == val.to_lowercase() {
                            found = true;
                            break;
                        }
                    }
                    if !found {
                        return false;
                    }
                }
            }

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
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/nodes/{node_id}/stats",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("node_id" = String, Path, description = "Node ID")
    ),
    responses(
        (status = 200, body = NodeDetailStatsResponse),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext), fields(cluster_id = %cluster_id, node_id = %node_id))]
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Short-circuit if cluster is known to be inaccessible
    if !cluster.accessible {
        return Err(ClusterErrorResponse::unavailable(
            &cluster_id,
            cluster.accessible_reason.clone(),
        ));
    }

    // Get nodes info for the specific node
    let nodes_info = cluster.nodes_info().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            error = %e,
            "Failed to get node info"
        );
        ClusterErrorResponse::simple(
            "node_info_failed",
            format!("Failed to get node info: {}", e),
        )
    })?;

    // Get detailed node stats for the specific node using SDK
    let node_stats = cluster.node_stats(&node_id).await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            node_id = %node_id,
            error = %e,
            "Failed to get node stats"
        );
        ClusterErrorResponse::simple(
            "node_stats_failed",
            format!("Failed to get node stats: {}", e),
        )
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
        ClusterErrorResponse::simple(
            "transform_failed",
            format!("Failed to transform node stats: {}", e),
        )
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
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct IndicesQueryParams {
    #[schema(default = 1, example = 1)]
    #[serde(default = "default_page")]
    pub page: u32,
    #[schema(default = 50, example = 50)]
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[schema(example = "logs-")]
    #[serde(default)]
    pub search: String,
    #[schema(example = "green,yellow")]
    #[serde(default)]
    pub health: String, // comma-separated: green,yellow,red
    #[schema(example = "open,close")]
    #[serde(default)]
    pub status: String, // comma-separated: open,close
    #[schema(default = false)]
    #[serde(default)]
    pub show_special: bool, // show indices starting with .
    #[schema(default = false)]
    #[serde(default)]
    pub affected: bool, // show only indices with problems
}

fn default_page() -> u32 {
    1
}
fn default_page_size() -> u32 {
    10
}

fn default_true() -> bool {
    true
}

#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/indices",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        IndicesQueryParams
    ),
    responses(
        (status = 200, body = PaginatedResponse<IndexInfoResponse>),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext, params), fields(cluster_id = %cluster_id))]
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Short-circuit if cluster is known to be inaccessible
    if !cluster.accessible {
        return Err(ClusterErrorResponse::unavailable(
            &cluster_id,
            cluster.accessible_reason.clone(),
        ));
    }

    // Use lightweight _cat/indices API instead of heavy _stats API
    // This is MUCH faster for large clusters with many indices
    let cat_indices = cluster.cat_indices().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to get indices information"
        );
        ClusterErrorResponse::simple(
            "indices_failed",
            format!("Failed to get indices information: {}", e),
        )
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
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/indices/{index_name}/shards/{shard_num}",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("index_name" = String, Path, description = "Index name"),
        ("shard_num" = String, Path, description = "Shard number")
    ),
    responses(
        (status = 200, description = "Shard stats with optional allocation explain"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state), fields(cluster_id = %cluster_id, index_name = %index_name, shard_num = %shard_num))]
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Short-circuit if cluster is known to be inaccessible
    if !cluster.accessible {
        return Err(ClusterErrorResponse::unavailable(
            &cluster_id,
            cluster.accessible_reason.clone(),
        ));
    }

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
            ClusterErrorResponse::simple(
                "indices_stats_failed",
                format!("Failed to get indices stats with shards: {}", e),
            )
        })?;

    // Navigate to the specific shard in the response
    // Structure: indices -> {index_name} -> shards -> {shard_num} -> [array of shard copies]
    tracing::info!(
        response_structure = ?indices_stats.as_object().map(|o| o.keys().collect::<Vec<_>>()),
        "Indices stats response structure"
    );

    if let Some(indices) = indices_stats.get("indices") {
        let available_indices: Vec<_> = indices
            .as_object()
            .map(|o| o.keys().cloned().collect())
            .unwrap_or_default();
        tracing::info!(
            index_count = available_indices.len(),
            index_names = ?available_indices,
            looking_for = %index_name,
            "Available indices"
        );

        if let Some(index_obj) = indices.get(&index_name) {
            tracing::info!("Found index object for {}", index_name);
            let index_keys: Vec<_> = index_obj
                .as_object()
                .map(|o| o.keys().cloned().collect())
                .unwrap_or_default();
            tracing::info!(index_keys = ?index_keys, "Index object keys");

            if let Some(shards_obj) = index_obj.get("shards") {
                tracing::info!("Found shards object");
                let shard_keys: Vec<_> = shards_obj
                    .as_object()
                    .map(|o| o.keys().cloned().collect())
                    .unwrap_or_default();
                tracing::info!(
                    shard_count = shard_keys.len(),
                    shard_keys = ?shard_keys,
                    looking_for = %shard_num,
                    "Available shards"
                );

                // Try string key first, then integer-as-string key
                let shard_array = shards_obj.get(&shard_num).or_else(|| {
                    let parsed = shard_num.parse::<i32>().ok().map(|n| n.to_string());
                    tracing::info!(parsed_key = ?parsed, "Trying parsed integer key");
                    parsed.and_then(|n_str| shards_obj.get(&n_str))
                });

                if let Some(shard_array) = shard_array {
                    tracing::info!("Found shard array for shard {}", shard_num);
                    if let Some(arr) = shard_array.as_array() {
                        tracing::info!(array_len = arr.len(), "Shard array length");
                        // Return the first shard (primary or replica)
                        if let Some(shard_stats) = arr.first() {
                            tracing::debug!(
                                cluster_id = %cluster_id,
                                index = %index_name,
                                shard = %shard_num,
                                "Successfully found shard stats"
                            );

                            // Check if shard is unassigned and fetch allocation explain
                            let shard_state = shard_stats
                                .get("routing")
                                .and_then(|r| r.get("state"))
                                .and_then(|s| s.as_str());
                            let is_primary = shard_stats
                                .get("routing")
                                .and_then(|r| r.get("primary"))
                                .and_then(|p| p.as_bool())
                                .unwrap_or(false);

                            if shard_state == Some("UNASSIGNED") {
                                // Fetch allocation explain for unassigned shards
                                let user_id = user_ext.as_ref().map(|ext| ext.0 .0.id.clone());
                                let user_roles: Vec<String> = user_ext
                                    .as_ref()
                                    .map(|ext| ext.0 .0.roles.clone())
                                    .unwrap_or_default();
                                let request_id = RequestId(uuid::Uuid::new_v4().to_string());
                                match fetch_allocation_explain(
                                    &state.cluster_manager,
                                    &cluster_id,
                                    &index_name,
                                    &shard_num,
                                    is_primary,
                                    user_id,
                                    user_roles,
                                    &request_id,
                                    state.audit_log,
                                )
                                .await
                                {
                                    Ok(allocation_explain) => {
                                        let mut response = shard_stats.clone();
                                        if let Some(obj) = response.as_object_mut() {
                                            obj.insert(
                                                "allocation_explain".to_string(),
                                                allocation_explain,
                                            );
                                        }
                                        return Ok(Json(response));
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            cluster_id = %cluster_id,
                                            index = %index_name,
                                            shard = %shard_num,
                                            error = %e,
                                            "Failed to fetch allocation explain"
                                        );
                                        // Return shard stats without allocation explain on error
                                        return Ok(Json(shard_stats.clone()));
                                    }
                                }
                            }

                            return Ok(Json(shard_stats.clone()));
                        }
                    }
                }
            }
        }
    }

    // If not found, log detailed info about where we failed
    tracing::warn!(
        cluster_id = %cluster_id,
        index = %index_name,
        shard = %shard_num,
        has_indices = indices_stats.get("indices").is_some(),
        "Shard stats not found - check debug logs for navigation details"
    );
    Ok(Json(serde_json::json!({})))
}

/// Fetch allocation explain for an unassigned shard
async fn fetch_allocation_explain(
    cluster_manager: &crate::cluster::Manager,
    cluster_id: &str,
    index_name: &str,
    shard_num: &str,
    primary: bool,
    user_id: Option<String>,
    user_roles: Vec<String>,
    request_id: &crate::middleware::logging::RequestId,
    audit_enabled: bool,
) -> Result<Value, anyhow::Error> {
    use crate::cluster::ProxyRequestError;

    let request_body = serde_json::json!({
        "index": index_name,
        "shard": shard_num.parse::<i32>().unwrap_or(0),
        "primary": primary
    });

    let path = "_cluster/allocation/explain";

    let (status, _headers, body_bytes, _matched_role) = cluster_manager
        .proxy_request_with_audit(
            cluster_id,
            reqwest::Method::POST,
            path,
            Some(request_body),
            user_id,
            &user_roles,
            &request_id.0,
            audit_enabled,
        )
        .await
        .map_err(|e| match e {
            ProxyRequestError::AccessDenied => anyhow::anyhow!("Access denied"),
            ProxyRequestError::ProxyTimeout => anyhow::anyhow!("Request timeout"),
            ProxyRequestError::RequestFailed(s) => anyhow::anyhow!("Request failed: {}", s),
            ProxyRequestError::ResponseReadTimeout => anyhow::anyhow!("Response read timeout"),
            ProxyRequestError::ResponseReadFailed(s) => {
                anyhow::anyhow!("Response read failed: {}", s)
            }
            ProxyRequestError::Other(s) => anyhow::anyhow!("Other error: {}", s),
        })?;

    if !status.is_success() {
        let body_str = String::from_utf8_lossy(&body_bytes);
        anyhow::bail!(
            "Allocation explain failed with status {}: {}",
            status,
            body_str
        );
    }

    let allocation_data: Value = serde_json::from_slice(&body_bytes)
        .context("Failed to parse allocation explain response")?;

    Ok(allocation_data)
}

/// Get shards information for a cluster with pagination and filtering
///
/// # Requirements
///
/// Validates: Requirements 4.8
#[derive(Debug, Deserialize, ToSchema, IntoParams)]
pub struct ShardsQueryParams {
    #[schema(default = 1, example = 1)]
    #[serde(default = "default_page")]
    pub page: u32,
    #[schema(default = 10, example = 10)]
    #[serde(default = "default_page_size")]
    pub page_size: u32,
    #[schema(example = true)]
    #[serde(default)]
    pub hide_special: bool, // exclude indices starting with '.' (default: false)
    #[schema(example = true)]
    #[serde(default = "default_true")]
    pub show_primaries: bool, // include primary shards (default: true)
    #[schema(example = true)]
    #[serde(default = "default_true")]
    pub show_replicas: bool, // include replica shards (default: true)
    #[schema(example = "STARTED,UNASSIGNED")]
    #[serde(default)]
    pub state: String, // comma-separated: UNASSIGNED,STARTED,etc
    #[schema(example = "logs-")]
    #[serde(default)]
    pub index: String,
    #[schema(example = "node-1")]
    #[serde(default)]
    pub node: String,
    #[schema(example = "logs")]
    #[serde(default)]
    pub search: String, // search both index and node (OR logic)
}

#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/shards",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ShardsQueryParams
    ),
    responses(
        (status = 200, body = PaginatedShardsWithNodes),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, params), fields(cluster_id = %cluster_id))]
pub async fn get_shards(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<ShardsQueryParams>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<PaginatedShardsWithNodes>, ClusterErrorResponse> {
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Short-circuit if cluster is known to be inaccessible
    if !cluster.accessible {
        return Err(ClusterErrorResponse::unavailable(
            &cluster_id,
            cluster.accessible_reason.clone(),
        ));
    }

    // Phase 1: Get all shards from routing_nodes (minimal fields for pagination/filtering)
    let state_response = cluster
        .cluster_state_routing_nodes(None)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "Failed to get cluster state with routing nodes"
            );
            ClusterErrorResponse::simple(
                "shards_failed",
                format!("Failed to get shard information: {}", e),
            )
        })?;

    // Log routing_nodes summary for debugging
    let unassigned_count = state_response["routing_nodes"]["unassigned"]
        .as_array()
        .map(|a| a.len())
        .unwrap_or(0);
    let nodes_count = state_response["routing_nodes"]["nodes"]
        .as_object()
        .map(|m| m.len())
        .unwrap_or(0);
    tracing::debug!(
        cluster_id = %cluster_id,
        unassigned_count,
        nodes_count,
        "Routing nodes summary before transform"
    );

    // Transform to flat shard list (minimal fields: index, shard, primary, state, node)
    let all_shards = transform_routing_nodes_to_shards(&state_response);

    // Log breakdown of shard states (counts) for debugging filters
    let mut state_counts: std::collections::HashMap<String, usize> =
        std::collections::HashMap::new();
    for s in &all_shards {
        *state_counts.entry(s.state.clone()).or_insert(0) += 1;
    }
    tracing::debug!(cluster_id = %cluster_id, all_shards = all_shards.len(), state_counts = ?state_counts, "Transformed routing_nodes to flat shard list");

    // Apply filters
    let state_filter: Vec<&str> = params.state.split(',').filter(|s| !s.is_empty()).collect();

    // Apply filters step-by-step with debug logs so we can see where shards are dropped
    let mut step_shards = all_shards;

    // Hide special indices
    if params.hide_special {
        step_shards.retain(|s| !s.index.starts_with('.'));
    }
    let after_hide = step_shards.len();

    // State filter - apply early so explicit state requests (eg. UNASSIGNED)
    // are respected and not accidentally removed by primary/replica filtering.
    let mut after_state = after_hide;
    if !state_filter.is_empty() {
        step_shards.retain(|s| state_filter.contains(&s.state.as_str()));
        after_state = step_shards.len();
    }

    // Primary/Replica filter
    if !params.show_primaries || !params.show_replicas {
        step_shards.retain(|s| {
            if !params.show_primaries && s.primary {
                return false;
            }
            if !params.show_replicas && !s.primary {
                return false;
            }
            true
        });
    }
    let after_primary_replica = step_shards.len();

    // Search filter (OR logic)
    if !params.search.is_empty() {
        let search_lower = params.search.to_lowercase();
        step_shards.retain(|s| {
            let index_matches = s.index.to_lowercase().contains(&search_lower);
            let node_matches = s
                .node
                .as_deref()
                .unwrap_or("")
                .to_lowercase()
                .contains(&search_lower);
            index_matches || node_matches
        });
    }
    let after_search = step_shards.len();

    // Index filter (only if search empty)
    if params.search.is_empty() && !params.index.is_empty() {
        let idx_lower = params.index.to_lowercase();
        step_shards.retain(|s| s.index.to_lowercase().contains(&idx_lower));
    }
    let after_index = step_shards.len();

    // Node filter (only if search empty)
    if params.search.is_empty() && !params.node.is_empty() {
        let node_lower = params.node.to_lowercase();
        step_shards.retain(|s| {
            s.node
                .as_deref()
                .unwrap_or("")
                .to_lowercase()
                .contains(&node_lower)
        });
    }
    let after_node = step_shards.len();

    tracing::debug!(
        cluster_id = %cluster_id,
        initial = after_hide, // after hide_special step is first count from all_shards
        after_primary_replica,
        after_state,
        after_search,
        after_index,
        after_node,
        "Shard filter pipeline counts"
    );

    let filtered_shards: Vec<ShardInfoResponse> = step_shards;

    tracing::debug!(
        cluster_id = %cluster_id,
        total = filtered_shards.len(),
        "Shards filtered"
    );

    // Apply pagination to get page indices
    let paginated = paginate_vec(
        filtered_shards,
        params.page as usize,
        params.page_size as usize,
    );

    // Phase 2: For the current page, fetch full details (docs, store) per-index
    // Get unique indices for shards on this page
    let page_indices: Vec<&str> = paginated
        .items
        .iter()
        .map(|s| s.index.as_str())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    // Fetch full details for each index on this page
    let mut index_details: std::collections::HashMap<String, Vec<ShardInfoResponse>> =
        std::collections::HashMap::new();

    for index_name in &page_indices {
        match cluster.cat_shards_for_index(index_name).await {
            Ok(shards_data) => {
                let shards = transform_shards(&shards_data);
                index_details.insert(index_name.to_string(), shards);
            }
            Err(e) => {
                tracing::warn!(
                    cluster_id = %cluster_id,
                    index = index_name,
                    error = %e,
                    "Failed to get full details for index"
                );
            }
        }
    }

    // Merge details into paginated items
    let items_with_details: Vec<ShardInfoResponse> = paginated
        .items
        .into_iter()
        .map(|mut shard| {
            if let Some(index_shards) = index_details.get(&shard.index) {
                // Find matching shard in index details
                if let Some(detail) = index_shards.iter().find(|s| {
                    s.index == shard.index && s.shard == shard.shard && s.primary == shard.primary
                }) {
                    shard.docs = detail.docs;
                    shard.store = detail.store;
                }
            }
            shard
        })
        .collect();

    tracing::debug!(
        cluster_id = %cluster_id,
        total_shards = paginated.total,
        page_shards = items_with_details.len(),
        page = params.page,
        page_size = params.page_size,
        "Shards retrieved successfully"
    );

    // Fetch nodes_info and nodes_stats; fail the request if these cannot be
    // retrieved. The frontend expects authoritative node metadata for the
    // index visualization and should not have to synthesize missing values.
    let nodes_vec: Vec<NodeInfoResponse> = {
        let nodes_info = cluster.nodes_info().await.map_err(|e| {
            tracing::error!(cluster_id = %cluster_id, error = %e, "Failed to get nodes info for shards response");
            ClusterErrorResponse::simple(
                "nodes_info_failed",
                format!("Failed to get nodes info: {}", e),
            )
        })?;

        let nodes_stats = cluster.nodes_stats().await.map_err(|e| {
            tracing::error!(cluster_id = %cluster_id, error = %e, "Failed to get nodes stats for shards response");
            ClusterErrorResponse::simple(
                "nodes_stats_failed",
                format!("Failed to get nodes stats: {}", e),
            )
        })?;

        // Best-effort master node id
        let master_node_id = match cluster.cat_master().await {
            Ok(mid) => Some(mid),
            Err(e) => {
                tracing::warn!(cluster_id = %cluster_id, error = %e, "Failed to get master node id for shards response");
                None
            }
        };

        let all_nodes = transform_nodes(&nodes_info, &nodes_stats, master_node_id.as_deref(), None);
        // Build quick lookup maps from node id -> name and name set for
        // normalizing node identifiers referenced by shards. Some cluster
        // APIs return node IDs (routing_nodes keys) while others return node
        // NAMES (cat/shards). Normalize all referenced identifiers to the
        // authoritative node NAMES produced by transform_nodes.
        let mut id_to_name: std::collections::HashMap<String, String> =
            std::collections::HashMap::new();
        let mut name_set: std::collections::HashSet<String> = std::collections::HashSet::new();
        for n in &all_nodes {
            id_to_name.insert(n.id.clone(), n.name.clone());
            name_set.insert(n.name.clone());
        }

        // Collect unique node identifiers referenced by shards on this page
        // (these may be node NAMES or node IDs depending on source). We'll
        // normalize them to node NAMES using the id_to_name map when
        // necessary.
        let referenced_raw: std::collections::HashSet<String> = items_with_details
            .iter()
            .filter_map(|s| s.node.clone())
            .collect();

        let referenced_node_names: std::collections::HashSet<String> = referenced_raw
            .into_iter()
            .map(|ident| {
                // If the identifier already matches a known name, keep it.
                if name_set.contains(&ident) {
                    ident
                } else if let Some(mapped) = id_to_name.get(&ident) {
                    // If it matches a node ID, map to the node NAME.
                    mapped.clone()
                } else {
                    // Unknown identifier - keep as-is so it shows up in the
                    // missing list (and we fail the request below).
                    ident
                }
            })
            .collect();

        // Filter nodes to those that are referenced (by NAME)
        let page_nodes: Vec<NodeInfoResponse> = all_nodes
            .into_iter()
            .filter(|n| referenced_node_names.contains(&n.name))
            .collect();

        // Verify we have NodeInfo for every referenced node name. If any are
        // missing, fail the request so the frontend receives a clear error.
        let present_names: std::collections::HashSet<String> =
            page_nodes.iter().map(|n| n.name.clone()).collect();

        let missing_raw: Vec<String> = referenced_node_names
            .into_iter()
            .filter(|name| !present_names.contains(name))
            .collect();

        if !missing_raw.is_empty() {
            // Map missing identifiers (which may be node IDs) to node NAMES when
            // possible so the error message contains friendly node names.
            let missing_names: Vec<String> = missing_raw
                .iter()
                .map(|ident| {
                    // If this identifier is actually a node ID we can map it to a
                    // name via id_to_name. Otherwise, keep the identifier as-is.
                    id_to_name
                        .get(ident)
                        .cloned()
                        .unwrap_or_else(|| ident.clone())
                })
                .collect();

            tracing::error!(
                cluster_id = %cluster_id,
                missing_raw = ?missing_raw,
                missing_names = ?missing_names,
                "Missing NodeInfo for referenced nodes in shards page"
            );

            return Err(ClusterErrorResponse::simple(
                "nodes_missing",
                format!(
                    "Missing NodeInfo for nodes referenced by shards: {}. Backend must supply full node metadata.",
                    missing_names.join(", ")
                ),
            ));
        }

        page_nodes
    };

    // Build paginated shards wrapper and include nodes
    let paginated_shards = PaginatedShardsResponse {
        items: items_with_details,
        total: paginated.total,
        page: paginated.page,
        page_size: paginated.page_size,
        total_pages: paginated.total_pages,
    };

    let response = PaginatedShardsWithNodes::new(&paginated_shards, nodes_vec);

    Ok(Json(response))
}

/// Get per-node shard count summary for a cluster
///
/// Returns a lightweight summary of primary, replica, and unassigned shard counts
/// per node. Uses a single `_cat/shards` call and aggregates client-side.
/// Does not return individual shard objects — use `/nodes/{node_id}/shards` for that.
///
/// # Requirements
///
/// Validates: Requirements 4.9
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/nodes/shard-summary",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID")
    ),
    responses(
        (status = 200, body = Vec<NodeShardSummary>),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext), fields(cluster_id = %cluster_id))]
pub async fn get_nodes_shard_summary(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<Vec<NodeShardSummary>>, ClusterErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        "Getting per-node shard summary"
    );

    check_cluster_access(&cluster_id, &user_ext)?;

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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Short-circuit if cluster is known to be inaccessible
    if !cluster.accessible {
        return Err(ClusterErrorResponse::unavailable(
            &cluster_id,
            cluster.accessible_reason.clone(),
        ));
    }

    let shards_data = cluster.cat_shards().await.map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to fetch cat shards for shard summary"
        );
        ClusterErrorResponse::simple(
            "shards_failed",
            format!("Failed to get shard information: {}", e),
        )
    })?;

    let summary = aggregate_shards_by_node(&shards_data);

    tracing::debug!(
        cluster_id = %cluster_id,
        node_count = summary.len(),
        "Per-node shard summary retrieved successfully"
    );

    Ok(Json(summary))
}

/// Get shards allocated on a specific node
///
/// Returns shard information for shards on the specified node only.
/// This is more efficient than fetching all shards and filtering client-side.
///
/// # Requirements
///
/// Validates: Requirements 4.8
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/nodes/{node_id}/shards",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("node_id" = String, Path, description = "Node ID")
    ),
    responses(
        (status = 200, body = Vec<ShardInfoResponse>),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext), fields(cluster_id = %cluster_id, node_id = %node_id))]
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found: {}", cluster_id, e),
            )
        })?;

    // Use _cluster/state/routing_nodes for native JSON API
    let state_response = cluster
        .cluster_state_routing_nodes(None)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                node_id = %node_id,
                error = %e,
                "Failed to get cluster state with routing nodes"
            );
            ClusterErrorResponse::simple(
                "shards_failed",
                format!("Failed to get shard information: {}", e),
            )
        })?;

    // Transform to flat shard list
    let all_shards = transform_routing_nodes_to_shards(&state_response);

    // Filter by node name (node_id in path is node name)
    let node_lower = node_id.to_lowercase();
    let shards: Vec<ShardInfoResponse> = all_shards
        .into_iter()
        .filter(|shard| {
            shard
                .node
                .as_ref()
                .map(|n| n.to_lowercase() == node_lower)
                .unwrap_or(false)
        })
        .collect();

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
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/proxy/{path}",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("path" = String, Path, description = "Elasticsearch API path")
    ),
    responses(
        (status = 200, description = "Elasticsearch response"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[axum::debug_handler]
#[instrument(skip(state, query, body), fields(cluster_id = %cluster_id, http_method = %method))]
pub async fn proxy_request(
    State(state): State<ClusterState>,
    Path((cluster_id, path)): Path<(String, String)>,
    method: Method,
    axum::extract::RawQuery(query): axum::extract::RawQuery,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
    request_id_ext: Option<axum::Extension<RequestId>>,
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

    // Use centralized proxy helper which performs client selection, timeouts,
    // response body read timeout, and emits an audit entry when the request
    // is actually forwarded to Elasticsearch. The helper returns status,
    // headers and body so we can construct the Axum response here.
    let user_roles: Vec<String> = user_ext
        .as_ref()
        .map(|u| u.0 .0.roles.clone())
        .unwrap_or_default();

    let request_id = request_id_ext
        .as_ref()
        .map(|r| r.0.as_str().to_string())
        .unwrap_or_default();

    let (status, headers, body_bytes, _matched_role_label) = match state
        .cluster_manager
        .proxy_request_with_audit(
            &cluster_id,
            method.clone(),
            &full_path,
            body.map(|j| j.0),
            user_ext.as_ref().map(|u| u.0 .0.id.clone()),
            &user_roles,
            &request_id,
            state.audit_log,
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            use crate::cluster::ProxyRequestError;

            match e {
                ProxyRequestError::AccessDenied => {
                    tracing::warn!(error = %"access_denied", cluster_id = %cluster_id, "Access denied: no matching role client");
                    return Err(ClusterErrorResponse::simple(
                        "access_denied",
                        format!("Access denied to cluster: {}", cluster_id),
                    ));
                }
                ProxyRequestError::ProxyTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "PROXY: request timed out");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_timeout",
                        format!(
                            "Elasticsearch request timed out: {} {} (timeout: 30s)",
                            method, full_path
                        ),
                    ));
                }
                ProxyRequestError::RequestFailed(reason) => {
                    tracing::warn!(error = %reason, "PROXY: request failed");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_failed",
                        format!(
                            "Elasticsearch request failed: {} {} - {}",
                            method, full_path, reason
                        ),
                    ));
                }
                ProxyRequestError::ResponseReadTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "PROXY: Timeout reading response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_timeout",
                        "Timeout reading Elasticsearch response body",
                    ));
                }
                ProxyRequestError::ResponseReadFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "PROXY: Failed to read response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_failed",
                        format!("Failed to read response body: {}", reason),
                    ));
                }
                ProxyRequestError::Other(reason) => {
                    tracing::warn!(error = %reason, "PROXY: Unexpected error");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_failed",
                        format!("Failed to proxy request: {}", reason),
                    ));
                }
            }
        }
    };

    // If upstream returned an error status, map it to a structured error
    if status.is_client_error() || status.is_server_error() {
        let error_body = String::from_utf8_lossy(&body_bytes).to_string();
        tracing::warn!(
            cluster_id = %cluster_id,
            method = %method,
            path = %full_path,
            status = status.as_u16(),
            response_body = %error_body,
            "Elasticsearch API returned error status"
        );
        return Err(ClusterErrorResponse::simple(
            "elasticsearch_error",
            error_body,
        ));
    }

    // Build Axum response using headers returned by helper
    let mut axum_response = Response::builder().status(status);
    let mut has_content_type = false;
    for (key, value) in headers.iter() {
        let key_lower = key.as_str().to_lowercase();

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

    if !has_content_type {
        axum_response = axum_response.header("content-type", "application/json");
    }

    let axum_response = axum_response
        .body(axum::body::Body::from(body_bytes))
        .map_err(|e| {
            tracing::error!(error = %e, "Failed to build response");
            ClusterErrorResponse::simple(
                "response_build_failed",
                format!("Failed to build response: {}", e),
            )
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
#[utoipa::path(
    post,
    path = "/clusters/{cluster_id}/relocate",
    params(("cluster_id" = String, Path, description = "Cluster ID")),
    request_body = RelocateShardRequest,
    responses(
        (status = 200, description = "Shard relocation initiated"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext, req), fields(cluster_id = %cluster_id, index = %req.index, shard = req.shard))]
pub async fn relocate_shard(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<crate::auth::middleware::AuthenticatedUser>>,
    request_id_ext: Option<axum::Extension<crate::middleware::logging::RequestId>>,
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
        ClusterErrorResponse::simple(
            "authentication_required",
            "Authentication is required for this operation",
        )
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

    // Get the cluster (ensure it exists)
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
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found. Please verify the cluster ID and ensure the cluster is configured.", cluster_id),
            )
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

    // Select per-request client based on user roles (first-match-wins). If no match,
    // return local 403 and do NOT forward or audit that denial. `user` was extracted earlier.

    // Determine RequestId string for audit (use empty string if missing)
    let request_id = request_id_ext
        .as_ref()
        .map(|r| r.0.as_str().to_string())
        .unwrap_or_default();

    // Use centralized proxy helper which performs client selection, timeouts,
    // response read timeout, and emits an audit entry when the request
    // actually reaches Elasticsearch.
    let (status, _headers, body_vec, _matched_role) = match state
        .cluster_manager
        .proxy_request_with_audit(
            &cluster_id,
            Method::POST,
            "/_cluster/reroute",
            Some(reroute_command.clone()),
            Some(user.id.clone()),
            &user.roles,
            &request_id,
            state.audit_log,
        )
        .await
    {
        Ok(r) => r,
        Err(e) => {
            use crate::cluster::ProxyRequestError;

            match e {
                ProxyRequestError::AccessDenied => {
                    tracing::warn!(error = %"access_denied", cluster_id = %cluster_id, "Access denied: no matching role client");
                    return Err(ClusterErrorResponse::simple(
                        "access_denied",
                        "You do not have permissions to perform this operation on the requested cluster",
                    ));
                }
                ProxyRequestError::ProxyTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "RELOCATE: request timed out");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_timeout",
                        "Elasticsearch request timed out: POST /_cluster/reroute (timeout: 30s)"
                            .to_string(),
                    ));
                }
                ProxyRequestError::RequestFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "RELOCATE: request failed");
                    // Map to user-friendly relocation_failed message
                    let message = if reason.contains("timeout") || reason.contains("timed out") {
                        "Shard relocation request timed out. The cluster may be slow or unreachable. Please check cluster health and try again.".to_string()
                    } else if reason.contains("connection") || reason.contains("connect") {
                        "Cannot connect to cluster. Please verify the cluster is running and accessible.".to_string()
                    } else if reason.contains("unauthorized") || reason.contains("401") {
                        "Authentication failed. Please check your cluster credentials.".to_string()
                    } else if reason.contains("forbidden") || reason.contains("403") {
                        "Permission denied. You may not have the required permissions to relocate shards.".to_string()
                    } else {
                        format!("Failed to relocate shard: {}. Please check cluster logs for more details.", reason)
                    };

                    return Err(ClusterErrorResponse::simple("relocation_failed", message));
                }
                ProxyRequestError::ResponseReadTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "Timeout reading reroute response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_timeout",
                        "Timeout reading Elasticsearch response body",
                    ));
                }
                ProxyRequestError::ResponseReadFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "Failed to read reroute response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_failed",
                        format!("Failed to read response: {}", reason),
                    ));
                }
                ProxyRequestError::Other(reason) => {
                    tracing::warn!(error = %reason, "RELOCATE: Unexpected error");
                    return Err(ClusterErrorResponse::simple(
                        "relocation_failed",
                        format!("Failed to relocate shard: {}", reason),
                    ));
                }
            }
        }
    };

    // Parse response body
    let body: Value = serde_json::from_slice(&body_vec).map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to parse reroute response"
        );
        ClusterErrorResponse::simple(
            "response_parse_failed",
            format!("Failed to parse response: {}", e),
        )
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

        return Err(ClusterErrorResponse::simple(
            "elasticsearch_error",
            user_message,
        ));
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
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Index name is required. Please provide a valid index name.",
        ));
    }

    // Validate index name format (basic validation)
    // Elasticsearch index names must be lowercase and cannot contain certain characters
    if req.index.chars().any(|c| c.is_uppercase()) {
        tracing::warn!(index = %req.index, "Validation failed: index name contains uppercase characters");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            format!(
                "Index name '{}' contains uppercase characters. Elasticsearch index names must be lowercase.",
                req.index
            ),
        ));
    }

    // Check for invalid characters in index name
    let invalid_chars = ['\\', '/', '*', '?', '"', '<', '>', '|', ' ', ',', '#'];
    if let Some(invalid_char) = req.index.chars().find(|c| invalid_chars.contains(c)) {
        tracing::warn!(index = %req.index, "Validation failed: index name contains invalid characters");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            format!(
                "Index name '{}' contains invalid character '{}'. Index names cannot contain: \\ / * ? \" < > | space , #",
                req.index, invalid_char
            ),
        ));
    }

    // Validate from_node is not empty
    if req.from_node.is_empty() {
        tracing::warn!("Validation failed: from_node is empty");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Source node ID is required. Please select a source node.",
        ));
    }

    // Validate to_node is not empty
    if req.to_node.is_empty() {
        tracing::warn!("Validation failed: to_node is empty");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Destination node ID is required. Please select a destination node.",
        ));
    }

    // Validate source and destination are different
    if req.from_node == req.to_node {
        tracing::warn!(
            from_node = %req.from_node,
            to_node = %req.to_node,
            "Validation failed: source and destination nodes are the same"
        );
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            format!(
                "Source and destination nodes must be different (both are {}). Please select a different destination node.",
                req.from_node
            ),
        ));
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
        let error = ClusterErrorResponse::simple("cluster_not_found", "Cluster 'test' not found");

        let json = serde_json::to_string(&error).expect("serialize ClusterErrorResponse to JSON");
        assert!(json.contains("\"error\":\"cluster_not_found\""));
        assert!(json.contains("\"message\":\"Cluster 'test' not found\""));
    }

    #[test]
    fn test_cluster_error_response_deserialization() {
        let json = r#"{"error":"proxy_failed","message":"Connection timeout"}"#;
        let error: ClusterErrorResponse =
            serde_json::from_str(json).expect("deserialize ClusterErrorResponse from JSON");

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

        let json = serde_json::to_string(&req).expect("serialize RelocateShardRequest to JSON");
        assert!(json.contains("\"index\":\"test-index\""));
        assert!(json.contains("\"shard\":0"));
        assert!(json.contains("\"from_node\":\"node-1\""));
        assert!(json.contains("\"to_node\":\"node-2\""));
    }

    #[test]
    fn test_relocate_shard_request_deserialization() {
        let json = r#"{"index":"logs-2024","shard":1,"from_node":"node-a","to_node":"node-b"}"#;
        let req: RelocateShardRequest =
            serde_json::from_str(json).expect("deserialize RelocateShardRequest from JSON");

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
        let err = result.expect_err("relocation request validation should fail for empty index");
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
        let err =
            result.expect_err("relocation request validation should fail for uppercase index");
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
        let err =
            result.expect_err("relocation request validation should fail for empty from_node");
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
        let err = result.expect_err("relocation request validation should fail for empty to_node");
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
        let err = result.expect_err(
            "relocation request validation should fail when from/to nodes are the same",
        );
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

    #[test]
    fn test_get_shards_includes_nodes_for_page() {
        use serde_json::json;
        use std::collections::HashSet;

        // Build paginated shards items (two assigned to node1/node2 and one unassigned)
        let items = vec![
            ShardInfoResponse {
                index: "idx-a".to_string(),
                shard: 0,
                primary: true,
                state: "STARTED".to_string(),
                node: Some("node1".to_string()),
                docs: 0,
                store: 0,
            },
            ShardInfoResponse {
                index: "idx-a".to_string(),
                shard: 1,
                primary: true,
                state: "STARTED".to_string(),
                node: Some("node2".to_string()),
                docs: 0,
                store: 0,
            },
            ShardInfoResponse {
                index: "idx-a".to_string(),
                shard: 2,
                primary: true,
                state: "UNASSIGNED".to_string(),
                node: None,
                docs: 0,
                store: 0,
            },
        ];

        let paginated = PaginatedShardsResponse::new(items.clone(), 1, 10);

        // Build nodes_info and nodes_stats matching node names referenced by shards
        let nodes_info = json!({
            "nodes": {
                "n1": { "name": "node1", "roles": ["data"], "ip": "10.0.0.1", "version": "8.0.0" },
                "n2": { "name": "node2", "roles": ["data"], "ip": "10.0.0.2", "version": "8.0.0" }
            }
        });

        let nodes_stats = json!({
            "nodes": {
                "n1": {
                    "jvm": { "mem": { "heap_used_in_bytes": 1000, "heap_max_in_bytes": 2000 }, "uptime_in_millis": 1000 },
                    "fs": { "total": { "total_in_bytes": 10000, "available_in_bytes": 5000 } },
                    "os": { "cpu": { "percent": 10, "load_average": { "1m": 0.5 } } }
                },
                "n2": {
                    "jvm": { "mem": { "heap_used_in_bytes": 1500, "heap_max_in_bytes": 3000 }, "uptime_in_millis": 2000 },
                    "fs": { "total": { "total_in_bytes": 20000, "available_in_bytes": 10000 } },
                    "os": { "cpu": { "percent": 20, "load_average": { "1m": 0.7 } } }
                }
            }
        });

        // Simulate handler logic: transform nodes and filter by referenced names
        let all_nodes = transform_nodes(&nodes_info, &nodes_stats, Some("n1"), None);

        let referenced_node_names: HashSet<String> = paginated
            .items
            .iter()
            .filter_map(|s| s.node.clone())
            .collect();

        let nodes_vec: Vec<NodeInfoResponse> = all_nodes
            .into_iter()
            .filter(|n| referenced_node_names.contains(&n.name))
            .collect();

        let response = PaginatedShardsWithNodes::new(&paginated, nodes_vec);

        // Expect nodes for node1 and node2 to be included; unassigned shard should not require a node
        assert_eq!(response.nodes.len(), 2);
        let names: HashSet<String> = response.nodes.into_iter().map(|n| n.name).collect();
        assert!(names.contains("node1"));
        assert!(names.contains("node2"));
    }
}
