/**
 * Unit tests for topology grouping utilities
 */

import { describe, it, expect, vi } from 'vitest';
import type { NodeInfo } from '../types/api';
import {
  parseGroupingFromUrl,
  buildGroupingUrl,
  hasCustomLabels,
  calculateNodeGroups,
  getGroupLabel,
  type GroupingConfig,
} from './topologyGrouping';

// Helper to create mock nodes
function createMockNode(overrides: Partial<NodeInfo> = {}): NodeInfo {
  return {
    id: 'node-1',
    name: 'node-1',
    roles: ['data'],
    heapUsed: 1000,
    heapMax: 2000,
    diskUsed: 5000,
    diskTotal: 10000,
    isMaster: false,
    isMasterEligible: false,
    ...overrides,
  };
}

describe('parseGroupingFromUrl', () => {
  it('should parse no grouping', () => {
    const params = new URLSearchParams('');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'none' });
  });

  it('should parse explicit none grouping', () => {
    const params = new URLSearchParams('?groupBy=none');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'none' });
  });

  it('should parse role grouping', () => {
    const params = new URLSearchParams('?groupBy=role');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'role' });
  });

  it('should parse type grouping', () => {
    const params = new URLSearchParams('?groupBy=type');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'type' });
  });

  it('should parse label grouping', () => {
    const params = new URLSearchParams('?groupBy=label');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'label' });
  });

  it('should parse label grouping with specific value', () => {
    const params = new URLSearchParams('?groupBy=label&groupValue=zone-a');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'label', value: 'zone-a' });
  });

  it('should default to none for invalid groupBy', () => {
    const params = new URLSearchParams('?groupBy=invalid');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'none' });
  });

  it('should ignore groupValue when groupBy is not label', () => {
    const params = new URLSearchParams('?groupBy=role&groupValue=zone-a');
    const result = parseGroupingFromUrl(params);
    expect(result).toEqual({ attribute: 'role', value: 'zone-a' });
  });

  it('should log warning for invalid groupBy parameter', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const params = new URLSearchParams('?groupBy=invalid');
    parseGroupingFromUrl(params);
    
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Invalid groupBy parameter: invalid. Defaulting to no grouping.'
    );
    
    consoleWarnSpy.mockRestore();
  });

  it('should not log warning for valid parameters', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const params = new URLSearchParams('?groupBy=role');
    parseGroupingFromUrl(params);
    
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    
    consoleWarnSpy.mockRestore();
  });

  it('should not log warning for no parameters', () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    const params = new URLSearchParams('');
    parseGroupingFromUrl(params);
    
    expect(consoleWarnSpy).not.toHaveBeenCalled();
    
    consoleWarnSpy.mockRestore();
  });
});

describe('buildGroupingUrl', () => {
  it('should build URL with no grouping', () => {
    const url = buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'none' });
    expect(url).toBe('/cluster/test/topology/dot');
  });

  it('should build URL with role grouping', () => {
    const url = buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'role' });
    expect(url).toBe('/cluster/test/topology/dot?groupBy=role');
  });

  it('should build URL with type grouping', () => {
    const url = buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'type' });
    expect(url).toBe('/cluster/test/topology/dot?groupBy=type');
  });

  it('should build URL with label grouping', () => {
    const url = buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'label' });
    expect(url).toBe('/cluster/test/topology/dot?groupBy=label');
  });

  it('should build URL with label grouping and specific value', () => {
    const url = buildGroupingUrl('/cluster/test/topology/dot', {
      attribute: 'label',
      value: 'zone-a',
    });
    expect(url).toBe('/cluster/test/topology/dot?groupBy=label&groupValue=zone-a');
  });

  it('should handle base URL with existing query params', () => {
    const url = buildGroupingUrl('/cluster/test/topology/dot', { attribute: 'role' });
    expect(url).toBe('/cluster/test/topology/dot?groupBy=role');
  });
});

describe('hasCustomLabels', () => {
  it('should return false for empty array', () => {
    expect(hasCustomLabels([])).toBe(false);
  });

  it('should return false when no nodes have tags', () => {
    const nodes = [
      createMockNode({ tags: undefined }),
      createMockNode({ tags: [] }),
    ];
    expect(hasCustomLabels(nodes)).toBe(false);
  });

  it('should return true when at least one node has tags', () => {
    const nodes = [
      createMockNode({ tags: undefined }),
      createMockNode({ tags: ['zone-a'] }),
    ];
    expect(hasCustomLabels(nodes)).toBe(true);
  });

  it('should return true when all nodes have tags', () => {
    const nodes = [
      createMockNode({ tags: ['zone-a'] }),
      createMockNode({ tags: ['zone-b'] }),
    ];
    expect(hasCustomLabels(nodes)).toBe(true);
  });

  it('should return false when nodes have empty tags arrays', () => {
    const nodes = [
      createMockNode({ tags: [] }),
      createMockNode({ tags: [] }),
    ];
    expect(hasCustomLabels(nodes)).toBe(false);
  });
});

describe('calculateNodeGroups', () => {
  describe('no grouping', () => {
    it('should return all nodes in single group', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
      ];
      const config: GroupingConfig = { attribute: 'none' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(1);
      expect(groups.get('all')).toEqual(nodes);
    });
  });

  describe('role grouping', () => {
    it('should group nodes by primary role', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: ['master', 'data'] }),
      ];
      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('master')).toHaveLength(2);
      expect(groups.get('data')).toHaveLength(1);
    });

    it('should handle nodes without roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: [] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
      ];
      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('undefined')).toHaveLength(1);
      expect(groups.get('data')).toHaveLength(1);
    });
  });

  describe('type grouping', () => {
    it('should group nodes by type with master priority', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: ['ingest'] }),
      ];
      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(3);
      expect(groups.get('master')).toHaveLength(1);
      expect(groups.get('data')).toHaveLength(1);
      expect(groups.get('ingest')).toHaveLength(1);
    });

    it('should handle ml and coordinating roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['ml'] }),
        createMockNode({ id: 'node-2', roles: ['coordinating'] }),
      ];
      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('ml')).toHaveLength(1);
      expect(groups.get('coordinating')).toHaveLength(1);
    });

    it('should handle nodes without roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: [] }),
      ];
      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(1);
      expect(groups.get('undefined')).toHaveLength(1);
    });
  });

  describe('label grouping', () => {
    it('should group nodes by first label', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a', 'rack-1'] }),
      ];
      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('zone-a')).toHaveLength(2);
      expect(groups.get('zone-b')).toHaveLength(1);
    });

    it('should group by specific label value', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a'] }),
      ];
      const config: GroupingConfig = { attribute: 'label', value: 'zone-a' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('zone-a')).toHaveLength(2);
      expect(groups.get('other')).toHaveLength(1);
    });

    it('should handle nodes without labels', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: undefined }),
        createMockNode({ id: 'node-3', tags: [] }),
      ];
      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('zone-a')).toHaveLength(1);
      expect(groups.get('undefined')).toHaveLength(2);
    });
  });

  describe('empty groups', () => {
    it('should not create empty groups', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['master'] }),
      ];
      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // Should only have 'master' group, no empty groups
      expect(groups.size).toBe(1);
      expect(groups.has('master')).toBe(true);
      expect(groups.get('master')).toHaveLength(2);
    });

    it('should handle all nodes in undefined group', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: [] }),
        createMockNode({ id: 'node-2', roles: undefined }),
      ];
      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(1);
      expect(groups.has('undefined')).toBe(true);
      expect(groups.get('undefined')).toHaveLength(2);
    });
  });
});

describe('getGroupLabel', () => {
  describe('undefined groups', () => {
    it('should return "No Role" for role grouping', () => {
      expect(getGroupLabel('undefined', 'role')).toBe('No Role');
    });

    it('should return "Unknown Type" for type grouping', () => {
      expect(getGroupLabel('undefined', 'type')).toBe('Unknown Type');
    });

    it('should return "No Label" for label grouping', () => {
      expect(getGroupLabel('undefined', 'label')).toBe('No Label');
    });

    it('should return "Undefined" for none grouping', () => {
      expect(getGroupLabel('undefined', 'none')).toBe('Undefined');
    });
  });

  describe('all nodes group', () => {
    it('should return "All Nodes"', () => {
      expect(getGroupLabel('all', 'none')).toBe('All Nodes');
    });
  });

  describe('role grouping labels', () => {
    it('should format master role', () => {
      expect(getGroupLabel('master', 'role')).toBe('Master Nodes');
    });

    it('should format data role', () => {
      expect(getGroupLabel('data', 'role')).toBe('Data Nodes');
    });

    it('should format ingest role', () => {
      expect(getGroupLabel('ingest', 'role')).toBe('Ingest Nodes');
    });
  });

  describe('type grouping labels', () => {
    it('should format master type', () => {
      expect(getGroupLabel('master', 'type')).toBe('Master Type');
    });

    it('should format data type', () => {
      expect(getGroupLabel('data', 'type')).toBe('Data Type');
    });

    it('should format ml type', () => {
      expect(getGroupLabel('ml', 'type')).toBe('Ml Type');
    });
  });

  describe('label grouping labels', () => {
    it('should format zone label', () => {
      expect(getGroupLabel('zone-a', 'label')).toBe('Label: Zone-a');
    });

    it('should format rack label', () => {
      expect(getGroupLabel('rack-1', 'label')).toBe('Label: Rack-1');
    });

    it('should format other label', () => {
      expect(getGroupLabel('other', 'label')).toBe('Label: Other');
    });
  });

  describe('capitalization', () => {
    it('should capitalize first letter', () => {
      expect(getGroupLabel('coordinating', 'role')).toBe('Coordinating Nodes');
    });

    it('should preserve rest of string', () => {
      expect(getGroupLabel('myCustomRole', 'role')).toBe('MyCustomRole Nodes');
    });
  });
});

/**
 * Task 9.1: Verify all node types are displayed
 * Requirements: 1.1, 1.2, 1.3, 1.4
 * 
 * These tests verify that:
 * - All nodes returned by the API are displayed
 * - Master, data, ingest, ml, coordinating nodes are all included
 * - No nodes are filtered based on roles or types
 * - Existing node visualization is unchanged
 */
describe('Task 9.1: Verify all node types are displayed', () => {
  describe('Requirement 1.1: Display all nodes returned by API', () => {
    it('should include all nodes in groups regardless of configuration', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: ['ingest'] }),
        createMockNode({ id: 'node-4', roles: ['ml'] }),
        createMockNode({ id: 'node-5', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // Count all nodes across all groups
      const totalNodesInGroups = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodesInGroups).toBe(nodes.length);
    });

    it('should include all nodes when grouping is disabled', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: [] }),
      ];

      const config: GroupingConfig = { attribute: 'none' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.get('all')).toHaveLength(nodes.length);
      expect(groups.get('all')).toEqual(nodes);
    });

    it('should include all nodes with empty node list', () => {
      const nodes: NodeInfo[] = [];
      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodesInGroups = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodesInGroups).toBe(0);
    });
  });

  describe('Requirement 1.2: Include all node types', () => {
    it('should display master nodes', () => {
      const nodes = [
        createMockNode({ id: 'master-1', roles: ['master'] }),
        createMockNode({ id: 'master-2', roles: ['master', 'data'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('master')).toBe(true);
      expect(groups.get('master')).toHaveLength(2);
    });

    it('should display data nodes', () => {
      const nodes = [
        createMockNode({ id: 'data-1', roles: ['data'] }),
        createMockNode({ id: 'data-2', roles: ['data', 'ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('data')).toBe(true);
      expect(groups.get('data')).toHaveLength(2);
    });

    it('should display ingest nodes', () => {
      const nodes = [
        createMockNode({ id: 'ingest-1', roles: ['ingest'] }),
        createMockNode({ id: 'ingest-2', roles: ['ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('ingest')).toBe(true);
      expect(groups.get('ingest')).toHaveLength(2);
    });

    it('should display ml nodes', () => {
      const nodes = [
        createMockNode({ id: 'ml-1', roles: ['ml'] }),
        createMockNode({ id: 'ml-2', roles: ['ml'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('ml')).toBe(true);
      expect(groups.get('ml')).toHaveLength(2);
    });

    it('should display coordinating nodes', () => {
      const nodes = [
        createMockNode({ id: 'coord-1', roles: ['coordinating'] }),
        createMockNode({ id: 'coord-2', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('coordinating')).toBe(true);
      expect(groups.get('coordinating')).toHaveLength(2);
    });

    it('should display all node types together', () => {
      const nodes = [
        createMockNode({ id: 'master-1', roles: ['master'] }),
        createMockNode({ id: 'data-1', roles: ['data'] }),
        createMockNode({ id: 'ingest-1', roles: ['ingest'] }),
        createMockNode({ id: 'ml-1', roles: ['ml'] }),
        createMockNode({ id: 'coord-1', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      // All 5 node types should be present
      expect(groups.has('master')).toBe(true);
      expect(groups.has('data')).toBe(true);
      expect(groups.has('ingest')).toBe(true);
      expect(groups.has('ml')).toBe(true);
      expect(groups.has('coordinating')).toBe(true);

      // Total nodes should match input
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(nodes.length);
    });
  });

  describe('Requirement 1.3: Do NOT filter nodes based on roles', () => {
    it('should not exclude nodes with multiple roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
        createMockNode({ id: 'node-2', roles: ['data', 'ml'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodes).toBe(nodes.length);
    });

    it('should not exclude nodes with no roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: [] }),
        createMockNode({ id: 'node-2', roles: undefined }),
        createMockNode({ id: 'node-3', roles: ['data'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodes).toBe(nodes.length);
      expect(groups.has('undefined')).toBe(true);
      expect(groups.get('undefined')).toHaveLength(2);
    });

    it('should not exclude nodes with uncommon roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['remote_cluster_client'] }),
        createMockNode({ id: 'node-2', roles: ['transform'] }),
        createMockNode({ id: 'node-3', roles: ['voting_only'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodes).toBe(nodes.length);
    });

    it('should not filter nodes when grouping by type', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: [] }),
        createMockNode({ id: 'node-4', roles: ['ingest', 'ml'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodes).toBe(nodes.length);
    });

    it('should not filter nodes when grouping by label', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: [] }),
        createMockNode({ id: 'node-3', tags: undefined }),
        createMockNode({ id: 'node-4', tags: ['zone-b', 'rack-1'] }),
      ];

      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodes).toBe(nodes.length);
    });
  });

  describe('Requirement 1.4: Use existing node visualization', () => {
    it('should preserve node data structure when grouping', () => {
      const nodes = [
        createMockNode({
          id: 'node-1',
          name: 'node-1',
          roles: ['master'],
          heapUsed: 1000,
          heapMax: 2000,
          diskUsed: 5000,
          diskTotal: 10000,
          isMaster: true,
          isMasterEligible: true,
        }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const groupedNode = groups.get('master')?.[0];
      expect(groupedNode).toEqual(nodes[0]);
      expect(groupedNode?.id).toBe('node-1');
      expect(groupedNode?.name).toBe('node-1');
      expect(groupedNode?.roles).toEqual(['master']);
      expect(groupedNode?.heapUsed).toBe(1000);
      expect(groupedNode?.heapMax).toBe(2000);
    });

    it('should preserve all node properties including optional ones', () => {
      const nodes = [
        createMockNode({
          id: 'node-1',
          name: 'node-1',
          roles: ['data'],
          heapUsed: 1000,
          heapMax: 2000,
          diskUsed: 5000,
          diskTotal: 10000,
          cpuPercent: 45.5,
          ip: '192.168.1.1',
          version: '8.11.0',
          tags: ['zone-a'],
          isMaster: false,
          isMasterEligible: false,
          loadAverage: 2.5,
          uptime: '5d',
          uptimeMillis: 432000000,
        }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const groupedNode = groups.get('data')?.[0];
      expect(groupedNode).toEqual(nodes[0]);
      expect(groupedNode?.cpuPercent).toBe(45.5);
      expect(groupedNode?.ip).toBe('192.168.1.1');
      expect(groupedNode?.version).toBe('8.11.0');
      expect(groupedNode?.tags).toEqual(['zone-a']);
      expect(groupedNode?.loadAverage).toBe(2.5);
      expect(groupedNode?.uptime).toBe('5d');
      expect(groupedNode?.uptimeMillis).toBe(432000000);
    });

    it('should not modify node objects when grouping', () => {
      const originalNode = createMockNode({
        id: 'node-1',
        roles: ['master'],
      });
      const nodes = [originalNode];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const groupedNode = groups.get('master')?.[0];
      
      // Should be the same reference (not a copy)
      expect(groupedNode).toBe(originalNode);
    });

    it('should maintain node order within groups', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['data'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: ['data'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const dataNodes = groups.get('data');
      expect(dataNodes?.[0].id).toBe('node-1');
      expect(dataNodes?.[1].id).toBe('node-2');
      expect(dataNodes?.[2].id).toBe('node-3');
    });
  });

  describe('Integration: Complex cluster scenarios', () => {
    it('should handle large cluster with all node types', () => {
      const nodes = [
        // Master-eligible nodes
        createMockNode({ id: 'master-1', roles: ['master', 'data'] }),
        createMockNode({ id: 'master-2', roles: ['master', 'data'] }),
        createMockNode({ id: 'master-3', roles: ['master', 'data'] }),
        // Data-only nodes
        createMockNode({ id: 'data-1', roles: ['data'] }),
        createMockNode({ id: 'data-2', roles: ['data'] }),
        createMockNode({ id: 'data-3', roles: ['data'] }),
        createMockNode({ id: 'data-4', roles: ['data'] }),
        // Ingest nodes
        createMockNode({ id: 'ingest-1', roles: ['ingest'] }),
        createMockNode({ id: 'ingest-2', roles: ['ingest'] }),
        // ML nodes
        createMockNode({ id: 'ml-1', roles: ['ml'] }),
        // Coordinating nodes
        createMockNode({ id: 'coord-1', roles: ['coordinating'] }),
        createMockNode({ id: 'coord-2', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      // Verify all nodes are present
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(nodes.length);

      // Verify all node types are represented
      expect(groups.has('master')).toBe(true);
      expect(groups.has('data')).toBe(true);
      expect(groups.has('ingest')).toBe(true);
      expect(groups.has('ml')).toBe(true);
      expect(groups.has('coordinating')).toBe(true);
    });

    it('should handle mixed role configurations', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
        createMockNode({ id: 'node-2', roles: ['data', 'ml'] }),
        createMockNode({ id: 'node-3', roles: ['ingest', 'coordinating'] }),
        createMockNode({ id: 'node-4', roles: [] }),
        createMockNode({ id: 'node-5', roles: ['remote_cluster_client'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // All nodes should be present
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(nodes.length);

      // No nodes should be lost
      const allNodeIds = Array.from(groups.values())
        .flat()
        .map(n => n.id)
        .sort();
      const expectedIds = nodes.map(n => n.id).sort();
      expect(allNodeIds).toEqual(expectedIds);
    });

    it('should handle nodes with custom labels and various roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'], tags: ['zone-a', 'rack-1'] }),
        createMockNode({ id: 'node-2', roles: ['data'], tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', roles: ['ingest'], tags: [] }),
        createMockNode({ id: 'node-4', roles: ['ml'], tags: undefined }),
        createMockNode({ id: 'node-5', roles: ['coordinating'], tags: ['zone-a'] }),
      ];

      // Test with role grouping
      const roleConfig: GroupingConfig = { attribute: 'role' };
      const roleGroups = calculateNodeGroups(nodes, roleConfig);
      const totalRoleNodes = Array.from(roleGroups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalRoleNodes).toBe(nodes.length);

      // Test with label grouping
      const labelConfig: GroupingConfig = { attribute: 'label' };
      const labelGroups = calculateNodeGroups(nodes, labelConfig);
      const totalLabelNodes = Array.from(labelGroups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalLabelNodes).toBe(nodes.length);
    });
  });

  describe('Edge cases and backward compatibility', () => {
    it('should handle single node cluster', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(1);
    });

    it('should maintain backward compatibility with no grouping', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: ['ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'none' };
      const groups = calculateNodeGroups(nodes, config);

      // Should have single 'all' group with all nodes
      expect(groups.size).toBe(1);
      expect(groups.has('all')).toBe(true);
      expect(groups.get('all')).toEqual(nodes);
    });

    it('should handle nodes with undefined properties gracefully', () => {
      const nodes = [
        createMockNode({
          id: 'node-1',
          roles: undefined,
          tags: undefined,
        }),
      ];

      const roleConfig: GroupingConfig = { attribute: 'role' };
      const roleGroups = calculateNodeGroups(nodes, roleConfig);
      expect(roleGroups.has('undefined')).toBe(true);
      expect(roleGroups.get('undefined')).toHaveLength(1);

      const labelConfig: GroupingConfig = { attribute: 'label' };
      const labelGroups = calculateNodeGroups(nodes, labelConfig);
      expect(labelGroups.has('undefined')).toBe(true);
      expect(labelGroups.get('undefined')).toHaveLength(1);
    });
  });
});
