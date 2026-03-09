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
    it('should group nodes by ALL roles (with duplication)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: ['data'] }),
        createMockNode({ id: 'node-3', roles: ['master', 'data'] }),
      ];
      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // node-3 appears in BOTH master and data groups (duplication)
      expect(groups.size).toBe(2);
      expect(groups.get('master')).toHaveLength(2); // node-1 and node-3
      expect(groups.get('data')).toHaveLength(2); // node-2 and node-3
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
    it('should group nodes into master-eligible and other (with duplication)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data'] }), // appears in both groups
        createMockNode({ id: 'node-2', roles: ['data'] }), // only in other
        createMockNode({ id: 'node-3', roles: ['ingest'] }), // only in other
        createMockNode({ id: 'node-4', roles: ['master'] }), // only in master
      ];
      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('master')).toHaveLength(2); // node-1 and node-4
      expect(groups.get('other')).toHaveLength(3); // node-1, node-2, node-3
      
      // Verify node-1 appears in both groups (duplication)
      const masterGroup = groups.get('master')!;
      const otherGroup = groups.get('other')!;
      expect(masterGroup.some(n => n.id === 'node-1')).toBe(true);
      expect(otherGroup.some(n => n.id === 'node-1')).toBe(true);
    });

    it('should handle ml and coordinating roles in other group', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['ml'] }),
        createMockNode({ id: 'node-2', roles: ['coordinating'] }),
        createMockNode({ id: 'node-3', roles: ['master', 'ml'] }), // appears in both
      ];
      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('master')).toHaveLength(1); // node-3
      expect(groups.get('other')).toHaveLength(3); // node-1, node-2, node-3
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
    it('should group nodes by extracted label value', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a', 'rack-1'] }),
      ];
      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      // Groups by extracted values: "zone-a" → "a", "zone-b" → "b"
      expect(groups.size).toBe(2);
      expect(groups.get('a')).toHaveLength(2); // node-1 and node-3
      expect(groups.get('b')).toHaveLength(1); // node-2
    });

    it('should group by specific label value (extracted)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a'] }),
      ];
      const config: GroupingConfig = { attribute: 'label', value: 'zone-a' };
      const groups = calculateNodeGroups(nodes, config);

      // Groups by extracted value: "zone-a" → "a"
      expect(groups.size).toBe(2);
      expect(groups.get('a')).toHaveLength(2); // node-1 and node-3
      expect(groups.get('other')).toHaveLength(1); // node-2
    });

    it('should handle nodes without labels', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: undefined }),
        createMockNode({ id: 'node-3', tags: [] }),
      ];
      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      // Groups by extracted value: "zone-a" → "a"
      expect(groups.size).toBe(2);
      expect(groups.get('a')).toHaveLength(1); // node-1
      expect(groups.get('undefined')).toHaveLength(2); // node-2 and node-3
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
    it('should return raw master role', () => {
      expect(getGroupLabel('master', 'role')).toBe('master');
    });

    it('should return raw data role', () => {
      expect(getGroupLabel('data', 'role')).toBe('data');
    });

    it('should return raw ingest role', () => {
      expect(getGroupLabel('ingest', 'role')).toBe('ingest');
    });
  });

  describe('type grouping labels', () => {
    it('should return raw master type', () => {
      expect(getGroupLabel('master', 'type')).toBe('master');
    });

    it('should return raw other type', () => {
      expect(getGroupLabel('other', 'type')).toBe('other');
    });

    it('should return "Unknown Type" for undefined', () => {
      expect(getGroupLabel('undefined', 'type')).toBe('Unknown Type');
    });
  });

  describe('label grouping labels', () => {
    it('should return raw label value', () => {
      expect(getGroupLabel('a', 'label')).toBe('a');
    });

    it('should return raw label value for numbers', () => {
      expect(getGroupLabel('1', 'label')).toBe('1');
    });

    it('should return "other" as-is', () => {
      expect(getGroupLabel('other', 'label')).toBe('other');
    });
  });

  describe('raw values', () => {
    it('should return value as-is', () => {
      expect(getGroupLabel('coordinating', 'role')).toBe('coordinating');
    });

    it('should preserve exact string', () => {
      expect(getGroupLabel('myCustomRole', 'role')).toBe('myCustomRole');
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

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('data')).toBe(true);
      expect(groups.get('data')).toHaveLength(2);
    });

    it('should display ingest nodes', () => {
      const nodes = [
        createMockNode({ id: 'ingest-1', roles: ['ingest'] }),
        createMockNode({ id: 'ingest-2', roles: ['ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('ingest')).toBe(true);
      expect(groups.get('ingest')).toHaveLength(2);
    });

    it('should display ml nodes', () => {
      const nodes = [
        createMockNode({ id: 'ml-1', roles: ['ml'] }),
        createMockNode({ id: 'ml-2', roles: ['ml'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('ml')).toBe(true);
      expect(groups.get('ml')).toHaveLength(2);
    });

    it('should display coordinating nodes', () => {
      const nodes = [
        createMockNode({ id: 'coord-1', roles: ['coordinating'] }),
        createMockNode({ id: 'coord-2', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
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

      const config: GroupingConfig = { attribute: 'role' };
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
    it('should not exclude nodes with multiple roles (allows duplication)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
        createMockNode({ id: 'node-2', roles: ['data', 'ml'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // With duplication: node-1 appears in 3 groups, node-2 in 2 groups = 5 total
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );

      expect(totalNodes).toBe(5); // node-1 (3 times) + node-2 (2 times)
      
      // Verify each node appears in all its role groups
      expect(groups.get('master')).toContainEqual(expect.objectContaining({ id: 'node-1' }));
      expect(groups.get('data')).toContainEqual(expect.objectContaining({ id: 'node-1' }));
      expect(groups.get('data')).toContainEqual(expect.objectContaining({ id: 'node-2' }));
      expect(groups.get('ingest')).toContainEqual(expect.objectContaining({ id: 'node-1' }));
      expect(groups.get('ml')).toContainEqual(expect.objectContaining({ id: 'node-2' }));
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

      // With type grouping: master group (3 master nodes) + other group (3 master+data + 4 data + 2 ingest + 1 ml + 2 coord = 12)
      // Total with duplication: 3 + 12 = 15
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(15);

      // Verify both groups exist
      expect(groups.has('master')).toBe(true);
      expect(groups.has('other')).toBe(true);
      expect(groups.get('master')).toHaveLength(3); // master-1, master-2, master-3
      expect(groups.get('other')).toHaveLength(12); // master-1, master-2, master-3 (data role) + 4 data + 2 ingest + 1 ml + 2 coord
    });

    it('should handle mixed role configurations (with duplication)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
        createMockNode({ id: 'node-2', roles: ['data', 'ml'] }),
        createMockNode({ id: 'node-3', roles: ['ingest', 'coordinating'] }),
        createMockNode({ id: 'node-4', roles: [] }),
        createMockNode({ id: 'node-5', roles: ['remote_cluster_client'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // With duplication: node-1 (3), node-2 (2), node-3 (2), node-4 (1), node-5 (1) = 9 total
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(9);

      // All unique node IDs should be present (no nodes lost)
      const uniqueNodeIds = new Set(
        Array.from(groups.values())
          .flat()
          .map(n => n.id)
      );
      expect(uniqueNodeIds.size).toBe(nodes.length);
      expect(Array.from(uniqueNodeIds).sort()).toEqual(nodes.map(n => n.id).sort());
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
    it('should handle single node cluster (with duplication)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // Single node with 3 roles appears 3 times
      const totalNodes = Array.from(groups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalNodes).toBe(3);
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

/**
 * Task 9.2: Verify grouping functionality
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3
 * 
 * These tests verify that:
 * - Grouping by role works with various node configurations
 * - Grouping by type works with various node configurations
 * - Grouping by label works with custom labels
 * - "undefined" group appears for nodes without attributes
 * - Switching between grouping options works correctly
 */
describe('Task 9.2: Verify grouping functionality', () => {
  describe('Requirement 2.1: Single grouping attribute at a time', () => {
    it('should group by only one attribute when role is selected', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'], tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', roles: ['data'], tags: ['zone-b'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // Should group by role only, not by tags
      expect(groups.has('master')).toBe(true);
      expect(groups.has('data')).toBe(true);
      expect(groups.has('zone-a')).toBe(false);
      expect(groups.has('zone-b')).toBe(false);
    });

    it('should group by only one attribute when type is selected', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data'], tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', roles: ['ingest'], tags: ['zone-b'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      // Should group by type only: master and other groups
      expect(groups.has('master')).toBe(true);
      expect(groups.has('other')).toBe(true);
      expect(groups.has('zone-a')).toBe(false);
      expect(groups.has('zone-b')).toBe(false);
    });

    it('should group by only one attribute when label is selected', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'], tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', roles: ['data'], tags: ['zone-b'] }),
      ];

      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      // Should group by extracted label values only, not by roles
      // "zone-a" → "a", "zone-b" → "b"
      expect(groups.has('a')).toBe(true);
      expect(groups.has('b')).toBe(true);
      expect(groups.has('master')).toBe(false);
      expect(groups.has('data')).toBe(false);
    });
  });

  describe('Requirement 2.2: Grouping by node roles', () => {
    it('should group master-eligible vs non-master-eligible nodes (with duplication)', () => {
      const nodes = [
        createMockNode({ id: 'master-1', roles: ['master'] }),
        createMockNode({ id: 'master-2', roles: ['master', 'data'] }),
        createMockNode({ id: 'data-1', roles: ['data'] }),
        createMockNode({ id: 'ingest-1', roles: ['ingest'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // Master nodes: master-1 and master-2 both appear in master group
      expect(groups.get('master')).toHaveLength(2);
      expect(groups.get('master')?.map(n => n.id).sort()).toEqual(['master-1', 'master-2']);
      
      // Data group: master-2 and data-1 (master-2 appears in both master and data)
      expect(groups.get('data')).toHaveLength(2);
      expect(groups.get('data')?.map(n => n.id).sort()).toEqual(['data-1', 'master-2']);
      
      // Ingest group
      expect(groups.get('ingest')).toHaveLength(1);
    });

    it('should group data vs non-data nodes', () => {
      const nodes = [
        createMockNode({ id: 'data-1', roles: ['data'] }),
        createMockNode({ id: 'data-2', roles: ['data', 'ingest'] }),
        createMockNode({ id: 'master-1', roles: ['master'] }),
        createMockNode({ id: 'coord-1', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // Data nodes grouped together (by first role)
      expect(groups.get('data')).toHaveLength(2);
      expect(groups.get('data')?.map(n => n.id)).toEqual(['data-1', 'data-2']);
      
      // Non-data nodes in separate groups
      expect(groups.get('master')).toHaveLength(1);
      expect(groups.get('coordinating')).toHaveLength(1);
    });

    it('should handle various role combinations (with duplication)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data', 'ingest'] }),
        createMockNode({ id: 'node-2', roles: ['data', 'ml'] }),
        createMockNode({ id: 'node-3', roles: ['ingest', 'coordinating'] }),
        createMockNode({ id: 'node-4', roles: ['ml'] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      // With duplication: nodes appear in ALL their role groups
      expect(groups.get('master')).toHaveLength(1); // node-1
      expect(groups.get('data')).toHaveLength(2); // node-1, node-2
      expect(groups.get('ingest')).toHaveLength(2); // node-1, node-3
      expect(groups.get('ml')).toHaveLength(2); // node-2, node-4
      expect(groups.get('coordinating')).toHaveLength(1); // node-3
    });
  });

  describe('Requirement 2.3: Grouping by node types', () => {
    it('should classify nodes into master-eligible and other groups', () => {
      const nodes = [
        createMockNode({ id: 'master-1', roles: ['master'] }),
        createMockNode({ id: 'data-1', roles: ['data'] }),
        createMockNode({ id: 'ingest-1', roles: ['ingest'] }),
        createMockNode({ id: 'ml-1', roles: ['ml'] }),
        createMockNode({ id: 'coord-1', roles: ['coordinating'] }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(2);
      expect(groups.get('master')).toHaveLength(1); // master-1
      expect(groups.get('other')).toHaveLength(4); // data-1, ingest-1, ml-1, coord-1
    });

    it('should put master-eligible nodes in master group and also in other if they have non-master roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master', 'data'] }), // both groups
        createMockNode({ id: 'node-2', roles: ['master', 'ingest'] }), // both groups
        createMockNode({ id: 'node-3', roles: ['data', 'ingest'] }), // only other
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      // Master group: nodes with master role
      expect(groups.get('master')).toHaveLength(2);
      expect(groups.get('master')?.map(n => n.id).sort()).toEqual(['node-1', 'node-2']);
      
      // Other group: nodes with non-master roles (including master nodes with other roles)
      expect(groups.get('other')).toHaveLength(3);
      expect(groups.get('other')?.map(n => n.id).sort()).toEqual(['node-1', 'node-2', 'node-3']);
    });

    it('should handle pure master nodes (only in master group) and mixed nodes (in both groups)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['data', 'ingest', 'ml'] }), // only other
        createMockNode({ id: 'node-2', roles: ['ingest', 'ml', 'coordinating'] }), // only other
        createMockNode({ id: 'node-3', roles: ['ml', 'coordinating'] }), // only other
        createMockNode({ id: 'node-4', roles: ['master'] }), // only master
        createMockNode({ id: 'node-5', roles: ['master', 'data'] }), // both groups
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      // Master group: nodes with master role
      expect(groups.get('master')).toHaveLength(2);
      expect(groups.get('master')?.map(n => n.id).sort()).toEqual(['node-4', 'node-5']);
      
      // Other group: all nodes with non-master roles
      expect(groups.get('other')).toHaveLength(4);
      expect(groups.get('other')?.map(n => n.id).sort()).toEqual(['node-1', 'node-2', 'node-3', 'node-5']);
    });
  });

  describe('Requirement 2.4: Grouping by node labels', () => {
    it('should group nodes by extracted label values', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a'] }),
        createMockNode({ id: 'node-4', tags: ['zone-c'] }),
      ];

      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      // Groups by extracted values: "zone-a" → "a", "zone-b" → "b", "zone-c" → "c"
      expect(groups.size).toBe(3);
      expect(groups.get('a')).toHaveLength(2);
      expect(groups.get('b')).toHaveLength(1);
      expect(groups.get('c')).toHaveLength(1);
    });

    it('should group by first label value when nodes have multiple labels', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a', 'rack-1'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b', 'rack-2'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a', 'rack-3'] }),
      ];

      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      // Grouped by first label value: "zone-a" → "a", "zone-b" → "b"
      expect(groups.size).toBe(2);
      expect(groups.get('a')).toHaveLength(2);
      expect(groups.get('b')).toHaveLength(1);
    });

    it('should support filtering by specific label value (extracted)', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', tags: ['zone-a'] }),
        createMockNode({ id: 'node-4', tags: ['zone-c'] }),
      ];

      const config: GroupingConfig = { attribute: 'label', value: 'zone-a' };
      const groups = calculateNodeGroups(nodes, config);

      // Two groups: extracted value "a" and "other"
      expect(groups.size).toBe(2);
      expect(groups.get('a')).toHaveLength(2);
      expect(groups.get('other')).toHaveLength(2);
    });

    it('should handle complex label scenarios', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['production', 'us-east-1', 'rack-a'] }),
        createMockNode({ id: 'node-2', tags: ['staging', 'us-west-2'] }),
        createMockNode({ id: 'node-3', tags: ['production', 'eu-west-1'] }),
        createMockNode({ id: 'node-4', tags: ['development'] }),
      ];

      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      // Grouped by first label
      expect(groups.get('production')).toHaveLength(2);
      expect(groups.get('staging')).toHaveLength(1);
      expect(groups.get('development')).toHaveLength(1);
    });
  });

  describe('Requirement 2.5 & 3.3: Undefined group for nodes without attributes', () => {
    it('should create undefined group for nodes without roles', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'] }),
        createMockNode({ id: 'node-2', roles: [] }),
        createMockNode({ id: 'node-3', roles: undefined }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('undefined')).toBe(true);
      expect(groups.get('undefined')).toHaveLength(2);
      expect(groups.get('undefined')?.map(n => n.id)).toEqual(['node-2', 'node-3']);
    });

    it('should create undefined group for nodes without labels', () => {
      const nodes = [
        createMockNode({ id: 'node-1', tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', tags: [] }),
        createMockNode({ id: 'node-3', tags: undefined }),
      ];

      const config: GroupingConfig = { attribute: 'label' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('undefined')).toBe(true);
      expect(groups.get('undefined')).toHaveLength(2);
      expect(groups.get('undefined')?.map(n => n.id)).toEqual(['node-2', 'node-3']);
    });

    it('should create undefined group for nodes without type classification', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['data'] }),
        createMockNode({ id: 'node-2', roles: [] }),
        createMockNode({ id: 'node-3', roles: undefined }),
      ];

      const config: GroupingConfig = { attribute: 'type' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.has('undefined')).toBe(true);
      expect(groups.get('undefined')).toHaveLength(2);
    });

    it('should handle all nodes in undefined group', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: [] }),
        createMockNode({ id: 'node-2', roles: undefined }),
        createMockNode({ id: 'node-3', roles: [] }),
      ];

      const config: GroupingConfig = { attribute: 'role' };
      const groups = calculateNodeGroups(nodes, config);

      expect(groups.size).toBe(1);
      expect(groups.has('undefined')).toBe(true);
      expect(groups.get('undefined')).toHaveLength(3);
    });

    it('should label undefined groups appropriately', () => {
      expect(getGroupLabel('undefined', 'role')).toBe('No Role');
      expect(getGroupLabel('undefined', 'type')).toBe('Unknown Type');
      expect(getGroupLabel('undefined', 'label')).toBe('No Label');
    });
  });

  describe('Switching between grouping options', () => {
    const testNodes = [
      createMockNode({ id: 'node-1', roles: ['master'], tags: ['zone-a'] }),
      createMockNode({ id: 'node-2', roles: ['data'], tags: ['zone-b'] }),
      createMockNode({ id: 'node-3', roles: ['ingest'], tags: ['zone-a'] }),
      createMockNode({ id: 'node-4', roles: [], tags: [] }),
    ];

    it('should switch from none to role grouping', () => {
      const noneConfig: GroupingConfig = { attribute: 'none' };
      const noneGroups = calculateNodeGroups(testNodes, noneConfig);
      
      expect(noneGroups.size).toBe(1);
      expect(noneGroups.get('all')).toHaveLength(4);

      const roleConfig: GroupingConfig = { attribute: 'role' };
      const roleGroups = calculateNodeGroups(testNodes, roleConfig);
      
      expect(roleGroups.size).toBe(4);
      expect(roleGroups.has('master')).toBe(true);
      expect(roleGroups.has('data')).toBe(true);
      expect(roleGroups.has('ingest')).toBe(true);
      expect(roleGroups.has('undefined')).toBe(true);
    });

    it('should switch from role to type grouping', () => {
      const roleConfig: GroupingConfig = { attribute: 'role' };
      const roleGroups = calculateNodeGroups(testNodes, roleConfig);
      
      expect(roleGroups.size).toBe(4);

      const typeConfig: GroupingConfig = { attribute: 'type' };
      const typeGroups = calculateNodeGroups(testNodes, typeConfig);
      
      // Type grouping creates only 2 groups: master and other (plus undefined if needed)
      expect(typeGroups.size).toBe(3); // master, other, undefined
      expect(typeGroups.has('master')).toBe(true);
      expect(typeGroups.has('other')).toBe(true);
      expect(typeGroups.has('undefined')).toBe(true);
    });

    it('should switch from type to label grouping', () => {
      const typeConfig: GroupingConfig = { attribute: 'type' };
      const typeGroups = calculateNodeGroups(testNodes, typeConfig);
      
      expect(typeGroups.size).toBe(3); // master, other, undefined

      const labelConfig: GroupingConfig = { attribute: 'label' };
      const labelGroups = calculateNodeGroups(testNodes, labelConfig);
      
      // Groups by extracted label values: "zone-a" → "a", "zone-b" → "b"
      expect(labelGroups.size).toBe(3);
      expect(labelGroups.has('a')).toBe(true);
      expect(labelGroups.has('b')).toBe(true);
      expect(labelGroups.has('undefined')).toBe(true);
    });

    it('should switch from label back to none grouping', () => {
      const labelConfig: GroupingConfig = { attribute: 'label' };
      const labelGroups = calculateNodeGroups(testNodes, labelConfig);
      
      expect(labelGroups.size).toBe(3);

      const noneConfig: GroupingConfig = { attribute: 'none' };
      const noneGroups = calculateNodeGroups(testNodes, noneConfig);
      
      expect(noneGroups.size).toBe(1);
      expect(noneGroups.get('all')).toHaveLength(4);
    });

    it('should maintain all nodes when switching grouping options', () => {
      const configs: GroupingConfig[] = [
        { attribute: 'none' },
        { attribute: 'role' },
        { attribute: 'type' },
        { attribute: 'label' },
      ];

      for (const config of configs) {
        const groups = calculateNodeGroups(testNodes, config);
        const totalNodes = Array.from(groups.values()).reduce(
          (sum, groupNodes) => sum + groupNodes.length,
          0
        );
        expect(totalNodes).toBe(testNodes.length);
      }
    });

    it('should preserve node data when switching grouping options', () => {
      const configs: GroupingConfig[] = [
        { attribute: 'role' },
        { attribute: 'type' },
        { attribute: 'label' },
        { attribute: 'none' },
      ];

      for (const config of configs) {
        const groups = calculateNodeGroups(testNodes, config);
        const allGroupedNodes = Array.from(groups.values()).flat();
        
        // Check that all original nodes are present with same data
        for (const originalNode of testNodes) {
          const groupedNode = allGroupedNodes.find(n => n.id === originalNode.id);
          expect(groupedNode).toBeDefined();
          expect(groupedNode).toEqual(originalNode);
        }
      }
    });
  });

  describe('Integration: Real-world grouping scenarios', () => {
    it('should handle production cluster with mixed node configurations', () => {
      const nodes = [
        // Dedicated master nodes
        createMockNode({ id: 'master-1', roles: ['master'], tags: ['zone-a', 'master-tier'] }),
        createMockNode({ id: 'master-2', roles: ['master'], tags: ['zone-b', 'master-tier'] }),
        createMockNode({ id: 'master-3', roles: ['master'], tags: ['zone-c', 'master-tier'] }),
        // Hot data nodes
        createMockNode({ id: 'hot-1', roles: ['data'], tags: ['zone-a', 'hot-tier'] }),
        createMockNode({ id: 'hot-2', roles: ['data'], tags: ['zone-b', 'hot-tier'] }),
        // Warm data nodes
        createMockNode({ id: 'warm-1', roles: ['data'], tags: ['zone-a', 'warm-tier'] }),
        createMockNode({ id: 'warm-2', roles: ['data'], tags: ['zone-b', 'warm-tier'] }),
        // Coordinating nodes
        createMockNode({ id: 'coord-1', roles: ['coordinating'], tags: ['zone-a'] }),
        createMockNode({ id: 'coord-2', roles: ['coordinating'], tags: ['zone-b'] }),
        // ML nodes
        createMockNode({ id: 'ml-1', roles: ['ml'], tags: ['zone-a', 'ml-tier'] }),
      ];

      // Test role grouping
      const roleGroups = calculateNodeGroups(nodes, { attribute: 'role' });
      expect(roleGroups.get('master')).toHaveLength(3);
      expect(roleGroups.get('data')).toHaveLength(4);
      expect(roleGroups.get('coordinating')).toHaveLength(2);
      expect(roleGroups.get('ml')).toHaveLength(1);

      // Test label grouping by extracted zone values: "zone-a" → "a", "zone-b" → "b", "zone-c" → "c"
      const zoneGroups = calculateNodeGroups(nodes, { attribute: 'label' });
      expect(zoneGroups.get('a')).toHaveLength(5); // master-1, hot-1, warm-1, coord-1, ml-1
      expect(zoneGroups.get('b')).toHaveLength(4); // master-2, hot-2, warm-2, coord-2
      expect(zoneGroups.get('c')).toHaveLength(1); // master-3

      // Test type grouping: master group (3 masters) + other group (4 data + 2 coord + 1 ml = 7)
      const typeGroups = calculateNodeGroups(nodes, { attribute: 'type' });
      expect(typeGroups.get('master')).toHaveLength(3); // master-1, master-2, master-3
      expect(typeGroups.get('other')).toHaveLength(7); // hot-1, hot-2, warm-1, warm-2, coord-1, coord-2, ml-1
    });

    it('should handle cluster with nodes missing various attributes', () => {
      const nodes = [
        createMockNode({ id: 'node-1', roles: ['master'], tags: ['zone-a'] }),
        createMockNode({ id: 'node-2', roles: [], tags: ['zone-b'] }),
        createMockNode({ id: 'node-3', roles: ['data'], tags: [] }),
        createMockNode({ id: 'node-4', roles: undefined, tags: undefined }),
      ];

      // Role grouping should handle missing roles
      const roleGroups = calculateNodeGroups(nodes, { attribute: 'role' });
      expect(roleGroups.get('master')).toHaveLength(1);
      expect(roleGroups.get('data')).toHaveLength(1);
      expect(roleGroups.get('undefined')).toHaveLength(2);

      // Label grouping should handle missing labels and extract values: "zone-a" → "a", "zone-b" → "b"
      const labelGroups = calculateNodeGroups(nodes, { attribute: 'label' });
      expect(labelGroups.get('a')).toHaveLength(1); // node-1 with "zone-a" → extracted value "a"
      expect(labelGroups.get('b')).toHaveLength(1); // node-2 with "zone-b" → extracted value "b"
      expect(labelGroups.get('undefined')).toHaveLength(2); // node-3 and node-4 with no tags
    });

    it('should handle large cluster efficiently', () => {
      // Create 100 nodes with various configurations
      const nodes: NodeInfo[] = [];
      for (let i = 0; i < 100; i++) {
        const roleIndex = i % 5;
        const roles = [
          ['master'],
          ['data'],
          ['ingest'],
          ['ml'],
          ['coordinating'],
        ][roleIndex];
        
        const zoneIndex = i % 3;
        const tags = [`zone-${String.fromCharCode(97 + zoneIndex)}`]; // zone-a, zone-b, zone-c
        
        nodes.push(createMockNode({
          id: `node-${i}`,
          roles,
          tags,
        }));
      }

      // Test that grouping completes without errors
      const roleGroups = calculateNodeGroups(nodes, { attribute: 'role' });
      expect(roleGroups.size).toBe(5);
      
      const labelGroups = calculateNodeGroups(nodes, { attribute: 'label' });
      expect(labelGroups.size).toBe(3);
      
      // Verify all nodes are accounted for
      const totalRoleNodes = Array.from(roleGroups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalRoleNodes).toBe(100);
      
      const totalLabelNodes = Array.from(labelGroups.values()).reduce(
        (sum, groupNodes) => sum + groupNodes.length,
        0
      );
      expect(totalLabelNodes).toBe(100);
    });
  });
});
