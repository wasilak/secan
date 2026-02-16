/**
 * Cluster name resolution utilities
 * 
 * Provides consistent cluster name resolution across the application.
 * Priority: config name > cluster name from settings
 * 
 * Requirements: 3.1, 3.2
 */

import { ClusterInfo } from '../types/api';

/**
 * Cluster name information with resolved display name
 */
export interface ClusterNameInfo {
  clusterId: string;
  configName?: string;
  clusterName: string;
  displayName: string; // Resolved name (config > cluster)
}

/**
 * Resolve cluster display name
 * 
 * Resolution priority:
 * 1. Config name (if provided in configuration)
 * 2. Cluster name (from cluster settings)
 * 
 * @param clusterInfo - Cluster information from API
 * @param configName - Optional config name override
 * @returns Resolved display name
 * 
 * Requirements: 3.1, 3.2
 */
export function resolveClusterName(
  clusterInfo: ClusterInfo,
  configName?: string
): string {
  // Priority: config name > cluster name
  return configName || clusterInfo.name;
}

/**
 * Get cluster name information with resolved display name
 * 
 * @param clusterInfo - Cluster information from API
 * @param configName - Optional config name override
 * @returns Complete cluster name information
 * 
 * Requirements: 3.1, 3.2
 */
export function getClusterNameInfo(
  clusterInfo: ClusterInfo,
  configName?: string
): ClusterNameInfo {
  return {
    clusterId: clusterInfo.id,
    configName,
    clusterName: clusterInfo.name,
    displayName: resolveClusterName(clusterInfo, configName),
  };
}

/**
 * Create a map of cluster IDs to display names
 * 
 * Useful for batch resolution of cluster names.
 * 
 * @param clusters - Array of cluster information
 * @param configNames - Optional map of cluster IDs to config names
 * @returns Map of cluster IDs to display names
 * 
 * Requirements: 3.1, 3.2
 */
export function createClusterNameMap(
  clusters: ClusterInfo[],
  configNames?: Map<string, string>
): Map<string, string> {
  const nameMap = new Map<string, string>();

  for (const cluster of clusters) {
    const configName = configNames?.get(cluster.id);
    const displayName = resolveClusterName(cluster, configName);
    nameMap.set(cluster.id, displayName);
  }

  return nameMap;
}
