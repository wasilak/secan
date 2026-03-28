import { useMemo, useCallback, useEffect } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useNodesState,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Box, Skeleton } from '@mantine/core';
import type { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import { ClusterGroupNode } from './ClusterGroupNode';
import { ShardNode } from './ShardNode';
import { calculateCanvasLayout } from '../../utils/canvasLayout';
import { sortShards } from '../../utils/shardOrdering';
import type { GroupingConfig } from '../../utils/topologyGrouping';

// nodeTypes must be stable (outside component) so RF doesn't re-register on
// every render — especially important for the MiniMap renderer.
const nodeTypes: NodeTypes = {
  clusterGroup: ClusterGroupNode,
  shardNode: ShardNode,
};

interface CanvasTopologyViewProps {
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

export function CanvasTopologyView({
  nodes,
  shards,
  indices,
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

  // ── shardsByNode map (mirror DotBasedTopologyView) ────────────────────────
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
    return filtered.reduce(
      (acc, shard) => {
        if (shard.node) {
          if (!acc[shard.node]) acc[shard.node] = [];
          acc[shard.node].push(shard);
        }
        return acc;
      },
      {} as Record<string, ShardInfo[]>,
    );
  }, [shards, filteredIndices, selectedShardStates]);

  // ── Layout ────────────────────────────────────────────────────────────────
  const layoutNodes = useMemo(
    () =>
      calculateCanvasLayout({
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
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      filteredNodes,
      shardsByNode,
      groupingConfig,
      onNodeClick,
      onShardClick,
      relocationMode,
      validDestinationNodes,
      onDestinationClick,
      getIndexHealthColor,
    ],
  );

  const [flowNodes, setNodes, onNodesChange] = useNodesState(layoutNodes);

  // Reset RF state whenever layout output changes (filter/data change).
  useEffect(() => {
    setNodes(layoutNodes);
  }, [layoutNodes, setNodes]);

  // ── Loading skeleton ──────────────────────────────────────────────────────
  if (isLoading && nodes.length === 0) {
    return (
      <Box p="md">
        <Skeleton height={180} radius="sm" mb="md" />
        <Skeleton height={180} radius="sm" mb="md" />
        <Skeleton height={180} radius="sm" />
      </Box>
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
        edges={[]}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
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
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </Box>
  );
}
