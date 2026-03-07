import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Grid, Paper, Text, Tooltip, Flex, Box, Badge, Group, Divider, Skeleton } from '@mantine/core';
import { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import { UnassignedShardsRow } from './UnassignedShardsRow';
import { RoleIcons } from '../RoleIcons';
import { getOrCreateIndexColors } from '../../utils/topologyColors';
import {
  parseGroupingFromUrl,
  calculateNodeGroups,
  hasCustomLabels,
  getGroupLabel,
  type GroupingAttribute,
  type GroupingConfig,
} from '../../utils/topologyGrouping';
import { GroupingControl } from './GroupingControl';
import { GroupRenderer } from './GroupRenderer';
import { GroupingErrorBoundary } from './GroupingErrorBoundary';

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
  // Grouping state management
  const [groupingConfig, setGroupingConfig] = useState<GroupingConfig>(() => {
    // Parse grouping from URL on component mount
    // Priority: props > URL params
    if (groupBy) {
      return { attribute: groupBy, value: groupValue };
    }
    return parseGroupingFromUrl(searchParams);
  });

  // Update URL when grouping changes
  useEffect(() => {
    // Only update URL if grouping is controlled by component (not props)
    if (!groupBy && typeof window !== 'undefined') {
      const currentUrl = new URL(window.location.href);
      const params = new URLSearchParams(currentUrl.search);
      
      // Remove old grouping params
      params.delete('groupBy');
      params.delete('groupValue');
      
      // Add new grouping params if not 'none'
      if (groupingConfig.attribute !== 'none') {
        params.set('groupBy', groupingConfig.attribute);
        if (groupingConfig.value) {
          params.set('groupValue', groupingConfig.value);
        }
      }
      
      // Update URL without page reload
      const newUrl = `${currentUrl.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    }
  }, [groupingConfig, groupBy]);

  // Sync with URL changes (browser back/forward)
  useEffect(() => {
    if (!groupBy) {
      const parsedConfig = parseGroupingFromUrl(searchParams);
      if (
        parsedConfig.attribute !== groupingConfig.attribute ||
        parsedConfig.value !== groupingConfig.value
      ) {
        setGroupingConfig(parsedConfig);
      }
    }
  }, [searchParams, groupBy, groupingConfig]);

  // Calculate node groups based on grouping configuration
  // Memoized to avoid unnecessary recalculations
  // Recalculates when nodes or grouping config changes
  const nodeGroups = useMemo(() => {
    return calculateNodeGroups(nodes, groupingConfig);
  }, [nodes, groupingConfig]);

  // Check if nodes have custom labels for GroupingControl
  const availableLabels = useMemo(() => {
    if (!hasCustomLabels(nodes)) {
      return [];
    }
    // Extract unique labels from all nodes
    const labels = new Set<string>();
    nodes.forEach(node => {
      if (node.tags && node.tags.length > 0) {
        node.tags.forEach(tag => labels.add(tag));
      }
    });
    return Array.from(labels);
  }, [nodes]);

  // Handler for grouping changes
  const handleGroupingChange = useCallback((attribute: GroupingAttribute) => {
    setGroupingConfig({ attribute });
  }, []);

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

  // Helper function to render a single node card
  const renderNodeCard = (node: NodeInfo, nodeShards: ShardInfo[]) => {
    const isValidDestination = relocationMode && validDestinationNodes?.some(
      (id) => id === node?.id || id === node?.name
    );

    return (
      <Grid.Col span={{ base: 12, sm: 6, lg: 4, xl: 3 }} key={node.name}>
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
              {node.name}
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
  };

  return (
    <div>
      {/* Grouping Control - wrapped in error boundary */}
      <Box mb="md">
        <GroupingErrorBoundary>
          <GroupingControl
            currentGrouping={groupingConfig.attribute}
            availableLabels={availableLabels}
            onGroupingChange={handleGroupingChange}
          />
        </GroupingErrorBoundary>
      </Box>

      {/* Nodes Grid - with or without grouping */}
      {groupingConfig.attribute === 'none' ? (
        // No grouping - render nodes directly (backward compatible)
        <Grid gutter="md">
          {Object.entries(filteredShardsByNode).map(([nodeName, nodeShards]) => {
            const node = filteredNodes.find((n) => n.name === nodeName || n.id === nodeName);
            if (!node) return null;
            return renderNodeCard(node, nodeShards);
          })}
        </Grid>
      ) : (
        // With grouping - render one GroupRenderer per group
        // Filter out empty groups before rendering
        <GroupingErrorBoundary
          fallback={
            <Grid gutter="md">
              {Object.entries(filteredShardsByNode).map(([nodeName, nodeShards]) => {
                const node = filteredNodes.find((n) => n.name === nodeName || n.id === nodeName);
                if (!node) return null;
                return renderNodeCard(node, nodeShards);
              })}
            </Grid>
          }
        >
          {Array.from(nodeGroups.entries())
            .map(([groupKey, groupNodes]) => {
              // Filter to only nodes that have shards (are in filteredShardsByNode)
              const nodesWithShards = groupNodes.filter(node => 
                filteredShardsByNode[node.name] || filteredShardsByNode[node.id]
              );

              // Skip empty groups - filter out before rendering
              if (nodesWithShards.length === 0) {
                return null;
              }

              return (
                <GroupRenderer
                  key={groupKey}
                  groupKey={groupKey}
                  groupLabel={getGroupLabel(groupKey, groupingConfig.attribute)}
                  nodes={nodesWithShards}
                >
                  <Grid gutter="md">
                    {nodesWithShards.map(node => {
                      const nodeShards = filteredShardsByNode[node.name] || filteredShardsByNode[node.id] || [];
                      return renderNodeCard(node, nodeShards);
                    })}
                  </Grid>
                </GroupRenderer>
              );
            })
            .filter(Boolean) /* Remove null entries from empty groups */
          }
        </GroupingErrorBoundary>
      )}

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
