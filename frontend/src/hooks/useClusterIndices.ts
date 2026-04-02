import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import type { IndexInfo, PaginatedResponse } from '../types/api';

interface UseClusterIndicesOptions
  extends Pick<
    UseQueryOptions<PaginatedResponse<IndexInfo>>,
    'staleTime' | 'refetchInterval' | 'placeholderData'
  > {
  enabled?: boolean;
  page?: number;
  pageSize?: number;
  filters?: Record<string, unknown>;
}

export function useClusterIndices(
  clusterId: string | undefined,
  options: UseClusterIndicesOptions = {}
): UseQueryResult<PaginatedResponse<IndexInfo>> {
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
    queryKey: queryKeys.cluster(clusterId ?? '').indices(page, filters),
    queryFn: async () => {
      if (!clusterId) throw new Error('Cluster ID is required');
      return apiClient.getIndices(clusterId, page, pageSize, filters);
    },
    enabled: !!clusterId && enabled,
    staleTime,
    refetchInterval,
    placeholderData,
  });
}
