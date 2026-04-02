// Topology view layout configuration — centralised so quick tuning is possible
export const TOPOLOGY_CONFIG = {
  // World layout defaults
  TILE_SIZE: 1000,
  // Visual shard glyph sizing
  SHARD_SIZE: 18, // px
  SHARD_GAP: 3, // px
  // Preferred number of shard columns used as a starting point; actual rows may increase
  SHARDS_PER_ROW_BASE: 6,
  // Limit rows to avoid extremely tall nodes; frontend setting can override
  MAX_SHARD_ROWS: 6,
  // Default group (node) width — smaller to avoid overly wide nodes
  GROUP_WIDTH: 280,
};

export default TOPOLOGY_CONFIG;
