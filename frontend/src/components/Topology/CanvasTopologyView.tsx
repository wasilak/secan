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
import { calculateCanvasLayout, UNASSIGNED_KEY } from '../../utils/canvasLayout';
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
    if (visibleNodesFromTiles) {
      // Use nodes produced by tile system when available; inject index health helper
      // so downstream wrappers (ClusterESNodeCardFlowWrapper) can color shard dots
      return visibleNodesFromTiles.map((n) => ({
        ...n,
        data: { ...(n as any).data, getIndexHealthColor },
      } as any));
    }
    return calculateCanvasLayout({
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
