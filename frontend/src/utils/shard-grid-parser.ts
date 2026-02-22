import type {
  NodeInfo,
  IndexInfo,
  ShardInfo,
  NodeWithShards,
  IndexMetadata,
  ShardGridData,
} from '../types/api';

/**
 * Parse cluster state and build shard grid data structure
 *
 * This module provides utilities to transform raw cluster data (nodes, indices, shards)
 * into the structured format needed for the shard grid visualization.
 *
 * Requirements: 3.1, 3.11
 */

/**
 * Build a map of node identifiers to node names for matching shards to nodes
 *
 * Elasticsearch can reference nodes by ID, name, or IP address in different contexts.
 * This function creates a lookup map to handle all these cases.
 */
function buildNodeIdentifierMap(nodes: NodeInfo[]): Map<string, string> {
  const map = new Map<string, string>();

  for (const node of nodes) {
    // Map node ID to node name
    map.set(node.id, node.name);

    // Map node name to itself
    map.set(node.name, node.name);

    // Map node IP to node name (if IP is available)
    if (node.ip) {
      map.set(node.ip, node.name);
    }
  }

  return map;
}

/**
 * Parse nodes and organize shards by node and index
 *
 * Transforms NodeInfo[] into NodeWithShards[] by:
 * 1. Creating a map of shards for each node
 * 2. Grouping shards by index name
 * 3. Handling relocating shards (they appear on both source and destination nodes)
 *
 * Requirements: 3.1, 3.2, 3.11
 */
export function parseNodesWithShards(nodes: NodeInfo[], shards: ShardInfo[]): NodeWithShards[] {
  // Build identifier map for matching shards to nodes
  const nodeIdentifierMap = buildNodeIdentifierMap(nodes);

  // Initialize nodes with empty shard maps
  const nodesWithShards: NodeWithShards[] = nodes.map((node) => ({
    ...node,
    shards: new Map<string, ShardInfo[]>(),
  }));

  // Create a lookup map from node name to NodeWithShards
  const nodesByName = new Map<string, NodeWithShards>();
  for (const node of nodesWithShards) {
    nodesByName.set(node.name, node);
  }

  // Assign shards to nodes
  for (const shard of shards) {
    // Skip unassigned shards (they don't belong to any node)
    if (!shard.node || shard.state === 'UNASSIGNED') {
      continue;
    }

    // Find the node name using the identifier map
    const nodeName = nodeIdentifierMap.get(shard.node);
    if (!nodeName) {
      // If we can't find a matching node, skip this shard
      console.warn(
        `Could not find node for shard: ${shard.index}[${shard.shard}] on node ${shard.node}`
      );
      continue;
    }

    const node = nodesByName.get(nodeName);
    if (!node) {
      continue;
    }

    // Get or create the shard array for this index
    if (!node.shards.has(shard.index)) {
      node.shards.set(shard.index, []);
    }

    // Add the shard to the node
    node.shards.get(shard.index)!.push(shard);

    // Handle relocating shards - create destination indicator
    // Requirements: 3.11
    if (shard.state === 'RELOCATING' && shard.relocatingNode) {
      const destNodeName = nodeIdentifierMap.get(shard.relocatingNode);
      if (destNodeName) {
        const destNode = nodesByName.get(destNodeName);
        if (destNode) {
          // Create a destination indicator shard
          const destinationShard: ShardInfo = {
            ...shard,
            node: shard.relocatingNode,
            state: 'INITIALIZING', // Show as initializing on destination
          };

          if (!destNode.shards.has(shard.index)) {
            destNode.shards.set(shard.index, []);
          }

          destNode.shards.get(shard.index)!.push(destinationShard);
        }
      }
    }
  }

  return nodesWithShards;
}

/**
 * Parse indices and add metadata
 *
 * Transforms IndexInfo[] into IndexMetadata[] by adding:
 * - Total shard count (primary + replicas)
 * - Document count
 * - Total size
 *
 * Requirements: 3.1, 3.3
 */
export function parseIndexMetadata(indices: IndexInfo[]): IndexMetadata[] {
  return indices.map((index) => ({
    ...index,
    shardCount: index.primaryShards * (index.replicaShards + 1),
    docsCount: index.docsCount,
    size: index.storeSize,
  }));
}

/**
 * Extract unassigned shards from shard list
 *
 * Unassigned shards are shards that are not allocated to any node.
 * They need special handling in the grid visualization.
 *
 * Requirements: 3.1, 3.10
 */
export function extractUnassignedShards(shards: ShardInfo[]): ShardInfo[] {
  return shards.filter((shard) => shard.state === 'UNASSIGNED');
}

/**
 * Parse complete cluster state into shard grid data
 *
 * This is the main entry point for building the shard grid data structure.
 * It combines nodes, indices, and shards into a single ShardGridData object.
 *
 * Requirements: 3.1, 3.11
 */
export function parseShardGridData(
  nodes: NodeInfo[],
  indices: IndexInfo[],
  shards: ShardInfo[]
): ShardGridData {
  return {
    nodes: parseNodesWithShards(nodes, shards),
    indices: parseIndexMetadata(indices),
    unassignedShards: extractUnassignedShards(shards),
  };
}

/**
 * Get shards for a specific node and index
 *
 * Helper function to retrieve shards at a specific grid cell (node x index).
 * Returns an empty array if no shards are found.
 */
export function getShardsForNodeAndIndex(node: NodeWithShards, indexName: string): ShardInfo[] {
  return node.shards.get(indexName) || [];
}

/**
 * Check if an index has any problem shards
 *
 * Problem shards are shards that are:
 * - UNASSIGNED
 * - RELOCATING
 * - INITIALIZING
 *
 * This is useful for highlighting problematic indices in the grid.
 */
export function indexHasProblems(indexName: string, shards: ShardInfo[]): boolean {
  const indexShards = shards.filter((s) => s.index === indexName);
  return indexShards.some(
    (s) => s.state === 'UNASSIGNED' || s.state === 'RELOCATING' || s.state === 'INITIALIZING'
  );
}

/**
 * Group shards by index name
 *
 * Helper function to organize shards by their index.
 * Useful for analyzing shard distribution per index.
 */
export function groupShardsByIndex(shards: ShardInfo[]): Map<string, ShardInfo[]> {
  const grouped = new Map<string, ShardInfo[]>();

  for (const shard of shards) {
    if (!grouped.has(shard.index)) {
      grouped.set(shard.index, []);
    }
    grouped.get(shard.index)!.push(shard);
  }

  return grouped;
}

/**
 * Count shards by state
 *
 * Helper function to get statistics about shard states.
 * Returns a map of state -> count.
 */
export function countShardsByState(shards: ShardInfo[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const shard of shards) {
    const count = counts.get(shard.state) || 0;
    counts.set(shard.state, count + 1);
  }

  return counts;
}
