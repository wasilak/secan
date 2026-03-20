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
  Select,
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
import { showSuccessNotification, showErrorNotification, showSpecialNotification } from '../utils/notifications';
import { apiClient } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';
import { useResponsivePageSize } from '../hooks/useResponsivePageSize';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useWatermarks } from '../hooks/useWatermarks';
import { useSparklineData, DataPoint } from '../hooks/useSparklineData';
import { useMetricsStore } from '../stores/metricsStore';
import { useFaviconManager } from '../hooks/useFaviconManager';
import { useClusterName } from '../hooks/useClusterName';
import { usePerNodeShards } from '../hooks/usePerNodeShards';
import { useConsolePanel } from '../contexts/ConsolePanelContext';
import { IconTerminal2 } from '@tabler/icons-react';
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
import { useModalStack } from '../hooks/useModalStack';
import { ClusterChangeNotifier } from '../components/ClusterChangeNotifier';
import { AllocationLockIndicator, AllocationState } from '../components/Topology/AllocationLockIndicator';
import type { NodeInfo, IndexInfo, ShardInfo, NodeRole, ClusterInfo, PaginatedResponse } from '../types/api';
import type { BulkOperationType } from '../types/api';
import { formatLoadAverage, getLoadColor, formatUptimeDetailed, formatBytes, formatPercentRatio } from '../utils/formatters';
import { getHealthColor, getShardStateColor, getShardTypeColor, SHARD_STATE_COLORS, SHARD_TYPE_COLORS } from '../utils/colors';
import { useState, useEffect, useCallback, useMemo, memo, useRef } from 'react';
import { FilterSidebar } from '../components/FacetedFilter';
import { TopologyStatsCards } from '../components/TopologyStatsCards';
import type { GroupingAttribute, GroupingConfig } from '../utils/topologyGrouping';
import { hasCustomLabels, extractLabelFromTag } from '../utils/topologyGrouping';

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
        setSearchParams(newParams, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localIndicesSearch, searchParams, setSearchParams]);

  const setIndicesSearch = (value: string) => {
    setLocalIndicesSearch(value);
  };

  // Indices filter state (read from URL)
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
  const showSpecialIndices = searchParams.get('showSpecial') === 'true';

  // Update URL when indices filters change
  const updateIndicesFilters = (newHealth?: string[], newStatus?: string[]) => {
    const params = new URLSearchParams(searchParams);

    if (newHealth !== undefined) {
      if (newHealth.length === 4) {
        params.delete('health');
      } else if (newHealth.length > 0) {
        params.set('health', newHealth.join(','));
      } else {
        params.delete('health');
      }
    }

    if (newStatus !== undefined) {
      if (newStatus.length === 2) {
        params.delete('status');
      } else if (newStatus.length > 0) {
        params.set('status', newStatus.join(','));
      } else {
        params.delete('status');
      }
    }

    setSearchParams(params, { replace: true });
  };

  const updateIndicesParam = (key: string, value: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, 'true');
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams, { replace: true });
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
        setSearchParams(newParams, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localNodesSearch, searchParams, setSearchParams]);

  const setNodesSearch = (value: string) => {
    setLocalNodesSearch(value);
  };

  // Shards filter state (read from URL)
  const shardsSearch = searchParams.get('shardsSearch') || '';
  const [localShardsSearch, setLocalShardsSearch] = useState(shardsSearch);

  // Sync local input with URL when it changes externally
  useEffect(() => {
    setLocalShardsSearch(searchParams.get('shardsSearch') || '');
  }, [searchParams]);

  // Debounce: update URL after 300ms of no typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (localShardsSearch !== searchParams.get('shardsSearch')) {
        const newParams = new URLSearchParams(searchParams);
        if (localShardsSearch) {
          newParams.set('shardsSearch', localShardsSearch);
        } else {
          newParams.delete('shardsSearch');
        }
        setSearchParams(newParams, { replace: true });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [localShardsSearch, searchParams, setSearchParams]);

  const setShardsSearch = (value: string) => {
    setLocalShardsSearch(value);
  };

  const selectedShardStates = searchParams.get('shardStates')?.split(',').filter(Boolean) || [
    'STARTED',
    'INITIALIZING',
    'RELOCATING',
    'UNASSIGNED',
  ];
  const showShardPrimaries = searchParams.get('showPrimaries') !== 'false';
  const showShardReplicas = searchParams.get('showReplicas') !== 'false';
  const showShardSpecial = searchParams.get('showSpecial') !== 'false';

  const updateShardsFilters = (newStates?: string[], newShowPrimaries?: boolean, newShowReplicas?: boolean) => {
    const params = new URLSearchParams(searchParams);

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

    setSearchParams(params, { replace: true });
  };

  const updateShardsParam = (key: string, value: boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value) {
      newParams.set(key, 'true');
    } else {
      newParams.delete(key);
    }
    setSearchParams(newParams, { replace: true });
  };

  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);

  // Get navigation helper
  const { navigateToNode, navigateToIndex, closeModal, currentSection: getCurrentSection } = useClusterNavigation();

  // Get active section from path parameter, default to 'overview'
  // This supports both /cluster/:id and /cluster/:id/:section URL formats
  // Also checks for bg query param for modal background section
  const activeSection = getCurrentSection() || defaultSection;
  const activeView = activeSection;

  // Topology view type from URL path (for direct linking)
  const topologyViewFromPath = location.pathname.includes('/topology/node') ? 'node' :
                               location.pathname.includes('/topology/index') ? 'index' : null;
  const topologyViewType = topologyViewFromPath || (searchParams.get('topologyView') as 'node' | 'index') || 'node';
  const setTopologyViewType = (value: 'node' | 'index') => {
    // Navigate to path-based URL for direct linking
    navigate(`/cluster/${id}/topology/${value}`, { replace: true });
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

  // Shared shard allocation state
  const { data: clusterSettings } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: () => apiClient.proxyRequest(id!, 'GET', '/_cluster/settings'),
    enabled: !!id && (activeView === 'overview' || activeView === 'topology'),
    refetchInterval: refreshInterval,
    staleTime: 0,
    refetchOnWindowFocus: false,
    refetchOnMount: true,
    placeholderData: (previousData) => previousData,
  });

  const shardAllocationEnabled = (() => {
    if (!clusterSettings) return true;
    
    // The proxy response wraps the actual settings in a 'data' property
    const wrapper = clusterSettings as Record<string, unknown>;
    const data = wrapper.data as Record<string, unknown> | undefined;
    
    if (!data) return true;
    
    const transient = data.transient as Record<string, unknown> | undefined;
    const persistent = data.persistent as Record<string, unknown> | undefined;
    
    // Navigate through nested structure: cluster.routing.allocation.enable
    const transientCluster = transient?.cluster as Record<string, unknown> | undefined;
    const persistentCluster = persistent?.cluster as Record<string, unknown> | undefined;
    const transientRouting = transientCluster?.routing as Record<string, unknown> | undefined;
    const persistentRouting = persistentCluster?.routing as Record<string, unknown> | undefined;
    const transientAllocation = transientRouting?.allocation as Record<string, unknown> | undefined;
    const persistentAllocation = persistentRouting?.allocation as Record<string, unknown> | undefined;
    
    // Get enable value (transient takes precedence over persistent)
    const enableValue = (transientAllocation?.enable as string) || (persistentAllocation?.enable as string) || 'all';
    return enableValue === 'all';
  })();

  // Extract allocation state for AllocationLockIndicator
  // Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6
  const allocationState: AllocationState = (() => {
    if (!clusterSettings) {
      return 'all';
    }
    
    // The proxy response wraps the actual settings in a 'data' property
    const wrapper = clusterSettings as Record<string, unknown>;
    const data = wrapper.data as Record<string, unknown> | undefined;
    
    if (!data) {
      return 'all';
    }
    
    const transient = data.transient as Record<string, unknown> | undefined;
    const persistent = data.persistent as Record<string, unknown> | undefined;
    
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

  // Modal stack for layered modals
  const { modalStack, topModal, pushModal, popModal, clearModals, hasModalAbove } = useModalStack();

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

  // Handle closing index modal - pop from stack or navigate back to section
  const closeIndexModal = () => {
    if (modalStack.length > 0) {
      popModal();
    } else {
      closeModal();
    }
  };

  // Shared topology handlers
  const handleTopologyShardClick = (shard: ShardInfo, event: React.MouseEvent) => {
    event.stopPropagation();
    setTopologyContextMenuShard(shard);
    setTopologyContextMenuPosition({ x: event.clientX, y: event.clientY });
    setTopologyContextMenuOpened(true);
  };

  // Handler for shard clicks in index modal - opens shard modal on top
  const handleShardClickInIndexModal = useCallback(
    (shard: ShardInfo) => {
      if (shard.node) {
        pushModal({ type: 'shard', indexName: shard.index, shardId: `${shard.index}[${shard.shard}]` });
      }
    },
    [pushModal]
  );

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
    enabled: !!id && activeView === 'statistics',
    staleTime: 60000,
    placeholderData: (previousData) => previousData,
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
      refetchStats();
    }
  }, [activeView, id, refetchStats]);

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
  ) as DataPoint[];
  
  const indicesHistoryInternal = useSparklineData(
    currentInternalMetrics?.indices,
    50,
    activeView,
    true
  ) as DataPoint[];
  const documentsHistoryInternal = useSparklineData(
    currentInternalMetrics?.documents,
    50,
    activeView,
    true
  ) as DataPoint[];
  const shardsHistoryInternal = useSparklineData(
    currentInternalMetrics?.shards,
    50,
    activeView,
    true
  ) as DataPoint[];
  const unassignedHistoryInternal = useSparklineData(
    currentInternalMetrics?.unassigned,
    50,
    activeView,
    true
  ) as DataPoint[];
  const cpuHistoryInternal = useSparklineData(
    currentInternalMetrics?.cpu,
    50,
    activeView,
    true
  ) as DataPoint[];
  const memoryHistoryInternal = useSparklineData(
    currentInternalMetrics?.memory,
    50,
    activeView,
    true
  ) as DataPoint[];
  const diskHistoryInternal = useSparklineData(
    currentInternalMetrics?.disk,
    50,
    activeView,
    true
  ) as DataPoint[];

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
  }, [activeView, isInternalMetrics, metricsHistory?.raw_metrics?.cpu]);

  const memoryNonHeapHistory: DataPoint[] =
    activeView === 'statistics' && metricsHistory?.data
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
  const [nodesPerPage, setNodesPerPage] = useState(50);
  const [indicesPage, setIndicesPage] = useState(1);
  const [shardsPage, setShardsPage] = useState(1);

  // Handle nodes page size change
  const handleNodesPageSizeChange = (size: number) => {
    setNodesPerPage(size);
    setNodesPage(1); // Reset to first page when changing page size
  };

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
    queryKey: ['cluster', id, 'nodes', nodesPage, nodesPerPage, nodesFilters],
    queryFn: () => apiClient.getNodes(id!, nodesPage, nodesPerPage, nodesFilters),
    refetchInterval: refreshInterval,
    enabled: !!id && activeView === 'nodes',
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Extract nodes array from paginated response (default to empty array while loading)
  const nodesArray: NodeInfo[] = nodesPaginated?.items ?? [];

  // Fetch ALL nodes (unfiltered) to get available roles for the filter UI
  // This ensures filters are always visible even when current filters exclude all nodes
  const {
    data: allNodesUnfiltered,
  } = useQuery({
    queryKey: ['cluster', id, 'nodes', 'all-roles'],
    queryFn: () => apiClient.getNodes(id!, 1, 1000, { search: '' }),
    refetchInterval: refreshInterval,
    enabled: !!id && (activeView === 'topology' || activeView === 'nodes' || activeView === 'statistics'),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Get all available roles from unfiltered nodes - used for filter UI
  const availableRoles = useMemo(() => {
    const roles = allNodesUnfiltered?.items?.flatMap((n) => n.roles) || [];
    return Array.from(new Set(roles));
  }, [allNodesUnfiltered]);

  // Node roles filter state (read from URL)
  const nodeRolesParam = searchParams.get('nodeRoles') || '';
  const selectedNodeRoles = nodeRolesParam.split(',').filter(Boolean);

  const updateNodeRoles = (newRoles: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (newRoles.length > 0) {
      params.set('nodeRoles', newRoles.join(','));
    } else {
      params.set('nodeRoles', '');
    }
    setSearchParams(params, { replace: true });
  };

  // Use unfiltered nodes for topology view so it always shows all nodes
  // regardless of node role filters applied to the nodes list
  const allNodesArray = useMemo(() => allNodesUnfiltered?.items ?? [], [allNodesUnfiltered]);

  // Topology grouping derived values (must be after allNodesArray definition)
  const availableLabelsForTopology = useMemo(() => {
    if (!hasCustomLabels(allNodesArray)) return [];
    const labelMap = new Map<string, string>();
    allNodesArray.forEach((node) => {
      if (node.tags && node.tags.length > 0) {
        node.tags.forEach((tag) => {
          const { name } = extractLabelFromTag(tag);
          if (!labelMap.has(name)) {
            labelMap.set(name, tag);
          }
        });
      }
    });
    return Array.from(labelMap.entries())
      .map(([name, tag]) => ({ name, tag }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allNodesArray]);

  const groupingOptions = [
    { value: 'none', label: 'None' },
    { value: 'role', label: 'By Role' },
    { value: 'type', label: 'By Type' },
    ...availableLabelsForTopology.map(({ name, tag }) => ({
      value: `label:${tag}`,
      label: name,
    })),
  ];

  const handleTopologyGroupingChange = useCallback((attribute: GroupingAttribute, value?: string) => {
    setTopologyGroupingConfig({ attribute, value });
  }, []);

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
    enabled: !!id && activeView === 'indices', // Only fetch when in indices tab
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Fetch ALL indices for topology view (unfiltered, unpaginated)
  const {
    data: allIndicesPaginated,
    isLoading: allIndicesLoading,
    error: allIndicesError,
  } = useQuery({
    queryKey: ['cluster', id, 'indices', 'all'],
    queryFn: () => apiClient.getIndices(id!, 1, 10000, { showSpecial: true }),
    refetchInterval: refreshInterval,
    enabled: !!id && (activeView === 'topology' || activeView === 'indices' || activeView === 'statistics'),
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  // Extract indices array from paginated response (default to empty array while loading)
  const indicesArray: IndexInfo[] = indicesPaginated?.items ?? [];

  // Use all indices for topology
  const allIndicesArray: IndexInfo[] = allIndicesPaginated?.items ?? [];
  
  // Calculate hidden indices count from ALL indices (for statistics tab)
  const hiddenIndicesCount = allIndicesArray.filter((idx) => idx.name.startsWith('.')).length;

  // Fetch shards with auto-refresh, pagination, and server-side filtering
  const shardsFilters = useMemo(() => ({
    hide_special: searchParams.get('showSpecial') !== 'true', // default: hide special indices
    show_primaries: searchParams.get('showPrimaries') !== 'false', // default: true
    show_replicas: searchParams.get('showReplicas') !== 'false', // default: true
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
    enabled: !!id && activeView === 'shards', // Only fetch when in shards tab
    placeholderData: (previousData) => previousData, // Keep previous data while fetching
  });

  // Progressive shard loading per node for topology view (prevents OOM)
  const nodeIdsForShards = useMemo(() => allNodesArray.map(n => n.id), [allNodesArray]);
  const {
    allShards,
    isLoading: allShardsLoading,
    isComplete: allShardsComplete,
    firstError: allShardsError,
  } = usePerNodeShards(id, nodeIdsForShards, !!id && activeView === 'topology', 4);

  // Extract shards array from paginated response (default to empty array while loading)
  const shards: ShardInfo[] = shardsPaginated?.items ?? [];

  // Create shorter aliases for backward compatibility with rest of code
  const nodes = nodesArray;
  const indices = indicesArray;

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
                enableAllocationMutation={enableAllocationMutation}
                disableAllocationMutation={disableAllocationMutation}
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
      {activeView === 'topology' && (
        <Grid gutter="md">
          {/* Stats Row */}
          <Grid.Col span={12}>
            <TopologyStatsCards
              filteredNodes={allNodesArray}
              filteredIndices={allIndicesArray || []}
              filteredShards={allShards || []}
            />
          </Grid.Col>

          <Grid.Col span={12}>
            <Group gap="md" wrap="nowrap" align="flex-start">
              {/* Filter Sidebar */}
              <FilterSidebar
                textFilters={[
                  { value: indexNameFilter, onChange: setIndexNameFilter, placeholder: 'Filter indices...' },
                  { value: nodeNameFilter, onChange: setNodeNameFilter, placeholder: 'Filter nodes...' },
                ]}
                categories={[
                  {
                    title: 'State',
                    options: [
                      { label: 'Started', value: 'STARTED', color: SHARD_STATE_COLORS.STARTED },
                      { label: 'Unassigned', value: 'UNASSIGNED', color: SHARD_STATE_COLORS.UNASSIGNED },
                      { label: 'Initializing', value: 'INITIALIZING', color: SHARD_STATE_COLORS.INITIALIZING },
                      { label: 'Relocating', value: 'RELOCATING', color: SHARD_STATE_COLORS.RELOCATING },
                    ],
                    selected: selectedShardStates,
                    onChange: (newStates) => {
                      const params = new URLSearchParams(searchParams);
                      if (newStates.length === 4) {
                        params.delete('shardStates');
                      } else if (newStates.length > 0) {
                        params.set('shardStates', newStates.join(','));
                      }
                      setSearchParams(params, { replace: true });
                    },
                  },
                ]}
                conditionalSections={[
                  {
                    visible: topologyViewType === 'node',
                    content: (
                      <Select
                        label="Group By"
                        data={groupingOptions}
                        value={topologyGroupingConfig.attribute}
                        onChange={(value) => {
                          if (value) {
                            const tagValue = value.startsWith('label:') ? value.substring(6) : undefined;
                            handleTopologyGroupingChange(value as GroupingAttribute, tagValue);
                          }
                        }}
                        size="xs"
                      />
                    ),
                  },
                ]}
                toggles={[
                  {
                    label: 'Show special indices',
                    value: searchParams.get('showSpecial') !== 'false',
                    onChange: (val) => {
                      const params = new URLSearchParams(searchParams);
                      if (val) {
                        params.delete('showSpecial');
                      } else {
                        params.set('showSpecial', 'false');
                      }
                      setSearchParams(params, { replace: true });
                    },
                    icon: <IconEyeOff size={16} />,
                  },
                ]}
              />

              {/* View Content */}
              <Stack gap="md" style={{ flex: 1 }}>
                {/* Tabs */}
                <Group justify="flex-end">
                  <Tabs
                    value={topologyViewType}
                    onChange={(value) => setTopologyViewType(value as 'node' | 'index')}
                  >
                    <Tabs.List>
                      <Tabs.Tab value="node">Node View</Tabs.Tab>
                      <Tabs.Tab value="index">Index View</Tabs.Tab>
                    </Tabs.List>
                  </Tabs>
                </Group>

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

                {/* View */}
                {topologyViewType === 'node' ? (
                  <DotBasedTopologyView
                    nodes={allNodesArray}
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
                    isLoading={nodesLoading || allIndicesLoading || allShardsLoading}
                    groupingConfig={topologyGroupingConfig}
                  />
                ) : (
                  <ShardAllocationGrid
                    nodes={allNodesArray}
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
              </Stack>
            </Group>
          </Grid.Col>

          {/* Shared Context Menu */}
          {topologyContextMenuShard && (
            <ShardContextMenu
              shard={topologyContextMenuShard}
              opened={topologyContextMenuOpened}
              position={topologyContextMenuPosition}
              onClose={handleTopologyContextMenuClose}
              onShowStats={(shard) => {
                pushModal({ type: 'shard', indexName: shard.index, shardId: `${shard.index}[${shard.shard}]` });
                handleTopologyContextMenuClose();
              }}
              onSelectForRelocation={handleTopologySelectForRelocation}
              onShowIndexDetails={(shard) => {
                openIndexModal(shard.index);
                handleTopologyContextMenuClose();
              }}
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
                    <Badge size="sm" color={getShardTypeColor(relocationShard?.primary ?? false)}>
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
        </Grid>
      )}

      {/* Statistics Section */}
      {activeView === 'statistics' && (
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
                        setSearchParams(newParams, { replace: true });
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
            nodes={allNodesArray}
            prometheusQueries={prometheusQueries}
            showHiddenIndices={showHiddenIndices}
            onToggleHiddenIndices={setShowHiddenIndices}
            hiddenIndicesCount={hiddenIndicesCount}
            allIndices={allIndicesArray}
          />
        </Stack>
      )}

      {/* Nodes Section */}
      {activeView === 'nodes' && (
        <Grid gutter="md">
          <Grid.Col span={12}>
            <NodeStatsCards nodes={nodes || []} />
          </Grid.Col>
          <Grid.Col span={12}>
            <Group gap="md" wrap="nowrap" align="flex-start">
              <FilterSidebar
                textFilters={[{
                  value: localNodesSearch,
                  onChange: setNodesSearch,
                  placeholder: 'Filter nodes...',
                }]}
                categories={[
                  {
                    title: 'Roles',
                    options: availableRoles.map((role) => {
                      const roleInfo = getRoleIcon(role);
                      const Icon = roleInfo.icon;
                      return {
                        label: roleInfo.label,
                        value: role,
                        icon: <Icon size={14} color={`var(--mantine-color-${roleInfo.color}-6)`} />,
                      };
                    }),
                    selected: selectedNodeRoles,
                    onChange: updateNodeRoles,
                  },
                ]}
              />
              <Stack gap="md" style={{ flex: 1 }}>
                <NodesList
                  nodes={nodes}
                  loading={nodesLoading}
                  error={nodesError}
                  openNodeModal={openNodeModal}
                  nodesSearch={localNodesSearch}
                  setNodesSearch={setNodesSearch}
                  availableRoles={availableRoles}
                  hideStats
                />
                {nodesPaginated && nodesPaginated.total > 0 && (
                  <TablePagination
                    currentPage={nodesPage}
                    totalPages={nodesPaginated.total_pages}
                    pageSize={nodesPerPage}
                    totalItems={nodesPaginated.total}
                    onPageChange={setNodesPage}
                    onPageSizeChange={handleNodesPageSizeChange}
                  />
                )}
              </Stack>
            </Group>
          </Grid.Col>
        </Grid>
      )}

      {/* Indices Section */}
      {activeView === 'indices' && (
        <Grid gutter="md">
          <Grid.Col span={12}>
            <IndexStatsCards
              stats={{
                totalIndices: indicesPaginated?.total ?? 0,
                greenIndices: indices?.filter((idx) => idx.health === 'green').length ?? 0,
                yellowIndices: indices?.filter((idx) => idx.health === 'yellow').length ?? 0,
                redIndices: indices?.filter((idx) => idx.health === 'red').length ?? 0,
                openIndices: indices?.filter((idx) => idx.status === 'open').length ?? 0,
                closedIndices: indices?.filter((idx) => idx.status === 'close').length ?? 0,
              }}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Group gap="md" wrap="nowrap" align="flex-start">
              <FilterSidebar
                textFilters={[{
                  value: localIndicesSearch,
                  onChange: setLocalIndicesSearch,
                  placeholder: 'Filter indices...',
                }]}
                categories={[
                  {
                    title: 'Health',
                    options: [
                      { label: 'green', value: 'green', color: 'var(--mantine-color-green-6)' },
                      { label: 'yellow', value: 'yellow', color: 'var(--mantine-color-yellow-6)' },
                      { label: 'red', value: 'red', color: 'var(--mantine-color-red-6)' },
                      { label: 'unknown', value: 'unknown', color: 'var(--mantine-color-gray-6)' },
                    ],
                    selected: selectedHealth,
                    onChange: (newHealth) => updateIndicesFilters(newHealth, undefined),
                  },
                  {
                    title: 'Status',
                    options: [
                      { label: 'open', value: 'open', color: 'var(--mantine-color-blue-6)' },
                      { label: 'closed', value: 'close', color: 'var(--mantine-color-gray-6)' },
                    ],
                    selected: selectedStatus,
                    onChange: (newStatus) => updateIndicesFilters(undefined, newStatus),
                  },
                ]}
                toggles={[
                  {
                    label: 'Show special indices',
                    value: showSpecialIndices,
                    onChange: (val) => updateIndicesParam('showSpecial', val),
                    icon: <IconEyeOff size={16} />,
                  },
                ]}
                actions={[
                  {
                    label: 'Create Index',
                    onClick: () => navigate(`/cluster/${id}/indices/create`),
                    icon: <IconPlus size={16} />,
                  },
                ]}
              />
              <Stack gap="md" style={{ flex: 1 }}>
                <IndicesList
                  indices={indices}
                  indicesPaginated={indicesPaginated}
                  loading={indicesLoading}
                  error={indicesError}
                  openIndexModal={openIndexModal}
                  indicesSearch={localIndicesSearch}
                  setIndicesSearch={setLocalIndicesSearch}
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
            </Group>
          </Grid.Col>
        </Grid>
      )}

      {/* Shards Section */}
      {activeView === 'shards' && (
        <Grid gutter="md">
          <Grid.Col span={12}>
            <ShardStatsCards
              stats={{
                totalShards: shards?.length ?? 0,
                primaryShards: shards?.filter((s) => s.primary).length ?? 0,
                replicaShards: shards?.filter((s) => !s.primary).length ?? 0,
                unassignedShards: shards?.filter((s) => s.state === 'UNASSIGNED').length ?? 0,
                relocatingShards: shards?.filter((s) => s.state === 'RELOCATING').length ?? 0,
                initializingShards: shards?.filter((s) => s.state === 'INITIALIZING').length ?? 0,
              }}
            />
          </Grid.Col>
          <Grid.Col span={12}>
            <Group gap="md" wrap="nowrap" align="flex-start">
              <FilterSidebar
                textFilters={[{
                  value: localShardsSearch,
                  onChange: setShardsSearch,
                  placeholder: 'Filter shards...',
                }]}
                categories={[
                  {
                    title: 'State',
                    options: [
                      { label: 'Started', value: 'STARTED', color: SHARD_STATE_COLORS.STARTED },
                      { label: 'Initializing', value: 'INITIALIZING', color: SHARD_STATE_COLORS.INITIALIZING },
                      { label: 'Relocating', value: 'RELOCATING', color: SHARD_STATE_COLORS.RELOCATING },
                      { label: 'Unassigned', value: 'UNASSIGNED', color: SHARD_STATE_COLORS.UNASSIGNED },
                    ],
                    selected: selectedShardStates,
                    onChange: (newStates) => updateShardsFilters(newStates, undefined, undefined),
                  },
                  {
                    title: 'Type',
                    options: [
                      { label: 'Primaries', value: 'primaries', color: SHARD_TYPE_COLORS.primaries },
                      { label: 'Replicas', value: 'replicas', color: SHARD_TYPE_COLORS.replicas },
                    ],
                    selected: [...(showShardPrimaries ? ['primaries'] : []), ...(showShardReplicas ? ['replicas'] : [])],
                    onChange: (selected) => {
                      updateShardsFilters(undefined, selected.includes('primaries'), selected.includes('replicas'));
                    },
                  },
                ]}
                toggles={[
                  {
                    label: 'Show special indices',
                    value: searchParams.get('showSpecial') === 'true',
                    onChange: (val) => updateShardsParam('showSpecial', val),
                    icon: <IconEyeOff size={16} />,
                  },
                ]}
              />
              <Stack gap="md" style={{ flex: 1 }}>
                <ShardsList
                  shards={shards}
                  loading={shardsLoading}
                  error={shardsError}
                  openNodeModal={openNodeModal}
                  hideStats
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
            </Group>
          </Grid.Col>
        </Grid>
      )}

      {/* Console Section */}
      {activeView === 'console' && <RestConsole />}

      {/* Tasks Section */}
      {activeView === 'tasks' && <TasksTab clusterId={id!} isActive={activeView === 'tasks'} />}

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
              <IndexEdit constrainToParent hideHeader onShardClick={handleShardClickInIndexModal} />
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
        context={activeView === 'topology' ? 'topology' : activeView === 'nodes' ? 'nodes' : 'shards'}
        clusterInfo={clusterInfo}
      />

      {/* Shard Modals from stack */}
      {modalStack.map((modal) => {
        if (modal.type !== 'shard' || !modal.shardId) return null;
        
        const [indexName, shardPart] = modal.shardId.includes('[') 
          ? modal.shardId.split('[') 
          : [modal.indexName, modal.shardId];
        const shardNum = shardPart ? parseInt(shardPart.replace(']', ''), 10) : 0;
        
        const shard: ShardInfo = {
          index: modal.indexName || indexName || '',
          shard: shardNum,
          primary: true,
          state: 'STARTED',
          node: undefined,
          docs: 0,
          store: 0,
        };
        
        return (
          <ShardDetailsModal
            key={modal.id}
            shard={shard}
            opened={true}
            onClose={() => popModal()}
            clusterId={id!}
            zIndex={300}
          />
        );
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

const NodesList = memo(function NodesList({
  nodes,
  loading,
  error,
  openNodeModal,
  nodesSearch,
  setNodesSearch,
  availableRoles,
  hideStats = false,
}: {
  nodes?: NodeInfo[];
  loading: boolean;
  error: Error | null;
  openNodeModal?: (nodeId: string) => void;
  nodesSearch: string;
  setNodesSearch: (value: string) => void;
  availableRoles: string[];
  hideStats?: boolean;
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

  if (loading && !nodes) {
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
  const hasActiveFilters = searchQuery || selectedRoles.length < availableRoles.length;

  if ((!nodes || nodes.length === 0) && !hasActiveFilters && !loading) {
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
                    {node.loadAverage !== undefined && node.loadAverage.length > 0 ? (
                      <Text
                        size="sm"
                        c={getLoadColor(node.loadAverage[0])}
                        style={{ fontFamily: 'monospace' }}
                      >
                        {formatLoadAverage(node.loadAverage[0])}
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

    setSearchParams(params, { replace: true });
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
    setSearchParams(newParams, { replace: true });
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
    return [...filteredIndices].sort((a, b) => {
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
  }, [filteredIndices, indicesSortColumn, indicesSortDirection]);

  if (loading && !indices) {
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
                <Table.Th>Primaries</Table.Th>
                <Table.Th>Replicas</Table.Th>
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
                        {`${index.primaryShards}p / ${index.replicaShards}r`}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{index.primaryShards}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{index.replicaShards}</Text>
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
  zIndex,
}: {
  shard: ShardInfo | null;
  opened: boolean;
  onClose: () => void;
  clusterId: string;
  zIndex?: number;
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
  setSearchParams: (params: URLSearchParams, opts?: { replace?: boolean }) => void;
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
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

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

  // Topology index view: Always show 10 columns (indices) per page
  // Nodes (rows) are not paginated - all are shown
  const COLUMNS_PER_PAGE = 10;

  // Pagination state - only indices are paginated, not nodes
  const currentPage = parseInt(searchParams.get('overviewPage') || '1', 10);
  const pageSize = COLUMNS_PER_PAGE;

  const handleOverviewPageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('overviewPage', page.toString());
    setSearchParams(params, { replace: true });
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
    console.log('Display shard stats clicked for', shard.index, shard.shard);
    setSelectedShard(shard);
    setDetailsModalOpen(true);
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
      showSpecialNotification({
        title: 'Cannot Relocate',
        message: `Shard ${shard.shard} (${shard.primary ? 'Primary' : 'Replica'}) of index "${shard.index}" cannot be relocated. All data nodes either already host this shard or are the source node.`,
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
    setSearchParams(newParams, { replace: true });
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
    setSearchParams(newParams, { replace: true });
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
          onShowIndexDetails={(shard) => {
            console.log('Display index details clicked for', shard.index);
            openIndexModal(shard.index);
            handleContextMenuClose();
          }}
        />
      )}

      {/* Shard allocation grid */}
      <ScrollArea>
        <div style={{ minWidth: '800px' }}>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th
                  style={{
                    width: '180px',
                    minWidth: '180px',
                    maxWidth: '180px',
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
                      width: '180px',
                      minWidth: '180px',
                      maxWidth: '180px',
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
                                    // No border for unassigned shards (Requirement 16.1)
                                    border: 'none',
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
                          width: '180px',
                          minWidth: '180px',
                          maxWidth: '180px',
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
                <Badge size="sm" color={getShardTypeColor(selectedShard?.primary ?? false)}>
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

    setSearchParams(params, { replace: true });
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

