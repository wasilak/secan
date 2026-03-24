import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { NodeInfo } from '../types/api';

/**
 * Hook to fetch node information for a cluster
 * 
 * Wraps the existing getNodes() API to retrieve node details including
 * heap, disk, CPU data for use in tooltips and visualizations.
 * Uses TanStack Query for caching and automatic refetching.
 * 
 * @param clusterId - Cluster identifier
 * @param refreshInterval - Refetch interval in milliseconds (default: 30000)
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with node data
 * 
 * Requirements: 9.2, 4.1
 */
export function useNodes(
  clusterId: string | undefined,
  refreshInterval: number = 30000,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.cluster(clusterId!).nodes(),
    queryFn: async (): Promise<NodeInfo[]> => {
      if (!clusterId) throw new Error('Cluster ID is required');
      
      // Call existing getNodes() API to fetch all nodes
      // We fetch all nodes (page size 1000) to ensure we have complete data
      const response = await apiClient.getNodes(clusterId, 1, 1000);
      
      // Return the node items with all details (heap, disk, CPU, etc.)
      return response.items;
    },
    enabled: !!clusterId && enabled,
    refetchInterval: refreshInterval,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}
