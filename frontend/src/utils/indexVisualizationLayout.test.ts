import { describe, it, expect } from 'vitest';
import { calculateIndexVizLayout } from './indexVisualizationLayout';
import { getShardDotColor } from './colors';
import type { ShardInfo, NodeInfo } from '../types/api';

describe('calculateIndexVizLayout', () => {
  it('throws when NodeInfo missing for a non-unassigned node', () => {
    const shards: ShardInfo[] = [
      { index: 'logs-1', shard: 0, primary: true, state: 'STARTED', node: 'nodeA', docs: 0, store: 0 },
    ];

    expect(() =>
      calculateIndexVizLayout({ indexName: 'logs-1', shards, nodes: [] })
    ).toThrow(/missing NodeInfo/);
  });

  it('emits clusterGroup nodes with summaryCounts when NodeInfo provided', () => {
    const shards: ShardInfo[] = [
      { index: 'logs-1', shard: 0, primary: true, state: 'STARTED', node: 'nodeA', docs: 0, store: 0 },
      { index: 'logs-1', shard: 0, primary: false, state: 'STARTED', node: 'nodeA', docs: 0, store: 0 },
      { index: 'logs-1', shard: 1, primary: true, state: 'UNASSIGNED', node: undefined, docs: 0, store: 0 },
    ];

    const nodes: NodeInfo[] = [
      {
        id: 'nA',
        name: 'nodeA',
        roles: ['data'],
        heapUsed: 1000,
        heapMax: 2000,
        heapPercent: 50,
        diskUsed: 5000,
        diskTotal: 10000,
        cpuPercent: 10,
        ip: '10.0.0.1',
        version: '8.0.0',
        isMaster: false,
        isMasterEligible: false,
        loadAverage: undefined,
        uptime: undefined,
        uptimeMillis: undefined,
        tags: undefined,
      },
    ];

    const { nodes: layoutNodes } = calculateIndexVizLayout({ indexName: 'logs-1', shards, nodes });

    // Should contain clusterGroup nodes for nodeA and Unassigned
    const clusterGroups = layoutNodes.filter((n) => n.type === 'clusterGroup');
    expect(clusterGroups.length).toBeGreaterThanOrEqual(1);

    const nodeAGroup = clusterGroups.find((g) => g.id?.toString().includes('nodeA'));
    expect(nodeAGroup).toBeDefined();
    // data.summaryCounts should exist and reflect primary/replica counts
    // Access as any since data has loose typing in layout
    const summary = (nodeAGroup as any).data?.summaryCounts;
    expect(summary).toBeDefined();
    expect(summary.total).toBe(2);
    expect(summary.primary).toBe(1);
    expect(summary.replica).toBe(1);
  });

  it('resolves NodeInfo when shards reference node id instead of name', () => {
    const shards: ShardInfo[] = [
      { index: 'logs-1', shard: 0, primary: true, state: 'STARTED', node: 'nA', docs: 0, store: 0 },
      { index: 'logs-1', shard: 0, primary: false, state: 'STARTED', node: 'nA', docs: 0, store: 0 },
    ];

    const nodes: NodeInfo[] = [
      {
        id: 'nA',
        name: 'nodeA',
        roles: ['data'],
        heapUsed: 1000,
        heapMax: 2000,
        heapPercent: 50,
        diskUsed: 5000,
        diskTotal: 10000,
        cpuPercent: 10,
        ip: '10.0.0.1',
        version: '8.0.0',
        isMaster: false,
        isMasterEligible: false,
        loadAverage: undefined,
        uptime: undefined,
        uptimeMillis: undefined,
        tags: undefined,
      },
    ];

    const { nodes: layoutNodes } = calculateIndexVizLayout({ indexName: 'logs-1', shards, nodes });

    const clusterGroups = layoutNodes.filter((n) => n.type === 'clusterGroup');
    expect(clusterGroups.length).toBeGreaterThanOrEqual(1);

    // Ensure the emitted group uses the authoritative NodeInfo.name for display
    const nodeAGroup = clusterGroups.find((g) => (g as any).data?.name === 'nodeA');
    expect(nodeAGroup).toBeDefined();
    const summary = (nodeAGroup as any).data?.summaryCounts;
    expect(summary).toBeDefined();
    expect(summary.total).toBe(2);
    expect(summary.primary).toBe(1);
    expect(summary.replica).toBe(1);
  });

  it('uses shard state coloring for dots (STARTED -> green)', () => {
    const shards: ShardInfo[] = [
      { index: 'logs-1', shard: 0, primary: true, state: 'STARTED', node: 'nodeA', docs: 0, store: 0 },
    ];
    const nodes: NodeInfo[] = [
      {
        id: 'nA',
        name: 'nodeA',
        roles: ['data'],
        heapUsed: 1000,
        heapMax: 2000,
        heapPercent: 50,
        diskUsed: 5000,
        diskTotal: 10000,
        cpuPercent: 10,
        ip: '10.0.0.1',
        version: '8.0.0',
        isMaster: false,
        isMasterEligible: false,
        loadAverage: undefined,
        uptime: undefined,
        uptimeMillis: undefined,
        tags: undefined,
      },
    ];

    const { nodes: layoutNodes } = calculateIndexVizLayout({ indexName: 'logs-1', shards, nodes });
    const clusterGroups = layoutNodes.filter((n) => n.type === 'clusterGroup');
    const nodeAGroup = clusterGroups.find((g) => g.id?.toString().includes('nodeA'));
    expect(nodeAGroup).toBeDefined();
    const dots = (nodeAGroup as any).data?.dots as any[];
    expect(dots).toBeDefined();
    expect(dots[0].color).toBe(getShardDotColor('STARTED'));
  });

  it('does not set RF node height so DOM drives handle placement', () => {
    const shards: ShardInfo[] = [
      { index: 'logs-1', shard: 0, primary: true, state: 'STARTED', node: 'nodeA', docs: 0, store: 0 },
    ];
    const nodes: NodeInfo[] = [
      {
        id: 'nA',
        name: 'nodeA',
        roles: ['data'],
        heapUsed: 1000,
        heapMax: 2000,
        heapPercent: 50,
        diskUsed: 5000,
        diskTotal: 10000,
        cpuPercent: 10,
        ip: '10.0.0.1',
        version: '8.0.0',
        isMaster: false,
        isMasterEligible: false,
        loadAverage: undefined,
        uptime: undefined,
        uptimeMillis: undefined,
        tags: undefined,
      },
    ];

    const { nodes: layoutNodes } = calculateIndexVizLayout({ indexName: 'logs-1', shards, nodes });
    const clusterGroups = layoutNodes.filter((n) => n.type === 'clusterGroup');
    // Ensure none of the emitted clusterGroup nodes set a fixed height property
    for (const g of clusterGroups) {
      expect((g as any).height).toBeUndefined();
      // and ensure RF node does not set a fixed width that could clip the card
      // width may be undefined or a number; index viz intentionally avoids
      // forcing width to prevent clipping — prefer undefined
      if ((g as any).width !== undefined) {
        expect(typeof (g as any).width).toBe('number');
      }
      // style may contain minWidth but should not force width
      const style = (g as any).style || {};
      expect(style.width).toBeUndefined();
    }
  });
});
