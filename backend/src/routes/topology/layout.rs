use crate::routes::clusters::transform::{NodeInfoResponse, ShardInfoResponse};
use std::collections::HashMap;

// Faithful port of the frontend calculateCanvasLayout (no-grouping path).
// This computes deterministic x/y positions for cluster group nodes so
// server and client agree on tile membership.

pub const TILE_SIZE: i64 = 1000;
// Constants taken from frontend/src/config/topologyConfig.ts
pub const SHARD_SIZE: i64 = 18;
pub const SHARD_GAP: i64 = 3;
pub const SHARDS_PER_ROW: usize = 6;
pub const MAX_SHARD_ROWS: usize = 6;
pub const GROUP_WIDTH: i64 = 280;
pub const HORIZONTAL_GAP: i64 = 60;
pub const VERTICAL_GAP: i64 = 40;
const ESTIMATED_HEADER_HEIGHT: i64 = 80;
const GROUP_PADDING_BOTTOM: i64 = 12;
const ESTIMATED_SHARD_ROW_HEIGHT: i64 = SHARD_SIZE + SHARD_GAP;

// Key used to collect shards that are not assigned to any node
pub const UNASSIGNED_KEY: &str = "__unassigned__";

pub struct PositionedNode {
    pub id: String,
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
}

fn estimated_group_height(shard_count: usize) -> i64 {
    let rows = std::cmp::min(shard_count.div_ceil(SHARDS_PER_ROW), MAX_SHARD_ROWS);
    ESTIMATED_HEADER_HEIGHT + (rows as i64 * ESTIMATED_SHARD_ROW_HEIGHT) + GROUP_PADDING_BOTTOM
}

fn sort_cluster_nodes(nodes: &[NodeInfoResponse]) -> Vec<NodeInfoResponse> {
    let mut out = nodes.to_vec();
    out.sort_by(|a, b| {
        let a_master = a.roles.iter().any(|r| r == "master");
        let b_master = b.roles.iter().any(|r| r == "master");
        if a_master && !b_master {
            std::cmp::Ordering::Less
        } else if !a_master && b_master {
            std::cmp::Ordering::Greater
        } else {
            a.name.cmp(&b.name)
        }
    });
    out
}

fn column_for(node: &NodeInfoResponse) -> usize {
    if node.roles.iter().any(|r| r == "master") {
        0
    } else if node.roles.iter().any(|r| r == "ingest") || node.roles.iter().any(|r| r == "ml") {
        2
    } else {
        1
    }
}

/// Compute positions for nodes using the no-grouping (3-column) layout used by the frontend.
// Some grouping attribute variants are not exercised in unit tests yet.
// Allow dead_code to keep the enum exhaustive without causing clippy failures.
#[allow(dead_code)]
#[derive(Debug, Clone)]
pub enum GroupingAttribute {
    None,
    Role,
    Type,
    Label,
}

#[derive(Debug, Clone)]
pub struct GroupingConfig {
    pub attribute: GroupingAttribute,
    pub value: Option<String>,
}

pub fn layout_nodes(
    nodes: &[NodeInfoResponse],
    shards_by_node: &std::collections::HashMap<String, Vec<ShardInfoResponse>>,
    grouping: &GroupingConfig,
) -> Vec<PositionedNode> {
    if nodes.is_empty() {
        return Vec::new();
    }
    // If grouping attribute is None => no-grouping 3-column layout
    match grouping.attribute {
        GroupingAttribute::None => {
            let sorted = sort_cluster_nodes(nodes);
            let column_width = GROUP_WIDTH + HORIZONTAL_GAP;
            let mut col_y = [0i64, 0i64, 0i64];
            let mut out: Vec<PositionedNode> = Vec::with_capacity(sorted.len() + 1);

            for node in sorted.iter() {
                let col = column_for(node);
                let y = col_y[col];
                let shard_count = shards_by_node
                    .get(&node.name)
                    .or_else(|| shards_by_node.get(&node.id))
                    .map(|v| v.len())
                    .unwrap_or(0);

                let height = estimated_group_height(shard_count);
                let x = (col as i64) * column_width;

                out.push(PositionedNode {
                    id: node.id.clone(),
                    x,
                    y,
                    width: GROUP_WIDTH,
                    height,
                });

                col_y[col] = y + height + VERTICAL_GAP;
            }

            // Emit synthetic Unassigned node if present in shards_by_node
            if let Some(unassigned) = shards_by_node.get(UNASSIGNED_KEY) {
                if !unassigned.is_empty() {
                    let ux = column_width; // middle column
                    let max_y = out.iter().map(|n| n.y).max().unwrap_or(0);
                    let y = max_y + VERTICAL_GAP;
                    let height = estimated_group_height(unassigned.len());
                    out.push(PositionedNode {
                        id: UNASSIGNED_KEY.to_string(),
                        x: ux,
                        y,
                        width: GROUP_WIDTH,
                        height,
                    });
                }
            }

            out
        }
        _ => {
            // Grouped layout: partition nodes into groups like frontend calculateNodeGroups
            let groups = calculate_node_groups(nodes, grouping);
            let mut out: Vec<PositionedNode> = Vec::new();
            let mut col_x = 0i64;
            let column_width = GROUP_WIDTH + HORIZONTAL_GAP;

            for (_group_key, group_nodes) in groups.into_iter() {
                let sorted = sort_cluster_nodes(&group_nodes);
                let mut y = 0i64;
                for node in sorted.iter() {
                    let shard_count = shards_by_node
                        .get(&node.name)
                        .or_else(|| shards_by_node.get(&node.id))
                        .map(|v| v.len())
                        .unwrap_or(0);
                    let height = estimated_group_height(shard_count);
                    out.push(PositionedNode {
                        id: node.id.clone(),
                        x: col_x,
                        y,
                        width: GROUP_WIDTH,
                        height,
                    });
                    y += height + VERTICAL_GAP;
                }
                col_x += column_width;
            }

            // Unassigned handling: place in middle column after groups
            if let Some(unassigned) = shards_by_node.get(UNASSIGNED_KEY) {
                if !unassigned.is_empty() {
                    let ux = column_width; // place after first column of groups
                    let max_y = out.iter().map(|n| n.y).max().unwrap_or(0);
                    let y = max_y + VERTICAL_GAP;
                    let height = estimated_group_height(unassigned.len());
                    out.push(PositionedNode {
                        id: UNASSIGNED_KEY.to_string(),
                        x: ux,
                        y,
                        width: GROUP_WIDTH,
                        height,
                    });
                }
            }

            out
        }
    }
}

/// Helper: port of calculateNodeGroups minimal behavior used for grouping
fn calculate_node_groups(
    nodes: &[NodeInfoResponse],
    grouping: &GroupingConfig,
) -> HashMap<String, Vec<NodeInfoResponse>> {
    let mut groups: HashMap<String, Vec<NodeInfoResponse>> = HashMap::new();

    match &grouping.attribute {
        GroupingAttribute::None => {
            groups.insert("all".to_string(), nodes.to_vec());
        }
        GroupingAttribute::Role => {
            for node in nodes.iter() {
                if !node.roles.is_empty() {
                    for role in node.roles.iter() {
                        groups.entry(role.clone()).or_default().push(node.clone());
                    }
                } else {
                    groups
                        .entry("undefined".to_string())
                        .or_default()
                        .push(node.clone());
                }
            }
        }
        GroupingAttribute::Type => {
            for node in nodes.iter() {
                if node.roles.iter().any(|r| r == "master") {
                    groups
                        .entry("master".to_string())
                        .or_default()
                        .push(node.clone());
                }
                if node.roles.iter().any(|r| r != "master") {
                    groups
                        .entry("other".to_string())
                        .or_default()
                        .push(node.clone());
                }
                if node.roles.is_empty() {
                    groups
                        .entry("undefined".to_string())
                        .or_default()
                        .push(node.clone());
                }
            }
        }
        GroupingAttribute::Label => {
            if let Some(val) = &grouping.value {
                // filter by specific label value
                let extracted = extract_label_from_tag(val);
                let value = extracted.value;
                for node in nodes.iter() {
                    let mut group_key = "other".to_string();
                    if let Some(tags) = &node.tags {
                        if tags.iter().any(|t| t == val) {
                            group_key = value.clone();
                        }
                    }
                    groups.entry(group_key).or_default().push(node.clone());
                }
            } else {
                for node in nodes.iter() {
                    let group_key = if let Some(tags) = &node.tags {
                        if !tags.is_empty() {
                            extract_label_from_tag(&tags[0]).value
                        } else {
                            "undefined".to_string()
                        }
                    } else {
                        "undefined".to_string()
                    };
                    groups.entry(group_key).or_default().push(node.clone());
                }
            }
        }
    }

    groups
}

/// Helper: extract label name/value similar to frontend extractLabelFromTag
fn extract_label_from_tag(tag: &str) -> LabelPair {
    if tag.contains(':') {
        let parts: Vec<&str> = tag.splitn(2, ':').collect();
        return LabelPair {
            value: parts[1].to_string(),
        };
    }
    if let Some(idx) = tag.find('-') {
        if idx > 0 && idx < tag.len() - 1 {
            let value = tag[idx + 1..].to_string();
            return LabelPair { value };
        }
    }
    LabelPair {
        value: tag.to_string(),
    }
}

#[derive(Debug)]
struct LabelPair {
    value: String,
}
