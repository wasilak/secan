import { ShardInfo } from '../types/api';

/**
 * Grouped shards by node for visualization
 * 
 * Requirements: 2.1, 2.2, 2.5
 */
export interface NodeShardGroup {
  /** Node ID (or undefined for unassigned shards) */
  nodeId: string | undefined;
  /** Node name (or 'Unassigned' for unassigned shards) */
  nodeName: string;
  /** Shards on this node */
  shards: ShardInfo[];
  /** Total shard count on this node */
  shardCount: number;
}

/**
 * Grouped shards separated by primary and replica
 * 
 * Requirements: 2.1, 2.2, 2.5
 */
export interface GroupedShards {
  /** Nodes with primary shards (left side) */
  primaryNodes: NodeShardGroup[];
  /** Nodes with replica shards (right side) */
  replicaNodes: NodeShardGroup[];
  /** Unassigned shards (bottom section) */
  unassignedShards: ShardInfo[];
}

/**
 * Groups shards by node and separates into primary and replica groups
 * 
 * This function transforms a flat array of ShardInfo objects into a structured
 * format suitable for the APM-style visualization. It:
 * 1. Separates shards into primary and replica groups
 * 2. Groups shards by node for each group
 * 3. Handles nodes with both primary and replica shards (appear on both sides)
 * 4. Calculates total shard counts per node
 * 5. Separates unassigned shards
 * 
 * @param shards - Array of shard information for an index
 * @returns Grouped shards ready for visualization
 * 
 * Requirements: 2.1, 2.2, 2.5
 */
export function groupShardsByNode(shards: ShardInfo[]): GroupedShards {
  // Separate assigned and unassigned shards
  const assignedShards = shards.filter(shard => shard.node !== undefined);
  const unassignedShards = shards.filter(shard => shard.node === undefined);
  
  // Separate primary and replica shards
  const primaryShards = assignedShards.filter(shard => shard.primary);
  const replicaShards = assignedShards.filter(shard => !shard.primary);
  
  // Group primary shards by node
  const primaryNodeMap = new Map<string, ShardInfo[]>();
  for (const shard of primaryShards) {
    const nodeId = shard.node!;
    if (!primaryNodeMap.has(nodeId)) {
      primaryNodeMap.set(nodeId, []);
    }
    primaryNodeMap.get(nodeId)!.push(shard);
  }
  
  // Group replica shards by node
  const replicaNodeMap = new Map<string, ShardInfo[]>();
  for (const shard of replicaShards) {
    const nodeId = shard.node!;
    if (!replicaNodeMap.has(nodeId)) {
      replicaNodeMap.set(nodeId, []);
    }
    replicaNodeMap.get(nodeId)!.push(shard);
  }
  
  // Convert maps to NodeShardGroup arrays
  const primaryNodes: NodeShardGroup[] = Array.from(primaryNodeMap.entries()).map(
    ([nodeId, shards]) => ({
      nodeId,
      nodeName: nodeId, // Will be enriched with actual node name from NodeInfo
      shards,
      shardCount: shards.length,
    })
  );
  
  const replicaNodes: NodeShardGroup[] = Array.from(replicaNodeMap.entries()).map(
    ([nodeId, shards]) => ({
      nodeId,
      nodeName: nodeId, // Will be enriched with actual node name from NodeInfo
      shards,
      shardCount: shards.length,
    })
  );
  
  return {
    primaryNodes,
    replicaNodes,
    unassignedShards,
  };
}
