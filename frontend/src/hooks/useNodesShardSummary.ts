import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import type { NodeShardSummary } from '../types/api';

/**
 * Fetches per-node shard count summaries for the canvas topology view.
 *
 * Uses GET /clusters/:id/nodes/shard-summary which issues a single
 * _cat/shards call on the backend and returns aggregated primary/replica/
 * unassigned counts per node — no full ShardInfo objects.
 *
 * This is intentionally lightweight: the canvas topology view only needs
 * badge totals at L0/L1 zoom. Full shard arrays (needed at L2) are provided
 * by the tile system, not by this hook.
 *
 * Requirements: 4.9
 */
export function useNodesShardSummary(
  clusterId: string | undefined,
  options: {
    enabled?: boolean;
    refetchInterval?: number | false;
    staleTime?: number;
  } = {}
) {
  const {
    enabled = true,
    refetchInterval,
    staleTime = 5 * 60 * 1000, // 5 minutes — same as UNASSIGNED shard query
  } = options;

  return useQuery<NodeShardSummary[]>({
    queryKey: queryKeys.cluster(clusterId ?? '').nodeShardSummary(),
    queryFn: async () => {
      if (!clusterId) throw new Error('Cluster ID is required');
      return apiClient.getNodesShardSummary(clusterId);
    },
    enabled: !!clusterId && enabled,
    refetchInterval,
    staleTime,
    placeholderData: () => [],
  });
}
