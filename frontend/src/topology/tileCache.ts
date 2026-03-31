import type { TileKey, TilePayload } from './types';

function keyToString(k: TileKey) {
  return `${k.tileX}:${k.tileY}:${k.lod}`;
}

export class TileCache {
  private capacity: number;
  private map: Map<string, TilePayload>;

  constructor(capacity = 200) {
    this.capacity = capacity;
    this.map = new Map();
  }

  get(key: TileKey): TilePayload | null {
    const s = keyToString(key);
    const v = this.map.get(s) ?? null;
    if (!v) return null;
    // LRU: move to end
    this.map.delete(s);
    this.map.set(s, v);
    return v;
  }

  put(key: TileKey, payload: TilePayload) {
    const s = keyToString(key);
    if (this.map.has(s)) this.map.delete(s);
    this.map.set(s, payload);
    while (this.map.size > this.capacity) {
      // evict oldest
      const it = this.map.keys().next();
      if (it.done) break;
      this.map.delete(it.value);
    }
  }

  delete(key: TileKey) {
    this.map.delete(keyToString(key));
  }

  keys(): string[] {
    return Array.from(this.map.keys());
  }

  size() {
    return this.map.size;
  }
}

export default TileCache;
