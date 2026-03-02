import { useMemo, useCallback } from 'react';
import { Grid, Paper, Text, Tooltip, Flex, Box, Badge, Group, Divider } from '@mantine/core';
import { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import { UnassignedShardsRow } from './UnassignedShardsRow';
import { RoleIcons } from '../RoleIcons';
import { getOrCreateIndexColors } from '../../utils/topologyColors';

/**
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
}

/**
 * DotBasedTopologyView Component
 *
 * Visual cluster overview showing all nodes with shard squares.
 * Each square represents ONE shard, colored by index health.
 * Clean, minimal design for at-a-glance cluster health assessment.
 *
 * Uses SHARED relocation state from parent - relocation can be started
 * in this view or Index View, and both will show the same state.
 */
export function DotBasedTopologyView({
  nodes,
  shards,
  indices,
  searchParams,
  onShardClick,
  relocationMode,
  validDestinationNodes,
  onDestinationClick,
  indexNameFilter,
  nodeNameFilter,
  matchesWildcard,
}: {
  nodes: NodeInfo[];
  shards: ShardInfo[];
  indices: IndexInfo[];
  searchParams: URLSearchParams;
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  indexNameFilter?: string;
  nodeNameFilter?: string;
  matchesWildcard?: (text: string, pattern: string) => boolean;
}) {
  // Read filter state from URL params
  const SHARD_STATES = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;
  const selectedStatesParam = searchParams.get('shardStates');
  const selectedShardStates = selectedStatesParam
    ? selectedStatesParam.split(',').filter(Boolean)
    : Array.from(SHARD_STATES);

  const showClosed = searchParams.get('showClosed') === 'true';
  const showSpecial = searchParams.get('showSpecial') === 'true';
  const showOnlyAffected = searchParams.get('overviewAffected') === 'true';

  // Apply wildcard filters
  const filteredNodes = useMemo(() => {
    if (!nodeNameFilter || !matchesWildcard) return nodes;
    return nodes.filter(node => matchesWildcard(node.name, nodeNameFilter));
  }, [nodes, nodeNameFilter, matchesWildcard]);

  const filteredIndices = useMemo(() => {
    if (!indexNameFilter || !matchesWildcard) return indices;
    return indices.filter(index => matchesWildcard(index.name, indexNameFilter));
  }, [indices, indexNameFilter, matchesWildcard]);

  // Create index health lookup map
  const indexHealthMap = useMemo(() => {
    const map = new Map<string, IndexInfo['health']>();
    indices.forEach((index) => {
      map.set(index.name, index.health);
    });
    return map;
  }, [indices]);

  // Get index health color
  const getIndexHealthColor = useCallback((indexName: string): string => {
    const health = indexHealthMap.get(indexName);
    switch (health) {
      case 'green': return 'var(--mantine-color-green-6)';
      case 'yellow': return 'var(--mantine-color-yellow-6)';
      case 'red': return 'var(--mantine-color-red-6)';
      default: return 'var(--mantine-color-gray-6)';
    }
  }, [indexHealthMap]);

  // Filter indices (EXACTLY matching ShardAllocationGrid logic)
  const filteredIndicesList = useMemo(() => {
    return filteredIndices.filter((index) => {
      const isClosed = index.status !== 'open';
      const isSpecial = index.name.startsWith('.');
      
      // Apply filters - if filter is OFF, hide those indices
      if (isClosed && !showClosed) return false;
      if (isSpecial && !showSpecial) return false;
      
      return true;
    });
  }, [filteredIndices, showClosed, showSpecial]);

  // Filter shards (EXACTLY matching ShardAllocationGrid logic)
  const filteredShards = useMemo(() => {
    return shards.filter((shard) => {
      // Filter by shard state
      if (!selectedShardStates.includes(shard.state)) return false;
      
      // Filter by index (closed/special/search)
      if (!filteredIndicesList.find((i) => i.name === shard.index)) return false;
      
      // Filter by affected (unassigned only)
      if (showOnlyAffected && shard.state !== 'UNASSIGNED') return false;
      
      return true;
    });
  }, [shards, selectedShardStates, filteredIndicesList, showOnlyAffected]);

  // Separate assigned and unassigned shards BEFORE grouping by node
  const assignedShards = useMemo(() => {
    return filteredShards.filter((s) => s.node && s.state !== 'UNASSIGNED');
  }, [filteredShards]);
  
  const unassignedShards = useMemo(() => {
    return filteredShards.filter((s) => !s.node || s.state === 'UNASSIGNED');
  }, [filteredShards]);

  // Group assigned shards by node
  const shardsByNode = useMemo(() => {
    return assignedShards.reduce((acc: Record<string, ShardInfo[]>, shard) => {
      const nodeName = shard.node!;
      if (!acc[nodeName]) acc[nodeName] = [];
      acc[nodeName].push(shard);
      return acc;
    }, {} as Record<string, ShardInfo[]>);
  }, [assignedShards]);

  if (filteredNodes.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="xl">
        No nodes available
      </Text>
    );
  }

  return (
    <div>
      {/* Nodes Grid */}
      <Grid gutter="md">
        {Object.entries(shardsByNode).map(([nodeName, nodeShards]) => {
          const node = filteredNodes.find((n) => n.name === nodeName || n.id === nodeName);
          if (!node) return null;
          const isValidDestination = relocationMode && validDestinationNodes?.some(
            (id) => id === node?.id || id === node?.name
          );
          
          return (
            <Grid.Col span={{ base: 12, sm: 6, lg: 4, xl: 3 }} key={nodeName}>
              <Paper
                shadow="xs"
                p="md"
                withBorder
                style={{
                  borderColor: isValidDestination
                    ? 'var(--mantine-color-violet-6)'
                    : undefined,
                  borderStyle: isValidDestination
                    ? 'dashed'
                    : undefined,
                  borderWidth: isValidDestination
                    ? '2px'
                    : undefined,
                  cursor: isValidDestination
                    ? 'pointer'
                    : 'default',
                }}
                onClick={() => {
                  if (isValidDestination && onDestinationClick) {
                    onDestinationClick(node.id);
                  }
                }}
              >
                {/* Upper Part: Node Information */}
                <Group gap="xs" wrap="nowrap" mb="xs">
                  <Text fw={600} size="sm" style={{ flex: 1 }} truncate>
                    {nodeName}
                  </Text>
                  {node?.isMaster && (
                    <Badge size="xs" variant="filled" color="blue">
                      Master
                    </Badge>
                  )}
                  {node && <RoleIcons roles={node.roles || []} size={14} />}
                </Group>
                
                {/* Node Stats */}
                <Group gap="xs" mb="xs" wrap="nowrap">
                  {node?.heapUsed && (
                    <Text size="xs" c="dimmed">
                      Heap: {(node.heapUsed / 1024 / 1024 / 1024).toFixed(1)}GB
                    </Text>
                  )}
                  {node?.diskUsed && (
                    <Text size="xs" c="dimmed">
                      Disk: {(node.diskUsed / 1024 / 1024 / 1024).toFixed(1)}GB
                    </Text>
                  )}
                </Group>
                
                <Divider mb="xs" />
                
                {/* Lower Part: Shard Dots */}
                <Flex wrap="wrap" gap={2}>
                  {nodeShards.map((shard, idx) => {
                    const color = getIndexHealthColor(shard.index);
                    
                    return (
                      <Tooltip
                        key={idx}
                        label={
                          <div style={{ whiteSpace: 'pre-line', fontSize: 'var(--mantine-font-size-xs)' }}>
                            <Text size="xs" fw={600} mb={4}>
                              {shard.index}[{shard.shard}]
                            </Text>
                            <Text size="xs">Type: {shard.primary ? 'Primary' : 'Replica'}</Text>
                            <Text size="xs">State: {shard.state}</Text>
                            {shard.docs !== undefined && shard.docs !== null && (
                              <Text size="xs">Docs: {shard.docs.toLocaleString()}</Text>
                            )}
                            {shard.store !== undefined && shard.store !== null && (
                              <Text size="xs">Size: {formatBytes(shard.store)}</Text>
                            )}
                          </div>
                        }
                        position="top"
                        withArrow
                      >
                        <Box
                          w={10}
                          h={10}
                          bg={color}
                          style={{
                            borderRadius: 2,
                            cursor: onShardClick ? 'pointer' : 'default',
                            transition: 'transform 0.15s ease',
                          }}
                          onClick={(e) => onShardClick?.(shard, e)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.transform = 'scale(1.5)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = 'scale(1)';
                          }}
                        />
                      </Tooltip>
                    );
                  })}
                </Flex>
              </Paper>
            </Grid.Col>
          );
        })}
      </Grid>

      {/* Unassigned Shards */}
      {unassignedShards.length > 0 && (
        <UnassignedShardsRow
          shards={unassignedShards}
          indexColors={getOrCreateIndexColors(filteredIndicesList.map(i => i.name))}
          onShardClick={(shardId) => {
            const shard = unassignedShards.find(s => `${s.index}[${s.shard}]` === shardId);
            if (shard && onShardClick) {
              onShardClick(shard, {} as React.MouseEvent);
            }
          }}
        />
      )}

      {/* Summary */}
      <Group gap="md" mt="md">
        <Text size="sm" c="dimmed">
          <Text component="span" fw={600}>{Object.keys(shardsByNode).length}</Text> / {filteredNodes.filter((n) => n.roles?.includes('data')).length} data nodes
        </Text>
        <Text size="sm" c="dimmed">
          <Text component="span" fw={600}>{assignedShards.length}</Text> assigned shards
        </Text>
        {unassignedShards.length > 0 && (
          <Text size="sm" c="red">
            <Text component="span" fw={600}>{unassignedShards.length}</Text> unassigned
          </Text>
        )}
      </Group>
    </div>
  );
}
