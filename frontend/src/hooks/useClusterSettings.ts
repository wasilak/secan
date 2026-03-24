import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';

/**
 * Canonical shape of the /_cluster/settings response.
 * All fields are Record<string, unknown> because the shape of individual
 * settings values varies by Elasticsearch/OpenSearch version.
 */
export interface ClusterSettings {
  persistent: Record<string, unknown>;
  transient: Record<string, unknown>;
  defaults?: Record<string, unknown>;
}

type QueryOptions = Omit<
  UseQueryOptions<ClusterSettings>,
  'queryKey' | 'queryFn'
>;

/**
 * Single canonical hook for fetching cluster settings.
 * All consumers must use this hook instead of inline useQuery calls so that
 * the React Query cache key is consistent and invalidation is reliable.
 */
export function useClusterSettings(
  clusterId: string,
  options?: QueryOptions
) {
  return useQuery<ClusterSettings>({
    queryKey: queryKeys.cluster(clusterId).settings(),
    queryFn: async () => {
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        clusterId,
        'GET',
        '/_cluster/settings'
      );
      return response.data as unknown as ClusterSettings;
    },
    enabled: !!clusterId,
    ...options,
  });
}
