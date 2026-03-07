/**
 * Unit tests for topology grouping utilities
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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
