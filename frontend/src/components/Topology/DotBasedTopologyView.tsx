import { useMemo, useCallback, useEffect, useState, useRef } from 'react';
import { Grid, Text, Box, Divider, Skeleton } from '@mantine/core';
import { ShardInfo, IndexInfo, NodeInfo } from '../../types/api';
import { UnassignedShardsRow } from './UnassignedShardsRow';
import ClusterESNodeCard from '../ClusterESNodeCard';
import { UNASSIGNED_KEY } from '../../utils/canvasLayout';
import { formatBytes } from '../../utils/formatters';
import { getOrCreateIndexColors } from '../../utils/topologyColors';
import { sortShards } from '../../utils/shardOrdering';
import {
  calculateNodeGroups,
  getGroupLabel,
  type GroupingConfig,
} from '../../utils/topologyGrouping';
import { GroupRenderer } from './GroupRenderer';
import { computeHeapPercent, getHeapColor } from '../../utils/heap';
import { GroupingErrorBoundary } from './GroupingErrorBoundary';

interface DotBasedTopologyViewProps {
  nodes: NodeInfo[];
  shards: ShardInfo[];
  indices: IndexInfo[];
  searchParams: URLSearchParams;
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;
  onNodeClick?: (nodeId: string) => void;
  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  indexNameFilter?: string;
  nodeNameFilter?: string;
  matchesWildcard?: (text: string, pattern: string) => boolean;
  clusterId?: string;
  topologyBatchSize?: number;
  _topologyRetryCount?: number;
  groupingConfig?: GroupingConfig;
  isLoading?: boolean;
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
  onNodeClick,
  relocationMode,
  validDestinationNodes,
  onDestinationClick,
  indexNameFilter,
  nodeNameFilter,
  matchesWildcard,
  clusterId,
  topologyBatchSize = 4,
  _topologyRetryCount = 0,
  groupingConfig = { attribute: 'none', value: undefined },
  isLoading = false,
}: DotBasedTopologyViewProps) {
  // Calculate node groups based on grouping configuration
  const nodeGroups = useMemo(() => {
    return calculateNodeGroups(nodes, groupingConfig);
  }, [nodes, groupingConfig]);

  // Progressive loading state
  const [loadingNodes, setLoadingNodes] = useState<Set<string>>(new Set());
  // Track whether initial progressive render has completed. Using a ref (not
  // state) so that setting it true does not trigger a re-render, and — crucially —
  // it does not appear in the effect dependency array, which would prevent
  // subsequent data-driven re-renders after the first load.
  const initialRenderDoneRef = useRef(false);
  
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
    if (!clusterId || !nodes.length) return;

    // Reset initial-render flag whenever the cluster or node set changes so
    // the progressive animation plays again with fresh data.
    initialRenderDoneRef.current = false;

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

      initialRenderDoneRef.current = true;
    };

    progressiveRender();
  }, [clusterId, nodes, initialShards.length, topologyBatchSize]);

  // Apply wildcard filters
  const filteredNodes = useMemo(() => {
    if (!nodeNameFilter || !matchesWildcard) return nodes;
    return nodes.filter(node => matchesWildcard(node.name, nodeNameFilter));
  }, [nodes, nodeNameFilter, matchesWildcard]);

  // Apply all index filters: wildcard, closed, and special
  // Requirements: 4.5 - Filter state persistence
  const filteredIndices = useMemo(() => {
    // Read filter state from URL params
    const showClosed = searchParams.get('showClosed') === 'true';
    const showSpecial = searchParams.get('showSpecial') === 'true';
    
    return indices.filter(index => {
      // Apply wildcard filter
      if (indexNameFilter && matchesWildcard && !matchesWildcard(index.name, indexNameFilter)) {
        return false;
      }
      
      // Apply closed filter - if showClosed is false, only show open indices
      if (!showClosed && index.status !== 'open') {
        return false;
      }
      
      // Apply special filter - if showSpecial is false, hide indices starting with '.'
      if (!showSpecial && index.name.startsWith('.')) {
        return false;
      }
      
      return true;
    });
  }, [indices, indexNameFilter, matchesWildcard, searchParams]);

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
  // RELOCATING shards should always be visible regardless of filter state
  // Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4
  const filteredShards = useMemo(() => {
    const filtered = allShards.filter((shard) => {
      // RELOCATING shards bypass the state filter and are always visible
      if (shard.state === 'RELOCATING') {
        // Still apply index filter
        if (!filteredIndicesList.find((i) => i.name === shard.index)) return false;
        return true;
      }
      
      // Filter by shard state
      if (!selectedShardStates.includes(shard.state)) return false;

      // Filter by index (closed/special/search)
      if (!filteredIndicesList.find((i) => i.name === shard.index)) return false;

      return true;
    });
    
    // Apply deterministic sorting - Requirements: 9.1, 9.2, 9.3
    return sortShards(filtered);
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
    const acc = assignedShards.reduce((acc, shard) => {
      const key = shard.node ?? UNASSIGNED_KEY;
      if (!acc[key]) acc[key] = [];
      acc[key].push(shard);
      return acc;
    }, {} as Record<string, ShardInfo[]>);
    return acc;
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
    // If this is the special unassigned bucket, render a fake NodeInfo
    const isUnassigned = node.id === UNASSIGNED_KEY || node.name === UNASSIGNED_KEY;
    const effectiveNode = isUnassigned
      ? ({ id: UNASSIGNED_KEY, name: 'Unassigned', roles: [] } as unknown as NodeInfo)
      : node;
    const isValidDestination = !!(relocationMode && validDestinationNodes?.some(
      (id) => id === node?.id || id === node?.name
    ));

    const heapPercent = computeHeapPercent(effectiveNode.heapUsed, effectiveNode.heapMax);
    const heapColor = getHeapColor(heapPercent);
    const cpuPercent = node.cpuPercent ?? undefined;
    const cpuColor = cpuPercent === undefined ? 'dimmed' : cpuPercent < 70 ? 'green' : cpuPercent < 85 ? 'yellow' : 'red';
    const load1m = node.loadAverage?.[0];
    const loadColor = load1m === undefined ? 'dimmed' : load1m < 4 ? 'green' : load1m < 6 ? 'yellow' : 'red';
    const diskDisplay = isUnassigned ? '0 B' : formatBytes(effectiveNode.diskUsed);

    const sortedShards = nodeShards.slice().sort((a,b) => a.shard - b.shard);
    const primaryCount = sortedShards.filter(s => s.primary).length;
    const replicaCount = sortedShards.filter(s => !s.primary).length;
    const totalShards = sortedShards.length;

    const badges: Array<{ label: string; color?: string }> = [{ label: `${totalShards} shards` }];
    if (primaryCount > 0) badges.push({ label: `${primaryCount} primary`, color: 'blue' });
    if (replicaCount > 0) badges.push({ label: `${replicaCount} replica`, color: 'gray' });

    const dots = sortedShards.map(shard => ({
      color: getIndexHealthColor(shard.index),
      tooltip: `${shard.index} - Shard ${shard.shard}${shard.primary ? ' (Primary)' : ' (Replica)'} - ${shard.state}`,
      primary: shard.primary,
      shard,
    }));

    const groupData = {
      id: node.id,
      name: isUnassigned ? 'Unassigned' : node.name,
      version: node.version,
      roles: node.roles || [],
      isMaster: node.isMaster,
      isMasterEligible: node.isMasterEligible,
      ip: node.ip,
      heapPercent,
      heapColor,
      cpuPercent,
      cpuColor,
      diskUsed: node.diskUsed,
      diskDisplay,
      load1m,
      loadColor,
      groupLabel: undefined,
      isValidDestination: isValidDestination,
      summaryCounts: { primary: primaryCount, replica: replicaCount, total: totalShards },
      badges,
      dots,
      onNodeClick,
      onDestinationClick,
      onShardClick,
      renderDots: true,
      isUnassigned: isUnassigned,
    };

    return (
      <ClusterESNodeCard key={node.name} {...groupData} isValidDestination={isValidDestination} isLoading={loadingNodes.has(node.id)} />
    );
  };

  // Helper function to sort nodes with master nodes first
  const sortNodesWithMasterFirst = (nodes: NodeInfo[]): NodeInfo[] => {
    return [...nodes].sort((a, b) => {
      const aIsMaster = a.roles?.includes('master') ?? false;
      const bIsMaster = b.roles?.includes('master') ?? false;
      
      // Master nodes come first
      if (aIsMaster && !bIsMaster) return -1;
      if (!aIsMaster && bIsMaster) return 1;
      
      // Otherwise maintain original order (stable sort by name)
      return a.name.localeCompare(b.name);
    });
  };

  // Resolve shards for a given node, treating the canonical UNASSIGNED_KEY specially
  const resolveNodeShards = (node: NodeInfo) => {
    const isUnassignedNode = node.id === UNASSIGNED_KEY || node.name === UNASSIGNED_KEY || node.name === 'Unassigned';
    if (isUnassignedNode) return filteredShardsByNode[UNASSIGNED_KEY] || [];
    return filteredShardsByNode[node.name] || filteredShardsByNode[node.id] || [];
  };

  // Helper function to sort group entries with master group first
  const sortGroupEntriesWithMasterFirst = (entries: [string, NodeInfo[]][]): [string, NodeInfo[]][] => {
    return [...entries].sort(([keyA], [keyB]) => {
      // Master group always comes first
      if (keyA === 'master' && keyB !== 'master') return -1;
      if (keyA !== 'master' && keyB === 'master') return 1;
      
      // Otherwise maintain original order
      return 0;
    });
  };

  // Separate master and data nodes for rendering
  const sortedNodes = sortNodesWithMasterFirst(filteredNodes);
  const masterNodes = sortedNodes.filter(n => n.roles?.includes('master'));
  const dataNodes = sortedNodes.filter(n => !n.roles?.includes('master'));

  return (
    <div>
      {/* Initial Loading Skeleton */}
      {isLoading && (
        <Grid gutter="md" overflow="hidden">
          {[1, 2, 3, 4].map((i) => (
            <Grid.Col key={i} span={{ base: 12, sm: 6, lg: 4, xl: 3 }}>
              <Box p="md" style={{ border: '1px solid var(--mantine-color-gray-3)', borderRadius: 'var(--mantine-radius-sm)' }}>
                <Skeleton height={20} width="60%" mb="xs" />
                <Skeleton height={14} width="40%" mb="xs" />
                <Skeleton height={14} width="80%" mb="md" />
                <Skeleton height={100} mb="xs" />
                <Skeleton height={20} width="50%" />
              </Box>
            </Grid.Col>
          ))}
        </Grid>
      )}

      {/* Nodes Grid - with or without grouping */}
      {!isLoading && groupingConfig.attribute === 'none' ? (
        // No grouping - render ALL nodes with masters in separate row
        <>
          {/* Master Nodes */}
          {masterNodes.length > 0 && (
            <>
              <Text size="xs" c="dimmed" mb="xs" fw={500}>Master Nodes</Text>
              <Grid gutter="md" mb="md" overflow="hidden">
               {masterNodes.map((node) => {
                   const nodeShards = resolveNodeShards(node);
                   return renderNodeCard(node, nodeShards);
                 })}
              </Grid>
            </>
          )}

          {/* Data Nodes */}
          {dataNodes.length > 0 && (
            <>
              <Text size="xs" c="dimmed" mb="xs" fw={500}>Data Nodes</Text>
              <Grid gutter="md" overflow="hidden">
               {dataNodes.map((node) => {
                   const nodeShards = resolveNodeShards(node);
                   return renderNodeCard(node, nodeShards);
                 })}
              </Grid>
            </>
          )}
        </>
      ) : !isLoading ? (
        // With grouping - render one GroupRenderer per group
        // Filter out empty groups before rendering
        <GroupingErrorBoundary
          fallback={
            <Grid gutter="md" overflow="hidden">
              {Object.entries(filteredShardsByNode).map(([nodeName, nodeShards]) => {
                const node = filteredNodes.find((n) => n.name === nodeName || n.id === nodeName);
                if (!node) return null;
                return renderNodeCard(node, nodeShards);
              })}
            </Grid>
          }
        >
          {sortGroupEntriesWithMasterFirst(Array.from(nodeGroups.entries()))
            .map(([groupKey, groupNodes]) => {
              // Show ALL nodes in the group, not just those with shards
              // Master nodes without shard allocations should still be visible
              const visibleNodes = groupNodes.filter(node =>
                filteredNodes.some(fn => fn.name === node.name || fn.id === node.id)
              );

              // Skip empty groups - filter out before rendering
              if (visibleNodes.length === 0) {
                return null;
              }

              // Sort nodes within each group to show master nodes first
              const sortedVisibleNodes = sortNodesWithMasterFirst(visibleNodes);

              return (
                <GroupRenderer
                  key={groupKey}
                  groupKey={groupKey}
                  groupLabel={getGroupLabel(groupKey, groupingConfig.attribute)}
                  nodes={sortedVisibleNodes}
                >
                  <Grid gutter="md" overflow="hidden">
                    {sortedVisibleNodes.map(node => {
                      const nodeShards = resolveNodeShards(node);
                      return renderNodeCard(node, nodeShards);
                    })}
                  </Grid>
                </GroupRenderer>
              );
            })
            .filter(Boolean) /* Remove null entries from empty groups */
          }
        </GroupingErrorBoundary>
      ) : null}

      {/* Unassigned Shards */}
      {!isLoading && unassignedShards.length > 0 && (
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
