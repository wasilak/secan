use super::layout::{layout_nodes, GroupingConfig, PositionedNode, TILE_SIZE};
use crate::routes::clusters::transform::{NodeInfoResponse, ShardInfoResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TilePayload {
    pub x: i32,
    pub y: i32,
    pub lod: String,
    pub version: String,
    pub unchanged: bool,
    pub nodes: Option<Value>,
    pub edges: Option<Value>,
}

/// Minimal generator: given transformed nodes and shards, compute positions,
/// determine which nodes intersect each tile, and produce payloads.
pub fn generate_tiles(
    tile_requests: &[(i32, i32, &str, Option<String>)],
    nodes: &[NodeInfoResponse],
    shards_by_node: &std::collections::HashMap<String, Vec<ShardInfoResponse>>,
    grouping: &GroupingConfig,
    cluster_generation: &str,
) -> Vec<TilePayload> {
    // Compute layout positions
    let positions = layout_nodes(nodes, shards_by_node, grouping);

    // Build a map id -> PositionedNode
    let pos_map: std::collections::HashMap<String, &PositionedNode> =
        positions.iter().map(|p| (p.id.clone(), p)).collect();

    let mut out = Vec::new();

    for (x, y, lod, client_version) in tile_requests.iter() {
        // tile bbox
        let min_x = (*x as i64) * TILE_SIZE;
        let min_y = (*y as i64) * TILE_SIZE;
        let max_x = min_x + TILE_SIZE - 1;
        let max_y = min_y + TILE_SIZE - 1;

        // Find nodes that intersect bbox
        let mut matched = Vec::new();
        // Canonical entries used for deterministic version hashing
        let mut canonical_entries: Vec<String> = Vec::new();
        for node in nodes.iter() {
            if let Some(p) = pos_map.get(&node.id) {
                let nx1 = p.x;
                let ny1 = p.y;
                let nx2 = p.x + p.width - 1;
                let ny2 = p.y + p.height - 1;

                let intersects = !(nx2 < min_x || nx1 > max_x || ny2 < min_y || ny1 > max_y);
                if intersects {
                    // build node JSON depending on LOD
                    let mut n = serde_json::json!({
                        "id": node.id,
                        "x": nx1,
                        "y": ny1,
                        "width": p.width,
                        "height": p.height,
                    });

                    if *lod == "L1" || *lod == "L2" {
                        n["name"] = serde_json::json!(node.name.clone());
                        n["metrics"] = serde_json::json!({"heapPercent": node.heap_percent});
                    }

                    // Provide lightweight shard summary counts for L1 (and L2 as well).
                    // For L2 we still emit the full shards array, but include counts too
                    // so clients that only want totals can use them without parsing the
                    // full array.
                    let mut primary_count: i64 = 0;
                    let mut replica_count: i64 = 0;
                    let mut total_count: i64 = 0;

                    if *lod == "L2" {
                        let shards = shards_by_node
                            .get(&node.name)
                            .or_else(|| shards_by_node.get(&node.id))
                            .cloned()
                            .unwrap_or_default();
                        total_count = shards.len() as i64;
                        primary_count = shards.iter().filter(|s| s.primary).count() as i64;
                        replica_count = total_count - primary_count;
                        let s: Vec<Value> = shards
                            .into_iter()
                            .map(|sh| {
                                serde_json::json!({
                                    "index": sh.index,
                                    "shard": sh.shard,
                                    "primary": sh.primary,
                                    "state": sh.state,
                                })
                            })
                            .collect();
                        n["shards"] = serde_json::Value::Array(s);
                    } else {
                        if let Some(vec) = shards_by_node
                            .get(&node.name)
                            .or_else(|| shards_by_node.get(&node.id))
                        {
                            total_count = vec.len() as i64;
                            primary_count = vec.iter().filter(|s| s.primary).count() as i64;
                            replica_count = total_count - primary_count;
                        }
                    }

                    // Attach summaryCounts so clients can render totals cheaply.
                    n["summaryCounts"] = serde_json::json!({"primary": primary_count, "replica": replica_count, "total": total_count});

                    // push node JSON for response
                    matched.push(n);

                    // build canonical entry for hashing
                    let mut parts: Vec<String> = Vec::new();
                    parts.push(format!("id={}", node.id));
                    parts.push(format!("x={}", nx1));
                    parts.push(format!("y={}", ny1));
                    parts.push(format!("w={}", p.width));
                    parts.push(format!("h={}", p.height));

                    if *lod == "L1" || *lod == "L2" {
                        parts.push(format!("name={}", node.name));
                        parts.push(format!("heapPercent={}", node.heap_percent));
                    }

                    if *lod == "L2" {
                        let mut shards = shards_by_node
                            .get(&node.name)
                            .or_else(|| shards_by_node.get(&node.id))
                            .cloned()
                            .unwrap_or_default();
                        // sort shards deterministically: index, shard, primary desc
                        shards.sort_by(|a, b| {
                            a.index
                                .cmp(&b.index)
                                .then(a.shard.cmp(&b.shard))
                                .then_with(|| b.primary.cmp(&a.primary))
                        });
                        let shard_strings: Vec<String> = shards
                            .into_iter()
                            .map(|sh| {
                                format!(
                                    "{}:{}:{}:{}",
                                    sh.index, sh.shard, sh.primary as u8, sh.state
                                )
                            })
                            .collect();
                        parts.push(format!("shards=[{}]", shard_strings.join(",")));
                    }

                    canonical_entries.push(parts.join("|"));
                }
            }
        }

        // Compute version as sha256 over canonical per-node entries for this tile/LOD
        canonical_entries.sort();
        let mut hasher = Sha256::new();
        for entry in canonical_entries.iter() {
            hasher.update(entry.as_bytes());
            hasher.update(b"\n");
        }
        let version = format!("v-{:x}", hasher.finalize());
        // Prefix version with cluster generation to allow cheap invalidation
        let full_version = format!("{}-{}", cluster_generation, version);

        // Compare client_version against the full payload version (cluster_generation-prefixed)
        // so clients can send the exact version string that the server returns.
        let client_matches = client_version
            .as_ref()
            .map(|cv| cv == &full_version)
            .unwrap_or(false);

        let payload = TilePayload {
            x: *x,
            y: *y,
            lod: (*lod).to_string(),
            version: full_version.clone(),
            unchanged: client_matches,
            nodes: if client_matches {
                None
            } else {
                Some(serde_json::Value::Array(matched))
            },
            edges: if client_matches {
                None
            } else {
                Some(serde_json::json!([]))
            },
        };

        out.push(payload);
    }

    out
}

/// Compute a cluster generation id based on canonical per-node content.
/// This can be used as a cheap way to detect cluster snapshot changes and
/// invalidate cached tiles when nodes, metrics or shard lists change.
pub fn compute_cluster_generation(
    nodes: &[NodeInfoResponse],
    shards_by_node: &std::collections::HashMap<String, Vec<ShardInfoResponse>>,
) -> String {
    let mut entries: Vec<String> = Vec::new();

    for node in nodes.iter() {
        let mut parts: Vec<String> = Vec::new();
        parts.push(format!("id={}", node.id));
        parts.push(format!("name={}", node.name));
        parts.push(format!("heapPercent={}", node.heap_percent));

        let mut shards = shards_by_node
            .get(&node.name)
            .or_else(|| shards_by_node.get(&node.id))
            .cloned()
            .unwrap_or_default();
        shards.sort_by(|a, b| {
            a.index
                .cmp(&b.index)
                .then(a.shard.cmp(&b.shard))
                .then_with(|| b.primary.cmp(&a.primary))
        });
        let shard_strings: Vec<String> = shards
            .into_iter()
            .map(|sh| {
                format!(
                    "{}:{}:{}:{}",
                    sh.index, sh.shard, sh.primary as u8, sh.state
                )
            })
            .collect();
        parts.push(format!("shards=[{}]", shard_strings.join(",")));

        entries.push(parts.join("|"));
    }

    entries.sort();
    let mut hasher = Sha256::new();
    for e in entries.iter() {
        hasher.update(e.as_bytes());
        hasher.update(b"\n");
    }
    format!("g-{:x}", hasher.finalize())
}
