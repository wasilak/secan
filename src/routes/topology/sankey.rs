use crate::auth::middleware::AuthenticatedUser;
use crate::routes::clusters::transform::ShardInfoResponse;
use axum::{
    extract::{Extension, Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use utoipa::ToSchema;

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

/// Ranking criterion used to select the top-N indices.
#[derive(Debug, Deserialize, Serialize, ToSchema, Default, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum SankeySortBy {
    /// Total shard count (primary + replica). Default.
    #[default]
    Shards,
    /// Primary shard count only.
    Primary,
    /// Replica shard count only.
    Replicas,
    /// Total store size in bytes.
    Store,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase", default)]
pub struct SankeyQueryParams {
    /// Maximum number of top indices to include. 0 shows nothing (empty diagram).
    pub top_indices: u32,
    /// Whether to include a synthetic "Unassigned" node for unassigned shards.
    pub include_unassigned: bool,
    /// Comma-separated node roles to filter (currently unused — reserved).
    pub roles: Option<String>,
    /// Comma-separated shard states to filter (e.g. "STARTED,UNASSIGNED").
    pub states: Option<String>,
    /// When true, dot-prefixed (special/system) indices are excluded before
    /// the top-N ranking so the limit applies only to non-special indices.
    pub exclude_special: bool,
    /// Criterion used to rank and select the top-N indices.
    pub sort_by: SankeySortBy,
}

impl Default for SankeyQueryParams {
    fn default() -> Self {
        Self {
            top_indices: 10,
            include_unassigned: true,
            roles: None,
            states: None,
            exclude_special: false,
            sort_by: SankeySortBy::Shards,
        }
    }
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SankeyNodeResponse {
    pub id: String,
    pub kind: String, // "index" | "node" | "unassigned"
    pub total_shards: u32,
    pub primary_shards: u32,
    pub replica_shards: u32,
    pub store_bytes: u64,
}

#[derive(Debug, Serialize, ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SankeyLinkResponse {
    pub source: String,
    pub target: String,
    pub total_shards: u32,
    pub primary_shards: u32,
    pub replica_shards: u32,
}

#[derive(Debug, Serialize, ToSchema, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SankeyMetaResponse {
    pub truncated: bool,
    pub displayed_indices: usize,
    pub total_indices: usize,
    pub total_nodes: usize,
    pub total_links: usize,
}

#[derive(Debug, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SankeyDataResponse {
    pub nodes: Vec<SankeyNodeResponse>,
    pub links: Vec<SankeyLinkResponse>,
    pub meta: SankeyMetaResponse,
}

// ---------------------------------------------------------------------------
// Pure aggregation logic
// ---------------------------------------------------------------------------

/// Aggregates a flat list of shards into Sankey nodes and links.
///
/// This is a pure function with no I/O — all HTTP / cluster concerns are
/// handled by the handler below.  Keeping it pure makes unit testing trivial.
pub fn aggregate_sankey_data(
    shards: &[ShardInfoResponse],
    params: &SankeyQueryParams,
) -> SankeyDataResponse {
    // No clamping — frontend enforces [0, totalIndices]. 0 means show nothing.
    let top_n = params.top_indices as usize;

    // Filter by shard states if provided
    let state_filter: Option<Vec<String>> = params.states.as_ref().map(|s| {
        s.split(',')
            .map(|st| st.trim().to_uppercase())
            .filter(|st| !st.is_empty())
            .collect()
    });

    let filtered_shards: Vec<&ShardInfoResponse> = shards
        .iter()
        .filter(|s| {
            if let Some(ref states) = state_filter {
                states.contains(&s.state.to_uppercase())
            } else {
                true
            }
        })
        .filter(|s| !params.exclude_special || !s.index.starts_with('.'))
        .collect();

    // -------------------------------------------------------------------
    // Step 1: aggregate per (index, node) pair
    // Key: (index_name, node_name_or_UNASSIGNED)
    // -------------------------------------------------------------------
    const UNASSIGNED_ID: &str = "Unassigned";

    #[derive(Default)]
    struct LinkAccum {
        primary: u32,
        replica: u32,
        store: u64,
    }

    // link_map: (index, target_node) -> counts
    let mut link_map: HashMap<(String, String), LinkAccum> = HashMap::new();
    // index_store: index -> total store bytes
    let mut index_store: HashMap<String, u64> = HashMap::new();

    for shard in &filtered_shards {
        let target = shard
            .node
            .clone()
            .unwrap_or_else(|| UNASSIGNED_ID.to_string());

        // Skip unassigned if not requested
        if target == UNASSIGNED_ID && !params.include_unassigned {
            continue;
        }

        let entry = link_map.entry((shard.index.clone(), target)).or_default();
        if shard.primary {
            entry.primary += 1;
        } else {
            entry.replica += 1;
        }
        entry.store += shard.store;

        *index_store.entry(shard.index.clone()).or_default() += shard.store;
    }

    // -------------------------------------------------------------------
    // Step 2: compute per-index totals and sort by total_shards descending
    // -------------------------------------------------------------------
    let mut index_totals: HashMap<String, (u32, u32, u64)> = HashMap::new(); // (primary, replica, store)
    for ((index, _target), acc) in &link_map {
        let entry = index_totals.entry(index.clone()).or_default();
        entry.0 += acc.primary;
        entry.1 += acc.replica;
        entry.2 += acc.store;
    }

    let total_indices = index_totals.len();

    let mut sorted_indices: Vec<String> = index_totals.keys().cloned().collect();
    sorted_indices.sort_by(|a, b| {
        let score = |k: &str| -> u64 {
            let (primary, replica, store) = index_totals[k];
            match params.sort_by {
                SankeySortBy::Shards => (primary + replica) as u64,
                SankeySortBy::Primary => primary as u64,
                SankeySortBy::Replicas => replica as u64,
                SankeySortBy::Store => store,
            }
        };
        score(b).cmp(&score(a)).then_with(|| a.cmp(b))
    });

    let truncated = sorted_indices.len() > top_n;
    let top_indices: std::collections::HashSet<String> =
        sorted_indices.into_iter().take(top_n).collect();

    let displayed_indices = top_indices.len();

    // -------------------------------------------------------------------
    // Step 3: build links (only for top indices)
    // -------------------------------------------------------------------
    let mut links: Vec<SankeyLinkResponse> = Vec::new();
    let mut node_totals: HashMap<String, (u32, u32, u64)> = HashMap::new(); // node -> (primary, replica, store)

    for ((index, target), acc) in &link_map {
        if !top_indices.contains(index) {
            continue;
        }
        let total = acc.primary + acc.replica;
        links.push(SankeyLinkResponse {
            source: index.clone(),
            target: target.clone(),
            total_shards: total,
            primary_shards: acc.primary,
            replica_shards: acc.replica,
        });

        let ne = node_totals.entry(target.clone()).or_default();
        ne.0 += acc.primary;
        ne.1 += acc.replica;
        ne.2 += acc.store;
    }

    // Sort links for deterministic output
    links.sort_by(|a, b| {
        a.source
            .cmp(&b.source)
            .then_with(|| a.target.cmp(&b.target))
    });

    // -------------------------------------------------------------------
    // Step 4: build index nodes
    // -------------------------------------------------------------------
    let mut nodes: Vec<SankeyNodeResponse> = Vec::new();

    for index in &top_indices {
        let (primary, replica, store) = index_totals[index];
        nodes.push(SankeyNodeResponse {
            id: index.clone(),
            kind: "index".to_string(),
            total_shards: primary + replica,
            primary_shards: primary,
            replica_shards: replica,
            store_bytes: store,
        });
    }

    // Build cluster node nodes (and unassigned)
    for (node_id, (primary, replica, store)) in &node_totals {
        let kind = if node_id == UNASSIGNED_ID {
            "unassigned".to_string()
        } else {
            "node".to_string()
        };
        nodes.push(SankeyNodeResponse {
            id: node_id.clone(),
            kind,
            total_shards: primary + replica,
            primary_shards: *primary,
            replica_shards: *replica,
            store_bytes: *store,
        });
    }

    // Sort nodes: indices first, then nodes, then unassigned
    nodes.sort_by(|a, b| {
        let order = |k: &str| match k {
            "index" => 0,
            "node" => 1,
            _ => 2,
        };
        order(&a.kind)
            .cmp(&order(&b.kind))
            .then_with(|| a.id.cmp(&b.id))
    });

    let total_nodes = node_totals.len();
    let total_links = links.len();

    SankeyDataResponse {
        nodes,
        links,
        meta: SankeyMetaResponse {
            truncated,
            displayed_indices,
            total_indices,
            total_nodes,
            total_links,
        },
    }
}

// ---------------------------------------------------------------------------
// HTTP handler
// ---------------------------------------------------------------------------

#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/topology/sankey",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("top_indices" = Option<u32>, Query, description = "Max indices to show (0 = nothing, default 10)"),
        ("include_unassigned" = Option<bool>, Query, description = "Include unassigned shards node (default true)"),
        ("roles" = Option<String>, Query, description = "Comma-separated node roles filter"),
        ("states" = Option<String>, Query, description = "Comma-separated shard states filter"),
    ),
    responses(
        (status = 200, body = SankeyDataResponse),
        (status = 400, body = crate::routes::clusters::ClusterErrorResponse),
        (status = 401, body = crate::routes::clusters::ClusterErrorResponse),
    ),
    tag = "Clusters"
)]
pub async fn get_sankey(
    State(state): State<crate::routes::ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<Extension<AuthenticatedUser>>,
    Query(params): Query<SankeyQueryParams>,
) -> Result<Json<SankeyDataResponse>, crate::routes::clusters::ClusterErrorResponse> {
    crate::routes::clusters::check_cluster_access(&cluster_id, &user_ext)?;

    tracing::debug!(
        cluster = %cluster_id,
        sort_by = ?params.sort_by,
        top_indices = params.top_indices,
        exclude_special = params.exclude_special,
        "Sankey request received"
    );

    let shards: Vec<ShardInfoResponse> = match state.cluster_manager.get_cluster(&cluster_id).await
    {
        Ok(cluster_conn) => {
            let routing = cluster_conn.cluster_state_routing_nodes(None).await.ok();
            routing
                .as_ref()
                .map(crate::routes::clusters::transform::transform_routing_nodes_to_shards)
                .unwrap_or_default()
        }
        Err(_) => {
            tracing::warn!(cluster = %cluster_id, "Cluster not found for sankey generation");
            Vec::new()
        }
    };

    let result = aggregate_sankey_data(&shards, &params);
    Ok(Json(result))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    fn make_shard(index: &str, node: Option<&str>, primary: bool, store: u64) -> ShardInfoResponse {
        ShardInfoResponse {
            index: index.to_string(),
            shard: 0,
            primary,
            state: "STARTED".to_string(),
            node: node.map(str::to_string),
            docs: 0,
            store,
        }
    }

    fn default_params() -> SankeyQueryParams {
        SankeyQueryParams::default()
    }

    #[test]
    fn test_empty_shards() {
        let result = aggregate_sankey_data(&[], &default_params());
        assert!(result.nodes.is_empty(), "expected no nodes");
        assert!(result.links.is_empty(), "expected no links");
        assert!(!result.meta.truncated);
        assert_eq!(result.meta.total_indices, 0);
    }

    #[test]
    fn test_basic_aggregation() {
        // 2 indices × 2 nodes = 4 shards
        let shards = vec![
            make_shard("idx-a", Some("node-1"), true, 100),
            make_shard("idx-a", Some("node-2"), false, 50),
            make_shard("idx-b", Some("node-1"), true, 200),
            make_shard("idx-b", Some("node-2"), false, 80),
        ];

        let result = aggregate_sankey_data(&shards, &default_params());

        // 2 index nodes + 2 cluster nodes = 4
        assert_eq!(result.nodes.len(), 4, "expected 4 nodes");
        // 2 indices × 2 nodes = 4 links
        assert_eq!(result.links.len(), 4, "expected 4 links");

        // Check totals for idx-a
        let idx_a = result
            .nodes
            .iter()
            .find(|n| n.id == "idx-a")
            .expect("idx-a node");
        assert_eq!(idx_a.total_shards, 2);
        assert_eq!(idx_a.primary_shards, 1);
        assert_eq!(idx_a.replica_shards, 1);

        assert!(!result.meta.truncated);
        assert_eq!(result.meta.total_indices, 2);
    }

    #[test]
    fn test_top_indices_truncation() {
        // Create 60 indices, each with 1 shard on node-1
        let shards: Vec<ShardInfoResponse> = (0..60)
            .map(|i| make_shard(&format!("idx-{:03}", i), Some("node-1"), true, 100))
            .collect();

        let params = SankeyQueryParams {
            top_indices: 50,
            ..Default::default()
        };

        let result = aggregate_sankey_data(&shards, &params);

        assert!(result.meta.truncated, "should be truncated");
        assert_eq!(result.meta.displayed_indices, 50);
        assert_eq!(result.meta.total_indices, 60);
        // 50 index nodes + 1 cluster node
        assert_eq!(
            result.nodes.iter().filter(|n| n.kind == "index").count(),
            50
        );
    }

    #[test]
    fn test_unassigned_included() {
        let shards = vec![
            make_shard("idx-a", Some("node-1"), true, 100),
            make_shard("idx-a", None, false, 0), // unassigned replica
        ];

        let params = SankeyQueryParams {
            include_unassigned: true,
            ..Default::default()
        };

        let result = aggregate_sankey_data(&shards, &params);

        let has_unassigned = result.nodes.iter().any(|n| n.kind == "unassigned");
        assert!(has_unassigned, "expected unassigned node to be present");
    }

    /// Verify that sort_by selects different top-N indices depending on the
    /// criterion when there are more indices than the limit.
    #[test]
    fn test_sort_by_primary_vs_shards() {
        // Build 6 indices with deliberately skewed characteristics so that
        // different sort criteria exclude different indices when top_n = 5.
        //
        // Scores (top_n = 5, so the LOWEST scorer is excluded):
        //   idx-many-replicas  : 1P + 9R = 10 total shards,  store=100
        //   idx-many-primary   : 7P + 0R =  7 total shards,  store=70
        //   idx-mid-shards-a   : 3P + 3R =  6 total shards,  store=60
        //   idx-mid-shards-b   : 2P + 3R =  5 total shards,  store=50
        //   idx-low-shards     : 1P + 1R =  2 total shards,  store=20
        //   idx-huge-store     : 0P + 1R =  1 total shard,   store=1_000_000
        //
        // sort_by=Shards:   order [10,7,6,5,2,1] → top 5 excludes idx-huge-store
        // sort_by=Primary:  order [7,3,2,1,1,0]  → top 5 excludes idx-huge-store
        //   (tie for last: idx-low-shards vs idx-huge-store; idx-low-shards wins on name)
        //   → top 5 excludes idx-huge-store
        //
        // sort_by=Store:    order [1M,100,70,60,50,20] → top 5 excludes idx-low-shards
        let shards = vec![
            // idx-many-replicas: 1P + 9R
            make_shard("idx-many-replicas", Some("node-1"), true, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            make_shard("idx-many-replicas", Some("node-1"), false, 10),
            // idx-many-primary: 7P + 0R
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            make_shard("idx-many-primary", Some("node-1"), true, 10),
            // idx-mid-shards-a: 3P + 3R
            make_shard("idx-mid-shards-a", Some("node-1"), true, 10),
            make_shard("idx-mid-shards-a", Some("node-1"), true, 10),
            make_shard("idx-mid-shards-a", Some("node-1"), true, 10),
            make_shard("idx-mid-shards-a", Some("node-1"), false, 10),
            make_shard("idx-mid-shards-a", Some("node-1"), false, 10),
            make_shard("idx-mid-shards-a", Some("node-1"), false, 10),
            // idx-mid-shards-b: 2P + 3R
            make_shard("idx-mid-shards-b", Some("node-1"), true, 10),
            make_shard("idx-mid-shards-b", Some("node-1"), true, 10),
            make_shard("idx-mid-shards-b", Some("node-1"), false, 10),
            make_shard("idx-mid-shards-b", Some("node-1"), false, 10),
            make_shard("idx-mid-shards-b", Some("node-1"), false, 10),
            // idx-low-shards: 1P + 1R, very low store
            make_shard("idx-low-shards", Some("node-1"), true, 10),
            make_shard("idx-low-shards", Some("node-1"), false, 10),
            // idx-huge-store: 0P + 1R, enormous store
            make_shard("idx-huge-store", Some("node-1"), false, 1_000_000),
        ];

        // ---- sort_by=Shards (top 5 by total shards) ----
        // Totals: many-replicas=10, many-primary=7, mid-a=6, mid-b=5, low-shards=2, huge-store=1
        // Top 5 should include everyone EXCEPT idx-huge-store (1 shard)
        let params_shards = SankeyQueryParams {
            top_indices: 5,
            sort_by: SankeySortBy::Shards,
            ..Default::default()
        };
        let result_shards = aggregate_sankey_data(&shards, &params_shards);
        let ids_shards: std::collections::HashSet<&str> = result_shards
            .nodes
            .iter()
            .filter(|n| n.kind == "index")
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(
            ids_shards.len(),
            5,
            "sort_by=Shards: expected exactly 5 index nodes"
        );
        assert!(
            !ids_shards.contains("idx-huge-store"),
            "sort_by=Shards should exclude idx-huge-store (only 1 shard)"
        );
        assert!(
            ids_shards.contains("idx-many-replicas"),
            "sort_by=Shards should include idx-many-replicas (10 shards)"
        );

        // ---- sort_by=Store (top 5 by store bytes) ----
        // Totals: huge-store=1_000_000, many-replicas=100, many-primary=70, mid-a=60, mid-b=50, low-shards=20
        // Top 5 should include everyone EXCEPT idx-low-shards (store=20)
        let params_store = SankeyQueryParams {
            top_indices: 5,
            sort_by: SankeySortBy::Store,
            ..Default::default()
        };
        let result_store = aggregate_sankey_data(&shards, &params_store);
        let ids_store: std::collections::HashSet<&str> = result_store
            .nodes
            .iter()
            .filter(|n| n.kind == "index")
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(
            ids_store.len(),
            5,
            "sort_by=Store: expected exactly 5 index nodes"
        );
        assert!(
            ids_store.contains("idx-huge-store"),
            "sort_by=Store should include idx-huge-store (store=1_000_000)"
        );
        assert!(
            !ids_store.contains("idx-low-shards"),
            "sort_by=Store should exclude idx-low-shards (store=20)"
        );

        // ---- sort_by=Primary (top 5 by primary shard count) ----
        // Primary counts: many-primary=7, mid-a=3, mid-b=2, many-replicas=1, low-shards=1, huge-store=0
        // Top 5: many-primary(7), mid-a(3), mid-b(2), many-replicas(1), low-shards(1) — tie at 1 broken by name alpha
        //        → idx-huge-store (0 primaries) excluded
        let params_primary = SankeyQueryParams {
            top_indices: 5,
            sort_by: SankeySortBy::Primary,
            ..Default::default()
        };
        let result_primary = aggregate_sankey_data(&shards, &params_primary);
        let ids_primary: std::collections::HashSet<&str> = result_primary
            .nodes
            .iter()
            .filter(|n| n.kind == "index")
            .map(|n| n.id.as_str())
            .collect();
        assert_eq!(
            ids_primary.len(),
            5,
            "sort_by=Primary: expected exactly 5 index nodes"
        );
        assert!(
            ids_primary.contains("idx-many-primary"),
            "sort_by=Primary should include idx-many-primary (7 primaries)"
        );
        assert!(
            !ids_primary.contains("idx-huge-store"),
            "sort_by=Primary should exclude idx-huge-store (0 primaries)"
        );
    }

    #[test]
    fn test_unassigned_excluded() {
        let shards = vec![
            make_shard("idx-a", Some("node-1"), true, 100),
            make_shard("idx-a", None, false, 0), // unassigned replica
        ];

        let params = SankeyQueryParams {
            include_unassigned: false,
            ..Default::default()
        };

        let result = aggregate_sankey_data(&shards, &params);

        let has_unassigned = result.nodes.iter().any(|n| n.kind == "unassigned");
        assert!(!has_unassigned, "expected no unassigned node");

        // Only the primary shard contributes to idx-a
        let idx_a = result
            .nodes
            .iter()
            .find(|n| n.id == "idx-a")
            .expect("idx-a");
        assert_eq!(idx_a.primary_shards, 1);
        assert_eq!(idx_a.replica_shards, 0);
    }
}
