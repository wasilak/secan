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
      // Group by role: nodes appear in ALL groups for each role they have (duplication allowed)
      for (const node of nodes) {
        if (!node.roles || node.roles.length === 0) {
          if (!groups.has('undefined')) {
            groups.set('undefined', []);
          }
          groups.get('undefined')!.push(node);
        } else {
          // Add node to EVERY role group it belongs to
          for (const role of node.roles) {
            if (!groups.has(role)) {
              groups.set(role, []);
            }
            groups.get(role)!.push(node);
          }
        }
      }
      break;
      
    case 'type':
      // Group by type: ONLY TWO groups - "master" (nodes with master role) and "other" (all other nodes)
      for (const node of nodes) {
        const isMaster = node.roles && node.roles.includes('master');
        const groupKey = isMaster ? 'master' : 'other';
        
        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(node);
      }
      break;
      
    case 'label':
      // Group by label: config.value is the label NAME (e.g., "zone", "production")
      // Extract all VALUES for that label name and create groups
      if (config.value) {
        const labelName = config.value;
        
        for (const node of nodes) {
          if (!node.tags || node.tags.length === 0) {
            // Node has no tags at all
            if (!groups.has('undefined')) {
              groups.set('undefined', []);
            }
            groups.get('undefined')!.push(node);
          } else {
            // Find tags that match the label name
            // Two patterns:
            // 1. "labelName-value" (e.g., "zone-a" matches label "zone")
            // 2. "labelName" exact match (e.g., "production" matches label "production")
            const matchingTags = node.tags.filter(tag => {
              // Check for exact match first
              if (tag === labelName) {
                return true;
              }
              // Check for prefix match with hyphen
              return tag.startsWith(`${labelName}-`);
            });
            
            if (matchingTags.length === 0) {
              // Node has tags but none match this label
              if (!groups.has('undefined')) {
                groups.set('undefined', []);
              }
              groups.get('undefined')!.push(node);
            } else {
              // Add node to each matching label value group
              for (const tag of matchingTags) {
                if (!groups.has(tag)) {
                  groups.set(tag, []);
                }
                groups.get(tag)!.push(node);
              }
            }
          }
        }
      } else {
        // No specific label selected - shouldn't happen with new UI, but fallback to no grouping
        groups.set('all', nodes);
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
 * // Returns: 'master'
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
  
  switch (attribute) {
    case 'role':
      // Use role as-is (lowercased, with underscores, etc.)
      return groupKey;
    case 'type':
      // Use type as-is
      return groupKey;
    case 'label':
      // For labels, keep the "Label: " prefix for clarity
      return `Label: ${groupKey}`;
    default:
      return groupKey;
  }
}

/**
 * Get primary role for a node
 * 
 * Determines the primary role of a node based on its roles array.
 * Returns the first role if available, otherwise 'undefined'.
 * 
 * @param node - Node to get role from
 * @returns Primary role or 'undefined'
 */
function getNodePrimaryRole(node: NodeInfo): string {
  if (!node.roles || node.roles.length === 0) {
    return 'undefined';
  }
  return node.roles[0];
}

/**
 * Determine node type based on roles
 * 
 * Classifies node into a primary type based on its role configuration.
 * Follows Elasticsearch node type hierarchy.
 * 
 * @param node - Node to classify
 * @returns Node type classification
 */
function determineNodeType(node: NodeInfo): string {
  if (!node.roles || node.roles.length === 0) {
    return 'undefined';
  }
  
  // Priority order for type classification
  if (node.roles.includes('master')) {
    return 'master';
  }
  if (node.roles.includes('data')) {
    return 'data';
  }
  if (node.roles.includes('ingest')) {
    return 'ingest';
  }
  if (node.roles.includes('ml')) {
    return 'ml';
  }
  if (node.roles.includes('coordinating')) {
    return 'coordinating';
  }
  
  return 'undefined';
}

/**
 * Get node label for grouping
 * 
 * Extracts the appropriate label from a node's tags array.
 * If a specific value is provided, returns 'other' for non-matching nodes.
 * 
 * @param node - Node to get label from
 * @param specificValue - Optional specific label value to filter by
 * @returns Label key for grouping
 */
function getNodeLabel(node: NodeInfo, specificValue?: string): string {
  if (!node.tags || node.tags.length === 0) {
    return 'undefined';
  }
  
  if (specificValue) {
    return node.tags.includes(specificValue) ? specificValue : 'other';
  }
  
  return node.tags[0];
}
