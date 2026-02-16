/**
 * Node sorting utilities
 * 
 * Provides sorting functions for node lists with master-first ordering.
 * 
 * Requirements: 5.1, 5.2, 5.3
 */

import { NodeInfo } from '../types/api';

/**
 * Sort nodes with master nodes first, then alphabetically by name
 * 
 * Sorting rules:
 * 1. Master nodes appear before non-master nodes
 * 2. Within master nodes, sort alphabetically by name
 * 3. Within non-master nodes, sort alphabetically by name
 * 
 * @param nodes - Array of nodes to sort
 * @returns Sorted array of nodes (does not mutate original array)
 * 
 * Requirements: 5.1, 5.2, 5.3
 */
export function sortNodesMasterFirst(nodes: NodeInfo[]): NodeInfo[] {
  return [...nodes].sort((a, b) => {
    // Check if nodes are masters
    const aIsMaster = a.isMaster || a.roles.includes('master');
    const bIsMaster = b.isMaster || b.roles.includes('master');

    // Master nodes come first
    if (aIsMaster && !bIsMaster) {
      return -1;
    }
    if (!aIsMaster && bIsMaster) {
      return 1;
    }

    // Within same category (both master or both non-master), sort alphabetically by name
    return a.name.localeCompare(b.name);
  });
}

/**
 * Sort nodes alphabetically by name
 * 
 * @param nodes - Array of nodes to sort
 * @returns Sorted array of nodes (does not mutate original array)
 */
export function sortNodesByName(nodes: NodeInfo[]): NodeInfo[] {
  return [...nodes].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Sort nodes by a specific field
 * 
 * Generic sorting function that can sort by any numeric or string field.
 * 
 * @param nodes - Array of nodes to sort
 * @param field - Field name to sort by
 * @param direction - Sort direction ('asc' or 'desc')
 * @returns Sorted array of nodes (does not mutate original array)
 */
export function sortNodesBy<K extends keyof NodeInfo>(
  nodes: NodeInfo[],
  field: K,
  direction: 'asc' | 'desc' = 'asc'
): NodeInfo[] {
  return [...nodes].sort((a, b) => {
    const aValue = a[field];
    const bValue = b[field];

    // Handle undefined values
    if (aValue === undefined && bValue === undefined) return 0;
    if (aValue === undefined) return direction === 'asc' ? 1 : -1;
    if (bValue === undefined) return direction === 'asc' ? -1 : 1;

    // Compare values
    let comparison = 0;
    if (typeof aValue === 'string' && typeof bValue === 'string') {
      comparison = aValue.localeCompare(bValue);
    } else if (typeof aValue === 'number' && typeof bValue === 'number') {
      comparison = aValue - bValue;
    } else if (Array.isArray(aValue) && Array.isArray(bValue)) {
      comparison = aValue.length - bValue.length;
    }

    return direction === 'asc' ? comparison : -comparison;
  });
}

/**
 * Filter nodes by role
 * 
 * @param nodes - Array of nodes to filter
 * @param role - Role to filter by (e.g., 'master', 'data', 'ingest')
 * @returns Filtered array of nodes
 */
export function filterNodesByRole(nodes: NodeInfo[], role: string): NodeInfo[] {
  return nodes.filter(node => node.roles.includes(role as never));
}

/**
 * Check if a node has the data role
 * 
 * @param node - Node to check
 * @returns True if node has data role
 * 
 * Requirements: 10.1, 10.2, 10.3
 */
export function hasDataRole(node: NodeInfo): boolean {
  return node.roles.includes('data');
}

/**
 * Filter nodes to only include data nodes
 * 
 * Used for cluster overview table to exclude master-only nodes.
 * 
 * @param nodes - Array of nodes to filter
 * @returns Filtered array containing only data nodes
 * 
 * Requirements: 10.1, 10.2, 10.3
 */
export function filterDataNodes(nodes: NodeInfo[]): NodeInfo[] {
  return nodes.filter(hasDataRole);
}
