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
  private clusterId?: string | undefined;

  constructor(tileCache: TileCache, clusterId?: string) {
    this.tileCache = tileCache;
    this.clusterId = clusterId;
  }

  setClusterId(clusterId?: string) {
    this.clusterId = clusterId;
  }

  subscribeTiles(tileKeys: TileKey[]) {
    const id = this.nextSubId++;
    this.subscriptions.set(id, tileKeys);
    return id;
  }

  unsubscribe(id: number) {
    this.subscriptions.delete(id);
    // Abort any inflight requests for tiles no longer subscribed by any subscriber
    const remaining = new Set<string>(Array.from(this.subscriptions.values()).flat().map((k: TileKey) => keyToString(k)));
    for (const [s, info] of Array.from(this.inflight.entries())) {
      if (!remaining.has(s)) {
        try {
          info.controller.abort();
        } catch (err) {
          // ignore abort errors but mark var used
          void err;
        }
        this.inflight.delete(s);
      }
    }
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
    type TrackedPromise = Promise<void> & { isFinished?: () => boolean };
    const running: TrackedPromise[] = [];
    for (const batch of batches) {
      const raw = this.fetchBatchWithRetry(batch);
      const tracked = raw as TrackedPromise;
      let finished = false;
      tracked.isFinished = () => finished;
      // mark finished when settled
      tracked.then(() => { finished = true; }).catch(() => { finished = true; });
      running.push(tracked);
      if (running.length >= this.parallelLimit) {
        await Promise.race(running).catch(() => {});
        // remove settled promises
        for (let i = running.length - 1; i >= 0; i--) {
          const r = running[i];
          if (r.isFinished && r.isFinished()) running.splice(i, 1);
        }
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
      } catch (_err) {
        attempt += 1;
        if (attempt > this.maxRetries) {
          console.warn('fetchBatchWithRetry failed after retries', _err);
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

    const url = this.clusterId ? `/api/clusters/${this.clusterId}/topology/tiles` : '/topology/tiles';
    const body = { tileRequests: keysToSend.map((b) => ({ x: b.tileX, y: b.tileY, lod: b.lod, clientVersion: versions[keyToString(b)] })) };

    let resp: Response;
    try {
      // Use cache: 'no-store' to prevent browser/proxy caches from returning stale
      // tile payloads. Also set Cache-Control/Pragma headers for intermediaries.
      resp = await fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
        // no-store ensures the browser doesn't store the response in its HTTP cache
        cache: 'no-store',
      });
    } catch (err) {
      // network or abort - ensure we clear inflight markers for these keys
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
    const tiles = (json && json.tiles) || [];

    // server returns an entry per requested tile. If tile.unchanged is true or nodes_meta is null,
    // keep existing cache entry (avoid overwriting with empty payload). Otherwise update cache.
    for (const t of tiles) {
      const key: TileKey = { tileX: t.x, tileY: t.y, lod: t.lod };
      const s = keyToString(key);

      // server uses nodes_meta and shards fields; translate into the client shape
      const unchanged = !!t.unchanged || t.nodesMeta == null;
      if (unchanged) {
        // leave cache alone; just notify using existing cached payload if present
        const existing = this.tileCache.get(key as TileKey);
        if (existing && this.onTileCb) this.onTileCb(key, existing);
        this.inflight.delete(s);
        continue;
      }

      // Build a client-facing payload: map nodesMeta -> nodes, and include shards map under 'shards'
      const payload: TilePayload = {
        tileX: t.x,
        tileY: t.y,
        lod: t.lod,
        version: t.version,
        nodes: t.nodesMeta,
        edges: t.edges,
        // Preserve shards map if present so callers that inspect t.shards can use it
        // Note: TilePayload type may be loose (unknown[]) so we keep as-is
        // @ts-ignore - allow passing through shards to payload if present
        shards: t.shards,
      };
      this.tileCache.put(key, payload);
      if (this.onTileCb) this.onTileCb(key, payload);
      // clear inflight for this key
      this.inflight.delete(s);
    }

    // In case server did not include entries for some keys, clear inflight markers for them
    for (const k of keysToSend) {
      const s = keyToString(k);
      if (this.inflight.has(s)) this.inflight.delete(s);
    }
  }
}

export default RevalidationCoordinator;
