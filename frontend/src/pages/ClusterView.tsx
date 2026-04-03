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
  Checkbox,
  Tooltip,
  Modal,
  Skeleton,
  Anchor,
  UnstyledButton,
  Box,
} from '@mantine/core';
import { CopyButton } from '../components/CopyButton';
import { CodeEditor } from '../components/CodeEditor';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { defaultSection, isValidClusterSection } from '../routes/clusterRoutes';
import { useClusterNavigation } from '../hooks/useClusterNavigation';
import { useClusterSettings } from '../hooks/useClusterSettings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMutationWithNotification } from '../hooks/useMutationWithNotification';
import {
  IconAlertCircle,
  IconSettings,
  IconMap,
  IconDots,
  IconLock,
  IconLockOpen,
  IconRefresh,
  IconTrash,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { showSuccessNotification, showErrorNotification, showSpecialNotification } from '../utils/notifications';
import { queryKeys } from '../utils/queryKeys';
import { apiClient } from '../api/client';
// useDebounce is no longer used directly in ClusterView after view extraction
// import { useDebounce } from '../hooks/useDebounce';
import { useResponsivePageSize } from '../hooks/useResponsivePageSize';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useWatermarks } from '../hooks/useWatermarks';
import { useSparklineData, DataPoint } from '../hooks/useSparklineData';
import { useFaviconManager } from '../hooks/useFaviconManager';
import { useClusterName } from '../hooks/useClusterName';
import { useShardAllocation } from '../hooks/useShardAllocation';
import { usePerNodeShards } from '../hooks/usePerNodeShards';
import { useNodesShardSummary } from '../hooks/useNodesShardSummary';
import { useClusterIndices } from '../hooks/useClusterIndices';
import { useClusterNodes } from '../hooks/useClusterNodes';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { IndexEdit } from './IndexEdit';
import { IndexCreate } from './IndexCreate';
import { RestConsole } from './RestConsole';
import { NodeModal } from '../components/NodeModal';
import { TasksView } from './cluster/TasksView';
import { ShardTypeBadge } from '../components/ShardTypeBadge';
// ShardsTable is used in IndexEdit modal; ClusterView does not need direct import
import { TIME_RANGE_PRESETS } from '../components/TimeRangePicker';
import { ShardStatsCards } from '../components/ShardStatsCards';
import { sortNodesMasterFirst } from '../utils/node-sorting';
import { TablePagination } from '../components/TablePagination';
import TableSkeleton from '../components/TableSkeleton';
import { MasterIndicator } from '../components/MasterIndicator';
import { RoleIcons } from '../components/RoleIcons';
import { BulkOperationsMenu } from '../components/BulkOperationsMenu';
import { BulkOperationConfirmModal } from '../components/BulkOperationConfirmModal';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useModalStack } from '../hooks/useModalStack';
import { ClusterChangeNotifier } from '../components/ClusterChangeNotifier';
import { AllocationLockIndicator, AllocationState } from '../components/Topology/AllocationLockIndicator';
import { NodeStatsCards } from '../components/NodeStatsCards';
import { IconTerminal2 } from '@tabler/icons-react';
import { AppErrorBoundary } from '../components/AppErrorBoundary';
import { OverviewView } from './cluster/OverviewView';
import type { NodeInfo, ShardInfo, ClusterInfo, PaginatedResponse, IndexInfo } from '../types/api';
import type { BulkOperationType } from '../types/api';
import { formatLoadAverage, getLoadColor, formatUptimeDetailed, formatBytes, formatPercentRatio } from '../utils/formatters';
import { getHealthColor, getShardStateColor } from '../utils/colors';
import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import type { GroupingAttribute, GroupingConfig } from '../utils/topologyGrouping';
import { IndicesView } from './cluster/IndicesView';
import { NodesView } from './cluster/NodesView';
import { ShardsView } from './cluster/ShardsView';
import { TopologyView } from './cluster/TopologyView';
import { StatisticsView } from './cluster/StatisticsView';

// Helper: merge per-node shards with cluster-level unassigned shards.
// Deduplicate by index:shard:primary:node for node-backed shards, but
// preserve multiple UNASSIGNED copies (node === null) by appending a
// per-baseKey counter when node is null. Exported for unit testing.
export function mergeShardLists(allShardsList: ShardInfo[] | undefined, unassignedList: ShardInfo[] | undefined): ShardInfo[] {
  const all = allShardsList || [];
  const unassigned = unassignedList || [];

  const baseKey = (s: ShardInfo) => `${s.index}:${s.shard}:${String(s.primary)}`;
  const counters = new Map<string, number>();
  const mergedMap = new Map<string, ShardInfo>();

  for (const s of [...all, ...unassigned]) {
    const b = baseKey(s);
    const key = s.node ? `${b}:${s.node}` : `${b}:__unassigned__:${counters.get(b) ?? 0}`;
    if (!s.node) counters.set(b, (counters.get(b) ?? 0) + 1);
    if (!mergedMap.has(key)) mergedMap.set(key, s);
  }

  return Array.from(mergedMap.values());
}

// Index background coloring is now handled inside the extracted topology components.

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

/**
 * Console toggle button for cluster header
 * Shows alongside cluster name and lock indicator
 */
function ConsoleToggleClusterHeader() {
  const { isOpen, isSticky, togglePanel } = useConsolePanel();

  // Hide button when pinned and open - console stays visible
  if (isOpen && isSticky) {
    return null;
  }

  return (
    <Tooltip label={isOpen ? 'Close console' : 'Open console'}>
      <ActionIcon
        variant={isOpen ? 'filled' : 'subtle'}
        size="lg"
        onClick={togglePanel}
        aria-label={isOpen ? 'Close console' : 'Open console'}
      >
        <IconTerminal2 size={20} />
      </ActionIcon>
    </Tooltip>
  );
}

export function ClusterView() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const refreshInterval = useRefreshInterval();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  // Get resolved cluster name
  const clusterName = useClusterName(id || '');

  // Shards filters for shards tab are now owned by ShardsView

  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);

  // Get navigation helper
  const { navigateToNode, navigateToIndex, navigateToShard, closeModal, currentSection: getCurrentSection } = useClusterNavigation();

  // Get active section from path parameter, default to 'overview'
  // This supports both /cluster/:id and /cluster/:id/:section URL formats
  // Also checks for bg query param for modal background section
  const activeSection = getCurrentSection() || defaultSection;
  const activeView = activeSection;

  // Topology view type state
  // Topology view type state — read from searchParam or infer from pathname on first mount
  const [topologyViewType, setTopologyViewTypeState] = useState<'node' | 'index' | 'canvas' | 'sankey' | 'disk'>(() => {
    const urlParam = searchParams.get('topologyView') as 'node' | 'index' | 'canvas' | 'sankey' | 'disk' | null;
    if (urlParam === 'node' || urlParam === 'index' || urlParam === 'canvas' || urlParam === 'sankey' || urlParam === 'disk') return urlParam;
    if (location.pathname.includes('/topology/index')) return 'index';
    if (location.pathname.includes('/topology/canvas')) return 'canvas';
    if (location.pathname.includes('/topology/dot')) return 'node';
    return 'node';
  });

  const setTopologyViewType = (value: 'node' | 'index' | 'canvas' | 'sankey' | 'disk') => {
    setTopologyViewTypeState(value);
    const newParams = new URLSearchParams(searchParams);
    newParams.set('topologyView', value);
    setSearchParams(newParams, { replace: true });
  };

  // Topology grouping state
  const [topologyGroupingConfig, setTopologyGroupingConfig] = useState<GroupingConfig>({
    attribute: 'none',
    value: undefined,
  });

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
  // Tracks whether the canvas topology is at L2 zoom (> 0.7 — shard dots visible).
  // Used to gate the expensive per-node shard fetching.
  const [canvasIsL2, setCanvasIsL2] = useState(false);
  const handleCanvasZoomChange = useCallback((z: number) => setCanvasIsL2(z > 0.7), []);

  // Shared shard allocation state
  // Always fetch cluster settings so the AllocationLockIndicator in the header
  // can render immediately on any cluster page (nodes/indices/shards/tasks).
  // Only enable frequent refetching when overview/topology views are active.
  const { data: clusterSettings } = useClusterSettings(id ?? '', {
    enabled: !!id,
    refetchInterval: activeView === 'overview' || activeView === 'topology' ? refreshInterval : false,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  // Extract allocation state for AllocationLockIndicator
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
  const allocationState: AllocationState = (() => {
    if (!clusterSettings) {
      return 'all';
    }

    const transient = clusterSettings.transient as Record<string, unknown> | undefined;
    const persistent = clusterSettings.persistent as Record<string, unknown> | undefined;

    // Navigate through nested structure: cluster.routing.allocation.enable
    const transientCluster = transient?.cluster as Record<string, unknown> | undefined;
    const persistentCluster = persistent?.cluster as Record<string, unknown> | undefined;
    const transientRouting = transientCluster?.routing as Record<string, unknown> | undefined;
    const persistentRouting = persistentCluster?.routing as Record<string, unknown> | undefined;
    const transientAllocation = transientRouting?.allocation as Record<string, unknown> | undefined;
    const persistentAllocation = persistentRouting?.allocation as Record<string, unknown> | undefined;

    // Get enable value (transient takes precedence over persistent)
    const enableValue = (transientAllocation?.enable as string) || (persistentAllocation?.enable as string) || 'all';

    // Validate and return allocation state
    if (enableValue === 'all' || enableValue === 'primaries' || enableValue === 'new_primaries' || enableValue === 'none') {
      return enableValue as AllocationState;
    }
    return 'all'; // Default fallback
  })();

  const {
    enableAllocation: enableShardAllocationHeader,
    disableAllocation: disableShardAllocationHeader,
    isPending: allocationMutationPendingHeader,
  } = useShardAllocation(id!);

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
    setSearchParams(newParams, { replace: true });
  };

  const setNodeNameFilter = (value: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set('nodeFilter', value);
    } else {
      newParams.delete('nodeFilter');
    }
    setSearchParams(newParams, { replace: true });
  };

  // Wildcard pattern matching (Elasticsearch cat API style)
  const matchesWildcard = useCallback((text: string, pattern: string): boolean => {
    if (!pattern) return true;
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.');
    const regex = new RegExp(regexPattern, 'i');
    return regex.test(text);
  }, []);

  // Extract modal IDs from search params (no path change = no remount)
  const nodeIdFromPath = searchParams.get('nodeModal');
  const indexNameFromPath = searchParams.get('indexModal');

  // Index modal state
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [selectedIndexName, setSelectedIndexName] = useState<string | null>(null);

  // Modal stack for layered modals
  const { modalStack, pushModal, popModal } = useModalStack();

  // Open index modal when URL path changes
  useEffect(() => {
    if (indexNameFromPath) {
      setSelectedIndexName(indexNameFromPath);
      setIndexModalOpen(true);
    } else {
      setIndexModalOpen(false);
      setSelectedIndexName(null);
    }
  }, [indexNameFromPath]);

  // Handle opening index modal
  const openIndexModal = (indexName: string, tab?: string) => {
    navigateToIndex(indexName, tab || 'visualization');
  };

  // Handle closing index modal - pop from stack or navigate back to section
  const closeIndexModal = () => {
    if (modalStack.length > 0) {
      popModal();
    } else {
      closeModal();
    }
  };

  // Shared topology handlers
  const handleTopologyShardClick = (shard: ShardInfo, event?: React.MouseEvent) => {
    // Support optional event (some callers may call with only shard)
    if (event) {
      event.stopPropagation();
      setTopologyContextMenuPosition({ x: event.clientX, y: event.clientY });
    } else {
      // Fallback to center of viewport when no event is provided
      setTopologyContextMenuPosition({ x: Math.floor(window.innerWidth / 2), y: Math.floor(window.innerHeight / 2) });
    }
    setTopologyContextMenuShard(shard);
    setTopologyContextMenuOpened(true);
  };

  // Handler for shard clicks in index modal - opens shard modal on top
  const handleShardClickInIndexModal = useCallback(
    (shard: ShardInfo) => {
      if (shard.node) {
        // Include shard primary flag and node so modal header can render correctly
        pushModal({
          type: 'shard',
          indexName: shard.index,
          shardId: `${shard.index}[${shard.shard}]`,
          shardPrimary: shard.primary,
          shardNode: shard.node,
        });
      }
    },
    [pushModal]
  );

  const handleTopologyContextMenuClose = () => {
    setTopologyContextMenuOpened(false);
    setTopologyContextMenuShard(null);
  };

  const handleTopologySelectForRelocation = (shard: ShardInfo) => {
    if (!allNodesArray || !allShards) {
      handleTopologyContextMenuClose();
      return;
    }

    const validDestinations: string[] = [];
    let sourceNode: NodeInfo | null = null;

    for (const node of allNodesArray) {
      if (node.id === shard.node || node.name === shard.node) {
        sourceNode = node;
        continue;
      }
      const nodeHasThisShard = allShards.some(
        (s) => (s.node === node.id || s.node === node.name) && s.index === shard.index && s.shard === shard.shard
      );
      if (nodeHasThisShard) continue;
      if (!node.roles.includes('data')) continue;
      validDestinations.push(node.id);
    }

    if (validDestinations.length === 0) {
      showSpecialNotification({
        title: 'Cannot Relocate',
        message: `Shard ${shard.shard} (${shard.primary ? 'Primary' : 'Replica'}) of index "${shard.index}" cannot be relocated. All data nodes either already host this shard or are the source node.`,
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
    const destNode = allNodesArray.find((n) => n.id === nodeId || n.name === nodeId);
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

      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).shards() });
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).nodes() });
      
      showSuccessNotification({
        title: 'Shard Relocation Started',
        message: `Shard ${relocationShard.shard} of index "${relocationShard.index}" is being relocated`,
      });
    } catch (error) {
      showErrorNotification({
        title: 'Relocation Failed',
        message: error instanceof Error ? error.message : 'Failed to relocate shard',
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

  // Node modal is driven via URL and modal stack; effect ensures modal is pushed when URL param appears
  useEffect(() => {
    if (nodeIdFromPath) {
      pushModal({ type: 'node', nodeId: nodeIdFromPath });
    }
  }, [nodeIdFromPath, pushModal]);

  // Open create-index modal when path matches /indices/create OR when search param indexCreate is present
  useEffect(() => {
    const isCreatePath = location.pathname.includes('/indices/create');
    const isCreateParam = searchParams.get('indexCreate') != null;
    const alreadyOpen = modalStack.some((m) => m.type === 'indexCreate');
    if ((isCreatePath || isCreateParam) && !alreadyOpen) {
      pushModal({ type: 'indexCreate' });
    }
  }, [location.pathname, searchParams, modalStack, pushModal]);

  // Handle opening node modal (keeps URL behavior)
  const openNodeModal = (nodeId: string) => {
    navigateToNode(nodeId);
    // push immediately so UI updates even if URL-driven effect lags
    pushModal({ type: 'node', nodeId });
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
    queryKey: queryKeys.cluster(id!).all(),
    queryFn: async () => {
      const clustersResponse = await apiClient.getClusters(1, 100);
      return clustersResponse.items.find((c: ClusterInfo) => c.id === id);
    },
    enabled: !!id,
    staleTime: 60000,
    placeholderData: (previousData) => previousData,
  });

  // Fetch cluster statistics with auto-refresh
  const {
    data: stats,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
  } = useQuery({
    queryKey: queryKeys.cluster(id!).stats(),
    queryFn: () => apiClient.getClusterStats(id!),
    refetchInterval: refreshInterval,
    enabled: !!id && (activeView === 'overview' || activeView === 'statistics'),
    refetchOnMount: 'always',
    placeholderData: (previousData) => previousData,
  });

  // Update favicon based on cluster health
  // Requirements: 12.2, 12.3, 12.4, 12.5
  useFaviconManager(stats?.health || null);

  // Trigger immediate stats refetch when switching to statistics tab
  // This ensures graphs are populated immediately instead of waiting for the next refresh interval
  useEffect(() => {
    if (activeView === 'statistics' && id) {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id).stats() });
    }
  }, [activeView, id, queryClient]);

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
  const { data: metricsHistory, isFetching: metricsHistoryFetching } = useQuery({
    queryKey: queryKeys.cluster(id!).metricsHistory(timeRangeMinutes),
    queryFn: async () => {
      if (!id) throw new Error('Cluster ID is required');
      const now = Math.floor(Date.now() / 1000);
      const start = now - timeRangeMinutes * 60;
      return apiClient.getClusterMetrics(id, { start, end: now });
    },
    enabled: !!id && (activeView === 'overview' || activeView === 'statistics'),
    refetchInterval: refreshInterval,
    staleTime: 30000,
    placeholderData: (previousData) => previousData,
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
    activeView,
    true
  );
  
  const indicesHistoryInternal = useSparklineData(
    currentInternalMetrics?.indices,
    50,
    activeView,
    true
  );
  const documentsHistoryInternal = useSparklineData(
    currentInternalMetrics?.documents,
    50,
    activeView,
    true
  );
  const shardsHistoryInternal = useSparklineData(
    currentInternalMetrics?.shards,
    50,
    activeView,
    true
  );
  const unassignedHistoryInternal = useSparklineData(
    currentInternalMetrics?.unassigned,
    50,
    activeView,
    true
  );
  const cpuHistoryInternal = useSparklineData(
    currentInternalMetrics?.cpu,
    50,
    activeView,
    true
  );
  const memoryHistoryInternal = useSparklineData(
    currentInternalMetrics?.memory,
    50,
    activeView,
    true
  );
  const diskHistoryInternal = useSparklineData(
    currentInternalMetrics?.disk,
    50,
    activeView,
    true
  );

  // Hidden indices toggle state
  const [showHiddenIndices, setShowHiddenIndices] = useState(false);
  
  // Extract Prometheus queries from metrics history
  const prometheusQueries = metricsHistory?.prometheus_queries;

  // Track historical data for sparklines (fallback when not in statistics tab)
  // Pass activeView as resetKey so data resets when switching to statistics tab
  const nodesHistorySparkline = useSparklineData(
    stats?.numberOfNodes,
    20,
    activeView,
    false // Return number[] for sparklines
  ) as number[];
  const indicesHistorySparkline = useSparklineData(
    stats?.numberOfIndices,
    20,
    activeView,
    false
  ) as number[];
  const documentsHistorySparkline = useSparklineData(
    stats?.numberOfDocuments,
    20,
    activeView,
    false
  ) as number[];
  const shardsHistorySparkline = useSparklineData(
    stats?.activeShards,
    20,
    activeView,
    false
  ) as number[];
  const unassignedHistorySparkline = useSparklineData(
    stats?.unassignedShards,
    20,
    activeView,
    false
  ) as number[];

  // Use metrics history data when available (statistics tab), otherwise use sparkline data
  // For ClusterStatistics component (needs DataPoint[])
  // Internal metrics (single point): use accumulated history
  // Prometheus metrics (time series): use data directly
  const nodesHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? nodesHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.node_count,
            timestamp: new Date(d.date).getTime(),
          }))
      : nodesHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const indicesHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? indicesHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.index_count || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : indicesHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const documentsHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? documentsHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.document_count || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : documentsHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const shardsHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? shardsHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.shard_count || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : shardsHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const unassignedHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? unassignedHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.unassigned_shards || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : unassignedHistorySparkline.map((v) => ({ value: v, timestamp: Date.now() }));

  const diskUsageHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
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
    activeView === 'statistics' && metricsHistory?.data
      ? isInternalMetrics
        ? cpuHistoryInternal
        : metricsHistory.data.map((d) => ({
            value: d.cpu_percent || 0,
            timestamp: new Date(d.date).getTime(),
          }))
      : [];

  const memoryHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
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

    if (activeView === 'statistics' && !isInternalMetrics && metricsHistory?.raw_metrics?.memory) {
      for (const point of metricsHistory.raw_metrics.memory) {
        // Create a series key from labels in logfmt format (e.g., "area=heap")
        const seriesKey = point.labels
          ? Object.entries(point.labels)
              .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
              .map(([k, v]) => `${k}=${v}`)
              .join(',')
          : 'default';
        
        let series = memorySeriesMap.get(seriesKey);
        if (!series) {
          series = [];
          memorySeriesMap.set(seriesKey, series);
        }

        series.push({
          value: point.value,
          timestamp: point.timestamp * 1000, // Convert to milliseconds
        });
      }
    }
    
    // Convert map to array of series with formatted names
    return Array.from(memorySeriesMap.entries()).map(([key, data]) => {
      // Parse logfmt key into a proper label map (e.g., "area=heap,type=used" → {area:"heap",type:"used"})
      const labelMap = key.split(',').reduce((acc, pair) => {
        const eqIdx = pair.indexOf('=');
        if (eqIdx !== -1) {
          const k = pair.slice(0, eqIdx);
          const v = pair.slice(eqIdx + 1);
          acc[k] = v;
        }
        return acc;
      }, {} as Record<string, string>);

      // Use the "area" label for display; fall back to first value then generic name
      const areaValue = labelMap['area'] ?? Object.values(labelMap)[0] ?? '';
      // Format: "non_heap" → "Non-heap", "heap" → "Heap"
      const displayName = areaValue
        ? areaValue.replace(/_/g, '-').replace(/^(.)/, (c) => c.toUpperCase())
        : 'Memory';
      
      return {
        name: displayName,
        data,
        labels: labelMap,
      };
    });
  }, [activeView, isInternalMetrics, metricsHistory?.raw_metrics?.memory]);

  // Group raw CPU metrics by labels to create separate series (Prometheus only)
  // This handles metrics with grouping like avg by (node) (elasticsearch_process_cpu_percent)
  // For internal metrics, raw_metrics is undefined, so these will be empty arrays
  const cpuSeries = useMemo(() => {
    const cpuSeriesMap = new Map<string, DataPoint[]>();

    if (activeView === 'statistics' && !isInternalMetrics && metricsHistory?.raw_metrics?.cpu) {
      for (const point of metricsHistory.raw_metrics.cpu) {
        // Create a series key from labels in logfmt format (e.g., "node=node-1")
        const seriesKey = point.labels
          ? Object.entries(point.labels)
              .sort(([a], [b]) => a.localeCompare(b)) // Sort for consistency
              .map(([k, v]) => `${k}=${v}`)
              .join(',')
          : 'default';
        
        let series = cpuSeriesMap.get(seriesKey);
        if (!series) {
          series = [];
          cpuSeriesMap.set(seriesKey, series);
        }

        series.push({
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
  }, [activeView, isInternalMetrics, metricsHistory?.raw_metrics?.cpu]);

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

  // Fetch ALL nodes (unfiltered) to get available roles for the filter UI
  // This ensures filters are always visible even when current filters exclude all nodes
  const {
    data: allNodesUnfiltered,
    isInitialLoading: nodesLoading,
    error: nodesError,
  } = useClusterNodes(id, {
    page: 1,
    pageSize: 1000,
    filters: { search: '' },
    enabled:
      !!id && (activeView === 'topology' || activeView === 'nodes' || activeView === 'statistics'),
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Use unfiltered nodes for topology view so it always shows all nodes
  // regardless of node role filters applied to the nodes list
  const allNodesArray = useMemo(() => allNodesUnfiltered?.items ?? [], [allNodesUnfiltered]);

  const selectedShardStates = useMemo(
    () =>
      searchParams.get('shardStates')?.split(',').filter(Boolean) || [
        'STARTED',
        'INITIALIZING',
        'RELOCATING',
        'UNASSIGNED',
      ],
    [searchParams],
  );

  // True when any topology filter deviates from the "show everything" default.
  // Used to trigger full shard loading in canvas view even below L2 zoom,
  // so stats cards can show accurate filtered counts.
  const hasAnyFilter =
    !!indexNameFilter ||
    !!nodeNameFilter ||
    selectedShardStates.length < 4;

  // Whether special (dot-prefixed) indices are shown — read from URL for stats computation.
  const showSpecialIndices = searchParams.get('showSpecial') === 'true';

  const handleTopologyGroupingChange = useCallback((attribute: GroupingAttribute, value?: string) => {
    setTopologyGroupingConfig({ attribute, value });
  }, []);

  // Fetch ALL indices for topology view (unfiltered, unpaginated)
  const {
    data: allIndicesPaginated,
    isInitialLoading: allIndicesLoading,
    error: allIndicesError,
  } = useClusterIndices(id, {
    page: 1,
    pageSize: 10000,
    filters: { showSpecial: true },
    enabled:
      !!id && (activeView === 'topology' || activeView === 'indices' || activeView === 'statistics'),
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Use all indices for topology
  const allIndicesArray: IndexInfo[] = useMemo(
    () => allIndicesPaginated?.items ?? [],
    [allIndicesPaginated],
  );
  
  // Calculate hidden indices count from ALL indices (for statistics tab)
  const hiddenIndicesCount = allIndicesArray.filter((idx) => idx.name.startsWith('.')).length;

  // Progressive shard loading per node for topology view (prevents OOM).
  // Disabled on canvas view — the canvas uses the lightweight shard summary instead.
  const nodeIdsForShards = useMemo(() => allNodesArray.map(n => n.id), [allNodesArray]);
  const {
    allShards,
    isInitialLoading: allShardsLoading,
    firstError: allShardsError,
  } = usePerNodeShards(id, nodeIdsForShards, !!id && activeView === 'topology' && (topologyViewType !== 'canvas' || canvasIsL2 || hasAnyFilter), 4);

  // Lightweight per-node shard count summary for the canvas topology view.
  // Issues a single _cat/shards request on the backend rather than one request
  // per node. Only enabled when the canvas sub-view is active.
  const { data: canvasShardSummary = [] } = useNodesShardSummary(id, {
    enabled: !!id && activeView === 'topology' && topologyViewType === 'canvas',
    refetchInterval: refreshInterval,
  });

  // Additionally fetch cluster-level UNASSIGNED shards only (paged collector).
  // Disabled on canvas view — unassigned counts are included in canvasShardSummary.
  const {
    data: unassignedClusterShards = [],
  } = useQuery<ShardInfo[]>({
    queryKey: queryKeys.cluster(id!).shards(undefined, { state: 'UNASSIGNED' }),
    queryFn: async () => {
      if (!id) return [];
      const pageSize = 2000; // conservative large page to avoid many round trips
      let page = 1;
      const collected: ShardInfo[] = [];

      while (true) {
        const resp = await apiClient.getShards(id!, page, pageSize, { state: 'UNASSIGNED' });
        // resp may be PaginatedResponse<ShardInfo>
        // Response is a PaginatedResponse<ShardInfo> — narrow safely
        const paginated = resp as PaginatedResponse<ShardInfo> | Record<string, unknown>;
        const items: ShardInfo[] = (paginated && (paginated as PaginatedResponse<ShardInfo>).items) ?? [];
        if (items.length > 0) collected.push(...items);
        if (!items || items.length < pageSize) break;
        page += 1;
      }

      return collected;
    },
    enabled: !!id && activeView === 'topology',
    refetchInterval: refreshInterval,
    staleTime: 5 * 60 * 1000,
    placeholderData: () => [],
  });

  const mergedAllShards = useMemo(() => mergeShardLists(allShards, unassignedClusterShards), [allShards, unassignedClusterShards]);

  // mergedAllShards now contains per-node shards plus cluster-level unassigned shards

  // ── Filter-aware, zoom-independent stats for TopologyStatsCards ───────────────
  // Stats are computed from full shard data when available (filters active or L2 zoom),
  // or fall back to the lightweight canvasShardSummary + unassigned counts when full
  // data is not loaded (canvas at L0/L1 with no active filters).

  const statsNodeCount = useMemo(() => {
    const dataNodes = allNodesArray.filter((n) => n.roles.includes('data'));
    if (!nodeNameFilter) return dataNodes.length;
    return dataNodes.filter((n) => matchesWildcard(n.name, nodeNameFilter)).length;
  }, [allNodesArray, nodeNameFilter, matchesWildcard]);

  const statsIndexCount = useMemo(() => {
    let arr = allIndicesArray;
    if (!showSpecialIndices) arr = arr.filter((i) => !i.name.startsWith('.'));
    if (indexNameFilter) arr = arr.filter((i) => matchesWildcard(i.name, indexNameFilter));
    return arr.length;
  }, [allIndicesArray, indexNameFilter, showSpecialIndices, matchesWildcard]);

  const { statsShardCount, statsPrimaryCount, statsReplicaCount, statsUnassignedCount } = useMemo(() => {
    if (mergedAllShards.length > 0) {
      // Full shard data available — apply all active filters.
      const filtered = mergedAllShards.filter((s) => {
        if (!selectedShardStates.includes(s.state)) return false;
        if (indexNameFilter && !matchesWildcard(s.index, indexNameFilter)) return false;
        if (nodeNameFilter) {
          // Unassigned shards have no node — exclude them when a node filter is active.
          if (!s.node || !matchesWildcard(s.node, nodeNameFilter)) return false;
        }
        return true;
      });
      return {
        statsShardCount: filtered.length,
        statsPrimaryCount: filtered.filter((s) => s.primary).length,
        statsReplicaCount: filtered.filter((s) => !s.primary).length,
        statsUnassignedCount: filtered.filter((s) => s.state === 'UNASSIGNED').length,
      };
    }
    // Full shards not loaded (canvas at L0/L1, no active filters).
    // Derive approximate totals from the lightweight canvasShardSummary + unassignedClusterShards.
    const summaryPrimary = canvasShardSummary.reduce((acc, s) => acc + s.primary, 0);
    const summaryReplica = canvasShardSummary.reduce((acc, s) => acc + s.replica, 0);
    const unassignedCount = unassignedClusterShards.length;
    return {
      statsShardCount: summaryPrimary + summaryReplica + unassignedCount,
      statsPrimaryCount: summaryPrimary,
      statsReplicaCount: summaryReplica,
      statsUnassignedCount: unassignedCount,
    };
  }, [mergedAllShards, selectedShardStates, indexNameFilter, nodeNameFilter, matchesWildcard, canvasShardSummary, unassignedClusterShards]);

  if (!id) {
    return (
      <Stack p="md">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </Stack>
    );
  }

  if (statsLoading && !stats) {
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
      <ClusterChangeNotifier clusterId={id} nodes={allNodesArray} indices={allIndicesArray} />
      
      {/* Cluster Name with Version and Allocation Lock Indicator */}
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
          {/* Console Toggle & Allocation Lock - right side group */}
          <Group gap="xs">
            <ConsoleToggleClusterHeader />
            
            {/* Allocation Lock Indicator - Requirements: 2.1, 2.2, 2.7 */}
            {clusterSettings && (
              <AllocationLockIndicator
                allocationState={allocationState}
                enableAllocationMutation={{
                  mutate: (_variables, options) => enableShardAllocationHeader(options),
                  isPending: allocationMutationPendingHeader,
                }}
                disableAllocationMutation={{
                  mutate: (mode, options) => disableShardAllocationHeader(mode, options),
                  isPending: allocationMutationPendingHeader,
                }}
              />
            )}
          </Group>
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
      {activeView === 'overview' && (
        <AppErrorBoundary key="overview" fallbackTitle="Overview failed to load">
          <OverviewView
            clusterName={clusterName}
            stats={stats}
            statsLoading={statsFetching}
            nodesHistoryNumbers={nodesHistoryNumbers}
            indicesHistoryNumbers={indicesHistoryNumbers}
            documentsHistoryNumbers={documentsHistoryNumbers}
            shardsHistoryNumbers={shardsHistoryNumbers}
            unassignedHistoryNumbers={unassignedHistoryNumbers}
            handleTabChange={handleTabChange}
            getColor={getColor}
          />
        </AppErrorBoundary>
      )}

      {/* Topology Section */}
      {activeView === 'topology' && (
        <AppErrorBoundary key="topology" fallbackTitle="Topology failed to load">
          <TopologyView
            clusterId={id ?? ''}
            allNodesArray={allNodesArray}
            allIndicesArray={allIndicesArray}
          allShards={mergedAllShards}
            shardSummary={canvasShardSummary}
            statsNodeCount={statsNodeCount}
            statsIndexCount={statsIndexCount}
            statsShardCount={statsShardCount}
            statsPrimaryCount={statsPrimaryCount}
            statsReplicaCount={statsReplicaCount}
            statsUnassignedCount={statsUnassignedCount}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            topologyViewType={topologyViewType}
            setTopologyViewType={setTopologyViewType}
            topologyGroupingConfig={topologyGroupingConfig}
            handleTopologyGroupingChange={handleTopologyGroupingChange}
            indexNameFilter={indexNameFilter}
            nodeNameFilter={nodeNameFilter}
            setIndexNameFilter={setIndexNameFilter}
            setNodeNameFilter={setNodeNameFilter}
            selectedShardStates={selectedShardStates}
            matchesWildcard={matchesWildcard}
            showSpecialIndices={showSpecialIndices}
            nodesLoading={nodesLoading}
            allIndicesLoading={allIndicesLoading}
            allShardsLoading={allShardsLoading}
            nodesError={nodesError}
            allIndicesError={allIndicesError}
            allShardsError={allShardsError}
            relocationMode={relocationMode}
            validDestinationNodes={validDestinationNodes}
            relocationSourceNode={relocationSourceNode}
            relocationDestinationNode={relocationDestinationNode}
            relocationConfirmOpened={relocationConfirmOpened}
            relocationShard={relocationShard}
            relocationInProgress={relocationInProgress}
            topologyContextMenuShard={topologyContextMenuShard}
            topologyContextMenuPosition={topologyContextMenuPosition}
            topologyContextMenuOpened={topologyContextMenuOpened}
            handleTopologyCancelRelocation={handleTopologyCancelRelocation}
            handleTopologyDestinationClick={handleTopologyDestinationClick}
            handleTopologyShardClick={handleTopologyShardClick}
            handleTopologyContextMenuClose={handleTopologyContextMenuClose}
            handleTopologySelectForRelocation={handleTopologySelectForRelocation}
            openIndexModal={openIndexModal}
            openNodeModal={openNodeModal}
            pushModal={pushModal}
            setRelocationConfirmOpened={setRelocationConfirmOpened}
             handleTopologyConfirmRelocation={handleTopologyConfirmRelocation}
             onZoomChange={handleCanvasZoomChange}
           />
        </AppErrorBoundary>
      )}

      {/* Statistics Section */}
      {activeView === 'statistics' && (
        <AppErrorBoundary key="statistics" fallbackTitle="Statistics failed to load">
          <StatisticsView
            clusterInfo={clusterInfo ?? null}
            isInternalMetrics={!!isInternalMetrics}
            metricsLoading={metricsHistoryFetching}
            timeRangeDropdownOpened={timeRangeDropdownOpened}
            setTimeRangeDropdownOpened={setTimeRangeDropdownOpened}
            selectedTimeRange={selectedTimeRange}
            TIME_RANGE_PRESETS={TIME_RANGE_PRESETS}
            searchParams={searchParams}
            setSearchParams={setSearchParams}
            nodesHistory={nodesHistory}
            cpuHistory={cpuHistory}
            cpuSeries={cpuSeries}
            memoryHistory={memoryHistory}
            memorySeries={memorySeries}
            indicesHistory={indicesHistory}
            documentsHistory={documentsHistory}
            shardsHistory={shardsHistory}
            unassignedHistory={unassignedHistory}
            diskUsageHistory={diskUsageHistory}
            stats={stats}
            allNodesArray={allNodesArray}
            prometheusQueries={prometheusQueries}
            showHiddenIndices={showHiddenIndices}
            setShowHiddenIndices={setShowHiddenIndices}
            hiddenIndicesCount={hiddenIndicesCount}
            allIndicesArray={allIndicesArray}
          />
        </AppErrorBoundary>
      )}

      {/* Nodes Section */}
      {activeView === 'nodes' && (
        <AppErrorBoundary key="nodes" fallbackTitle="Nodes view failed to load">
          <NodesView clusterId={id!} />
        </AppErrorBoundary>
      )}

      {/* Indices Section */}
      {activeView === 'indices' && (
        <AppErrorBoundary key="indices" fallbackTitle="Indices view failed to load">
          <IndicesView clusterId={id!} />
        </AppErrorBoundary>
      )}

      {/* Shards Section */}
      {activeView === 'shards' && (
        <AppErrorBoundary key="shards" fallbackTitle="Shards view failed to load">
          <ShardsView clusterId={id!} />
        </AppErrorBoundary>
      )}

      {/* Console Section */}
      {activeView === 'console' && (
        <AppErrorBoundary key="console" fallbackTitle="Console failed to load">
          <RestConsole />
        </AppErrorBoundary>
      )}

      {/* Tasks Section */}
      {activeView === 'tasks' && (
        <AppErrorBoundary key="tasks" fallbackTitle="Tasks view failed to load">
          <TasksView clusterId={id!} />
        </AppErrorBoundary>
      )}

      {/* Index Edit Modal */}
      {selectedIndexName && (
        <Modal.Root opened={indexModalOpen} onClose={closeIndexModal} size="90%" zIndex={1000}>
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
                  <Badge size="lg" variant="light" color="blue" style={{ textTransform: 'none' }}>
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
            <IndexEdit
              constrainToParent
              hideHeader
              onShardClick={handleShardClickInIndexModal}
              onNodeClick={openNodeModal}
            />
            </Modal.Body>
          </Modal.Content>
        </Modal.Root>
      )}

      {/* Node & Shard Modals from stack (allows layering) */}

      {modalStack.map((modal) => {
        // Helper to remove only specific modal param from URL
        const removeModalParam = (type: string) => {
          const params = new URLSearchParams(searchParams);
          if (type === 'node') params.delete('nodeModal');
          if (type === 'index') {
            params.delete('indexModal');
            params.delete('indexTab');
          }
          if (type === 'shard') params.delete('shardModal');
          setSearchParams(params, { replace: false });
        };

    if (modal.type === 'shard' && modal.shardId) {
          const [indexName, shardPart] = modal.shardId.includes('[')
            ? modal.shardId.split('[')
            : [modal.indexName, modal.shardId];
          const shardNum = shardPart ? parseInt(shardPart.replace(']', ''), 10) : 0;

          // Use metadata from the modal entry if available (pushModal should
          // include whether this shard was primary and its node). Fall back to
          // sensible defaults for backward compatibility.
          // Narrow modal metadata rather than relying on `any`.
          const modalMeta = modal as unknown as { shardPrimary?: boolean; shardNode?: string } | undefined;
          const shard: ShardInfo = {
            index: modal.indexName || indexName || '',
            shard: shardNum,
            primary: modalMeta?.shardPrimary ?? true,
            state: 'STARTED',
            node: modalMeta?.shardNode ?? undefined,
            docs: 0,
            store: 0,
          };

          return (
            <ShardDetailsModal
              key={modal.id}
              shard={shard}
              opened={true}
              onClose={() => {
                // Compute stack after removing this modal
                popModal();

                const newTop = modalStack.filter((m) => m.id !== modal.id).slice(-1)[0] ?? null;
                if (newTop) {
                  // Show previous stacked modal by setting its search param
                  if (newTop.type === 'index') navigateToIndex(newTop.indexName || '', newTop.tab);
                  else if (newTop.type === 'node') navigateToNode(newTop.nodeId || '');
                  else if (newTop.type === 'shard') navigateToShard(newTop.shardId || '');
                } else {
                  // No stacked modals remain. Remove only shard param so underlying index/modal stays
                  removeModalParam('shard');
                }
              }}
              clusterId={id!}
              zIndex={1100}
            />
          );
        }

        if (modal.type === 'indexCreate') {
          return (
            <Modal.Root
              key={modal.id}
              opened={true}
              onClose={() => {
                // Pop modal from stack first
                  popModal();

                  // If the modal was opened via search param, remove that param so closing doesn't navigate the path
                  if (searchParams.get('indexCreate') != null) {
                    const params = new URLSearchParams(searchParams);
                    params.delete('indexCreate');
                    setSearchParams(params, { replace: false });
                    return;
                  }

                  // Otherwise fall back to previous behavior: go back in history or navigate to indices list
                  if (window.history.length > 1) navigate(-1);
                  else navigate(`/cluster/${id}/indices`, { replace: true });
              }}
              size="80%"
              zIndex={1100}
            >
              <Modal.Overlay />
              <Modal.Content>
                <Modal.Header>
                  <Modal.Title>Create Index</Modal.Title>
                  <Modal.CloseButton />
                </Modal.Header>
                <Modal.Body style={{ maxHeight: 'calc(100vh - 120px)', overflow: 'auto' }}>
                  <IndexCreate
                    modalMode
                    onClose={() => {
                       popModal();
                       if (window.history.length > 1) navigate(-1);
                       else navigate(`/cluster/${id}/indices`, { replace: true });
                    }}
                    onCreated={(name: string) => {
                       popModal();
                       navigate(`/cluster/${id}/indices/${name}/edit`);
                    }}
                  />
                </Modal.Body>
              </Modal.Content>
            </Modal.Root>
          );
        }

        if (modal.type === 'node' && modal.nodeId) {
          return (
            <NodeModal
              key={modal.id}
              clusterId={id!}
              nodeId={modal.nodeId}
              opened={true}
              onClose={() => {
                popModal();

                const newTop = modalStack.filter((m) => m.id !== modal.id).slice(-1)[0] ?? null;
                if (newTop) {
                  if (newTop.type === 'index') navigateToIndex(newTop.indexName || '', newTop.tab);
                  else if (newTop.type === 'node') navigateToNode(newTop.nodeId || '');
                  else if (newTop.type === 'shard') navigateToShard(newTop.shardId || '');
                } else {
                  // Remove only node modal param from URL; keep any existing index modal param
                  removeModalParam('node');
                }
              }}
              context={activeView === 'topology' ? 'topology' : activeView === 'nodes' ? 'nodes' : 'shards'}
              clusterInfo={clusterInfo}
              zIndex={1200}
            />
          );
        }

        return null;
      })}
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

export const NodesList = memo(function NodesList({
  nodes,
  loading,
  error,
  openNodeModal,
  nodesSearch,
  availableRoles,
  hideStats = false,
}: {
  nodes?: NodeInfo[];
  loading: boolean;
  error: Error | null;
  openNodeModal?: (nodeId: string) => void;
  nodesSearch: string;
  availableRoles: string[];
  hideStats?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { navigateToNode } = useClusterNavigation();

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
  const updateFilters = useCallback((newRoles?: string[], newExpanded?: boolean) => {
    const params = new URLSearchParams(searchParams);

    if (newRoles !== undefined) {
      if (newRoles.length > 0) {
        params.set('nodeRoles', newRoles.join(','));
      } else {
        // Set empty value to explicitly filter out all nodes
        // (vs deleting param which means "no filter")
        params.set('nodeRoles', '');
      }
    }

    if (newExpanded !== undefined) {
      if (newExpanded) {
        params.set('nodesExpanded', 'true');
      } else {
        params.delete('nodesExpanded');
      }
    }

    setSearchParams(params, { replace: true });
  }, [searchParams, setSearchParams]);

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
    setSearchParams(newParams, { replace: true });
  };

  // Server-side filtering is already applied - no client-side filtering needed
  // Memoize filtered nodes to prevent dependency issues in other useMemo hooks
  const filteredNodes = useMemo(() => nodes || [], [nodes]);

  // Initialize node role filters with all roles enabled by default
  // Requirements: 11.1, 11.2, 11.4
  const hasInitializedRolesRef = useRef(false);
  const nodeRolesInUrl = searchParams.get('nodeRoles');

  useEffect(() => {
    // Reset initialization when URL has no role params (user navigated to clean URL)
    if (nodeRolesInUrl === null) {
      hasInitializedRolesRef.current = false;
    }

    // Only initialize once if no roles are selected and we have roles available
    if (!hasInitializedRolesRef.current && selectedRoles.length === 0 && availableRoles.length > 0) {
      hasInitializedRolesRef.current = true;
      // Initialize with all roles enabled
      updateFilters(availableRoles, undefined);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableRoles.length, nodeRolesInUrl]); // Re-run when available roles or URL changes

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

  // While the query is loading, render table skeleton rows but keep headers and
  // surrounding controls visible. Do not show "No data" until loading finishes.
  if (loading) {
    return (
      <Stack gap="md">
        {!hideStats && <NodeStatsCards nodes={[]} />}

        <Card shadow="sm" padding="lg">
          <ScrollArea w="100%">
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
              <TableSkeleton columnCount={expandedView ? 12 : 9} rowCount={6} />
            </Table>
          </ScrollArea>
        </Card>
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
  const hasActiveFilters = searchQuery || selectedRoles.length < availableRoles.length;

  if ((!nodes || nodes.length === 0) && !hasActiveFilters) {
    return <Text c="dimmed">No nodes found</Text>;
  }

  return (
    <Stack gap="md">
      {!hideStats && <NodeStatsCards nodes={sortedNodes || []} />}

      <Card shadow="sm" padding="lg">
        {sortedNodes && sortedNodes.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No nodes match your filters
          </Text>
        ) : (
          <ScrollArea w="100%">
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
                            className="clickable-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (openNodeModal) {
                                openNodeModal(node.id);
                              } else {
                                // Use cluster navigation modal flow when available (search-param driven)
                                if (navigateToNode) {
                                  navigateToNode(node.id);
                                  } else {
                                   navigate(`/cluster/${id}/nodes/${node.id}`);
                                  }
                              }
                            }}
                            style={{ textTransform: 'none' }}
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
                    {node.loadAverage !== undefined && node.loadAverage.length > 0 ? (
                      <Text
                        size="sm"
                        c={getLoadColor(node.loadAverage[1])}
                        style={{ fontFamily: 'monospace' }}
                      >
                        {formatLoadAverage(node.loadAverage[1])}
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

// Helper: render shard counts as pill badges in a single column
function ShardStatsPills({ total, primaries, replicas }: { total: number; primaries: number; replicas: number }) {
  const primaryLabel = primaries === 1 ? 'primary' : 'primaries';
  const replicaLabel = replicas === 1 ? 'replica' : 'replicas';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Group
        gap="xs"
        align="center"
        justify="flex-start"
        wrap="nowrap"
        style={{ flexShrink: 0 }}
      >
        <Badge size="sm" variant="light" color="violet" style={{ textTransform: 'none' }}>
          {total} shards
        </Badge>
        <Badge size="sm" variant="light" color="blue" style={{ textTransform: 'none' }}>
          {primaries} {primaryLabel}
        </Badge>
        <Badge size="sm" variant="light" color="gray" style={{ textTransform: 'none' }}>
          {replicas} {replicaLabel}
        </Badge>
      </Group>
    </div>
  );
}

export const IndicesList = memo(function IndicesList({
  indices,
  indicesPaginated,
  loading,
  error,
  openIndexModal,
  unassignedByIndexProp,
}: {
  indices?: IndexInfo[];
  indicesPaginated?: PaginatedResponse<IndexInfo>;
  loading: boolean;
  error: Error | null;
  openIndexModal: (indexName: string, tab?: string) => void;
  // Optional per-page map of unassigned shards provided by parent (IndicesView)
  unassignedByIndexProp?: Record<string, ShardInfo[]>;
}) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

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
    setSearchParams(params, { replace: true });
  };

  const handleIndicesPageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('indicesPageSize', size.toString());
    params.set('indicesPage', '1'); // Reset to first page when changing page size
    setSearchParams(params, { replace: true });
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
    queryKey: queryKeys.cluster(id!).shards(),
    queryFn: () => apiClient.getShards(id!),
    enabled: !!id,
  });

  // Extract shards array from paginated response (for use in IndicesList)
  const shards: ShardInfo[] = shardsPaginatedForIndices?.items ?? [];

  // Additionally fetch cluster-level UNASSIGNED shards (full collector) so the
  // indices table can show accurate unassigned counts even when the default
  // paginated shards request doesn't include UNASSIGNED items on the current page.
  const { data: unassignedClusterShards = [] } = useQuery<ShardInfo[]>({
    queryKey: queryKeys.cluster(id!).shards(undefined, { state: 'UNASSIGNED' }),
    queryFn: async () => {
      if (!id) return [];
      const pageSize = 2000;
      let page = 1;
      const collected: ShardInfo[] = [];

      while (true) {
        const resp = await apiClient.getShards(id!, page, pageSize, { state: 'UNASSIGNED' });
        const paginated = resp as PaginatedResponse<ShardInfo> | Record<string, unknown>;
        const items: ShardInfo[] = (paginated && (paginated as PaginatedResponse<ShardInfo>).items) ?? [];
        if (items.length > 0) collected.push(...items);
        if (!items || items.length < pageSize) break;
        page += 1;
      }

      return collected;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    placeholderData: () => [],
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
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

  const openIndexMutation = useMutationWithNotification<
    { indexName: string },
    unknown,
    { indexName: string }
  >({
    mutationFn: async ({ indexName }) => {
      await apiClient.openIndex(id!, indexName);
      return { indexName };
    },
    successTitle: 'Success',
    successMessage: (data) => `Index ${data.indexName} opened successfully`,
    errorTitle: 'Index operation failed',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
    },
  });

  const refreshIndexMutation = useMutationWithNotification<
    { indexName: string },
    unknown,
    { indexName: string }
  >({
    mutationFn: async ({ indexName }) => {
      await apiClient.refreshIndex(id!, indexName);
      return { indexName };
    },
    successTitle: 'Success',
    successMessage: (data) => `Index ${data.indexName} refreshed successfully`,
    errorTitle: 'Index operation failed',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
    },
  });

  const closeOrDeleteIndexMutation = useMutationWithNotification<
    { indexName: string; type: 'close' | 'delete' },
    unknown,
    { indexName: string; type: 'close' | 'delete' }
  >({
    mutationFn: async ({ indexName, type }) => {
      const action =
        type === 'close'
          ? apiClient.closeIndex(id!, indexName)
          : apiClient.deleteIndex(id!, indexName);

      await action;
      return { indexName, type };
    },
    successTitle: 'Success',
    successMessage: (data) =>
      `Index ${data.indexName} ${data.type === 'close' ? 'closed' : 'deleted'} successfully`,
    errorTitle: 'Index operation failed',
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cluster(id!).indices() });
      setConfirmationModalOpened(false);
      setConfirmationAction(null);
    },
  });

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
    setSearchParams(newParams, { replace: true });
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

  // If parent provided a per-page unassigned map, merge those entries into
  // shardsByIndex so that "hasProblems" detection and other UI logic see
  // UNASSIGNED shards even when the default paginated shards response
  // doesn't include them.
  if (unassignedByIndexProp && Object.keys(unassignedByIndexProp).length > 0) {
    for (const [idx, unassignedList] of Object.entries(unassignedByIndexProp)) {
      if (!shardsByIndex[idx]) shardsByIndex[idx] = [];
      const existingKeys = new Set(shardsByIndex[idx].map(s => `${s.shard}:${String(s.primary)}:${s.node ?? ''}`));
      for (const s of unassignedList) {
        const key = `${s.shard}:${String(s.primary)}:${s.node ?? ''}`;
        if (!existingKeys.has(key)) {
          shardsByIndex[idx].push(s);
          existingKeys.add(key);
        }
      }
    }
  }

  // Identify unassigned shards. Prefer parent-provided per-page map when
  // available (unassignedByIndexProp). Otherwise fall back to the
  // cluster-level UNASSIGNED collector (unassignedClusterShards) or the
  // paginated shards response as a last resort.
  const unassignedByIndex = unassignedByIndexProp && Object.keys(unassignedByIndexProp).length > 0
    ? unassignedByIndexProp
    : (unassignedClusterShards && unassignedClusterShards.length > 0
      ? unassignedClusterShards.reduce(
          (acc: Record<string, ShardInfo[]>, shard: ShardInfo) => {
            if (!acc[shard.index]) acc[shard.index] = [];
            acc[shard.index].push(shard);
            return acc;
          },
          {} as Record<string, ShardInfo[]>
        )
      : shards && shards.length > 0
      ? shards.filter((s: ShardInfo) => s.state === 'UNASSIGNED').reduce(
          (acc: Record<string, ShardInfo[]>, shard: ShardInfo) => {
            if (!acc[shard.index]) acc[shard.index] = [];
            acc[shard.index].push(shard);
            return acc;
          },
          {} as Record<string, ShardInfo[]>
        )
      : {} as Record<string, ShardInfo[]>
    );

  // Check if an index has problems
  const hasProblems = (indexName: string) => {
    const indexShards = shardsByIndex[indexName] || [];
    return indexShards.some(
      (s: ShardInfo) =>
        s.state === 'UNASSIGNED' || s.state === 'RELOCATING' || s.state === 'INITIALIZING'
    );
  };

  // Sort indices by selected column (client-side sorting only)
  const sortedIndices = [...(indices || [])].sort((a, b) => {
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

  // When loading, keep the table header and controls visible but render
  // skeleton rows in the tbody. This prevents flashing "No data" when
  // callers pass an empty array while the query is still in-flight.
  if (loading && !indices) {
    return (
      <Stack gap="md">
        {count > 0 && (
          <Group justify="space-between" p="md" style={{ backgroundColor: 'var(--mantine-color-blue-light)', borderRadius: '0.5rem' }}>
            <Text size="sm" fw={500}>
              {count} index{count !== 1 ? 's' : ''} selected
            </Text>
            <BulkOperationsMenu
              selectedIndices={selectedIndices}
              indices={indices || []}
              onOperationSelect={handleBulkOperationSelect}
            />
          </Group>
        )}

        <Card shadow="sm" padding="lg">
          <ScrollArea w="100%">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>
                    <Checkbox aria-label="Select all indices" />
                  </Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Health</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Documents</Table.Th>
                  <Table.Th>Size</Table.Th>
                  <Table.Th>Shards</Table.Th>
                  <Table.Th>Unassigned</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <TableSkeleton columnCount={9} rowCount={6} />
            </Table>
          </ScrollArea>
        </Card>
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

  // Render table normally; show empty table + message when no indices.
  return (
    <Stack gap="md">
      {/* Bulk operations bar - shown when indices are selected */}
      {count > 0 && (
        <Group justify="space-between" p="md" style={{ backgroundColor: 'var(--mantine-color-blue-light)', borderRadius: '0.5rem' }}>
          <Text size="sm" fw={500}>
            {count} index{count !== 1 ? 's' : ''} selected
          </Text>
          <BulkOperationsMenu
            selectedIndices={selectedIndices}
            indices={indices || []}
            onOperationSelect={handleBulkOperationSelect}
          />
        </Group>
      )}

      {/* Always show table with filters - even if no indices match */}
        <Card shadow="sm" padding="lg">
          <ScrollArea w="100%">
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
                  <Table.Th>Unassigned</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>

              {/* If loading, show table skeleton rows. Otherwise render rows. */}
              {loading ? (
                <TableSkeleton columnCount={9} rowCount={6} />
              ) : (
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
                            className="clickable-name"
                            onClick={(e) => {
                              e.stopPropagation();
                              openIndexModal(index.name);
                            }}
                            style={{ textTransform: 'none' }}
                          >
                            {index.name}
                          </Text>
                          {hasProblems(index.name) && (
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
                      <Text size="sm">{index.docsCount.toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatBytes(index.storeSize)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <ShardStatsPills
                        total={index.primaryShards + index.replicaShards}
                        primaries={index.primaryShards}
                        replicas={index.replicaShards}
                      />
                    </Table.Td>
                    <Table.Td>
                      {unassignedCount > 0 ? (
                        <Tooltip
                          label={
                            <Stack gap={4}>
                              <Text size="xs" fw={600}>
                                Unassigned Shards:
                              </Text>
                              {unassignedByIndex[index.name]?.map(
                                (shard: ShardInfo) => (
                                  <Group key={`${shard.index}-${shard.shard}-${String(shard.primary)}`} gap={4}>
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
                        <Badge size="sm" variant="light" color="green" style={{ textTransform: 'none' }}>
                          0
                        </Badge>
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
                                openIndexMutation.mutate({ indexName: index.name });
                              }}
                              disabled={openIndexMutation.isPending}
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
                              refreshIndexMutation.mutate({ indexName: index.name });
                            }}
                            disabled={refreshIndexMutation.isPending}
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
          )}
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

                closeOrDeleteIndexMutation.mutate({
                  indexName: confirmationAction.indexName,
                  type: confirmationAction.type,
                });
              }}
              disabled={closeOrDeleteIndexMutation.isPending}
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
  zIndex,
}: {
  shard: ShardInfo | null;
  opened: boolean;
  onClose: () => void;
  clusterId: string;
  zIndex?: number;
}) {
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
    <Modal.Root opened={opened} onClose={onClose} size="90%" zIndex={zIndex}>
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
              <Badge size="lg" variant="light" color="blue" style={{ textTransform: 'none' }}>
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

// (Legacy local ShardAllocationGrid implementation was replaced by
// frontend/src/components/Topology/ShardAllocationGrid.tsx and removed from here.)

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

export const ShardsList = memo(function ShardsList({
  shards,
  loading,
  error,
  openNodeModal,
  hideStats = false,
}: {
  shards?: ShardInfo[];
  loading: boolean;
  error: Error | null;
  openNodeModal?: (nodeId: string) => void;
  hideStats?: boolean;
}) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);
  const { navigateToNode, navigateToIndex } = useClusterNavigation();

  // Fetch all nodes to map node id -> node name for display
  const { data: allNodesUnfiltered } = useClusterNodes(id, {
    page: 1,
    pageSize: 1000,
    filters: { search: '' },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  const nodeNameMap = useMemo(() => {
    const map = new Map<string, string>();
    const items = allNodesUnfiltered?.items ?? [];
    for (const n of items) {
      if (n.id) map.set(n.id, n.name || n.id);
      if (n.name) map.set(n.name, n.name);
    }
    return map;
  }, [allNodesUnfiltered]);

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
  const showSpecialIndices = searchParams.get('showSpecial') !== 'false'; // Default to true (show all); server-side filtering handles hide_special=false

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
    setSearchParams(params, { replace: true });
  };

  const handleShardsPageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('shardsPageSize', size.toString());
    params.set('shardsPage', '1'); // Reset to first page when changing page size
    setSearchParams(params, { replace: true });
  };

  // Handle shard click to open details modal
  const handleShardClick = (shard: ShardInfo) => {
    setSelectedShard(shard);
    setDetailsModalOpen(true);
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
    setSearchParams(newParams, { replace: true });
  };

  // All filtering is server-side; no client-side filtering needed
  // Sort shards by selected column (client-side sorting only)
  const sortedShards = useMemo(() => {
    const filtered = shards ?? [];
    const sorted = [...filtered];
    
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
  }, [shards, shardsSortColumn, shardsSortDirection]);

  if (loading && !shards) {
    return (
      <Stack gap="md">
        {!hideStats && (
          <ShardStatsCards
            stats={{
              totalShards: 0,
              primaryShards: 0,
              replicaShards: 0,
              unassignedShards: 0,
              relocatingShards: 0,
              initializingShards: 0,
            }}
          />
        )}

        <Card shadow="sm" padding="lg">
          <ScrollArea w="100%">
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Index</Table.Th>
                  <Table.Th>Shard</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>State</Table.Th>
                  <Table.Th>Node</Table.Th>
                  <Table.Th>Documents</Table.Th>
                  <Table.Th>Size</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <TableSkeleton columnCount={7} rowCount={8} />
            </Table>
          </ScrollArea>
        </Card>
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
      {!hideStats && (
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
      )}

      <Card shadow="sm" padding="lg">
        {sortedShards && sortedShards.length === 0 ? (
          <Text c="dimmed" ta="center" py="xl">
            No shards match your filters
          </Text>
        ) : (
          <ScrollArea w="100%">
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
                // local flag intentionally unused in UI; keep mapping here for clarity
                void (shard.state === 'UNASSIGNED');

                return (
                  <Table.Tr key={`${shard.index}-${shard.shard}-${idx}`} className="clickable-row">
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Stack style={{ flex: 1 }}>
                            <Text
                              size="sm"
                              fw={500}
                              className="clickable-name"
                              style={{ textTransform: 'none' }}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (navigateToIndex) navigateToIndex(shard.index);
                            }}
                            >
                              {shard.index}
                            </Text>
                        </Stack>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text
                        size="sm"
                        fw={500}
                        className="clickable-name"
                        style={{ textTransform: 'none' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleShardClick(shard);
                        }}
                      >
                        {shard.shard}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <ShardTypeBadge primary={shard.primary} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Badge size="sm" color={getShardStateColor(shard.state)}>
                          {shard.state}
                        </Badge>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      {shard.node ? (
                        <Anchor
                          component="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (openNodeModal) {
                              openNodeModal(shard.node!);
                            } else if (navigateToNode) {
                              navigateToNode(shard.node!);
                            }
                          }}
                          style={{ textDecoration: 'none', cursor: 'pointer', color: 'inherit' }}
                        >
                          <Text size="sm" fw={500} className="clickable-name" style={{ textTransform: 'none' }}>
                            <span style={{ textTransform: 'none' }}>{nodeNameMap.get(shard.node) ?? shard.node}</span>
                          </Text>
                        </Anchor>
                      ) : (
                        <Text size="sm">N/A</Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{shard.docs.toLocaleString()}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{formatBytes(shard.store)}</Text>
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
