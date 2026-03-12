/**
 * Hook for detecting cluster topology changes
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { useRef, useEffect, useState } from 'react';
import type { NodeInfo, IndexInfo } from '../types/api';
import {
  detectClusterChanges,
  type ClusterState,
  type ClusterChanges,
} from '../utils/clusterDiff';

/**
 * Hook that detects changes in cluster topology by comparing current state with previous state
 * 
 * @param clusterId - Cluster identifier for tracking state
 * @param nodes - Current list of nodes
 * @param indices - Current list of indices
 * @returns ClusterChanges object with detected changes, or null if no changes or first load
 * 
 * Requirements:
 * - 1.1: Detect nodes added/removed
 * - 1.2: Detect indices created/deleted
 * - 1.3: Return structured ClusterChanges object
 * - 1.4: Use useRef to store previous state
 */
export function useClusterChanges(
  clusterId: string,
  nodes: NodeInfo[] | undefined,
  indices: IndexInfo[] | undefined
): ClusterChanges | null {
  // Store previous cluster state using useRef to persist across renders
  const previousStateRef = useRef<ClusterState | null>(null);
  
  // Store detected changes in state so they can be safely returned during render
  const [changes, setChanges] = useState<ClusterChanges | null>(null);

  useEffect(() => {
    // Skip if data is not yet loaded
    if (!nodes || !indices) {
      return;
    }

    // Create current state snapshot
    const currentState: ClusterState = {
      nodes,
      indices,
      timestamp: Date.now(),
    };

    // Detect changes by comparing with previous state
    const detectedChanges = detectClusterChanges(previousStateRef.current, currentState);

    // Update state with detected changes
    setChanges(detectedChanges);

    // Update previous state for next comparison
    previousStateRef.current = currentState;
  }, [clusterId, nodes, indices]);

  return changes;
}
