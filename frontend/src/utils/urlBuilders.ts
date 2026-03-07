import { ClusterSection, defaultSection, isValidClusterSection } from '../routes/clusterRoutes';

/**
 * URL Builder Utilities
 * 
 * Provides consistent, type-safe URL generation for all cluster navigation patterns.
 * These functions ensure that all URLs follow the same format and prevent hardcoded paths
 * from being scattered throughout the application.
 * 
 * @module urlBuilders
 */

/**
 * Build a cluster section URL
 * 
 * @param clusterId - The ID of the cluster
 * @param section - The section to navigate to (defaults to 'overview')
 * @returns The URL path for the cluster section
 * 
 * @example
 * buildClusterSectionUrl('my-cluster', 'statistics')
 * // Returns: /cluster/my-cluster/statistics
 * 
 * buildClusterSectionUrl('my-cluster')
 * // Returns: /cluster/my-cluster/overview
 */
export function buildClusterSectionUrl(clusterId: string, section?: ClusterSection): string {
  const validSection = section && isValidClusterSection(section) ? section : defaultSection;
  return `/cluster/${clusterId}/${validSection}`;
}

/**
 * Build a node modal URL
 * 
 * Opens a node details modal within a cluster section context.
 * The modal is overlayed on top of the specified section.
 * 
 * @param clusterId - The ID of the cluster
 * @param nodeId - The ID of the node to display
 * @param section - The background section to display (defaults to 'nodes')
 * @returns The URL path for the node modal
 * 
 * @example
 * buildNodeModalUrl('my-cluster', 'node-1')
 * // Returns: /cluster/my-cluster/nodes/node-1
 * 
 * buildNodeModalUrl('my-cluster', 'node-1', 'overview')
 * // Returns: /cluster/my-cluster/nodes/node-1
 */
/**
 * Build a node modal URL
 *
 * Node modals display as overlays over the current section.
 * The background section is preserved via a query parameter.
 *
 * @param clusterId - The ID of the cluster
 * @param nodeId - The ID of the node to display
 * @param backgroundSection - The background section to display behind the modal (defaults to 'nodes')
 * @returns The URL path for the node modal
 *
 * @example
 * buildNodeModalUrl('my-cluster', 'node-1')
 * // Returns: /cluster/my-cluster/nodes/node-1
 *
 * buildNodeModalUrl('my-cluster', 'node-1', 'topology')
 * // Returns: /cluster/my-cluster/nodes/node-1?bg=topology
 */
export function buildNodeModalUrl(
  clusterId: string,
  nodeId: string,
  backgroundSection?: ClusterSection
): string {
  const url = `/cluster/${clusterId}/nodes/${encodeURIComponent(nodeId)}`;
  if (backgroundSection && backgroundSection !== 'nodes') {
    return `${url}?bg=${backgroundSection}`;
  }
  return url;
}

/**
 * Build an index modal URL
 *
 * Opens an index details modal within a cluster section context.
 * The modal can have subsections (visualization, settings, mappings, stats) specified via ?indexTab param.
 * The background section is preserved via a query parameter.
 *
 * @param clusterId - The ID of the cluster
 * @param indexName - The name of the index to display
 * @param indexSection - The index modal section (visualization/settings/mappings/stats) via query param
 * @param backgroundSection - The background section to display behind the modal (defaults to 'indices')
 * @returns The URL path for the index modal
 *
 * @example
 * buildIndexModalUrl('my-cluster', 'my-index')
 * // Returns: /cluster/my-cluster/indices/my-index
 *
 * buildIndexModalUrl('my-cluster', 'my-index', 'mappings')
 * // Returns: /cluster/my-cluster/indices/my-index?indexTab=mappings
 *
 * buildIndexModalUrl('my-cluster', 'my-index', 'mappings', 'topology')
 * // Returns: /cluster/my-cluster/indices/my-index?indexTab=mappings&bg=topology
 */
export function buildIndexModalUrl(
  clusterId: string,
  indexName: string,
  indexSection?: string,
  backgroundSection?: ClusterSection
): string {
  let url = `/cluster/${clusterId}/indices/${encodeURIComponent(indexName)}`;
  const params: string[] = [];
  
  if (indexSection) {
    params.push(`indexTab=${encodeURIComponent(indexSection)}`);
  }
  if (backgroundSection && backgroundSection !== 'indices') {
    params.push(`bg=${encodeURIComponent(backgroundSection)}`);
  }
  
  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }
  return url;
}

/**
 * Build a shard modal URL
 *
 * Opens a shard details modal within a cluster section context.
 * The modal displays as an overlay over the current section.
 * The background section is preserved via a query parameter.
 * Shard IDs are typically in format "shard-id[replica-number]".
 *
 * @param clusterId - The ID of the cluster
 * @param shardId - The ID of the shard to display
 * @param backgroundSection - The background section to display behind the modal (defaults to 'shards')
 * @returns The URL path for the shard modal
 *
 * @example
 * buildShardModalUrl('my-cluster', 'my-index[0]')
 * // Returns: /cluster/my-cluster/shards/my-index%5B0%5D
 *
 * buildShardModalUrl('my-cluster', 'my-index[0]', 'topology')
 * // Returns: /cluster/my-cluster/shards/my-index%5B0%5D?bg=topology
 */
export function buildShardModalUrl(
  clusterId: string,
  shardId: string,
  backgroundSection?: ClusterSection
): string {
  const url = `/cluster/${clusterId}/shards/${encodeURIComponent(shardId)}`;
  if (backgroundSection && backgroundSection !== 'shards') {
    return `${url}?bg=${backgroundSection}`;
  }
  return url;
}

/**
 * Extract the cluster section from a path
 *
 * Reverse mapping function to extract the cluster section from a URL path.
 * For modal paths, checks for a 'bg' query parameter to determine the background section.
 * If no 'bg' param is present, infers the section from the modal type.
 *
 * @param pathname - The URL pathname to extract from
 * @param search - The URL search/query string (optional, for bg parameter)
 * @returns The cluster section if found, otherwise undefined
 *
 * @example
 * extractSectionFromPath('/cluster/my-cluster/statistics')
 * // Returns: 'statistics'
 *
 * extractSectionFromPath('/cluster/my-cluster/nodes/node-1', '?bg=topology')
 * // Returns: 'topology'
 *
 * extractSectionFromPath('/cluster/my-cluster/nodes/node-1')
 * // Returns: 'nodes' (inferred from modal path)
 */
export function extractSectionFromPath(pathname: string, search?: string): ClusterSection | undefined {
  // Check for background section in query params first
  if (search) {
    const params = new URLSearchParams(search);
    const bgSection = params.get('bg') as ClusterSection | null;
    if (bgSection && isValidClusterSection(bgSection)) {
      return bgSection;
    }
  }

  // Fall back to inferring section from path
  const match = pathname.match(/^\/cluster\/[^/]+\/([^/?]+)/);

  if (!match) {
    return undefined;
  }

  const firstPart = match[1];

  // Check if it's a valid section or modal type
  if (isValidClusterSection(firstPart)) {
    return firstPart;
  }

  // Infer section from modal type
  if (firstPart === 'nodes') {
    return 'nodes';
  }
  if (firstPart === 'indices') {
    return 'indices';
  }
  if (firstPart === 'shards') {
    return 'shards';
  }

  return undefined;
}

/**
 * Extract cluster ID from a path
 * 
 * @param pathname - The URL pathname to extract from
 * @returns The cluster ID if found in a cluster path, otherwise undefined
 * 
 * @example
 * extractClusterIdFromPath('/cluster/my-cluster/statistics')
 * // Returns: 'my-cluster'
 * 
 * extractClusterIdFromPath('/dashboard')
 * // Returns: undefined
 */
export function extractClusterIdFromPath(pathname: string): string | undefined {
  const clusterMatch = pathname.match(/^\/cluster\/([^/]+)/);
  return clusterMatch ? clusterMatch[1] : undefined;
}

/**
 * Extract node ID from a modal path
 * 
 * @param pathname - The URL pathname to extract from
 * @returns The node ID if found in a node modal path, otherwise undefined
 * 
 * @example
 * extractNodeIdFromPath('/cluster/my-cluster/nodes/nodes/node-1')
 * // Returns: 'node-1'
 * 
 * extractNodeIdFromPath('/cluster/my-cluster/topology/nodes/node-1')
 * // Returns: 'node-1'
 */
export function extractNodeIdFromPath(pathname: string): string | undefined {
  // Match both old format (/cluster/:id/nodes/:nodeId) and new format (/cluster/:id/:section/nodes/:nodeId)
  const nodeMatch = pathname.match(/\/nodes\/(.+?)(?:\?|$)/);
  return nodeMatch ? decodeURIComponent(nodeMatch[1]) : undefined;
}

/**
 * Extract index name from a modal path
 * 
 * @param pathname - The URL pathname to extract from
 * @returns The index name if found in an index modal path, otherwise undefined
 * 
 * @example
 * extractIndexNameFromPath('/cluster/my-cluster/indices/indices/my-index')
 * // Returns: 'my-index'
 * 
 * extractIndexNameFromPath('/cluster/my-cluster/statistics/indices/my-index')
 * // Returns: 'my-index'
 */
export function extractIndexNameFromPath(pathname: string): string | undefined {
  // Match both old format (/cluster/:id/indices/:name) and new format (/cluster/:id/:section/indices/:name)
  const indexMatch = pathname.match(/\/indices\/(.+?)(?:\?|$)/);
  return indexMatch ? decodeURIComponent(indexMatch[1]) : undefined;
}

/**
 * Extract shard ID from a modal path
 * 
 * @param pathname - The URL pathname to extract from
 * @returns The shard ID if found in a shard modal path, otherwise undefined
 * 
 * @example
 * extractShardIdFromPath('/cluster/my-cluster/shards/shards/my-index%5B0%5D')
 * // Returns: 'my-index[0]'
 * 
 * extractShardIdFromPath('/cluster/my-cluster/topology/shards/my-index%5B0%5D')
 * // Returns: 'my-index[0]'
 */
export function extractShardIdFromPath(pathname: string): string | undefined {
  // Match both old format (/cluster/:id/shards/:shardId) and new format (/cluster/:id/:section/shards/:shardId)
  const shardMatch = pathname.match(/\/shards\/(.+?)(?:\?|$)/);
  return shardMatch ? decodeURIComponent(shardMatch[1]) : undefined;
}

/**
 * Parse all cluster route parameters from a pathname
 * 
 * Comprehensive parsing function that identifies the cluster context and extracts
 * all relevant route parameters from a pathname. Prioritizes modal detection over
 * section detection.
 * 
 * @param pathname - The URL pathname to parse
 * @returns Object containing all parsed parameters
 * 
 * @example
 * parseClusterPath('/cluster/my-cluster/statistics')
 * // Returns: { clusterId: 'my-cluster', section: 'statistics' }
 * 
 * parseClusterPath('/cluster/my-cluster/nodes/node-1')
 * // Returns: { clusterId: 'my-cluster', modal: 'node', nodeId: 'node-1' }
 * 
 * parseClusterPath('/cluster/my-cluster/indices/my-index?section=mappings')
 * // Returns: { clusterId: 'my-cluster', modal: 'index', indexName: 'my-index' }
 */
export function parseClusterPath(pathname: string): {
  clusterId?: string;
  section?: ClusterSection;
  modal?: 'node' | 'index' | 'shard';
  nodeId?: string;
  indexName?: string;
  shardId?: string;
} {
  const clusterId = extractClusterIdFromPath(pathname);
  const section = extractSectionFromPath(pathname);
  
  if (!clusterId) {
    return {};
  }
  
  // Check for node modal
  const nodeId = extractNodeIdFromPath(pathname);
  if (nodeId) {
    return { clusterId, modal: 'node', nodeId };
  }
  
  // Check for index modal
  const indexName = extractIndexNameFromPath(pathname);
  if (indexName) {
    return { clusterId, modal: 'index', indexName };
  }
  
  // Check for shard modal
  const shardId = extractShardIdFromPath(pathname);
  if (shardId) {
    return { clusterId, modal: 'shard', shardId };
  }
  
  // Return section if found
  if (section) {
    return { clusterId, section };
  }
  
  // Just cluster ID
  return { clusterId };
}

/**
 * URL Building Usage Guide
 * 
 * ## Overview
 * These utilities provide type-safe URL construction for all cluster navigation patterns.
 * Use these instead of hardcoding paths throughout the application.
 * 
 * ## Patterns
 * 
 * ### Section Navigation
 * Navigate to cluster sections like Overview, Statistics, Nodes, etc.
 * ```typescript
 * const url = buildClusterSectionUrl('my-cluster', 'statistics');
 * // Result: /cluster/my-cluster/statistics
 * ```
 * 
 * ### Node Modal
 * Display node details as a modal overlay
 * ```typescript
 * const url = buildNodeModalUrl('my-cluster', 'node-1');
 * // Result: /cluster/my-cluster/nodes/node-1
 * ```
 * 
 * ### Index Modal
 * Display index details with optional tab selection
 * ```typescript
 * const url = buildIndexModalUrl('my-cluster', 'my-index', 'mappings');
 * // Result: /cluster/my-cluster/indices/my-index?indexTab=mappings
 * ```
 * 
 * ### Shard Modal
 * Display shard details
 * ```typescript
 * const url = buildShardModalUrl('my-cluster', 'my-index[0]');
 * // Result: /cluster/my-cluster/shards/my-index%5B0%5D
 * ```
 * 
 * ## Parameter Extraction
 * 
 * Use extraction functions to parse URL parameters:
 * ```typescript
 * const clusterId = extractClusterIdFromPath('/cluster/my-cluster/overview');
 * // Result: 'my-cluster'
 * 
 * const section = extractSectionFromPath('/cluster/my-cluster/statistics');
 * // Result: 'statistics'
 * 
 * const nodeId = extractNodeIdFromPath('/cluster/my-cluster/nodes/node-1');
 * // Result: 'node-1'
 * ```
 * 
 * ## Integration with React Router
 * 
 * Use with useNavigate hook:
 * ```typescript
 * const navigate = useNavigate();
 * 
 * function navigateToStats() {
 *   const url = buildClusterSectionUrl(clusterId, 'statistics');
 *   navigate(url);
 * }
 * ```
 * 
 * Use with useLocation hook:
 * ```typescript
 * const location = useLocation();
 * const params = parseClusterPath(location.pathname);
 * ```
 */
