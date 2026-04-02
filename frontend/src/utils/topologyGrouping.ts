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
 * Extract label name and value from a tag
 * 
 * Supports three tag patterns:
 * - "key:value" (e.g., "shard_indexing_pressure_enabled:true") → returns { name: "shard_indexing_pressure_enabled", value: "true" }
 * - "key-value" (e.g., "zone-a") → returns { name: "zone", value: "a" }
 * - Standalone (e.g., "production") → returns { name: "production", value: "production" }
 * 
 * @param tag - Tag string to parse
 * @returns Object with name and value
 */
export function extractLabelFromTag(tag: string): { name: string; value: string } {
  // Pattern 1: key:value
  if (tag.includes(':')) {
    const [name, ...valueParts] = tag.split(':');
    return { name, value: valueParts.join(':') };
  }
  
  // Pattern 2: key-value (only if there's exactly one dash and both parts exist)
  const dashIndex = tag.indexOf('-');
  if (dashIndex > 0 && dashIndex < tag.length - 1) {
    const name = tag.substring(0, dashIndex);
    const value = tag.substring(dashIndex + 1);
    return { name, value };
  }
  
  // Pattern 3: Standalone tag
  return { name: tag, value: tag };
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
 * 
 * @param nodes - Array of nodes to group
 * @param config - Grouping configuration
 * @returns Map of group key to nodes
 * 
 * @example
 * // By role: nodes grouped by their primary (first) role
 * calculateNodeGroups(nodes, { attribute: 'role' });
 * // Returns: Map { 'master' => [node1, node2], 'data' => [node3], ... }
 * 
 * @example
 * // By type: two groups - master and other
 * calculateNodeGroups(nodes, { attribute: 'type' });
 * // Returns: Map { 'master' => [nodes with master role], 'other' => [all other nodes] }
 * 
 * @example
 * // By label: groups by first label value
 * calculateNodeGroups(nodes, { attribute: 'label' });
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
      // Group by ALL roles (nodes appear in multiple groups - DUPLICATION ALLOWED)
      for (const node of nodes) {
        if (node.roles && node.roles.length > 0) {
          // Add node to ALL role groups it belongs to
          for (const role of node.roles) {
            let group = groups.get(role);
            if (!group) {
              group = [];
              groups.set(role, group);
            }
            group.push(node);
          }
        } else {
          // Node with no roles goes to 'undefined' group
          let group = groups.get('undefined');
          if (!group) {
            group = [];
            groups.set('undefined', group);
          }
          group.push(node);
        }
      }
      break;
      
    case 'type':
      // Group by type: master-eligible vs non-master (with duplication)
      for (const node of nodes) {
        if (node.roles && node.roles.length > 0) {
          // Check if node is master-eligible
          if (node.roles.includes('master')) {
            let masterGroup = groups.get('master');
            if (!masterGroup) {
              masterGroup = [];
              groups.set('master', masterGroup);
            }
            masterGroup.push(node);
          }
          
          // Check if node has any non-master roles
          const hasNonMasterRoles = node.roles.some(role => role !== 'master');
          if (hasNonMasterRoles) {
            let otherGroup = groups.get('other');
            if (!otherGroup) {
              otherGroup = [];
              groups.set('other', otherGroup);
            }
            otherGroup.push(node);
          }
        } else {
          // Node with no roles goes to 'undefined' group
          let group = groups.get('undefined');
          if (!group) {
            group = [];
            groups.set('undefined', group);
          }
          group.push(node);
        }
      }
      break;
      
    case 'label':
      // Group by label value (extracted from tags)
      if (config.value) {
        // Specific label value filtering - config.value is the full tag
        const { value } = extractLabelFromTag(config.value);
        
        for (const node of nodes) {
          let groupKey = 'other';
          
          if (node.tags && node.tags.includes(config.value)) {
            groupKey = value; // Use extracted value as group key
          }
          
          let group = groups.get(groupKey);
          if (!group) {
            group = [];
            groups.set(groupKey, group);
          }
          group.push(node);
        }
      } else {
        // Group by first label value (extracted)
        for (const node of nodes) {
          let groupKey = 'undefined';
          
          if (node.tags && node.tags.length > 0) {
            const { value } = extractLabelFromTag(node.tags[0]);
            groupKey = value;
          }
          
          let group = groups.get(groupKey);
          if (!group) {
            group = [];
            groups.set(groupKey, group);
          }
          group.push(node);
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
 * // Returns: 'master'
 * 
 * @example
 * getGroupLabel('true', 'label');
 * // Returns: 'true'
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
  
  if (groupKey === 'other') {
    return 'other';
  }
  
  // Return group key as-is for all types (no prefixes or suffixes)
  return groupKey;
}
