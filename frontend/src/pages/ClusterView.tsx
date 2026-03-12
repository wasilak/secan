/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Badge,
  Grid,
  Alert,
  Table,
  Progress,
  ScrollArea,
  Button,
  Menu,
  ActionIcon,
  TextInput,
  Checkbox,
  Tooltip,
  Modal,
  Skeleton,
  Anchor,
  UnstyledButton,
  Box,
  useMantineColorScheme,
  SegmentedControl as SegmentedControlType,
  Tabs,
} from '@mantine/core';
import { CopyButton } from '../components/CopyButton';
import { CodeEditor } from '../components/CodeEditor';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { defaultSection, isValidClusterSection } from '../routes/clusterRoutes';
import {
  extractNodeIdFromPath,
  extractIndexNameFromPath,
} from '../utils/urlBuilders';
import { useClusterNavigation } from '../hooks/useClusterNavigation';
import { DotBasedTopologyView } from '../components/Topology/DotBasedTopologyView';
import { ShardAllocationGridFilters } from '../components/ShardAllocationGridFilters';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  IconAlertCircle,
  IconPlus,
  IconSettings,
  IconMap,
  IconDots,
  IconSearch,
  IconLock,
  IconLockOpen,
  IconMaximize,
  IconMinimize,
  IconSortAscending,
  IconSortDescending,
  IconRefresh,
  IconTrash,
  IconStar,
  IconCopy,
  IconEyeOff,
  IconFolderOpen,
  IconFolderX,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
  IconArrowsRightLeft,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsivePageSize } from '../hooks/useResponsivePageSize';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useWatermarks } from '../hooks/useWatermarks';
import { useSparklineData, DataPoint } from '../hooks/useSparklineData';
import { useMetricsStore } from '../stores/metricsStore';
import { useFaviconManager } from '../hooks/useFaviconManager';
import { useClusterName } from '../hooks/useClusterName';
import { IndexEdit } from './IndexEdit';
import { RestConsole } from './RestConsole';
import { NodeModal } from '../components/NodeModal';
import { TasksTab } from '../components/TasksTab';
import { Sparkline } from '../components/Sparkline';
import { ShardTypeBadge } from '../components/ShardTypeBadge';
import { TIME_RANGE_PRESETS } from '../components/TimeRangePicker';
import { ShardStatsCards } from '../components/ShardStatsCards';
import { IndexStatsCards } from '../components/IndexStatsCards';
import { NodeStatsCards } from '../components/NodeStatsCards';
import { sortNodesMasterFirst } from '../utils/node-sorting';
import { ClusterStatistics } from '../components/ClusterStatistics';
import { IconClock } from '@tabler/icons-react';
import { TablePagination } from '../components/TablePagination';
import { SimplePagination } from '../components/SimplePagination';
import { MasterIndicator } from '../components/MasterIndicator';
import { RoleIcons, getRoleIcon, RoleFilterToggle } from '../components/RoleIcons';
import { ShardStateFilterToggle } from '../components/ShardStateFilter';
import { ShardContextMenu } from '../components/ShardContextMenu';
import { BulkOperationsMenu } from '../components/BulkOperationsMenu';
import { BulkOperationConfirmModal } from '../components/BulkOperationConfirmModal';
import { ProgressWithLabel } from '../components/ProgressWithLabel';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useClusterChanges } from '../hooks/useClusterChanges';
import { ClusterChangeNotifier } from '../components/ClusterChangeNotifier';
import { AllocationLockIndicator, AllocationState } from '../components/Topology/AllocationLockIndicator';
import type { NodeInfo, IndexInfo, ShardInfo, NodeRole, ClusterInfo, PaginatedResponse } from '../types/api';
import type { BulkOperationType } from '../types/api';
import { formatLoadAverage, getLoadColor, formatUptimeDetailed, formatBytes, formatPercentRatio } from '../utils/formatters';
import { getHealthColor, getShardStateColor } from '../utils/colors';
import { useState, useEffect, useCallback, useMemo, memo } from 'react';

/**
 * Get background color for index health in shard allocation grid
 */
function getIndexBackgroundColor(health: string): string {
  switch (health) {
    case 'green':
      return 'transparent';
    case 'yellow':
      return 'rgba(250, 176, 5, 0.15)'; // Semi-transparent yellow
    case 'red':
      return 'rgba(250, 82, 82, 0.15)'; // Semi-transparent red
    default:
      return 'transparent';
  }
}

/**
 * ClusterView component displays detailed information about a single cluster.
 *
 * Features:
 * - Display cluster health and statistics
 * - Show nodes, indices, and shards
 * - Auto-refresh at configurable intervals
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 14.1, 14.2, 14.3, 14.4, 14.5
 */
export function ClusterView() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const refreshInterval = useRefreshInterval();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get resolved cluster name
  const clusterName = useClusterName(id || '');

  // Indices search filter (similar to shards filter, handled at parent level to prevent re-renders of child)
  const indicesSearch = searchParams.get('indicesSearch') || '';
  const [localIndicesSearch, setLocalIndicesSearch] = useState(indicesSearch);

  // Sync local input with URL when it changes externally (back/forward navigation)
  useEffect(() => {
    setLocalIndicesSearch(searchParams.get('indicesSearch') || '');
  }, [searchParams]);

  // Debounce: update URL after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localIndicesSearch !== searchParams.get('indicesSearch')) {
        const newParams = new URLSearchParams(searchParams);
        if (localIndicesSearch) {
          newParams.set('indicesSearch', localIndicesSearch);
        } else {
          newParams.delete('indicesSearch');
        }
        setSearchParams(newParams);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localIndicesSearch, searchParams, setSearchParams]);

  const setIndicesSearch = (value: string) => {
    setLocalIndicesSearch(value);
  };

  // Nodes search filter (handled at parent level to prevent re-renders and focus loss)
  const nodesSearch = searchParams.get('nodesSearch') || '';
  const [localNodesSearch, setLocalNodesSearch] = useState(nodesSearch);

  // Sync local input with URL when it changes externally (back/forward navigation)
  useEffect(() => {
    setLocalNodesSearch(searchParams.get('nodesSearch') || '');
  }, [searchParams]);

  // Debounce: update URL after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localNodesSearch !== searchParams.get('nodesSearch')) {
        const newParams = new URLSearchParams(searchParams);
        if (localNodesSearch) {
          newParams.set('nodesSearch', localNodesSearch);
        } else {
          newParams.delete('nodesSearch');
        }
        setSearchParams(newParams);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localNodesSearch, searchParams, setSearchParams]);

  const setNodesSearch = (value: string) => {
    setLocalNodesSearch(value);
  };

  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);

  // Get navigation helper
  const { navigateToNode, navigateToIndex, closeModal, currentSection: getCurrentSection } = useClusterNavigation();

  // Get active section from path parameter, default to 'overview'
  // This supports both /cluster/:id and /cluster/:id/:section URL formats
  // Also checks for bg query param for modal background section
  const activeSection = getCurrentSection() || defaultSection;
  const activeTab = activeSection; // Use activeSection as activeTab for backward compatibility with existing code

  // Topology view type from URL path (for direct linking)
  const topologyViewFromPath = location.pathname.includes('/topology/dot') ? 'dot' :
                               location.pathname.includes('/topology/index') ? 'index' : null;
  const topologyViewType = topologyViewFromPath || (searchParams.get('topologyView') as 'dot' | 'index') || 'dot';
  const setTopologyViewType = (value: 'dot' | 'index') => {
    // Navigate to path-based URL for direct linking
    navigate(`/cluster/${id}/topology/${value}`, { replace: true });
  };

  // Shared relocation state
  const [relocationMode, setRelocationMode] = useState(false);
  const [validDestinationNodes, setValidDestinationNodes] = useState<string[]>([]);
  const [relocationSourceNode, setRelocationSourceNode] = useState<NodeInfo | null>(null);
  const [relocationDestinationNode, setRelocationDestinationNode] = useState<NodeInfo | null>(null);
  const [relocationConfirmOpened, setRelocationConfirmOpened] = useState(false);
  const [relocationShard, setRelocationShard] = useState<ShardInfo | null>(null);
  const [relocationInProgress, setRelocationInProgress] = useState(false);
  const [topologyContextMenuShard, setTopologyContextMenuShard] = useState<ShardInfo | null>(null);
  const [topologyContextMenuPosition, setTopologyContextMenuPosition] = useState({ x: 0, y: 0 });
  const [topologyContextMenuOpened, setTopologyContextMenuOpened] = useState(false);

  // Shared shard allocation state
  const { data: clusterSettings } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: () => apiClient.proxyRequest(id!, 'GET', '/_cluster/settings'),
    enabled: !!id,
  });

  const shardAllocationEnabled = (() => {
    if (!clusterSettings) return true;
    const data = clusterSettings as Record<string, unknown>;
    const transient = data.transient as Record<string, unknown> | undefined;
    const persistent = data.persistent as Record<string, unknown> | undefined;
    const transientEnable = (transient?.cluster as Record<string, unknown> | undefined)?.routing as Record<string, unknown> | undefined;
    const persistentEnable = (persistent?.cluster as Record<string, unknown> | undefined)?.routing as Record<string, unknown> | undefined;
    const enableValue = ((transientEnable as Record<string, unknown>)?.enable as string) || ((persistentEnable as Record<string, unknown>)?.enable as string) || 'all';
    return enableValue === 'all';
  })();

  // Extract allocation state for AllocationLockIndicator
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
  const allocationState: AllocationState = (() => {
    if (!clusterSettings) return 'all';
    const data = clusterSettings as Record<string, unknown>;
    const transient = data.transient as Record<string, unknown> | undefined;
    const persistent = data.persistent as Record<string, unknown> | undefined;
    const transientEnable = (transient?.cluster as Record<string, unknown> | undefined)?.routing as Record<string, unknown> | undefined;
    const persistentEnable = (persistent?.cluster as Record<string, unknown> | undefined)?.routing as Record<string, unknown> | undefined;
    const enableValue = ((transientEnable as Record<string, unknown>)?.enable as string) || ((persistentEnable as Record<string, unknown>)?.enable as string) || 'all';
    
    // Validate and return allocation state
    if (enableValue === 'all' || enableValue === 'primaries' || enableValue === 'new_primaries' || enableValue === 'none') {
      return enableValue as AllocationState;
    }
    return 'all'; // Default fallback
  })();

  const enableAllocationMutation = useMutation({
    mutationFn: () => apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
      transient: { 'cluster.routing.allocation.enable': 'all' },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({ title: 'Success', message: 'Shard allocation enabled', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ title: 'Error', message: `Failed to enable shard allocation: ${error.message}`, color: 'red' });
    },
  });

  const disableAllocationMutation = useMutation({
    mutationFn: (mode: string) => apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
      transient: { 'cluster.routing.allocation.enable': mode },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({ title: 'Success', message: 'Shard allocation disabled', color: 'green' });
    },
    onError: (error: Error) => {
      notifications.show({ title: 'Error', message: `Failed to disable shard allocation: ${error.message}`, color: 'red' });
    },
  });

  // Topology wildcard filters
  const indexNameFilter = searchParams.get('indexFilter') || '';
  const nodeNameFilter = searchParams.get('nodeFilter') || '';

  const setIndexNameFilter = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('indexFilter', value);
    } else {
      newParams.delete('indexFilter');
    }
    setSearchParams(newParams);
  };

  const setNodeNameFilter = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('nodeFilter', value);
    } else {
      newParams.delete('nodeFilter');
    }
    setSearchParams(newParams);
  };

  // Wildcard pattern matching (Elasticsearch cat API style)
  const matchesWildcard = (text: string, pattern: string): boolean => {
    if (!pattern) return true;
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(text);
  };

  // Extract modal IDs from path
  const nodeIdFromPath = extractNodeIdFromPath(location.pathname);
  const indexNameFromPath = extractIndexNameFromPath(location.pathname);

  // Index modal state
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [selectedIndexName, setSelectedIndexName] = useState<string | null>(null);

  // Open index modal when URL path changes
  useEffect(() => {
    if (indexNameFromPath) {
      setSelectedIndexName(decodeURIComponent(indexNameFromPath));
      setIndexModalOpen(true);
    } else {
      setIndexModalOpen(false);
      setSelectedIndexName(null);
    }
  }, [indexNameFromPath]);

  // Handle opening index modal - use path-based navigation
  const openIndexModal = (indexName: string, tab?: string) => {
    navigateToIndex(indexName, tab || 'visualization');
  };

  // Handle closing index modal - navigate back to section
  const closeIndexModal = () => {
    closeModal();
  };

  // Shared topology handlers
  const handleTopologyShardClick = (shard: ShardInfo, event: React.MouseEvent) => {
    event.stopPropagation();
    setTopologyContextMenuShard(shard);
    setTopologyContextMenuPosition({ x: event.clientX, y: event.clientY });
    setTopologyContextMenuOpened(true);
  };

  const handleTopologyContextMenuClose = () => {
    setTopologyContextMenuOpened(false);
    setTopologyContextMenuShard(null);
  };

  const handleTopologySelectForRelocation = (shard: ShardInfo) => {
    if (!nodes || !shards) {
      handleTopologyContextMenuClose();
      return;
    }

    const validDestinations: string[] = [];
    let sourceNode: NodeInfo | null = null;

    for (const node of nodes) {
      if (node.id === shard.node || node.name === shard.node) {
        sourceNode = node;
        continue;
      }
      const nodeHasThisShard = shards.some(
        (s) => (s.node === node.id || s.node === node.name) &&
          s.index === shard.index && s.shard === shard.shard
      );
      if (nodeHasThisShard) continue;
      if (!node.roles.includes('data')) continue;
      validDestinations.push(node.id);
    }

    if (validDestinations.length === 0) {
      notifications.show({
        title: 'Cannot Relocate',
        message: `Shard ${shard.shard} (${shard.primary ? 'Primary' : 'Replica'}) of index "${shard.index}" cannot be relocated. All data nodes either already host this shard or are the source node.`,
        color: 'violet',
        autoClose: 5000,
      });
      handleTopologyContextMenuClose();
      return;
    }

    setRelocationMode(true);
    setValidDestinationNodes(validDestinations);
    setRelocationSourceNode(sourceNode);
    setRelocationShard(shard);
    handleTopologyContextMenuClose();
  };

  const handleTopologyCancelRelocation = () => {
    setRelocationMode(false);
    setValidDestinationNodes([]);
    setRelocationSourceNode(null);
    setRelocationDestinationNode(null);
    setRelocationShard(null);
  };

  const handleTopologyDestinationClick = (nodeId: string) => {
    if (!relocationMode || !validDestinationNodes.includes(nodeId)) return;
    const destNode = nodes.find((n) => n.id === nodeId || n.name === nodeId);
    setRelocationDestinationNode(destNode || null);
    setRelocationConfirmOpened(true);
  };

  const handleTopologyConfirmRelocation = async () => {
    if (!relocationShard || !relocationDestinationNode || !relocationSourceNode) return;

    setRelocationConfirmOpened(false);
    setRelocationInProgress(true);

    try {
      await apiClient.relocateShard(id!, {
        index: relocationShard.index,
        shard: relocationShard.shard,
        from_node: relocationSourceNode.id,
        to_node: relocationDestinationNode.id,
      });

      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'shards'] });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'nodes'] });
      
      notifications.show({
        title: 'Shard Relocation Started',
        message: `Shard ${relocationShard.shard} of index "${relocationShard.index}" is being relocated`,
        color: 'green',
      });
    } catch (error) {
      notifications.show({
        title: 'Relocation Failed',
        message: error instanceof Error ? error.message : 'Failed to relocate shard',
        color: 'red',
      });
    } finally {
      setRelocationInProgress(false);
      setRelocationMode(false);
      setValidDestinationNodes([]);
      setRelocationSourceNode(null);
      setRelocationDestinationNode(null);
      setRelocationShard(null);
    }
  };

  // Node modal state
  const [nodeModalOpen, setNodeModalOpen] = useState(false);

  // Open node modal when URL path changes
  useEffect(() => {
    setNodeModalOpen(!!nodeIdFromPath);
  }, [nodeIdFromPath]);

  // Handle opening node modal - use path-based navigation
  const openNodeModal = (nodeId: string) => {
    navigateToNode(nodeId);
  };

  // Handle closing node modal - navigate back to section
  const closeNodeModal = () => {
    closeModal();
  };

  // Update URL when tab/section changes
  const handleTabChange = (value: string | null) => {
    if (value && isValidClusterSection(value)) {
      // Navigate to new section using path-based URL
      navigate(`/cluster/${id}/${value}`);
      // Note: Modal params are preserved in searchParams, only section changes in path
    }
  };

  // Fetch cluster information (including metrics source)
  const { data: clusterInfo } = useQuery({
    queryKey: ['clusters', id],
    queryFn: async () => {
      const clustersResponse = await apiClient.getClusters(1, 100);
      return clustersResponse.items.find((c: ClusterInfo) => c.id === id);
    },
    enabled: !!id,
    staleTime: 60000,
  });

  // Fetch cluster statistics with auto-refresh
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
    refetch: refetchStats,
  } = useQuery({
    queryKey: ['cluster', id, 'stats'],
    queryFn: () => apiClient.getClusterStats(id!),
    refetchInterval: refreshInterval,
    enabled: !!id,
    refetchOnMount: 'always', // Always refetch when component mounts
  });

  // Update favicon based on cluster health
  // Requirements: 12.2, 12.3, 12.4, 12.5
  useFaviconManager(stats?.health || null);

  // Trigger immediate stats refetch when switching to statistics tab
  // This ensures graphs are populated immediately instead of waiting for the next refresh interval
  useEffect(() => {
    if (activeTab === 'statistics' && id) {
      refetchStats();
    }
  }, [activeTab, id, refetchStats]);

  // Get selected time range from URL params (for Prometheus metrics)
  // Default to 24h if not specified
  const timeRangeParam = searchParams.get('timeRange') || '1440'; // minutes
  const timeRangeMinutes = parseInt(timeRangeParam, 10);
  
  // Find matching preset or create custom range
  const selectedTimeRange = TIME_RANGE_PRESETS.find(p => p.minutes === timeRangeMinutes) || {
    minutes: timeRangeMinutes,
    label: timeRangeMinutes === 1440 ? 'Last 24h' : `Last ${timeRangeMinutes}m`,
  };
  
  const [timeRangeDropdownOpened, setTimeRangeDropdownOpened] = useState(false);

  // Fetch metrics history when in statistics tab
  // Uses global refresh interval to sync with useSparklineData for internal metrics
  const { data: metricsHistory } = useQuery({
    queryKey: ['cluster', id, 'metrics-history', timeRangeMinutes],
    queryFn: async () => {
      if (!id) throw new Error('Cluster ID is required');
      const now = Math.floor(Date.now() / 1000);
      const start = now - timeRangeMinutes * 60;
      return apiClient.getClusterMetrics(id, { start, end: now });
    },
    enabled: activeTab === 'statistics' && !!id,
    refetchInterval: refreshInterval, // Use global refresh interval
    staleTime: 30000, // Consider data fresh for 30 seconds
  });

  // Detect if we're using internal metrics (single data point) vs Prometheus (time series)
  const isInternalMetrics = metricsHistory?.data && metricsHistory.data.length === 1;
  
  // For internal metrics, extract current values to accumulate over time
  // Ensure values are numbers (not undefined) for useSparklineData to work
  // CRITICAL: Memoize this object to prevent unnecessary re-renders and hook resets
  const currentInternalMetrics = useMemo(() => {
    if (!isInternalMetrics || !metricsHistory?.data[0]) return null;
    
    return {
      nodes: metricsHistory.data[0].node_count,
      indices: metricsHistory.data[0].index_count ?? 0,
      documents: metricsHistory.data[0].document_count ?? 0,
      shards: metricsHistory.data[0].shard_count ?? 0,
      unassigned: metricsHistory.data[0].unassigned_shards ?? 0,
      // Use ?? 0 for all metrics consistently
      cpu: metricsHistory.data[0].cpu_percent ?? 0,
      memory: metricsHistory.data[0].memory_used_bytes ?? 0,
      disk: metricsHistory.data[0].disk_used_bytes ?? 0,
    };
  }, [isInternalMetrics, metricsHistory?.data]);

  // Accumulate internal metrics over time (resets when switching tabs)
  const nodesHistoryInternal = useSparklineData(
    currentInternalMetrics?.nodes,
    50,
    activeTab,
    true
  ) as DataPoint[];
  
  const indicesHistoryInternal = useSparklineData(
    currentInternalMetrics?.indices,
    50,
    activeTab,
    true
  ) as DataPoint[];
  const documentsHistoryInternal = useSparklineData(
    currentInternalMetrics?.documents,
    50,
    activeTab,
    true
  ) as DataPoint[];
  const shardsHistoryInternal = useSparklineData(
    currentInternalMetrics?.shards,
    50,
    activeTab,
    true
  ) as DataPoint[];
  const unassignedHistoryInternal = useSparklineData(
    currentInternalMetrics?.unassigned,
    50,
    activeTab,
    true
  ) as DataPoint[];
  const cpuHistoryInternal = useSparklineData(
    currentInternalMetrics?.cpu,
    50,
    activeTab,
    true
  ) as DataPoint[];
  const memoryHistoryInternal = useSparklineData(
    currentInternalMetrics?.memory,
    50,
    activeTab,
    true
  ) as DataPoint[];
  const diskHistoryInternal = useSparklineData(
    currentInternalMetrics?.disk,
    50,
    activeTab,
    true
  ) as DataPoint[];

  // Hidden indices toggle state
  const [showHiddenIndices, setShowHiddenIndices] = useState(false);
  
  // Extract Prometheus queries from metrics history
  const prometheusQueries = metricsHistory?.prometheus_queries;

  // Track historical data for sparklines (fallback when not in statistics tab)
  // Pass activeTab as resetKey so data resets when switching to statistics tab
  const nodesHistorySparkline = useSparklineData(
    stats?.numberOfNodes,
    20,
    activeTab,
    false // Return number[] for sparklines
  ) as number[];
  const indicesHistorySparkline = useSparklineData(
    stats?.numberOfIndices,
    20,
    activeTab,
    false
  ) as number[];
  const documentsHistorySparkline = useSparklineData(
    stats?.numberOfDocuments,
    20,
    activeTab,
    false
  ) as number[];
  const shardsHistorySparkline = useSparklineData(
    stats?.activeShards,
    20,
    activeTab,
    false
  ) as number[];
  const unassignedHistorySparkline = useSparklineData(
    stats?.unassignedShards,
    20,
    activeTab,
    false
  ) as number[];

  // Use metrics history data when available (statistics tab), otherwise use sparkline data
  // For ClusterStatistics component (needs DataPoint[])
  // Internal metrics (single point): use accumulated history
  // Prometheus metrics (time series): use data directly
  const nodesHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? nodesHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.node_count,
            timestamp: new Date(d.date).getTime(),
          }))
      : nodesHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const indicesHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? indicesHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.index_count || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : indicesHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const documentsHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? documentsHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.document_count || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : documentsHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const shardsHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? shardsHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.shard_count || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : shardsHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const unassignedHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? unassignedHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.unassigned_shards || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : unassignedHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const diskUsageHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? diskHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.disk_used_bytes || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : []; // No sparkline fallback for disk usage

  // For internal metrics, use accumulated history directly (no cpuSeries/memorySeries)
  // For Prometheus metrics, use data from metricsHistory
  const cpuHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? cpuHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.cpu_percent || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : [];

  const memoryHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? memoryHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.memory_used_bytes || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : [];

  // Group raw memory metrics by labels to create separate series (Prometheus only)
  // This handles metrics with grouping like sum by (area) (elasticsearch_jvm_memory_used_bytes)
  // For internal metrics, raw_metrics is undefined, so these will be empty arrays
  const memorySeries = useMemo(() => {
    const memorySeriesMap = new Map<string, DataPoint[]>();
    
    if (activeTab === 'statistics' && !isInternalMetrics && metricsHistory?.raw_metrics?.memory) {
      for (const point of metricsHistory.raw_metrics.memory) {
        // Create a series key from labels in logfmt format (e.g., "area=heap")
        const seriesKey = point.labels
          ? Object.entries(point.labels)
              .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
              .map(([k, v]) => `${k}=${v}`)
              .join(',')
          : 'default';
        
        if (!memorySeriesMap.has(seriesKey)) {
          memorySeriesMap.set(seriesKey, []);
        }
        
        memorySeriesMap.get(seriesKey)!.push({
          value: point.value,
          timestamp: point.timestamp * 1000, // Convert to milliseconds
        });
      }
    }
    
    // Convert map to array of series with formatted names
    return Array.from(memorySeriesMap.entries()).map(([key, data]) => {
      // Parse logfmt key back to get label values for display name
      const labels = key.split(',').reduce((acc, pair) => {
        const [k, v] = pair.split('=');
        if (k && v) acc[k] = v;
        return acc;
      }, {} as Record<string, string>);
      
      // Create display name from labels (e.g., "Heap" from area=heap)
      const displayName = Object.entries(labels)
        .map(([k, v]) => v.charAt(0).toUpperCase() + v.slice(1)) // Capitalize first letter
        .join(', ') || 'Memory';
      
      return {
        name: displayName,
        data,
        labels,
      };
    });
  }, [activeTab, isInternalMetrics, metricsHistory?.raw_metrics?.memory]);

  // Group raw CPU metrics by labels to create separate series (Prometheus only)
  // This handles metrics with grouping like avg by (node) (elasticsearch_process_cpu_percent)
  // For internal metrics, raw_metrics is undefined, so these will be empty arrays
  const cpuSeries = useMemo(() => {
    const cpuSeriesMap = new Map<string, DataPoint[]>();
    
    if (activeTab === 'statistics' && !isInternalMetrics && metricsHistory?.raw_metrics?.cpu) {
      for (const point of metricsHistory.raw_metrics.cpu) {
        // Create a series key from labels in logfmt format (e.g., "node=node-1")
        const seriesKey = point.labels
          ? Object.entries(point.labels)
              .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
              .map(([k, v]) => `${k}=${v}`)
              .join(',')
          : 'default';
        
        if (!cpuSeriesMap.has(seriesKey)) {
          cpuSeriesMap.set(seriesKey, []);
        }
        
        cpuSeriesMap.get(seriesKey)!.push({
          value: point.value,
          timestamp: point.timestamp * 1000, // Convert to milliseconds
        });
      }
    }
    
    // Convert map to array of series with formatted names
    return Array.from(cpuSeriesMap.entries()).map(([key, data]) => {
      // Parse logfmt key back to get label values for display name
      const labels = key.split(',').reduce((acc, pair) => {
        const [k, v] = pair.split('=');
        if (k && v) acc[k] = v;
        return acc;
      }, {} as Record<string, string>);
      
      // Create display name from labels in logfmt format (e.g., "node=node-1")
      // Show all labels in key=value format
      const displayName = Object.entries(labels)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join(',') || 'CPU';
      
      return {
        name: displayName,
        data,
        labels,
      };
    });
  }, [activeTab, isInternalMetrics, metricsHistory?.raw_metrics?.cpu]);

  const memoryNonHeapHistory: DataPoint[] =
    activeTab === 'statistics' && metricsHistory?.data
      ? metricsHistory.data.map((d) => ({
        value: d.memory_non_heap_bytes || 0,
        timestamp: new Date(d.date).getTime(),
      }))
      : [];

  // For Sparkline components (needs number[])
  // Use Prometheus data if available (not internal metrics), regardless of active tab
  const nodesHistoryNumbers =
    !isInternalMetrics && metricsHistory?.data
      ? metricsHistory.data.map((d) => d.node_count)
      : nodesHistorySparkline;

  const indicesHistoryNumbers =
    !isInternalMetrics && metricsHistory?.data
      ? metricsHistory.data.map((d) => d.index_count || 0)
      : indicesHistorySparkline;

  const documentsHistoryNumbers =
    !isInternalMetrics && metricsHistory?.data
      ? metricsHistory.data.map((d) => d.document_count || 0)
      : documentsHistorySparkline;

  const shardsHistoryNumbers =
    !isInternalMetrics && metricsHistory?.data
      ? metricsHistory.data.map((d) => d.shard_count || 0)
      : shardsHistorySparkline;

  const unassignedHistoryNumbers =
    !isInternalMetrics && metricsHistory?.data
      ? metricsHistory.data.map((d) => d.unassigned_shards || 0)
      : unassignedHistorySparkline;

  // Pagination state for nodes, indices, and shards
  const [nodesPage, setNodesPage] = useState(1);
  const [indicesPage, setIndicesPage] = useState(1);
  const [shardsPage, setShardsPage] = useState(1);

  // Fetch nodes with auto-refresh, pagination, and server-side filtering
  // Memoize filters to prevent query key from changing unnecessarily
  const nodesFilters = useMemo(() => ({
    search: searchParams.get('nodesSearch') || '',
    roles: searchParams.get('nodeRoles') || '', // comma-separated roles
  }), [searchParams]);

  const {
    data: nodesPaginated,
    isLoading: nodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ['cluster', id, 'nodes', nodesPage, nodesFilters],
    queryFn: () => apiClient.getNodes(id!, nodesPage, 50, nodesFilters),
    refetchInterval: refreshInterval,
    enabled: !!id, // Always fetch when cluster ID exists (needed for topology)
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Extract nodes array from paginated response (default to empty array while loading)
  const nodesArray: NodeInfo[] = nodesPaginated?.items ?? [];

  // Fetch indices with auto-refresh, pagination, and server-side filtering
  const indicesFilters = {
    search: searchParams.get('indicesSearch') || '',
    health: searchParams.get('health')?.split(',').filter(Boolean) || ['green', 'yellow', 'red', 'unknown'],
    status: searchParams.get('status')?.split(',').filter(Boolean) || ['open', 'close'],
    showSpecial: searchParams.get('showSpecial') === 'true', // Default to false (hidden)
    affected: searchParams.get('affected') === 'true',
  };

  const {
    data: indicesPaginated,
    isLoading: indicesLoading,
    error: indicesError,
  } = useQuery({
    queryKey: ['cluster', id, 'indices', indicesPage, indicesFilters],
    queryFn: () => apiClient.getIndices(id!, indicesPage, 50, indicesFilters),
    refetchInterval: refreshInterval,
    enabled: !!id && activeTab === 'indices', // Only fetch when in indices tab
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Fetch ALL indices for topology view (unfiltered, unpaginated)
  const {
    data: allIndicesPaginated,
    isLoading: allIndicesLoading,
    error: allIndicesError,
  } = useQuery({
    queryKey: ['cluster', id, 'indices', 'all'],
    queryFn: () => apiClient.getIndices(id!, 1, 10000, { showSpecial: true }), // Fetch all with no filters
    refetchInterval: refreshInterval,
    enabled: !!id, // Always fetch when cluster ID exists (needed for topology)
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Extract indices array from paginated response (default to empty array while loading)
  const indicesArray: IndexInfo[] = indicesPaginated?.items ?? [];

  // Use all indices for topology
  const allIndicesArray: IndexInfo[] = allIndicesPaginated?.items ?? [];
  
  // Calculate hidden indices count from ALL indices (for statistics tab)
  const hiddenIndicesCount = allIndicesArray.filter((idx) => idx.name.startsWith('.')).length;

  // Fetch shards with auto-refresh, pagination, and server-side filtering
  const shardsFilters = useMemo(() => ({
    state: searchParams.get('shardStates') || '', // comma-separated states
    search: searchParams.get('shardsSearch') || '', // search both index and node (OR logic)
  }), [searchParams]);

  const {
    data: shardsPaginated,
    isLoading: shardsLoading,
    error: shardsError,
  } = useQuery({
    queryKey: ['cluster', id, 'shards', shardsPage, shardsFilters],
    queryFn: () => apiClient.getShards(id!, shardsPage, 50, shardsFilters),
    refetchInterval: refreshInterval,
    enabled: !!id && activeTab === 'shards', // Only fetch when in shards tab
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Fetch ALL shards for topology view (unfiltered, unpaginated)
  const {
    data: allShardsPaginated,
    isLoading: allShardsLoading,
    error: allShardsError,
  } = useQuery({
    queryKey: ['cluster', id, 'shards', 'all'],
    queryFn: () => apiClient.getShards(id!, 1, 10000, {}), // Fetch all with no filters
    refetchInterval: refreshInterval,
    enabled: !!id, // Always fetch when cluster ID exists (needed for topology)
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Extract shards array from paginated response (default to empty array while loading)
  const shards: ShardInfo[] = shardsPaginated?.items ?? [];
  
  // Use all shards for topology
  const allShards: ShardInfo[] = allShardsPaginated?.items ?? [];

  // Create shorter aliases for backward compatibility with rest of code
  const nodes = nodesArray;
  const indices = indicesArray;

  // Detect cluster topology changes and show notifications
  // Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
  const clusterChanges = useClusterChanges(id || '', nodesArray, allIndicesArray);

  if (!id) {
    return (
      <Stack p="md">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </Stack>
    );
  }

  if (statsLoading) {
    return (
      <Stack p="md" gap="md">
        <Skeleton height={40} radius="sm" />
        <Grid>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={80} radius="md" />
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={80} radius="md" />
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={80} radius="md" />
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 3 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={80} radius="md" />
            </Card>
          </Grid.Col>
        </Grid>
        <Skeleton height={400} radius="md" />
      </Stack>
    );
  }

  if (statsError) {
    return (
      <Stack p="md">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load cluster information: {(statsError as Error).message}
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      {/* Cluster change notifications - Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6 */}
      <ClusterChangeNotifier clusterId={id} changes={clusterChanges} />
      
      {/* Cluster Name with Version */}
      <div>
        <Group gap="xs" wrap="nowrap" justify="space-between">
          <Group gap="xs" wrap="nowrap">
            <Title order={1} className="text-responsive-xl">
              {clusterName}
            </Title>
            {stats?.esVersion && (
              <Text size="lg" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                {stats.esVersion}
              </Text>
            )}
          </Group>
          {/* Allocation Lock Indicator - Requirements: 2.1, 2.2, 2.7 */}
          {clusterSettings && (
            <AllocationLockIndicator
              allocationState={allocationState}
              clusterName={clusterName}
              clusterVersion={stats?.esVersion || 'unknown'}
            />
          )}
        </Group>
      </div>

      {/* Health Status Progress Bar - always visible */}
      <Progress
        value={100}
        color={getHealthColor(stats?.health || 'red')}
        size="sm"
        radius="xs"
        aria-label={`Cluster health: ${stats?.health || 'unknown'}`}
      />

      {/* Section Navigation - conditional rendering instead of Tabs */}
      {/* Overview Section */}
      {activeTab === 'overview' && (
        <Stack gap="md">
          {/* First Row: Nodes, Indices, Shards */}
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
              <Card
                shadow="sm"
                padding="md"
                style={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleTabChange('nodes')}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed">
                        Nodes
                      </Text>
                      <Text size="xl" fw={700}>
                        {stats?.numberOfNodes || 0}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {stats?.numberOfDataNodes || 0} data
                    </Text>
                  </Group>
                  {nodesHistoryNumbers.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline
                        data={nodesHistoryNumbers}
                        color="var(--mantine-color-blue-6)"
                        height={25}
                      />
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
              <Card
                shadow="sm"
                padding="md"
                style={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleTabChange('indices')}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed">
                        Indices
                      </Text>
                      <Text size="xl" fw={700}>
                        {stats?.numberOfIndices || 0}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {stats?.numberOfDataNodes || 0} data
                    </Text>
                  </Group>
                  {indicesHistoryNumbers.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline
                        data={indicesHistoryNumbers}
                        color="var(--mantine-color-green-6)"
                        height={25}
                      />
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
              <Card
                shadow="sm"
                padding="md"
                style={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleTabChange('shards')}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed">
                        Shards
                      </Text>
                      <Text size="xl" fw={700}>
                        {stats?.activeShards || 0}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {stats?.activePrimaryShards || 0} primary
                    </Text>
                  </Group>
                  {shardsHistoryNumbers.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline
                        data={shardsHistoryNumbers}
                        color="var(--mantine-color-violet-6)"
                        height={25}
                      />
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Second Row: Documents, Unassigned, Disk Usage */}
          <Grid>
            <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
              <Card
                shadow="sm"
                padding="md"
                style={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleTabChange('indices')}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed">
                        Documents
                      </Text>
                      <Text size="xl" fw={700}>
                        {(stats?.numberOfDocuments || 0).toLocaleString()}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      total
                    </Text>
                  </Group>
                  {documentsHistoryNumbers.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline
                        data={documentsHistoryNumbers}
                        color="var(--mantine-color-cyan-6)"
                        height={25}
                      />
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
              <Card
                shadow="sm"
                padding="md"
                style={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleTabChange('shards')}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed">
                        Unassigned
                      </Text>
                      <Text size="xl" fw={700} c={stats?.unassignedShards ? 'red' : undefined}>
                        {stats?.unassignedShards || 0}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {stats?.relocatingShards || 0} moving
                    </Text>
                  </Group>
                  {unassignedHistoryNumbers.length > 0 && (
                    <div style={{ marginTop: 4 }}>
                      <Sparkline
                        data={unassignedHistoryNumbers}
                        color={
                          stats?.unassignedShards
                            ? 'var(--mantine-color-red-6)'
                            : 'var(--mantine-color-gray-6)'
                        }
                        height={25}
                      />
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>

            <Grid.Col span={{ base: 12, sm: 4, md: 4 }}>
              <Card
                shadow="sm"
                padding="md"
                style={{ cursor: 'pointer', height: '100%' }}
                onClick={() => handleTabChange('nodes')}
              >
                <Stack gap={4}>
                  <Group justify="space-between" wrap="nowrap">
                    <div style={{ flex: 1 }}>
                      <Text size="xs" c="dimmed">
                        Disk Usage
                      </Text>
                      <Text size="xl" fw={700}>
                        {stats?.diskUsed && stats?.diskTotal
                          ? formatBytes(stats.diskUsed)
                          : '0 B'}
                      </Text>
                    </div>
                    <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                      {stats?.diskTotal ? ` / ${formatBytes(stats.diskTotal)}` : ''}
                    </Text>
                  </Group>
                  {stats?.diskUsed && stats?.diskTotal && (
                    <div style={{ marginTop: 4 }}>
                      <Text size="xs" c="dimmed">
                        {formatPercentRatio(stats.diskUsed, stats.diskTotal)}% used
                      </Text>
                    </div>
                  )}
                </Stack>
              </Card>
            </Grid.Col>
          </Grid>

          {/* Resource Usage: CPU, Memory, Disk */}
          {(stats?.cpuPercent !== undefined || stats?.memoryTotal || stats?.diskTotal) && (
            <Grid>
              {stats?.cpuPercent !== undefined && (
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Card shadow="sm" padding="lg">
                    <ProgressWithLabel
                      label="CPU Usage"
                      value={stats.cpuPercent}
                      color={getColor(stats.cpuPercent)}
                      description={`${stats.cpuPercent.toFixed(1)}%`}
                    />
                  </Card>
                </Grid.Col>
              )}

              {stats?.memoryTotal && (
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Card shadow="sm" padding="lg">
                    <ProgressWithLabel
                      label="Memory Usage"
                      value={formatPercentRatio(stats.memoryUsed || 0, stats.memoryTotal)}
                      color={getColor(formatPercentRatio(stats.memoryUsed || 0, stats.memoryTotal))}
                      description={`${formatBytes(stats.memoryUsed || 0)} / ${formatBytes(stats.memoryTotal)} (${formatPercentRatio(stats.memoryUsed || 0, stats.memoryTotal)}%)`}
                    />
                  </Card>
                </Grid.Col>
              )}

              {stats?.diskTotal && (
                <Grid.Col span={{ base: 12, md: 4 }}>
                  <Card shadow="sm" padding="lg">
                    <ProgressWithLabel
                      label="Disk Usage"
                      value={formatPercentRatio(stats.diskUsed || 0, stats.diskTotal)}
                      color={getColor(formatPercentRatio(stats.diskUsed || 0, stats.diskTotal))}
                      description={`${formatBytes(stats.diskUsed || 0)} / ${formatBytes(stats.diskTotal)} (${formatPercentRatio(stats.diskUsed || 0, stats.diskTotal)}%)`}
                    />
                  </Card>
                </Grid.Col>
              )}
            </Grid>
          )}
        </Stack>
      )}

      {/* Topology Section */}
      {activeTab === 'topology' && (
        <Stack gap="md">
          {/* Shared Filter Bar */}
          <Card shadow="sm" padding="xs">
            <ShardAllocationGridFilters
              searchParams={searchParams}
              setSearchParams={setSearchParams}
              indices={indices}
              shards={shards}
              nodes={nodes}
              shardAllocationEnabled={shardAllocationEnabled}
              enableAllocationMutation={enableAllocationMutation}
              disableAllocationMutation={disableAllocationMutation}
              indexNameFilter={indexNameFilter}
              setIndexNameFilter={setIndexNameFilter}
              nodeNameFilter={nodeNameFilter}
              setNodeNameFilter={setNodeNameFilter}
            />
          </Card>

          {/* Relocation Banner */}
          {relocationMode && relocationShard && (
            <Alert
              color="violet"
              variant="light"
              icon={<IconArrowsRightLeft size={20} />}
              title="Relocation Mode"
            >
              <Group justify="space-between">
                <Text size="sm">
                  <Text component="span" fw={600}>Select destination for shard {relocationShard.shard}</Text>
                  {relocationShard.primary ? ' (Primary)' : ' (Replica)'} of index "{relocationShard.index}". Purple dashed boxes show valid destinations.
                </Text>
                <Button
                  size="xs"
                  color="red"
                  variant="filled"
                  onClick={handleTopologyCancelRelocation}
                  disabled={relocationInProgress}
                >
                  Cancel Relocation
                </Button>
              </Group>
            </Alert>
          )}

          {/* Topology View Title and Tabs */}
          <Group justify="space-between" wrap="nowrap">
            <Text size="lg" fw={700}>Topology View</Text>
            <Tabs
              value={topologyViewType}
              onChange={(value) => setTopologyViewType(value as 'dot' | 'index')}
            >
              <Tabs.List>
                <Tabs.Tab value="dot">Dot View</Tabs.Tab>
                <Tabs.Tab value="index">Index View</Tabs.Tab>
              </Tabs.List>
            </Tabs>
          </Group>

          {/* View Content */}
          <Card shadow="sm" padding="lg">
            {topologyViewType === 'dot' ? (
              <DotBasedTopologyView
                nodes={nodes || []}
                shards={allShards || []}
                indices={allIndicesArray || []}
                searchParams={searchParams}
                onShardClick={handleTopologyShardClick}
                onNodeClick={openNodeModal}
                relocationMode={relocationMode}
                validDestinationNodes={validDestinationNodes}
                onDestinationClick={handleTopologyDestinationClick}
                indexNameFilter={indexNameFilter}
                nodeNameFilter={nodeNameFilter}
                matchesWildcard={matchesWildcard}
                clusterId={id}
                topologyBatchSize={4}
                _topologyRetryCount={0}
              />
            ) : (
              <ShardAllocationGrid
                nodes={nodes || []}
                shards={allShards || []}
                indices={allIndicesArray || []}
                loading={nodesLoading || allIndicesLoading || allShardsLoading}
                error={nodesError || allIndicesError || allShardsError}
                openIndexModal={openIndexModal}
                openNodeModal={openNodeModal}
                searchParams={searchParams}
                setSearchParams={setSearchParams}
                sharedRelocationMode={relocationMode}
                sharedValidDestinationNodes={validDestinationNodes}
                onSharedDestinationClick={handleTopologyDestinationClick}
                onSharedRelocationCancel={handleTopologyCancelRelocation}
                onSharedSelectForRelocation={handleTopologySelectForRelocation}
                indexNameFilter={indexNameFilter}
                nodeNameFilter={nodeNameFilter}
                matchesWildcard={matchesWildcard}
              />
            )}
          </Card>

          {/* Shared Context Menu */}
          {topologyContextMenuShard && (
            <ShardContextMenu
              shard={topologyContextMenuShard}
              opened={topologyContextMenuOpened}
              position={topologyContextMenuPosition}
              onClose={handleTopologyContextMenuClose}
              onShowStats={(shard) => {
                setTopologyContextMenuShard(shard);
                openIndexModal(shard.index);
                handleTopologyContextMenuClose();
              }}
              onSelectForRelocation={handleTopologySelectForRelocation}
            />
          )}

          {/* Shared Confirmation Modal */}
          <Modal
            opened={relocationConfirmOpened}
            onClose={() => setRelocationConfirmOpened(false)}
            title="Confirm Shard Relocation"
            centered
            size="md"
          >
            <Stack gap="md">
              <Text size="sm">You are about to relocate the following shard:</Text>
              <Card withBorder padding="md">
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Index:</Text>
                    <Text size="sm" fw={600}>{relocationShard?.index}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Shard Number:</Text>
                    <Text size="sm" fw={600}>{relocationShard?.shard}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Shard Type:</Text>
                    <Badge size="sm" color={relocationShard?.primary ? 'blue' : 'gray'}>
                      {relocationShard?.primary ? 'Primary' : 'Replica'}
                    </Badge>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Source Node:</Text>
                    <Text size="sm" fw={600}>{relocationSourceNode?.name}</Text>
                  </Group>
                  <Group justify="space-between">
                    <Text size="sm" c="dimmed">Destination Node:</Text>
                    <Text size="sm" fw={600} c="violet">{relocationDestinationNode?.name}</Text>
                  </Group>
                </Stack>
              </Card>
              <Text size="sm" c="dimmed">
                This operation will move the shard from {relocationSourceNode?.name} to {relocationDestinationNode?.name}. The shard will be temporarily unavailable during relocation.
              </Text>
              <Group justify="flex-end">
                <Button variant="subtle" color="gray" onClick={() => setRelocationConfirmOpened(false)} disabled={relocationInProgress}>Cancel</Button>
                <Button color="violet" onClick={handleTopologyConfirmRelocation} loading={relocationInProgress}>Relocate Shard</Button>
              </Group>
            </Stack>
          </Modal>
        </Stack>
      )}

      {/* Statistics Section */}
      {activeTab === 'statistics' && (
        <Stack gap="md">
          {/* Time Range Dropdown - Top Right */}
          <Group justify="space-between" mb="md">
            <Group gap="xs">
              <Text size="sm" fw={500}>
                Cluster Statistics
              </Text>
              <Badge
                size="sm"
                variant="light"
                color={clusterInfo?.metrics_source === 'prometheus' ? 'blue' : 'green'}
              >
                {clusterInfo?.metrics_source === 'prometheus' ? 'Prometheus' : 'Internal'}
              </Badge>
            </Group>
            {/* Only show time range selector for Prometheus metrics */}
            {!isInternalMetrics && (
              <Menu
                opened={timeRangeDropdownOpened}
                onChange={setTimeRangeDropdownOpened}
                position="bottom-end"
                withArrow
              >
                <Menu.Target>
                  <Button
                    variant="light"
                    size="sm"
                    leftSection={<IconClock size={16} />}
                    rightSection={
                      <Text size="xs" c="dimmed">
                        {selectedTimeRange?.label || 'Last 24h'}
                      </Text>
                    }
                    aria-label="Select time range"
                  >
                    Time Range
                  </Button>
                </Menu.Target>

                <Menu.Dropdown>
                  <Text size="xs" c="dimmed" px="sm" py="xs">
                    Select time range
                  </Text>
                  {TIME_RANGE_PRESETS.map((preset) => (
                    <Menu.Item
                      key={preset.label}
                      onClick={() => {
                        const newParams = new URLSearchParams(searchParams);
                        newParams.set('timeRange', preset.minutes.toString());
                        setSearchParams(newParams);
                        setTimeRangeDropdownOpened(false);
                      }}
                      leftSection={
                        selectedTimeRange?.label === preset.label ? (
                          <Badge size="xs" variant="filled" color="blue">
                            ✓
                          </Badge>
                        ) : null
                      }
                    >
                      {preset.label}
                    </Menu.Item>
                  ))}
                </Menu.Dropdown>
              </Menu>
            )}
          </Group>

          <ClusterStatistics
            nodesHistory={nodesHistory as DataPoint[]}
            cpuHistory={cpuHistory as DataPoint[]}
            cpuSeries={cpuSeries}
            memoryHistory={memoryHistory as DataPoint[]}
            memorySeries={memorySeries}
            indicesHistory={indicesHistory as DataPoint[]}
            documentsHistory={documentsHistory as DataPoint[]}
            shardsHistory={shardsHistory as DataPoint[]}
            unassignedHistory={unassignedHistory as DataPoint[]}
            diskUsageHistory={diskUsageHistory as DataPoint[]}
            stats={stats}
            nodes={nodes}
            prometheusQueries={prometheusQueries}
            showHiddenIndices={showHiddenIndices}
            onToggleHiddenIndices={setShowHiddenIndices}
            hiddenIndicesCount={hiddenIndicesCount}
            allIndices={allIndicesArray}
          />
        </Stack>
      )}

      {/* Nodes Section */}
      {activeTab === 'nodes' && (
        <Stack gap="md" style={{ width: '100%' }}>
          <NodesList
            nodes={nodes}
            loading={nodesLoading}
            error={nodesError}
            openNodeModal={openNodeModal}
            nodesSearch={localNodesSearch}
            setNodesSearch={setNodesSearch}
          />
          {nodesPaginated && nodesPaginated.total_pages > 1 && (
            <SimplePagination
              currentPage={nodesPage}
              totalPages={nodesPaginated.total_pages}
              pageSize={50}
              totalItems={nodesPaginated.total}
              onPageChange={setNodesPage}
            />
          )}
        </Stack>
      )}

      {/* Indices Section */}
      {activeTab === 'indices' && (
        <Stack gap="md" style={{ width: '100%' }}>
          <IndicesList
             indices={indices}
             indicesPaginated={indicesPaginated}
             loading={indicesLoading}
             error={indicesError}
             openIndexModal={openIndexModal}
             indicesSearch={localIndicesSearch}
             setIndicesSearch={setIndicesSearch}
           />
          {indicesPaginated && indicesPaginated.total_pages > 1 && (
            <SimplePagination
              currentPage={indicesPage}
              totalPages={indicesPaginated.total_pages}
              pageSize={50}
              totalItems={indicesPaginated.total}
              onPageChange={setIndicesPage}
            />
          )}
        </Stack>
      )}

      {/* Shards Section */}
      {activeTab === 'shards' && (
        <Stack gap="md" style={{ width: '100%' }}>
          <ShardsList
            shards={shards}
            loading={shardsLoading}
            error={shardsError}
            openNodeModal={openNodeModal}
          />
          {shardsPaginated && shardsPaginated.total_pages > 1 && (
            <SimplePagination
              currentPage={shardsPage}
              totalPages={shardsPaginated.total_pages}
              pageSize={50}
              totalItems={shardsPaginated.total}
              onPageChange={setShardsPage}
            />
          )}
        </Stack>
      )}

      {/* Console Section */}
      {activeTab === 'console' && <RestConsole />}

      {/* Tasks Section */}
      {activeTab === 'tasks' && <TasksTab clusterId={id!} refreshInterval={refreshInterval || undefined} />}

      {/* Index Edit Modal */}
      {selectedIndexName && (
        <Modal.Root opened={indexModalOpen} onClose={closeIndexModal} size="90%">
          <Modal.Overlay />
          <Modal.Content
            style={{
              maxWidth: '100%',
            }}
          >
            <Modal.Header>
              <Modal.Title>
                <Group gap="xs">
                  <Text size="lg" fw={600}>
                    Index Details:
                  </Text>
                  <Badge size="lg" variant="light" color="blue">
                    {selectedIndexName}
                  </Badge>
                </Group>
              </Modal.Title>
              <Modal.CloseButton />
            </Modal.Header>
            <Modal.Body
              style={{
                maxHeight: 'calc(100vh - 120px)',
                overflow: 'auto',
              }}
            >
              <IndexEdit constrainToParent hideHeader />
            </Modal.Body>
          </Modal.Content>
        </Modal.Root>
      )}

      {/* Node Modal */}
      <NodeModal
        clusterId={id!}
        nodeId={nodeIdFromPath || null}
        opened={nodeModalOpen}
        onClose={closeNodeModal}
        context={activeTab === 'topology' ? 'topology' : activeTab === 'nodes' ? 'nodes' : 'shards'}
        clusterInfo={clusterInfo}
      />
    </Stack>
  );
}

/**
 * NodesList component displays the list of nodes with search and role filtering
 * Requirements: 4.6, 14.1, 14.2, 14.3, 14.4, 14.5, 31.7
 */

interface NodesSortableHeaderProps {
  column: 'name' | 'roles' | 'uptime' | 'heap' | 'disk' | 'cpu';
  label: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'name' | 'roles' | 'uptime' | 'heap' | 'disk' | 'cpu') => void;
}

function NodesSortableHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: NodesSortableHeaderProps) {
  const renderNodesSortIcon = () => {
    if (sortColumn !== column) {
      return <IconSelector size={14} opacity={0.4} aria-hidden="true" />;
    }
    return sortDirection === 'asc' ? (
      <IconChevronUp size={14} aria-hidden="true" />
    ) : (
      <IconChevronDown size={14} aria-hidden="true" />
    );
  };

  return (
    <UnstyledButton
      onClick={() => onSort(column)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        fontWeight: 500,
      }}
      aria-label={`Sort by ${label}`}
    >
      <Text fw={500}>{label}</Text>
      {renderNodesSortIcon()}
    </UnstyledButton>
  );
}

const NodesList = memo(function NodesList({
  nodes,
  loading,
  error,
  openNodeModal,
  nodesSearch,
  setNodesSearch,
}: {
  nodes?: NodeInfo[];
  loading: boolean;
  error: Error | null;
  openNodeModal?: (nodeId: string) => void;
  nodesSearch: string;
  setNodesSearch: (value: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);

  // Get filters from URL
  const searchQuery = nodesSearch; // Use prop instead of URL param directly
  
  // Get role filters from URL to send to backend
  const nodeRolesParam = searchParams.get('nodeRoles') || '';
  const selectedRoles = nodeRolesParam.split(',').filter(Boolean);
  
  const expandedView = searchParams.get('nodesExpanded') === 'true';

  // Column sorting state for nodes
  const nodesSortColumn = (searchParams.get('nodesSortColumn') || 'name') as
    | 'name'
    | 'roles'
    | 'uptime'
    | 'heap'
    | 'disk'
    | 'cpu';
  const nodesSortDirection = (searchParams.get('nodesSortDir') || 'asc') as 'asc' | 'desc';

  // Update URL when filters change (but NOT search - that's handled by parent)
  const updateFilters = (newRoles?: string[], newExpanded?: boolean) => {
    const params = new URLSearchParams(searchParams);

    if (newRoles !== undefined) {
      if (newRoles.length > 0) {
        params.set('nodeRoles', newRoles.join(','));
      } else {
        params.delete('nodeRoles');
      }
    }

    if (newExpanded !== undefined) {
      if (newExpanded) {
        params.set('nodesExpanded', 'true');
      } else {
        params.delete('nodesExpanded');
      }
    }

    setSearchParams(params);
  };

  const toggleRole = (role: string) => {
    const newRoles = selectedRoles.includes(role)
      ? selectedRoles.filter((r) => r !== role)
      : [...selectedRoles, role];
    updateFilters(newRoles, undefined);
  };

  // Handle nodes table column sort
  const handleNodesSortColumn = (column: 'name' | 'roles' | 'uptime' | 'heap' | 'disk' | 'cpu') => {
    const newParams = new URLSearchParams(searchParams);
    if (nodesSortColumn === column) {
      // Toggle direction or reset sort
      if (nodesSortDirection === 'asc') {
        newParams.set('nodesSortDir', 'desc');
      } else {
        newParams.delete('nodesSortColumn');
        newParams.delete('nodesSortDir');
      }
    } else {
      newParams.set('nodesSortColumn', column);
      newParams.set('nodesSortDir', 'asc');
    }
    setSearchParams(newParams);
  };

  // Server-side filtering is already applied - no client-side filtering needed
  // Memoize filtered nodes to prevent dependency issues in other useMemo hooks
  const filteredNodes = useMemo(() => nodes || [], [nodes]);
  
  // Get all unique roles from nodes for the filter UI
  const allRoles = Array.from(new Set(nodes?.flatMap((n) => n.roles) || []));

  // Apply sorting by selected column or default master-first sorting
  // Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
  // Memoize sorted nodes to prevent unnecessary recalculations
  const sortedNodes = useMemo(() => {
    let sorted = filteredNodes ? [...filteredNodes] : [];

    if (nodesSortColumn === 'name' && nodesSortDirection) {
      // Custom column sort
      sorted.sort((a, b) => {
        const compareResult = a.name.localeCompare(b.name);
        return nodesSortDirection === 'asc' ? compareResult : -compareResult;
      });
    } else if (nodesSortColumn === 'uptime' && nodesSortDirection) {
      sorted.sort((a, b) => {
        const aValue = a.uptimeMillis || 0;
        const bValue = b.uptimeMillis || 0;
        return nodesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      });
    } else if (nodesSortColumn === 'heap' && nodesSortDirection) {
      sorted.sort((a, b) => {
        const aPercent = (a.heapUsed / a.heapMax) * 100;
        const bPercent = (b.heapUsed / b.heapMax) * 100;
        return nodesSortDirection === 'asc' ? aPercent - bPercent : bPercent - aPercent;
      });
    } else if (nodesSortColumn === 'disk' && nodesSortDirection) {
      sorted.sort((a, b) => {
        const aPercent = (a.diskUsed / a.diskTotal) * 100;
        const bPercent = (b.diskUsed / b.diskTotal) * 100;
        return nodesSortDirection === 'asc' ? aPercent - bPercent : bPercent - aPercent;
      });
    } else if (nodesSortColumn === 'cpu' && nodesSortDirection) {
      sorted.sort((a, b) => {
        const aValue = a.cpuPercent || 0;
        const bValue = b.cpuPercent || 0;
        return nodesSortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      });
    } else {
      // Default master-first sorting
      sorted = sortNodesMasterFirst(sorted);
    }

    return sorted;
  }, [filteredNodes, nodesSortColumn, nodesSortDirection]);

  if (loading) {
    return (
      <Stack gap="xs">
        <Skeleton height={60} radius="sm" />
        <Skeleton height={60} radius="sm" />
        <Skeleton height={60} radius="sm" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load nodes: {error.message}
      </Alert>
    );
  }

  // Show UI with "no results" message if filters are active, even if no nodes returned
  // Only show "No nodes found" if there are truly no nodes AND no filters active
  const hasActiveFilters = searchQuery || selectedRoles.length < allRoles.length;
  
  if ((!nodes || nodes.length === 0) && !hasActiveFilters && !loading) {
    return <Text c="dimmed">No nodes found</Text>;
  }

  return (
    <Stack gap="md">
      <NodeStatsCards nodes={sortedNodes || []} />
      
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="md" wrap="wrap" style={{ flex: 1 }}>
          <TextInput
            placeholder="Search nodes..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => setNodesSearch(e.currentTarget.value)}
            style={{ minWidth: 200 }}
          />
          {allRoles.length > 0 && (
            <RoleFilterToggle
              roles={allRoles.sort()}
              selectedRoles={selectedRoles}
              onToggle={toggleRole}
            />
          )}
        </Group>

        <Tooltip label={expandedView ? 'Collapse view' : 'Expand view'}>
          <ActionIcon
            variant="subtle"
            size="md"
            onClick={() => updateFilters(undefined, !expandedView)}
            aria-label={expandedView ? 'Collapse view' : 'Expand view'}
          >
            {expandedView ? <IconMinimize size={18} /> : <IconMaximize size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      <Card shadow="sm" padding="lg">
        {sortedNodes && sortedNodes.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No nodes match your filters
          </Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <NodesSortableHeader
                    column="name"
                    label="Name"
                    sortColumn={nodesSortColumn}
                    sortDirection={nodesSortDirection}
                    onSort={handleNodesSortColumn}
                  />
                </Table.Th>
                {expandedView && <Table.Th>Node ID</Table.Th>}
                <Table.Th>
                  <NodesSortableHeader
                    column="roles"
                    label="Roles"
                    sortColumn={nodesSortColumn}
                    sortDirection={nodesSortDirection}
                    onSort={handleNodesSortColumn}
                  />
                </Table.Th>
                <Table.Th>Version</Table.Th>
                {expandedView && <Table.Th>IP Address</Table.Th>}
                {expandedView && <Table.Th>Tags</Table.Th>}
                <Table.Th>Load</Table.Th>
                <Table.Th>
                  <NodesSortableHeader
                    column="uptime"
                    label="Uptime"
                    sortColumn={nodesSortColumn}
                    sortDirection={nodesSortDirection}
                    onSort={handleNodesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <NodesSortableHeader
                    column="heap"
                    label="Heap Usage"
                    sortColumn={nodesSortColumn}
                    sortDirection={nodesSortDirection}
                    onSort={handleNodesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <NodesSortableHeader
                    column="disk"
                    label="Disk Usage"
                    sortColumn={nodesSortColumn}
                    sortDirection={nodesSortDirection}
                    onSort={handleNodesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <NodesSortableHeader
                    column="cpu"
                    label="CPU"
                    sortColumn={nodesSortColumn}
                    sortDirection={nodesSortDirection}
                    onSort={handleNodesSortColumn}
                  />
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedNodes?.map((node) => (
                <Table.Tr key={node.id}>
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <MasterIndicator
                        isMaster={node.isMaster}
                        isMasterEligible={node.isMasterEligible}
                        size="md"
                      />
                      <div style={{ flex: 1 }}>
                        <Text
                          size="sm"
                          fw={500}
                          style={{ cursor: openNodeModal ? 'pointer' : 'default' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openNodeModal) {
                              openNodeModal(node.id);
                            } else {
                              navigate(`/cluster/${id}/nodes/${node.id}`);
                            }
                          }}
                        >
                          {node.name}
                        </Text>
                        {!expandedView && node.ip && (
                          <Text size="xs" c="dimmed">
                            {node.ip}
                          </Text>
                        )}
                      </div>
                      <CopyButton value={node.name} tooltip="Copy node name" size="xs" />
                    </Group>
                  </Table.Td>
                  {expandedView && (
                    <Table.Td>
                      <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                        {node.id}
                      </Text>
                    </Table.Td>
                  )}
                  <Table.Td>
                    {expandedView ? (
                      <Group gap="xs">
                        {node.roles.map((role) => (
                          <Badge key={role} size="sm" variant="light">
                            {role.toLowerCase()}
                          </Badge>
                        ))}
                      </Group>
                    ) : (
                      <RoleIcons roles={node.roles} size={16} />
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Text size="sm" c="dimmed">
                      {node.version || '-'}
                    </Text>
                  </Table.Td>
                  {expandedView && (
                    <Table.Td>
                      <Text size="sm" c="dimmed">
                        {node.ip || '-'}
                      </Text>
                    </Table.Td>
                  )}
                  {expandedView && (
                    <Table.Td>
                      {node.tags && node.tags.length > 0 ? (
                        <Group gap="xs">
                          {node.tags.map((tag) => (
                            <Badge key={tag} size="sm" variant="outline" color="gray">
                              {tag}
                            </Badge>
                          ))}
                        </Group>
                      ) : (
                        <Text size="xs" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                  )}
                  <Table.Td>
                    {node.loadAverage !== undefined ? (
                      <Text
                        size="sm"
                        c={getLoadColor(node.loadAverage)}
                        style={{ fontFamily: 'monospace' }}
                      >
                        {formatLoadAverage(node.loadAverage)}
                      </Text>
                    ) : (
                      <Text size="sm" c="dimmed">
                        N/A
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    {node.uptime ? (
                      <Tooltip label={formatUptimeDetailed(node.uptimeMillis || 0)}>
                        <Text size="sm" c="dimmed">
                          {node.uptime}
                        </Text>
                      </Tooltip>
                    ) : (
                      <Text size="sm" c="dimmed">
                        N/A
                      </Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Progress
                        value={formatPercentRatio(node.heapUsed, node.heapMax)}
                        color={getColor(formatPercentRatio(node.heapUsed, node.heapMax))}
                        size="sm"
                        radius="xs"
                      />
                      <Text size="xs" c="dimmed">
                        {formatBytes(node.heapUsed)} / {formatBytes(node.heapMax)}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Progress
                        value={formatPercentRatio(node.diskUsed, node.diskTotal)}
                        color={getColor(formatPercentRatio(node.diskUsed, node.diskTotal))}
                        size="sm"
                        radius="xs"
                      />
                      <Text size="xs" c="dimmed">
                        {formatBytes(node.diskUsed)} / {formatBytes(node.diskTotal)}
                      </Text>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    {node.cpuPercent !== undefined ? (
                      <Stack gap={4}>
                        <Progress
                          value={node.cpuPercent}
                          color={getColor(node.cpuPercent)}
                          size="sm"
                          radius="xs"
                        />
                        <Text size="xs" c="dimmed">
                          {node.cpuPercent}%
                        </Text>
                      </Stack>
                    ) : (
                      <Text size="sm" c="dimmed">
                        N/A
                      </Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        )}
      </Card>
    </Stack>
  );
});

/**
 * IndicesList component displays the list of indices with search and filtering
 * Requirements: 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 7.1, 8.1, 31.7
 */

interface SortableHeaderProps {
  column: 'name' | 'health' | 'status' | 'documents' | 'size';
  label: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'name' | 'health' | 'status' | 'documents' | 'size') => void;
}

function SortableHeader({ column, label, sortColumn, sortDirection, onSort }: SortableHeaderProps) {
  const renderSortIcon = () => {
    if (sortColumn !== column) {
      return <IconSelector size={14} opacity={0.4} aria-hidden="true" />;
    }
    return sortDirection === 'asc' ? (
      <IconChevronUp size={14} aria-hidden="true" />
    ) : (
      <IconChevronDown size={14} aria-hidden="true" />
    );
  };

  return (
    <UnstyledButton
      onClick={() => onSort(column)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        fontWeight: 500,
      }}
      aria-label={`Sort by ${label}`}
    >
      <Text fw={500}>{label}</Text>
      {renderSortIcon()}
    </UnstyledButton>
  );
}

const IndicesList = memo(function IndicesList({
  indices,
  indicesPaginated,
  loading,
  error,
  openIndexModal,
  indicesSearch,
  setIndicesSearch,
}: {
  indices?: IndexInfo[];
  indicesPaginated?: PaginatedResponse<IndexInfo>;
  loading: boolean;
  error: Error | null;
  openIndexModal: (indexName: string, tab?: string) => void;
  indicesSearch: string;
  setIndicesSearch: (value: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Get filters from URL
  const searchQuery = searchParams.get('indicesSearch') || '';
  const selectedHealth = searchParams.get('health')?.split(',').filter(Boolean) || [
    'green',
    'yellow',
    'red',
    'unknown',
  ];
  const selectedStatus = searchParams.get('status')?.split(',').filter(Boolean) || [
    'open',
    'close',
  ];
  const expandedView = searchParams.get('expanded') === 'true';
  const sortAscending = searchParams.get('sort') !== 'desc';
  const showOnlyAffected = searchParams.get('affected') === 'true';
  const showSpecialIndices = searchParams.get('showSpecial') === 'true'; // Default to false (hidden)

  // Column sorting state
  const indicesSortColumn = (searchParams.get('indicesSortColumn') || 'name') as
    | 'name'
    | 'health'
    | 'status'
    | 'documents'
    | 'size';
  const indicesSortDirection = (searchParams.get('indicesSortDir') || 'asc') as 'asc' | 'desc';

  // Confirmation modal state for close/delete operations
  const [confirmationModalOpened, setConfirmationModalOpened] = useState(false);
  const [confirmationAction, setConfirmationAction] = useState<{
    type: 'close' | 'delete';
    indexName: string;
  } | null>(null);

  // Bulk operations state
  const { selectedIndices, isSelected, toggleSelection, selectAll, clearSelection, count } =
    useBulkSelection();
  const [bulkModalOpened, setBulkModalOpened] = useState(false);
  const [selectedOperation, setSelectedOperation] = useState<BulkOperationType | null>(null);

  // Responsive default page size
  const defaultPageSize = useResponsivePageSize();

  // Pagination state
  const currentPage = parseInt(searchParams.get('indicesPage') || '1', 10);
  const pageSize = parseInt(searchParams.get('indicesPageSize') || defaultPageSize.toString(), 10);

  const handleIndicesPageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('indicesPage', page.toString());
    setSearchParams(params);
  };

  const handleIndicesPageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('indicesPageSize', size.toString());
    params.set('indicesPage', '1'); // Reset to first page when changing page size
    setSearchParams(params);
  };

  // Bulk operations handlers
  const handleBulkOperationSelect = (operation: BulkOperationType) => {
    setSelectedOperation(operation);
    setBulkModalOpened(true);
  };

  const handleBulkOperationConfirm = () => {
    if (!selectedOperation) return;

    switch (selectedOperation) {
      case 'open':
        bulkOpenMutation.mutate();
        break;
      case 'close':
        bulkCloseMutation.mutate();
        break;
      case 'delete':
        bulkDeleteMutation.mutate();
        break;
      case 'refresh':
        bulkRefreshMutation.mutate();
        break;
      case 'set_read_only':
        bulkSetReadOnlyMutation.mutate();
        break;
      case 'set_writable':
        bulkSetWritableMutation.mutate();
        break;
    }
  };

  const handleBulkSelectAll = () => {
    if (sortedIndices) {
      // If all are already selected, clear selection; otherwise select all
      const allSelected = sortedIndices.every((index) => selectedIndices.has(index.name));
      if (allSelected) {
        clearSelection();
      } else {
        selectAll(sortedIndices.map((index) => index.name));
      }
    }
  };

  // Debounced filtering uses searchQuery from URL
  // Requirements: 31.7 - Debounce user input in search and filter fields
  // The local state (localSearchInput) is debounced before updating URL (searchQuery)
  // This prevents focus loss while maintaining proper debounce timing

  // Fetch shards to identify unassigned/problem shards (paginated, extract items)
  const { data: shardsPaginatedForIndices } = useQuery({
    queryKey: ['cluster', id, 'shards'],
    queryFn: () => apiClient.getShards(id!),
    enabled: !!id,
  });

  // Extract shards array from paginated response (for use in IndicesList)
  const shards: ShardInfo[] = shardsPaginatedForIndices?.items ?? [];

  // Fetch cluster settings to check allocation status
  const { data: clusterSettings } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: async () => {
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        id!,
        'GET',
        '/_cluster/settings'
      );
      return response.data;
    },
    enabled: !!id,
  });

  // Check if shard allocation is enabled
  const shardAllocationEnabled = (() => {
    if (!clusterSettings) return true;

    const transient = clusterSettings.transient as Record<string, unknown> | undefined;
    const persistent = clusterSettings.persistent as Record<string, unknown> | undefined;

    const transientAllocation = transient?.cluster as Record<string, unknown> | undefined;
    const persistentAllocation = persistent?.cluster as Record<string, unknown> | undefined;

    const transientRouting = transientAllocation?.routing as Record<string, unknown> | undefined;
    const persistentRouting = persistentAllocation?.routing as Record<string, unknown> | undefined;

    const transientEnable = (transientRouting?.allocation as Record<string, unknown>)?.enable as
      | string
      | undefined;
    const persistentEnable = (persistentRouting?.allocation as Record<string, unknown>)?.enable as
      | string
      | undefined;

    const enableValue = transientEnable || persistentEnable || 'all';
    return enableValue === 'all';
  })();

  // Enable shard allocation mutation
  const enableAllocationMutation = useMutation({
    mutationFn: () =>
      apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': 'all',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Shard allocation enabled',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to enable shard allocation: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Disable shard allocation mutation
  const disableAllocationMutation = useMutation({
    mutationFn: (mode: string) =>
      apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': mode,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Shard allocation disabled',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to disable shard allocation: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Bulk operation mutations
  const bulkOpenMutation = useMutation({
    mutationFn: () => apiClient.bulkOpenIndices(id!, Array.from(selectedIndices)),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Opened ${selectedIndices.size} indices`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
      setBulkModalOpened(false);
      clearSelection();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to open indices: ${error.message}`,
        color: 'red',
      });
    },
  });

  const bulkCloseMutation = useMutation({
    mutationFn: () => apiClient.bulkCloseIndices(id!, Array.from(selectedIndices)),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Closed ${selectedIndices.size} indices`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
      setBulkModalOpened(false);
      clearSelection();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to close indices: ${error.message}`,
        color: 'red',
      });
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: () => apiClient.bulkDeleteIndices(id!, Array.from(selectedIndices)),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Deleted ${selectedIndices.size} indices`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
      setBulkModalOpened(false);
      clearSelection();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to delete indices: ${error.message}`,
        color: 'red',
      });
    },
  });

  const bulkRefreshMutation = useMutation({
    mutationFn: () => apiClient.bulkRefreshIndices(id!, Array.from(selectedIndices)),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Refreshed ${selectedIndices.size} indices`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
      setBulkModalOpened(false);
      clearSelection();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to refresh indices: ${error.message}`,
        color: 'red',
      });
    },
  });

  const bulkSetReadOnlyMutation = useMutation({
    mutationFn: () => apiClient.bulkSetIndexReadOnly(id!, Array.from(selectedIndices)),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Set ${selectedIndices.size} indices to read-only`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
      setBulkModalOpened(false);
      clearSelection();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to set indices to read-only: ${error.message}`,
        color: 'red',
      });
    },
  });

  const bulkSetWritableMutation = useMutation({
    mutationFn: () => apiClient.bulkSetIndexWritable(id!, Array.from(selectedIndices)),
    onSuccess: () => {
      notifications.show({
        title: 'Success',
        message: `Set ${selectedIndices.size} indices to writable`,
        color: 'green',
      });
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
      setBulkModalOpened(false);
      clearSelection();
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to set indices to writable: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Update URL when filters change
  const updateFilters = (newSearch?: string, newHealth?: string[], newStatus?: string[]) => {
    const params = new URLSearchParams(searchParams);

    if (newSearch !== undefined) {
      if (newSearch) {
        params.set('indicesSearch', newSearch);
      } else {
        params.delete('indicesSearch');
      }
    }

    if (newHealth !== undefined) {
      // If all health colors are selected, delete the parameter (no filter)
      if (newHealth.length === 4) {
        params.delete('health');
      } else if (newHealth.length > 0) {
        params.set('health', newHealth.join(','));
      } else {
        params.delete('health');
      }
    }

    if (newStatus !== undefined) {
      // If all statuses are selected, delete the parameter (no filter)
      if (newStatus.length === 2) {
        params.delete('status');
      } else if (newStatus.length > 0) {
        params.set('status', newStatus.join(','));
      } else {
        params.delete('status');
      }
    }

    setSearchParams(params);
  };

  const updateParam = (key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === false) {
      newParams.set(key, 'false');
    } else if (value === '' || value === undefined) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    setSearchParams(newParams);
  };

  // Handle indices table column sort
  const handleIndicesSortColumn = (column: 'name' | 'health' | 'status' | 'documents' | 'size') => {
    const newParams = new URLSearchParams(searchParams);
    if (indicesSortColumn === column) {
      // Toggle direction or reset sort
      if (indicesSortDirection === 'asc') {
        newParams.set('indicesSortDir', 'desc');
      } else {
        newParams.delete('indicesSortColumn');
        newParams.delete('indicesSortDir');
      }
    } else {
      newParams.set('indicesSortColumn', column);
      newParams.set('indicesSortDir', 'asc');
    }
    setSearchParams(newParams);
  };

  // Group shards by index to identify problem indices
  const shardsByIndex: Record<string, ShardInfo[]> = {};
  if (shards && shards.length > 0) {
    shards.forEach((shard: ShardInfo) => {
      if (!shardsByIndex[shard.index]) {
        shardsByIndex[shard.index] = [];
      }
      shardsByIndex[shard.index].push(shard);
    });
  }

  // Identify unassigned shards
  const unassignedShards =
    shards && shards.length > 0 ? shards.filter((s: ShardInfo) => s.state === 'UNASSIGNED') : [];
  const unassignedByIndex = unassignedShards.reduce(
    (acc: Record<string, ShardInfo[]>, shard: ShardInfo) => {
      if (!acc[shard.index]) {
        acc[shard.index] = [];
      }
      acc[shard.index].push(shard);
      return acc;
    },
    {} as Record<string, ShardInfo[]>
  );

  // Check if an index has problems
  const hasProblems = (indexName: string) => {
    const indexShards = shardsByIndex[indexName] || [];
    return indexShards.some(
      (s: ShardInfo) =>
        s.state === 'UNASSIGNED' || s.state === 'RELOCATING' || s.state === 'INITIALIZING'
    );
  };

  // Server-side filtering is already applied - no client-side filtering needed
  // Memoize filtered indices to prevent dependency issues in other useMemo hooks
  const filteredIndices = useMemo(() => indices || [], [indices]);

  // Sort indices by selected column (client-side sorting only)
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const sortedIndices = useMemo(() => {
    const sorted = [...filteredIndices];
    
    sorted.sort((a, b) => {
      let compareResult: number;

      switch (indicesSortColumn) {
        case 'name':
          compareResult = a.name.localeCompare(b.name);
          break;
        case 'health':
          compareResult = a.health.localeCompare(b.health);
          break;
        case 'status':
          compareResult = a.status.localeCompare(b.status);
          break;
        case 'documents':
          compareResult = a.docsCount - b.docsCount;
          break;
        case 'size':
          compareResult = a.storeSize - b.storeSize;
          break;
        default:
          compareResult = a.name.localeCompare(b.name);
      }

      return indicesSortDirection === 'asc' ? compareResult : -compareResult;
    });
    
    return sorted;
  }, [filteredIndices, indicesSortColumn, indicesSortDirection]);

  // Memoize stats calculation to prevent unnecessary re-renders
  const indexStats = useMemo(() => ({
    totalIndices: sortedIndices?.length || 0,
    greenIndices: sortedIndices?.filter((idx) => idx.health === 'green').length || 0,
    yellowIndices: sortedIndices?.filter((idx) => idx.health === 'yellow').length || 0,
    redIndices: sortedIndices?.filter((idx) => idx.health === 'red').length || 0,
    openIndices: sortedIndices?.filter((idx) => idx.status === 'open').length || 0,
    closedIndices: sortedIndices?.filter((idx) => idx.status === 'close').length || 0,
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  }), [sortedIndices]);

  if (loading) {
    return (
      <Stack gap="xs">
        <Skeleton height={60} radius="sm" />
        <Skeleton height={60} radius="sm" />
        <Skeleton height={60} radius="sm" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load indices: {error.message}
      </Alert>
    );
  }

  const hasAnyProblems = unassignedShards.length > 0;

  return (
    <Stack gap="md">
      {/* Index statistics cards */}
      <IndexStatsCards stats={indexStats} />

      {/* Toolbar with convenience actions */}
      <Group justify="space-between" wrap="wrap">
        <Group>
          {/* Shard allocation lock/unlock */}
          {shardAllocationEnabled ? (
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Tooltip label="Disable shard allocation">
                  <ActionIcon
                    size="lg"
                    variant="subtle"
                    color="green"
                    loading={disableAllocationMutation.isPending}
                  >
                    <IconLockOpen size={20} />
                  </ActionIcon>
                </Tooltip>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Disable Allocation</Menu.Label>
                <Menu.Item onClick={() => disableAllocationMutation.mutate('none')}>
                  <Group gap="xs">
                    <IconLock size={14} />
                    <Text size="sm">None (default)</Text>
                  </Group>
                </Menu.Item>
                <Menu.Item onClick={() => disableAllocationMutation.mutate('primaries')}>
                  <Group gap="xs">
                    <IconLock size={14} />
                    <Text size="sm">Primaries only</Text>
                  </Group>
                </Menu.Item>
                <Menu.Item onClick={() => disableAllocationMutation.mutate('new_primaries')}>
                  <Group gap="xs">
                    <IconLock size={14} />
                    <Text size="sm">New primaries only</Text>
                  </Group>
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>
          ) : (
            <Tooltip label="Enable shard allocation">
              <ActionIcon
                size="lg"
                variant="subtle"
                color="red"
                onClick={() => enableAllocationMutation.mutate()}
                loading={enableAllocationMutation.isPending}
              >
                <IconLock size={20} />
              </ActionIcon>
            </Tooltip>
          )}

          {/* Expand/compress view */}
          <Tooltip label={expandedView ? 'Compress view' : 'Expand view'}>
            <ActionIcon
              size="lg"
              variant="subtle"
              onClick={() => updateParam('expanded', !expandedView)}
            >
              {expandedView ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
            </ActionIcon>
          </Tooltip>

          {/* Sort ascending/descending */}
          <Tooltip label={sortAscending ? 'Sort descending' : 'Sort ascending'}>
            <ActionIcon
              size="lg"
              variant="subtle"
              onClick={() => updateParam('sort', sortAscending ? 'desc' : 'asc')}
            >
              {sortAscending ? <IconSortAscending size={20} /> : <IconSortDescending size={20} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group style={{ flex: 1 }}>
           <TextInput
             placeholder="Search indices..."
             leftSection={<IconSearch size={16} />}
             value={indicesSearch}
             onChange={(e) => setIndicesSearch(e.currentTarget.value)}
             style={{ flex: 1, maxWidth: 300 }}
           />

          {/* Health filter toggles */}
          <Group gap="md" wrap="wrap">
            {['green', 'yellow', 'red', 'unknown'].map((health) => {
              const isSelected = selectedHealth.includes(health);
              const healthColor =
                health === 'green'
                  ? 'green'
                  : health === 'yellow'
                    ? 'yellow'
                    : health === 'red'
                      ? 'red'
                      : 'gray';
              return (
                <Group
                  key={health}
                  gap={4}
                  style={{
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.5,
                    transition: 'opacity 150ms ease',
                  }}
                  onClick={() => {
                    const newHealth = isSelected
                      ? selectedHealth.filter((h) => h !== health)
                      : [...selectedHealth, health];
                    // If unchecking the last health color, reset to all health colors
                    if (newHealth.length === 0) {
                      updateFilters(undefined, ['green', 'yellow', 'red', 'unknown'], undefined);
                      return;
                    }
                    updateFilters(undefined, newHealth, undefined);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const newHealth = isSelected
                        ? selectedHealth.filter((h) => h !== health)
                        : [...selectedHealth, health];
                      // If unchecking the last health color, reset to all health colors
                      if (newHealth.length === 0) {
                        updateFilters(undefined, ['green', 'yellow', 'red', 'unknown'], undefined);
                        return;
                      }
                      updateFilters(undefined, newHealth, undefined);
                    }
                  }}
                >
                  <div
                    style={{
                      width: '10px',
                      height: '10px',
                      borderRadius: '50%',
                      backgroundColor: `var(--mantine-color-${healthColor}-6)`,
                    }}
                  />
                  <Text size="xs" style={{ textTransform: 'capitalize' }}>
                    {health}
                  </Text>
                </Group>
              );
            })}
          </Group>

          {/* Status filter toggles */}
          <Group gap="md" wrap="wrap">
            {[
              { value: 'open', label: 'open', icon: IconFolderOpen, color: 'green' },
              { value: 'close', label: 'closed', icon: IconFolderX, color: 'red' },
            ].map(({ value, label, icon: Icon, color }) => {
              const isSelected = selectedStatus.includes(value);
              return (
                <Group
                  key={value}
                  gap={4}
                  style={{
                    cursor: 'pointer',
                    opacity: isSelected ? 1 : 0.5,
                    transition: 'opacity 150ms ease',
                  }}
                  onClick={() => {
                    const newStatus = isSelected
                      ? selectedStatus.filter((s) => s !== value)
                      : [...selectedStatus, value];
                    // If unchecking the last status, reset to all statuses
                    if (newStatus.length === 0) {
                      updateFilters(undefined, undefined, ['open', 'close']);
                      return;
                    }
                    updateFilters(undefined, undefined, newStatus);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      const newStatus = isSelected
                        ? selectedStatus.filter((s) => s !== value)
                        : [...selectedStatus, value];
                      // If unchecking the last status, reset to all statuses
                      if (newStatus.length === 0) {
                        updateFilters(undefined, undefined, ['open', 'close']);
                        return;
                      }
                      updateFilters(undefined, undefined, newStatus);
                    }
                  }}
                >
                  <Icon size={16} color={`var(--mantine-color-${color}-6)`} />
                  <Text size="xs">{label}</Text>
                </Group>
              );
            })}
          </Group>

          {/* Show only affected toggle */}
          {hasAnyProblems && (
            <Group
              gap={4}
              style={{
                cursor: 'pointer',
                opacity: showOnlyAffected ? 1 : 0.5,
                transition: 'opacity 150ms ease',
              }}
              onClick={() => updateParam('affected', !showOnlyAffected)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  updateParam('affected', !showOnlyAffected);
                }
              }}
            >
              <IconAlertCircle size={16} color="var(--mantine-color-red-6)" />
              <Text size="xs">affected</Text>
            </Group>
          )}

          {/* Show special indices toggle */}
          <Group
            gap={4}
            style={{
              cursor: 'pointer',
              opacity: showSpecialIndices ? 1 : 0.5,
              transition: 'opacity 150ms ease',
            }}
            onClick={() => updateParam('showSpecial', !showSpecialIndices)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                updateParam('showSpecial', !showSpecialIndices);
              }
            }}
          >
            <IconEyeOff size={16} color="var(--mantine-color-violet-6)" />
            <Text size="xs">special</Text>
          </Group>
        </Group>

        {/* Bulk operations menu */}
        {count > 0 && (
          <BulkOperationsMenu
            selectedIndices={selectedIndices}
            indices={indices || []}
            onOperationSelect={handleBulkOperationSelect}
          />
        )}

        {id && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate(`/cluster/${id}/indices/create`)}
          >
            Create Index
          </Button>
        )}
      </Group>

      {/* Unassigned shards section - REMOVED, now shown in table column */}

      {/* Always show table with filters - even if no indices match */}
      <Card shadow="sm" padding="lg">
        <ScrollArea>
          <Table striped highlightOnHover>
          <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <Checkbox
                    aria-label="Select all indices"
                    checked={count > 0 && count === sortedIndices.length}
                    indeterminate={count > 0 && count < sortedIndices.length}
                    onChange={handleBulkSelectAll}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Table.Th>
                <Table.Th>
                  <SortableHeader
                    column="name"
                    label="Name"
                    sortColumn={indicesSortColumn}
                    sortDirection={indicesSortDirection}
                    onSort={handleIndicesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <SortableHeader
                    column="health"
                    label="Health"
                    sortColumn={indicesSortColumn}
                    sortDirection={indicesSortDirection}
                    onSort={handleIndicesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <SortableHeader
                    column="status"
                    label="Status"
                    sortColumn={indicesSortColumn}
                    sortDirection={indicesSortDirection}
                    onSort={handleIndicesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <SortableHeader
                    column="documents"
                    label="Documents"
                    sortColumn={indicesSortColumn}
                    sortDirection={indicesSortDirection}
                    onSort={handleIndicesSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <SortableHeader
                    column="size"
                    label="Size"
                    sortColumn={indicesSortColumn}
                    sortDirection={indicesSortDirection}
                    onSort={handleIndicesSortColumn}
                  />
                </Table.Th>
                <Table.Th>Shards</Table.Th>
                {expandedView && <Table.Th>Primaries</Table.Th>}
                {expandedView && <Table.Th>Replicas</Table.Th>}
                <Table.Th>Unassigned</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {sortedIndices.map((index) => {
                const unassignedCount = unassignedByIndex[index.name]?.length || 0;
                const hasUnassigned = unassignedCount > 0;

                return (
                  <Table.Tr
                    key={index.name}
                    style={{
                      backgroundColor: isSelected(index.name)
                        ? 'var(--mantine-color-blue-light)'
                        : hasUnassigned
                          ? 'rgba(250, 82, 82, 0.1)'
                          : undefined,
                    }}
                  >
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        aria-label={`Select index ${index.name}`}
                        checked={isSelected(index.name)}
                        onChange={() => toggleSelection(index.name)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Stack gap={2} style={{ flex: 1 }}>
                          <Text
                            size="sm"
                            fw={500}
                            style={{
                              textDecoration: 'underline',
                              cursor: 'pointer',
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openIndexModal(index.name);
                            }}
                          >
                            {index.name}
                          </Text>
                          {expandedView && hasProblems(index.name) && (
                            <Badge size="xs" color="yellow" variant="light">
                              Has Issues
                            </Badge>
                          )}
                        </Stack>
                        <CopyButton value={index.name} tooltip="Copy index name" size="xs" />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={getHealthColor(index.health)}>
                        {index.health}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        size="sm"
                        variant="light"
                        color={index.status === 'open' ? 'green' : 'gray'}
                      >
                        {index.status}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{index.docsCount.toLocaleString()}</Text>
                        <CopyButton
                          value={index.docsCount.toString()}
                          tooltip="Copy document count"
                          size="xs"
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{formatBytes(index.storeSize)}</Text>
                        <CopyButton
                          value={formatBytes(index.storeSize)}
                          tooltip="Copy size"
                          size="xs"
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {expandedView
                          ? `${index.primaryShards + index.replicaShards}`
                          : `${index.primaryShards}p / ${index.replicaShards}r`}
                      </Text>
                    </Table.Td>
                    {expandedView && (
                      <Table.Td>
                        <Text size="sm">{index.primaryShards}</Text>
                      </Table.Td>
                    )}
                    {expandedView && (
                      <Table.Td>
                        <Text size="sm">{index.replicaShards}</Text>
                      </Table.Td>
                    )}
                    <Table.Td>
                      {unassignedCount > 0 ? (
                        <Tooltip
                          label={
                            <Stack gap={4}>
                              <Text size="xs" fw={600}>
                                Unassigned Shards:
                              </Text>
                              {unassignedByIndex[index.name]?.map(
                                (shard: ShardInfo, idx: number) => (
                                  <Group key={idx} gap={4}>
                                    <Text size="xs">Shard {shard.shard}</Text>
                                    <ShardTypeBadge primary={shard.primary} />
                                  </Group>
                                )
                              )}
                            </Stack>
                          }
                          multiline
                          w={200}
                        >
                          <Badge size="sm" color="red" variant="filled" style={{ cursor: 'help' }}>
                            {unassignedCount}
                          </Badge>
                        </Tooltip>
                      ) : (
                        <Text size="sm" c="dimmed">
                          -
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Menu shadow="md" width={220}>
                        <Menu.Target>
                          <ActionIcon variant="subtle" color="gray">
                            <IconDots size={16} />
                          </ActionIcon>
                        </Menu.Target>

                        <Menu.Dropdown>
                          <Menu.Label>Index Management</Menu.Label>
                          <Menu.Item
                            leftSection={<IconSettings size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openIndexModal(index.name, 'settings');
                            }}
                          >
                            Settings
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<IconMap size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              openIndexModal(index.name, 'mappings');
                            }}
                          >
                            Mappings
                          </Menu.Item>

                          <Menu.Divider />

                          <Menu.Label>Index Operations</Menu.Label>
                          {index.status === 'close' ? (
                            <Menu.Item
                              leftSection={<IconLockOpen size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                // Open index operation
                                apiClient
                                  .openIndex(id!, index.name)
                                  .then(() => {
                                    notifications.show({
                                      title: 'Success',
                                      message: `Index ${index.name} opened successfully`,
                                      color: 'green',
                                    });
                                    queryClient.invalidateQueries({
                                      queryKey: ['cluster', id, 'indices'],
                                    });
                                  })
                                  .catch((error: Error) => {
                                    notifications.show({
                                      title: 'Error',
                                      message: `Failed to open index: ${error.message}`,
                                      color: 'red',
                                    });
                                  });
                              }}
                            >
                              Open Index
                            </Menu.Item>
                          ) : (
                            <Menu.Item
                              leftSection={<IconLock size={14} />}
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmationAction({ type: 'close', indexName: index.name });
                                setConfirmationModalOpened(true);
                              }}
                            >
                              Close Index
                            </Menu.Item>
                          )}

                          <Menu.Item
                            leftSection={<IconRefresh size={14} />}
                            onClick={(e) => {
                              e.stopPropagation();
                              // Refresh index operation
                              apiClient
                                .refreshIndex(id!, index.name)
                                .then(() => {
                                  notifications.show({
                                    title: 'Success',
                                    message: `Index ${index.name} refreshed successfully`,
                                    color: 'green',
                                  });
                                })
                                .catch((error: Error) => {
                                  notifications.show({
                                    title: 'Error',
                                    message: `Failed to refresh index: ${error.message}`,
                                    color: 'red',
                                  });
                                });
                            }}
                          >
                            Refresh
                          </Menu.Item>

                          <Menu.Divider />

                          <Menu.Item
                            leftSection={<IconTrash size={14} />}
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmationAction({ type: 'delete', indexName: index.name });
                              setConfirmationModalOpened(true);
                            }}
                          >
                            Delete Index
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      </Card>

      {/* Pagination */}
      {indices && indices.length > 0 && indicesPaginated && indicesPaginated.total_pages > 1 && (
        <TablePagination
          currentPage={currentPage}
          totalPages={indicesPaginated.total_pages}
          pageSize={pageSize}
          totalItems={indicesPaginated.total}
          onPageChange={handleIndicesPageChange}
          onPageSizeChange={handleIndicesPageSizeChange}
        />
      )}

      {/* Confirmation Modal for Close/Delete Operations */}
      <Modal
        opened={confirmationModalOpened}
        onClose={() => {
          setConfirmationModalOpened(false);
          setConfirmationAction(null);
        }}
        title={confirmationAction?.type === 'close' ? 'Close Index' : 'Delete Index'}
        centered
      >
        <Stack gap="md">
          <Text>
            {confirmationAction?.type === 'close'
              ? `Are you sure you want to close index "${confirmationAction.indexName}"? Closed indices cannot be searched or written to, but can be reopened.`
              : `Are you sure you want to delete index "${confirmationAction?.indexName}"? This action cannot be undone.`}
          </Text>
          <Group justify="flex-end" gap="sm">
            <Button
              variant="outline"
              onClick={() => {
                setConfirmationModalOpened(false);
                setConfirmationAction(null);
              }}
            >
              Cancel
            </Button>
            <Button
              color={confirmationAction?.type === 'close' ? 'yellow' : 'red'}
              onClick={() => {
                if (!id || !confirmationAction) return;

                const action =
                  confirmationAction.type === 'close'
                    ? apiClient.closeIndex(id, confirmationAction.indexName)
                    : apiClient.deleteIndex(id, confirmationAction.indexName);

                action
                  .then(() => {
                    notifications.show({
                      title: 'Success',
                      message: `Index ${confirmationAction.indexName} ${confirmationAction.type === 'close' ? 'closed' : 'deleted'} successfully`,
                      color: 'green',
                    });
                    queryClient.invalidateQueries({ queryKey: ['cluster', id, 'indices'] });
                    setConfirmationModalOpened(false);
                    setConfirmationAction(null);
                  })
                  .catch((error: Error) => {
                    notifications.show({
                      title: 'Error',
                      message: `Failed to ${confirmationAction.type} index: ${error.message}`,
                      color: 'red',
                    });
                  });
              }}
            >
              {confirmationAction?.type === 'close' ? 'Close Index' : 'Delete Index'}
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk Operation Confirm Modal */}
      <BulkOperationConfirmModal
        opened={bulkModalOpened}
        onClose={() => {
          setBulkModalOpened(false);
          setSelectedOperation(null);
        }}
        operation={selectedOperation || 'open'}
        selectedIndices={Array.from(selectedIndices)}
        indices={indices || []}
        onConfirm={handleBulkOperationConfirm}
        isExecuting={
          bulkOpenMutation.isPending ||
          bulkCloseMutation.isPending ||
          bulkDeleteMutation.isPending ||
          bulkRefreshMutation.isPending ||
          bulkSetReadOnlyMutation.isPending ||
          bulkSetWritableMutation.isPending
        }
      />
    </Stack>
  );
});

/**
 * ShardDetailsModal component displays detailed shard information as JSON
 */
function ShardDetailsModal({
  shard,
  opened,
  onClose,
  clusterId,
}: {
  shard: ShardInfo | null;
  opened: boolean;
  onClose: () => void;
  clusterId: string;
}) {
  const { colorScheme } = useMantineColorScheme();
  const [detailedStats, setDetailedStats] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  // Fetch detailed stats when modal opens
  useEffect(() => {
    if (opened && shard) {
      setLoading(true);
      setDetailedStats(null); // Reset previous data

      apiClient
        .getShardStats(clusterId, shard.index, shard.shard)
        .then((stats) => {
          setDetailedStats(stats);
        })
        .catch((error) => {
          console.error('Failed to fetch shard stats:', error);
          setDetailedStats(shard); // Fallback to basic shard info
        })
        .finally(() => {
          setLoading(false);
        });
    } else if (!opened) {
      // Reset when modal closes
      setDetailedStats(null);
      setLoading(false);
    }
  }, [opened, shard, clusterId]);

  if (!shard) return null;

  return (
    <Modal.Root opened={opened} onClose={onClose} size="90%">
      <Modal.Overlay />
      <Modal.Content
        style={{
          maxWidth: '100%',
        }}
      >
        <Modal.Header>
          <Modal.Title>
            <Group gap="xs">
              <Text size="lg" fw={600}>
                Shard Details:
              </Text>
              <Badge size="lg" variant="light" color="blue">
                {shard.index}
              </Badge>
              <Text size="lg" c="dimmed">
                /
              </Text>
              <Badge size="lg" variant="filled" color="cyan">
                #{shard.shard}
              </Badge>
              <Badge
                size="lg"
                variant={shard.primary ? 'filled' : 'light'}
                color={shard.primary ? 'green' : 'gray'}
              >
                {shard.primary ? 'Primary' : 'Replica'}
              </Badge>
            </Group>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body
          style={{
            maxHeight: 'calc(100vh - 120px)',
            overflow: 'auto',
          }}
        >
          {loading ? (
            <Stack gap="xs">
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} width="70%" radius="xs" />
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} width="50%" radius="xs" />
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} radius="xs" />
              <Skeleton height={20} width="80%" radius="xs" />
            </Stack>
          ) : (
            <Box>
              <CodeEditor
                value={JSON.stringify(detailedStats || shard, null, 2)}
                language="json"
                height="600px"
                readOnly
                showCopyButton
              />
            </Box>
          )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}

/**
 * ShardAllocationGrid component displays visual shard allocation across nodes and indices
 * This is the main "overview" visualization showing how shards are distributed
 * Requirements: 4.8
 */
function ShardAllocationGrid({
  nodes,
  indices,
  shards,
  loading,
  error,
  openIndexModal,
  openNodeModal,
  searchParams,
  setSearchParams,
  // Shared relocation state
  sharedRelocationMode,
  sharedValidDestinationNodes,
  onSharedDestinationClick,
  onSharedRelocationCancel,
  onSharedSelectForRelocation,
  // Wildcard filters
  indexNameFilter,
  nodeNameFilter,
  matchesWildcard,
}: {
  nodes?: NodeInfo[];
  indices?: IndexInfo[];
  shards?: ShardInfo[];
  loading: boolean;
  error: Error | null;
  openIndexModal: (indexName: string, tab?: string) => void;
  openNodeModal?: (nodeId: string) => void;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams) => void;
  // Shared relocation
  sharedRelocationMode?: boolean;
  sharedValidDestinationNodes?: string[];
  onSharedDestinationClick?: (nodeId: string) => void;
  onSharedRelocationCancel?: () => void;
  onSharedSelectForRelocation?: (shard: ShardInfo) => void;
  // Wildcard filters
  indexNameFilter?: string;
  nodeNameFilter?: string;
  matchesWildcard?: (text: string, pattern: string) => boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();

  // Modal state for shard details
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);
  const [modalOpened] = useState(false);

  // Context menu state
  const [contextMenuOpened, setContextMenuOpened] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [contextMenuShard, setContextMenuShard] = useState<ShardInfo | null>(null);

  // Use SHARED relocation state (not internal state)
  const activeRelocationMode = sharedRelocationMode ?? false;
  const activeValidDestinationNodes = sharedValidDestinationNodes ?? [];

  // Relocation confirmation modal state
  const [relocationConfirmOpened, setRelocationConfirmOpened] = useState(false);
  const [relocationSourceNode, setRelocationSourceNode] = useState<NodeInfo | null>(null);
  const [relocationDestinationNode, setRelocationDestinationNode] = useState<NodeInfo | null>(null);
  const [relocationInProgress, setRelocationInProgress] = useState(false);

  // No destinations state - show in banner instead of modal
  const [showNoDestinationsMessage, setShowNoDestinationsMessage] = useState(false);

  // Shard state filter - all states selected by default
  const SHARD_STATES = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;
  const selectedStatesParam = searchParams.get('shardStates');
  const selectedShardStates = selectedStatesParam
    ? selectedStatesParam.split(',').filter(Boolean)
    : [...SHARD_STATES];

  // Get UI state from URL
  const searchQuery = searchParams.get('overviewSearch') || '';
  const showClosed = searchParams.get('showClosed') === 'true';
  const showSpecial = searchParams.get('showSpecial') === 'true';
  const expandedView = searchParams.get('overviewExpanded') === 'true';
  const showOnlyAffected = searchParams.get('overviewAffected') === 'true';

  // Responsive default page size
  const defaultPageSize = useResponsivePageSize();

  // Pagination state
  const currentPage = parseInt(searchParams.get('overviewPage') || '1', 10);
  const pageSize = parseInt(searchParams.get('overviewPageSize') || defaultPageSize.toString(), 10);

  const handleOverviewPageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('overviewPage', page.toString());
    setSearchParams(params);
  };

  const debouncedSearch = useDebounce(searchQuery, 300);

  // Handler to open shard context menu
  const handleShardClick = (shard: ShardInfo, event: React.MouseEvent) => {
    event.stopPropagation();

    // Don't allow clicking other shards during relocation mode
    if (sharedRelocationMode) {
      return;
    }

    setSelectedShard(shard);
    setContextMenuShard(shard);
    setContextMenuPosition({
      x: event.clientX,
      y: event.clientY,
    });
    setContextMenuOpened(true);
  };

  // Handle context menu close
  const handleContextMenuClose = () => {
    setContextMenuOpened(false);
    setContextMenuShard(null);
  };

  // Handle show shard stats - use path-based navigation
  const handleShowStats = (shard: ShardInfo) => {
    setSelectedShard(shard);
    // TODO: Update to use path-based URL when shard modal navigation is complete
    // const shardId = `${shard.index}[${shard.shard}]`;
    // navigateToShard(shardId);
    handleContextMenuClose();
  };

  // Handle select for relocation
  const handleSelectForRelocation = (shard: ShardInfo) => {
    if (!nodes || !shards) {
      console.error('[ClusterView] Cannot enter relocation mode: nodes or shards not available');
      return;
    }

    // Enter relocation mode
    // Calculate valid destination nodes for this shard
    const validDestinations: string[] = [];

    for (const node of nodes) {
      // Skip source node
      if (node.id === shard.node || node.name === shard.node) {
        continue;
      }

      // Skip if node already has this shard (same index and shard number)
      // Check the shards array to see if this node has the same shard
      const nodeHasThisShard = shards.some(
        (s: ShardInfo) =>
          (s.node === node.id || s.node === node.name) &&
          s.index === shard.index &&
          s.shard === shard.shard
      );

      if (nodeHasThisShard) {
        continue;
      }

      // Skip non-data nodes
      if (!node.roles.includes('data')) {
        continue;
      }

      validDestinations.push(node.id);
    }

    // Check if there are any valid destinations
    if (validDestinations.length === 0) {
      // Show notification (same as Dot View)
      notifications.show({
        title: 'Cannot Relocate',
        message: `Shard ${shard.shard} (${shard.primary ? 'Primary' : 'Replica'}) of index "${shard.index}" cannot be relocated. All data nodes either already host this shard or are the source node.`,
        color: 'violet',
        autoClose: 5000,
      });
      handleContextMenuClose();
      return;
    }

    // Call shared handler to set relocation state
    onSharedSelectForRelocation?.(shard);
    setShowNoDestinationsMessage(false);

    handleContextMenuClose();
  };

  // Update URL params
  const updateParam = (key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === false) {
      newParams.set(key, 'false');
    } else if (value === '' || value === undefined) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    setSearchParams(newParams);
  };

  // Update shard state filter
  const updateShardStates = (states: string[]) => {
    const newParams = new URLSearchParams(searchParams);
    if (states.length === SHARD_STATES.length) {
      // All states selected - remove param to use default
      newParams.delete('shardStates');
    } else if (states.length > 0) {
      newParams.set('shardStates', states.join(','));
    } else {
      // No states selected - keep at least one to avoid empty view
      newParams.set('shardStates', SHARD_STATES[0]);
    }
    setSearchParams(newParams);
  };

  // Fetch cluster settings to check allocation status
  const { data: clusterSettings } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: async () => {
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        id!,
        'GET',
        '/_cluster/settings'
      );
      return response.data;
    },
    enabled: !!id,
  });

  // Check if shard allocation is enabled
  const shardAllocationEnabled = (() => {
    if (!clusterSettings) return true;

    const transient = clusterSettings.transient as Record<string, unknown> | undefined;
    const persistent = clusterSettings.persistent as Record<string, unknown> | undefined;

    const transientAllocation = transient?.cluster as Record<string, unknown> | undefined;
    const persistentAllocation = persistent?.cluster as Record<string, unknown> | undefined;

    const transientRouting = transientAllocation?.routing as Record<string, unknown> | undefined;
    const persistentRouting = persistentAllocation?.routing as Record<string, unknown> | undefined;

    const transientEnable = (transientRouting?.allocation as Record<string, unknown>)?.enable as
      | string
      | undefined;
    const persistentEnable = (persistentRouting?.allocation as Record<string, unknown>)?.enable as
      | string
      | undefined;

    const enableValue = transientEnable || persistentEnable || 'all';
    return enableValue === 'all';
  })();

  // Enable shard allocation mutation
  const enableAllocationMutation = useMutation({
    mutationFn: () =>
      apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': 'all',
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Shard allocation enabled',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to enable shard allocation: ${error.message}`,
        color: 'red',
      });
    },
  });

  // Disable shard allocation mutation
  const disableAllocationMutation = useMutation({
    mutationFn: (mode: string) =>
      apiClient.proxyRequest(id!, 'PUT', '/_cluster/settings', {
        transient: {
          'cluster.routing.allocation.enable': mode,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cluster', id, 'settings'] });
      notifications.show({
        title: 'Success',
        message: 'Shard allocation disabled',
        color: 'green',
      });
    },
    onError: (error: Error) => {
      notifications.show({
        title: 'Error',
        message: `Failed to disable shard allocation: ${error.message}`,
        color: 'red',
      });
    },
  });

  if (loading) {
    return (
      <Stack gap="xs">
        <Skeleton height={40} radius="sm" />
        <Skeleton height={200} radius="sm" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load shard allocation data: {error.message}
      </Alert>
    );
  }

  if (!nodes || !indices || !shards || nodes.length === 0) {
    // Show empty state only if there are no nodes
    // If there are nodes but no indices, we still want to show the node grid
    return (
      <Stack gap="md" align="center" py="xl">
        <Text c="dimmed">No shard allocation data available</Text>
      </Stack>
    );
  }

  // Filter shards by selected states first
  const filteredShards = shards.filter((shard) => selectedShardStates.includes(shard.state));

  // Identify unassigned shards (from filtered shards)
  const unassignedShards = filteredShards.filter((s) => s.state === 'UNASSIGNED');
  const unassignedByIndex = unassignedShards.reduce(
    (acc, shard) => {
      if (!acc[shard.index]) {
        acc[shard.index] = [];
      }
      acc[shard.index].push(shard);
      return acc;
    },
    {} as Record<string, ShardInfo[]>
  );

  // Check if an index has problems (using filtered shards)
  const hasProblems = (indexName: string) => {
    const indexShards = filteredShards.filter((s) => s.index === indexName);
    return indexShards.some(
      (s) => s.state === 'UNASSIGNED' || s.state === 'RELOCATING' || s.state === 'INITIALIZING'
    );
  };

  // Get set of indices that have shards after shard state filtering
  const indicesWithFilteredShards = new Set(filteredShards.map((s) => s.index));

  // Filter indices based on search and filters
  // IMPORTANT: Indices must have shards matching the selected shard states to be shown
  const filteredIndicesData = indices.filter((index) => {
    const matchesSearch = index.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesClosed = showClosed || index.status === 'open';
    const matchesSpecial = showSpecial || !index.name.startsWith('.');
    const matchesAffected = !showOnlyAffected || hasProblems(index.name);
    // NEW: Filter indices to only show those with shards after shard state filtering
    const hasShards = indicesWithFilteredShards.has(index.name);
    // Filter by index name wildcard pattern
    const matchesIndexFilter = !indexNameFilter || !matchesWildcard 
      ? true 
      : matchesWildcard(index.name, indexNameFilter);
    return matchesSearch && matchesClosed && matchesSpecial && matchesAffected && hasShards && matchesIndexFilter;
  });

  // Pagination
  const totalPages = Math.ceil(filteredIndicesData.length / pageSize);
  const displayIndices = filteredIndicesData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Group shards by node and index
  // Build a map of node identifiers (id, name, ip) to node name for matching
  const nodeIdentifierMap = new Map<string, string>();
  nodes.forEach((node) => {
    nodeIdentifierMap.set(node.id, node.name);
    nodeIdentifierMap.set(node.name, node.name);
    if (node.ip) {
      nodeIdentifierMap.set(node.ip, node.name);
    }
  });

  const shardsByNodeAndIndex = new Map<string, Map<string, ShardInfo[]>>();

  filteredShards.forEach((shard) => {
    if (!shard.node) return; // Skip unassigned shards for grid view

    // Try to find the node name using the identifier map
    const nodeName = nodeIdentifierMap.get(shard.node);
    if (!nodeName) {
      // If we can't find a match, skip this shard
      return;
    }

    // Skip if node doesn't match wildcard filter
    if (nodeNameFilter && matchesWildcard && !matchesWildcard(nodeName, nodeNameFilter)) {
      return;
    }

    if (!shardsByNodeAndIndex.has(nodeName)) {
      shardsByNodeAndIndex.set(nodeName, new Map());
    }

    const nodeShards = shardsByNodeAndIndex.get(nodeName)!;
    if (!nodeShards.has(shard.index)) {
      nodeShards.set(shard.index, []);
    }

    nodeShards.get(shard.index)!.push(shard);
  });

  return (
    <Stack gap="md">
      {/* Context menu for shard actions */}
      {contextMenuShard && (
        <ShardContextMenu
          shard={contextMenuShard}
          opened={contextMenuOpened}
          position={contextMenuPosition}
          onClose={handleContextMenuClose}
          onShowStats={handleShowStats}
          onSelectForRelocation={handleSelectForRelocation}
        />
      )}

      {/* Shard Details Modal */}
      <ShardDetailsModal
        shard={selectedShard}
        opened={modalOpened}
        onClose={() => setSelectedShard(null)}
        clusterId={id!}
      />

      {/* Shard allocation grid */}
      <ScrollArea>
        <div style={{ minWidth: '800px' }}>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{
                    width: '120px',
                    minWidth: '120px',
                    maxWidth: '120px',
                    position: 'sticky',
                    left: 0,
                    backgroundColor: 'var(--mantine-color-body)',
                    zIndex: 1,
                  }}
                >
                  Node
                </Table.Th>
                {displayIndices.map((index) => (
                  <Table.Th key={index.name} style={{ minWidth: '120px', textAlign: 'center' }}>
                    <Stack gap={4}>
                      <Text
                        size="xs"
                        fw={500}
                        truncate="end"
                        title={index.name}
                        style={{ cursor: 'pointer', textDecoration: 'underline' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          openIndexModal(index.name);
                        }}
                      >
                        {index.name}
                      </Text>
                      <Group gap={4} justify="center">
                        <Badge size="xs" color={getHealthColor(index.health)} variant="dot">
                          {index.primaryShards}×{index.replicaShards + 1}
                        </Badge>
                        <Text size="xs" c="dimmed">
                          {formatBytes(index.storeSize)}
                        </Text>
                      </Group>
                    </Stack>
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {/* Unassigned shards row */}
              {unassignedShards.length > 0 && (
                <Table.Tr>
                  <Table.Td
                    style={{
                      width: '120px',
                      minWidth: '120px',
                      maxWidth: '120px',
                      position: 'sticky',
                      left: 0,
                      zIndex: 1,
                    }}
                  >
                    <Stack gap={2}>
                      <Text size="xs" fw={700} c="red">
                        Unassigned
                      </Text>
                      <Badge size="xs" color="red" variant="filled">
                        {unassignedShards.length}
                      </Badge>
                    </Stack>
                  </Table.Td>
                  {displayIndices.map((index) => {
                    const indexUnassigned = unassignedByIndex[index.name] || [];

                    return (
                      <Table.Td
                        key={`unassigned-${index.name}`}
                        style={{
                          padding: '4px',
                          textAlign: 'center',
                          backgroundColor: getIndexBackgroundColor(index.health),
                        }}
                      >
                        {indexUnassigned.length > 0 ? (
                          <Group gap={2} justify="center" wrap="wrap">
                            {indexUnassigned.map((shard, idx) => (
                              <Tooltip
                                key={`unassigned-${shard.index}-${shard.shard}-${idx}`}
                                label={
                                  <div>
                                    <div>Shard: {shard.shard}</div>
                                    <div>Type: {shard.primary ? 'Primary' : 'Replica'}</div>
                                    <div>State: {shard.state}</div>
                                  </div>
                                }
                              >
                                <div
                                  style={{
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    backgroundColor: 'var(--mantine-color-red-6)',
                                    color: 'white',
                                    fontSize: '10px',
                                    fontWeight: 600,
                                    borderRadius: '2px',
                                    border: shard.primary
                                      ? '2px solid var(--mantine-color-red-9)'
                                      : '2px dashed var(--mantine-color-red-9)',
                                    cursor: 'pointer',
                                  }}
                                  onClick={(e) => handleShardClick(shard, e)}
                                >
                                  {shard.shard}
                                </div>
                              </Tooltip>
                            ))}
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">
                            -
                          </Text>
                        )}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              )}

              {/* Node rows */}
              {/* Filter to show only nodes with data role - Requirements: 10.1, 10.2, 10.3 */}
              {nodes
                .filter((node) => node.roles.includes('data'))
                .map((node) => {
                  const nodeShards = shardsByNodeAndIndex.get(node.name);

                  return (
                    <Table.Tr key={node.id}>
                      <Table.Td
                        style={{
                          width: '120px',
                          minWidth: '120px',
                          maxWidth: '120px',
                          position: 'sticky',
                          left: 0,
                          backgroundColor: 'var(--mantine-color-body)',
                          zIndex: 1,
                        }}
                      >
                        <Stack gap={4}>
                          <Group gap={4}>
                            {openNodeModal ? (
                              <Anchor
                                component="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openNodeModal(node.id);
                                }}
                                style={{
                                  textDecoration: 'none',
                                  cursor: 'pointer',
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openNodeModal(node.id);
                                  }
                                }}
                              >
                                <Text
                                  size="xs"
                                  fw={500}
                                  truncate="end"
                                  title={node.name}
                                  style={{ textDecoration: 'inherit' }}
                                >
                                  {node.name}
                                </Text>
                              </Anchor>
                            ) : (
                              <Text size="xs" fw={500} truncate="end" title={node.name}>
                                {node.name}
                              </Text>
                            )}
                          </Group>
                          <Text size="xs" c="dimmed" truncate="end" title={node.ip}>
                            {node.ip}
                          </Text>
                          {expandedView ? (
                            <Group gap="md" wrap="wrap">
                              {node.roles.map((role) => {
                                const roleInfo = getRoleIcon(role);
                                const Icon = roleInfo.icon;
                                return (
                                  <Group key={role} gap={4}>
                                    <Icon
                                      size={14}
                                      color={`var(--mantine-color-${roleInfo.color}-6)`}
                                    />
                                    <Text size="xs">{roleInfo.label}</Text>
                                  </Group>
                                );
                              })}
                            </Group>
                          ) : (
                            <RoleIcons roles={node.roles} size={16} />
                          )}
                          {expandedView && (
                            <>
                              {/* Node stats badges - similar to original Cerebro */}
                              <Group gap={4} wrap="wrap">
                                <Badge size="xs" color="teal" variant="filled">
                                  {node.id.substring(0, 8)}
                                </Badge>
                                <Badge size="xs" color="teal" variant="filled">
                                  {node.roles.length}
                                </Badge>
                                <Badge size="xs" color="teal" variant="filled">
                                  {formatBytes(node.heapMax)}
                                </Badge>
                                <Badge size="xs" color="teal" variant="filled">
                                  {formatBytes(node.diskTotal)}
                                </Badge>
                                {node.cpuPercent !== undefined && (
                                  <Badge size="xs" color="teal" variant="filled">
                                    {node.cpuPercent}%
                                  </Badge>
                                )}
                              </Group>
                            </>
                          )}
                        </Stack>
                      </Table.Td>
                      {displayIndices.map((index) => {
                        const indexShards = nodeShards?.get(index.name) || [];

                        return (
                          <Table.Td
                            key={`${node.id}-${index.name}`}
                            style={{
                              padding: '4px',
                              textAlign: 'center',
                              backgroundColor: getIndexBackgroundColor(index.health),
                            }}
                          >
                            {indexShards.length > 0 ||
                              (activeRelocationMode &&
                                activeValidDestinationNodes.includes(node.id) &&
                                selectedShard?.index === index.name) ? (
                              <Group gap={2} justify="center" wrap="wrap">
                                {indexShards.map((shard, idx) => (
                                  <Tooltip
                                    key={`${shard.shard}-${shard.primary}-${idx}`}
                                    label={
                                      <div style={{ whiteSpace: 'pre-line', fontSize: 'var(--mantine-font-size-xs)' }}>
                                        <div><strong>Index:</strong> {index.name}</div>
                                        <div><strong>Shard:</strong> {shard.shard}</div>
                                        <div><strong>Type:</strong> {shard.primary ? 'Primary' : 'Replica'}</div>
                                        <div><strong>State:</strong> {shard.state}</div>
                                        <div><strong>Node:</strong> {shard.node || 'N/A'}</div>
                                        {shard.docs !== undefined && shard.docs !== null && (
                                          <div><strong>Docs:</strong> {shard.docs.toLocaleString()}</div>
                                        )}
                                        {shard.store !== undefined && shard.store !== null && (
                                          <div><strong>Size:</strong> {formatBytes(shard.store)}</div>
                                        )}
                                      </div>
                                    }
                                    position="top"
                                    withArrow
                                  >
                                    <div
                                      style={{
                                        width: '24px',
                                        height: '24px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        backgroundColor:
                                          shard.state === 'STARTED'
                                            ? shard.primary
                                              ? 'var(--mantine-color-green-6)'
                                              : 'var(--mantine-color-green-7)'
                                            : shard.state === 'RELOCATING'
                                              ? 'var(--mantine-color-yellow-6)'
                                              : 'var(--mantine-color-red-6)',
                                        color: 'white',
                                        fontSize: '10px',
                                        fontWeight: 600,
                                        borderRadius: '2px',
                                        border: shard.primary
                                          ? '2px solid var(--mantine-color-green-9)'
                                          : '2px dashed var(--mantine-color-green-9)',
                                        cursor: activeRelocationMode ? 'not-allowed' : 'pointer',
                                        opacity: activeRelocationMode ? 0.5 : 1,
                                      }}
                                      onClick={(e) => handleShardClick(shard, e)}
                                    >
                                      {shard.shard}
                                    </div>
                                  </Tooltip>
                                ))}

                                {/* Destination indicator - show purple dashed border when in relocation mode */}
                                {activeRelocationMode &&
                                  activeValidDestinationNodes.includes(node.id) &&
                                  selectedShard?.index === index.name && (
                                    <Tooltip
                                      label={`Click to relocate shard ${selectedShard.shard} here`}
                                    >
                                      <div
                                        style={{
                                          width: '24px',
                                          height: '24px',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          backgroundColor: 'transparent',
                                          color: 'var(--mantine-color-violet-6)',
                                          fontSize: '10px',
                                          fontWeight: 600,
                                          borderRadius: '2px',
                                          border: '2px dashed var(--mantine-color-violet-6)',
                                          cursor: 'pointer',
                                        }}
                                        onClick={(e) => {
                                          e.stopPropagation();

                                          if (!selectedShard || !id) {
                                            console.error(
                                              '[ClusterView] Cannot relocate: missing shard or cluster ID'
                                            );
                                            return;
                                          }

                                          // Find source node
                                          const sourceNode = nodes.find(
                                            (n) =>
                                              n.id === selectedShard.node ||
                                              n.name === selectedShard.node
                                          );

                                          if (!sourceNode) {
                                            console.error(
                                              '[ClusterView] Cannot find source node for shard'
                                            );
                                            notifications.show({
                                              color: 'red',
                                              title: 'Relocation Failed',
                                              message: 'Could not find source node for this shard',
                                              autoClose: 5000,
                                            });
                                            return;
                                          }

                                          // Set modal state and open confirmation dialog
                                          setRelocationSourceNode(sourceNode);
                                          setRelocationDestinationNode(node);
                                          setRelocationConfirmOpened(true);
                                        }}
                                      >
                                        {selectedShard.shard}
                                      </div>
                                    </Tooltip>
                                  )}
                              </Group>
                            ) : (
                              <Text size="xs" c="dimmed">
                                -
                              </Text>
                            )}
                          </Table.Td>
                        );
                      })}
                    </Table.Tr>
                  );
                })}
            </Table.Tbody>
          </Table>
        </div>
      </ScrollArea>

      {/* Pagination */}
      {filteredIndicesData.length > pageSize && (
        <SimplePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredIndicesData.length}
          onPageChange={handleOverviewPageChange}
        />
      )}

      {/* Relocation Confirmation Modal */}
      <Modal
        opened={relocationConfirmOpened}
        onClose={() => {
          if (!relocationInProgress) {
            setRelocationConfirmOpened(false);
            setRelocationSourceNode(null);
            setRelocationDestinationNode(null);
          }
        }}
        title="Confirm Shard Relocation"
        centered
        size="md"
      >
        <Stack gap="md">
          <Text size="sm">You are about to relocate the following shard:</Text>

          <Card withBorder padding="md">
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Index:
                </Text>
                <Text size="sm" fw={600}>
                  {selectedShard?.index}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Shard Number:
                </Text>
                <Text size="sm" fw={600}>
                  {selectedShard?.shard}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Shard Type:
                </Text>
                <Badge size="sm" color={selectedShard?.primary ? 'blue' : 'gray'}>
                  {selectedShard?.primary ? 'Primary' : 'Replica'}
                </Badge>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Source Node:
                </Text>
                <Text size="sm" fw={600}>
                  {relocationSourceNode?.name}
                </Text>
              </Group>

              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Destination Node:
                </Text>
                <Text size="sm" fw={600} c="violet">
                  {relocationDestinationNode?.name}
                </Text>
              </Group>
            </Stack>
          </Card>

          <Text size="sm" c="dimmed">
            This operation will move the shard from {relocationSourceNode?.name} to{' '}
            {relocationDestinationNode?.name}. The shard will be temporarily unavailable during
            relocation.
          </Text>

          <Group justify="flex-end" gap="sm">
            <Button
              variant="subtle"
              color="gray"
              onClick={() => {
                setRelocationConfirmOpened(false);
                setRelocationSourceNode(null);
                setRelocationDestinationNode(null);
              }}
              disabled={relocationInProgress}
            >
              Cancel
            </Button>

            <Button
              color="violet"
              onClick={async () => {
                if (!selectedShard || !id || !relocationSourceNode || !relocationDestinationNode) {
                  return;
                }

                setRelocationInProgress(true);

                try {
                  // Call the backend API to relocate the shard
                  await apiClient.relocateShard(id, {
                    index: selectedShard.index,
                    shard: selectedShard.shard,
                    from_node: relocationSourceNode.id,
                    to_node: relocationDestinationNode.id,
                  });

                  // Show success notification
                  notifications.show({
                    color: 'green',
                    title: 'Relocation Started',
                    message: `Shard ${selectedShard.shard} of index "${selectedShard.index}" is being relocated from ${relocationSourceNode.name} to ${relocationDestinationNode.name}.`,
                    autoClose: 5000,
                  });

                  // Exit relocation mode and close modal
                  onSharedRelocationCancel?.();
                  setSelectedShard(null);
                  setRelocationConfirmOpened(false);
                  setRelocationSourceNode(null);
                  setRelocationDestinationNode(null);

                  // Invalidate queries to refresh data
                  queryClient.invalidateQueries({ queryKey: ['cluster', id, 'shards'] });
                } catch (error) {
                  // Show error notification
                  let errorMessage = 'An unexpected error occurred';

                  if (error instanceof Error) {
                    errorMessage = error.message;
                  }

                  notifications.show({
                    color: 'red',
                    title: 'Relocation Failed',
                    message: errorMessage,
                    autoClose: false,
                  });
                } finally {
                  setRelocationInProgress(false);
                }
              }}
              loading={relocationInProgress}
            >
              Commit Relocation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Stack>
  );
}

/**
 * ShardsList component displays detailed shard information in table format with filtering
 * Requirements: 4.8, 31.7
 */

interface ShardsSortableHeaderProps {
  column: 'index' | 'shard' | 'type' | 'state' | 'node' | 'documents' | 'size';
  label: string;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: 'index' | 'shard' | 'type' | 'state' | 'node' | 'documents' | 'size') => void;
}

function ShardsSortableHeader({
  column,
  label,
  sortColumn,
  sortDirection,
  onSort,
}: ShardsSortableHeaderProps) {
  const renderShardsSortIcon = () => {
    if (sortColumn !== column) {
      return <IconSelector size={14} opacity={0.4} aria-hidden="true" />;
    }
    return sortDirection === 'asc' ? (
      <IconChevronUp size={14} aria-hidden="true" />
    ) : (
      <IconChevronDown size={14} aria-hidden="true" />
    );
  };

  return (
    <UnstyledButton
      onClick={() => onSort(column)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        width: '100%',
        fontWeight: 500,
      }}
      aria-label={`Sort by ${label}`}
    >
      <Text fw={500}>{label}</Text>
      {renderShardsSortIcon()}
    </UnstyledButton>
  );
}

const ShardsList = memo(function ShardsList({
  shards,
  loading,
  error,
  openNodeModal,
}: {
  shards?: ShardInfo[];
  loading: boolean;
  error: Error | null;
  openNodeModal?: (nodeId: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);

  // Get filters from URL
  const searchQuery = searchParams.get('shardsSearch') || '';
  const nodeFilter = searchParams.get('nodeFilter') || '';
  const selectedStates = searchParams.get('shardStates')?.split(',').filter(Boolean) || [
    'STARTED',
    'INITIALIZING',
    'RELOCATING',
    'UNASSIGNED',
  ];
  const showPrimaries = searchParams.get('showPrimaries') !== 'false'; // Default to true
  const showReplicas = searchParams.get('showReplicas') !== 'false'; // Default to true
  const showSpecialIndices = searchParams.get('showSpecial') === 'true'; // Default to false (hidden)

  // Column sorting state for shards
  const shardsSortColumn = (searchParams.get('shardsSortColumn') || 'index') as
    | 'index'
    | 'shard'
    | 'type'
    | 'state'
    | 'node'
    | 'documents'
    | 'size';
  const shardsSortDirection = (searchParams.get('shardsSortDir') || 'asc') as 'asc' | 'desc';

  // Initialize search with nodeFilter if present
  useEffect(() => {
    if (nodeFilter && !searchQuery) {
      const params = new URLSearchParams(searchParams);
      params.set('shardsSearch', nodeFilter);
      params.delete('nodeFilter'); // Remove nodeFilter after applying it
      setSearchParams(params, { replace: true });
    }
  }, [nodeFilter, searchQuery, searchParams, setSearchParams]);

  // Responsive default page size
  const defaultPageSize = useResponsivePageSize();

  // Pagination state
  const currentPage = parseInt(searchParams.get('shardsPage') || '1', 10);
  const pageSize = parseInt(searchParams.get('shardsPageSize') || defaultPageSize.toString(), 10);

  const handleShardsPageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('shardsPage', page.toString());
    setSearchParams(params);
  };

  const handleShardsPageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('shardsPageSize', size.toString());
    params.set('shardsPage', '1'); // Reset to first page when changing page size
    setSearchParams(params);
  };

  // Handle shard click to open details modal
  const handleShardClick = (shard: ShardInfo) => {
    setSelectedShard(shard);
    setDetailsModalOpen(true);
  };

  // Update URL when filters change
  const updateFilters = (
    newSearch?: string,
    newStates?: string[],
    newShowPrimaries?: boolean,
    newShowReplicas?: boolean
  ) => {
    const params = new URLSearchParams(searchParams);

    if (newSearch !== undefined) {
      if (newSearch) {
        params.set('shardsSearch', newSearch);
      } else {
        params.delete('shardsSearch');
      }
    }

    if (newStates !== undefined) {
      if (newStates.length > 0) {
        params.set('shardStates', newStates.join(','));
      } else {
        params.delete('shardStates');
      }
    }

    if (newShowPrimaries !== undefined) {
      if (newShowPrimaries) {
        params.delete('showPrimaries');
      } else {
        params.set('showPrimaries', 'false');
      }
    }

    if (newShowReplicas !== undefined) {
      if (newShowReplicas) {
        params.delete('showReplicas');
      } else {
        params.set('showReplicas', 'false');
      }
    }

    setSearchParams(params);
  };

  // Handle shards table column sort
  const handleShardsSortColumn = (
    column: 'index' | 'shard' | 'type' | 'state' | 'node' | 'documents' | 'size'
  ) => {
    const newParams = new URLSearchParams(searchParams);
    if (shardsSortColumn === column) {
      // Toggle direction or reset sort
      if (shardsSortDirection === 'asc') {
        newParams.set('shardsSortDir', 'desc');
      } else {
        newParams.delete('shardsSortColumn');
        newParams.delete('shardsSortDir');
      }
    } else {
      newParams.set('shardsSortColumn', column);
      newParams.set('shardsSortDir', 'asc');
    }
    setSearchParams(newParams);
  };

  // Server-side filtering is already applied for state, index, and node
  // Only need client-side filtering for primary/replica type and special indices
  const filteredShards = useMemo(() => {
    if (!shards) return [];
    
    return shards.filter((shard) => {
      // Primary/Replica filter
      if (!showPrimaries && shard.primary) return false;
      if (!showReplicas && !shard.primary) return false;

      // Special indices filter
      if (!showSpecialIndices && shard.index.startsWith('.')) {
        return false;
      }

      return true;
    });
  }, [shards, showPrimaries, showReplicas, showSpecialIndices]);

  // Sort shards by selected column (client-side sorting only)
  const sortedShards = useMemo(() => {
    const sorted = [...filteredShards];
    
    sorted.sort((a, b) => {
      let compareResult: number;

      switch (shardsSortColumn) {
        case 'index':
          compareResult = a.index.localeCompare(b.index);
          break;
        case 'shard':
          compareResult = a.shard - b.shard;
          break;
        case 'type':
          compareResult = (a.primary ? 'Primary' : 'Replica').localeCompare(
            b.primary ? 'Primary' : 'Replica'
          );
          break;
        case 'state':
          compareResult = a.state.localeCompare(b.state);
          break;
        case 'node':
          compareResult = (a.node || '').localeCompare(b.node || '');
          break;
        case 'documents':
          compareResult = a.docs - b.docs;
          break;
        case 'size':
          compareResult = a.store - b.store;
          break;
        default:
          compareResult = a.index.localeCompare(b.index);
      }

      return shardsSortDirection === 'asc' ? compareResult : -compareResult;
    });
    
    return sorted;
  }, [filteredShards, shardsSortColumn, shardsSortDirection]);

  if (loading) {
    return (
      <Stack gap="xs">
        <Skeleton height={40} radius="sm" />
        <Skeleton height={200} radius="sm" />
      </Stack>
    );
  }

  if (error) {
    return (
      <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
        Failed to load shards: {error.message}
      </Alert>
    );
  }

  // Detect if any filters are active
  const hasActiveFilters =
    searchQuery ||
    selectedStates.length < 4 || // Less than all 4 states
    !showPrimaries ||
    !showReplicas ||
    showSpecialIndices;

  // Only show "No shards found" if there are truly no shards AND no filters active
  if (!shards || (shards.length === 0 && !hasActiveFilters)) {
    return <Text c="dimmed">No shards found</Text>;
  }

  // Group shards by state for visualization
  const shardsByState = (sortedShards || []).reduce(
    (acc, shard) => {
      if (!acc[shard.state]) {
        acc[shard.state] = [];
      }
      acc[shard.state].push(shard);
      return acc;
    },
    {} as Record<string, ShardInfo[]>
  );

  // Pagination
  const totalPages = Math.ceil((sortedShards?.length || 0) / pageSize);
  const paginatedShards = sortedShards?.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <Stack gap="md">
      {/* Shard statistics cards */}
      <ShardStatsCards
        stats={{
          totalShards: sortedShards?.length || 0,
          primaryShards: sortedShards?.filter((s) => s.primary).length || 0,
          replicaShards: sortedShards?.filter((s) => !s.primary).length || 0,
          unassignedShards: shardsByState['UNASSIGNED']?.length || 0,
          relocatingShards: shardsByState['RELOCATING']?.length || 0,
          initializingShards: shardsByState['INITIALIZING']?.length || 0,
        }}
      />

      {/* Filters */}
      <Group wrap="wrap">
        <TextInput
          placeholder="Search by index or node..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => updateFilters(e.currentTarget.value, undefined, undefined, undefined)}
          style={{ flex: 1, maxWidth: 300 }}
        />

        <ShardStateFilterToggle
          states={['STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED']}
          selectedStates={selectedStates}
          onToggle={(state) => {
            const newStates = selectedStates.includes(state)
              ? selectedStates.filter((s) => s !== state)
              : [...selectedStates, state];
            // If unchecking the last state, reset to all states
            if (newStates.length === 0) {
              updateFilters(
                undefined,
                ['STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED'],
                undefined,
                undefined
              );
              return;
            }
            updateFilters(undefined, newStates, undefined, undefined);
          }}
        />

        {/* Shard type filter toggles */}
        <Group gap="md" wrap="wrap">
          {[
            { label: 'primaries', icon: IconStar, color: 'yellow', isShown: showPrimaries },
            { label: 'replicas', icon: IconCopy, color: 'blue', isShown: showReplicas },
          ].map(({ label, icon: Icon, color, isShown }) => {
            const isPrimary = label === 'primaries';
            return (
              <Group
                key={label}
                gap={4}
                style={{
                  cursor: 'pointer',
                  opacity: isShown ? 1 : 0.5,
                  transition: 'opacity 150ms ease',
                }}
                onClick={() => {
                  const newShowPrimaries = isPrimary ? !showPrimaries : showPrimaries;
                  const newShowReplicas = isPrimary ? showReplicas : !showReplicas;
                  // Prevent unchecking both primaries and replicas
                  if (!newShowPrimaries && !newShowReplicas) {
                    return; // Keep at least one type selected
                  }
                  updateFilters(
                    undefined,
                    undefined,
                    isPrimary ? newShowPrimaries : undefined,
                    isPrimary ? undefined : newShowReplicas
                  );
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    const newShowPrimaries = isPrimary ? !showPrimaries : showPrimaries;
                    const newShowReplicas = isPrimary ? showReplicas : !showReplicas;
                    // Prevent unchecking both primaries and replicas
                    if (!newShowPrimaries && !newShowReplicas) {
                      return; // Keep at least one type selected
                    }
                    updateFilters(
                      undefined,
                      undefined,
                      isPrimary ? newShowPrimaries : undefined,
                      isPrimary ? undefined : newShowReplicas
                    );
                  }
                }}
              >
                <Icon size={16} color={`var(--mantine-color-${color}-6)`} />
                <Text size="xs">{label}</Text>
              </Group>
            );
          })}
        </Group>

        <Group
          gap={4}
          style={{
            cursor: 'pointer',
            opacity: showSpecialIndices ? 1 : 0.5,
            transition: 'opacity 150ms ease',
          }}
          onClick={() => {
            const params = new URLSearchParams(searchParams);
            if (!showSpecialIndices) {
              params.set('showSpecial', 'true');
            } else {
              params.delete('showSpecial');
            }
            setSearchParams(params);
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              const params = new URLSearchParams(searchParams);
              if (!showSpecialIndices) {
                params.set('showSpecial', 'true');
              } else {
                params.delete('showSpecial');
              }
              setSearchParams(params);
            }
          }}
        >
          <IconEyeOff size={16} color="var(--mantine-color-violet-6)" />
          <Text size="xs">special</Text>
        </Group>
      </Group>

      <Card shadow="sm" padding="lg">
        {sortedShards && sortedShards.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No shards match your filters
          </Text>
        ) : (
          <ScrollArea>
            <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>
                  <ShardsSortableHeader
                    column="index"
                    label="Index"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <ShardsSortableHeader
                    column="shard"
                    label="Shard"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <ShardsSortableHeader
                    column="type"
                    label="Type"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <ShardsSortableHeader
                    column="state"
                    label="State"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <ShardsSortableHeader
                    column="node"
                    label="Node"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <ShardsSortableHeader
                    column="documents"
                    label="Documents"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
                <Table.Th>
                  <ShardsSortableHeader
                    column="size"
                    label="Size"
                    sortColumn={shardsSortColumn}
                    sortDirection={shardsSortDirection}
                    onSort={handleShardsSortColumn}
                  />
                </Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedShards?.map((shard, idx) => {
                const isUnassigned = shard.state === 'UNASSIGNED';

                return (
                  <Table.Tr
                    key={`${shard.index}-${shard.shard}-${idx}`}
                    style={{
                      backgroundColor: isUnassigned ? 'rgba(250, 82, 82, 0.1)' : undefined,
                      cursor: 'pointer',
                    }}
                    onClick={() => handleShardClick(shard)}
                  >
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{shard.index}</Text>
                        <CopyButton value={shard.index} tooltip="Copy index name" size="xs" />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{shard.shard}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={shard.primary ? 'blue' : 'gray'}>
                        {shard.primary ? 'Primary' : 'Replica'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <ShardTypeBadge primary={shard.primary} />
                        <Badge size="sm" color={getShardStateColor(shard.state)}>
                          {shard.state}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        {shard.node && openNodeModal ? (
                          <Anchor
                            component="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              // Pass the node name - the modal will need to look up the node ID
                              if (shard.node) {
                                openNodeModal(shard.node);
                              }
                            }}
                            style={{
                              textDecoration: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <Text size="sm" style={{ textDecoration: 'inherit' }}>
                              {shard.node}
                            </Text>
                          </Anchor>
                        ) : (
                          <Text size="sm">{shard.node || 'N/A'}</Text>
                        )}
                        {shard.node && (
                          <CopyButton value={shard.node} tooltip="Copy node name" size="xs" />
                        )}
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{shard.docs.toLocaleString()}</Text>
                        <CopyButton
                          value={shard.docs.toString()}
                          tooltip="Copy document count"
                          size="xs"
                        />
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm">{formatBytes(shard.store)}</Text>
                        <CopyButton
                          value={formatBytes(shard.store)}
                          tooltip="Copy size"
                          size="xs"
                        />
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
        )}
      </Card>

      {/* Pagination */}
      {sortedShards && sortedShards.length > pageSize && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={sortedShards.length}
          onPageChange={handleShardsPageChange}
          onPageSizeChange={handleShardsPageSizeChange}
        />
      )}

      {/* Shard Details Modal */}
      {selectedShard && (
        <ShardDetailsModal
          opened={detailsModalOpen}
          onClose={() => {
            setDetailsModalOpen(false);
            setSelectedShard(null);
          }}
          shard={selectedShard}
          clusterId={id!}
        />
      )}
    </Stack>
  );
});

