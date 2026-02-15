use serde::{Deserialize, Serialize};
use serde_json::Value;

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
pub fn transform_cluster_stats(
    stats: &Value,
    health: &Value,
) -> Result<ClusterStatsResponse, anyhow::Error> {
    // Extract memory and disk totals from nodes stats
    let memory_used = stats["nodes"]["jvm"]["mem"]["heap_used_in_bytes"].as_u64();
    let memory_total = stats["nodes"]["jvm"]["mem"]["heap_max_in_bytes"].as_u64();
    let disk_total = stats["nodes"]["fs"]["total_in_bytes"].as_u64();
    let disk_available = stats["nodes"]["fs"]["available_in_bytes"].as_u64();
    let disk_used = if let (Some(total), Some(available)) = (disk_total, disk_available) {
        Some(total.saturating_sub(available))
    } else {
        None
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
    })
}

/// Transform nodes info and stats from SDK response to frontend format
///
/// # Parameters
/// * `nodes_info` - Node information from /_nodes API
/// * `nodes_stats` - Node statistics from /_nodes/stats API
/// * `master_node_id` - Optional master node ID from /_cat/master or cluster state
pub fn transform_nodes(
    nodes_info: &Value,
    nodes_stats: &Value,
    master_node_id: Option<&str>,
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

            // Parse CPU
            let cpu_percent = node_stats["os"]["cpu"]["percent"].as_u64().unwrap_or(0) as u32;

            // Extract load average (1-minute)
            let load_average = node_stats["os"]["cpu"]["load_average"]["1m"]
                .as_f64()
                .or_else(|| node_stats["os"]["load_average"].as_f64());

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
pub fn transform_indices(indices_stats: &Value) -> Vec<IndexInfoResponse> {
    let mut result = Vec::new();

    if let Some(indices_obj) = indices_stats["indices"].as_object() {
        for (index_name, index_stats) in indices_obj {
            let health = index_stats["health"]
                .as_str()
                .unwrap_or("yellow")
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
    }

    result
}

/// Transform cluster state to shard information for frontend
pub fn transform_shards(cluster_state: &Value, indices_stats: &Value) -> Vec<ShardInfoResponse> {
    let mut result = Vec::new();

    if let Some(routing_table) = cluster_state["routing_table"]["indices"].as_object() {
        for (index_name, index_routing) in routing_table {
            if let Some(shards_obj) = index_routing["shards"].as_object() {
                for (shard_num, shard_array) in shards_obj {
                    if let Some(shard_list) = shard_array.as_array() {
                        for shard in shard_list {
                            let shard_number: u32 = shard_num.parse().unwrap_or(0);
                            let primary = shard["primary"].as_bool().unwrap_or(false);
                            let state = shard["state"].as_str().unwrap_or("UNASSIGNED").to_string();
                            let node = shard["node"].as_str().map(|s| s.to_string());

                            // Get docs and store size from indices stats
                            let shard_stats =
                                &indices_stats["indices"][index_name]["shards"][shard_num.as_str()];
                            let docs = if let Some(shard_array) = shard_stats.as_array() {
                                shard_array
                                    .first()
                                    .and_then(|s| s["docs"]["count"].as_u64())
                            } else {
                                None
                            };
                            let store = if let Some(shard_array) = shard_stats.as_array() {
                                shard_array
                                    .first()
                                    .and_then(|s| s["store"]["size_in_bytes"].as_u64())
                            } else {
                                None
                            };

                            result.push(ShardInfoResponse {
                                index: index_name.clone(),
                                shard: shard_number,
                                primary,
                                state,
                                node,
                                docs,
                                store,
                            });
                        }
                    }
                }
            }
        }
    }

    result
}

/// Cluster stats response for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct ClusterStatsResponse {
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
}

/// Node info response for frontend
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeInfoResponse {
    pub id: String,
    pub name: String,
    pub roles: Vec<String>,
    #[serde(rename = "heapUsed")]
    pub heap_used: u64,
    #[serde(rename = "heapMax")]
    pub heap_max: u64,
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
#[derive(Debug, Serialize, Deserialize)]
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
#[derive(Debug, Serialize, Deserialize)]
pub struct ShardInfoResponse {
    pub index: String,
    pub shard: u32,
    pub primary: bool,
    pub state: String,
    pub node: Option<String>,
    pub docs: Option<u64>,
    pub store: Option<u64>,
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

        let result = transform_cluster_stats(&stats, &health).unwrap();

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

        let result = transform_nodes(&nodes_info, &nodes_stats, Some("node1"));

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

        let result = transform_nodes(&nodes_info, &nodes_stats, Some("other-node"));

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

        let result = transform_nodes(&nodes_info, &nodes_stats, None);

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

        let result = transform_nodes(&nodes_info, &nodes_stats, None);

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

        let result = transform_nodes(&nodes_info, &nodes_stats, None);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "test-node");
        assert_eq!(result[0].tags, None);
    }
}

/// Node detail stats response for frontend
#[derive(Debug, Serialize, Deserialize)]
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
#[derive(Debug, Serialize, Deserialize)]
pub struct ThreadPoolStats {
    pub threads: u32,
    pub queue: u32,
    pub active: u32,
    pub rejected: u64,
    pub largest: u32,
    pub completed: u64,
}

/// Shard statistics for a node
#[derive(Debug, Serialize, Deserialize)]
pub struct ShardStats {
    pub total: u32,
    pub primary: u32,
    pub replica: u32,
    pub list: Vec<ShardInfo>,
}

/// Individual shard information
#[derive(Debug, Serialize, Deserialize)]
pub struct ShardInfo {
    pub index: String,
    pub shard: u32,
    pub primary: bool,
    pub state: String,
    pub docs: Option<u64>,
    pub store: Option<u64>,
}

/// Indexing statistics
#[derive(Debug, Serialize, Deserialize)]
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
#[derive(Debug, Serialize, Deserialize)]
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
#[derive(Debug, Serialize, Deserialize)]
pub struct FileSystemStats {
    pub total: u64,
    pub available: u64,
    pub used: u64,
    pub path: String,
    #[serde(rename = "type")]
    pub fs_type: String,
}

/// Network statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct NetworkStats {
    #[serde(rename = "rxBytes")]
    pub rx_bytes: u64,
    #[serde(rename = "txBytes")]
    pub tx_bytes: u64,
}

/// JVM statistics
#[derive(Debug, Serialize, Deserialize)]
pub struct JvmStats {
    #[serde(rename = "gcCollectors")]
    pub gc_collectors: std::collections::HashMap<String, GcCollectorStats>,
}

/// GC collector statistics
#[derive(Debug, Serialize, Deserialize)]
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
fn aggregate_shard_stats(node_id: &str, shards: &Value) -> ShardStats {
    let mut total = 0;
    let mut primary = 0;
    let mut replica = 0;
    let mut list = Vec::new();

    // Parse shards from cluster state routing table
    if let Some(routing_table) = shards["routing_table"]["indices"].as_object() {
        for (index_name, index_routing) in routing_table {
            if let Some(shards_obj) = index_routing["shards"].as_object() {
                for (shard_num, shard_array) in shards_obj {
                    if let Some(shard_list) = shard_array.as_array() {
                        for shard in shard_list {
                            // Check if this shard is on the target node
                            if let Some(shard_node) = shard["node"].as_str() {
                                if shard_node == node_id {
                                    total += 1;
                                    let is_primary = shard["primary"].as_bool().unwrap_or(false);
                                    if is_primary {
                                        primary += 1;
                                    } else {
                                        replica += 1;
                                    }

                                    list.push(ShardInfo {
                                        index: index_name.clone(),
                                        shard: shard_num.parse().unwrap_or(0),
                                        primary: is_primary,
                                        state: shard["state"]
                                            .as_str()
                                            .unwrap_or("UNASSIGNED")
                                            .to_string(),
                                        docs: None, // Will be filled from indices stats if available
                                        store: None, // Will be filled from indices stats if available
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }
    }

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
        thread_pools,
        shards: shard_stats,
        indexing,
        search,
        fs,
        network,
        jvm,
    })
}
