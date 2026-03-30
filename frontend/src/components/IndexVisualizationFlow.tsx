import { useMemo, useEffect } from 'react';
import { useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import '../styles/reactflow-overrides.css';
import { Box, Loader, Alert, Center, Button, Group } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ShardInfo } from '../types/api';
import { ApiClientError } from '../types/api';
import ClusterESNodeCardFlowWrapper from './ClusterESNodeCardFlowWrapper';
// getHealthColorValue not needed here
import { useIndexShardsWithNodes } from '../hooks/useIndexShardsWithNodes';
import { calculateIndexVizLayout } from '../utils/indexVisualizationLayout';
import { applyDagreLayout } from '../utils/dagreLayout';
import { resolveCollisions } from '../utils/resolveCollisions';
import IndexGroupNodeFlowWrapper from './IndexGroupNodeFlowWrapper';
// import { ClusterGroupNode } from './Topology/ClusterGroupNode';
// import { ShardNode } from './Topology/ShardNode';

// nodeTypes must be defined outside the component for a stable reference —
// RF re-registers types (and breaks the MiniMap) when this object changes.
// Use the same 'clusterGroup' renderer as the topology canvas so Index
// Visualization reuses the exact same node renderer (ClusterESNodeCardFlowWrapper).
const nodeTypes: NodeTypes = {
  indexGroup: IndexGroupNodeFlowWrapper as any,
  clusterGroup: ClusterESNodeCardFlowWrapper,
};

interface IndexVisualizationFlowProps {
  clusterId: string;
  indexName: string;
  onShardClick?: (shard: ShardInfo) => void;
  refreshInterval?: number;
}

/**
 * IndexVisualizationFlow — RF-based replacement for IndexVisualization.
 *
 * Renders a 3-level hierarchy:
 *   index group  →  per-ES-node sub-groups  →  shard leaf nodes
 *
 * Includes native RF Controls + MiniMap + Background only.
 * No export buttons, no node search, no "APM-Style Layout" badge.
 *
 * Requirements: 3.1–3.8, 4.1, 4.4, 4.5
 */
export function IndexVisualizationFlow({
  clusterId,
  indexName,
  onShardClick,
  refreshInterval,
}: IndexVisualizationFlowProps) {
  const { data: paginated, isLoading, error, refetch } = useIndexShardsWithNodes(
    clusterId,
    indexName,
    refreshInterval ?? 30000,
  );

  const shards = paginated?.items ?? [];
  const nodes = paginated?.nodes ?? [];

  // Compute layout whenever shard or node data (or callbacks) change.
  const [layout, layoutError] = useMemo(() => {
    try {
      const rawLayout = calculateIndexVizLayout({
        indexName,
        shards: shards ?? [],
        nodes: nodes ?? [],
        onShardClick,
      });
      // Pass through dagre layout for vertical (TB) arrangement
      const dagreLayout = applyDagreLayout(rawLayout.nodes, rawLayout.edges, 'TB');
      // Log the nodes and edges for debugging
      // eslint-disable-next-line no-console
      console.log('IndexVizLayout:', dagreLayout.nodes, dagreLayout.edges);
      return [dagreLayout, undefined] as const;
    } catch (err) {
      return [
        { nodes: [], edges: [] },
        err instanceof Error ? err : new Error(String(err)),
      ] as const;
    }
  }, [indexName, shards, nodes, onShardClick]);

  // applyDagreLayout may return readonly arrays; ensure we pass mutable copies
  const [flowNodes, setNodes, onNodesChange] = useNodesState(layout.nodes as any as any[]);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(layout.edges as any as any[]);

  // Sync RF state on every layout change (data refresh / filter change).
  useEffect(() => {
    setNodes(layout.nodes as any as any[]);
    setEdges(layout.edges as any as any[]);
  }, [layout, setNodes, setEdges]);

  // Collision resolving: wait for RF to measure node sizes, then nudge nodes
  // apart if they overlap. Use a ref to avoid racing updates when layout
  // changes rapidly.
  const layoutRunId = useRef(0);
  useEffect(() => {
    layoutRunId.current += 1;
    const runId = layoutRunId.current;
    let cancelled = false;

      const attemptResolve = () => {
        // If nodes haven't been measured yet, retry on next frame
        const nodesArr = (flowNodes as any[]) || [];
        if (nodesArr.length === 0) return;
        const measuredReady = nodesArr.every((n) => !!n.measured && n.measured.width > 0 && n.measured.height > 0);
        if (!measuredReady) {
          requestAnimationFrame(attemptResolve);
          return;
        }

        // Update RF node width/height to measured DOM dimensions so subsequent
        // collision resolution and any downstream logic use the real sizes.
        const measuredNodes = nodesArr.map((n) => {
          if (!n.measured) return n;
          const w = n.measured.width;
          const h = n.measured.height;
          // Only update if dimensions differ to avoid pointless state churn
          if (n.width === w && n.height === h) return n;
          return { ...n, width: w, height: h };
        });

        // Run resolver with a small margin to avoid any touching borders
        const resolved = resolveCollisions(measuredNodes, { margin: 12, overlapThreshold: 0.5, maxIterations: 1000 });

        if (!cancelled && runId === layoutRunId.current) {
          setNodes(resolved as any);
          // Force edges to re-evaluate their paths after node sizes/positions
          // changed. Cloning the edges objects causes React Flow to recompute
          // edge paths based on the updated node geometry.
          setEdges((prev) => prev.map((e) => ({ ...e })));
        }
      };

    requestAnimationFrame(attemptResolve);
    return () => { cancelled = true; };
  }, [flowNodes, setNodes]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !paginated) {
    return (
      <Center h={600}>
        <Loader size="lg" />
      </Center>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error || layoutError) {
    const err = (error ?? layoutError) as unknown;

    // If the error comes from ApiClient, surface actionable messaging for
    // node-metadata related failures that the backend intentionally returns
    // (eg. `nodes_missing`, `nodes_info_failed`, `nodes_stats_failed`).
    if (err instanceof ApiClientError) {
      const payload = err.error;
      const code = payload?.error;
      const message = payload?.message ?? err.message;

      if (code === 'nodes_missing' || code === 'nodes_info_failed' || code === 'nodes_stats_failed') {
        return (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            title={
              code === 'nodes_missing'
                ? 'Cannot render index visualization — missing node metadata'
                : 'Cannot render index visualization — node metadata fetch failed'
            }
            mt="md"
          >
            <div style={{ marginBottom: 12 }}>{message}</div>
            <Group justify="flex-end">
              <Button onClick={() => refetch()} size="sm">
                Retry
              </Button>
            </Group>
          </Alert>
        );
      }
    }

    // Fallback generic error (layout errors, unexpected API errors)
    const message =
      layoutError instanceof Error ? layoutError.message :
      error instanceof Error ? error.message :
      (err && typeof err === 'object' && (err as any).message) || 'Unknown error';

    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="red"
        title="Failed to load shard layout"
        mt="md"
      >
        {message}
      </Alert>
    );
  }

  return (
    <Box
      h={600}
      style={{
        border: '1px solid var(--secan-surface-border-weak)',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      {paginated && paginated.nodes.length === 0 && paginated.items.length > 0 && (
        <Alert
          icon={<IconAlertCircle size={16} />}
          color="yellow"
          title="Node metadata unavailable"
          mt="md"
        >
          Authoritative node metrics are currently unavailable for this page — layout may be incomplete.
        </Alert>
      )}

      <ReactFlow className="secan-reactflow"
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        defaultEdgeOptions={{ type: 'simplebezier' }}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.05}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}

      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--secan-rf-edge-color)"
        />
        <Controls showInteractive={false} />
        {/* MiniMap intentionally hidden in Index Visualization to reduce clutter */}
      </ReactFlow>
    </Box>
  );
}
