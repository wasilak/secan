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
  nodes?: any[];
  edges?: any[];
}

export default {};
