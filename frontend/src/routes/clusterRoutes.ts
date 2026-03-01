import { RouteObject } from 'react-router-dom';

/**
 * Cluster section types
 * These represent the available sections within a cluster view
 */
export type ClusterSection =
  | 'overview'
  | 'topology'
  | 'statistics'
  | 'nodes'
  | 'indices'
  | 'shards'
  | 'settings'
  | 'console';

/**
 * Modal types that can be displayed as overlays on cluster sections
 */
export type ModalType = 'node' | 'index' | 'shard';

/**
 * Route parameter types for cluster paths
 */
export interface ClusterRouteParams {
  id: string; // Cluster ID
  section?: ClusterSection;
  nodeId?: string;
  indexName?: string;
  shardId?: string;
}

/**
 * Cluster route definitions
 * Centralizes all cluster-related route configurations for React Router v6
 *
 * Routes include:
 * 1. Base cluster view with section
 * 2. Modal routes for nodes, indices, and shards
 * 3. Default cluster view (defaults to overview section)
 */
export const clusterRoutes: RouteObject[] = [
  // Default cluster route - redirects to overview section
  {
    path: 'cluster/:id',
    // Note: This route is handled by ClusterView component which defaults to overview
  },
  // Section routes - 8 sections
  {
    path: 'cluster/:id/overview',
  },
  {
    path: 'cluster/:id/topology',
  },
  {
    path: 'cluster/:id/statistics',
  },
  {
    path: 'cluster/:id/nodes',
  },
  {
    path: 'cluster/:id/indices',
  },
  {
    path: 'cluster/:id/shards',
  },
  {
    path: 'cluster/:id/settings',
  },
  {
    path: 'cluster/:id/console',
  },
  // Modal routes - 3 modal types
  {
    path: 'cluster/:id/nodes/:nodeId',
  },
  {
    path: 'cluster/:id/indices/:indexName',
  },
  {
    path: 'cluster/:id/shards/:shardId',
  },
];

/**
 * Map of cluster sections to human-readable labels
 */
export const sectionLabels: Record<ClusterSection, string> = {
  overview: 'Overview',
  topology: 'Topology',
  statistics: 'Statistics',
  nodes: 'Nodes',
  indices: 'Indices',
  shards: 'Shards',
  settings: 'Settings',
  console: 'Console',
};

/**
 * Array of all available cluster sections in order
 */
export const availableSections: ClusterSection[] = [
  'overview',
  'topology',
  'statistics',
  'nodes',
  'indices',
  'shards',
  'settings',
  'console',
];

/**
 * Check if a given string is a valid cluster section
 *
 * This is a type guard function that validates whether a given value is one of the
 * available cluster sections. Useful for runtime validation of route parameters.
 *
 * @param value - The string to validate
 * @returns true if value is a valid ClusterSection, false otherwise
 *
 * @example
 * if (isValidClusterSection(section)) {
 *   // section is now typed as ClusterSection
 *   navigate(`/cluster/${id}/${section}`);
 * }
 */
export function isValidClusterSection(value: string): value is ClusterSection {
  return availableSections.includes(value as ClusterSection);
}

/**
 * Default section for cluster navigation
 *
 * When a user navigates to /cluster/:id without specifying a section,
 * the ClusterView component defaults to this section.
 *
 * @constant
 * @type {ClusterSection}
 */
export const defaultSection: ClusterSection = 'overview';
