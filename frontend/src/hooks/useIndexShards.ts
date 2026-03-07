import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { ShardInfo } from '../types/api';

/**
 * Hook to fetch shard data for a specific index
 * 
 * Wraps the existing getShards() API and filters results to only include
 * shards for the specified index. Uses TanStack Query for caching and
 * automatic refetching.
 * 
 * @param clusterId - Cluster identifier
 * @param indexName - Index name to filter shards by
 * @param refreshInterval - Refetch interval in milliseconds (default: 30000)
 * @param enabled - Whether to enable the query (default: true)
 * @returns Query result with filtered shard data
 * 
 * Requirements: 9.1, 9.5, 7.4
 */
export function useIndexShards(
  clusterId: string | undefined,
  indexName: string | undefined,
  refreshInterval: number = 30000,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['cluster', clusterId, 'shards', 'index', indexName],
    queryFn: async (): Promise<ShardInfo[]> => {
      if (!clusterId) throw new Error('Cluster ID is required');
      if (!indexName) throw new Error('Index name is required');
      
      // Call existing getShards() API with index filter
      // The API supports filtering by index, so we pass it as a filter parameter
      const response = await apiClient.getShards(clusterId, 1, 1000, {
        index: indexName,
      });
      
      // Return the filtered items
      return response.items;
    },
    enabled: !!clusterId && !!indexName && enabled,
    refetchInterval: refreshInterval,
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}
