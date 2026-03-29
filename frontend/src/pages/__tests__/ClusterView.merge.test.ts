import { describe, it, expect } from 'vitest';
import { mergeShardLists } from '../ClusterView';

describe('mergeShardLists', () => {
  it('preserves multiple unassigned copies for same index/shard/primary', () => {
    const allShards = [
      { index: 'i1', shard: 0, primary: false, node: 'n1' } as any,
    ];

    const unassigned = [
      { index: 'i1', shard: 0, primary: false, node: null } as any,
      { index: 'i1', shard: 0, primary: false, node: null } as any,
    ];

    const merged = mergeShardLists(allShards, unassigned);
    const unassignedCount = merged.filter((s) => s.node === null).length;
    expect(unassignedCount).toBe(2);
    // Node-backed shard should still be present
    expect(merged.some((s) => s.node === 'n1')).toBe(true);
  });
});
