import { ClusterSection, defaultSection, isValidClusterSection } from '../routes/clusterRoutes';

/**
 * URL Builder Utilities
 *
 * Provides consistent, type-safe URL generation for cluster section navigation.
 * Modals (node, index, shard) are opened via search params, not path changes — see
 * useClusterNavigation for the modal helpers.
 *
 * @module urlBuilders
 */

/**
 * Build a cluster section URL
 */
export function buildClusterSectionUrl(clusterId: string, section?: ClusterSection): string {
  const validSection = section && isValidClusterSection(section) ? section : defaultSection;
  return `/cluster/${clusterId}/${validSection}`;
}

/**
 * Extract the cluster section from a path.
 *
 * For topology sub-paths (/topology/dot, /topology/index, /topology/canvas)
 * this returns 'topology'.
 */
export function extractSectionFromPath(pathname: string, search?: string): ClusterSection | undefined {
  // Check for background section in query params first (legacy support)
  if (search) {
    const params = new URLSearchParams(search);
    const bgSection = params.get('bg') as ClusterSection | null;
    if (bgSection && isValidClusterSection(bgSection)) {
      return bgSection;
    }
  }

  const match = pathname.match(/^\/cluster\/[^/]+\/([^/?]+)/);
  if (!match) return undefined;

  const firstPart = match[1];
  if (isValidClusterSection(firstPart)) return firstPart;

  return undefined;
}

/**
 * Extract cluster ID from a path
 */
export function extractClusterIdFromPath(pathname: string): string | undefined {
  const clusterMatch = pathname.match(/^\/cluster\/([^/]+)/);
  return clusterMatch ? clusterMatch[1] : undefined;
}

/**
 * Parse cluster route parameters from a pathname (section only, no modals).
 */
export function parseClusterPath(pathname: string): {
  clusterId?: string;
  section?: ClusterSection;
} {
  const clusterId = extractClusterIdFromPath(pathname);
  if (!clusterId) return {};
  const section = extractSectionFromPath(pathname);
  return section ? { clusterId, section } : { clusterId };
}

