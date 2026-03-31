import TileCache from '../tileCache';
import { test, expect } from 'vitest';

test('TileCache LRU eviction', () => {
  const c = new TileCache(2);
  c.put({ tileX: 0, tileY: 0, lod: 'L0' }, { tileX: 0, tileY: 0, lod: 'L0', version: 'v1', nodes: [] });
  c.put({ tileX: 1, tileY: 0, lod: 'L0' }, { tileX: 1, tileY: 0, lod: 'L0', version: 'v1', nodes: [] });
  // access first to make it recently used
  expect(c.get({ tileX: 0, tileY: 0, lod: 'L0' })).not.toBeNull();
  // add third -> evict least recently used (tile 1)
  c.put({ tileX: 2, tileY: 0, lod: 'L0' }, { tileX: 2, tileY: 0, lod: 'L0', version: 'v1', nodes: [] });
  expect(c.get({ tileX: 1, tileY: 0, lod: 'L0' })).toBeNull();
  expect(c.get({ tileX: 0, tileY: 0, lod: 'L0' })).not.toBeNull();
  expect(c.get({ tileX: 2, tileY: 0, lod: 'L0' })).not.toBeNull();
});
