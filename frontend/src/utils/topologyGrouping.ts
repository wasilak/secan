import type { NodeInfo } from '../types/api';

/**
 * Topology Grouping Utilities
 * 
 * Provides utilities for grouping nodes in the cluster topology view by various attributes.
 * Supports grouping by role, type, or custom labels with URL-based state management.
 * 
 * @module topologyGrouping
 */

/**
 * Grouping attribute types
 */
export type GroupingAttribute = 'none' | 'role' | 'type' | 'label';

/**
 * Grouping configuration
 */
export interface GroupingConfig {
  attribute: GroupingAttribute;
  value?: string; // Optional specific value to filter by
}

/**
 * Node group with metadata
 */
export interface NodeGroup {
  key: string;           // Unique group identifier
  label: string;         // Display label
  nodes: NodeInfo[];     // Nodes in this group
  attribute: GroupingAttribute;
}

/**
 * Parse grouping configuration from URL parameters
 * 
 * Extracts grouping parameters from URL query string and validates them.
 * Invalid parameters default to 'none' grouping with a console warning.
 * 
 * @param searchParams - URL search parameters
 * @returns Parsed grouping configuration
 * 
 * @example
 * const params = new URLSearchParams('?groupBy=role');
 * const config = parseGroupingFromUrl(params);
 * // Returns: { attribute: 'role' }
 * 
 * @example
 * const params = new URLSearchParams('?groupBy=label&groupValue=zone-a');
 * const config = parseGroupingFromUrl(params);
 * // Returns: { attribute: 'label', value: 'zone-a' }
 */
export function parseGroupingFromUrl(searchParams: URLSearchParams): GroupingConfig {
  const groupBy = searchParams.get('groupBy');
  
  if (!groupBy || groupBy === 'none') {
    return { attribute: 'none' };
  }
  
  const validAttributes: GroupingAttribute[] = ['role', 'type', 'label'];
  if (!validAttributes.includes(groupBy as GroupingAttribute)) {
    console.warn(`Invalid groupBy parameter: ${groupBy}. Defaulting to no grouping.`);
    return { attribute: 'none' };
  }
  
  return {
    attribute: groupBy as GroupingAttribute,
    value: searchParams.get('groupValue') || undefined,
  };
}

/**
 * Build URL with grouping parameters
 * 
 * Constructs a URL with appropriate grouping query parameters.
 * Removes grouping parameters when attribute is 'none'.
 * 
 * @param baseUrl - Base URL path
 * @param config - Grouping configuration
 * @returns URL with grouping parameters
 * 
 * @example
 * buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'role' });
 * // Returns: '/cluster/test/topology/dot?groupBy=role'
 * 
 * @example
 * buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'label', value: 'zone-a' });
 * // Returns: '/cluster/test/topology/dot?groupBy=label&groupValue=zone-a'
 */
export function buildGroupingUrl(baseUrl: string, config: GroupingConfig): string {
  if (config.attribute === 'none') {
    return baseUrl;
  }
  
  const params = new URLSearchParams();
  params.set('groupBy', config.attribute);
  
  if (config.value) {
    params.set('groupValue', config.value);
  }
  
  return `${baseUrl}?${params.toString()}`;
}

/**
 * Check if nodes have custom labels
 * 
 * Determines if any node in the array has custom labels (tags).
 * Used to conditionally enable/disable the "By Label" grouping option.
 * 
 * @param nodes - Array of nodes to check
 * @returns True if any node has custom labels
 * 
 * @example
 * hasCustomLabels([{ tags: ['zone-a'] }, { tags: [] }]);
 * // Returns: true
 * 
 * @example
 * hasCustomLabels([{ tags: undefined }, { tags: [] }]);
 * // Returns: false
 */
export function hasCustomLabels(nodes: NodeInfo[]): boolean {
  return nodes.some(node => node.tags && node.tags.length > 0);
}

/**
 * Calculate node groups based on grouping configuration
 * 
 * Partitions nodes into groups based on the specified attribute.
 * Nodes can appear in multiple groups if they have multiple values for the attribute.
 * 
 * @param nodes - Array of nodes to group
 * @param config - Grouping configuration
 * @returns Map of group key to nodes
 * 
 * @example
 * // By role: nodes appear in all groups for each role they have
 * calculateNodeGroups(nodes, { attribute: 'role' });
 * // Returns: Map { 'master' => [node1, node2], 'data' => [node1, node3], ... }
 * 
 * @example
 * // By type: two groups - master and other
 * calculateNodeGroups(nodes, { attribute: 'type' });
 * // Returns: Map { 'master' => [nodes with master role], 'other' => [all other nodes] }
 * 
 * @example
 * // By label: groups by all values of the specified label name
 * calculateNodeGroups(nodes, { attribute: 'label', value: 'zone' });
 * // Returns: Map { 'zone-a' => [...], 'zone-b' => [...], 'undefined' => [...] }
 */
export function calculateNodeGroups(
  nodes: NodeInfo[],
  config: GroupingConfig
): Map<string, NodeInfo[]> {
  const groups = new Map<string, NodeInfo[]>();
  
  if (config.attribute === 'none') {
    groups.set('all', nodes);
    return groups;
  }
  
  switch (config.attribute) {
    case 'role':
      // Group by FIRST role only (no duplication)
      for (const node of nodes) {
        let groupKey = 'undefined';
        if (node.roles && node.roles.length > 0) {
          groupKey = node.roles[0];
        }
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(node);
      }
      break;
      
    case 'type':
      // Group by type with priority: master > data > ingest > ml > coordinating
      for (const node of nodes) {
        let groupKey = 'undefined';
        
        if (node.roles && node.roles.length > 0) {
          // Priority order for type classification
          if (node.roles.includes('master')) {
            groupKey = 'master';
          } else if (node.roles.includes('data')) {
            groupKey = 'data';
          } else if (node.roles.includes('ingest')) {
            groupKey = 'ingest';
          } else if (node.roles.includes('ml')) {
            groupKey = 'ml';
          } else if (node.roles.includes('coordinating')) {
            groupKey = 'coordinating';
          } else {
            groupKey = node.roles[0]; // Use first role if none of the above
          }
        }
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(node);
      }
      break;
      
    case 'label':
      // Group by FIRST label (or specific label value if provided)
      if (config.value) {
        // Specific label value filtering
        for (const node of nodes) {
          let groupKey = 'other';
          
          if (node.tags && node.tags.includes(config.value)) {
            groupKey = config.value;
          }
          
          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey)!.push(node);
        }
      } else {
        // Group by first label
        for (const node of nodes) {
          let groupKey = 'undefined';
          
          if (node.tags && node.tags.length > 0) {
            groupKey = node.tags[0];
          }
          
          if (!groups.has(groupKey)) {
            groups.set(groupKey, []);
          }
          groups.get(groupKey)!.push(node);
        }
      }
      break;
      
    default:
      groups.set('all', nodes);
  }
  
  return groups;
}

/**
 * Get display label for a group
 * 
 * Generates human-readable labels for groups based on the grouping attribute.
 * Handles special cases like "undefined" groups and formats labels appropriately.
 * 
 * @param groupKey - Group key identifier
 * @param attribute - Grouping attribute type
 * @returns Display label for the group
 * 
 * @example
 * getGroupLabel('master', 'role');
 * // Returns: 'Master Nodes'
 * 
 * @example
 * getGroupLabel('undefined', 'label');
 * // Returns: 'No Label'
 */
export function getGroupLabel(groupKey: string, attribute: GroupingAttribute): string {
  if (groupKey === 'undefined') {
    switch (attribute) {
      case 'role':
        return 'No Role';
      case 'type':
        return 'Unknown Type';
      case 'label':
        return 'No Label';
      default:
        return 'Undefined';
    }
  }
  
  if (groupKey === 'all') {
    return 'All Nodes';
  }
  
  // Format labels based on attribute type
  if (attribute === 'role') {
    // Capitalize first letter and add "Nodes" suffix
    return groupKey.charAt(0).toUpperCase() + groupKey.slice(1) + ' Nodes';
  }
  
  if (attribute === 'type') {
    // Capitalize first letter and add "Type" suffix
    return groupKey.charAt(0).toUpperCase() + groupKey.slice(1) + ' Type';
  }
  
  if (attribute === 'label') {
    // Capitalize first letter and add "Label:" prefix
    return 'Label: ' + groupKey.charAt(0).toUpperCase() + groupKey.slice(1);
  }
  
  // Default: return as-is
  return groupKey;
}
