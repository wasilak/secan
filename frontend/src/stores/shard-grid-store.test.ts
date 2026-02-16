import { describe, it, expect, beforeEach } from 'vitest';
import { useShardGridStore } from './shard-grid-store';
import type { ShardInfo, NodeWithShards } from '../types/api';

describe('ShardGridStore - Relocation Mode', () => {
  beforeEach(() => {
    // Reset store before each test
    useShardGridStore.getState().reset();
  });

  describe('enterRelocationMode', () => {
    it('should enter relocation mode and set selected shard', () => {
      const store = useShardGridStore.getState();
      
      // Setup test data
      const testShard: ShardInfo = {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      };
      
      const testNodes: NodeWithShards[] = [
        {
          id: 'node-1',
          name: 'node-1',
          ip: '10.0.0.1',
          roles: ['data', 'master'],
          heapUsed: 500000000,
          heapMax: 1000000000,
          diskUsed: 10000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [testShard]]]),
        },
        {
          id: 'node-2',
          name: 'node-2',
          ip: '10.0.0.2',
          roles: ['data'],
          heapUsed: 400000000,
          heapMax: 1000000000,
          diskUsed: 8000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
      ];
      
      store.setNodes(testNodes);
      
      // Enter relocation mode
      store.enterRelocationMode(testShard);
      
      // Verify state
      const state = useShardGridStore.getState();
      expect(state.relocationMode).toBe(true);
      expect(state.selectedShard).toEqual(testShard);
      expect(state.destinationIndicators.size).toBeGreaterThan(0);
    });
  });

  describe('calculateDestinations', () => {
    it('should filter out source node', () => {
      const store = useShardGridStore.getState();
      
      const testShard: ShardInfo = {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      };
      
      const testNodes: NodeWithShards[] = [
        {
          id: 'node-1',
          name: 'node-1',
          ip: '10.0.0.1',
          roles: ['data'],
          heapUsed: 500000000,
          heapMax: 1000000000,
          diskUsed: 10000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [testShard]]]),
        },
        {
          id: 'node-2',
          name: 'node-2',
          ip: '10.0.0.2',
          roles: ['data'],
          heapUsed: 400000000,
          heapMax: 1000000000,
          diskUsed: 8000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
      ];
      
      store.setNodes(testNodes);
      store.enterRelocationMode(testShard);
      
      const state = useShardGridStore.getState();
      
      // Source node should not be in destinations
      expect(state.destinationIndicators.has('node-1')).toBe(false);
      // Other data node should be in destinations
      expect(state.destinationIndicators.has('node-2')).toBe(true);
    });

    it('should filter out nodes already hosting the shard', () => {
      const store = useShardGridStore.getState();
      
      const testShard: ShardInfo = {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      };
      
      const replicaShard: ShardInfo = {
        ...testShard,
        primary: false,
        node: 'node-2',
      };
      
      const testNodes: NodeWithShards[] = [
        {
          id: 'node-1',
          name: 'node-1',
          ip: '10.0.0.1',
          roles: ['data'],
          heapUsed: 500000000,
          heapMax: 1000000000,
          diskUsed: 10000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [testShard]]]),
        },
        {
          id: 'node-2',
          name: 'node-2',
          ip: '10.0.0.2',
          roles: ['data'],
          heapUsed: 400000000,
          heapMax: 1000000000,
          diskUsed: 8000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [replicaShard]]]),
        },
        {
          id: 'node-3',
          name: 'node-3',
          ip: '10.0.0.3',
          roles: ['data'],
          heapUsed: 300000000,
          heapMax: 1000000000,
          diskUsed: 5000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
      ];
      
      store.setNodes(testNodes);
      store.enterRelocationMode(testShard);
      
      const state = useShardGridStore.getState();
      
      // node-2 already has shard 0 (replica), should not be in destinations
      expect(state.destinationIndicators.has('node-2')).toBe(false);
      // node-3 doesn't have shard 0, should be in destinations
      expect(state.destinationIndicators.has('node-3')).toBe(true);
    });

    it('should filter out non-data nodes', () => {
      const store = useShardGridStore.getState();
      
      const testShard: ShardInfo = {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      };
      
      const testNodes: NodeWithShards[] = [
        {
          id: 'node-1',
          name: 'node-1',
          ip: '10.0.0.1',
          roles: ['data'],
          heapUsed: 500000000,
          heapMax: 1000000000,
          diskUsed: 10000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [testShard]]]),
        },
        {
          id: 'node-2',
          name: 'node-2',
          ip: '10.0.0.2',
          roles: ['master'], // Master-only node, not data
          heapUsed: 400000000,
          heapMax: 1000000000,
          diskUsed: 8000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
        {
          id: 'node-3',
          name: 'node-3',
          ip: '10.0.0.3',
          roles: ['data', 'master'],
          heapUsed: 300000000,
          heapMax: 1000000000,
          diskUsed: 5000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
      ];
      
      store.setNodes(testNodes);
      store.enterRelocationMode(testShard);
      
      const state = useShardGridStore.getState();
      
      // node-2 is master-only, should not be in destinations
      expect(state.destinationIndicators.has('node-2')).toBe(false);
      // node-3 has data role, should be in destinations
      expect(state.destinationIndicators.has('node-3')).toBe(true);
    });

    it('should create destination indicators with correct properties', () => {
      const store = useShardGridStore.getState();
      
      const testShard: ShardInfo = {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      };
      
      const testNodes: NodeWithShards[] = [
        {
          id: 'node-1',
          name: 'node-1',
          ip: '10.0.0.1',
          roles: ['data'],
          heapUsed: 500000000,
          heapMax: 1000000000,
          diskUsed: 10000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [testShard]]]),
        },
        {
          id: 'node-2',
          name: 'node-2',
          ip: '10.0.0.2',
          roles: ['data'],
          heapUsed: 400000000,
          heapMax: 1000000000,
          diskUsed: 8000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
      ];
      
      store.setNodes(testNodes);
      store.enterRelocationMode(testShard);
      
      const state = useShardGridStore.getState();
      const indicator = state.destinationIndicators.get('node-2');
      
      expect(indicator).toBeDefined();
      expect(indicator?.index).toBe('test-index');
      expect(indicator?.shard).toBe(0);
      expect(indicator?.primary).toBe(true);
      expect(indicator?.node).toBe('node-2');
      expect(indicator?.state).toBe('STARTED');
    });
  });

  describe('exitRelocationMode', () => {
    it('should exit relocation mode and clear state', () => {
      const store = useShardGridStore.getState();
      
      const testShard: ShardInfo = {
        index: 'test-index',
        shard: 0,
        primary: true,
        state: 'STARTED',
        node: 'node-1',
        docs: 1000,
        store: 1024000,
      };
      
      const testNodes: NodeWithShards[] = [
        {
          id: 'node-1',
          name: 'node-1',
          ip: '10.0.0.1',
          roles: ['data'],
          heapUsed: 500000000,
          heapMax: 1000000000,
          diskUsed: 10000000000,
          diskTotal: 50000000000,
          shards: new Map([['test-index', [testShard]]]),
        },
        {
          id: 'node-2',
          name: 'node-2',
          ip: '10.0.0.2',
          roles: ['data'],
          heapUsed: 400000000,
          heapMax: 1000000000,
          diskUsed: 8000000000,
          diskTotal: 50000000000,
          shards: new Map(),
        },
      ];
      
      store.setNodes(testNodes);
      store.enterRelocationMode(testShard);
      
      // Verify we're in relocation mode
      let state = useShardGridStore.getState();
      expect(state.relocationMode).toBe(true);
      expect(state.selectedShard).not.toBeNull();
      expect(state.destinationIndicators.size).toBeGreaterThan(0);
      
      // Exit relocation mode
      store.exitRelocationMode();
      
      // Verify state is cleared
      state = useShardGridStore.getState();
      expect(state.relocationMode).toBe(false);
      expect(state.selectedShard).toBeNull();
      expect(state.destinationIndicators.size).toBe(0);
    });
  });
});
