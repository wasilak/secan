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


