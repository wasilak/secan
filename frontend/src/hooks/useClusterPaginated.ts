import { useQuery, type UseQueryOptions, type UseQueryResult } from '@tanstack/react-query';
import type { PaginatedResponse } from '../types/api';

interface PaginatedOptions<T>
  extends Pick<
    UseQueryOptions<PaginatedResponse<T>>,
    'staleTime' | 'refetchInterval' | 'placeholderData'
  > {
  enabled?: boolean;
  page?: number;
  pageSize?: number;
}

export function useClusterPaginated<T>(
  clusterId: string | undefined,
  queryKey: readonly unknown[],
  fetcher: (id: string, page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  options: PaginatedOptions<T> = {}
): UseQueryResult<PaginatedResponse<T>> {
  const { enabled = true, page = 1, pageSize = 1000, staleTime, refetchInterval, placeholderData } =
    options;

  return useQuery({
    queryKey,
    queryFn: () => fetcher(clusterId!, page, pageSize),
    enabled: !!clusterId && enabled,
    staleTime,
    refetchInterval,
    placeholderData,
  });
}
