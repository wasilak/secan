import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import type { NodeInfo, PaginatedResponse } from '../types/api';

interface UseClusterNodesOptions
  extends Pick<
    UseQueryOptions<PaginatedResponse<NodeInfo>>,
    'staleTime' | 'refetchInterval' | 'placeholderData'
  > {
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
}

export function useClusterNodes(
  clusterId: string | undefined,
  options: UseClusterNodesOptions = {}
): UseQueryResult<PaginatedResponse<NodeInfo>> {
  const {
    enabled = true,
    page = 1,
    pageSize = 1000,
    filters,
    staleTime,
    refetchInterval,
    placeholderData,
  } = options;

  return useQuery({
    queryKey: queryKeys.cluster(clusterId ?? '').nodes(page, pageSize, filters),
    queryFn: async () => {
      if (!clusterId) throw new Error('Cluster ID is required');
      return apiClient.getNodes(clusterId, page, pageSize, filters as never);
    },
    enabled: !!clusterId && enabled,
    staleTime,
    refetchInterval,
    placeholderData,
  });
}
