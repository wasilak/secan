import TileCache from './tileCache';
import type { TileKey, TilePayload } from './types';

type TileCallback = (key: TileKey, payload: TilePayload) => void;

function keyToString(k: TileKey) {
  return `${k.tileX}:${k.tileY}:${k.lod}`;
}

export class RevalidationCoordinator {
  private tileCache: TileCache;
  private subscriptions: Map<number, TileKey[]> = new Map();
  private nextSubId = 1;
  private inflight: Map<string, { controller: AbortController; requestId: number }> = new Map();
  private onTileCb?: TileCallback;
  private batchSize = 8;
  private parallelLimit = 6;
  private maxRetries = 2;
  private globalIntervalId: number | null = null;
  private globalReloadIntervalMs = 30000; // default 30s

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

  startAutoRefresh(intervalMs?: number) {
    if (intervalMs) this.globalReloadIntervalMs = intervalMs;
    if (this.globalIntervalId) return;
    this.globalIntervalId = window.setInterval(() => this.refreshSubscribedTiles().catch(() => {}), this.globalReloadIntervalMs);
  }

  stopAutoRefresh() {
    if (this.globalIntervalId) {
      clearInterval(this.globalIntervalId);
      this.globalIntervalId = null;
    }
  }

  async refreshSubscribedTiles() {
    const toFetch = Array.from(this.subscriptions.values()).flat();
    await this.forceRefresh(toFetch);
  }

  async forceRefresh(tileKeys?: TileKey[]) {
    const toFetch = tileKeys ?? Array.from(this.subscriptions.values()).flat();
    // Deduplicate by key
    const uniq = new Map<string, TileKey>();
    for (const t of toFetch) uniq.set(keyToString(t), t);
    const list = Array.from(uniq.values());

    // Prepare batches
    const batches: TileKey[][] = [];
    for (let i = 0; i < list.length; i += this.batchSize) batches.push(list.slice(i, i + this.batchSize));

    // Run batches with limited parallelism
    const running: Promise<void>[] = [];
    for (const batch of batches) {
      const p = this.fetchBatchWithRetry(batch);
      running.push(p);
      if (running.length >= this.parallelLimit) {
        await Promise.race(running).catch(() => {});
        // remove settled promises
        for (let i = running.length - 1; i >= 0; i--) if ((running[i] as any).done) running.splice(i, 1);
      }
    }
    // Wait for remaining
    await Promise.all(running).catch(() => {});
  }

  private async fetchBatchWithRetry(batch: TileKey[]) {
    let attempt = 0;
    while (attempt <= this.maxRetries) {
      try {
        await this.fetchBatch(batch);
        return;
      } catch (err) {
        attempt += 1;
        if (attempt > this.maxRetries) {
          console.warn('fetchBatchWithRetry failed after retries', err);
          return;
        }
        // exponential backoff
        await new Promise((r) => setTimeout(r, 100 * Math.pow(2, attempt)));
      }
    }
  }

  private async fetchBatch(batch: TileKey[]) {
    // Deduplicate keys and skip those already inflight
    const keysToSend: TileKey[] = [];
    for (const k of batch) {
      const s = keyToString(k);
      if (this.inflight.has(s)) continue;
      keysToSend.push(k);
    }
    if (keysToSend.length === 0) return;

    const controller = new AbortController();
    const requestId = Date.now();

    // Mark all as inflight with same controller
    for (const k of keysToSend) this.inflight.set(keyToString(k), { controller, requestId });

    // Build conditional header map
    const versions: Record<string, string | undefined> = {};
    for (const k of keysToSend) {
      const existing = this.tileCache.get(k as TileKey);
      versions[keyToString(k)] = existing?.version;
    }

    const url = '/topology/tiles';
    const body = { tileRequests: keysToSend.map((b) => ({ x: b.tileX, y: b.tileY, lod: b.lod, clientVersion: versions[keyToString(b)] })) };

    let resp: Response;
    try {
      resp = await fetch(url, { method: 'POST', body: JSON.stringify(body), signal: controller.signal, headers: { 'Content-Type': 'application/json' } });
    } catch (err) {
      // network or abort
      for (const k of keysToSend) {
        const s = keyToString(k);
        const info = this.inflight.get(s);
        if (info && info.requestId === requestId) this.inflight.delete(s);
      }
      throw err;
    }

    if (!resp.ok) {
      for (const k of keysToSend) this.inflight.delete(keyToString(k));
      throw new Error(`tile fetch failed ${resp.status}`);
    }

    const json = await resp.json();
    const tiles = json.tiles || [];

    // server may return only changed tiles; for those returned we update cache and notify
    const returnedKeys = new Set<string>();
    for (const t of tiles) {
      const key: TileKey = { tileX: t.x, tileY: t.y, lod: t.lod };
      const payload: TilePayload = { tileX: t.x, tileY: t.y, lod: t.lod, version: t.version, nodes: t.nodes, edges: t.edges };
      this.tileCache.put(key, payload);
      returnedKeys.add(keyToString(key));
      if (this.onTileCb) this.onTileCb(key, payload);
      // clear inflight for this key
      this.inflight.delete(keyToString(key));
    }

    // Any keys not returned — treat as unchanged; clear inflight markers
    for (const k of keysToSend) {
      const s = keyToString(k);
      if (!returnedKeys.has(s)) this.inflight.delete(s);
    }
  }
}

export default RevalidationCoordinator;
