use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Transform cluster stats from SDK response to frontend format
pub fn transform_cluster_stats(
    stats: &Value,
    health: &Value,
) -> Result<ClusterStatsResponse, anyhow::Error> {
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
    })
}

/// Transform nodes info and stats from SDK response to frontend format
pub fn transform_nodes(nodes_info: &Value, nodes_stats: &Value) -> Vec<NodeInfoResponse> {
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

        let result = transform_nodes(&nodes_info, &nodes_stats);

        assert_eq!(result.len(), 1);
        assert_eq!(result[0].name, "test-node");
        assert_eq!(result[0].roles, vec!["master", "data"]);
        assert_eq!(result[0].heap_used, 1000000);
        assert_eq!(result[0].disk_used, 5000000);
    }
}
