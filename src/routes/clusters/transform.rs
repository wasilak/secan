use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Format uptime in milliseconds to human-readable string
///
/// # Examples
/// - 5 days, 3 hours -> "5d 3h"
/// - 2 hours, 45 minutes -> "2h 45m"
/// - 30 minutes -> "30m"
/// - 45 seconds -> "45s"
fn format_uptime(uptime_millis: u64) -> String {
    let seconds = uptime_millis / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    if days > 0 {
        format!("{}d {}h", days, hours % 24)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes % 60)
    } else if minutes > 0 {
        format!("{}m", minutes)
    } else {
        format!("{}s", seconds)
    }
}

/// Transform cluster stats from SDK response to frontend format
///
/// When Prometheus metrics are available, they take precedence over internal metrics
/// for CPU, memory, disk, and load averages.
pub fn transform_cluster_stats(
    stats: &Value,
    health: &Value,
    es_version: Option<String>,
    prometheus_metrics: Option<&std::collections::HashMap<String, serde_json::Value>>,
) -> Result<ClusterStatsResponse, anyhow::Error> {
    tracing::debug!(
        has_prometheus = prometheus_metrics.is_some(),
        prometheus_node_count = prometheus_metrics.map(|m| m.len()).unwrap_or(0),
        "transform_cluster_stats called"
    );

    // Calculate average CPU usage - prefer Prometheus metrics when available
    let cpu_percent = if let Some(prom_metrics) = prometheus_metrics {
        tracing::debug!(
            node_count = prom_metrics.len(),
            "Using Prometheus metrics for CPU"
        );
        // Use Prometheus metrics for CPU
        let mut total_cpu = 0.0;
        let mut node_count = 0;
        for (node_name, metrics) in prom_metrics.iter() {
            let cpu_val = metrics.get("cpu_percent").and_then(|v| v.as_f64());
            if tracing::enabled!(tracing::Level::DEBUG) {
                tracing::debug!(node = %node_name, cpu = ?cpu_val, "CPU metric for node");
            }
            if let Some(cpu) = cpu_val {
                total_cpu += cpu;
                node_count += 1;
            }
        }
        if tracing::enabled!(tracing::Level::DEBUG) {
            tracing::debug!(total_cpu, node_count, "CPU aggregation result");
        }
        if node_count > 0 {
            Some((total_cpu / node_count as f64) as u32)
        } else {
            None
        }
    } else {
        // Fallback to internal metrics
        if let Some(nodes_stats_obj) = stats["nodes_stats"].as_object() {
            let nodes_obj = nodes_stats_obj
                .get("nodes")
                .and_then(|v| v.as_object())
                .or(Some(nodes_stats_obj));

            if let Some(nodes) = nodes_obj {
                let mut total_cpu = 0u64;
                let mut node_count = 0u64;
                for (_node_id, node_stat) in nodes {
                    let cpu = node_stat["os"]["cpu"]["percent"]
                        .as_i64()
                        .map(|v| if v < 0 { 0 } else { v as u64 })
                        .or_else(|| node_stat["os"]["cpu"]["usage"].as_u64())
                        .or_else(|| {
                            node_stat["process"]["cpu"]["percent"].as_i64().map(|v| {
                                if v < 0 {
                                    0
                                } else {
                                    v as u64
                                }
                            })
                        })
                        .or_else(|| node_stat["cpu"]["percent"].as_u64());

                    if let Some(cpu_val) = cpu {
                        total_cpu += cpu_val;
                        node_count += 1;
                    }
                }
                if node_count > 0 {
                    Some((total_cpu / node_count) as u32)
                } else {
                    None
                }
            } else {
                None
            }
        } else {
            None
        }
    };

    // Calculate memory totals - prefer Prometheus metrics when available
    let (memory_used, memory_total) = if let Some(prom_metrics) = prometheus_metrics {
        if tracing::enabled!(tracing::Level::DEBUG) {
            tracing::debug!("Using Prometheus metrics for memory");
        }
        // Use Prometheus metrics for memory (heap_used_bytes from elasticsearch_jvm_memory_used_bytes)
        let mut total_mem_used = 0u64;
        let mut node_count = 0;
        for (node_name, metrics) in prom_metrics.iter() {
            let mem_val = metrics.get("memory_used_bytes").and_then(|v| v.as_u64());
            if tracing::enabled!(tracing::Level::DEBUG) {
                tracing::debug!(node = %node_name, mem = ?mem_val, "Memory metric for node");
            }
            if let Some(mem) = mem_val {
                total_mem_used += mem;
                node_count += 1;
            }
        }
        if tracing::enabled!(tracing::Level::DEBUG) {
            tracing::debug!(total_mem_used, node_count, "Memory aggregation result");
        }
        // For total memory with Prometheus, fall back to internal metrics
        let mem_total = stats["nodes"]["jvm"]["mem"]["heap_max_in_bytes"].as_u64();
        if node_count > 0 {
            (Some(total_mem_used), mem_total)
        } else {
            (None, mem_total)
        }
    } else {
        // Use internal metrics
        let mem_used = stats["nodes"]["jvm"]["mem"]["heap_used_in_bytes"].as_u64();
        let mem_total = stats["nodes"]["jvm"]["mem"]["heap_max_in_bytes"].as_u64();
        (mem_used, mem_total)
    };

    // Calculate disk totals - prefer Prometheus metrics when available
    let (disk_used, disk_total) = if let Some(_prom_metrics) = prometheus_metrics {
        // For disk, we don't have direct Prometheus metrics in the current setup
        // Fall back to internal metrics
        let disk_total = stats["nodes"]["fs"]["total_in_bytes"].as_u64();
        let disk_available = stats["nodes"]["fs"]["available_in_bytes"].as_u64();
        let disk_used = if let (Some(total), Some(available)) = (disk_total, disk_available) {
            Some(total.saturating_sub(available))
        } else {
            None
        };
        (disk_used, disk_total)
    } else {
        // Use internal metrics
        let disk_total = stats["nodes"]["fs"]["total_in_bytes"].as_u64();
        let disk_available = stats["nodes"]["fs"]["available_in_bytes"].as_u64();
        let disk_used = if let (Some(total), Some(available)) = (disk_total, disk_available) {
            Some(total.saturating_sub(available))
        } else {
            None
        };
        (disk_used, disk_total)
    };

    // Calculate average load averages across all nodes - prefer Prometheus metrics when available
    let (load_average_1m, load_average_5m, load_average_15m) =
        if let Some(prom_metrics) = prometheus_metrics {
            let mut total_load1 = 0.0;
            let mut total_load5 = 0.0;
            let mut total_load15 = 0.0;
            let mut node_count = 0;

            for metrics in prom_metrics.values() {
                if let Some(load1) = metrics.get("load1").and_then(|v| v.as_f64()) {
                    total_load1 += load1;
                    node_count += 1;
                }
                if let Some(load5) = metrics.get("load5").and_then(|v| v.as_f64()) {
                    total_load5 += load5;
                }
                if let Some(load15) = metrics.get("load15").and_then(|v| v.as_f64()) {
                    total_load15 += load15;
                }
            }

            if node_count > 0 {
                (
                    Some(total_load1 / node_count as f64),
                    Some(total_load5 / node_count as f64),
                    Some(total_load15 / node_count as f64),
                )
            } else {
                (None, None, None)
            }
        } else {
            (None, None, None)
        };

    Ok(ClusterStatsResponse {
        health: health["status"].as_str().unwrap_or("red").to_string(),
        cluster_name: stats["cluster_name"]
            .as_str()
            .or_else(|| health["cluster_name"].as_str())
            .unwrap_or("unknown")
            .to_string(),
        number_of_nodes: health["number_of_nodes"].as_u64().unwrap_or(0) as u32,
        number_of_data_nodes: health["number_of_data_nodes"].as_u64().unwrap_or(0) as u32,
        number_of_indices: stats["indices"]["count"].as_u64().unwrap_or(0) as u32,
        number_of_documents: stats["indices"]["docs"]["count"].as_u64().unwrap_or(0),
        active_primary_shards: health["active_primary_shards"].as_u64().unwrap_or(0) as u32,
        active_shards: health["active_shards"].as_u64().unwrap_or(0) as u32,
        relocating_shards: health["relocating_shards"].as_u64().unwrap_or(0) as u32,
        initializing_shards: health["initializing_shards"].as_u64().unwrap_or(0) as u32,
        unassigned_shards: health["unassigned_shards"].as_u64().unwrap_or(0) as u32,
        memory_used,
        memory_total,
        disk_used,
        disk_total,
        cpu_percent,
        load_average_1m,
        load_average_5m,
        load_average_15m,
        es_version,
    })
}

/// Transform nodes info and stats from SDK response to frontend format
///
/// # Parameters
/// * `nodes_info` - Node information from /_nodes API
/// * `nodes_stats` - Node statistics from /_nodes/stats API  
/// * `master_node_id` - Optional master node ID from /_cat/master or cluster state
/// * `prometheus_metrics` - Optional Prometheus metrics (node_name -> {cpu_percent, memory_used})
pub fn transform_nodes(
    nodes_info: &Value,
    nodes_stats: &Value,
    master_node_id: Option<&str>,
    prometheus_metrics: Option<&std::collections::HashMap<String, serde_json::Value>>,
) -> Vec<NodeInfoResponse> {
    let mut result = Vec::new();

    if let Some(nodes_obj) = nodes_info["nodes"].as_object() {
        for (node_id, node_info) in nodes_obj {
            // Get corresponding stats
            let node_stats = &nodes_stats["nodes"][node_id];

            // Parse roles
            let roles: Vec<String> = if let Some(roles_array) = node_info["roles"].as_array() {
                roles_array
                    .iter()
                    .filter_map(|r| r.as_str().map(|s| s.to_string()))
                    .collect()
            } else {
                Vec::new()
            };

            // Determine master status
            let is_master_eligible = roles.contains(&"master".to_string());
            let is_master = master_node_id.is_some_and(|mid| mid == node_id);

            // Parse heap stats
            let heap_used = node_stats["jvm"]["mem"]["heap_used_in_bytes"]
                .as_u64()
                .unwrap_or(0);
            let heap_max = node_stats["jvm"]["mem"]["heap_max_in_bytes"]
                .as_u64()
                .unwrap_or(0);

            // Parse disk stats
            let disk_total = node_stats["fs"]["total"]["total_in_bytes"]
                .as_u64()
                .unwrap_or(0);
            let disk_available = node_stats["fs"]["total"]["available_in_bytes"]
                .as_u64()
                .unwrap_or(0);
            let disk_used = disk_total.saturating_sub(disk_available);

            // Parse CPU - use Prometheus metrics if available, otherwise fallback to ES stats
            let node_name = node_info["name"].as_str().unwrap_or("");
            let cpu_percent = if let Some(prom_metrics) = prometheus_metrics {
                // Try to get CPU from Prometheus metrics
                prom_metrics
                    .get(node_name)
                    .and_then(|m| m.get("cpu_percent"))
                    .and_then(|v| v.as_f64())
                    .map(|v| v as u32)
                    .unwrap_or_else(|| {
                        node_stats["os"]["cpu"]["percent"].as_u64().unwrap_or(0) as u32
                    })
            } else {
                node_stats["os"]["cpu"]["percent"].as_u64().unwrap_or(0) as u32
            };

            // Parse Memory - use Prometheus metrics if available
            let (heap_used, heap_max) = if let Some(prom_metrics) = prometheus_metrics {
                // Try to get memory from Prometheus metrics
                let mem_used = prom_metrics
                    .get(node_name)
                    .and_then(|m| m.get("memory_used_bytes"))
                    .and_then(|v| v.as_u64())
                    .unwrap_or(heap_used);
                // For heap_max, we still need ES stats as Prometheus doesn't provide max
                (mem_used, heap_max)
            } else {
                (heap_used, heap_max)
            };

            // Compute heap percent (0..100). If heap_max is zero or unavailable, default to 0
            let heap_percent: u32 = if heap_max > 0 {
                let pct = (heap_used as f64 / heap_max as f64) * 100.0;
                pct.clamp(0.0, 100.0).round() as u32
            } else {
                0
            };

            // Extract load average (1-minute) - use Prometheus metrics if available
            let load_average = if let Some(prom_metrics) = prometheus_metrics {
                // Try to get load1 from Prometheus metrics
                prom_metrics
                    .get(node_name)
                    .and_then(|m| m.get("load1"))
                    .and_then(|v| v.as_f64())
                    .or_else(|| {
                        // Fallback to ES stats
                        node_stats["os"]["cpu"]["load_average"]["1m"]
                            .as_f64()
                            .or_else(|| node_stats["os"]["load_average"].as_f64())
                    })
            } else {
                node_stats["os"]["cpu"]["load_average"]["1m"]
                    .as_f64()
                    .or_else(|| node_stats["os"]["load_average"].as_f64())
            };

            // Extract and format uptime
            let uptime_millis = node_stats["jvm"]["uptime_in_millis"].as_u64();
            let uptime = uptime_millis.map(format_uptime);

            // Extract tags/attributes from node info
            let tags = node_info["attributes"].as_object().map(|attrs| {
                attrs
                    .iter()
                    .map(|(k, v)| format!("{}:{}", k, v.as_str().unwrap_or("")))
                    .collect()
            });

            result.push(NodeInfoResponse {
                id: node_id.clone(),
                name: node_info["name"].as_str().unwrap_or("").to_string(),
                roles,
                heap_used,
                heap_max,
                heap_percent,
                disk_used,
                disk_total,
                cpu_percent: Some(cpu_percent),
                ip: node_info["ip"].as_str().map(|s| s.to_string()),
                version: node_info["version"].as_str().map(|s| s.to_string()),
                is_master,
                is_master_eligible,
                load_average,
                uptime,
                uptime_millis,
                tags,
            });
        }
    }

    result
}

/// Transform indices stats from SDK response to frontend format
#[allow(dead_code)] // Kept for backward compatibility
pub fn transform_indices(indices_stats: &Value) -> Vec<IndexInfoResponse> {
    let mut result = Vec::new();

    // Try to find indices data - it might be at ["indices"] or wrapped differently
    let indices_obj = indices_stats["indices"].as_object().or_else(|| {
        // Fallback: check if response is wrapped differently
        tracing::debug!("indices_stats structure: {:?}", indices_stats);
        None
    });

    if let Some(indices_map) = indices_obj {
        tracing::debug!(
            "Transforming {} indices from stats response",
            indices_map.len()
        );

        for (index_name, index_stats) in indices_map {
            let health = index_stats["health"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let status = index_stats["status"].as_str().unwrap_or("open").to_string();

            let primary_shards = index_stats["primaries"]["shard_stats"]["total_count"]
                .as_u64()
                .or_else(|| index_stats["shards"].as_object().map(|s| s.len() as u64))
                .unwrap_or(0) as u32;

            let docs_count = index_stats["primaries"]["docs"]["count"]
                .as_u64()
                .unwrap_or(0);

            let store_size = index_stats["primaries"]["store"]["size_in_bytes"]
                .as_u64()
                .unwrap_or(0);

            let uuid = index_stats["uuid"].as_str().map(|s| s.to_string());

            result.push(IndexInfoResponse {
                name: index_name.clone(),
                health,
                status,
                primary_shards,
                replica_shards: 0, // Will be calculated from settings if needed
                docs_count,
                store_size,
                uuid,
            });
        }
        tracing::debug!(index_count = result.len(), "Indices transformed");
    } else {
        tracing::warn!("No indices data found in indices_stats response");
    }

    result
}

/// Transform _cat/indices API response to frontend format
/// This is MUCH faster than transform_indices() because _cat/indices is lightweight
pub fn transform_indices_from_cat(cat_indices: &Value) -> Vec<IndexInfoResponse> {
    let mut result = Vec::new();

    if let Some(indices_array) = cat_indices.as_array() {
        for index_data in indices_array {
            let health = index_data["health"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();
            let status = index_data["status"].as_str().unwrap_or("open").to_string();

            let primary_shards = index_data["pri"].as_u64().unwrap_or(0) as u32;
            let replica_shards = index_data["rep"].as_u64().unwrap_or(0) as u32;

            // Parse docs.count (can be "-" for empty indices)
            let docs_count = index_data["docs.count"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            // Parse store.size (format: "1.5gb", "500mb", etc.)
            let store_size = index_data["store.size"]
                .as_str()
                .and_then(|s| {
                    let s = s.to_lowercase();
                    if s.ends_with("kb") {
                        s[..s.len() - 2]
                            .parse::<f64>()
                            .ok()
                            .map(|v| (v * 1024.0) as u64)
                    } else if s.ends_with("mb") {
                        s[..s.len() - 2]
                            .parse::<f64>()
                            .ok()
                            .map(|v| (v * 1024.0 * 1024.0) as u64)
                    } else if s.ends_with("gb") {
                        s[..s.len() - 2]
                            .parse::<f64>()
                            .ok()
                            .map(|v| (v * 1024.0 * 1024.0 * 1024.0) as u64)
                    } else if s.ends_with("tb") {
                        s[..s.len() - 2]
                            .parse::<f64>()
                            .ok()
                            .map(|v| (v * 1024.0 * 1024.0 * 1024.0 * 1024.0) as u64)
                    } else {
                        s.parse::<u64>().ok()
                    }
                })
                .unwrap_or(0);

            let index_name = index_data["index"]
                .as_str()
                .unwrap_or("unknown")
                .to_string();

            result.push(IndexInfoResponse {
                name: index_name,
                health,
                status,
                primary_shards,
                replica_shards,
                docs_count,
                store_size,
                uuid: None, // _cat/indices doesn't provide UUID
            });
        }
        tracing::debug!(
            "Transformed {} indices from _cat/indices response",
            result.len()
        );
    } else {
        tracing::warn!("No indices data found in _cat/indices response");
    }

    result
}

/// Transform _cat/shards API response to shard information for frontend
///
/// Uses the compact _cat/shards API format for memory efficiency (~90% less memory than _cluster/state).
/// Parses shard allocation information without loading the entire cluster state into memory.
///
/// # Requirements
///
/// Validates: Requirements 9.1, 9.2, 9.3
pub fn transform_shards(cat_shards: &Value) -> Vec<ShardInfoResponse> {
    let mut result = Vec::new();

    if let Some(shards_array) = cat_shards.as_array() {
        for shard_entry in shards_array {
            let index = shard_entry["index"].as_str().unwrap_or("").to_string();
            let shard = shard_entry["shard"].as_u64().unwrap_or(0) as u32;
            let primary = shard_entry["prirep"]
                .as_str()
                .map(|s| s == "p")
                .unwrap_or(false);
            let state = shard_entry["state"]
                .as_str()
                .unwrap_or("UNASSIGNED")
                .to_string();
            let node = shard_entry["node"].as_str().map(|s| s.to_string());
            // _cat/shards API returns docs and store as strings, not numbers
            // Handle both string and number formats for compatibility
            let docs = shard_entry["docs"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .or_else(|| shard_entry["docs"].as_u64())
                .unwrap_or(0);
            let store = shard_entry["store"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .or_else(|| shard_entry["store"].as_u64())
                .unwrap_or(0);

            result.push(ShardInfoResponse {
                index,
                shard,
                primary,
                state,
                node,
                docs,
                store,
            });
        }
    }

    result
}

/// Parse a single shard entry from routing_nodes structure
fn parse_routing_node_shard(entry: &Value, node: Option<String>) -> Option<ShardInfoResponse> {
    // Some cluster_state variants may omit index/shard for transient entries.
    // Log and skip entries missing these mandatory fields so we can debug live data.
    let index_opt = entry
        .get("index")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let shard_opt = entry
        .get("shard")
        .and_then(|v| v.as_u64())
        .map(|v| v as u32);
    if index_opt.is_none() || shard_opt.is_none() {
        tracing::debug!(entry = ?entry, node = ?node, "Skipping routing_nodes shard entry missing index or shard");
        return None;
    }
    let index = index_opt.unwrap();
    let shard = shard_opt.unwrap();
    // "primary" may be missing in some cluster_state variants; default to false
    let primary = entry
        .get("primary")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    // "state" may be omitted for unassigned entries in some Elasticsearch/OpenSearch responses.
    // Do not early-return if missing; default to "UNASSIGNED" so filtering by state works.
    let state = entry
        .get("state")
        .and_then(|v| v.as_str())
        .unwrap_or("UNASSIGNED")
        .to_string();

    // Node from routing_nodes has node_id, we use the passed node name if available
    let node_name = node.or_else(|| {
        entry
            .get("node")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
    });

    // docs and store are not available in routing_nodes, set to 0
    Some(ShardInfoResponse {
        index,
        shard,
        primary,
        state,
        node: node_name,
        docs: 0,
        store: 0,
    })
}

/// Transform _cluster/state/routing_nodes API response to flat shard list
///
/// Parses the nested routing_nodes structure into a flat Vec<ShardInfoResponse>.
/// Used for paginated shards list endpoint.
///
/// # Arguments
/// * `state` - The JSON response from _cluster/state/routing_nodes API
///
/// # Returns
/// Flat vector of ShardInfoResponse sorted by index, shard, primary
pub fn transform_routing_nodes_to_shards(state: &Value) -> Vec<ShardInfoResponse> {
    let mut shards = Vec::new();

    let routing_nodes = match state.get("routing_nodes") {
        Some(v) => v,
        None => return shards,
    };

    // Process unassigned shards
    if let Some(unassigned) = routing_nodes.get("unassigned").and_then(|v| v.as_array()) {
        for shard_entry in unassigned {
            if let Some(shard) = parse_routing_node_shard(shard_entry, None) {
                shards.push(shard);
            }
        }
    }

    // Process assigned shards (grouped by node)
    if let Some(nodes) = routing_nodes.get("nodes").and_then(|v| v.as_object()) {
        for (_node_id, shards_array) in nodes {
            if let Some(shards_array) = shards_array.as_array() {
                for shard_entry in shards_array {
                    let node_name = shard_entry
                        .get("node")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    if let Some(shard) = parse_routing_node_shard(shard_entry, node_name) {
                        shards.push(shard);
                    }
                }
            }
        }
    }

    // Sort by index, shard, primary (primary first within same index/shard)
    shards.sort_by(|a, b| {
        match a.index.cmp(&b.index) {
            std::cmp::Ordering::Equal => match a.shard.cmp(&b.shard) {
                std::cmp::Ordering::Equal => b.primary.cmp(&a.primary), // primary first
                other => other,
            },
            other => other,
        }
    });

    shards
}

/// Paginated shards response for API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginatedShardsResponse {
    pub items: Vec<ShardInfoResponse>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
}

impl PaginatedShardsResponse {
    pub fn new(shards: Vec<ShardInfoResponse>, page: usize, page_size: usize) -> Self {
        let total = shards.len();
        let total_pages = total.div_ceil(page_size);

        // Clamp page to valid range
        let page = page.max(1).min(total_pages.max(1));

        let start = (page - 1) * page_size;
        let end = (start + page_size).min(total);

        let items = if start < total {
            shards[start..end].to_vec()
        } else {
            Vec::new()
        };

        Self {
            items,
            total,
            page,
            page_size,
            total_pages,
        }
    }
}

/// Combined paginated shards response including authoritative node metadata
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct PaginatedShardsWithNodes {
    pub items: Vec<ShardInfoResponse>,
    pub total: usize,
    pub page: usize,
    pub page_size: usize,
    pub total_pages: usize,
    pub nodes: Vec<NodeInfoResponse>,
}

impl PaginatedShardsWithNodes {
    pub fn new(p: &PaginatedShardsResponse, nodes: Vec<NodeInfoResponse>) -> Self {
        PaginatedShardsWithNodes {
            items: p.items.clone(),
            total: p.total,
            page: p.page,
            page_size: p.page_size,
            total_pages: p.total_pages,
            nodes,
        }
    }
}

/// Cluster stats response for frontend
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ClusterStatsResponse {
    #[schema(example = "green")]
    pub health: String,
    #[serde(rename = "clusterName")]
    pub cluster_name: String,
    #[serde(rename = "numberOfNodes")]
    pub number_of_nodes: u32,
    #[serde(rename = "numberOfDataNodes")]
    pub number_of_data_nodes: u32,
    #[serde(rename = "numberOfIndices")]
    pub number_of_indices: u32,
    #[serde(rename = "numberOfDocuments")]
    pub number_of_documents: u64,
    #[serde(rename = "activePrimaryShards")]
    pub active_primary_shards: u32,
    #[serde(rename = "activeShards")]
    pub active_shards: u32,
    #[serde(rename = "relocatingShards")]
    pub relocating_shards: u32,
    #[serde(rename = "initializingShards")]
    pub initializing_shards: u32,
    #[serde(rename = "unassignedShards")]
    pub unassigned_shards: u32,
    #[serde(rename = "memoryUsed", skip_serializing_if = "Option::is_none")]
    pub memory_used: Option<u64>,
    #[serde(rename = "memoryTotal", skip_serializing_if = "Option::is_none")]
    pub memory_total: Option<u64>,
    #[serde(rename = "diskUsed", skip_serializing_if = "Option::is_none")]
    pub disk_used: Option<u64>,
    #[serde(rename = "diskTotal", skip_serializing_if = "Option::is_none")]
    pub disk_total: Option<u64>,
    #[serde(rename = "cpuPercent", skip_serializing_if = "Option::is_none")]
    pub cpu_percent: Option<u32>,
    #[serde(rename = "loadAverage1m", skip_serializing_if = "Option::is_none")]
    pub load_average_1m: Option<f64>,
    #[serde(rename = "loadAverage5m", skip_serializing_if = "Option::is_none")]
    pub load_average_5m: Option<f64>,
    #[serde(rename = "loadAverage15m", skip_serializing_if = "Option::is_none")]
    pub load_average_15m: Option<f64>,
    #[serde(rename = "esVersion", skip_serializing_if = "Option::is_none")]
    pub es_version: Option<String>,
}

/// Node info response for frontend
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct NodeInfoResponse {
    #[schema(example = "node-1")]
    pub id: String,
    pub name: String,
    pub roles: Vec<String>,
    #[serde(rename = "heapUsed")]
    pub heap_used: u64,
    #[serde(rename = "heapMax")]
    pub heap_max: u64,
    #[serde(rename = "heapPercent")]
    pub heap_percent: u32,
    #[serde(rename = "diskUsed")]
    pub disk_used: u64,
    #[serde(rename = "diskTotal")]
    pub disk_total: u64,
    #[serde(rename = "cpuPercent")]
    pub cpu_percent: Option<u32>,
    pub ip: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "isMaster")]
    pub is_master: bool,
    #[serde(rename = "isMasterEligible")]
    pub is_master_eligible: bool,
    #[serde(rename = "loadAverage", skip_serializing_if = "Option::is_none")]
    pub load_average: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime: Option<String>,
    #[serde(rename = "uptimeMillis", skip_serializing_if = "Option::is_none")]
    pub uptime_millis: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tags: Option<Vec<String>>,
}

/// Index info response for frontend
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct IndexInfoResponse {
    pub name: String,
    pub health: String,
    pub status: String,
    #[serde(rename = "primaryShards")]
    pub primary_shards: u32,
    #[serde(rename = "replicaShards")]
    pub replica_shards: u32,
    #[serde(rename = "docsCount")]
    pub docs_count: u64,
    #[serde(rename = "storeSize")]
    pub store_size: u64,
    pub uuid: Option<String>,
}

/// Shard info response for frontend
///
/// # Requirements
///
/// Validates: Requirements 9.1, 9.2, 9.3
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ShardInfoResponse {
    pub index: String,
    pub shard: u32,
    pub primary: bool,
    pub state: String,
    pub node: Option<String>,
    /// Document count - always present, 0 if unavailable (Requirement 9.3)
    pub docs: u64,
    /// Store size in bytes - always present, 0 if unavailable (Requirement 9.3)
    pub store: u64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_format_uptime_days() {
        // 5 days, 3 hours, 24 minutes
        let millis = (5 * 24 * 60 * 60 * 1000) + (3 * 60 * 60 * 1000) + (24 * 60 * 1000);
        assert_eq!(format_uptime(millis), "5d 3h");
    }

    #[test]
    fn test_format_uptime_hours() {
        // 2 hours, 45 minutes
        let millis = (2 * 60 * 60 * 1000) + (45 * 60 * 1000);
        assert_eq!(format_uptime(millis), "2h 45m");
    }

    #[test]
    fn test_format_uptime_minutes() {
        // 30 minutes
        let millis = 30 * 60 * 1000;
        assert_eq!(format_uptime(millis), "30m");
    }

    #[test]
    fn test_format_uptime_seconds() {
        // 45 seconds
        let millis = 45 * 1000;
        assert_eq!(format_uptime(millis), "45s");
    }

    #[test]
    fn test_format_uptime_zero() {
        assert_eq!(format_uptime(0), "0s");
    }

    #[test]
    fn test_transform_cluster_stats() {
        let stats = json!({
            "cluster_name": "test-cluster",
            "indices": {
                "count": 5,
                "docs": {
                    "count": 1000
                }
            }
        });

        let health = json!({
            "status": "green",
            "cluster_name": "test-cluster",
            "number_of_nodes": 3,
            "number_of_data_nodes": 2,
            "active_primary_shards": 10,
            "active_shards": 20,
            "relocating_shards": 0,
            "initializing_shards": 0,
            "unassigned_shards": 0
        });

        let result = transform_cluster_stats(&stats, &health, None, None).unwrap();

        assert_eq!(result.health, "green");
        assert_eq!(result.cluster_name, "test-cluster");
        assert_eq!(result.number_of_nodes, 3);
        assert_eq!(result.number_of_indices, 5);
        assert_eq!(result.number_of_documents, 1000);
    }

    #[test]
    fn test_transform_nodes() {
        let nodes_info = json!({
            "nodes": {
                "node1": {
                    "name": "test-node",
                    "roles": ["master", "data"],
                    "ip": "127.0.0.1",
                    "version": "8.0.0"
                }
            }
        });

        let nodes_stats = json!({
            "nodes": {
                "node1": {
                    "jvm": {
                        "mem": {
                            "heap_used_in_bytes": 1000000,
                            "heap_max_in_bytes": 2000000
                        },
                        "uptime_in_millis": 3600000
                    },
                    "fs": {
                        "total": {
                            "total_in_bytes": 10000000,
                            "available_in_bytes": 5000000
                        }
                    },
                    "os": {
                        "cpu": {
                            "percent": 50,
                            "load_average": {
                                "1m": 1.5
                            }
                        }
                    }
                }
            }
        });

        let result = transform_nodes(&nodes_info, &nodes_stats, Some("node1"), None);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "test-node");
        assert_eq!(result[0].roles, vec!["master", "data"]);
        assert_eq!(result[0].heap_used, 1000000);
        assert_eq!(result[0].disk_used, 5000000);
        assert!(result[0].is_master);
        assert!(result[0].is_master_eligible);
        assert_eq!(result[0].load_average, Some(1.5));
        assert_eq!(result[0].uptime, Some("1h 0m".to_string()));
        assert_eq!(result[0].uptime_millis, Some(3600000));
    }

    #[test]
    fn test_transform_nodes_non_master() {
        let nodes_info = json!({
            "nodes": {
                "node1": {
                    "name": "data-node",
                    "roles": ["data"],
                    "ip": "127.0.0.1",
                    "version": "8.0.0"
                }
            }
        });

        let nodes_stats = json!({
            "nodes": {
                "node1": {
                    "jvm": {
                        "mem": {
                            "heap_used_in_bytes": 1000000,
                            "heap_max_in_bytes": 2000000
                        },
                        "uptime_in_millis": 86400000
                    },
                    "fs": {
                        "total": {
                            "total_in_bytes": 10000000,
                            "available_in_bytes": 5000000
                        }
                    },
                    "os": {
                        "cpu": {
                            "percent": 50,
                            "load_average": {
                                "1m": 0.75
                            }
                        }
                    }
                }
            }
        });

        let result = transform_nodes(&nodes_info, &nodes_stats, Some("other-node"), None);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "data-node");
        assert!(!result[0].is_master);
        assert!(!result[0].is_master_eligible);
        assert_eq!(result[0].load_average, Some(0.75));
        assert_eq!(result[0].uptime, Some("1d 0h".to_string()));
        assert_eq!(result[0].uptime_millis, Some(86400000));
    }

    #[test]
    fn test_transform_nodes_no_load_average() {
        let nodes_info = json!({
            "nodes": {
                "node1": {
                    "name": "test-node",
                    "roles": ["data"],
                    "ip": "127.0.0.1",
                    "version": "8.0.0"
                }
            }
        });

        let nodes_stats = json!({
            "nodes": {
                "node1": {
                    "jvm": {
                        "mem": {
                            "heap_used_in_bytes": 1000000,
                            "heap_max_in_bytes": 2000000
                        }
                    },
                    "fs": {
                        "total": {
                            "total_in_bytes": 10000000,
                            "available_in_bytes": 5000000
                        }
                    },
                    "os": {
                        "cpu": {
                            "percent": 50
                        }
                    }
                }
            }
        });

        let result = transform_nodes(&nodes_info, &nodes_stats, None, None);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "test-node");
        assert_eq!(result[0].load_average, None);
        assert_eq!(result[0].uptime, None);
        assert_eq!(result[0].uptime_millis, None);
    }

    #[test]
    fn test_transform_nodes_with_tags() {
        let nodes_info = json!({
            "nodes": {
                "node1": {
                    "name": "test-node",
                    "roles": ["data"],
                    "ip": "127.0.0.1",
                    "version": "8.0.0",
                    "attributes": {
                        "rack": "rack1",
                        "zone": "us-east-1a",
                        "instance_type": "m5.large"
                    }
                }
            }
        });

        let nodes_stats = json!({
            "nodes": {
                "node1": {
                    "jvm": {
                        "mem": {
                            "heap_used_in_bytes": 1000000,
                            "heap_max_in_bytes": 2000000
                        },
                        "uptime_in_millis": 3600000
                    },
                    "fs": {
                        "total": {
                            "total_in_bytes": 10000000,
                            "available_in_bytes": 5000000
                        }
                    },
                    "os": {
                        "cpu": {
                            "percent": 50,
                            "load_average": {
                                "1m": 1.5
                            }
                        }
                    }
                }
            }
        });

        let result = transform_nodes(&nodes_info, &nodes_stats, None, None);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "test-node");
        assert!(result[0].tags.is_some());

        let tags = result[0].tags.as_ref().unwrap();
        assert_eq!(tags.len(), 3);
        assert!(tags.contains(&"rack:rack1".to_string()));
        assert!(tags.contains(&"zone:us-east-1a".to_string()));
        assert!(tags.contains(&"instance_type:m5.large".to_string()));
    }

    #[test]
    fn test_transform_nodes_no_tags() {
        let nodes_info = json!({
            "nodes": {
                "node1": {
                    "name": "test-node",
                    "roles": ["data"],
                    "ip": "127.0.0.1",
                    "version": "8.0.0"
                }
            }
        });

        let nodes_stats = json!({
            "nodes": {
                "node1": {
                    "jvm": {
                        "mem": {
                            "heap_used_in_bytes": 1000000,
                            "heap_max_in_bytes": 2000000
                        }
                    },
                    "fs": {
                        "total": {
                            "total_in_bytes": 10000000,
                            "available_in_bytes": 5000000
                        }
                    },
                    "os": {
                        "cpu": {
                            "percent": 50
                        }
                    }
                }
            }
        });

        let result = transform_nodes(&nodes_info, &nodes_stats, None, None);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "test-node");
        assert_eq!(result[0].tags, None);
    }

    #[test]
    fn test_transform_shards_from_cat_api() {
        let cat_shards = json!([
            {
                "index": "logs-2024.01",
                "shard": 0,
                "prirep": "p",
                "state": "STARTED",
                "node": "node1",
                "docs": 1000,
                "store": 5242880
            },
            {
                "index": "logs-2024.01",
                "shard": 0,
                "prirep": "r",
                "state": "STARTED",
                "node": "node2",
                "docs": 1000,
                "store": 5242880
            },
            {
                "index": "logs-2024.01",
                "shard": 1,
                "prirep": "p",
                "state": "UNASSIGNED",
                "node": null,
                "docs": 0,
                "store": 0
            }
        ]);

        let result = transform_shards(&cat_shards);

        assert_eq!(result.len(), 3);

        // Check primary shard
        assert_eq!(result[0].index, "logs-2024.01");
        assert_eq!(result[0].shard, 0);
        assert!(result[0].primary);
        assert_eq!(result[0].state, "STARTED");
        assert_eq!(result[0].node, Some("node1".to_string()));
        assert_eq!(result[0].docs, 1000);
        assert_eq!(result[0].store, 5242880);

        // Check replica shard
        assert_eq!(result[1].index, "logs-2024.01");
        assert_eq!(result[1].shard, 0);
        assert!(!result[1].primary);
        assert_eq!(result[1].state, "STARTED");
        assert_eq!(result[1].node, Some("node2".to_string()));

        // Check unassigned shard
        assert_eq!(result[2].shard, 1);
        assert!(result[2].primary);
        assert_eq!(result[2].state, "UNASSIGNED");
        assert_eq!(result[2].node, None);
        assert_eq!(result[2].docs, 0);
        assert_eq!(result[2].store, 0);
    }

    #[test]
    fn test_transform_routing_nodes_to_shards() {
        let state = json!({
            "routing_nodes": {
                "unassigned": [
                    {
                        "state": "UNASSIGNED",
                        "primary": true,
                        "index": "logs-2024.01",
                        "shard": 2,
                        "unassigned_info": {
                            "reason": "NODE_LEFT"
                        }
                    }
                ],
                "nodes": {
                    "node1": [
                        {
                            "state": "STARTED",
                            "primary": true,
                            "index": "logs-2024.01",
                            "shard": 0,
                            "node": "node1"
                        },
                        {
                            "state": "STARTED",
                            "primary": false,
                            "index": "logs-2024.01",
                            "shard": 0,
                            "node": "node1"
                        }
                    ],
                    "node2": [
                        {
                            "state": "STARTED",
                            "primary": true,
                            "index": "logs-2024.01",
                            "shard": 1,
                            "node": "node2"
                        }
                    ]
                }
            }
        });

        let result = transform_routing_nodes_to_shards(&state);

        assert_eq!(result.len(), 4);

        // Should be sorted: index, shard, primary DESC
        // Primary shards first for same index/shard
        assert_eq!(result[0].index, "logs-2024.01");
        assert_eq!(result[0].shard, 0);
        assert!(result[0].primary);
        assert_eq!(result[0].state, "STARTED");
        assert_eq!(result[0].node, Some("node1".to_string()));

        // Replica for same shard
        assert_eq!(result[1].shard, 0);
        assert!(!result[1].primary);

        // Next shard on node2
        assert_eq!(result[2].shard, 1);
        assert!(result[2].primary);

        // Unassigned last
        assert_eq!(result[3].state, "UNASSIGNED");
        assert_eq!(result[3].node, None);

        // docs and store should be 0 (not available in routing_nodes)
        assert_eq!(result[0].docs, 0);
        assert_eq!(result[0].store, 0);
    }

    #[test]
    fn test_transform_routing_nodes_empty() {
        let state = json!({
            "routing_nodes": {
                "unassigned": [],
                "nodes": {}
            }
        });

        let result = transform_routing_nodes_to_shards(&state);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_nodes_cover_shards_mapping() {
        // Build nodes_info and nodes_stats for two nodes
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

        // routing_nodes state references node names (not ids)
        let state = json!({
            "routing_nodes": {
                "unassigned": [],
                "nodes": {
                    "n1": [ { "state": "STARTED", "primary": true, "index": "logs-2024.01", "shard": 0, "node": "node1" } ],
                    "n2": [ { "state": "STARTED", "primary": false, "index": "logs-2024.01", "shard": 0, "node": "node2" } ]
                }
            }
        });

        let shards = transform_routing_nodes_to_shards(&state);
        let nodes = transform_nodes(&nodes_info, &nodes_stats, Some("n1"), None);

        // Build set of node names returned by transform_nodes
        let node_names: std::collections::HashSet<String> =
            nodes.into_iter().map(|n| n.name).collect();

        // Each shard that has a node should be represented in node_names
        for shard in shards {
            if let Some(node_name) = shard.node {
                assert!(
                    node_names.contains(&node_name),
                    "Shard references node '{}' which is missing from transform_nodes output",
                    node_name
                );
            }
        }
    }

    #[test]
    fn test_transform_routing_nodes_no_routing_nodes() {
        let state = json!({
            "cluster_name": "test"
        });

        let result = transform_routing_nodes_to_shards(&state);
        assert_eq!(result.len(), 0);
    }

    #[test]
    fn test_paginated_shards_response_basic() {
        let shards = vec![
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
                index: "idx-b".to_string(),
                shard: 0,
                primary: true,
                state: "STARTED".to_string(),
                node: Some("node1".to_string()),
                docs: 0,
                store: 0,
            },
            ShardInfoResponse {
                index: "idx-c".to_string(),
                shard: 0,
                primary: true,
                state: "STARTED".to_string(),
                node: Some("node1".to_string()),
                docs: 0,
                store: 0,
            },
        ];

        let response = PaginatedShardsResponse::new(shards, 1, 2);

        assert_eq!(response.total, 3);
        assert_eq!(response.page, 1);
        assert_eq!(response.page_size, 2);
        assert_eq!(response.total_pages, 2);
        assert_eq!(response.items.len(), 2);
    }

    #[test]
    fn test_paginated_shards_response_clamp_page() {
        let shards = vec![ShardInfoResponse {
            index: "idx-a".to_string(),
            shard: 0,
            primary: true,
            state: "STARTED".to_string(),
            node: None,
            docs: 0,
            store: 0,
        }];

        // Page 100 should be clamped to page 1 (since there's only 1 page)
        let response = PaginatedShardsResponse::new(shards, 100, 10);
        assert_eq!(response.page, 1);
    }

    #[test]
    fn test_paginated_shards_response_empty() {
        let shards: Vec<ShardInfoResponse> = vec![];
        let response = PaginatedShardsResponse::new(shards, 1, 10);

        assert_eq!(response.total, 0);
        assert_eq!(response.page, 1);
        assert_eq!(response.total_pages, 0); // 0 items = 0 pages
        assert_eq!(response.items.len(), 0);
    }
}

/// Node detail stats response for frontend
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct NodeDetailStatsResponse {
    pub id: String,
    pub name: String,
    pub roles: Vec<String>,
    #[serde(rename = "isMaster")]
    pub is_master: bool,
    #[serde(rename = "isMasterEligible")]
    pub is_master_eligible: bool,
    #[serde(rename = "loadAverage", skip_serializing_if = "Option::is_none")]
    pub load_average: Option<[f64; 3]>,
    pub uptime: String,
    #[serde(rename = "uptimeMillis")]
    pub uptime_millis: u64,
    #[serde(rename = "heapUsed")]
    pub heap_used: u64,
    #[serde(rename = "heapMax")]
    pub heap_max: u64,
    #[serde(rename = "heapPercent")]
    pub heap_percent: u32,
    #[serde(rename = "diskUsed")]
    pub disk_used: u64,
    #[serde(rename = "diskTotal")]
    pub disk_total: u64,
    #[serde(rename = "diskPercent")]
    pub disk_percent: u32,
    #[serde(rename = "cpuPercent")]
    pub cpu_percent: u32,
    pub ip: Option<String>,
    pub version: Option<String>,
    #[serde(rename = "jvmVersion", skip_serializing_if = "Option::is_none")]
    pub jvm_version: Option<String>,
    #[serde(rename = "threadPools", skip_serializing_if = "Option::is_none")]
    pub thread_pools: Option<std::collections::HashMap<String, ThreadPoolStats>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shards: Option<ShardStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub indexing: Option<IndexingStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<SearchStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fs: Option<FileSystemStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network: Option<NetworkStats>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jvm: Option<JvmStats>,
}

/// Thread pool statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ThreadPoolStats {
    pub threads: u32,
    pub queue: u32,
    pub active: u32,
    pub rejected: u64,
    pub largest: u32,
    pub completed: u64,
}

/// Shard statistics for a node
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ShardStats {
    pub total: u32,
    pub primary: u32,
    pub replica: u32,
    pub list: Vec<ShardInfo>,
}

/// Individual shard information
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ShardInfo {
    pub index: String,
    pub shard: u32,
    pub primary: bool,
    pub state: String,
    /// Document count - always present, 0 if unavailable
    pub docs: u64,
    /// Store size in bytes - always present, 0 if unavailable
    pub store: u64,
}

/// Indexing statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct IndexingStats {
    #[serde(rename = "indexTotal")]
    pub index_total: u64,
    #[serde(rename = "indexTimeInMillis")]
    pub index_time_in_millis: u64,
    #[serde(rename = "indexCurrent")]
    pub index_current: u32,
    #[serde(rename = "indexFailed")]
    pub index_failed: u64,
    #[serde(rename = "deleteTotal")]
    pub delete_total: u64,
    #[serde(rename = "deleteTimeInMillis")]
    pub delete_time_in_millis: u64,
}

/// Search statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SearchStats {
    #[serde(rename = "queryTotal")]
    pub query_total: u64,
    #[serde(rename = "queryTimeInMillis")]
    pub query_time_in_millis: u64,
    #[serde(rename = "queryCurrent")]
    pub query_current: u32,
    #[serde(rename = "fetchTotal")]
    pub fetch_total: u64,
    #[serde(rename = "fetchTimeInMillis")]
    pub fetch_time_in_millis: u64,
}

/// Filesystem statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct FileSystemStats {
    pub total: u64,
    pub available: u64,
    pub used: u64,
    pub path: String,
    #[serde(rename = "type")]
    pub fs_type: String,
}

/// Network statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct NetworkStats {
    #[serde(rename = "rxBytes")]
    pub rx_bytes: u64,
    #[serde(rename = "txBytes")]
    pub tx_bytes: u64,
}

/// JVM statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct JvmStats {
    #[serde(rename = "gcCollectors")]
    pub gc_collectors: std::collections::HashMap<String, GcCollectorStats>,
}

/// GC collector statistics
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct GcCollectorStats {
    #[serde(rename = "collectionCount")]
    pub collection_count: u64,
    #[serde(rename = "collectionTimeInMillis")]
    pub collection_time_in_millis: u64,
}

/// Extract all load averages (1m, 5m, 15m)
fn extract_load_average_all(node_stats: &Value) -> Option<[f64; 3]> {
    let load_obj = &node_stats["os"]["cpu"]["load_average"];
    if let (Some(m1), Some(m5), Some(m15)) = (
        load_obj["1m"].as_f64(),
        load_obj["5m"].as_f64(),
        load_obj["15m"].as_f64(),
    ) {
        Some([m1, m5, m15])
    } else {
        None
    }
}

/// Extract thread pool statistics
fn extract_thread_pools(
    node_stats: &Value,
) -> Option<std::collections::HashMap<String, ThreadPoolStats>> {
    node_stats["thread_pool"].as_object().map(|pools| {
        pools
            .iter()
            .map(|(name, stats)| {
                (
                    name.clone(),
                    ThreadPoolStats {
                        threads: stats["threads"].as_u64().unwrap_or(0) as u32,
                        queue: stats["queue"].as_u64().unwrap_or(0) as u32,
                        active: stats["active"].as_u64().unwrap_or(0) as u32,
                        rejected: stats["rejected"].as_u64().unwrap_or(0),
                        largest: stats["largest"].as_u64().unwrap_or(0) as u32,
                        completed: stats["completed"].as_u64().unwrap_or(0),
                    },
                )
            })
            .collect()
    })
}

/// Aggregate shard statistics for a specific node
fn aggregate_shard_stats(_node_id: &str, shards: &Value) -> ShardStats {
    let mut total = 0;
    let mut primary = 0;
    let mut replica = 0;
    let mut list = Vec::new();

    // Parse shards from _cat/shards API response (array format)
    if let Some(shards_array) = shards.as_array() {
        tracing::debug!(shards_count = shards_array.len(), "Aggregating shard stats");
        for shard in shards_array {
            // _cat/shards API returns node name in "node" field
            // prirep field: "p" = primary, "r" = replica
            let is_primary = shard["prirep"].as_str().map(|s| s == "p").unwrap_or(false);

            total += 1;
            if is_primary {
                primary += 1;
            } else {
                replica += 1;
            }

            // Parse docs and store from the cat shards response (strings)
            let docs = shard["docs"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);
            let store = shard["store"]
                .as_str()
                .and_then(|s| s.parse::<u64>().ok())
                .unwrap_or(0);

            list.push(ShardInfo {
                index: shard["index"].as_str().unwrap_or("").to_string(),
                shard: shard["shard"].as_str().unwrap_or("0").parse().unwrap_or(0),
                primary: is_primary,
                state: shard["state"].as_str().unwrap_or("UNASSIGNED").to_string(),
                docs,
                store,
            });
        }
    }

    tracing::debug!(
        total = total,
        primary = primary,
        replica = replica,
        "Finished aggregating shard stats"
    );

    ShardStats {
        total,
        primary,
        replica,
        list,
    }
}

/// Extract indexing statistics
fn extract_indexing_stats(node_stats: &Value) -> IndexingStats {
    let indexing = &node_stats["indices"]["indexing"];
    IndexingStats {
        index_total: indexing["index_total"].as_u64().unwrap_or(0),
        index_time_in_millis: indexing["index_time_in_millis"].as_u64().unwrap_or(0),
        index_current: indexing["index_current"].as_u64().unwrap_or(0) as u32,
        index_failed: indexing["index_failed"].as_u64().unwrap_or(0),
        delete_total: indexing["delete_total"].as_u64().unwrap_or(0),
        delete_time_in_millis: indexing["delete_time_in_millis"].as_u64().unwrap_or(0),
    }
}

/// Extract search statistics
fn extract_search_stats(node_stats: &Value) -> SearchStats {
    let search = &node_stats["indices"]["search"];
    SearchStats {
        query_total: search["query_total"].as_u64().unwrap_or(0),
        query_time_in_millis: search["query_time_in_millis"].as_u64().unwrap_or(0),
        query_current: search["query_current"].as_u64().unwrap_or(0) as u32,
        fetch_total: search["fetch_total"].as_u64().unwrap_or(0),
        fetch_time_in_millis: search["fetch_time_in_millis"].as_u64().unwrap_or(0),
    }
}

/// Extract filesystem statistics
fn extract_fs_stats(node_stats: &Value) -> Option<FileSystemStats> {
    let fs = &node_stats["fs"]["total"];
    if let (Some(total), Some(available)) = (
        fs["total_in_bytes"].as_u64(),
        fs["available_in_bytes"].as_u64(),
    ) {
        Some(FileSystemStats {
            total,
            available,
            used: total.saturating_sub(available),
            path: fs["path"].as_str().unwrap_or("/").to_string(),
            fs_type: fs["type"].as_str().unwrap_or("unknown").to_string(),
        })
    } else {
        None
    }
}

/// Extract network statistics
fn extract_network_stats(node_stats: &Value) -> Option<NetworkStats> {
    let transport = &node_stats["transport"];
    if let (Some(rx), Some(tx)) = (
        transport["rx_size_in_bytes"].as_u64(),
        transport["tx_size_in_bytes"].as_u64(),
    ) {
        Some(NetworkStats {
            rx_bytes: rx,
            tx_bytes: tx,
        })
    } else {
        None
    }
}

/// Extract JVM statistics
fn extract_jvm_stats(node_stats: &Value) -> Option<JvmStats> {
    let gc = &node_stats["jvm"]["gc"]["collectors"];
    if let Some(collectors) = gc.as_object() {
        let gc_collectors = collectors
            .iter()
            .map(|(name, stats)| {
                (
                    name.clone(),
                    GcCollectorStats {
                        collection_count: stats["collection_count"].as_u64().unwrap_or(0),
                        collection_time_in_millis: stats["collection_time_in_millis"]
                            .as_u64()
                            .unwrap_or(0),
                    },
                )
            })
            .collect();

        Some(JvmStats { gc_collectors })
    } else {
        None
    }
}

/// Transform node detail stats from SDK response to frontend format
pub fn transform_node_detail_stats(
    node_id: &str,
    nodes_info: &Value,
    node_stats: &Value,
    cluster_state: &Value,
    shards: Option<&Value>,
) -> Result<NodeDetailStatsResponse, anyhow::Error> {
    // Get node info and stats
    let node_info = &nodes_info["nodes"][node_id];
    let node_stat = &node_stats["nodes"][node_id];

    // Parse roles
    let roles: Vec<String> = if let Some(roles_array) = node_info["roles"].as_array() {
        roles_array
            .iter()
            .filter_map(|r| r.as_str().map(|s| s.to_string()))
            .collect()
    } else {
        Vec::new()
    };

    // Determine master status
    let is_master_eligible = roles.contains(&"master".to_string());
    let master_node_id = cluster_state.get("master_node").and_then(|v| v.as_str());
    let is_master = master_node_id == Some(node_id);

    // Extract load average (1m, 5m, 15m)
    let load_average = extract_load_average_all(node_stat);

    // Extract uptime
    let uptime_millis = node_stat["jvm"]["uptime_in_millis"].as_u64().unwrap_or(0);
    let uptime = format_uptime(uptime_millis);

    // Parse heap stats
    let heap_used = node_stat["jvm"]["mem"]["heap_used_in_bytes"]
        .as_u64()
        .unwrap_or(0);
    let heap_max = node_stat["jvm"]["mem"]["heap_max_in_bytes"]
        .as_u64()
        .unwrap_or(0);
    let heap_percent = if heap_max > 0 {
        ((heap_used as f64 / heap_max as f64) * 100.0) as u32
    } else {
        0
    };

    // Parse disk stats
    let disk_total = node_stat["fs"]["total"]["total_in_bytes"]
        .as_u64()
        .unwrap_or(0);
    let disk_available = node_stat["fs"]["total"]["available_in_bytes"]
        .as_u64()
        .unwrap_or(0);
    let disk_used = disk_total.saturating_sub(disk_available);
    let disk_percent = if disk_total > 0 {
        ((disk_used as f64 / disk_total as f64) * 100.0) as u32
    } else {
        0
    };

    // Parse CPU
    let cpu_percent = node_stat["os"]["cpu"]["percent"].as_u64().unwrap_or(0) as u32;

    // Extract thread pools
    let thread_pools = extract_thread_pools(node_stat);

    // Extract shard stats (for data nodes)
    let shard_stats = if roles.contains(&"data".to_string()) {
        shards.map(|s| aggregate_shard_stats(node_id, s))
    } else {
        None
    };

    // Extract indexing/search stats (for data nodes)
    let indexing = if roles.contains(&"data".to_string()) {
        Some(extract_indexing_stats(node_stat))
    } else {
        None
    };

    let search = if roles.contains(&"data".to_string()) {
        Some(extract_search_stats(node_stat))
    } else {
        None
    };

    // Extract filesystem stats
    let fs = extract_fs_stats(node_stat);

    // Extract network stats
    let network = extract_network_stats(node_stat);

    // Extract JVM stats
    let jvm = extract_jvm_stats(node_stat);

    Ok(NodeDetailStatsResponse {
        id: node_id.to_string(),
        name: node_info["name"].as_str().unwrap_or("").to_string(),
        roles,
        is_master,
        is_master_eligible,
        load_average,
        uptime,
        uptime_millis,
        heap_used,
        heap_max,
        heap_percent,
        disk_used,
        disk_total,
        disk_percent,
        cpu_percent,
        ip: node_info["ip"].as_str().map(|s| s.to_string()),
        version: node_info["version"].as_str().map(|s| s.to_string()),
        jvm_version: node_info["jvm"]["version"].as_str().map(|s| s.to_string()),
        thread_pools,
        shards: shard_stats,
        indexing,
        search,
        fs,
        network,
        jvm,
    })
}
