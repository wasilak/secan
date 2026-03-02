/**
 * Route Redirect Middleware
 *
 * Handles backward compatibility by detecting old query-parameter URLs and
 * redirecting them to new path-based URL formats.
 *
 * Requirements: 3.0, 3.1
 *
 * Supported redirects:
 * - /cluster/:id?tab=section → /cluster/:id/section
 * - /cluster/:id?tab=section&node=nodeId → /cluster/:id/nodes/nodeId
 * - /cluster/:id?tab=section&index=indexName → /cluster/:id/indices/indexName
 * - /cluster/:id?tab=section&shard=shardId → /cluster/:id/shards/shardId
 * - /cluster/:id?node=nodeId → /cluster/:id/nodes/nodeId
 * - /cluster/:id?index=indexName → /cluster/:id/indices/indexName
 * - /cluster/:id?shard=shardId → /cluster/:id/shards/shardId
 *
 * @module routeRedirects
 */

/**
 * Detects if a URL is using old query-parameter format for cluster routes
 *
 * @param pathname - The URL pathname
 * @param search - The URL search/query string
 * @returns true if URL uses old format
 *
 * @example
 * isOldFormatUrl('/cluster/my-cluster', '?tab=statistics')
 * // Returns: true
 *
 * isOldFormatUrl('/cluster/my-cluster/overview', '')
 * // Returns: false
 */
export function isOldFormatUrl(pathname: string, search: string): boolean {
  // Check if this is a cluster URL
  if (!pathname.match(/^\/cluster\/[^/]+\/?$/)) {
    return false;
  }

  // Check if there are cluster-related query parameters
  const oldParams = ['tab', 'node', 'index', 'shard', 'indexTab', 'shardStates'];
  const params = new URLSearchParams(search);

  return oldParams.some((param) => params.has(param));
}

/**
 * Builds the new URL from old query-parameter format
 *
 * @param pathname - The URL pathname
 * @param search - The URL search/query string
 * @returns The new URL path with query string, or null if cannot convert
 *
 * @example
 * buildNewUrl('/cluster/my-cluster', '?tab=statistics&node=node-1')
 * // Returns: '/cluster/my-cluster/nodes/node-1'
 *
 * buildNewUrl('/cluster/my-cluster', '?tab=indices&index=my-index')
 * // Returns: '/cluster/my-cluster/indices/my-index?section=general'
 *
 * buildNewUrl('/cluster/my-cluster', '?index=my-index&indexTab=mappings')
 * // Returns: '/cluster/my-cluster/indices/my-index?section=mappings'
 */
export function buildNewUrl(pathname: string, search: string): string | null {
  const params = new URLSearchParams(search);
  const pathMatch = pathname.match(/^\/cluster\/([^/]+)\/?$/);

  if (!pathMatch) {
    return null;
  }

  const clusterId = pathMatch[1];

  // Priority order: modal params > tab param
  // Modals take precedence over tab/section

  // Check for node modal
  const nodeId = params.get('node');
  if (nodeId) {
    return `/cluster/${clusterId}/nodes/${encodeURIComponent(nodeId)}`;
  }

  // Check for index modal
  const indexName = params.get('index');
  if (indexName) {
    const indexSection = params.get('indexTab');
    if (indexSection) {
      return `/cluster/${clusterId}/indices/${encodeURIComponent(indexName)}?section=${encodeURIComponent(indexSection)}`;
    }
    return `/cluster/${clusterId}/indices/${encodeURIComponent(indexName)}`;
  }

  // Check for shard modal
  const shardId = params.get('shard');
  if (shardId) {
    return `/cluster/${clusterId}/shards/${encodeURIComponent(shardId)}`;
  }

  // Check for section/tab parameter
  const tab = params.get('tab');
  if (tab) {
    // Check if there are non-modal params to preserve
    const newSearch = buildPreservedSearchParams(params);
    return `/cluster/${clusterId}/${encodeURIComponent(tab)}${newSearch}`;
  }

  // If only non-modal params exist (like shardStates, indicesSearch, etc.), preserve them
  // by building a default section URL with preserved search params
  const defaultSection = 'overview';
  const newSearch = buildPreservedSearchParams(params);

  if (newSearch) {
    return `/cluster/${clusterId}/${defaultSection}${newSearch}`;
  }

  return `/cluster/${clusterId}/${defaultSection}`;
}

/**
 * Builds search query string preserving non-modal parameters
 *
 * Preserves filter, search, and UI state parameters while removing
 * deprecated modal-related parameters.
 *
 * @param params - URLSearchParams from old URL
 * @returns Query string for new URL, or empty string if no params to preserve
 *
 * @example
 * const params = new URLSearchParams('?shardStates=STARTED,UNASSIGNED&indicesSearch=test&health=green');
 * buildPreservedSearchParams(params)
 * // Returns: '?shardStates=STARTED%2CUNASSIGNED&indicesSearch=test&health=green'
 */
function buildPreservedSearchParams(params: URLSearchParams): string {
  // List of parameters to preserve (non-modal related)
  const paramsToPreserve = [
    'indicesSearch',
    'health',
    'status',
    'indicesSortColumn',
    'indicesSortDir',
    'overviewSearch',
    'overviewExpanded',
    'overviewAffected',
    'overviewPage',
    'overviewPageSize',
    'shardStates',
    'indicesPage',
    'shardsPage',
    'nodesPage',
  ];

  const preservedParams = new URLSearchParams();

  paramsToPreserve.forEach((key) => {
    const value = params.get(key);
    if (value) {
      preservedParams.set(key, value);
    }
  });

  if (preservedParams.toString().length === 0) {
    return '';
  }

  return `?${preservedParams.toString()}`;
}

/**
 * React Router redirect effect hook integration
 *
 * This is meant to be called in a useEffect in components that render
 * cluster routes to handle redirects transparently.
 *
 * @param pathname - current pathname from location
 * @param search - current search from location
 * @param navigate - React Router navigate function
 * @returns undefined - performs redirect via navigate if needed
 *
 * @example
 * useEffect(() => {
 *   handleRouteRedirect(location.pathname, location.search, navigate);
 * }, [location.pathname, location.search, navigate]);
 */
export function handleRouteRedirect(
  pathname: string,
  search: string,
  navigate: (path: string, options?: { replace?: boolean }) => void
): void {
  if (isOldFormatUrl(pathname, search)) {
    const newUrl = buildNewUrl(pathname, search);
    if (newUrl) {
      // Replace history entry so back button works correctly
      navigate(newUrl, { replace: true });
    }
  }
}
