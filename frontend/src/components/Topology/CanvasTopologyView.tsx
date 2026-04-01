/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesInitialized,
  useReactFlow,
  useNodesState,
  applyNodeChanges,
  type NodeTypes,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../../styles/reactflow-overrides.css';
import { Box, Skeleton } from '@mantine/core';
import type { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import ClusterESNodeCardFlowWrapper from '../ClusterESNodeCardFlowWrapper';
// Debug: ensure wrapper imported
console.log('CanvasTopologyView imported ClusterESNodeCardFlowWrapper', typeof ClusterESNodeCardFlowWrapper);
import { calculateCanvasLayout, UNASSIGNED_KEY, estimateGroupMinWidth } from '../../utils/canvasLayout';
import TOPOLOGY_CONFIG from '../../config/topologyConfig';
import { sortShards } from '../../utils/shardOrdering';
import { applyDagreLayout } from '../../utils/dagreLayout';
import { resolveCollisions } from '../../utils/resolveCollisions';
import type { GroupingConfig } from '../../utils/topologyGrouping';
import TopologyController from '../../topology/TopologyController';

// Defensive: if ClusterGroupNode failed to import for any reason, provide a
// fallback component so React doesn't throw an "Invalid element type" error
// which surfaces as the minified React error #310 in production.
const nodeTypes: NodeTypes = {
  clusterGroup: ClusterESNodeCardFlowWrapper,
};

// Testable helpers: determine tile-driven presence & skeleton markers.
// Exported for unit tests and to keep the presence logic explicit.
export const isSkeletonNode = (n: any): boolean => {
  const id = n?.id;
  return typeof id === 'string' && id.startsWith('skeleton:');
};

export const hasTileNodesFromVisible = (visible: any[] | null): boolean => {
  // Treat any non-empty array as tile-driven presence. This includes
  // skeleton markers (id startsWith 'skeleton:') inserted by TopologyController
  // for subscribed-but-not-yet-cached tiles.
  return Array.isArray(visible) && visible.length > 0;
};

interface CanvasTopologyViewProps {
  onNodeDragStart?: () => void;
  onNodeDragStop?: () => void;
  nodes: NodeInfo[];
  shards: ShardInfo[];
  indices: IndexInfo[];
  searchParams: URLSearchParams;
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
  onNodeClick?: (nodeId: string) => void;
  onPaneClick?: () => void;
  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  indexNameFilter?: string;
  nodeNameFilter?: string;
  matchesWildcard?: (text: string, pattern: string) => boolean;
  isLoading?: boolean;
  groupingConfig?: GroupingConfig;
}

// ── Flow - hybrid controlled: local state + buffered parent sync ─────────────────

interface FlowProps {
  layoutNodes: Node[];
  onPaneClick?: () => void;
  onNodeDragStart?: () => void;
  onNodeDragStop?: () => void;
  onNodesPositionChange?: (positions: { [id: string]: { x: number; y: number } }) => void;
}

function Flow({ layoutNodes, onPaneClick, onNodeDragStart, onNodeDragStop, onNodesPositionChange }: FlowProps) {
  const { fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const hasFitViewRun = useRef(false);
  const isDraggingRef = useRef(false);
  const pendingLayoutRef = useRef<Node[] | null>(null);

  const [flowNodes, setFlowNodes] = useNodesState(layoutNodes);

  // Defensive: ensure nodeTypes contains only valid React component types.
  // If some renderer is invalid (e.g. undefined due to import failure), replace
  // it with a simple fallback to avoid React throwing invalid element type (error #310).
  const safeNodeTypes = useMemo(() => {
    // Keep fallback typed as unknown to avoid `any` in lint
    const fallback = (_props: unknown) => (
      <div style={{ padding: 8, border: '1px dashed orange', background: 'rgba(255,165,0,0.04)' }}>
        Missing renderer for node type
      </div>
    );
    const out: NodeTypes = {} as NodeTypes;
      Object.keys(nodeTypes).forEach((k) => {
      // Accept functions or memoized exotic components (objects with $$typeof)
      const v = (nodeTypes as unknown as Record<string, unknown>)[k];
      const ok = typeof v === 'function' || (v && typeof v === 'object' && '$$typeof' in v);
      (out as unknown as Record<string, unknown>)[k] = ok ? v : fallback;
      if (!ok) {
        console.error(`Invalid node renderer for type ${k}, using fallback`, v);
      }
    });
    // Ensure a default exists
    (out as any).default = (out as any).default || fallback;
    return out;
  }, []);

  // Validate nodes before passing to ReactFlow to avoid invalid element errors
  // Validate nodeTypes and nodes for invalid renderers. Run validation but
  // do not short-circuit hook calls — keep this synchronous and non-conditional
  // so hook order remains stable. If problems exist, render a lightweight
  // fallback at render time below instead of returning early here.
  const invalidRendererInfo = useMemo(() => {
    const problems: Array<{ nodeId?: string; nodeType?: string; renderer?: unknown; reason: string }> = [];
    // check nodeTypes
    Object.entries(safeNodeTypes as unknown as Record<string, unknown>).forEach(([k, v]) => {
      const ok = typeof v === 'function' || (v && typeof v === 'object' && '$$typeof' in v);
      if (!ok) problems.push({ nodeType: k, renderer: v, reason: 'invalid renderer type' });
    });
    // check nodes (sample)
    (flowNodes || []).slice(0, 20).forEach((n: unknown) => {
      const nodeObj = n as Record<string, unknown>;
      const t = (nodeObj.type as string) || 'default';
      const renderer = (safeNodeTypes as unknown as Record<string, unknown>)[t];
      const ok = typeof renderer === 'function' || (renderer && typeof renderer === 'object' && '$$typeof' in renderer);
      if (!ok) problems.push({ nodeId: nodeObj.id as string | undefined, nodeType: t, renderer, reason: 'node type maps to invalid renderer' });
    });
    return problems.length ? problems : null;
  }, [safeNodeTypes, flowNodes]);

  if (invalidRendererInfo) {
    console.error('Invalid node renderers detected in topology flow', invalidRendererInfo);
  }

  useEffect(() => {
    if (initialized && !hasFitViewRun.current) {
      hasFitViewRun.current = true;
      fitView({ padding: 0.2 });
    }
  }, [initialized, fitView]);

  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const hasDragChange = changes.some(
        (change) => change.type === 'position' && change.dragging,
      );

      if (hasDragChange && !isDraggingRef.current) {
        isDraggingRef.current = true;
        if (onNodeDragStart) onNodeDragStart();
      }

      setFlowNodes((nds) => applyNodeChanges(changes, nds));
    },
    [setFlowNodes, onNodeDragStart],
  );

  const handleNodeDragStop = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      if (onNodeDragStop) onNodeDragStop();
    }
    if (pendingLayoutRef.current) {
      setFlowNodes(pendingLayoutRef.current);
      pendingLayoutRef.current = null;
    }
    // Gather current node positions
    if (onNodesPositionChange) {
      const positions: { [id: string]: { x: number; y: number } } = {};
      flowNodes.forEach(node => {
        positions[node.id] = { x: node.position.x, y: node.position.y };
      });
      onNodesPositionChange(positions);
    }
  }, [setFlowNodes, onNodeDragStop, onNodesPositionChange, flowNodes]);

  useEffect(() => {
    if (!isDraggingRef.current) {
      // Always apply dagre for consistent node distribution
      try {
        const dagreLayout = applyDagreLayout(layoutNodes, [], 'TB');
        setFlowNodes(dagreLayout.nodes);
      } catch (err) {
        // Fallback to raw layout if dagre fails
        console.warn('Dagre layout failed', err);
        setFlowNodes(layoutNodes);
      }
    } else {
      pendingLayoutRef.current = layoutNodes;
    }
  }, [layoutNodes, setFlowNodes]);

  // Collision resolving: wait for RF to measure node sizes, then nudge nodes
  // apart if they overlap. Mirrors IndexVisualizationFlow behavior.
  const layoutRunId = useRef(0);
  useEffect(() => {
    layoutRunId.current += 1;
    const runId = layoutRunId.current;
    let cancelled = false;

    const attemptResolve = () => {
    const nodesArr = (flowNodes as unknown as Record<string, unknown>[]) || [];
      if (nodesArr.length === 0) return;
      const measuredReady = nodesArr.every((n) => {
        const m = (n as any).measured;
        return !!m && (m as any).width > 0 && (m as any).height > 0;
      });
        if (!measuredReady) {
          requestAnimationFrame(attemptResolve);
          return;
        }

      const resolved = resolveCollisions(nodesArr as any, { margin: 12, overlapThreshold: 0.5, maxIterations: 1000 });

      if (!cancelled && runId === layoutRunId.current) {
        setFlowNodes(resolved as any);
      }
    };

    requestAnimationFrame(attemptResolve);
    return () => { cancelled = true; };
  }, [flowNodes, setFlowNodes]);

  return (
    <ReactFlow
      className="secan-reactflow"
      nodes={flowNodes.map(n => ({ ...n, type: (n.type && (safeNodeTypes as any)[n.type]) ? n.type : 'default' }))}
      edges={[]}
      defaultEdgeOptions={{ type: 'simplebezier' }}
      nodeTypes={safeNodeTypes}
      onNodesChange={handleNodesChange}
      onNodeDragStop={handleNodeDragStop}
      // Disable dragging at the top-level Flow for Canvas/Cluster view to
      // maintain parity with Index Visualization and avoid accidental layout shifts.
      nodesDraggable={false}
      nodesConnectable={false}
      elementsSelectable={true}
      minZoom={0.1}
      maxZoom={2}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      proOptions={{ hideAttribution: true }}
      onPaneClick={onPaneClick}
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--mantine-color-gray-4)"
      />
      <Controls showInteractive={false} />
      <MiniMap
        nodeStrokeWidth={0}
        nodeColor="var(--mantine-color-blue-3)"
        maskColor="rgba(0,0,0,0.06)"
        zoomable
        pannable
      />
    </ReactFlow>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

// Maintains position by node ID

export function CanvasTopologyView({
  onNodeDragStart,
  onNodeDragStop,
  nodes = [],
  shards = [],
  indices = [],
  searchParams,
  onShardClick,
  onNodeClick,
  onPaneClick,
  relocationMode,
  validDestinationNodes,
  onDestinationClick,
  indexNameFilter,
  nodeNameFilter,
  matchesWildcard,
  isLoading = false,
  groupingConfig = { attribute: 'none', value: undefined },
}: CanvasTopologyViewProps) {
  const showLoadingSkeleton = isLoading && nodes.length === 0;

  // Visible nodes supplied by the tile/L0-L2 system when available.
  // When tiles are not yet available we fall back to calculateCanvasLayout.
  const [visibleNodesFromTiles, setVisibleNodesFromTiles] = useState<any[] | null>(null);

  // ── Index health colour helper ────────────────────────────────────────────
  const indexHealthMap = useMemo(() => {
    const map = new Map<string, IndexInfo['health']>();
    indices.forEach((index) => map.set(index.name, index.health));
    return map;
  }, [indices]);

  const getIndexHealthColor = useCallback(
    (indexName: string): string => {
      const health = indexHealthMap.get(indexName);
      switch (health) {
        case 'green':  return 'var(--mantine-color-green-6)';
        case 'yellow': return 'var(--mantine-color-yellow-6)';
        case 'red':    return 'var(--mantine-color-red-6)';
        default:       return 'var(--mantine-color-gray-6)';
      }
    },
    [indexHealthMap],
  );

  // ── Filter: nodes ─────────────────────────────────────────────────────────
  const filteredNodes = useMemo(() => {
    if (!matchesWildcard || !nodeNameFilter) return nodes;
    return nodes.filter((node) => matchesWildcard(node.name, nodeNameFilter));
  }, [nodes, matchesWildcard, nodeNameFilter]);

  // ── Filter: indices (mirror DotBasedTopologyView) ─────────────────────────
  const filteredIndices = useMemo(() => {
    const showClosed  = searchParams.get('showClosed')  === 'true';
    const showSpecial = searchParams.get('showSpecial') === 'true';
    return indices.filter((index) => {
      if (indexNameFilter && matchesWildcard && !matchesWildcard(index.name, indexNameFilter)) return false;
      if (!showClosed  && index.status !== 'open')        return false;
      if (!showSpecial && index.name.startsWith('.'))     return false;
      return true;
    });
  }, [indices, indexNameFilter, matchesWildcard, searchParams]);

  // ── Filter: shard states ──────────────────────────────────────────────────
  const selectedShardStates = useMemo(() => {
    const ALL = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;
    const param = searchParams.get('shardStates');
    return param ? param.split(',').filter(Boolean) : Array.from(ALL);
  }, [searchParams]);

  // ── shardsByNode map ──────────────────────────────────────────────────────
  const shardsByNode = useMemo(() => {
    const filteredSet = new Set(filteredIndices.map((i) => i.name));
    const filtered = sortShards(
      shards.filter((shard) => {
        if (shard.state === 'RELOCATING') return filteredSet.has(shard.index);
        if (!selectedShardStates.includes(shard.state)) return false;
        if (!filteredSet.has(shard.index)) return false;
        return true;
      }),
    );
    const acc = filtered.reduce((acc, shard) => {
      const key = shard.node ?? UNASSIGNED_KEY;
      if (!acc[key]) acc[key] = [];
      acc[key].push(shard);
      return acc;
    }, {} as Record<string, ShardInfo[]>);
    return acc;
  }, [shards, filteredIndices, selectedShardStates]);

  // ── Layout ────────────────────────────────────────────────────────────────
  const layoutNodes = useMemo(() => {
    // Base layout from authoritative node list to keep node cards present and
    // stable while tile payloads arrive. We'll overlay tile-provided details
    // (shards, summaryCounts, isLoading) onto these base nodes when available.

    // Two-pass layout to preserve global shard totals for nodes that are
    // not covered by tile-provided nodes. The previous single boolean check
    // suppressed global totals whenever any tile nodes were present which
    // produced a mid-state where some nodes lost their shard totals while
    // other tiles were still loading. We compute a preliminary layout using
    // global shards to obtain stable positions, then decide per-node whether
    // to remove global shard totals for nodes covered by tiles (or skeletons),
    // and finally recompute the layout with the pruned shards map.

    // Preliminary layout using global shards so we can compute node positions
    const prelimLayout = calculateCanvasLayout({
      clusterNodes: filteredNodes,
      shardsByNode,
      groupingConfig,
      onNodeClick,
      onShardClick: onShardClick
        ? (shard: ShardInfo, event?: React.MouseEvent) => onShardClick(shard, event!)
        : undefined,
      relocationMode,
      validDestinationNodes,
      onDestinationClick,
      getIndexHealthColor,
    });

    // If no tile system is active yet, return the global-shards layout
    if (!visibleNodesFromTiles) return prelimLayout;

    // Build sets for tile-covered nodes (ids and names) and skeleton tile rects
    const tileNodeKeys = new Set<string>();
    const skeletonRects: Array<{ minx: number; miny: number; maxx: number; maxy: number }> = [];
    const tileSize = TOPOLOGY_CONFIG.TILE_SIZE;
    for (const tn of visibleNodesFromTiles) {
      const tid = (tn as any).id as string | undefined;
      if (typeof tid === 'string' && tid.startsWith('skeleton:')) {
        const parts = tid.split(':');
        const tx = Number(parts[1]);
        const ty = Number(parts[2]);
        const minx = tx * tileSize;
        const miny = ty * tileSize;
        const maxx = minx + tileSize;
        const maxy = miny + tileSize;
        skeletonRects.push({ minx, miny, maxx, maxy });
        continue;
      }

      // Normal tile node: try to extract id/name from data node payload
      const existing = (tn as any).data || {};
      const explicitNode = existing.node as Record<string, unknown> | undefined;
      if (explicitNode) {
        const nid = explicitNode.id as string | undefined;
        const nname = explicitNode.name as string | undefined;
        if (nid) tileNodeKeys.add(nid);
        if (nname) tileNodeKeys.add(nname);
      }
      // Also consider raw node fields on the tile node object itself
      const rawNodeId = (tn as any).id as string | undefined;
      const rawName = (tn as any).name as string | undefined;
      if (rawNodeId && !rawNodeId.startsWith('skeleton:')) tileNodeKeys.add(rawNodeId);
      if (rawName) tileNodeKeys.add(rawName);
    }

    // Build a per-node shards map that keeps global totals only for nodes not
    // covered by tiles (either explicit tile nodes or skeleton tile areas).
    const prunedShardsByNode: Record<string, ShardInfo[]> = {};
    for (const key of Object.keys(shardsByNode)) {
      const shardList = (shardsByNode as any)[key] as ShardInfo[];
      // Find the corresponding prelim layout node (by id or name) to check
      // for spatial overlap with skeleton rectangles.
      const mapped = (prelimLayout as any[]).find((bn: any) => (bn.id === key) || (bn.data && bn.data.node && bn.data.node.name === key));
      let covered = false;
      if (mapped) {
        // If tile explicitly provided this node (by id or name), mark covered
        const mappedId = mapped.id as string | undefined;
        const mappedName = mapped.data?.node?.name as string | undefined;
        if ((mappedId && tileNodeKeys.has(mappedId)) || (mappedName && tileNodeKeys.has(mappedName))) {
          covered = true;
        } else {
          // Check skeleton coverage
          const bx = (mapped.position?.x as number) ?? 0;
          const by = (mapped.position?.y as number) ?? 0;
          const bw = (mapped as any).width ?? estimateGroupMinWidth(((mapped as any).data?.node) || {});
          const bh = (mapped as any).height ?? 140;
          for (const r of skeletonRects) {
            if (!(bx + bw < r.minx || bx > r.maxx || by + bh < r.miny || by > r.maxy)) {
              covered = true;
              break;
            }
          }
        }
      } else {
        // If no mapping found, be conservative and keep global shards for this key
        covered = false;
      }

      if (!covered) prunedShardsByNode[key] = shardList;
    }

    // Recompute the authoritative base layout using the pruned shards map so
    // that only nodes covered by tiles will have their shard details suppressed.
    const baseLayout = calculateCanvasLayout({
      clusterNodes: filteredNodes,
      shardsByNode: prunedShardsByNode,
      groupingConfig,
      onNodeClick,
      onShardClick: onShardClick
        ? (shard: ShardInfo, event?: React.MouseEvent) => onShardClick(shard, event!)
        : undefined,
      relocationMode,
      validDestinationNodes,
      onDestinationClick,
      getIndexHealthColor,
    });

    // Build index by id/name for quick overlays
    const baseIndexByKey = new Map<string, number>();
    baseLayout.forEach((bn, idx) => {
      baseIndexByKey.set((bn as any).id, idx);
      const name = (bn as any).data?.node?.name as string | undefined;
      if (name) baseIndexByKey.set(name, idx);
    });

    // Reset isLoading flags
    baseLayout.forEach((bn) => {
      (bn as any).data = { ...(bn as any).data, isLoading: false };
    });

    // Apply overlays from tile-provided nodes, and map skeleton nodes to base nodes
    for (const tn of visibleNodesFromTiles) {
      const existing = (tn as any).data || {};

      // Special-case skeleton markers produced by TopologyController when a
      // subscribed tile is not yet cached. Id format: "skeleton:tx:ty"
      const tid = (tn as any).id as string | undefined;
      if (typeof tid === 'string' && tid.startsWith('skeleton:')) {
        const parts = tid.split(':');
        const tx = Number(parts[1]);
        const ty = Number(parts[2]);
        const minx = tx * tileSize;
        const miny = ty * tileSize;
        const maxx = minx + tileSize;
        const maxy = miny + tileSize;
        // Mark any base node overlapping this tile as loading so the card
        // shows shard skeletons instead of disappearing/reflowing.
        baseLayout.forEach((bn) => {
          const bx = (bn.position?.x as number) ?? 0;
          const by = (bn.position?.y as number) ?? 0;
          const bw = (bn as any).width ?? estimateGroupMinWidth(((bn as any).data?.node) || {});
          const bh = (bn as any).height ?? 140;
          if (!(bx + bw < minx || bx > maxx || by + bh < miny || by > maxy)) {
            (bn as any).data = { ...(bn as any).data, isLoading: true };
          }
        });
        continue;
      }

      // Normal tile-provided node: overlay into base layout if matching, else append
      const explicitNode = existing.node as Record<string, unknown> | undefined;
      const rawNode = existing.__raw as Record<string, unknown> | undefined;
      const nodeKey = explicitNode?.id ?? explicitNode?.name ?? (tn as any).id;
      const idx = nodeKey ? baseIndexByKey.get(String(nodeKey)) : undefined;
      if (idx !== undefined) {
        const target = baseLayout[idx] as any;
        // Start from existing target data so we preserve authoritative fields
        const merged: Record<string, unknown> = { ...(target.data || {}) };

        // Merge node-level overrides only when tile provides any node info
        if (rawNode || explicitNode) {
          merged.node = { ...(target.data?.node || {}), ...(rawNode || {}), ...(explicitNode || {}) };
        }

        // Only attach shards/summaryCounts if the tile explicitly provided them.
        // This avoids inserting `shards: undefined` which would cause the
        // ClusterESNodeCardFlowWrapper to treat the payload as a tile-shape and
        // reconstruct the flat data from the (often sparse) node object,
        // losing authoritative top-level metadata.
        if (existing && Object.prototype.hasOwnProperty.call(existing, 'shards') && existing.shards !== undefined) {
          merged.shards = existing.shards;
        }
        if (existing && Object.prototype.hasOwnProperty.call(existing, 'summaryCounts') && existing.summaryCounts !== undefined) {
          merged.summaryCounts = existing.summaryCounts;
        } else {
          // Fallback: if the tile did not explicitly provide summaryCounts, try
          // to use the global shardsByNode totals as a non-invasive fallback so
          // the node card still shows shard totals while tile-level details
          // are loading. We intentionally do NOT attach the full shards array
          // from global data (that would defeat lazy-loading), only the totals.
          try {
            const nodeId = (merged.node && (merged.node as any).id) ?? (merged.node && (merged.node as any).name) ?? (tn as any).id;
            const globalShards = (shardsByNode as any)[nodeId] ?? (merged.node && (shardsByNode as any)[(merged.node as any).name]);
            if (Array.isArray(globalShards) && globalShards.length > 0) {
              merged.summaryCounts = { primary: (globalShards as any[]).filter((s: any) => !!s.primary).length, replica: (globalShards as any[]).filter((s: any) => !s.primary).length, total: (globalShards as any[]).length };
            }
          } catch (_err) { void _err; }
        }

        // Preserve explicit isLoading only when tile signalled it; otherwise keep existing
        if (existing && Object.prototype.hasOwnProperty.call(existing, 'isLoading')) {
          merged.isLoading = (existing as any).isLoading;
        }

        merged.getIndexHealthColor = target.data?.getIndexHealthColor ?? getIndexHealthColor;
        merged.onNodeClick = target.data?.onNodeClick ?? existing?.onNodeClick ?? onNodeClick;
        merged.onShardClick = target.data?.onShardClick ?? existing?.onShardClick ?? onShardClick;
        merged.onDestinationClick = target.data?.onDestinationClick ?? existing?.onDestinationClick ?? onDestinationClick;

        target.data = merged;
      } else {
        const merged = { ...tn } as any;
        const explicit = (merged.data || {}).node || {};
        const minW = estimateGroupMinWidth(explicit as any);
        merged.width = minW;
        baseLayout.push(merged as any);
      }
    }

    return baseLayout as Node[];
  }, [filteredNodes, shardsByNode, groupingConfig, onNodeClick, onShardClick, relocationMode, validDestinationNodes, onDestinationClick, getIndexHealthColor, visibleNodesFromTiles]);
  // Debug: log whether layout nodes include onNodeClick handler in their data payloads
  console.debug(
    'CanvasTopologyView layoutNodes onNodeClick present?',
    layoutNodes.map(n => ({ id: n.id, onNodeClick: (n as any).data ? !!(n as any).data?.onNodeClick : undefined }))
  );
  // Maintain a serializable snapshot of user positions (stateful so reading is safe during render)
  const [userPositions, setUserPositions] = useState<{ [id: string]: { x: number; y: number } }>({});

  // Merge user-modified positions into the layout-generated nodes
  const layoutNodesWithUserPositions = useMemo(() => {
    return layoutNodes.map(node => {
      const userPos = userPositions[node.id];
      return userPos ? { ...node, position: userPos } : node;
    });
  }, [layoutNodes, userPositions]);

  // (loading early return moved earlier to keep hook order stable)

  // When node positions change via drag stop in Flow
  const handleNodesPositionChange = useCallback((positions: { [id: string]: { x: number; y: number } }) => {
    // Copy only current visible node IDs and update state
    const visibleNodeIds = new Set(layoutNodes.map(n => n.id));
    const merged: { [id: string]: { x: number; y: number } } = {};
    for (const [id, pos] of Object.entries(positions)) {
      if (visibleNodeIds.has(id)) merged[id] = pos;
    }
    setUserPositions(merged);
  }, [layoutNodes]);

  return (
    <Box
      h={600}
      style={{
        border: '1px solid var(--secan-surface-border-weak)',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      {showLoadingSkeleton ? (
        <Box p="md">
          <Skeleton height={180} radius="sm" mb="md" />
          <Skeleton height={180} radius="sm" mb="md" />
          <Skeleton height={180} radius="sm" />
        </Box>
      ) : (
        <ReactFlowProvider>
          <>
            <TopologyController onNodesUpdate={setVisibleNodesFromTiles} />
            <Flow 
              layoutNodes={layoutNodesWithUserPositions}
              onPaneClick={onPaneClick}
              onNodeDragStart={onNodeDragStart}
              onNodeDragStop={onNodeDragStop}
              onNodesPositionChange={handleNodesPositionChange}
            />
          </>
        </ReactFlowProvider>
      )}
    </Box>
  );
}
