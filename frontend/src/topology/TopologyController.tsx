import { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import TileCache from './tileCache';
import RevalidationCoordinator from './revalidationCoordinator';
import type { TileKey, LOD } from './types';
import TOPOLOGY_CONFIG from '../config/topologyConfig';

// Exported for unit testing: pass baseLod through unchanged.
// The backend controls what shard data to send per LOD; no client-side capacity guard needed.
export function determineAllowedLod(_zoom: number, _viewportWidth: number, _viewportHeight: number, baseLod: LOD): LOD {
  return baseLod;
}

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

    // Base zoom-based LOD
    const baseLod: LOD = zoom > 0.7 ? 'L2' : zoom > 0.35 ? 'L1' : 'L0';
    const lod = determineAllowedLod(zoom, window.innerWidth, window.innerHeight, baseLod);

    for (let tx = minX; tx <= maxX; tx++) for (let ty = minY; ty <= maxY; ty++) tiles.push({ tileX: tx, tileY: ty, lod });
    return { tiles, lod };
  }, []);

  useEffect(() => {
    const reval = revalRef.current;

    // Guard: reval may be null during initialization
    if (!reval) return;

    // Helper: rebuild visible nodes from current tile cache and subscribed tiles.
    const rebuildVisibleNodesFromCache = () => {
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
        // tile-level shards map (nodeId -> shards[]) when provided by server for L2
        const tileShardsMap = p?.shards as Record<string, unknown[]> | undefined;
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

          // Resolve per-node shards: prefer node-embedded shards, else tile-level shards map
          const nodeId = typeof n.id === 'string' ? n.id as string : undefined;
          const nodeName = typeof n.name === 'string' ? n.name as string : undefined;
          let nodeShards: unknown[] | undefined;
          if (Array.isArray(n.shards)) nodeShards = n.shards as unknown[];
          else if (tileShardsMap && nodeId && Array.isArray(tileShardsMap[nodeId])) nodeShards = tileShardsMap[nodeId];
          else if (tileShardsMap && nodeName && Array.isArray(tileShardsMap[nodeName])) nodeShards = tileShardsMap[nodeName];

          // Fallback: node was found in a ring tile (LOD=L1, no shards map).
          // Scan all subscribed L2 tiles for a shards entry keyed by this node's
          // id or name. This handles the case where the viewport center tile does
          // not geometrically contain the node (backend positions nodes starting
          // at world (0,0) in 64px increments, independent of frontend canvas
          // coords), so the node is only present in a ring tile at L1.
          if (nodeShards === undefined) {
            for (const otherTile of subTiles) {
              if (otherTile.lod !== 'L2') continue;
              const otherP = tileCacheRef.current?.get(otherTile as TileKey);
              const otherShardsMap = otherP?.shards as Record<string, unknown[]> | undefined;
              if (!otherShardsMap) continue;
              if (nodeId && Array.isArray(otherShardsMap[nodeId])) { nodeShards = otherShardsMap[nodeId]; break; }
              if (nodeName && Array.isArray(otherShardsMap[nodeName])) { nodeShards = otherShardsMap[nodeName]; break; }
            }
          }

          const summaryCounts = (typeof n.summaryCounts === 'object' && n.summaryCounts)
            ? n.summaryCounts
            : (nodeShards && nodeShards.length > 0)
            ? (() => {
              const arr = nodeShards as unknown[];
              const total = arr.length;
              const primary = arr.filter((s) => Boolean((s as Record<string, unknown>).primary)).length;
              const replica = total - primary;
              return { primary, replica, total };
            })()
            : undefined;

          // Transform tile node payload into React Flow node shape.
          // Only include `shards` key when shards are actually resolved — if we
          // always set `shards: undefined`, the `hasOwnProperty` guard in
          // CanvasTopologyView would pass (key present) but the `!== undefined`
          // check would block the merge, so shards would never reach the card.
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
              ...(nodeShards !== undefined ? { shards: nodeShards } : {}),
              summaryCounts,
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
          // Only set minimal data and isLoading flag. Do not inject empty shards
          // or summaryCounts as that may incorrectly overwrite base node metadata.
          data: { node: { id: skid, name: 'Loading...' }, isLoading: true, __tile: { x: t.tileX, y: t.tileY, lod: t.lod } },
          type: 'clusterGroup',
          width: TOPOLOGY_CONFIG.GROUP_WIDTH,
          height: 140,
        } as unknown;
        // avoid duplicates
        if (!nodes.find((n) => n.id === skid)) nodes.push(skeletonNode as NodeLike);
      }
      onNodesUpdate(nodes);
    };

    // Register callback to rebuild when the coordinator notifies of tile payloads
    reval.onTilePayload((_key, _payload) => {
      rebuildVisibleNodesFromCache();
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
            for (let dx = -ring; dx <= ring; dx++) {
              for (let dy = -ring; dy <= ring; dy++) {
                // If center tile was granted L2, downgrade neighbor prefetch tiles to L1
                const isCenter = dx === 0 && dy === 0;
                const neighborLod: LOD = (!isCenter && t.lod === 'L2') ? 'L1' : t.lod;
                allTiles.push({ tileX: t.tileX + dx, tileY: t.tileY + dy, lod: neighborLod });
              }
            }
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
