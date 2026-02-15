import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Badge,
  Grid,
  Alert,
  Tabs,
  Table,
  Progress,
  ScrollArea,
  Button,
  Menu,
  ActionIcon,
  TextInput,
  MultiSelect,
  Checkbox,
  Tooltip,
  Modal,
  Code,
  Skeleton,
} from '@mantine/core';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
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
} from '@tabler/icons-react';
import { notifications } from '@mantine/notifications';
import { apiClient } from '../api/client';
import { useDebounce } from '../hooks/useDebounce';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useWatermarks } from '../hooks/useWatermarks';
import { useSparklineData } from '../hooks/useSparklineData';
import { IndexOperations } from '../components/IndexOperations';
import { IndexEdit } from './IndexEdit';
import { Sparkline } from '../components/Sparkline';
import { ClusterStatistics } from '../components/ClusterStatistics';
import { TablePagination } from '../components/TablePagination';
import { MasterIndicator } from '../components/MasterIndicator';
import { RoleIcons, RoleLegend } from '../components/RoleIcons';
import type { NodeInfo, IndexInfo, ShardInfo, HealthStatus } from '../types/api';
import { formatLoadAverage, getLoadColor, formatUptimeDetailed } from '../utils/formatters';
import { useState, useEffect } from 'react';

/**
 * Get color for health status badge
 */
function getHealthColor(health: HealthStatus): string {
  switch (health) {
    case 'green':
      return 'green';
    case 'yellow':
      return 'yellow';
    case 'red':
      return 'red';
    default:
      return 'gray';
  }
}

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
 * Format percentage
 */
function formatPercent(used: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((used / total) * 100);
}

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
  const refreshInterval = useRefreshInterval();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);
  
  // Get active tab from URL, default to 'overview'
  const activeTab = searchParams.get('tab') || 'overview';
  
  // Get index name from URL for modal
  const indexNameParam = searchParams.get('index');
  const indexTabParam = searchParams.get('indexTab');

  // Index modal state
  const [indexModalOpen, setIndexModalOpen] = useState(false);
  const [selectedIndexName, setSelectedIndexName] = useState<string | null>(null);

  // Open index modal when URL param changes
  useEffect(() => {
    if (indexNameParam) {
      setSelectedIndexName(decodeURIComponent(indexNameParam));
      setIndexModalOpen(true);
    } else {
      setIndexModalOpen(false);
      setSelectedIndexName(null);
    }
  }, [indexNameParam]);

  // Handle opening index modal
  const openIndexModal = (indexName: string, tab?: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('index', encodeURIComponent(indexName));
    if (tab) {
      params.set('indexTab', tab);
    } else {
      params.delete('indexTab');
    }
    setSearchParams(params);
  };

  // Handle closing index modal
  const closeIndexModal = () => {
    const params = new URLSearchParams(searchParams);
    params.delete('index');
    params.delete('indexTab');
    setSearchParams(params);
  };

  // Update URL when tab changes
  const handleTabChange = (value: string | null) => {
    if (value) {
      const params = new URLSearchParams(searchParams);
      params.set('tab', value);
      // Preserve index params if they exist
      if (indexNameParam) {
        params.set('index', indexNameParam);
      }
      if (indexTabParam) {
        params.set('indexTab', indexTabParam);
      }
      setSearchParams(params);
    }
  };

  // Fetch cluster statistics with auto-refresh
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['cluster', id, 'stats'],
    queryFn: () => apiClient.getClusterStats(id!),
    refetchInterval: refreshInterval,
    enabled: !!id,
  });

  // Track historical data for sparklines
  // Pass activeTab as resetKey so data resets when switching to statistics tab
  // For statistics tab, request timestamps; for sparklines, just values
  const nodesHistory = useSparklineData(stats?.numberOfNodes, 20, activeTab, activeTab === 'statistics') as any;
  const indicesHistory = useSparklineData(stats?.numberOfIndices, 20, activeTab, activeTab === 'statistics') as any;
  const documentsHistory = useSparklineData(stats?.numberOfDocuments, 20, activeTab, activeTab === 'statistics') as any;
  const shardsHistory = useSparklineData(stats?.activeShards, 20, activeTab, activeTab === 'statistics') as any;
  const unassignedHistory = useSparklineData(stats?.unassignedShards, 20, activeTab, activeTab === 'statistics') as any;

  // Fetch nodes with auto-refresh
  const {
    data: nodes,
    isLoading: nodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ['cluster', id, 'nodes'],
    queryFn: () => apiClient.getNodes(id!),
    refetchInterval: refreshInterval,
    enabled: !!id,
  });

  // Fetch indices with auto-refresh
  const {
    data: indices,
    isLoading: indicesLoading,
    error: indicesError,
  } = useQuery({
    queryKey: ['cluster', id, 'indices'],
    queryFn: () => apiClient.getIndices(id!),
    refetchInterval: refreshInterval,
    enabled: !!id,
  });

  // Fetch shards with auto-refresh
  const {
    data: shards,
    isLoading: shardsLoading,
    error: shardsError,
  } = useQuery({
    queryKey: ['cluster', id, 'shards'],
    queryFn: () => apiClient.getShards(id!),
    refetchInterval: refreshInterval,
    enabled: !!id,
  });

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
      {/* Cluster Name */}
      <div>
        <Title order={1} className="text-responsive-xl">
          {stats?.clusterName || id}
        </Title>
      </div>

      {/* Tabs at the top */}
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Tab value="overview">Overview</Tabs.Tab>
          <Tabs.Tab value="statistics">Statistics</Tabs.Tab>
          <Tabs.Tab value="nodes">Nodes ({nodes?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="indices">Indices ({indices?.length || 0})</Tabs.Tab>
          <Tabs.Tab value="shards">Shards ({shards?.length || 0})</Tabs.Tab>
        </Tabs.List>

        {/* Overview Tab */}
        <Tabs.Panel value="overview" pt="md">
          <Stack gap="md">
            {/* Health Status Progress Bar */}
            <Progress
              value={100}
              color={getHealthColor(stats?.health || 'red')}
              size="sm"
              radius="xs"
              aria-label={`Cluster health: ${stats?.health || 'unknown'}`}
            />

            {/* Cluster Statistics Cards */}
            <Grid>
              <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                <Card 
                  shadow="sm" 
                  padding="md" 
                  style={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleTabChange('nodes')}
                >
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Nodes</Text>
                        <Text size="xl" fw={700}>{stats?.numberOfNodes || 0}</Text>
                      </div>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {stats?.numberOfDataNodes || 0} data
                      </Text>
                    </Group>
                    {nodesHistory.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Sparkline data={nodesHistory} color="var(--mantine-color-blue-6)" height={25} />
                      </div>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                <Card 
                  shadow="sm" 
                  padding="md"
                  style={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleTabChange('indices')}
                >
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Indices</Text>
                        <Text size="xl" fw={700}>{stats?.numberOfIndices || 0}</Text>
                      </div>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {stats?.numberOfDataNodes || 0} data
                      </Text>
                    </Group>
                    {indicesHistory.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Sparkline data={indicesHistory} color="var(--mantine-color-green-6)" height={25} />
                      </div>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                <Card 
                  shadow="sm" 
                  padding="md"
                  style={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleTabChange('indices')}
                >
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Documents</Text>
                        <Text size="xl" fw={700}>{(stats?.numberOfDocuments || 0).toLocaleString()}</Text>
                      </div>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        total
                      </Text>
                    </Group>
                    {documentsHistory.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Sparkline data={documentsHistory} color="var(--mantine-color-cyan-6)" height={25} />
                      </div>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                <Card 
                  shadow="sm" 
                  padding="md"
                  style={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleTabChange('shards')}
                >
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Shards</Text>
                        <Text size="xl" fw={700}>{stats?.activeShards || 0}</Text>
                      </div>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {stats?.activePrimaryShards || 0} primary
                      </Text>
                    </Group>
                    {shardsHistory.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Sparkline data={shardsHistory} color="var(--mantine-color-violet-6)" height={25} />
                      </div>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>

              <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
                <Card 
                  shadow="sm" 
                  padding="md"
                  style={{ cursor: 'pointer', height: '100%' }}
                  onClick={() => handleTabChange('shards')}
                >
                  <Stack gap={4}>
                    <Group justify="space-between" wrap="nowrap">
                      <div style={{ flex: 1 }}>
                        <Text size="xs" c="dimmed">Unassigned</Text>
                        <Text size="xl" fw={700} c={stats?.unassignedShards ? 'red' : undefined}>
                          {stats?.unassignedShards || 0}
                        </Text>
                      </div>
                      <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
                        {stats?.relocatingShards || 0} moving
                      </Text>
                    </Group>
                    {unassignedHistory.length > 0 && (
                      <div style={{ marginTop: 4 }}>
                        <Sparkline 
                          data={unassignedHistory} 
                          color={stats?.unassignedShards ? 'var(--mantine-color-red-6)' : 'var(--mantine-color-gray-6)'} 
                          height={25} 
                        />
                      </div>
                    )}
                  </Stack>
                </Card>
              </Grid.Col>
            </Grid>

            {/* Memory and Disk Usage */}
            {(stats?.memoryTotal || stats?.diskTotal) && (
              <Grid>
                {stats?.memoryTotal && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card shadow="sm" padding="lg">
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed">Memory Usage</Text>
                        <Progress
                          value={formatPercent(stats.memoryUsed || 0, stats.memoryTotal)}
                          color={getColor(formatPercent(stats.memoryUsed || 0, stats.memoryTotal))}
                          size="sm"
                          radius="xs"
                        />
                        <Text size="xs" c="dimmed">
                          {formatBytes(stats.memoryUsed || 0)} / {formatBytes(stats.memoryTotal)} (
                          {formatPercent(stats.memoryUsed || 0, stats.memoryTotal)}%)
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                )}

                {stats?.diskTotal && (
                  <Grid.Col span={{ base: 12, md: 6 }}>
                    <Card shadow="sm" padding="lg">
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed">Disk Usage</Text>
                        <Progress
                          value={formatPercent(stats.diskUsed || 0, stats.diskTotal)}
                          color={getColor(formatPercent(stats.diskUsed || 0, stats.diskTotal))}
                          size="sm"
                          radius="xs"
                        />
                        <Text size="xs" c="dimmed">
                          {formatBytes(stats.diskUsed || 0)} / {formatBytes(stats.diskTotal)} (
                          {formatPercent(stats.diskUsed || 0, stats.diskTotal)}%)
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                )}
              </Grid>
            )}

            {/* Shard Allocation Grid */}
            <Card shadow="sm" padding="lg">
              <ShardAllocationGrid 
                nodes={nodes} 
                indices={indices} 
                shards={shards}
                loading={nodesLoading || indicesLoading || shardsLoading}
                error={nodesError || indicesError || shardsError}
                openIndexModal={openIndexModal}
              />
            </Card>
          </Stack>
        </Tabs.Panel>

        {/* Statistics Tab */}
        <Tabs.Panel value="statistics" pt="md">
          <ClusterStatistics
            nodesHistory={nodesHistory}
            indicesHistory={indicesHistory}
            documentsHistory={documentsHistory}
            shardsHistory={shardsHistory}
            unassignedHistory={unassignedHistory}
            stats={stats}
            nodes={nodes}
          />
        </Tabs.Panel>

        {/* Nodes Tab */}
        <Tabs.Panel value="nodes" pt="md">
          <Card shadow="sm" padding="lg">
            <NodesList nodes={nodes} loading={nodesLoading} error={nodesError} />
          </Card>
        </Tabs.Panel>

        {/* Indices Tab */}
        <Tabs.Panel value="indices" pt="md">
          <Card shadow="sm" padding="lg">
            <IndicesList 
              indices={indices} 
              loading={indicesLoading} 
              error={indicesError}
              openIndexModal={openIndexModal}
            />
          </Card>
        </Tabs.Panel>

        {/* Shards Tab */}
        <Tabs.Panel value="shards" pt="md">
          <Card shadow="sm" padding="lg">
            <ShardsList shards={shards} loading={shardsLoading} error={shardsError} />
          </Card>
        </Tabs.Panel>
      </Tabs>

      {/* Index Edit Modal */}
      {selectedIndexName && (
        <Modal
          opened={indexModalOpen}
          onClose={closeIndexModal}
          size="90%"
          fullScreen={false}
          styles={{
            body: {
              height: 'calc(100vh - 120px)',
              display: 'flex',
              flexDirection: 'column',
              padding: 0,
            },
            content: {
              display: 'flex',
              flexDirection: 'column',
            },
          }}
          withCloseButton={true}
        >
          <div style={{ flex: 1, overflow: 'auto', padding: 'var(--mantine-spacing-md)' }}>
            <IndexEdit />
          </div>
        </Modal>
      )}
    </Stack>
  );
}

/**
 * NodesList component displays the list of nodes with search and role filtering
 * Requirements: 4.6, 14.1, 14.2, 14.3, 14.4, 14.5, 31.7
 */
function NodesList({
  nodes,
  loading,
  error,
}: {
  nodes?: NodeInfo[];
  loading: boolean;
  error: Error | null;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(id);
  
  // Get filters from URL
  const searchQuery = searchParams.get('nodesSearch') || '';
  const selectedRoles = searchParams.get('roles')?.split(',').filter(Boolean) || [];
  const expandedView = searchParams.get('nodesExpanded') === 'true';
  
  // Debounce search query
  // Requirements: 31.7 - Debounce user input in search and filter fields
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Update URL when filters change
  const updateFilters = (newSearch?: string, newRoles?: string[], newExpanded?: boolean) => {
    const params = new URLSearchParams(searchParams);
    
    if (newSearch !== undefined) {
      if (newSearch) {
        params.set('nodesSearch', newSearch);
      } else {
        params.delete('nodesSearch');
      }
    }
    
    if (newRoles !== undefined) {
      if (newRoles.length > 0) {
        params.set('roles', newRoles.join(','));
      } else {
        params.delete('roles');
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

  // Get all unique roles from nodes
  const allRoles = Array.from(new Set(nodes?.flatMap(n => n.roles) || []));

  // Filter nodes based on debounced search query and selected roles
  const filteredNodes = nodes?.filter((node) => {
    const matchesSearch = node.name.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
      node.ip?.toLowerCase().includes(debouncedSearch.toLowerCase());
    
    const matchesRoles = selectedRoles.length === 0 || 
      selectedRoles.some(role => node.roles.includes(role as any));
    
    return matchesSearch && matchesRoles;
  });

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

  if (!nodes || nodes.length === 0) {
    return <Text c="dimmed">No nodes found</Text>;
  }

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <Group style={{ flex: 1 }}>
          <TextInput
            placeholder="Search nodes..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => updateFilters(e.currentTarget.value, undefined, undefined)}
            style={{ flex: 1, maxWidth: 400 }}
          />
          
          <MultiSelect
            placeholder="Filter by roles"
            data={allRoles}
            value={selectedRoles}
            onChange={(values) => updateFilters(undefined, values, undefined)}
            clearable
            searchable
            style={{ flex: 1, maxWidth: 300 }}
          />
        </Group>
        
        <Tooltip label={expandedView ? 'Collapse view' : 'Expand view'}>
          <ActionIcon
            variant="subtle"
            size="lg"
            onClick={() => updateFilters(undefined, undefined, !expandedView)}
          >
            {expandedView ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
          </ActionIcon>
        </Tooltip>
      </Group>

      {!expandedView && filteredNodes && filteredNodes.length > 0 && (
        <RoleLegend roles={Array.from(new Set(filteredNodes.flatMap(n => n.roles)))} />
      )}

      {filteredNodes && filteredNodes.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No nodes match your filters
        </Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Node ID</Table.Th>
                <Table.Th>Roles</Table.Th>
                {expandedView && <Table.Th>Tags</Table.Th>}
                <Table.Th>Load</Table.Th>
                <Table.Th>Uptime</Table.Th>
                <Table.Th>Heap Usage</Table.Th>
                <Table.Th>Disk Usage</Table.Th>
                <Table.Th>CPU</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filteredNodes?.map((node) => (
                <Table.Tr
                  key={node.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => navigate(`/cluster/${id}/nodes/${node.id}`)}
                >
                  <Table.Td>
                    <Group gap="xs" wrap="nowrap">
                      <MasterIndicator 
                        isMaster={node.isMaster} 
                        isMasterEligible={node.isMasterEligible}
                        size="sm"
                      />
                      <div>
                        <Text size="sm" fw={500}>{node.name}</Text>
                        {node.ip && <Text size="xs" c="dimmed">{node.ip}</Text>}
                      </div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    <Text size="xs" c="dimmed" style={{ fontFamily: 'monospace' }}>
                      {node.id}
                    </Text>
                  </Table.Td>
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
                      <RoleIcons roles={node.roles} />
                    )}
                  </Table.Td>
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
                        <Text size="xs" c="dimmed">-</Text>
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
                      <Text size="sm" c="dimmed">N/A</Text>
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
                      <Text size="sm" c="dimmed">N/A</Text>
                    )}
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={4}>
                      <Progress
                        value={formatPercent(node.heapUsed, node.heapMax)}
                        color={getColor(formatPercent(node.heapUsed, node.heapMax))}
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
                        value={formatPercent(node.diskUsed, node.diskTotal)}
                        color={getColor(formatPercent(node.diskUsed, node.diskTotal))}
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
                      <Text size="sm" c="dimmed">N/A</Text>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
    </Stack>
  );
}

/**
 * IndicesList component displays the list of indices with search and filtering
 * Requirements: 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 7.1, 8.1, 31.7
 */
function IndicesList({
  indices,
  loading,
  error,
  openIndexModal,
}: {
  indices?: IndexInfo[];
  loading: boolean;
  error: Error | null;
  openIndexModal: (indexName: string, tab?: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get filters from URL
  const searchQuery = searchParams.get('indicesSearch') || '';
  const selectedHealth = searchParams.get('health')?.split(',').filter(Boolean) || [];
  const selectedStatus = searchParams.get('status')?.split(',').filter(Boolean) || [];
  const expandedView = searchParams.get('expanded') === 'true';
  const sortAscending = searchParams.get('sort') !== 'desc';
  const showOnlyAffected = searchParams.get('affected') === 'true';
  
  // Pagination state
  const currentPage = parseInt(searchParams.get('indicesPage') || '1', 10);
  const pageSize = parseInt(searchParams.get('indicesPageSize') || '50', 10);
  
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
  
  // Debounce search query to avoid excessive filtering
  // Requirements: 31.7 - Debounce user input in search and filter fields
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Fetch shards to identify unassigned/problem shards
  const {
    data: shards,
  } = useQuery({
    queryKey: ['cluster', id, 'shards'],
    queryFn: () => apiClient.getShards(id!),
    enabled: !!id,
  });

  // Fetch cluster settings to check allocation status
  const {
    data: clusterSettings,
  } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: async () => {
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        id!,
        'GET',
        '/_cluster/settings'
      );
      return response;
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
    
    const transientEnable = (transientRouting?.allocation as Record<string, unknown>)?.enable as string | undefined;
    const persistentEnable = (persistentRouting?.allocation as Record<string, unknown>)?.enable as string | undefined;
    
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
      if (newHealth.length > 0) {
        params.set('health', newHealth.join(','));
      } else {
        params.delete('health');
      }
    }
    
    if (newStatus !== undefined) {
      if (newStatus.length > 0) {
        params.set('status', newStatus.join(','));
      } else {
        params.delete('status');
      }
    }
    
    setSearchParams(params);
  };

  const updateParam = (key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '' || value === false) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    setSearchParams(newParams);
  };

  // Group shards by index to identify problem indices
  const shardsByIndex = shards?.reduce((acc, shard) => {
    if (!acc[shard.index]) {
      acc[shard.index] = [];
    }
    acc[shard.index].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>) || {};

  // Identify unassigned shards
  const unassignedShards = shards?.filter(s => s.state === 'UNASSIGNED') || [];
  const unassignedByIndex = unassignedShards.reduce((acc, shard) => {
    if (!acc[shard.index]) {
      acc[shard.index] = [];
    }
    acc[shard.index].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>);

  // Check if an index has problems
  const hasProblems = (indexName: string) => {
    const indexShards = shardsByIndex[indexName] || [];
    return indexShards.some(s => 
      s.state === 'UNASSIGNED' || 
      s.state === 'RELOCATING' || 
      s.state === 'INITIALIZING'
    );
  };

  // Filter indices based on debounced search query and filters
  let filteredIndices = indices?.filter((index) => {
    const matchesSearch = index.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesHealth = selectedHealth.length === 0 || selectedHealth.includes(index.health);
    const matchesStatus = selectedStatus.length === 0 || selectedStatus.includes(index.status);
    const matchesAffected = !showOnlyAffected || hasProblems(index.name);
    
    return matchesSearch && matchesHealth && matchesStatus && matchesAffected;
  });

  // Sort indices
  if (filteredIndices) {
    filteredIndices = [...filteredIndices].sort((a, b) => {
      return sortAscending ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
    });
  }

  // Pagination
  const totalPages = Math.ceil((filteredIndices?.length || 0) / pageSize);
  const paginatedIndices = filteredIndices?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

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

  if (!indices || indices.length === 0) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Text c="dimmed">No indices found</Text>
        {id && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate(`/cluster/${id}/indices/create`)}
          >
            Create Index
          </Button>
        )}
      </Stack>
    );
  }

  const hasAnyProblems = unassignedShards.length > 0;

  return (
    <Stack gap="md">
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
            value={searchQuery}
            onChange={(e) => updateFilters(e.currentTarget.value, undefined, undefined)}
            style={{ flex: 1, maxWidth: 300 }}
          />
          
          <MultiSelect
            placeholder="Health"
            data={['green', 'yellow', 'red']}
            value={selectedHealth}
            onChange={(values) => updateFilters(undefined, values, undefined)}
            clearable
            style={{ maxWidth: 200 }}
          />
          
          <MultiSelect
            placeholder="Status"
            data={['open', 'close']}
            value={selectedStatus}
            onChange={(values) => updateFilters(undefined, undefined, values)}
            clearable
            style={{ maxWidth: 150 }}
          />

          {/* Show only affected checkbox */}
          {hasAnyProblems && (
            <Checkbox
              label="Show only affected"
              checked={showOnlyAffected}
              onChange={(e) => updateParam('affected', e.currentTarget.checked)}
              size="sm"
            />
          )}
        </Group>
        
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

      {filteredIndices && filteredIndices.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No indices match your filters
        </Text>
      ) : (
        <ScrollArea>
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Name</Table.Th>
                <Table.Th>Health</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Documents</Table.Th>
                <Table.Th>Size</Table.Th>
                <Table.Th>Shards</Table.Th>
                {expandedView && <Table.Th>Primaries</Table.Th>}
                {expandedView && <Table.Th>Replicas</Table.Th>}
                <Table.Th>Unassigned</Table.Th>
                <Table.Th>Actions</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {paginatedIndices?.map((index) => {
                const unassignedCount = unassignedByIndex[index.name]?.length || 0;
                const hasUnassigned = unassignedCount > 0;
                
                return (
                  <Table.Tr 
                    key={index.name}
                    style={{ 
                      cursor: 'pointer',
                      backgroundColor: hasUnassigned ? 'rgba(250, 82, 82, 0.1)' : undefined,
                    }}
                    onClick={() => openIndexModal(index.name)}
                  >
                    <Table.Td>
                      <Stack gap={2}>
                        <Text size="sm" fw={500} style={{ textDecoration: 'underline' }}>{index.name}</Text>
                        {expandedView && hasProblems(index.name) && (
                          <Badge size="xs" color="yellow" variant="light">
                            Has Issues
                          </Badge>
                        )}
                      </Stack>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" color={getHealthColor(index.health)}>
                        {index.health}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge size="sm" variant="light" color={index.status === 'open' ? 'green' : 'gray'}>
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
                      <Text size="sm">
                        {expandedView ? `${index.primaryShards + index.replicaShards}` : `${index.primaryShards}p / ${index.replicaShards}r`}
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
                        <Badge size="sm" color="red" variant="filled">
                          {unassignedCount}
                        </Badge>
                      ) : (
                        <Text size="sm" c="dimmed">-</Text>
                      )}
                    </Table.Td>
                    <Table.Td onClick={(e) => e.stopPropagation()}>
                      <Group gap="xs">
                        {id && <IndexOperations clusterId={id} index={index} />}
                        <Menu shadow="md" width={200}>
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
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
      
      {/* Pagination */}
      {filteredIndices && filteredIndices.length > pageSize && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredIndices.length}
          onPageChange={handleIndicesPageChange}
          onPageSizeChange={handleIndicesPageSizeChange}
        />
      )}
    </Stack>
  );
}

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
  const [detailedStats, setDetailedStats] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);

  // Fetch detailed stats when modal opens
  useEffect(() => {
    if (opened && shard) {
      setLoading(true);
      setDetailedStats(null); // Reset previous data
      
      console.log('Fetching shard stats:', { clusterId, index: shard.index, shard: shard.shard });
      
      apiClient
        .getShardStats(clusterId, shard.index, shard.shard)
        .then((stats) => {
          console.log('Received shard stats:', stats);
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
  }, [opened, shard?.index, shard?.shard, clusterId]);

  if (!shard) return null;

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="xs">
          <Text size="lg" fw={600}>Shard Details:</Text>
          <Badge size="lg" variant="light" color="blue">{shard.index}</Badge>
          <Text size="lg" c="dimmed">/</Text>
          <Badge size="lg" variant="filled" color="cyan">#{shard.shard}</Badge>
          <Badge 
            size="lg" 
            variant={shard.primary ? 'filled' : 'light'} 
            color={shard.primary ? 'green' : 'gray'}
          >
            {shard.primary ? 'Primary' : 'Replica'}
          </Badge>
        </Group>
      }
      size="80%"
      fullScreen={false}
      styles={{
        body: {
          height: 'calc(100vh - 120px)',
          display: 'flex',
          flexDirection: 'column',
        },
      }}
    >
      <ScrollArea style={{ flex: 1 }}>
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
          <Code block>
            {JSON.stringify(detailedStats || shard, null, 2)}
          </Code>
        )}
      </ScrollArea>
    </Modal>
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
}: {
  nodes?: NodeInfo[];
  indices?: IndexInfo[];
  shards?: ShardInfo[];
  loading: boolean;
  error: Error | null;
  openIndexModal: (indexName: string, tab?: string) => void;
}) {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Modal state for shard details
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);
  const [modalOpened, setModalOpened] = useState(false);
  
  // Get UI state from URL
  const searchQuery = searchParams.get('overviewSearch') || '';
  const showClosed = searchParams.get('showClosed') === 'true';
  const showSpecial = searchParams.get('showSpecial') === 'true';
  const expandedView = searchParams.get('overviewExpanded') === 'true';
  const showOnlyAffected = searchParams.get('overviewAffected') === 'true';
  
  // Pagination state
  const currentPage = parseInt(searchParams.get('overviewPage') || '1', 10);
  const pageSize = parseInt(searchParams.get('overviewPageSize') || '20', 10);
  
  const handleOverviewPageChange = (page: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('overviewPage', page.toString());
    setSearchParams(params);
  };

  const handleOverviewPageSizeChange = (size: number) => {
    const params = new URLSearchParams(searchParams);
    params.set('overviewPageSize', size.toString());
    params.set('overviewPage', '1'); // Reset to first page when changing page size
    setSearchParams(params);
  };
  
  const debouncedSearch = useDebounce(searchQuery, 300);

  // Handler to open shard details modal
  const handleShardClick = (shard: ShardInfo) => {
    setSelectedShard(shard);
    setModalOpened(true);
  };

  // Update URL params
  const updateParam = (key: string, value: string | boolean) => {
    const newParams = new URLSearchParams(searchParams);
    if (value === '' || value === false) {
      newParams.delete(key);
    } else {
      newParams.set(key, String(value));
    }
    setSearchParams(newParams);
  };

  // Fetch cluster settings to check allocation status
  const {
    data: clusterSettings,
  } = useQuery({
    queryKey: ['cluster', id, 'settings'],
    queryFn: async () => {
      const response = await apiClient.proxyRequest<Record<string, unknown>>(
        id!,
        'GET',
        '/_cluster/settings'
      );
      return response;
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
    
    const transientEnable = (transientRouting?.allocation as Record<string, unknown>)?.enable as string | undefined;
    const persistentEnable = (persistentRouting?.allocation as Record<string, unknown>)?.enable as string | undefined;
    
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

  if (!nodes || !indices || !shards || nodes.length === 0 || indices.length === 0) {
    return (
      <Stack gap="md" align="center" py="xl">
        <Text c="dimmed">No shard allocation data available</Text>
      </Stack>
    );
  }

  // Identify unassigned shards
  const unassignedShards = shards.filter(s => s.state === 'UNASSIGNED');
  const unassignedByIndex = unassignedShards.reduce((acc, shard) => {
    if (!acc[shard.index]) {
      acc[shard.index] = [];
    }
    acc[shard.index].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>);

  // Check if an index has problems
  const hasProblems = (indexName: string) => {
    const indexShards = shards.filter(s => s.index === indexName);
    return indexShards.some(s => 
      s.state === 'UNASSIGNED' || 
      s.state === 'RELOCATING' || 
      s.state === 'INITIALIZING'
    );
  };

  // Filter indices based on search and filters
  let filteredIndices = indices.filter((index) => {
    const matchesSearch = index.name.toLowerCase().includes(debouncedSearch.toLowerCase());
    const matchesClosed = showClosed || index.status === 'open';
    const matchesSpecial = showSpecial || !index.name.startsWith('.');
    const matchesAffected = !showOnlyAffected || hasProblems(index.name);
    return matchesSearch && matchesClosed && matchesSpecial && matchesAffected;
  });

  // Pagination
  const totalPages = Math.ceil(filteredIndices.length / pageSize);
  const paginatedIndices = filteredIndices.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // Group shards by node and index
  // Build a map of node identifiers (id, name, ip) to node name for matching
  const nodeIdentifierMap = new Map<string, string>();
  nodes.forEach(node => {
    nodeIdentifierMap.set(node.id, node.name);
    nodeIdentifierMap.set(node.name, node.name);
    if (node.ip) {
      nodeIdentifierMap.set(node.ip, node.name);
    }
  });
  
  const shardsByNodeAndIndex = new Map<string, Map<string, ShardInfo[]>>();
  
  shards.forEach((shard) => {
    if (!shard.node) return; // Skip unassigned shards for grid view
    
    // Try to find the node name using the identifier map
    const nodeName = nodeIdentifierMap.get(shard.node);
    if (!nodeName) {
      // If we can't find a match, skip this shard
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
      {/* Shard Details Modal */}
      <ShardDetailsModal
        shard={selectedShard}
        opened={modalOpened}
        onClose={() => setModalOpened(false)}
        clusterId={id!}
      />

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
              onClick={() => updateParam('overviewExpanded', !expandedView)}
            >
              {expandedView ? <IconMinimize size={20} /> : <IconMaximize size={20} />}
            </ActionIcon>
          </Tooltip>
        </Group>

        <Group style={{ flex: 1 }}>
          <TextInput
            placeholder="Filter indices by name or alias..."
            leftSection={<IconSearch size={16} />}
            value={searchQuery}
            onChange={(e) => updateParam('overviewSearch', e.currentTarget.value)}
            style={{ flex: 1, maxWidth: 400 }}
          />
          
          <Group gap="md">
            <Checkbox
              label={`closed (${indices.filter(i => i.status !== 'open').length})`}
              checked={showClosed}
              onChange={(e) => updateParam('showClosed', e.currentTarget.checked)}
              size="sm"
            />
            
            <Checkbox
              label={`special (${indices.filter(i => i.name.startsWith('.')).length})`}
              checked={showSpecial}
              onChange={(e) => updateParam('showSpecial', e.currentTarget.checked)}
              size="sm"
            />

            {unassignedShards.length > 0 && (
              <Checkbox
                label="Show only affected"
                checked={showOnlyAffected}
                onChange={(e) => updateParam('overviewAffected', e.currentTarget.checked)}
                size="sm"
              />
            )}
            
            <Text size="sm" c="dimmed">
              {filteredIndices.length} of {indices.length}
            </Text>
          </Group>
        </Group>
      </Group>

      {/* Summary stats */}
      <Group gap="md">
        <Text size="sm">
          <Text component="span" fw={700}>{nodes.length}</Text> nodes
        </Text>
        <Text size="sm">
          <Text component="span" fw={700}>{filteredIndices.length}</Text> indices
        </Text>
        <Text size="sm">
          <Text component="span" fw={700}>{shards.length}</Text> shards
        </Text>
        {unassignedShards.length > 0 && (
          <Badge color="red" variant="filled">
            {unassignedShards.length} unassigned
          </Badge>
        )}
      </Group>

      {/* Shard allocation grid */}
      <ScrollArea>
        <div style={{ minWidth: '800px' }}>
          <Table striped withTableBorder withColumnBorders>
            <Table.Thead>
              <Table.Tr>
                <Table.Th style={{ width: '120px', minWidth: '120px', maxWidth: '120px', position: 'sticky', left: 0, backgroundColor: 'var(--mantine-color-body)', zIndex: 1 }}>
                  Node
                </Table.Th>
                {paginatedIndices.map((index) => (
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
                <Table.Tr style={{ backgroundColor: 'var(--mantine-color-red-0)' }}>
                  <Table.Td style={{ width: '120px', minWidth: '120px', maxWidth: '120px', position: 'sticky', left: 0, backgroundColor: 'var(--mantine-color-red-0)', zIndex: 1 }}>
                    <Stack gap={2}>
                      <Text size="xs" fw={700} c="red">
                        Unassigned
                      </Text>
                      <Badge size="xs" color="red" variant="filled">
                        {unassignedShards.length}
                      </Badge>
                    </Stack>
                  </Table.Td>
                  {paginatedIndices.map((index) => {
                    const indexUnassigned = unassignedByIndex[index.name] || [];
                    
                    return (
                      <Table.Td 
                        key={`unassigned-${index.name}`} 
                        style={{ 
                          padding: '4px', 
                          textAlign: 'center', 
                          backgroundColor: getIndexBackgroundColor(index.health)
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
                                  onClick={() => handleShardClick(shard)}
                                >
                                  {shard.shard}
                                </div>
                              </Tooltip>
                            ))}
                          </Group>
                        ) : (
                          <Text size="xs" c="dimmed">-</Text>
                        )}
                      </Table.Td>
                    );
                  })}
                </Table.Tr>
              )}
              
              {/* Node rows */}
              {nodes.map((node) => {
                const nodeShards = shardsByNodeAndIndex.get(node.name);
                
                return (
                  <Table.Tr key={node.id}>
                    <Table.Td style={{ width: '120px', minWidth: '120px', maxWidth: '120px', position: 'sticky', left: 0, backgroundColor: 'var(--mantine-color-body)', zIndex: 1 }}>
                      <Stack gap={4}>
                        <Group gap={4}>
                          <Text size="xs" fw={500} truncate="end" title={node.name}>
                            {node.name}
                          </Text>
                        </Group>
                        <Text size="xs" c="dimmed" truncate="end" title={node.ip}>
                          {node.ip}
                        </Text>
                        {expandedView && (
                          <>
                            <Group gap={4} wrap="wrap">
                              {node.roles.map((role) => (
                                <Badge key={role} size="xs" variant="light" color="gray">
                                  {role}
                                </Badge>
                              ))}
                            </Group>
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
                    {paginatedIndices.map((index) => {
                      const indexShards = nodeShards?.get(index.name) || [];
                      
                      return (
                        <Table.Td 
                          key={`${node.id}-${index.name}`} 
                          style={{ 
                            padding: '4px', 
                            textAlign: 'center',
                            backgroundColor: getIndexBackgroundColor(index.health)
                          }}
                        >
                          {indexShards.length > 0 ? (
                            <Group gap={2} justify="center" wrap="wrap">
                              {indexShards.map((shard, idx) => (
                                <Tooltip
                                  key={`${shard.shard}-${shard.primary}-${idx}`}
                                  label={
                                    <div>
                                      <div>Shard: {shard.shard}</div>
                                      <div>Type: {shard.primary ? 'Primary' : 'Replica'}</div>
                                      <div>State: {shard.state}</div>
                                      <div>Node: {shard.node || 'N/A'}</div>
                                      {shard.docs !== undefined && shard.docs !== null && <div>Docs: {shard.docs.toLocaleString()}</div>}
                                      {shard.store !== undefined && shard.store !== null && <div>Size: {formatBytes(shard.store)}</div>}
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
                                      backgroundColor: shard.state === 'STARTED' 
                                        ? (shard.primary ? 'var(--mantine-color-green-6)' : 'var(--mantine-color-green-7)')
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
                                      cursor: 'pointer',
                                    }}
                                    onClick={() => handleShardClick(shard)}
                                  >
                                    {shard.shard}
                                  </div>
                                </Tooltip>
                              ))}
                            </Group>
                          ) : (
                            <Text size="xs" c="dimmed">-</Text>
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
      {filteredIndices.length > pageSize && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredIndices.length}
          onPageChange={handleOverviewPageChange}
          onPageSizeChange={handleOverviewPageSizeChange}
        />
      )}
    </Stack>
  );
}



/**
 * ShardsList component displays detailed shard information in table format with filtering
 * Requirements: 4.8, 31.7
 */
function ShardsList({
  shards,
  loading,
  error,
}: {
  shards?: ShardInfo[];
  loading: boolean;
  error: Error | null;
}) {
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedShard, setSelectedShard] = useState<ShardInfo | null>(null);
  
  // Get filters from URL
  const searchQuery = searchParams.get('shardsSearch') || '';
  const nodeFilter = searchParams.get('nodeFilter') || '';
  const selectedStates = searchParams.get('shardStates')?.split(',').filter(Boolean) || [];
  const showPrimaryOnly = searchParams.get('primaryOnly') === 'true';
  const showReplicaOnly = searchParams.get('replicaOnly') === 'true';
  
  // Initialize search with nodeFilter if present
  useEffect(() => {
    if (nodeFilter && !searchQuery) {
      const params = new URLSearchParams(searchParams);
      params.set('shardsSearch', nodeFilter);
      params.delete('nodeFilter'); // Remove nodeFilter after applying it
      setSearchParams(params, { replace: true });
    }
  }, [nodeFilter, searchQuery, searchParams, setSearchParams]);
  
  // Pagination state
  const currentPage = parseInt(searchParams.get('shardsPage') || '1', 10);
  const pageSize = parseInt(searchParams.get('shardsPageSize') || '100', 10);
  
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
  const updateFilters = (newSearch?: string, newStates?: string[], newPrimaryOnly?: boolean, newReplicaOnly?: boolean) => {
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
    
    if (newPrimaryOnly !== undefined) {
      if (newPrimaryOnly) {
        params.set('primaryOnly', 'true');
        params.delete('replicaOnly');
      } else {
        params.delete('primaryOnly');
      }
    }
    
    if (newReplicaOnly !== undefined) {
      if (newReplicaOnly) {
        params.set('replicaOnly', 'true');
        params.delete('primaryOnly');
      } else {
        params.delete('replicaOnly');
      }
    }
    
    setSearchParams(params);
  };

  // Filter shards - use searchQuery directly, not debounced, for immediate filtering
  const filteredShards = shards?.filter((shard) => {
    const matchesSearch = shard.index.toLowerCase().includes(searchQuery.toLowerCase()) ||
      shard.node?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesState = selectedStates.length === 0 || selectedStates.includes(shard.state);
    
    const matchesType = (!showPrimaryOnly && !showReplicaOnly) ||
      (showPrimaryOnly && shard.primary) ||
      (showReplicaOnly && !shard.primary);
    
    return matchesSearch && matchesState && matchesType;
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
        Failed to load shards: {error.message}
      </Alert>
    );
  }

  if (!shards || shards.length === 0) {
    return <Text c="dimmed">No shards found</Text>;
  }

  // Group shards by state for visualization
  const shardsByState = (filteredShards || []).reduce((acc, shard) => {
    if (!acc[shard.state]) {
      acc[shard.state] = [];
    }
    acc[shard.state].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>);

  // Pagination
  const totalPages = Math.ceil((filteredShards?.length || 0) / pageSize);
  const paginatedShards = filteredShards?.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <Stack gap="md">
      {/* Filters */}
      <Group wrap="wrap">
        <TextInput
          placeholder="Search by index or node..."
          leftSection={<IconSearch size={16} />}
          value={searchQuery}
          onChange={(e) => updateFilters(e.currentTarget.value, undefined, undefined, undefined)}
          style={{ flex: 1, maxWidth: 300 }}
        />
        
        <MultiSelect
          placeholder="State"
          data={['STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED']}
          value={selectedStates}
          onChange={(values) => updateFilters(undefined, values, undefined, undefined)}
          clearable
          style={{ maxWidth: 250 }}
        />
        
        <Group gap="md">
          <Checkbox
            label="Primary only"
            checked={showPrimaryOnly}
            onChange={(e) => updateFilters(undefined, undefined, e.currentTarget.checked, undefined)}
            size="sm"
          />
          <Checkbox
            label="Replica only"
            checked={showReplicaOnly}
            onChange={(e) => updateFilters(undefined, undefined, undefined, e.currentTarget.checked)}
            size="sm"
          />
        </Group>
      </Group>

      {/* Shard state summary */}
      <Grid>
        {Object.entries(shardsByState).map(([state, stateShards]) => (
          <Grid.Col key={state} span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="md">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">{state}</Text>
                <Text size="xl" fw={700}>{stateShards.length}</Text>
              </Stack>
            </Card>
          </Grid.Col>
        ))}
      </Grid>

      {filteredShards && filteredShards.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          No shards match your filters
        </Text>
      ) : (
        <ScrollArea>
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
                      <Text size="sm">{shard.index}</Text>
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
                      <Badge
                        size="sm"
                        color={
                          shard.state === 'STARTED'
                            ? 'green'
                            : shard.state === 'UNASSIGNED'
                            ? 'red'
                            : 'yellow'
                        }
                      >
                        {shard.state}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">{shard.node || 'N/A'}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {shard.docs !== undefined && shard.docs !== null ? shard.docs.toLocaleString() : 'N/A'}
                      </Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm">
                        {shard.store !== undefined && shard.store !== null ? formatBytes(shard.store) : 'N/A'}
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        </ScrollArea>
      )}
      
      {/* Pagination */}
      {filteredShards && filteredShards.length > pageSize && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={filteredShards.length}
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
}
