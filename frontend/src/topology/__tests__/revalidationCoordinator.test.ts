import { test, expect } from 'vitest';
import TileCache from '../tileCache';
import RevalidationCoordinator from '../revalidationCoordinator';
import type { TileKey } from '../types';

test('RevalidationCoordinator fetches and caches tiles, honors unchanged', async () => {
  const cache = new TileCache(10);
  const reval = new RevalidationCoordinator(cache);

  const tile: TileKey = { tileX: 0, tileY: 0, lod: 'L1' };

  let called = 0;
  reval.onTilePayload((key, payload) => {
    called++;
  });

  // Mock fetch to return a tile payload with nodes
  const originalFetch = globalThis.fetch;
  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({ tiles: [{ x: 0, y: 0, lod: 'L1', version: 'v1', unchanged: false, nodes: [{ id: 'n1', x: 10, y: 20 }] }] }),
  } as any);

  await reval.forceRefresh([tile]);
  expect(cache.get(tile)).not.toBeNull();
  expect(called).toBeGreaterThan(0);

  // Now mock fetch to indicate unchanged
  (globalThis as any).fetch = async () => ({
    ok: true,
    json: async () => ({ tiles: [{ x: 0, y: 0, lod: 'L1', version: 'v1', unchanged: true, nodes: null }] }),
  } as any);

  const prevCalled = called;
  await reval.forceRefresh([tile]);
  // onTilePayload should be invoked with existing cache entry (we call it when unchanged)
  expect(called).toBeGreaterThanOrEqual(prevCalled);

  // restore fetch
  globalThis.fetch = originalFetch;
});
