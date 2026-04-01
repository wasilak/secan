export type LOD = 'L0' | 'L1' | 'L2';

export interface TileId {
  x: number;
  y: number;
}

export interface TileKey {
  tileX: number;
  tileY: number;
  lod: LOD;
}

export interface TilePayload {
  tileX: number;
  tileY: number;
  lod: LOD;
  version?: string;
  // Minimal node objects; keep as unknown to avoid tight coupling
  nodes?: unknown[];
  // Server-side may return nodes_meta; allow either field for compatibility
  nodesMeta?: unknown[];
  edges?: unknown[];
  // Optional mapping nodeId -> shards array (present for L2 tiles)
  shards?: Record<string, unknown[]>;
}

export default {};
