/**
 * Cluster state comparison utility for detecting topology changes
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import type { NodeInfo, IndexInfo } from '../types/api';

/**
 * Cluster state snapshot for comparison
 */
export interface ClusterState {
  nodes: NodeInfo[];
  indices: IndexInfo[];
  timestamp: number;
}

/**
 * Detected changes between two cluster states
 */
export interface ClusterChanges {
  nodesAdded: NodeInfo[];
  nodesRemoved: NodeInfo[];
  indicesCreated: IndexInfo[];
  indicesDeleted: IndexInfo[];
}

/**
 * Detects changes between previous and current cluster states
 * 
 * @param previous - Previous cluster state (can be null for initial state)
 * @param current - Current cluster state
 * @returns ClusterChanges object with detected changes, or null if no previous state
 * 
 * Requirements:
 * - 1.1: Detect nodes added/removed by comparing node IDs
 * - 1.2: Detect indices created/deleted by comparing index names
 * - 1.3: Return structured ClusterChanges object
 * - 1.4: Handle null/undefined previous state gracefully
 */
export function detectClusterChanges(
  previous: ClusterState | null | undefined,
  current: ClusterState
): ClusterChanges | null {
  // No previous state means this is the first load - no changes to report
  if (!previous) {
    return null;
  }

  // Create sets of IDs/names for efficient comparison
  const previousNodeIds = new Set(previous.nodes.map((node) => node.id));
  const currentNodeIds = new Set(current.nodes.map((node) => node.id));
  
  const previousIndexNames = new Set(previous.indices.map((index) => index.name));
  const currentIndexNames = new Set(current.indices.map((index) => index.name));

  // Detect nodes added (in current but not in previous)
  const nodesAdded = current.nodes.filter(
    (node) => !previousNodeIds.has(node.id)
  );

  // Detect nodes removed (in previous but not in current)
  const nodesRemoved = previous.nodes.filter(
    (node) => !currentNodeIds.has(node.id)
  );

  // Detect indices created (in current but not in previous)
  const indicesCreated = current.indices.filter(
    (index) => !previousIndexNames.has(index.name)
  );

  // Detect indices deleted (in previous but not in current)
  const indicesDeleted = previous.indices.filter(
    (index) => !currentIndexNames.has(index.name)
  );

  return {
    nodesAdded,
    nodesRemoved,
    indicesCreated,
    indicesDeleted,
  };
}

/**
 * Checks if there are any changes in the ClusterChanges object
 * 
 * @param changes - ClusterChanges object to check
 * @returns true if there are any changes, false otherwise
 */
export function hasChanges(changes: ClusterChanges | null): boolean {
  if (!changes) {
    return false;
  }

  return (
    changes.nodesAdded.length > 0 ||
    changes.nodesRemoved.length > 0 ||
    changes.indicesCreated.length > 0 ||
    changes.indicesDeleted.length > 0
  );
}
