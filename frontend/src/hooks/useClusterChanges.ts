/**
 * Hook for detecting cluster topology changes
 * Requirements: 1.1, 1.2, 1.3, 1.4
 */

import { useRef, useEffect } from 'react';
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
 * @param onChanges - Callback function to handle detected changes
 * 
 * Requirements:
 * - 1.1: Detect nodes added/removed
 * - 1.2: Detect indices created/deleted
 * - 1.3: Return structured ClusterChanges object via callback
 * - 1.4: Use useRef to store previous state
 */
export function useClusterChanges(
  clusterId: string,
  nodes: NodeInfo[] | undefined,
  indices: IndexInfo[] | undefined,
  onChanges: (changes: ClusterChanges | null) => void
): void {
  // Store previous cluster state using useRef to persist across renders
  const previousStateRef = useRef<ClusterState | null>(null);
  
  // Track if we've initialized with first real data (not empty arrays)
  // This prevents showing notifications for existing items on page load/refresh
  const isInitializedRef = useRef<boolean>(false);
  
  // Track the current cluster ID to detect changes
  const clusterIdRef = useRef<string>(clusterId);
  
  // Stable callback reference
  const onChangesRef = useRef(onChanges);
  useEffect(() => {
    onChangesRef.current = onChanges;
  }, [onChanges]);

  useEffect(() => {
    // Reset state when cluster ID changes (e.g., navigating to different cluster)
    if (clusterIdRef.current !== clusterId) {
      clusterIdRef.current = clusterId;
      previousStateRef.current = null;
      isInitializedRef.current = false;
      // Don't call onChanges here - just reset state
      return;
    }

    // Skip if data is not yet loaded (undefined means still loading)
    if (nodes === undefined || indices === undefined) {
      return;
    }

    // Create current state snapshot
    const currentState: ClusterState = {
      nodes,
      indices,
      timestamp: Date.now(),
    };

    // If not initialized yet, wait for BOTH arrays to have actual data
    // This handles the case where queries go: undefined → [] → [data]
    if (!isInitializedRef.current) {
      // Only initialize when we have real data (not just empty arrays from initial fetch)
      if (nodes.length > 0 && indices.length > 0) {
        isInitializedRef.current = true;
        previousStateRef.current = currentState;
      }
      // Don't detect changes until initialized
      return;
    }

    // If there's no previous state (shouldn't happen after initialization), set it
    if (previousStateRef.current === null) {
      previousStateRef.current = currentState;
      return;
    }

    // Detect changes by comparing with previous state
    const detectedChanges = detectClusterChanges(previousStateRef.current, currentState);

    // Update previous state for next comparison
    previousStateRef.current = currentState;

    // Call the callback with detected changes
    onChangesRef.current(detectedChanges);
  }, [clusterId, nodes, indices]);
}
