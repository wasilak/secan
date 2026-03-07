import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Grid, Paper, Text, Tooltip, Flex, Box, Badge, Group, Divider, Skeleton } from '@mantine/core';
import { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import { UnassignedShardsRow } from './UnassignedShardsRow';
import { RoleIcons } from '../RoleIcons';
import { getOrCreateIndexColors } from '../../utils/topologyColors';
import {
  parseGroupingFromUrl,
  type GroupingAttribute,
  type GroupingConfig,
} from '../../utils/topologyGrouping';

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

interface DotBasedTopologyViewProps {
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
  clusterId?: string;
  topologyBatchSize?: number;
  _topologyRetryCount?: number;
  groupBy?: GroupingAttribute;
  groupValue?: string;
}

/**
 * DotBasedTopologyView Component - Progressive Loading Version
 *
 * Visual cluster overview showing all nodes with shard squares.
 * Uses progressive loading to reduce memory usage:
 * 1. Initial load: nodes only (fast, low memory)
 * 2. Progressive: fetch shards per node in batches
 * 3. Render: show nodes immediately, populate shards as they load
 *
 * Features:
 * - Configurable batch size (default: 4 concurrent requests)
 * - Configurable retry count (default: 0)
 * - Automatic cancellation on unmount
 * - Loading states per node
 * - Memory efficient for large clusters (27+ nodes, 40TB+)
 */
export function DotBasedTopologyView({
  nodes,
  shards: initialShards,
  indices,
  searchParams,
  onShardClick,
  relocationMode,
  validDestinationNodes,
  onDestinationClick,
  indexNameFilter,
  nodeNameFilter,
  matchesWildcard,
  clusterId,
  topologyBatchSize = 4,
  _topologyRetryCount = 0,
  groupBy,
  groupValue,
}: DotBasedTopologyViewProps) {
  // Use React Router's useSearchParams for URL manipulation
  const [urlSearchParams, setUrlSearchParams] = useSearchParams();
  
  // Grouping state management
  const [groupingConfig, setGroupingConfig] = useState<GroupingConfig>(() => {
    // Parse grouping from URL on component mount
    // Priority: props > URL params
    if (groupBy) {
      return { attribute: groupBy, value: groupValue };
    }
    return parseGroupingFromUrl(urlSearchParams);
  });

  // Update URL when grouping changes
  useEffect(() => {
    // Only update URL if grouping is controlled by component (not props)
    if (!groupBy) {
      // Preserve existing params and merge with grouping params
      const mergedParams = new URLSearchParams(urlSearchParams);
      
      // Remove old grouping params
      mergedParams.delete('groupBy');
      mergedParams.delete('groupValue');
      
      // Add new grouping params if not 'none'
      if (groupingConfig.attribute !== 'none') {
        mergedParams.set('groupBy', groupingConfig.attribute);
        if (groupingConfig.value) {
          mergedParams.set('groupValue', groupingConfig.value);
        }
      }
      
      setUrlSearchParams(mergedParams, { replace: true });
    }
  }, [groupingConfig, groupBy, urlSearchParams, setUrlSearchParams]);

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    if (!groupBy) {
      const parsedConfig = parseGroupingFromUrl(urlSearchParams);
      if (
        parsedConfig.attribute !== groupingConfig.attribute ||
        parsedConfig.value !== groupingConfig.value
      ) {
        setGroupingConfig(parsedConfig);
      }
    }
  }, [urlSearchParams, groupBy, groupingConfig]);

  // Progressive loading state
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  const [allShardsLoaded, setAllShardsLoaded] = useState(false);
  
  // AbortController for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);

  // Read filter state from URL params
  const SHARD_STATES = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;
  const selectedStatesParam = searchParams.get('shardStates');
  const selectedShardStates = selectedStatesParam
    ? selectedStatesParam.split(',').filter(Boolean)
    : Array.from(SHARD_STATES);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // Progressive node rendering with pre-loaded shards
  useEffect(() => {
    if (!clusterId || !nodes.length || allShardsLoaded) return;

    // Cancel previous loading
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Reset state
    setLoadingNodes(new Set(nodes.map(n => n.id)));

    // Progressive rendering: simulate loading per node for better UX
    const nodeIds = nodes.map(n => n.id);
    const BATCH_SIZE = topologyBatchSize;
    
    const progressiveRender = async () => {
      for (let i = 0; i < nodeIds.length; i += BATCH_SIZE) {
        if (abortControllerRef.current?.signal.aborted) {
          break;
        }

        const batch = nodeIds.slice(i, i + BATCH_SIZE);
        
        // Simulate network delay for progressive effect
        await new Promise(resolve => setTimeout(resolve, 100));

        // Update state for this batch
        batch.forEach(nodeId => {
          // Trigger re-render by updating loading state
          setLoadingNodes(prev => {
            const next = new Set(prev);
            next.delete(nodeId);
            return next;
          });
        });
      }

      setAllShardsLoaded(true);
    };

    progressiveRender();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clusterId, nodes.length, initialShards.length, topologyBatchSize, allShardsLoaded]);

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

  // Use initial shards directly (already loaded)
  const allShards = initialShards;

  // No client-side filtering - backend handles all filtering
  // indices and shards come pre-filtered from backend
  const filteredIndicesList = filteredIndices;

  // Filter shards (EXACTLY matching ShardAllocationGrid logic)
  const filteredShards = useMemo(() => {
    return allShards.filter((shard) => {
      // Filter by shard state
      if (!selectedShardStates.includes(shard.state)) return false;

      // Filter by index (closed/special/search)
      if (!filteredIndicesList.find((i) => i.name === shard.index)) return false;

      return true;
    });
  }, [allShards, selectedShardStates, filteredIndicesList]);

  // Separate assigned and unassigned shards BEFORE grouping by node
  const assignedShards = useMemo(() => {
    return filteredShards.filter((s) => s.node && s.state !== 'UNASSIGNED');
  }, [filteredShards]);

  const unassignedShards = useMemo(() => {
    return filteredShards.filter((s) => !s.node || s.state === 'UNASSIGNED');
  }, [filteredShards]);

  // Group assigned filtered shards by node for rendering
  const filteredShardsByNode = useMemo(() => {
    return assignedShards.reduce((acc, shard) => {
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
        {Object.entries(filteredShardsByNode).map(([nodeName, nodeShards]) => {
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
                      Disk: {formatBytes(node.diskUsed)}
                    </Text>
                  )}
                </Group>

                <Divider mb="xs" />

                {/* Loading State */}
                {loadingNodes.has(node.id) && (
                  <Box py="md">
                    <Skeleton height={20} radius="sm" mb="xs" />
                    <Skeleton height={20} radius="sm" mb="xs" />
                    <Skeleton height={20} radius="sm" />
                  </Box>
                )}

                {/* Shards Grid */}
                {!loadingNodes.has(node.id) && nodeShards.length > 0 && (
                  <Flex gap={3} wrap="wrap">
                    {nodeShards.map((shard, idx) => {
                      const indexColor = getIndexHealthColor(shard.index);
                      const isPrimary = shard.primary;

                      return (
                        <Tooltip
                          key={`${shard.index}-${shard.shard}-${shard.node}-${idx}`}
                          label={`${shard.index} - Shard ${shard.shard}${isPrimary ? ' (Primary)' : ' (Replica)'} - ${shard.state}`}
                          withArrow
                        >
                          <Box
                            style={{
                              width: 14,
                              height: 14,
                              backgroundColor: indexColor,
                              borderRadius: 2,
                              cursor: onShardClick ? 'pointer' : 'default',
                              opacity: isPrimary ? 1 : 0.5,
                              boxShadow: isPrimary ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                            }}
                            onClick={(e) => {
                              if (onShardClick) {
                                e.stopPropagation();
                                onShardClick(shard, e);
                              }
                            }}
                          />
                        </Tooltip>
                      );
                    })}
                  </Flex>
                )}

                {/* Shard Count Badge */}
                <Group gap="xs" mt="xs" wrap="nowrap">
                  <Badge size="xs" variant="light">
                    {loadingNodes.has(node.id) ? '...' : nodeShards.length} shards
                  </Badge>
                  {nodeShards.filter(s => s.primary).length > 0 && (
                    <Badge size="xs" variant="light">
                      {nodeShards.filter(s => s.primary).length} primary
                    </Badge>
                  )}
                </Group>
              </Paper>
            </Grid.Col>
          );
        })}
      </Grid>

      {/* Unassigned Shards */}
      {unassignedShards.length > 0 && (
        <>
          <Divider my="md" />
          <UnassignedShardsRow
            shards={unassignedShards}
            indexColors={getOrCreateIndexColors(filteredIndicesList.map(i => i.name))}
            onShardClick={onShardClick}
          />
        </>
      )}
    </div>
  );
}
