import TileCache from './tileCache';
import type { TileKey, TilePayload } from './types';

type TileCallback = (key: TileKey, payload: TilePayload) => void;

export class RevalidationCoordinator {
  private tileCache: TileCache;
  private subscriptions: Map<number, TileKey[]> = new Map();
  private nextSubId = 1;
  private inflight: Map<string, { controller: AbortController; requestId: number }> = new Map();
  private onTileCb?: TileCallback;
  private batchSize = 8;
  private parallelLimit = 6;

  constructor(tileCache: TileCache) {
    this.tileCache = tileCache;
  }

  subscribeTiles(tileKeys: TileKey[]) {
    const id = this.nextSubId++;
    this.subscriptions.set(id, tileKeys);
    return id;
  }

  unsubscribe(id: number) {
    this.subscriptions.delete(id);
  }

  onTilePayload(cb: TileCallback) {
    this.onTileCb = cb;
  }

  async forceRefresh(tileKeys?: TileKey[]) {
    const toFetch = tileKeys ?? Array.from(this.subscriptions.values()).flat();
    // Deduplicate
    const uniq = new Map<string, TileKey>();
    for (const t of toFetch) uniq.set(`${t.tileX}:${t.tileY}:${t.lod}`, t);
    const list = Array.from(uniq.values());
    // Batch
    for (let i = 0; i < list.length; i += this.batchSize) {
      const batch = list.slice(i, i + this.batchSize);
      await this.fetchBatch(batch);
    }
  }

  private async fetchBatch(batch: TileKey[]) {
    // simple serialized fetch logic. Limit parallel by awaiting inside caller.
    const url = '/topology/tiles';
    const body = { tileRequests: batch.map(b => ({ x: b.tileX, y: b.tileY, lod: b.lod })) };
    const controller = new AbortController();
    const requestId = Date.now();
    try {
      const resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
      if (!resp.ok) return;
      const json = await resp.json();
      const tiles = json.tiles || [];
      for (const t of tiles) {
        const key: TileKey = { tileX: t.x, tileY: t.y, lod: t.lod };
        const payload: TilePayload = { tileX: t.x, tileY: t.y, lod: t.lod, version: t.version, nodes: t.nodes, edges: t.edges };
        this.tileCache.put(key, payload);
        if (this.onTileCb) this.onTileCb(key, payload);
      }
    } catch (err) {
      // ignore aborted or network
      console.warn('tile fetch batch failed', err);
    } finally {
      // cleanup not implemented for abort map here — kept simple
    }
  }
}

export default RevalidationCoordinator;
