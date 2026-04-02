pub const TILE_SIZE: i64 = 1024;

#[derive(Clone)]
pub struct PositionedNode {
    pub id: String,
    pub x: i64,
    pub y: i64,
    pub width: i64,
    pub height: i64,
}

#[derive(Clone)]
pub enum GroupingAttribute {
    None,
}

#[derive(Clone)]
pub struct GroupingConfig {
    pub attribute: GroupingAttribute,
    pub value: Option<String>,
}

// Very small layout shim: distribute nodes in a grid for the generator
pub fn layout_nodes(
    nodes: &[crate::routes::clusters::transform::NodeInfoResponse],
    _shards_by_node: &std::collections::HashMap<
        String,
        Vec<crate::routes::clusters::transform::ShardInfoResponse>,
    >,
    _grouping: &GroupingConfig,
) -> Vec<PositionedNode> {
    // Touch grouping fields to avoid dead_code warnings for unused struct fields.
    // This is intentionally a no-op read to satisfy clippy without changing behavior.
    let _ = &_grouping.attribute;
    let _ = &_grouping.value;

    let mut out = Vec::new();
    let mut x = 0i64;
    let mut y = 0i64;
    for n in nodes.iter() {
        out.push(PositionedNode {
            id: n.id.clone(),
            x: x * 64,
            y: y * 64,
            width: 48,
            height: 32,
        });
        x += 1;
        if x > 8 {
            x = 0;
            y += 1;
        }
    }
    out
}

pub const UNASSIGNED_KEY: &str = "__unassigned__";
