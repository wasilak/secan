/**
 * Node Positioning Utilities for Index Visualization
 * 
 * Provides utilities for calculating node positions in the APM-style visualization.
 * Handles positioning of primary nodes on the left and replica nodes on the right
 * with appropriate vertical spacing.
 * 
 * Requirements: 1.2, 1.3, 2.3, 2.4
 * 
 * @module nodePositioning
 */

import type { ShardInfo } from '../types/api';
import { assertDefined } from './assert';
import { sortShards } from './shardOrdering';

/**
 * Node with shard information for visualization
 */
interface NodeWithShards {
  nodeId: string;
  nodeName: string;
  shards: ShardInfo[];
  shardCount: number;
}

/**
 * Position information for a node in the visualization
 */
export interface NodePosition {
  nodeId: string;
  nodeName: string;
  x: number;
  y: number;
  shards: ShardInfo[];
  shardCount: number;
}

/**
 * Configuration for node positioning
 */
export interface PositioningConfig {
  /** Width of the visualization container */
  containerWidth: number;
  /** Height of the visualization container */
  containerHeight: number;
  /** Width of the center index element */
  centerWidth: number;
  /** Height of each node card */
  nodeHeight: number;
  /** Vertical spacing between nodes */
  nodeSpacing: number;
  /** Horizontal distance from center to side nodes */
  horizontalOffset: number;
}

/**
 * Default positioning configuration
 */
export const DEFAULT_POSITIONING_CONFIG: PositioningConfig = {
  containerWidth: 1000,
  containerHeight: 600,
  centerWidth: 250,
  nodeHeight: 80,
  nodeSpacing: 20,
  horizontalOffset: 300,
};

/**
 * Group shards by node and separate into primary and replica groups
 * 
 * Takes an array of shards and groups them by the node they're assigned to.
 * Separates nodes into two groups: those with primary shards (left side) and
 * those with replica shards (right side).
 * 
 * Note: A node can appear on both sides if it has both primary and replica shards
 * for the same index (Requirement 2.5).
 * 
 * Requirements: 2.1, 2.2, 2.5
 * 
 * @param shards - Array of shard information
 * @returns Object with primary and replica node groups
 * 
 * @example
 * const shards = [
 *   { index: 'test', shard: 0, primary: true, node: 'node-1', ... },
 *   { index: 'test', shard: 0, primary: false, node: 'node-2', ... },
 * ];
 * const { primaryNodes, replicaNodes } = groupShardsByNode(shards);
 * // primaryNodes: [{ nodeId: 'node-1', shards: [...], shardCount: 1 }]
 * // replicaNodes: [{ nodeId: 'node-2', shards: [...], shardCount: 1 }]
 */
function groupShardsByNode(shards: ShardInfo[]): {
  primaryNodes: NodeWithShards[];
  replicaNodes: NodeWithShards[];
  unassignedShards: ShardInfo[];
} {
  // Filter out unassigned shards (no node)
  const assignedShards = shards.filter(shard => shard.node);
  const unassignedShards = shards.filter(shard => !shard.node);
  
  // Group by node and primary/replica status
  const primaryNodeMap = new Map<string, ShardInfo[]>();
  const replicaNodeMap = new Map<string, ShardInfo[]>();
  
  for (const shard of assignedShards) {
    const nodeId = shard.node!;
    
    if (shard.primary) {
      if (!primaryNodeMap.has(nodeId)) {
        primaryNodeMap.set(nodeId, []);
      }
      const primaryShards = primaryNodeMap.get(nodeId);
      assertDefined(primaryShards, 'Expected primary shard array to be initialised');
      primaryShards.push(shard);
    } else {
      if (!replicaNodeMap.has(nodeId)) {
        replicaNodeMap.set(nodeId, []);
      }
      const replicaShards = replicaNodeMap.get(nodeId);
      assertDefined(replicaShards, 'Expected replica shard array to be initialised');
      replicaShards.push(shard);
    }
  }
  
  // Convert maps to arrays of NodeWithShards
  // Apply deterministic sorting to shards - Requirements: 9.1, 9.2, 9.3
  const primaryNodes: NodeWithShards[] = Array.from(primaryNodeMap.entries()).map(
    ([nodeId, shards]) => ({
      nodeId,
      nodeName: nodeId, // Use nodeId as name for now, can be enriched with NodeInfo later
      shards: sortShards(shards),
      shardCount: shards.length,
    })
  );
  
  const replicaNodes: NodeWithShards[] = Array.from(replicaNodeMap.entries()).map(
    ([nodeId, shards]) => ({
      nodeId,
      nodeName: nodeId,
      shards: sortShards(shards),
      shardCount: shards.length,
    })
  );
  
  return { primaryNodes, replicaNodes, unassignedShards };
}

/**
 * Calculate vertical positions for nodes with even spacing
 * 
 * Distributes nodes vertically in the container with equal spacing.
 * Centers the group of nodes vertically in the container.
 * 
 * Requirements: 1.2, 1.3, 2.3, 2.4
 * 
 * @param nodeCount - Number of nodes to position
 * @param config - Positioning configuration
 * @returns Array of Y positions for each node
 * 
 * @example
 * const yPositions = calculateVerticalPositions(3, config);
 * // Returns: [150, 250, 350] (centered in 600px container)
 */
function calculateVerticalPositions(
  nodeCount: number,
  config: PositioningConfig
): number[] {
  if (nodeCount === 0) {
    return [];
  }
  
  // Calculate total height needed for all nodes
  const totalNodesHeight = nodeCount * config.nodeHeight + (nodeCount - 1) * config.nodeSpacing;
  
  // Calculate starting Y position to center the group
  const startY = (config.containerHeight - totalNodesHeight) / 2;
  
  // Generate Y positions for each node
  const positions: number[] = [];
  for (let i = 0; i < nodeCount; i++) {
    const y = startY + i * (config.nodeHeight + config.nodeSpacing);
    positions.push(y);
  }
  
  return positions;
}

/**
 * Calculate positions for primary nodes (left side on desktop, top on mobile)
 * 
 * Positions primary shard nodes on the left side of the center index element
 * in desktop view. In mobile view (when horizontalOffset is 0), positions
 * nodes vertically above the center element.
 * 
 * Requirements: 1.2, 2.3, 8.2
 * 
 * @param nodes - Array of nodes with primary shards
 * @param config - Positioning configuration
 * @returns Array of positioned nodes with coordinates
 * 
 * @example
 * const primaryNodes = [{ nodeId: 'node-1', shards: [...], shardCount: 2 }];
 * const positions = calculatePrimaryNodePositions(primaryNodes, config);
 * // Desktop: [{ nodeId: 'node-1', x: 200, y: 260, ... }]
 * // Mobile: [{ nodeId: 'node-1', x: 85, y: 150, ... }]
 */
function calculatePrimaryNodePositions(
  nodes: NodeWithShards[],
  config: PositioningConfig
): NodePosition[] {
  // Determine if this is mobile layout (vertical stacking)
  const isMobileLayout = config.horizontalOffset === 0;
  
  if (isMobileLayout) {
    // Mobile: center nodes horizontally, position at top of container
    // Requirements: 8.2 - Stack nodes vertically when viewport width < 768px
    const startYOffset = 100; // Start position at top for primary nodes
    
    const yPositions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const y = startYOffset + i * (config.nodeHeight + config.nodeSpacing);
      yPositions.push(y);
    }
    
    const centerX = config.containerWidth / 2;
    const nodeWidth = 180; // Standard node card width
    const x = centerX - nodeWidth / 2;
    
    return nodes.map((node, index) => ({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      x,
      y: yPositions[index],
      shards: node.shards,
      shardCount: node.shardCount,
    }));
  }
  
  // Desktop: position on left side
  const yPositions = calculateVerticalPositions(nodes.length, config);
  const centerX = config.containerWidth / 2;
  const x = centerX - config.centerWidth / 2 - config.horizontalOffset;
  
  return nodes.map((node, index) => ({
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    x,
    y: yPositions[index],
    shards: node.shards,
    shardCount: node.shardCount,
  }));
}

/**
 * Calculate positions for replica nodes (right side on desktop, bottom on mobile)
 * 
 * Positions replica shard nodes on the right side of the center index element
 * in desktop view. In mobile view (when horizontalOffset is 0), positions
 * nodes vertically below the center element.
 * 
 * Requirements: 1.3, 2.4, 8.2
 * 
 * @param nodes - Array of nodes with replica shards
 * @param config - Positioning configuration
 * @returns Array of positioned nodes with coordinates
 * 
 * @example
 * const replicaNodes = [{ nodeId: 'node-2', shards: [...], shardCount: 1 }];
 * const positions = calculateReplicaNodePositions(replicaNodes, config);
 * // Desktop: [{ nodeId: 'node-2', x: 800, y: 260, ... }]
 * // Mobile: [{ nodeId: 'node-2', x: 85, y: 450, ... }]
 */
function calculateReplicaNodePositions(
  nodes: NodeWithShards[],
  config: PositioningConfig
): NodePosition[] {
  // Determine if this is mobile layout (vertical stacking)
  const isMobileLayout = config.horizontalOffset === 0;
  
  if (isMobileLayout) {
    // Mobile: center nodes horizontally, position below center element
    // Calculate Y positions starting after the center element
    const startYOffset = 300; // Start position below center element (increased from 250)
    
    const yPositions: number[] = [];
    for (let i = 0; i < nodes.length; i++) {
      const y = startYOffset + i * (config.nodeHeight + config.nodeSpacing);
      yPositions.push(y);
    }
    
    const centerX = config.containerWidth / 2;
    const nodeWidth = 180; // Standard node card width
    const x = centerX - nodeWidth / 2;
    
    return nodes.map((node, index) => ({
      nodeId: node.nodeId,
      nodeName: node.nodeName,
      x,
      y: yPositions[index],
      shards: node.shards,
      shardCount: node.shardCount,
    }));
  }
  
  // Desktop: position on right side
  const yPositions = calculateVerticalPositions(nodes.length, config);
  const centerX = config.containerWidth / 2;
  const x = centerX + config.centerWidth / 2 + config.horizontalOffset;
  
  return nodes.map((node, index) => ({
    nodeId: node.nodeId,
    nodeName: node.nodeName,
    x,
    y: yPositions[index],
    shards: node.shards,
    shardCount: node.shardCount,
  }));
}

/**
 * Calculate all node positions for the visualization
 * 
 * Main function that orchestrates positioning of all nodes.
 * Groups shards by node, separates into primary/replica, and calculates positions.
 * 
 * Requirements: 1.2, 1.3, 2.3, 2.4
 * 
 * @param shards - Array of all shards for the index
 * @param config - Positioning configuration (optional, uses defaults if not provided)
 * @returns Object with positioned primary and replica nodes, plus unassigned shards
 * 
 * @example
 * const shards = [...]; // ShardInfo array
 * const { primaryNodes, replicaNodes, unassignedShards } = calculateNodePositions(shards);
 * // Use positioned nodes for rendering
 */
export function calculateNodePositions(
  shards: ShardInfo[],
  config: PositioningConfig = DEFAULT_POSITIONING_CONFIG
): {
  primaryNodes: NodePosition[];
  replicaNodes: NodePosition[];
  unassignedShards: ShardInfo[];
} {
  // Group shards by node
  const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);
  
  // Calculate positions for each group
  const positionedPrimaryNodes = calculatePrimaryNodePositions(primaryNodes, config);
  const positionedReplicaNodes = calculateReplicaNodePositions(replicaNodes, config);
  
  return {
    primaryNodes: positionedPrimaryNodes,
    replicaNodes: positionedReplicaNodes,
    unassignedShards,
  };
}
