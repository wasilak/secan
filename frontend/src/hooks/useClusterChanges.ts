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
  
  // Track if we've initialized for this cluster in this session
  // This prevents showing notifications for existing items on page load/refresh
  const initializedRef = useRef<boolean>(false);
  
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
      initializedRef.current = false;
      // Don't call onChanges here - just reset state
      return;
    }

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

    // If not yet initialized for this cluster, set initial state without detecting changes
    // This prevents notifications for all existing items on first load
    if (!initializedRef.current) {
      // Only initialize if we have actual data in BOTH arrays (not empty arrays from loading state)
      // This prevents detecting everything as "added" when one array loads before the other
      // We wait for both to have data to ensure we capture the complete initial state
      if (nodes.length > 0 && indices.length > 0) {
        previousStateRef.current = currentState;
        initializedRef.current = true;
      }
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
