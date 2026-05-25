import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import type { IndexInfo, PaginatedResponse } from '../types/api';
import { useClusterPaginated } from './useClusterPaginated';

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
  const { filters, page = 1, pageSize = 1000, ...rest } = options;
  return useClusterPaginated(
    clusterId,
    queryKeys.cluster(clusterId ?? '').indices(page, filters),
    (id, p, ps) => apiClient.getIndices(id, p, ps, filters),
    { page, pageSize, ...rest }
  );
}
