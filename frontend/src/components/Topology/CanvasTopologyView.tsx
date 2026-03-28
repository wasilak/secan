import { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Text, Box, Skeleton } from '@mantine/core';
import { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import { CanvasNodeCard } from './CanvasNodeCard';
import { calculateNodeGroups, getGroupLabel, type GroupingConfig } from '../../utils/topologyGrouping';

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

const NODE_WIDTH = 280;
const NODE_HEIGHT = 180;
const HORIZONTAL_GAP = 50;
const VERTICAL_GAP = 30;
const COLUMN_WIDTH = NODE_WIDTH + HORIZONTAL_GAP;

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
  const indexHealthMap = useMemo(() => {
    const map = new Map<string, IndexInfo['health']>();
    indices.forEach((index) => {
      map.set(index.name, index.health);
    });
    return map;
  }, [indices]);

  const getIndexHealthColor = useCallback((indexName: string): string => {
    const health = indexHealthMap.get(indexName);
    switch (health) {
      case 'green':
        return 'var(--mantine-color-green-6)';
      case 'yellow':
        return 'var(--mantine-color-yellow-6)';
      case 'red':
        return 'var(--mantine-color-red-6)';
      default:
        return 'var(--mantine-color-gray-6)';
    }
  }, [indexHealthMap]);

  const filteredNodes = useMemo(() => {
    if (!matchesWildcard || !nodeNameFilter) return nodes;
    return nodes.filter(node => matchesWildcard(node.name, nodeNameFilter));
  }, [nodes, matchesWildcard, nodeNameFilter]);

  const shardsByNode = useMemo(() => {
    return shards.reduce((acc, shard) => {
      if (shard.node) {
        if (!acc[shard.node]) acc[shard.node] = [];
        acc[shard.node].push(shard);
      }
      return acc;
    }, {} as Record<string, ShardInfo[]>);
  }, [shards]);

  const flowNodes = useMemo(() => {
    if (filteredNodes.length === 0) return [];

    const result: Node[] = [];

    if (groupingConfig.attribute === 'none') {
      const sortedNodes = [...filteredNodes].sort((a, b) => {
        const aIsMaster = a.roles?.includes('master') ?? false;
        const bIsMaster = b.roles?.includes('master') ?? false;
        if (aIsMaster && !bIsMaster) return -1;
        if (!aIsMaster && bIsMaster) return 1;
        return a.name.localeCompare(b.name);
      });

      let masterColumnY = 0;
      let dataColumnY = 0;
      let otherColumnY = 0;

      sortedNodes.forEach((node) => {
        let column = 0;
        let y = 0;

        if (node.roles?.includes('master')) {
          column = 0;
          y = masterColumnY;
          masterColumnY += NODE_HEIGHT + VERTICAL_GAP;
        } else if (node.roles?.includes('ingest') || node.roles?.includes('ml')) {
          column = 2;
          y = otherColumnY;
          otherColumnY += NODE_HEIGHT + VERTICAL_GAP;
        } else {
          column = 1;
          y = dataColumnY;
          dataColumnY += NODE_HEIGHT + VERTICAL_GAP;
        }

        const nodeShards = shardsByNode[node.name] || shardsByNode[node.id] || [];
        const isValidDestination = relocationMode && validDestinationNodes?.some(
          (id) => id === node?.id || id === node?.name
        );

        result.push({
          id: node.id,
          type: 'clusterNode',
          position: { x: column * COLUMN_WIDTH, y },
          data: {
            node,
            shards: nodeShards,
            onNodeClick,
            onShardClick,
            isValidDestination,
            onDestinationClick,
            getIndexHealthColor,
          },
        });
      });
    } else {
      const nodeGroups = calculateNodeGroups(filteredNodes, groupingConfig);
      const groupEntries = Array.from(nodeGroups.entries());

      let groupColumnX = 0;
      const groupYs: number[] = [];

      groupEntries.forEach(([groupKey, groupNodes], groupIndex) => {
        const sortedGroupNodes = [...groupNodes].sort((a, b) => {
          const aIsMaster = a.roles?.includes('master') ?? false;
          const bIsMaster = b.roles?.includes('master') ?? false;
          if (aIsMaster && !bIsMaster) return -1;
          if (!aIsMaster && bIsMaster) return 1;
          return a.name.localeCompare(b.name);
        });

        let y = groupYs[groupIndex] || 0;

        sortedGroupNodes.forEach((node) => {
          const nodeShards = shardsByNode[node.name] || shardsByNode[node.id] || [];
          const isValidDestination = relocationMode && validDestinationNodes?.some(
            (id) => id === node?.id || id === node?.name
          );

          result.push({
            id: node.id,
            type: 'clusterNode',
            position: { x: groupColumnX, y },
            data: {
              node,
              shards: nodeShards,
              onNodeClick,
              onShardClick,
              isValidDestination,
              onDestinationClick,
              getIndexHealthColor,
              groupLabel: getGroupLabel(groupKey, groupingConfig.attribute),
            },
          });

          y += NODE_HEIGHT + VERTICAL_GAP;
        });

        groupYs[groupIndex] = y;
        groupColumnX += COLUMN_WIDTH;
      });
    }

    return result;
  }, [
    filteredNodes,
    shardsByNode,
    onNodeClick,
    onShardClick,
    relocationMode,
    validDestinationNodes,
    onDestinationClick,
    getIndexHealthColor,
    groupingConfig,
  ]);

  const nodeTypes: NodeTypes = {
    clusterNode: CanvasNodeCard,
  };

  // Show loading skeleton
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
    <Box h={600} style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
      <ReactFlow
        nodes={flowNodes}
        edges={[]}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={true}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        onPaneClick={onPaneClick}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--mantine-color-gray-4)" />
        <Controls showInteractive={false} />
        <MiniMap
          nodeColor={(node) => {
            return 'var(--mantine-color-blue-6)';
          }}
          nodeStrokeWidth={3}
          zoomable
          pannable
        />
      </ReactFlow>
    </Box>
  );
}
