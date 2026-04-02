import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import type { PaginatedShardsWithNodes, ShardInfo } from '../types/api';

/**
 * Fetch shards (for a single index) and include authoritative node metadata
 * when the backend provides it. Used by IndexVisualizationFlow which needs
 * the combined response shape.
 */
export function useIndexShardsWithNodes(
  clusterId: string | undefined,
  indexName: string | undefined,
  refreshInterval: number = 30000,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: queryKeys.cluster(clusterId!).shards(undefined, undefined, indexName!),
    queryFn: async (): Promise<PaginatedShardsWithNodes> => {
      if (!clusterId) throw new Error('Cluster ID is required');
      if (!indexName) throw new Error('Index name is required');

      const response = await apiClient.getShards(clusterId, 1, 1000, { index: indexName });

      // If backend returned combined shape, it will have `nodes` field.
      // Normalize to PaginatedShardsWithNodes for callers.
      const possibleCombined = response as unknown as PaginatedShardsWithNodes;
      if (possibleCombined && Array.isArray(possibleCombined.nodes)) {
        return possibleCombined;
      }

      // Legacy response: wrap with empty nodes array
      const legacy = response as { items: ShardInfo[]; total: number; page: number; page_size: number; total_pages: number };
      return {
        items: legacy.items,
        total: legacy.total,
        page: legacy.page,
        page_size: legacy.page_size,
        total_pages: legacy.total_pages,
        nodes: [],
      };
    },
    enabled: !!clusterId && !!indexName && enabled,
    refetchInterval: refreshInterval,
    staleTime: 30000,
  });
}
