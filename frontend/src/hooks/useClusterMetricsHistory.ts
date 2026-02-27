import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Hook to fetch historical cluster metrics from Prometheus
 * Returns time series data for the last 24 hours by default
 *
 * @param clusterId - Cluster identifier
 * @param enabled - Whether to enable the query (default: true)
 */
export function useClusterMetricsHistory(
  clusterId: string | undefined,
  enabled: boolean = true
) {
  return useQuery({
    queryKey: ['cluster', clusterId, 'metrics-history'],
    queryFn: async () => {
      if (!clusterId) throw new Error('Cluster ID is required');
      
      // Fetch last 24 hours of metrics
      const endTime = Math.floor(Date.now() / 1000);
      const startTime = endTime - (24 * 60 * 60); // 24 hours ago
      
      const response = await apiClient.getClusterMetrics(clusterId, {
        start: startTime,
        end: endTime,
      });
      
      return response;
    },
    enabled: !!clusterId && enabled,
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data fresh for 30 seconds
  });
}
