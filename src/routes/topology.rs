use crate::auth::middleware::AuthenticatedUser;
use crate::routes::clusters::transform::ShardInfoResponse;
use axum::{
    extract::{Extension, Path, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

pub mod generator;
mod layout;

use generator::generate_tiles;
use tokio::sync::OwnedSemaphorePermit;

// Use camelCase JSON keys so frontend can keep using the same shape while keeping
// idiomatic Rust field names.
#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TileRequestEntry {
    pub x: i32,
    pub y: i32,
    pub lod: String,
    pub client_version: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TileBatchRequest {
    pub tile_requests: Vec<TileRequestEntry>,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TileBatchResponse {
    pub tiles: Vec<generator::TilePayload>,
    pub server_version: String,
}

#[utoipa::path(
    post,
    path = "/clusters/{cluster_id}/topology/tiles",
    params(("cluster_id" = String, Path, description = "Cluster ID")),
    request_body = TileBatchRequest,
    responses(
        (status = 200, body = TileBatchResponse),
        (status = 400, body = crate::routes::clusters::ClusterErrorResponse),
        (status = 401, body = crate::routes::clusters::ClusterErrorResponse)
    ),
    tag = "Clusters"
)]

/// POST /topology/tiles
/// Currently uses a minimal server-side generator that computes positions by
/// ported layout and intersects nodes with tile bounding boxes. This is the
/// first step toward a full tile generator backed by ClusterManager.
pub async fn post_tiles(
    State(state): State<crate::routes::ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<Extension<AuthenticatedUser>>,
    Json(body): Json<TileBatchRequest>,
) -> Result<
    (
        axum::http::StatusCode,
        axum::http::HeaderMap,
        Json<TileBatchResponse>,
    ),
    crate::routes::clusters::ClusterErrorResponse,
> {
    // Enforce cluster access for the requesting user (Open mode allows all access)
    crate::routes::clusters::check_cluster_access(&cluster_id, &user_ext)?;

    // Collect requests as tuples for generator
    let requests: Vec<(i32, i32, &str, Option<String>)> = body
        .tile_requests
        .iter()
        .map(|r| (r.x, r.y, r.lod.as_str(), r.client_version.clone()))
        .collect();

    // Enforce a maximum number of requested tiles per call to protect the server
    // during rollout of server-side generation. Default limit is 64 if not set in config.
    let max_tiles = state.topology_max_tiles_per_request;
    if requests.len() > max_tiles {
        tracing::warn!(
            requested = requests.len(),
            max = max_tiles,
            "Too many tiles requested in a single call"
        );
        return Err(crate::routes::clusters::ClusterErrorResponse {
            error: "too_many_tiles".to_string(),
            message: format!(
                "Request contains {} tiles which exceeds the allowed maximum of {}",
                requests.len(),
                max_tiles
            ),
        });
    }

    // Attempt to fetch cluster nodes and shards from ClusterManager via ClusterState
    // If fetching fails, fall back to synthetic generator behavior (empty tiles)
    let mut tiles = Vec::new();

    // Acquire a ClusterConnection for the requested cluster
    match state.cluster_manager.get_cluster(&cluster_id).await {
        Ok(cluster_conn) => {
            // Fetch nodes_info and nodes_stats via cluster connection
            let nodes_info_opt = cluster_conn.nodes_info().await.ok();
            let nodes_stats_opt = cluster_conn.nodes_stats().await.ok();

            if let (Some(nodes_info), Some(nodes_stats)) = (nodes_info_opt, nodes_stats_opt) {
                // Get master node id if available
                let master_node = cluster_conn.cat_master().await.ok();
                let master_node_ref = master_node.as_deref();

                let transformed = crate::routes::clusters::transform::transform_nodes(
                    &nodes_info,
                    &nodes_stats,
                    master_node_ref,
                    None,
                );

                // Get routing nodes for shards
                let routing = cluster_conn.cluster_state_routing_nodes(None).await.ok();
                let shards: Vec<ShardInfoResponse> = routing
                    .as_ref()
                    .map(|r| {
                        crate::routes::clusters::transform::transform_routing_nodes_to_shards(r)
                    })
                    .unwrap_or_default();

                // Build shards_by_node map
                let mut shards_by_node: std::collections::HashMap<String, Vec<ShardInfoResponse>> =
                    std::collections::HashMap::new();
                for s in shards.iter() {
                    if let Some(node) = &s.node {
                        shards_by_node
                            .entry(node.clone())
                            .or_default()
                            .push(s.clone());
                    } else {
                        shards_by_node
                            .entry(layout::UNASSIGNED_KEY.to_string())
                            .or_default()
                            .push(s.clone());
                    }
                }

                // Generate tiles (default grouping: none). Use tile cache keyed by cluster_generation
                let grouping = layout::GroupingConfig {
                    attribute: layout::GroupingAttribute::None,
                    value: None,
                };

                // Compute cluster generation id for invalidation
                let cluster_generation =
                    generator::compute_cluster_generation(&transformed, &shards_by_node);

                // Try to satisfy requests from cache
                let mut maybe_tiles: Vec<Option<generator::TilePayload>> = Vec::new();
                for (x, y, lod, client_version) in requests.iter() {
                    let key = format!(
                        "tile:{}:{}:{}:{}:{}",
                        cluster_id, cluster_generation, lod, x, y
                    );
                    if let Some(cached) = state.tile_cache.get(&key).await {
                        // moka returns a cloneable value synchronously for future::Cache::get
                        // Try to deserialize cached tile payload
                        match serde_json::from_value::<generator::TilePayload>(cached) {
                            Ok(mut payload) => {
                                // Recompute unchanged semantics based on current client_version
                                let client_matches = client_version
                                    .as_ref()
                                    .map(|cv| cv == &payload.version)
                                    .unwrap_or(false);
                                if client_matches {
                                    payload.unchanged = true;
                                    // Clear heavy payload bodies when unchanged
                                    payload.nodes_meta = None;
                                    payload.edges = None;
                                    payload.shards = None;
                                } else {
                                    payload.unchanged = false;
                                }
                                maybe_tiles.push(Some(payload));
                            }
                            Err(_) => {
                                maybe_tiles.push(None);
                            }
                        }
                    } else {
                        maybe_tiles.push(None);
                    }
                }

                // If all tiles present in cache, use them
                if maybe_tiles.iter().all(|t| t.is_some()) {
                    tiles = maybe_tiles.into_iter().map(|t| t.expect("checked above: all elements are Some(TilePayload) by .all(|t| t.is_some())")).collect();
                } else {
                    // Before performing expensive generation, acquire a concurrency permit
                    // from the server-wide topology semaphore. Use a timeout to avoid
                    // hanging requests when the server is saturated.
                    let sem = state.topology_generation_semaphore.clone();
                    // Permit acquire timeout (seconds) - configurable via ClusterState
                    let acquire_secs = state.topology_generation_acquire_timeout_seconds;
                    let acquire_timeout = std::time::Duration::from_secs(acquire_secs);
                    match tokio::time::timeout(acquire_timeout, sem.acquire_owned()).await {
                        Ok(Ok(permit)) => {
                            // Hold the permit while generating tiles. The OwnedSemaphorePermit
                            // will be released when it is dropped (end of scope or explicit drop).
                            let _permit: OwnedSemaphorePermit = permit;

                            tiles = generate_tiles(
                                &requests,
                                &transformed,
                                &shards_by_node,
                                &grouping,
                                &cluster_generation,
                            );

                            for tile in tiles.iter() {
                                let key = format!(
                                    "tile:{}:{}:{}:{}:{}",
                                    cluster_id, cluster_generation, tile.lod, tile.x, tile.y
                                );
                                if let Ok(val) = serde_json::to_value(tile) {
                                    // moka::future::Cache::insert is async; await so the value
                                    // is actually stored before we return. Previously the
                                    // future was dropped which made the cache appear empty
                                    // to subsequent requests and caused test flakes.
                                    let _ = state.tile_cache.insert(key, val).await;
                                }
                            }
                            // Permit dropped here when _permit goes out of scope
                        }
                        Ok(Err(e)) => {
                            tracing::error!(error = %e, "Semaphore closed unexpectedly");
                            return Err(crate::routes::clusters::ClusterErrorResponse {
                                error: "semaphore_error".to_string(),
                                message: format!("Failed to acquire generation permit: {}", e),
                            });
                        }
                        Err(_) => {
                            tracing::warn!("Timed out waiting for generation permit");
                            return Err(crate::routes::clusters::ClusterErrorResponse {
                                error: "generation_concurrency_limited".to_string(),
                                message: "Server is currently handling maximum concurrent tile generations; try again later".to_string(),
                            });
                        }
                    }
                }
            }
        }
        Err(_) => tracing::warn!(cluster = %cluster_id, "Cluster not found for tile generation"),
    }

    // If tiles empty, return empty payloads matching requests to avoid frontend errors
    if tiles.is_empty() {
        for (x, y, lod, client_version) in requests.iter() {
            let version = format!("{}-{}-{}", lod, x, y);
            let client_matches = client_version
                .as_ref()
                .map(|cv| cv == &version)
                .unwrap_or(false);
            tiles.push(generator::TilePayload {
                x: *x,
                y: *y,
                lod: (*lod).to_string(),
                version: version.clone(),
                unchanged: client_matches,
                nodes_meta: None,
                edges: None,
                shards: None,
            });
        }
    }

    let response = TileBatchResponse {
        tiles,
        server_version: "dev".to_string(),
    };

    // Proactively set cache-control headers to avoid browsers/proxies serving
    // stale tile payloads. Clients should still rely on the payload's version
    // string for definitive cache semantics, but instructing intermediaries
    // not to store tile responses reduces risk of cache-based misinformation.
    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::CACHE_CONTROL,
        axum::http::HeaderValue::from_static("no-store, must-revalidate"),
    );
    headers.insert(
        axum::http::header::PRAGMA,
        axum::http::HeaderValue::from_static("no-cache"),
    );
    headers.insert(
        axum::http::header::EXPIRES,
        axum::http::HeaderValue::from_static("0"),
    );

    Ok((axum::http::StatusCode::OK, headers, Json(response)))
}

pub async fn get_node(
    State(_state): State<()>,
    axum::extract::Path((id,)): axum::extract::Path<(String,)>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    let lod = params.get("lod").cloned().unwrap_or_else(|| "L1".into());
    let payload = serde_json::json!({ "id": id, "lod": lod, "shards": [] });
    (axum::http::StatusCode::OK, Json(payload))
}
