import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import TileCache from './tileCache';
import RevalidationCoordinator from './revalidationCoordinator';
import type { TileKey, LOD } from './types';
import TOPOLOGY_CONFIG from '../config/topologyConfig';

export function TopologyController({ onNodesUpdate }: { onNodesUpdate: (nodes: unknown[]) => void }) {
  const rf = useReactFlow();
  const tileCacheRef = useRef<TileCache | null>(null);
  const revalRef = useRef<RevalidationCoordinator | null>(null);
  const { id: clusterId } = useParams<{ id: string }>();

  // Initialize refs only once in an effect to satisfy eslint/react-hooks/refs rule
  useEffect(() => {
    if (tileCacheRef.current == null) tileCacheRef.current = new TileCache(200);
    if (revalRef.current == null) revalRef.current = new RevalidationCoordinator(tileCacheRef.current as TileCache, clusterId);
    // Ensure clusterId is updated on coordinator whenever clusterId changes
    if (revalRef.current) revalRef.current.setClusterId(clusterId);
  }, [clusterId]);

  // Ensure RevalidationCoordinator knows about clusterId changes (e.g., navigating between clusters
  // without remounting the controller). This updates the internal URL used for tile requests.
  useEffect(() => {
    if (revalRef.current) revalRef.current.setClusterId(clusterId);
  }, [clusterId]);
  // visibleNodes state was previously used for debugging; not required here
  const [, setVisibleNodes] = useState<unknown[]>([]);
  const subscribedTilesRef = useRef<TileKey[]>([]);
  const subscriptionIdRef = useRef<number | null>(null);

  const computeTilesForViewport = useCallback((viewport: unknown, tileSize = TOPOLOGY_CONFIG.TILE_SIZE) => {
    // world coords assumed equal to RF coords here; compute bounding tile indices
      // Narrow viewport unknown -> expected shape
      const v = viewport as { x?: number; y?: number; zoom?: number } | undefined;
      const { x = 0, y = 0, zoom = 1 } = v ?? {};
    // approximate visible bounds: RF viewport center at (x,y) with window size scaled by zoom
    const w = window.innerWidth / Math.max(0.0001, zoom);
    const h = window.innerHeight / Math.max(0.0001, zoom);
    const minX = Math.floor((x - w / 2) / tileSize);
    const maxX = Math.floor((x + w / 2) / tileSize);
    const minY = Math.floor((y - h / 2) / tileSize);
    const maxY = Math.floor((y + h / 2) / tileSize);
    const tiles: TileKey[] = [];
    const lod: LOD = zoom > 0.7 ? 'L2' : zoom > 0.35 ? 'L1' : 'L0';
    for (let tx = minX; tx <= maxX; tx++) for (let ty = minY; ty <= maxY; ty++) tiles.push({ tileX: tx, tileY: ty, lod });
    return { tiles, lod };
  }, []);

  useEffect(() => {
    const reval = revalRef.current;

    // Guard: reval may be null during initialization
    if (!reval) return;

    reval.onTilePayload((_key, _payload) => {
      // Build visible nodes only from currently subscribed tiles
      const subTiles = subscribedTilesRef.current || [];
      type NodeLike = { id: string; [k: string]: unknown };
      const nodes: NodeLike[] = [];
      const seen = new Set<string>();

      // derive viewport bounds from react flow
      let viewport: { x: number; y: number; zoom: number } = { x: 0, y: 0, zoom: 1 };
      try { const vp = rf.getViewport(); viewport = { x: vp.x ?? 0, y: vp.y ?? 0, zoom: vp.zoom ?? 1 }; } catch (_err) { void _err; }
      const w = window.innerWidth / Math.max(0.0001, viewport.zoom);
      const h = window.innerHeight / Math.max(0.0001, viewport.zoom);
      const minX = viewport.x - w / 2;
      const maxX = viewport.x + w / 2;
      const minY = viewport.y - h / 2;
      const maxY = viewport.y + h / 2;

      for (const t of subTiles) {
        const p = tileCacheRef.current ? tileCacheRef.current.get(t as TileKey) : undefined;
        if (!p || !p.nodes) continue;
        for (const nUnknown of (p.nodes ?? []) as unknown[]) {
          const n = nUnknown as Record<string, unknown>;
          // Basic culling: node position inside viewport bounds
          const nx = typeof n.x === 'number' ? (n.x as number) : undefined;
          const ny = typeof n.y === 'number' ? (n.y as number) : undefined;
          const nwidth = typeof n.width === 'number' ? (n.width as number) : 0;
          const nheight = typeof n.height === 'number' ? (n.height as number) : 0;
          if (typeof nx === 'number' && typeof ny === 'number') {
            if (nx + nwidth < minX || nx > maxX || ny + nheight < minY || ny > maxY) continue;
          }
          const id = (typeof n.id === 'string' && n.id) || `${t.tileX}:${t.tileY}:${JSON.stringify(n)}`;
          if (seen.has(id)) continue;
          seen.add(id);

          // Transform tile node payload into React Flow node shape
              const flowNode = {
                id,
                position: { x: nx ?? 0, y: ny ?? 0 },
                data: {
                  node: {
                    id: typeof n.id === 'string' ? n.id : undefined,
                    name: typeof n.name === 'string' ? n.name : undefined,
                    version: typeof n.version === 'string' ? n.version : undefined,
                    ip: typeof n.ip === 'string' ? n.ip : undefined,
                  },
                  shards: Array.isArray(n.shards) ? n.shards : [],
                  summaryCounts: (typeof n.summaryCounts === 'object' && n.summaryCounts) || { primary: 0, replica: 0, total: Array.isArray(n.shards) ? n.shards.length : 0 },
                  __raw: n,
                },
                type: 'clusterGroup',
                width: nwidth || undefined,
                height: nheight || undefined,
              } as unknown;

          nodes.push(flowNode as NodeLike);
        }
      }

      setVisibleNodes(nodes);
      // For subscribed tiles that are not yet cached, provide one skeleton node per tile
      const tileSize = TOPOLOGY_CONFIG.TILE_SIZE;
        for (const t of subTiles) {
        const p = tileCacheRef.current ? tileCacheRef.current.get(t as TileKey) : undefined;
        if (p && p.nodes) continue;
        const sx = t.tileX * tileSize + tileSize / 2;
        const sy = t.tileY * tileSize + tileSize / 2;
        const skid = `skeleton:${t.tileX}:${t.tileY}`;
        const skeletonNode = {
          id: skid,
          position: { x: sx, y: sy },
          data: { node: { id: skid, name: 'Loading...' }, shards: [], summaryCounts: { primary: 0, replica: 0, total: 0 }, isLoading: true },
          type: 'clusterGroup',
          width: TOPOLOGY_CONFIG.GROUP_WIDTH,
          height: 140,
        } as unknown;
        // avoid duplicates
        if (!nodes.find((n) => n.id === skid)) nodes.push(skeletonNode as NodeLike);
      }
      onNodesUpdate(nodes);
    });

    // start auto refresh
    reval.startAutoRefresh();
    return () => {
      reval.stopAutoRefresh();
    };
  }, [onNodesUpdate, rf]);

  // parseKey removed - not used

  useEffect(() => {
    let mounted = true;
    let lastViewportJson = '';
    const pollInterval = 150; // ms

    const poll = () => {
      try {
        const viewport = rf.getViewport();
        const json = JSON.stringify(viewport);
        if (json !== lastViewportJson) {
          lastViewportJson = json;
          const { tiles } = computeTilesForViewport(viewport);
          // include 1-tile prefetch ring
          const allTiles: TileKey[] = [];
          const ring = 1;
          for (const t of tiles) {
            for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) allTiles.push({ tileX: t.tileX + dx, tileY: t.tileY + dy, lod: t.lod });
          }

          const reval = revalRef.current;
          if (reval) {
            // unsubscribe previous
            if (subscriptionIdRef.current) reval.unsubscribe(subscriptionIdRef.current);
            subscriptionIdRef.current = reval.subscribeTiles(allTiles);
            subscribedTilesRef.current = allTiles;

            reval.forceRefresh(allTiles).catch((_err) => { void _err; });
          }
        }
      } catch (_err) {
        void _err; // ignore when RF not ready
      }
    };

    const id = window.setInterval(() => {
      if (!mounted) return;
      poll();
    }, pollInterval);

    // initial poll
    poll();

    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [rf, computeTilesForViewport]);

  return null;
}

export default TopologyController;
