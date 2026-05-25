import { type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import type { NodeInfo, PaginatedResponse } from '../types/api';
import { useClusterPaginated } from './useClusterPaginated';

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
  const { filters, page = 1, pageSize = 1000, ...rest } = options;
  return useClusterPaginated(
    clusterId,
    queryKeys.cluster(clusterId ?? '').nodes(page, pageSize, filters),
    (id, p, ps) => apiClient.getNodes(id, p, ps, filters as never),
    { page, pageSize, ...rest }
  );
}
