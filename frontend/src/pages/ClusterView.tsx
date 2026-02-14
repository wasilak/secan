import { useState } from 'react';
import {
  Container,
  Title,
  Text,
  Card,
  Group,
  Stack,
  Badge,
  Grid,
  Loader,
  Alert,
  Tabs,
  Table,
  Progress,
  ScrollArea,
  Button,
  Menu,
  ActionIcon,
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle, IconPlus, IconSettings, IconMap, IconDots } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { usePreferences } from '../hooks/usePreferences';
import { IndexOperations } from '../components/IndexOperations';
import type { NodeInfo, IndexInfo, ShardInfo, HealthStatus } from '../types/api';

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
  const { preferences } = usePreferences();
  const [activeTab, setActiveTab] = useState<string | null>('overview');

  // Fetch cluster statistics with auto-refresh
  const {
    data: stats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['cluster', id, 'stats'],
    queryFn: () => apiClient.getClusterStats(id!),
    refetchInterval: preferences.refreshInterval,
    enabled: !!id,
  });

  // Fetch nodes with auto-refresh
  const {
    data: nodes,
    isLoading: nodesLoading,
    error: nodesError,
  } = useQuery({
    queryKey: ['cluster', id, 'nodes'],
    queryFn: () => apiClient.getNodes(id!),
    refetchInterval: preferences.refreshInterval,
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
    refetchInterval: preferences.refreshInterval,
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
    refetchInterval: preferences.refreshInterval,
    enabled: !!id,
  });

  if (!id) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID is required
        </Alert>
      </Container>
    );
  }

  if (statsLoading) {
    return (
      <Container size="xl">
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (statsError) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load cluster information: {(statsError as Error).message}
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Title order={1}>
            {stats?.clusterName || id}
          </Title>
          <Text size="sm" c="dimmed">
            Cluster Overview
          </Text>
        </div>
        <Group>
          <Badge size="lg" color={getHealthColor(stats?.health || 'red')}>
            {stats?.health?.toUpperCase() || 'UNKNOWN'}
          </Badge>
        </Group>
      </Group>

      {/* Cluster Statistics Cards */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Nodes</Text>
              <Text size="xl" fw={700}>{stats?.numberOfNodes || 0}</Text>
              <Text size="xs" c="dimmed">
                {stats?.numberOfDataNodes || 0} data nodes
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Indices</Text>
              <Text size="xl" fw={700}>{stats?.numberOfIndices || 0}</Text>
              <Text size="xs" c="dimmed">
                {stats?.numberOfDocuments?.toLocaleString() || 0} documents
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Shards</Text>
              <Text size="xl" fw={700}>{stats?.activeShards || 0}</Text>
              <Text size="xs" c="dimmed">
                {stats?.activePrimaryShards || 0} primary
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Unassigned</Text>
              <Text size="xl" fw={700} c={stats?.unassignedShards ? 'red' : undefined}>
                {stats?.unassignedShards || 0}
              </Text>
              <Text size="xs" c="dimmed">
                {stats?.relocatingShards || 0} relocating
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Memory and Disk Usage */}
      {(stats?.memoryTotal || stats?.diskTotal) && (
        <Grid mb="md">
          {stats?.memoryTotal && (
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Card shadow="sm" padding="lg">
                <Stack gap="xs">
                  <Text size="sm" c="dimmed">Memory Usage</Text>
                  <Progress
                    value={formatPercent(stats.memoryUsed || 0, stats.memoryTotal)}
                    color={formatPercent(stats.memoryUsed || 0, stats.memoryTotal) > 90 ? 'red' : 'blue'}
                    size="lg"
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
                    color={formatPercent(stats.diskUsed || 0, stats.diskTotal) > 90 ? 'red' : 'blue'}
                    size="lg"
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

      {/* Tabs for Nodes, Indices, and Shards */}
      <Card shadow="sm" padding="lg">
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="overview">Overview</Tabs.Tab>
            <Tabs.Tab value="nodes">Nodes ({nodes?.length || 0})</Tabs.Tab>
            <Tabs.Tab value="indices">Indices ({indices?.length || 0})</Tabs.Tab>
            <Tabs.Tab value="shards">Shards ({shards?.length || 0})</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="overview" pt="md">
            <Stack gap="md">
              <Text>
                This cluster has {stats?.numberOfNodes || 0} nodes with {stats?.activeShards || 0} active shards
                across {stats?.numberOfIndices || 0} indices.
              </Text>
              {stats?.unassignedShards ? (
                <Alert icon={<IconAlertCircle size={16} />} title="Warning" color="yellow">
                  There are {stats.unassignedShards} unassigned shards in this cluster.
                </Alert>
              ) : null}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="nodes" pt="md">
            <NodesList nodes={nodes} loading={nodesLoading} error={nodesError} />
          </Tabs.Panel>

          <Tabs.Panel value="indices" pt="md">
            <IndicesList indices={indices} loading={indicesLoading} error={indicesError} />
          </Tabs.Panel>

          <Tabs.Panel value="shards" pt="md">
            <ShardsList shards={shards} loading={shardsLoading} error={shardsError} />
          </Tabs.Panel>
        </Tabs>
      </Card>
    </Container>
  );
}

/**
 * NodesList component displays the list of nodes
 * Requirements: 4.6, 14.1, 14.2, 14.3, 14.4, 14.5
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

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
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
    <ScrollArea>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Name</Table.Th>
            <Table.Th>Roles</Table.Th>
            <Table.Th>Heap Usage</Table.Th>
            <Table.Th>Disk Usage</Table.Th>
            <Table.Th>CPU</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {nodes.map((node) => (
            <Table.Tr
              key={node.id}
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/cluster/${id}/nodes/${node.id}`)}
            >
              <Table.Td>
                <Text size="sm" fw={500}>{node.name}</Text>
                {node.ip && <Text size="xs" c="dimmed">{node.ip}</Text>}
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  {node.roles.map((role) => (
                    <Badge key={role} size="sm" variant="light">
                      {role}
                    </Badge>
                  ))}
                </Group>
              </Table.Td>
              <Table.Td>
                <Stack gap={4}>
                  <Progress
                    value={formatPercent(node.heapUsed, node.heapMax)}
                    color={formatPercent(node.heapUsed, node.heapMax) > 90 ? 'red' : 'blue'}
                    size="sm"
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
                    color={formatPercent(node.diskUsed, node.diskTotal) > 90 ? 'red' : 'blue'}
                    size="sm"
                  />
                  <Text size="xs" c="dimmed">
                    {formatBytes(node.diskUsed)} / {formatBytes(node.diskTotal)}
                  </Text>
                </Stack>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{node.cpuPercent !== undefined ? `${node.cpuPercent}%` : 'N/A'}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}

/**
 * IndicesList component displays the list of indices
 * Requirements: 4.7, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 6.1, 7.1, 8.1
 */
function IndicesList({
  indices,
  loading,
  error,
}: {
  indices?: IndexInfo[];
  loading: boolean;
  error: Error | null;
}) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
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

  return (
    <Stack gap="md">
      <Group justify="flex-end">
        {id && (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={() => navigate(`/cluster/${id}/indices/create`)}
          >
            Create Index
          </Button>
        )}
      </Group>

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
              <Table.Th>Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {indices.map((index) => (
              <Table.Tr key={index.name}>
                <Table.Td>
                  <Text size="sm" fw={500}>{index.name}</Text>
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
                    {index.primaryShards}p / {index.replicaShards}r
                  </Text>
                </Table.Td>
                <Table.Td>
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
                          onClick={() => navigate(`/cluster/${id}/indices/${index.name}/settings`)}
                        >
                          Settings
                        </Menu.Item>
                        <Menu.Item
                          leftSection={<IconMap size={14} />}
                          onClick={() => navigate(`/cluster/${id}/indices/${index.name}/mappings`)}
                        >
                          Mappings
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  </Group>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
}

/**
 * ShardsList component displays shard allocation visualization
 * Requirements: 4.8
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
  if (loading) {
    return (
      <Group justify="center" py="xl">
        <Loader />
      </Group>
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
  const shardsByState = shards.reduce((acc, shard) => {
    if (!acc[shard.state]) {
      acc[shard.state] = [];
    }
    acc[shard.state].push(shard);
    return acc;
  }, {} as Record<string, ShardInfo[]>);

  return (
    <Stack gap="md">
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

      {/* Detailed shard list */}
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
            {shards.slice(0, 100).map((shard, idx) => (
              <Table.Tr key={`${shard.index}-${shard.shard}-${idx}`}>
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
                  <Text size="sm">{shard.docs?.toLocaleString() || 'N/A'}</Text>
                </Table.Td>
                <Table.Td>
                  <Text size="sm">{shard.store ? formatBytes(shard.store) : 'N/A'}</Text>
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {shards.length > 100 && (
          <Text size="sm" c="dimmed" ta="center" mt="md">
            Showing first 100 of {shards.length} shards
          </Text>
        )}
      </ScrollArea>
    </Stack>
  );
}
