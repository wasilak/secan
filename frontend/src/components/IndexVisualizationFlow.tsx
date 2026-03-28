import { useMemo, useEffect } from 'react';
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
import { Box, Loader, Alert, Center } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ShardInfo } from '../types/api';
import { useIndexShards } from '../hooks/useIndexShards';
import { calculateIndexVizLayout } from '../utils/indexVisualizationLayout';
import { IndexGroupNode } from './IndexGroupNode';
import { IndexNodeSubGroup } from './IndexNodeSubGroup';
import { ShardNode } from './Topology/ShardNode';

// nodeTypes must be defined outside the component for a stable reference —
// RF re-registers types (and breaks the MiniMap) when this object changes.
const nodeTypes: NodeTypes = {
  indexGroup:   IndexGroupNode,
  nodeSubGroup: IndexNodeSubGroup,
  shardNode:    ShardNode,
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
  const { data: shards, isLoading, error } = useIndexShards(
    clusterId,
    indexName,
    refreshInterval ?? 30000,
  );

  // Compute layout whenever shard data or callbacks change.
  const layout = useMemo(
    () =>
      calculateIndexVizLayout({
        indexName,
        shards: shards ?? [],
        onShardClick,
      }),
    [indexName, shards, onShardClick],
  );

  const [flowNodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState(layout.edges);

  // Sync RF state on every layout change (data refresh / filter change).
  useEffect(() => {
    setNodes(layout.nodes);
    setEdges(layout.edges);
  }, [layout, setNodes, setEdges]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !shards) {
    return (
      <Center h={600}>
        <Loader size="lg" />
      </Center>
    );
  }

  // ── Error ─────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <Alert
        icon={<IconAlertCircle size={16} />}
        color="red"
        title="Failed to load shard data"
        mt="md"
      >
        {error instanceof Error ? error.message : 'Unknown error'}
      </Alert>
    );
  }

  return (
    <Box
      h={600}
      style={{
        border: '1px solid var(--mantine-color-gray-3)',
        borderRadius: 'var(--mantine-radius-sm)',
      }}
    >
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
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
          color="var(--mantine-color-gray-4)"
        />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </Box>
  );
}
