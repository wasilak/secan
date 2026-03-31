import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useReactFlow } from '@xyflow/react';
import TileCache from './tileCache';
import RevalidationCoordinator from './revalidationCoordinator';
import type { TileKey, TilePayload, LOD } from './types';
import TOPOLOGY_CONFIG from '../config/topologyConfig';

export function TopologyController({ onNodesUpdate }: { onNodesUpdate: (nodes: any[]) => void }) {
  const rf = useReactFlow();
  const tileCacheRef = useRef(new TileCache(200));
  const { id: clusterId } = useParams<{ id: string }>();
  const revalRef = useRef(new RevalidationCoordinator(tileCacheRef.current, clusterId));

  // Ensure RevalidationCoordinator knows about clusterId changes (e.g., navigating between clusters
  // without remounting the controller). This updates the internal URL used for tile requests.
  useEffect(() => {
    if (revalRef.current) revalRef.current.setClusterId(clusterId);
  }, [clusterId]);
  const [visibleNodes, setVisibleNodes] = useState<any[]>([]);
  const subscribedTilesRef = useRef<TileKey[]>([]);
  const subscriptionIdRef = useRef<number | null>(null);

  const computeTilesForViewport = useCallback((viewport: any, tileSize = TOPOLOGY_CONFIG.TILE_SIZE) => {
    // world coords assumed equal to RF coords here; compute bounding tile indices
    const { x, y, zoom } = viewport;
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

    reval.onTilePayload((key, payload) => {
      // Build visible nodes only from currently subscribed tiles
      const subTiles = subscribedTilesRef.current || [];
      const nodes: any[] = [];
      const seen = new Set<string>();

      // derive viewport bounds from react flow
      let viewport: any = { x: 0, y: 0, zoom: 1 };
      try { viewport = rf.getViewport(); } catch (e) {}
      const w = window.innerWidth / Math.max(0.0001, viewport.zoom);
      const h = window.innerHeight / Math.max(0.0001, viewport.zoom);
      const minX = viewport.x - w / 2;
      const maxX = viewport.x + w / 2;
      const minY = viewport.y - h / 2;
      const maxY = viewport.y + h / 2;

      for (const t of subTiles) {
        const p = tileCacheRef.current.get(t as TileKey);
        if (!p || !p.nodes) continue;
        for (const n of p.nodes) {
          // Basic culling: node position inside viewport bounds
          if (typeof n.x === 'number' && typeof n.y === 'number') {
            if (n.x + (n.width || 0) < minX || n.x > maxX || n.y + (n.height || 0) < minY || n.y > maxY) continue;
          }
          const id = n.id || `${t.tileX}:${t.tileY}:${JSON.stringify(n)}`;
          if (seen.has(id)) continue;
          seen.add(id);

          // Transform tile node payload into React Flow node shape
          const flowNode = {
            id,
            position: { x: n.x ?? 0, y: n.y ?? 0 },
            data: {
              // normalize to legacy wrapper shape: { node, shards, summaryCounts }
              node: { id: n.id, name: n.name, version: n.version, ip: n.ip },
              shards: n.shards ?? [],
              summaryCounts: n.summaryCounts ?? { primary: 0, replica: 0, total: (n.shards && n.shards.length) || 0 },
              // carry through raw payload for custom handlers
              __raw: n,
            },
            type: 'clusterGroup',
            // keep width/height so downstream layout/measuring can use them
            width: n.width,
            height: n.height,
          } as any;

          nodes.push(flowNode);
        }
      }

      setVisibleNodes(nodes);
      // For subscribed tiles that are not yet cached, provide one skeleton node per tile
      const tileSize = TOPOLOGY_CONFIG.TILE_SIZE;
      for (const t of subTiles) {
        const p = tileCacheRef.current.get(t as TileKey);
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
        } as any;
        // avoid duplicates
        if (!nodes.find((n) => n.id === skid)) nodes.push(skeletonNode);
      }
      onNodesUpdate(nodes);
    });

    // start auto refresh
    reval.startAutoRefresh();
    return () => {
      reval.stopAutoRefresh();
    };
  }, [onNodesUpdate, rf]);

  function parseKey(s: string) {
    const [x, y, lod] = s.split(':');
    return { tileX: Number(x), tileY: Number(y), lod } as TileKey;
  }

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
          // unsubscribe previous
          if (subscriptionIdRef.current) reval.unsubscribe(subscriptionIdRef.current);
          subscriptionIdRef.current = reval.subscribeTiles(allTiles);
          subscribedTilesRef.current = allTiles;

          reval.forceRefresh(allTiles).catch(() => {});
        }
      } catch (e) {
        // ignore when RF not ready
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
