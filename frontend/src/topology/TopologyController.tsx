import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';
import TileCache from './tileCache';
import RevalidationCoordinator from './revalidationCoordinator';
import type { TileKey, TilePayload, LOD } from './types';
import TOPOLOGY_CONFIG from '../config/topologyConfig';

export function TopologyController({ onNodesUpdate }: { onNodesUpdate: (nodes: any[]) => void }) {
  const rf = useReactFlow();
  const tileCacheRef = useRef(new TileCache(200));
  const revalRef = useRef(new RevalidationCoordinator(tileCacheRef.current));
  const [visibleNodes, setVisibleNodes] = useState<any[]>([]);

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
      // When tile payload arrives, compute visible nodes from tileCache and notify
      const nodes: any[] = [];
      for (const k of tileCacheRef.current.keys()) {
        // naive collect all tiles' nodes — optimize later
        const p = tileCacheRef.current.get(parseKey(k));
        if (p && p.nodes) nodes.push(...p.nodes);
      }
      setVisibleNodes(nodes);
      onNodesUpdate(nodes);
    });
  }, [onNodesUpdate]);

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
          revalRef.current.forceRefresh(tiles).catch(() => {});
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
