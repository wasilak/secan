/* eslint-disable @typescript-eslint/no-explicit-any */
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  BackgroundVariant,
  useNodesInitialized,
  useReactFlow,
  useNodesState,
  useStore,
  applyNodeChanges,
  type NodeTypes,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../../styles/reactflow-overrides.css';
import { Box, Skeleton } from '@mantine/core';
import type { ShardInfo, IndexInfo, NodeInfo, NodeShardSummary } from '../../types/api';
import ClusterESNodeCardFlowWrapper from '../ClusterESNodeCardFlowWrapper';
import { GroupContainerNode } from './GroupContainerNode';
import { calculateCanvasLayout, CONTAINER_PADDING_BOTTOM, CONTAINER_PADDING_TOP, CONTAINER_PADDING_X, CONTAINER_VERTICAL_GAP, ESTIMATED_GROUP_HEIGHT, HORIZONTAL_GAP, UNASSIGNED_KEY, VERTICAL_GAP } from '../../utils/canvasLayout';
import { applyDagreLayout } from '../../utils/dagreLayout';
import { resolveCollisions } from '../../utils/resolveCollisions';
import type { GroupingConfig } from '../../utils/topologyGrouping';

// Defensive: if ClusterGroupNode failed to import for any reason, provide a
// fallback component so React doesn't throw an "Invalid element type" error
// which surfaces as the minified React error #310 in production.
const nodeTypes: NodeTypes = {
  clusterGroup: ClusterESNodeCardFlowWrapper,
  groupContainer: GroupContainerNode,
};

/** Zoom threshold above which full shard dots are rendered (L2). */
const L2_ZOOM_THRESHOLD = 0.7;

interface CanvasTopologyViewProps {
  onNodeDragStart?: () => void;
  onNodeDragStop?: () => void;
  nodes: NodeInfo[];
  /**
   * Per-node shard count summary from the lightweight shard-summary endpoint.
   * Used for badge totals at L0/L1 zoom. No full ShardInfo[] is needed here.
   */
  shardSummary?: NodeShardSummary[];
  /**
   * Full per-node shard arrays for L2 zoom (colored dots).
   * Only populated by the parent when zoom > L2_ZOOM_THRESHOLD.
   * Keeping this undefined at L0/L1 prevents OOM on large clusters.
   */
  allShards?: ShardInfo[];
  indices: IndexInfo[];
  searchParams: URLSearchParams;
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
  onNodeClick?: (nodeId: string) => void;
  onPaneClick?: () => void;
  /**
   * Called whenever the canvas zoom crosses the L2 threshold (0.7).
   * The parent uses this to gate expensive shard data fetching.
   */
  onZoomChange?: (zoom: number) => void;
  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  indexNameFilter?: string;
  nodeNameFilter?: string;
  /** Shard states to include in L2 dot rendering. Defaults to all states when omitted. */
  selectedShardStates?: string[];
  matchesWildcard?: (text: string, pattern: string) => boolean;
  /** Whether to show dot-prefixed (special) indices in L2 shard dot rendering. Defaults to false. */
  showSpecialIndices?: boolean;
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
  /** Called on every zoom change so parent can gate L2 shard fetching. */
  onZoomChange?: (zoom: number) => void;
  /**
   * When true, the layout positions from layoutNodes are already final
   * (e.g. grouped layout with RF parent nodes). Dagre re-layout and collision
   * resolution are skipped to avoid corrupting parent-relative child positions.
   */
  usePrecomputedLayout?: boolean;
}

function Flow({ layoutNodes, onPaneClick, onNodeDragStart, onNodeDragStop, onNodesPositionChange, onZoomChange, usePrecomputedLayout }: FlowProps) {
  const { fitView, getNodes } = useReactFlow();
  const initialized = useNodesInitialized();
  const hasFitViewRun = useRef(false);
  const isDraggingRef = useRef(false);
  const pendingLayoutRef = useRef<Node[] | null>(null);

  // Track zoom for LOD threshold crossings. Must be inside ReactFlowProvider boundary.
  const zoom = useStore((s) => s.transform[2]);
  useEffect(() => {
    onZoomChange?.(zoom);
  }, [zoom, onZoomChange]);

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
  const invalidRendererInfo = useMemo(() => {
    const problems: Array<{ nodeId?: string; nodeType?: string; renderer?: unknown; reason: string }> = [];
    Object.entries(safeNodeTypes as unknown as Record<string, unknown>).forEach(([k, v]) => {
      const ok = typeof v === 'function' || (v && typeof v === 'object' && '$$typeof' in v);
      if (!ok) problems.push({ nodeType: k, renderer: v, reason: 'invalid renderer type' });
    });
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

  // ── fitContainersToChildren ───────────────────────────────────────────────
  // Single-responsibility geometry-based autofit for grouped mode.
  //
  // Problem: RF's parentId only gives relative positioning — it NEVER auto-sizes
  // the parent around its children. The initial parent dimensions from canvasLayout
  // use hardcoded GROUP_WIDTH (width) and estimated heights. Both are wrong once RF
  // measures actual card dimensions (cards use `width: auto`, so they can be wider
  // than GROUP_WIDTH for long node names or many metric rows).
  //
  // Fix: After RF measures every child card, compute the exact bounding box of all
  // children (using measured.width + measured.height + position.x/y), then set the
  // parent's style.width/height to fully enclose them with the correct padding.
  //
  // Also normalises child vertical stack order so cards don't overlap (uses
  // measured.height instead of the estimated fallback).
  const fitContainersToChildren = useCallback(() => {
    const rfNodes = getNodes() as unknown as Array<Record<string, unknown>>;
    if (rfNodes.length === 0) return;

    // Build parent → children map, sorted by current y position
    const childrenByParent = new Map<string, Array<Record<string, unknown>>>();
    rfNodes.forEach((n) => {
      const pid = (n as any).parentId as string | undefined;
      if (!pid) return;
      if (!childrenByParent.has(pid)) childrenByParent.set(pid, []);
      childrenByParent.get(pid)!.push(n);
    });
    childrenByParent.forEach((children) => {
      children.sort((a, b) => ((a as any).position?.y ?? 0) - ((b as any).position?.y ?? 0));
    });

    let changed = false;

    // Pass 1: normalise child vertical stacking using measured heights.
    // Children start at CONTAINER_PADDING_TOP and are stacked with CONTAINER_VERTICAL_GAP.
    // All children share the same fixed x = CONTAINER_PADDING_X.
    const restack = rfNodes.map((n) => {
      const pid = (n as any).parentId as string | undefined;
      if (!pid) return n;

      const siblings = childrenByParent.get(pid) ?? [];
      const myIndex = siblings.findIndex((s) => (s.id as string) === ((n as Record<string, unknown>).id as string));
      if (myIndex < 0) return n;

      let newY = CONTAINER_PADDING_TOP;
      for (let i = 0; i < myIndex; i++) {
        const sibH = (siblings[i] as any).measured?.height as number | undefined;
        newY += (sibH ?? ESTIMATED_GROUP_HEIGHT) + CONTAINER_VERTICAL_GAP;
      }

      const currentY = (n as any).position?.y as number ?? 0;
      const currentX = (n as any).position?.x as number ?? 0;
      const newX = CONTAINER_PADDING_X;

      if (Math.abs(currentY - newY) > 1 || Math.abs(currentX - newX) > 1) {
        changed = true;
        // Update the node inside the map too so Pass 2 sees correct positions
        const updated = { ...n, position: { x: newX, y: newY } };
        siblings[myIndex] = updated;
        childrenByParent.set(pid, siblings);
        return updated;
      }
      return n;
    });

    // Pass 2: fit each groupContainer to the bounding box of its (now-restacked) children.
    // neededWidth  = CONTAINER_PADDING_X + max(child measured.width) + CONTAINER_PADDING_X
    // neededHeight = CONTAINER_PADDING_TOP + sum(child measured.height + gap) + CONTAINER_PADDING_BOTTOM
    const pass2 = restack.map((n) => {
      if ((n as any).type !== 'groupContainer') return n;
      const nodeId = (n as any).id as string;
      const children = childrenByParent.get(nodeId) ?? [];
      if (children.length === 0) return n;

      let maxChildWidth = 0;
      let contentHeight = 0;
      children.forEach((child, idx) => {
        const w = (child as any).measured?.width as number | undefined;
        const h = (child as any).measured?.height as number | undefined;
        if (w && w > maxChildWidth) maxChildWidth = w;
        contentHeight += h ?? ESTIMATED_GROUP_HEIGHT;
        if (idx < children.length - 1) contentHeight += CONTAINER_VERTICAL_GAP;
      });

      const neededWidth = maxChildWidth > 0
        ? CONTAINER_PADDING_X + maxChildWidth + CONTAINER_PADDING_X
        : ((n as any).style as { width?: number } | undefined)?.width ?? 0;
      const neededHeight = CONTAINER_PADDING_TOP + contentHeight + CONTAINER_PADDING_BOTTOM;

      const currentStyle = (n as any).style as { width?: number; height?: number } | undefined;
      const widthDiff = Math.abs((currentStyle?.width ?? 0) - neededWidth);
      const heightDiff = Math.abs((currentStyle?.height ?? 0) - neededHeight);

      if (widthDiff > 2 || heightDiff > 2) {
        changed = true;
        return { ...n, style: { ...(n as any).style, width: neededWidth, height: neededHeight } };
      }
      return n;
    });

    // Pass 3: re-grid parent groupContainer nodes so they don't overlap.
    //
    // After Pass 2, each parent has its correct size. But the initial x/y positions
    // from canvasLayout were computed with GROUP_WIDTH (estimated), so parents whose
    // actual width exceeded GROUP_WIDTH are now wider than the grid slots assumed.
    // We re-assign positions using a sqrt-based column count (matching canvasLayout)
    // and per-column/per-row max-size tracking so every container gets enough space.
    //
    // Sorting by (y, x) recovers the original row-column order regardless of size
    // changes — no infinite loop risk because child positions (relative to parent)
    // are unchanged, so childGeometryKey will not fire again.
    const updated = [...pass2];
    const parentContainers = pass2
      .filter((n) => (n as any).type === 'groupContainer')
      .sort((a, b) => {
        const ay = (a as any).position?.y ?? 0;
        const by_ = (b as any).position?.y ?? 0;
        if (Math.abs(ay - by_) > 50) return ay - by_;
        return ((a as any).position?.x ?? 0) - ((b as any).position?.x ?? 0);
      });

    if (parentContainers.length > 1) {
      const numCols = Math.ceil(Math.sqrt(parentContainers.length));
      const numRows = Math.ceil(parentContainers.length / numCols);

      const colWidths = new Array<number>(numCols).fill(0);
      const rowHeights = new Array<number>(numRows).fill(0);
      parentContainers.forEach((p, idx) => {
        const col = idx % numCols;
        const row = Math.floor(idx / numCols);
        const w = ((p as any).style as { width?: number } | undefined)?.width ?? 0;
        const h = ((p as any).style as { height?: number } | undefined)?.height ?? 0;
        if (w > colWidths[col]) colWidths[col] = w;
        if (h > rowHeights[row]) rowHeights[row] = h;
      });

      const colX: number[] = [0];
      for (let c = 1; c < numCols; c++) colX[c] = colX[c - 1] + colWidths[c - 1] + HORIZONTAL_GAP;

      const rowY: number[] = [0];
      for (let r = 1; r < numRows; r++) rowY[r] = rowY[r - 1] + rowHeights[r - 1] + VERTICAL_GAP;

      parentContainers.forEach((p, idx) => {
        const col = idx % numCols;
        const row = Math.floor(idx / numCols);
        const newX = colX[col];
        const newY = rowY[row];
        const currentX = (p as any).position?.x ?? 0;
        const currentY = (p as any).position?.y ?? 0;
        if (Math.abs(currentX - newX) > 1 || Math.abs(currentY - newY) > 1) {
          changed = true;
          const i = updated.findIndex((n) => (n as any).id === (p as any).id);
          if (i >= 0) updated[i] = { ...updated[i], position: { x: newX, y: newY } };
        }
      });
    }

    if (changed) {
      setFlowNodes(updated as unknown as Node[]);
      setTimeout(() => fitView({ padding: 0.2 }), 150);
    }
  }, [getNodes, setFlowNodes, fitView]);

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
      if (usePrecomputedLayout) {
        // Grouped layouts: positions are precomputed (RF parent-child coordinates).
        // Skip dagre to avoid corrupting parent-relative child positions.
        setFlowNodes(layoutNodes);
      } else {
        // No-grouping: apply dagre for consistent node distribution
        try {
          const dagreLayout = applyDagreLayout(layoutNodes, [], 'TB');
          setFlowNodes(dagreLayout.nodes);
        } catch (err) {
          // Fallback to raw layout if dagre fails
          console.warn('Dagre layout failed', err);
          setFlowNodes(layoutNodes);
        }
      }
    } else {
      pendingLayoutRef.current = layoutNodes;
    }
  }, [layoutNodes, setFlowNodes, usePrecomputedLayout]);

  // Collision resolving: wait for RF to measure node sizes, then nudge nodes
  // apart if they overlap. Mirrors IndexVisualizationFlow behavior.
  // Skipped for grouped layouts where positions are precomputed and RF
  // parent-child coordinates must not be touched.
  const layoutRunId = useRef(0);
  useEffect(() => {
    if (usePrecomputedLayout) return;

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
  }, [flowNodes, setFlowNodes, usePrecomputedLayout]);

  // ── useStore subscription: fit containers when any child geometry changes ────
  // Subscribes to RF's internal nodeLookup (Zustand store). The selector
  // returns a stable string that changes when ANY child node's measured size
  // OR position changes — covers all cases: initial load, zoom level change,
  // data refresh, grouping change.
  // Tracking width + height + position.x + position.y ensures the fit is
  // triggered even when only width changes (e.g. longer node names).
  const childGeometryKey = useStore((s) => {
    const parts: string[] = [];
    s.nodeLookup.forEach((node) => {
      if (node.parentId && node.measured?.width && node.measured?.height) {
        parts.push(
          `${node.id}:${node.parentId}:${node.position.x}:${node.position.y}:${node.measured.width}:${node.measured.height}`,
        );
      }
    });
    return parts.sort().join(',');
  });

  useEffect(() => {
    if (!usePrecomputedLayout || !childGeometryKey) return;
    fitContainersToChildren();
  }, [childGeometryKey, usePrecomputedLayout, fitContainersToChildren]);

  return (
    <ReactFlow
      className="secan-reactflow secan-canvas-topology-flow"
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
    </ReactFlow>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function CanvasTopologyView({
  onNodeDragStart,
  onNodeDragStop,
  nodes = [],
  shardSummary = [],
  allShards,
  indices = [],
  searchParams: _searchParams,
  onShardClick,
  onNodeClick,
  onPaneClick,
  onZoomChange,
  relocationMode,
  validDestinationNodes,
  onDestinationClick,
  indexNameFilter,
  nodeNameFilter,
  selectedShardStates,
  matchesWildcard,
  showSpecialIndices = false,
  isLoading = false,
  groupingConfig = { attribute: 'none', value: undefined },
}: CanvasTopologyViewProps) {
  const showLoadingSkeleton = isLoading && nodes.length === 0;

  // Track whether the canvas is at L2 zoom (> 0.7) for shard dot rendering.
  // State is updated via handleZoomChange which is called by Flow on every zoom tick.
  // Only triggers a re-render when the threshold is actually crossed.
  const [isL2, setIsL2] = useState(false);
  const isL2Ref = useRef(false);

  // Cache the count of unassigned shards from the most recent L2 visit.
  // allShards is undefined at L0/L1 (withheld by parent to prevent OOM), so we
  // remember the last known value and use it to show the Unassigned node badge
  // even after the user zooms back out.
  const [unassignedCountHint, setUnassignedCountHint] = useState(0);
  useEffect(() => {
    if (!allShards) return; // retain last known value when zoomed out
    const count = allShards.filter((s) => !s.node).length;
    setUnassignedCountHint(count);
  }, [allShards]);

  const handleZoomChange = useCallback((zoom: number) => {
    const newIsL2 = zoom > L2_ZOOM_THRESHOLD;
    if (newIsL2 !== isL2Ref.current) {
      isL2Ref.current = newIsL2;
      setIsL2(newIsL2);
      onZoomChange?.(zoom);
    }
  }, [onZoomChange]);

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

  // ── summaryByNode map (from lightweight shard-summary endpoint) ───────────
  // Maps nodeId → { primary, replica, unassigned, total } for badge display at L0/L1.
  // No full ShardInfo arrays are held in memory for the summary.
  const summaryByNode = useMemo(() => {
    const acc: Record<string, NodeShardSummary> = {};
    for (const summary of shardSummary) {
      acc[summary.nodeId] = summary;
      // Also index by nodeName for lookups where only name is available
      if (summary.nodeName !== summary.nodeId) {
        acc[summary.nodeName] = summary;
      }
    }
    // Inject synthetic entry for the Unassigned pseudo-node so that the
    // post-processing step in layoutNodes can populate its badge even at
    // L0/L1 zoom (where shardsByNode[UNASSIGNED_KEY] is empty).
    // The hint is 0 until the user visits L2 for the first time — in that
    // case the node simply won't appear (no data yet), which is fine.
    if (unassignedCountHint > 0) {
      acc[UNASSIGNED_KEY] = {
        nodeId: UNASSIGNED_KEY,
        nodeName: 'Unassigned',
        primary: 0,
        replica: 0,
        unassigned: unassignedCountHint,
        total: unassignedCountHint,
      };
    }
    return acc;
  }, [shardSummary, unassignedCountHint]);

  // ── Layout ────────────────────────────────────────────────────────────────
  const layoutNodes = useMemo(() => {
    // At L2 zoom with full shard data available, build shardsByNode for dot rendering.
    // Apply index name filter and shard state filter so only matching shards are shown.
    // Nodes are never hidden by these filters — a node with no matching shards still
    // renders its card, just without dots.
    const shardsByNode: Record<string, ShardInfo[]> = {};
    if (isL2 && allShards && allShards.length > 0) {
      for (const shard of allShards) {
        const nodeKey = shard.node ?? UNASSIGNED_KEY;
        // Apply shard state filter (skip if state not in selectedShardStates)
        if (selectedShardStates && selectedShardStates.length > 0 && !selectedShardStates.includes(shard.state)) continue;
        // Apply special-index filter (hide dot-prefixed indices unless showSpecialIndices is true)
        if (!showSpecialIndices && shard.index.startsWith('.')) continue;
        // Apply index name filter
        if (indexNameFilter && matchesWildcard && !matchesWildcard(shard.index, indexNameFilter)) continue;
        if (!shardsByNode[nodeKey]) shardsByNode[nodeKey] = [];
        shardsByNode[nodeKey].push(shard);
      }
    }

    const baseLayout = calculateCanvasLayout({
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
      unassignedShardsHint: unassignedCountHint,
    });

    // Apply summary badge counts from the lightweight endpoint.
    // At L0/L1: shardsByNode is empty so calculateCanvasLayout produces zero counts —
    //   override with summaryByNode to show correct totals.
    // At L2: calculateCanvasLayout computes correct counts from full shards —
    //   only apply summaryByNode when a node has no shard data (e.g. still loading).
    baseLayout.forEach((bn) => {
      const nodeId = (bn as any).id as string | undefined;
      const nodeName = (bn as any).data?.name as string | undefined;
      const existing = (bn as any).data?.summaryCounts as { total?: number } | undefined;
      // Skip if calculateCanvasLayout already set non-zero counts from real shards
      if (existing && (existing.total ?? 0) > 0) return;
      const summary = (nodeId && summaryByNode[nodeId]) ?? (nodeName && summaryByNode[nodeName]);
      if (summary) {
        (bn as any).data = {
          ...(bn as any).data,
          summaryCounts: { primary: summary.primary, replica: summary.replica, total: summary.total },
        };
      }
    });

    return baseLayout;
  }, [filteredNodes, summaryByNode, isL2, allShards, selectedShardStates, showSpecialIndices, indexNameFilter, matchesWildcard, groupingConfig, onNodeClick, onShardClick, relocationMode, validDestinationNodes, onDestinationClick, getIndexHealthColor, unassignedCountHint]);

  // Maintain a serializable snapshot of user positions (stateful so reading is safe during render)
  const [userPositions, setUserPositions] = useState<{ [id: string]: { x: number; y: number } }>({});

  // Merge user-modified positions into the layout-generated nodes
  const layoutNodesWithUserPositions = useMemo(() => {
    return layoutNodes.map(node => {
      const userPos = userPositions[node.id];
      return userPos ? { ...node, position: userPos } : node;
    });
  }, [layoutNodes, userPositions]);

  // When node positions change via drag stop in Flow
  const handleNodesPositionChange = useCallback((positions: { [id: string]: { x: number; y: number } }) => {
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
          <Flow
            layoutNodes={layoutNodesWithUserPositions}
            onPaneClick={onPaneClick}
            onNodeDragStart={onNodeDragStart}
            onNodeDragStop={onNodeDragStop}
            onNodesPositionChange={handleNodesPositionChange}
            onZoomChange={handleZoomChange}
            usePrecomputedLayout={groupingConfig.attribute !== 'none'}
          />
        </ReactFlowProvider>
      )}
    </Box>
  );
}
