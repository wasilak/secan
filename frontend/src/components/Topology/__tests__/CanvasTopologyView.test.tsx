import { describe, it, expect } from 'vitest';
import { hasTileNodesFromVisible, isSkeletonNode } from '../CanvasTopologyView';

describe('CanvasTopologyView helpers', () => {
  it('returns false for null visible nodes', () => {
    expect(hasTileNodesFromVisible(null)).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(hasTileNodesFromVisible([])).toBe(false);
  });

  it('returns true for an array with skeleton marker', () => {
    expect(hasTileNodesFromVisible([{ id: 'skeleton:1:2' } as any])).toBe(true);
  });

  it('isSkeletonNode recognizes skeleton id pattern', () => {
    expect(isSkeletonNode({ id: 'skeleton:10:11' } as any)).toBe(true);
    expect(isSkeletonNode({ id: 'node-abc' } as any)).toBe(false);
  });
});
