import { describe, it, expect } from 'vitest';
import { groupShardsByNode } from './shardGrouping';
import { ShardInfo } from '../types/api';

describe('groupShardsByNode', () => {
  it('should separate primary and replica shards', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 100,
        store: 1024,
      },
      {
        index: 'test-index',
        shard: 0,
        primary: false,
        state: 'STARTED',
        node: 'node-2',
        docs: 100,
        store: 1024,
      },
    ];

    const result = groupShardsByNode(shards);

    expect(result.primaryNodes).toHaveLength(1);
    expect(result.replicaNodes).toHaveLength(1);
    expect(result.primaryNodes[0].nodeId).toBe('node-1');
    expect(result.replicaNodes[0].nodeId).toBe('node-2');
  });

  it('should group multiple shards by node', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 100,
        store: 1024,
      },
      {
        index: 'test-index',
        shard: 1,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 200,
        store: 2048,
      },
      {
        index: 'test-index',
        shard: 2,
        primary: true,
        state: 'STARTED',
        node: 'node-2',
        docs: 150,
        store: 1536,
      },
    ];

    const result = groupShardsByNode(shards);

    expect(result.primaryNodes).toHaveLength(2);
    
    const node1Group = result.primaryNodes.find(n => n.nodeId === 'node-1');
    expect(node1Group).toBeDefined();
    expect(node1Group!.shardCount).toBe(2);
    expect(node1Group!.shards).toHaveLength(2);
    
    const node2Group = result.primaryNodes.find(n => n.nodeId === 'node-2');
    expect(node2Group).toBeDefined();
    expect(node2Group!.shardCount).toBe(1);
    expect(node2Group!.shards).toHaveLength(1);
  });

  it('should handle nodes with both primary and replica shards', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 100,
        store: 1024,
      },
      {
        index: 'test-index',
        shard: 1,
        primary: false,
        state: 'STARTED',
        node: 'node-1',
        docs: 200,
        store: 2048,
      },
    ];

    const result = groupShardsByNode(shards);

    // Node-1 should appear on both sides
    expect(result.primaryNodes).toHaveLength(1);
    expect(result.replicaNodes).toHaveLength(1);
    expect(result.primaryNodes[0].nodeId).toBe('node-1');
    expect(result.replicaNodes[0].nodeId).toBe('node-1');
    expect(result.primaryNodes[0].shardCount).toBe(1);
    expect(result.replicaNodes[0].shardCount).toBe(1);
  });

  it('should separate unassigned shards', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 100,
        store: 1024,
      },
      {
        index: 'test-index',
        shard: 1,
        primary: false,
        state: 'UNASSIGNED',
        node: undefined,
        docs: 0,
        store: 0,
      },
      {
        index: 'test-index',
        shard: 2,
        primary: false,
        state: 'UNASSIGNED',
        node: undefined,
        docs: 0,
        store: 0,
      },
    ];

    const result = groupShardsByNode(shards);

    expect(result.unassignedShards).toHaveLength(2);
    expect(result.primaryNodes).toHaveLength(1);
    expect(result.replicaNodes).toHaveLength(0);
  });

  it('should handle empty shard array', () => {
    const result = groupShardsByNode([]);

    expect(result.primaryNodes).toHaveLength(0);
    expect(result.replicaNodes).toHaveLength(0);
    expect(result.unassignedShards).toHaveLength(0);
  });

  it('should calculate correct shard counts per node', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 100,
        store: 1024,
      },
      {
        index: 'test-index',
        shard: 1,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 200,
        store: 2048,
      },
      {
        index: 'test-index',
        shard: 2,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 150,
        store: 1536,
      },
    ];

    const result = groupShardsByNode(shards);

    expect(result.primaryNodes).toHaveLength(1);
    expect(result.primaryNodes[0].shardCount).toBe(3);
    expect(result.primaryNodes[0].shards).toHaveLength(3);
  });

  it('should handle index with no replicas', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 100,
        store: 1024,
      },
      {
        index: 'test-index',
        shard: 1,
        primary: true,
        state: 'STARTED',
        node: 'node-2',
        docs: 200,
        store: 2048,
      },
    ];

    const result = groupShardsByNode(shards);

    expect(result.primaryNodes).toHaveLength(2);
    expect(result.replicaNodes).toHaveLength(0);
    expect(result.unassignedShards).toHaveLength(0);
  });

  it('should handle relocating shards as assigned', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'RELOCATING',
        node: 'node-1',
        relocatingNode: 'node-2',
        docs: 100,
        store: 1024,
      },
    ];

    const result = groupShardsByNode(shards);

    // Relocating shards should be grouped by their current node
    expect(result.primaryNodes).toHaveLength(1);
    expect(result.primaryNodes[0].nodeId).toBe('node-1');
    expect(result.unassignedShards).toHaveLength(0);
  });

  it('should handle initializing shards as assigned', () => {
    const shards: ShardInfo[] = [
      {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'INITIALIZING',
        node: 'node-1',
        docs: 0,
        store: 0,
      },
    ];

    const result = groupShardsByNode(shards);

    // Initializing shards should be grouped by their assigned node
    expect(result.primaryNodes).toHaveLength(1);
    expect(result.primaryNodes[0].nodeId).toBe('node-1');
    expect(result.unassignedShards).toHaveLength(0);
  });
});
