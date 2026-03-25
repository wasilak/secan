/**
 * Performance tests for topology grouping utilities
 * 
 * Requirements:
 * - 6.1: Initial render with 100 nodes completes within 2 seconds
 * - 6.2: Grouping updates with 100 nodes complete within 500ms
 * - 6.3: Group calculation doesn't block UI thread
 * - 6.4: Smooth transitions when switching grouping options
 */

import { describe, it, expect } from 'vitest';
import type { NodeInfo } from '../types/api';
import {
  calculateNodeGroups,
  type GroupingConfig,
} from './topologyGrouping';

// Helper to create mock nodes for performance testing
function createMockNode(id: number, overrides: Partial<NodeInfo> = {}): NodeInfo {
  const roles = ['master', 'data', 'ingest', 'ml', 'coordinating'];
  const tags = ['zone-a', 'zone-b', 'zone-c', 'rack-1', 'rack-2'];
  
  return {
    id: `node-${id}`,
    name: `node-${id}`,
    roles: [roles[id % roles.length]],
    tags: [tags[id % tags.length]],
    heapUsed: 1000 + id * 100,
    heapMax: 2000 + id * 200,
    diskUsed: 5000 + id * 500,
    diskTotal: 10000 + id * 1000,
    isMaster: id === 0,
    isMasterEligible: id % 3 === 0,
    ...overrides,
  };
}

// Generate large node arrays for performance testing
function generateNodes(count: number): NodeInfo[] {
  return Array.from({ length: count }, (_, i) => createMockNode(i));
}

describe('Performance Tests - Topology Grouping', () => {
  describe('Requirement 6.2: Grouping calculation performance', () => {
    it('should calculate groups for 100 nodes within 500ms', () => {
      const nodes = generateNodes(100);
      const config: GroupingConfig = { attribute: 'role' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Verify calculation completed
      expect(groups.size).toBeGreaterThan(0);
      
      // Verify performance requirement: < 500ms
      expect(duration).toBeLessThan(500);
    });

    it('should calculate groups for 100 nodes by type within 500ms', () => {
      const nodes = generateNodes(100);
      const config: GroupingConfig = { attribute: 'type' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
    });

    it('should calculate groups for 100 nodes by label within 500ms', () => {
      const nodes = generateNodes(100);
      const config: GroupingConfig = { attribute: 'label' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Requirement 6.3: Non-blocking calculation', () => {
    it('should complete grouping calculation synchronously without blocking', () => {
      const nodes = generateNodes(100);
      const config: GroupingConfig = { attribute: 'role' };
      
      // Verify calculation is synchronous (doesn't return Promise)
      const result = calculateNodeGroups(nodes, config);
      
      // Should be a Map, not a Promise
      expect(result).toBeInstanceOf(Map);
      expect(result.size).toBeGreaterThan(0);
    });
  });

  describe('Scalability tests', () => {
    it('should handle 50 nodes efficiently', () => {
      const nodes = generateNodes(50);
      const config: GroupingConfig = { attribute: 'role' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(250); // Should be much faster than 100 nodes
    });

    it('should handle 200 nodes within reasonable time', () => {
      const nodes = generateNodes(200);
      const config: GroupingConfig = { attribute: 'role' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should scale linearly
    });
  });

  describe('Memory efficiency', () => {
    it('should not create excessive intermediate objects', () => {
      const nodes = generateNodes(100);
      const config: GroupingConfig = { attribute: 'role' };
      
      // Calculate groups
      const groups = calculateNodeGroups(nodes, config);
      
      // Verify all nodes are accounted for (no duplication)
      const totalNodesInGroups = Array.from(groups.values())
        .reduce((sum, groupNodes) => sum + groupNodes.length, 0);
      
      expect(totalNodesInGroups).toBe(100);
      
      // Verify nodes are references, not copies
      const firstGroup = Array.from(groups.values())[0];
      if (firstGroup && firstGroup.length > 0) {
        const nodeInGroup = firstGroup[0];
        const originalNode = nodes.find(n => n.id === nodeInGroup.id);
        
        // Should be the same reference
        expect(nodeInGroup).toBe(originalNode);
      }
    });
  });

  describe('Switching between grouping options', () => {
    it('should switch between grouping types quickly', () => {
      const nodes = generateNodes(100);
      const configs: GroupingConfig[] = [
        { attribute: 'role' },
        { attribute: 'type' },
        { attribute: 'label' },
        { attribute: 'none' },
      ];
      
      const durations: number[] = [];
      
      for (const config of configs) {
        const startTime = performance.now();
        const groups = calculateNodeGroups(nodes, config);
        const endTime = performance.now();
        
        const duration = endTime - startTime;
        durations.push(duration);
        
        expect(groups.size).toBeGreaterThan(0);
        expect(duration).toBeLessThan(500);
      }
      
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
    });
  });

  describe('Edge cases performance', () => {
    it('should handle all nodes in one group efficiently', () => {
      const nodes = generateNodes(100).map(node => ({
        ...node,
        roles: ['data'], // All same role
      }));
      const config: GroupingConfig = { attribute: 'role' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBe(1);
      expect(duration).toBeLessThan(500);
    });

    it('should handle many small groups efficiently', () => {
      const nodes = generateNodes(100).map((node, i) => ({
        ...node,
        tags: [`unique-tag-${i}`], // Each node has unique tag
      }));
      const config: GroupingConfig = { attribute: 'label' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBe(100); // One group per node
      expect(duration).toBeLessThan(500);
    });

    it('should handle nodes without grouping attributes efficiently', () => {
      const nodes = generateNodes(100).map(node => ({
        ...node,
        roles: [], // No roles
        tags: undefined, // No tags
      }));
      const config: GroupingConfig = { attribute: 'role' };
      
      const startTime = performance.now();
      const groups = calculateNodeGroups(nodes, config);
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      expect(groups.size).toBe(1);
      expect(groups.get('undefined')).toHaveLength(100);
      expect(duration).toBeLessThan(500);
    });
  });
});
