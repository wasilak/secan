import { useState, useEffect, useRef } from 'react';
import { apiClient } from '../api/client';
import { ShardInfo } from '../types/api';

interface NodeShardsState {
  [nodeId: string]: {
    shards: ShardInfo[];
    loading: boolean;
    error: Error | null;
  };
}

/**
 * Hook to progressively load shards per node for topology view
 * 
 * This prevents OOM by loading shards in batches per node rather than
 * fetching all shards at once. Uses the getNodeShards API which is
 * memory-efficient on both frontend and backend.
 * 
 * @param clusterId - Cluster identifier
 * @param nodeIds - Array of node IDs to load shards for
 * @param enabled - Whether to start loading (default: true)
 * @param batchSize - Number of nodes to load concurrently (default: 4)
 * @returns Object with shards state per node and loading status
 */
export function usePerNodeShards(
  clusterId: string | undefined,
  nodeIds: string[],
  enabled: boolean = true,
  batchSize: number = 4
) {
  const [nodeShards, setNodeShards] = useState<NodeShardsState>({});
  const [isComplete, setIsComplete] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loadedNodesRef = useRef<Set<string>>(new Set());

  // Reset when cluster or nodes change
  useEffect(() => {
    if (!clusterId || nodeIds.length === 0) {
      setNodeShards({});
      setIsComplete(false);
      loadedNodesRef.current.clear();
      return;
    }

    // Cancel previous loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Initialize state for all nodes as loading
    const initialState: NodeShardsState = {};
    nodeIds.forEach(nodeId => {
      initialState[nodeId] = { shards: [], loading: true, error: null };
    });
    setNodeShards(initialState);
    setIsComplete(false);
    setIsInitialLoading(true);
    loadedNodesRef.current.clear();

    // Progressive loading in batches
    const loadShardsProgressively = async () => {
      const nodesToLoad = nodeIds.filter(id => !loadedNodesRef.current.has(id));
      
      for (let i = 0; i < nodesToLoad.length; i += batchSize) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const batch = nodesToLoad.slice(i, i + batchSize);
        
        // Load batch concurrently
        await Promise.all(
          batch.map(async (nodeId) => {
            try {
              const shards = await apiClient.getNodeShards(clusterId, nodeId);
              
              if (!abortControllerRef.current?.signal.aborted) {
                loadedNodesRef.current.add(nodeId);
                setNodeShards(prev => ({
                  ...prev,
                  [nodeId]: { shards, loading: false, error: null },
                }));
              }
            } catch (error) {
              if (!abortControllerRef.current?.signal.aborted) {
                setNodeShards(prev => ({
                  ...prev,
                  [nodeId]: { 
                    shards: [], 
                    loading: false, 
                    error: error instanceof Error ? error : new Error(String(error)) 
                  },
                }));
              }
            }
          })
        );

        // Small delay between batches to prevent overwhelming the backend
        if (i + batchSize < nodesToLoad.length) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      }

      if (!abortControllerRef.current?.signal.aborted) {
        setIsComplete(true);
        setIsInitialLoading(false);
      }
    };

    if (enabled) {
      loadShardsProgressively();
    }

    // Cleanup
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [clusterId, nodeIds, enabled, batchSize]);

  // Aggregate all shards for compatibility
  const allShards = Object.values(nodeShards).flatMap(n => n.shards);
  const isLoading = Object.values(nodeShards).some(n => n.loading);
  const hasErrors = Object.values(nodeShards).some(n => n.error !== null);
  
  // Get first error for error display
  const firstError = Object.values(nodeShards).find(n => n.error !== null)?.error ?? null;

  return {
    nodeShards,
    allShards,
    isLoading,
    isInitialLoading,
    isComplete,
    hasErrors,
    firstError,
  };
}
