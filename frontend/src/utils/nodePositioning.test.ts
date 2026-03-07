import { describe, it, expect } from 'vitest';
import {
  groupShardsByNode,
  calculateVerticalPositions,
  calculatePrimaryNodePositions,
  calculateReplicaNodePositions,
  calculateNodePositions,
  DEFAULT_POSITIONING_CONFIG,
  type NodeWithShards,
  type PositioningConfig,
} from './nodePositioning';
import type { ShardInfo } from '../types/api';

describe('nodePositioning', () => {
  describe('groupShardsByNode', () => {
    it('should group primary shards by node', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 2000,
          store: 10000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);

      expect(primaryNodes).toHaveLength(1);
      expect(primaryNodes[0].nodeId).toBe('node-1');
      expect(primaryNodes[0].shardCount).toBe(2);
      expect(replicaNodes).toHaveLength(0);
      expect(unassignedShards).toHaveLength(0);
    });

    it('should group replica shards by node', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-2',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: false,
          state: 'STARTED',
          node: 'node-2',
          docs: 2000,
          store: 10000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);

      expect(primaryNodes).toHaveLength(0);
      expect(replicaNodes).toHaveLength(1);
      expect(replicaNodes[0].nodeId).toBe('node-2');
      expect(replicaNodes[0].shardCount).toBe(2);
      expect(unassignedShards).toHaveLength(0);
    });

    it('should separate primary and replica shards on different nodes', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-2',
          docs: 1000,
          store: 5000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);

      expect(primaryNodes).toHaveLength(1);
      expect(primaryNodes[0].nodeId).toBe('node-1');
      expect(replicaNodes).toHaveLength(1);
      expect(replicaNodes[0].nodeId).toBe('node-2');
      expect(unassignedShards).toHaveLength(0);
    });

    it('should handle node with both primary and replica shards (appears on both sides)', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: false,
          state: 'STARTED',
          node: 'node-1',
          docs: 2000,
          store: 10000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);

      // Node should appear in both groups
      expect(primaryNodes).toHaveLength(1);
      expect(primaryNodes[0].nodeId).toBe('node-1');
      expect(primaryNodes[0].shardCount).toBe(1);
      
      expect(replicaNodes).toHaveLength(1);
      expect(replicaNodes[0].nodeId).toBe('node-1');
      expect(replicaNodes[0].shardCount).toBe(1);
      
      expect(unassignedShards).toHaveLength(0);
    });

    it('should separate unassigned shards', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: true,
          state: 'UNASSIGNED',
          docs: 0,
          store: 0,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);

      expect(primaryNodes).toHaveLength(1);
      expect(replicaNodes).toHaveLength(0);
      expect(unassignedShards).toHaveLength(1);
      expect(unassignedShards[0].shard).toBe(1);
    });

    it('should handle empty shard array', () => {
      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode([]);

      expect(primaryNodes).toHaveLength(0);
      expect(replicaNodes).toHaveLength(0);
      expect(unassignedShards).toHaveLength(0);
    });

    it('should handle multiple nodes with multiple shards', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: true,
          state: 'STARTED',
          node: 'node-2',
          docs: 2000,
          store: 10000000,
        },
        {
          index: 'test-index',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-3',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: false,
          state: 'STARTED',
          node: 'node-4',
          docs: 2000,
          store: 10000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = groupShardsByNode(shards);

      expect(primaryNodes).toHaveLength(2);
      expect(replicaNodes).toHaveLength(2);
      expect(unassignedShards).toHaveLength(0);
    });
  });

  describe('calculateVerticalPositions', () => {
    const config: PositioningConfig = {
      ...DEFAULT_POSITIONING_CONFIG,
      containerHeight: 600,
      nodeHeight: 80,
      nodeSpacing: 20,
    };

    it('should calculate centered positions for single node', () => {
      const positions = calculateVerticalPositions(1, config);

      expect(positions).toHaveLength(1);
      // Single node should be centered: (600 - 80) / 2 = 260
      expect(positions[0]).toBe(260);
    });

    it('should calculate evenly spaced positions for multiple nodes', () => {
      const positions = calculateVerticalPositions(3, config);

      expect(positions).toHaveLength(3);
      // Total height: 3 * 80 + 2 * 20 = 280
      // Start Y: (600 - 280) / 2 = 160
      expect(positions[0]).toBe(160);
      expect(positions[1]).toBe(260); // 160 + 80 + 20
      expect(positions[2]).toBe(360); // 260 + 80 + 20
    });

    it('should handle zero nodes', () => {
      const positions = calculateVerticalPositions(0, config);

      expect(positions).toHaveLength(0);
    });

    it('should calculate positions for many nodes', () => {
      const positions = calculateVerticalPositions(5, config);

      expect(positions).toHaveLength(5);
      // Verify spacing between consecutive nodes
      for (let i = 1; i < positions.length; i++) {
        const spacing = positions[i] - positions[i - 1];
        expect(spacing).toBe(config.nodeHeight + config.nodeSpacing);
      }
    });
  });

  describe('calculatePrimaryNodePositions', () => {
    const config: PositioningConfig = {
      ...DEFAULT_POSITIONING_CONFIG,
      containerWidth: 1000,
      containerHeight: 600,
      centerWidth: 250,
      horizontalOffset: 300,
    };

    it('should position primary nodes on the left side', () => {
      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-1',
          nodeName: 'node-1',
          shards: [],
          shardCount: 2,
        },
      ];

      const positions = calculatePrimaryNodePositions(nodes, config);

      expect(positions).toHaveLength(1);
      // X position: 500 - 125 - 300 = 75
      expect(positions[0].x).toBe(75);
      expect(positions[0].nodeId).toBe('node-1');
    });

    it('should position multiple primary nodes vertically', () => {
      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-1',
          nodeName: 'node-1',
          shards: [],
          shardCount: 2,
        },
        {
          nodeId: 'node-2',
          nodeName: 'node-2',
          shards: [],
          shardCount: 1,
        },
      ];

      const positions = calculatePrimaryNodePositions(nodes, config);

      expect(positions).toHaveLength(2);
      // All should have same X (left side)
      expect(positions[0].x).toBe(positions[1].x);
      // Different Y positions
      expect(positions[0].y).not.toBe(positions[1].y);
      expect(positions[1].y).toBeGreaterThan(positions[0].y);
    });

    it('should preserve node metadata', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
      ];

      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-1',
          nodeName: 'node-1',
          shards,
          shardCount: 1,
        },
      ];

      const positions = calculatePrimaryNodePositions(nodes, config);

      expect(positions[0].shards).toEqual(shards);
      expect(positions[0].shardCount).toBe(1);
    });
  });

  describe('calculateReplicaNodePositions', () => {
    const config: PositioningConfig = {
      ...DEFAULT_POSITIONING_CONFIG,
      containerWidth: 1000,
      containerHeight: 600,
      centerWidth: 250,
      horizontalOffset: 300,
    };

    it('should position replica nodes on the right side', () => {
      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-2',
          nodeName: 'node-2',
          shards: [],
          shardCount: 1,
        },
      ];

      const positions = calculateReplicaNodePositions(nodes, config);

      expect(positions).toHaveLength(1);
      // X position: 500 + 125 + 300 = 925
      expect(positions[0].x).toBe(925);
      expect(positions[0].nodeId).toBe('node-2');
    });

    it('should position multiple replica nodes vertically', () => {
      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-2',
          nodeName: 'node-2',
          shards: [],
          shardCount: 1,
        },
        {
          nodeId: 'node-3',
          nodeName: 'node-3',
          shards: [],
          shardCount: 1,
        },
      ];

      const positions = calculateReplicaNodePositions(nodes, config);

      expect(positions).toHaveLength(2);
      // All should have same X (right side)
      expect(positions[0].x).toBe(positions[1].x);
      // Different Y positions
      expect(positions[0].y).not.toBe(positions[1].y);
      expect(positions[1].y).toBeGreaterThan(positions[0].y);
    });
  });

  describe('calculateNodePositions', () => {
    it('should calculate positions for all nodes', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-2',
          docs: 1000,
          store: 5000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = calculateNodePositions(shards);

      expect(primaryNodes).toHaveLength(1);
      expect(replicaNodes).toHaveLength(1);
      expect(unassignedShards).toHaveLength(0);

      // Primary node should be on left
      expect(primaryNodes[0].x).toBeLessThan(DEFAULT_POSITIONING_CONFIG.containerWidth / 2);
      // Replica node should be on right
      expect(replicaNodes[0].x).toBeGreaterThan(DEFAULT_POSITIONING_CONFIG.containerWidth / 2);
    });

    it('should use custom config when provided', () => {
      const customConfig: PositioningConfig = {
        containerWidth: 1200,
        containerHeight: 800,
        centerWidth: 300,
        nodeHeight: 100,
        nodeSpacing: 30,
        horizontalOffset: 350,
      };

      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
      ];

      const { primaryNodes } = calculateNodePositions(shards, customConfig);

      // X position with custom config: 600 - 150 - 350 = 100
      expect(primaryNodes[0].x).toBe(100);
    });

    it('should handle index with no replicas (only left side)', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: true,
          state: 'STARTED',
          node: 'node-2',
          docs: 2000,
          store: 10000000,
        },
      ];

      const { primaryNodes, replicaNodes, unassignedShards } = calculateNodePositions(shards);

      expect(primaryNodes).toHaveLength(2);
      expect(replicaNodes).toHaveLength(0);
      expect(unassignedShards).toHaveLength(0);
    });

    it('should handle empty shard array', () => {
      const { primaryNodes, replicaNodes, unassignedShards } = calculateNodePositions([]);

      expect(primaryNodes).toHaveLength(0);
      expect(replicaNodes).toHaveLength(0);
      expect(unassignedShards).toHaveLength(0);
    });
  });

  describe('Responsive Layout - Mobile Vertical Stacking', () => {
    // Mobile configuration with horizontalOffset = 0 triggers vertical stacking
    // Requirements: 8.1, 8.2, 8.5
    const mobileConfig: PositioningConfig = {
      containerWidth: 350,
      containerHeight: 800,
      centerWidth: 200,
      nodeHeight: 120,
      nodeSpacing: 30,
      horizontalOffset: 0, // This triggers mobile layout
    };

    it('should stack primary nodes vertically and center horizontally on mobile', () => {
      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-1',
          nodeName: 'node-1',
          shards: [],
          shardCount: 2,
        },
        {
          nodeId: 'node-2',
          nodeName: 'node-2',
          shards: [],
          shardCount: 1,
        },
      ];

      const positions = calculatePrimaryNodePositions(nodes, mobileConfig);

      expect(positions).toHaveLength(2);
      
      // All nodes should be centered horizontally
      // X = (350 / 2) - (180 / 2) = 85
      expect(positions[0].x).toBe(85);
      expect(positions[1].x).toBe(85);
      
      // Nodes should be stacked vertically with spacing
      expect(positions[1].y).toBeGreaterThan(positions[0].y);
      const verticalSpacing = positions[1].y - positions[0].y;
      expect(verticalSpacing).toBe(mobileConfig.nodeHeight + mobileConfig.nodeSpacing);
    });

    it('should stack replica nodes vertically below center element on mobile', () => {
      const nodes: NodeWithShards[] = [
        {
          nodeId: 'node-3',
          nodeName: 'node-3',
          shards: [],
          shardCount: 1,
        },
        {
          nodeId: 'node-4',
          nodeName: 'node-4',
          shards: [],
          shardCount: 1,
        },
      ];

      const positions = calculateReplicaNodePositions(nodes, mobileConfig);

      expect(positions).toHaveLength(2);
      
      // All nodes should be centered horizontally
      expect(positions[0].x).toBe(85);
      expect(positions[1].x).toBe(85);
      
      // Nodes should be stacked vertically
      expect(positions[1].y).toBeGreaterThan(positions[0].y);
      
      // Replica nodes should start below center element (Y > 250)
      expect(positions[0].y).toBeGreaterThan(250);
    });

    it('should calculate full mobile layout with primary and replica nodes stacked', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: true,
          state: 'STARTED',
          node: 'node-2',
          docs: 2000,
          store: 10000000,
        },
        {
          index: 'test-index',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-3',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 1,
          primary: false,
          state: 'STARTED',
          node: 'node-4',
          docs: 2000,
          store: 10000000,
        },
      ];

      const { primaryNodes, replicaNodes } = calculateNodePositions(shards, mobileConfig);

      expect(primaryNodes).toHaveLength(2);
      expect(replicaNodes).toHaveLength(2);

      // All nodes should be centered horizontally (same X)
      expect(primaryNodes[0].x).toBe(primaryNodes[1].x);
      expect(replicaNodes[0].x).toBe(replicaNodes[1].x);
      expect(primaryNodes[0].x).toBe(replicaNodes[0].x);

      // Primary nodes should be above replica nodes
      expect(primaryNodes[0].y).toBeLessThan(replicaNodes[0].y);
      expect(primaryNodes[1].y).toBeLessThan(replicaNodes[0].y);
    });

    it('should switch from desktop to mobile layout when horizontalOffset changes', () => {
      const shards: ShardInfo[] = [
        {
          index: 'test-index',
          shard: 0,
          primary: true,
          state: 'STARTED',
          node: 'node-1',
          docs: 1000,
          store: 5000000,
        },
        {
          index: 'test-index',
          shard: 0,
          primary: false,
          state: 'STARTED',
          node: 'node-2',
          docs: 1000,
          store: 5000000,
        },
      ];

      // Desktop layout
      const desktopConfig: PositioningConfig = {
        ...DEFAULT_POSITIONING_CONFIG,
        horizontalOffset: 300,
      };
      const desktopLayout = calculateNodePositions(shards, desktopConfig);

      // Mobile layout
      const mobileLayout = calculateNodePositions(shards, mobileConfig);

      // Desktop: primary on left, replica on right
      expect(desktopLayout.primaryNodes[0].x).toBeLessThan(
        desktopLayout.replicaNodes[0].x
      );

      // Mobile: both centered at same X
      expect(mobileLayout.primaryNodes[0].x).toBe(mobileLayout.replicaNodes[0].x);

      // Mobile: primary above replica
      expect(mobileLayout.primaryNodes[0].y).toBeLessThan(
        mobileLayout.replicaNodes[0].y
      );
    });
  });
});
