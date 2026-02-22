import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';

/**
 * Hook to resolve and cache cluster display names
 *
 * Resolution priority:
 * 1. Config name (from ClusterInfo.name) - if different from cluster's own name
 * 2. Cluster name (from ClusterStats.clusterName) - the actual ES cluster name
 *
 * The hook fetches both cluster info and stats, then resolves the display name
 * according to the priority above. Results are cached by React Query.
 *
 * Requirements: 3.1, 3.2
 *
 * @param clusterId - The cluster ID to resolve the name for
 * @returns The resolved display name, or the cluster ID if resolution fails
 */
export function useClusterName(clusterId: string): string {
  // Fetch cluster info (contains config name)
  const { data: clusterInfo } = useQuery({
    queryKey: ['cluster', clusterId, 'info'],
    queryFn: async () => {
      const clusters = await apiClient.getClusters();
      return clusters.find((c) => c.id === clusterId);
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Fetch cluster stats (contains actual cluster name)
  const { data: clusterStats } = useQuery({
    queryKey: ['cluster', clusterId, 'stats'],
    queryFn: () => apiClient.getClusterStats(clusterId),
    staleTime: 30 * 1000, // Cache for 30 seconds
  });

  // Resolve name according to priority:
  // 1. If config name exists and differs from cluster name, use config name
  // 2. Otherwise use cluster name from stats
  // 3. Fall back to cluster ID if nothing else available

  const configName = clusterInfo?.name;
  const clusterName = clusterStats?.clusterName;

  // If we have both names and config name differs from both cluster name AND cluster ID,
  // then config name is a custom override and takes precedence
  if (configName && clusterName && configName !== clusterName && configName !== clusterId) {
    return configName;
  }

  // Otherwise use cluster name if available
  if (clusterName) {
    return clusterName;
  }

  // Fall back to config name if cluster name not yet loaded
  if (configName && configName !== clusterId) {
    return configName;
  }

  // Final fallback to cluster ID
  return clusterId;
}
