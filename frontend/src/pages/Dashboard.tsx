import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title,
  Badge,
  Text,
  Alert,
  Center,
  Stack,
  Group,
  RingProgress,
  Card,
  Grid,
  Box,
  Skeleton,
} from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { HealthStatus } from '../types/api';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useScreenReader } from '../lib/accessibility';
import { useFaviconManager } from '../hooks/useFaviconManager';
import { SortableTable, SortableTableColumn } from '../components/SortableTable';
import { getHealthColor } from '../utils/colors';

/**
 * Cluster summary combining cluster info and health data
 */
interface ClusterSummary {
  id: string;
  name: string;
  health: HealthStatus | 'unreachable';
  nodes: number;
  shards: number;
  indices: number;
  documents: number;
  error?: string;
}

/**
 * Dashboard component displays an overview of all configured clusters.
 *
 * Features:
 * - Display all clusters in table format
 * - Show cluster health status (green, yellow, red, unreachable)
 * - Display cluster statistics (nodes, shards, indices, documents)
 * - Auto-refresh at configurable intervals
 * - Navigate to cluster detail view on click
 * - Sort clusters by various metrics
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.10, 3.11
 */
export function Dashboard() {
  const navigate = useNavigate();
  const refreshInterval = useRefreshInterval();
  const { announce, announceError } = useScreenReader();
  const [clusterSummaries, setClusterSummaries] = useState<ClusterSummary[]>([]);

  // Always show neutral favicon on clusters list
  // Requirements: 12.1, 12.7, 12.8
  useFaviconManager(null);

  // Fetch list of clusters
  const {
    data: clusters,
    isLoading: clustersLoading,
    error: clustersError,
  } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(),
    refetchInterval: refreshInterval,
  });

  // Announce loading and error states to screen readers
  useEffect(() => {
    if (clustersLoading) {
      announce('Loading clusters');
    } else if (clustersError) {
      announceError('Failed to load cluster list');
    } else if (clusters) {
      announce(`Loaded ${clusters.length} cluster${clusters.length !== 1 ? 's' : ''}`);
    }
  }, [clustersLoading, clustersError, clusters, announce, announceError]);

  // Fetch stats for all clusters
  useEffect(() => {
    if (!clusters || clusters.length === 0) {
      setClusterSummaries([]);
      return;
    }

    const fetchClusterStats = async () => {
      const summaries = await Promise.all(
        clusters.map(async (cluster): Promise<ClusterSummary> => {
          try {
            const stats = await apiClient.getClusterStats(cluster.id);

            return {
              id: cluster.id,
              name: cluster.name,
              health: stats.health,
              nodes: stats.numberOfNodes,
              shards: stats.activeShards,
              indices: stats.numberOfIndices,
              documents: stats.numberOfDocuments,
            };
          } catch (error) {
            // Handle unreachable clusters
            return {
              id: cluster.id,
              name: cluster.name,
              health: 'unreachable',
              nodes: 0,
              shards: 0,
              indices: 0,
              documents: 0,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      setClusterSummaries(summaries);
    };

    fetchClusterStats();
  }, [clusters]);

  // Handle cluster row click - navigate to cluster detail view
  const handleClusterClick = (clusterId: string) => {
    navigate(`/cluster/${clusterId}`);
  };

  // Define columns for SortableTable
  const columns: SortableTableColumn<ClusterSummary>[] = [
    {
      key: 'name',
      label: 'Cluster Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <Text fw={500}>{value as string}</Text>
          {row.error && (
            <Text size="xs" c="dimmed" role="alert">
              {row.error}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'health',
      label: 'Health',
      sortable: true,
      render: (value) => (
        <Badge
          color={getHealthColor(value as HealthStatus | 'unreachable')}
          variant="filled"
          aria-label={`Health status: ${value}`}
        >
          {value as string}
        </Badge>
      ),
    },
    {
      key: 'nodes',
      label: 'Nodes',
      sortable: true,
    },
    {
      key: 'shards',
      label: 'Shards',
      sortable: true,
    },
    {
      key: 'indices',
      label: 'Indices',
      sortable: true,
    },
    {
      key: 'documents',
      label: 'Documents',
      sortable: true,
      render: (value) => (value as number).toLocaleString(),
    },
  ];

  // Loading state
  if (clustersLoading) {
    return (
      <Stack gap="md" p="md">
        <Title order={1} className="text-responsive-xl">
          Dashboard
        </Title>
        <Grid>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={120} radius="md" />
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={120} radius="md" />
            </Card>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 4 }}>
            <Card shadow="sm" padding="lg">
              <Skeleton height={120} radius="md" />
            </Card>
          </Grid.Col>
        </Grid>
        <Stack gap="xs">
          <Skeleton height={40} radius="sm" />
          <Skeleton height={60} radius="sm" />
          <Skeleton height={60} radius="sm" />
          <Skeleton height={60} radius="sm" />
        </Stack>
      </Stack>
    );
  }

  // Error state
  if (clustersError) {
    return (
      <Stack gap="md" p="md">
        <Title order={1} className="text-responsive-xl">
          Dashboard
        </Title>
        <Alert icon={<IconAlertCircle size={16} />} title="Error loading clusters" color="red">
          {clustersError instanceof Error ? clustersError.message : 'Failed to load cluster list'}
        </Alert>
      </Stack>
    );
  }

  // Empty state
  if (!clusters || clusters.length === 0) {
    return (
      <Stack gap="md" p="md">
        <Title order={1} className="text-responsive-xl">
          Dashboard
        </Title>
        <Alert icon={<IconAlertCircle size={16} />} title="No clusters configured" color="blue">
          No Elasticsearch or OpenSearch clusters are configured. Please check your configuration
          file.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="wrap">
        <Title order={1} className="text-responsive-xl">
          Dashboard
        </Title>
      </Group>

      {/* Cluster Health Summary with RingProgress */}
      <Grid>
        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card shadow="sm" padding="lg">
            <Group justify="center">
              <RingProgress
                size={120}
                thickness={12}
                sections={[
                  {
                    value:
                      (clusterSummaries.filter((c) => c.health === 'green').length /
                        clusterSummaries.length) *
                      100,
                    color: 'green',
                  },
                ]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="xl" fw={700}>
                        {clusterSummaries.filter((c) => c.health === 'green').length}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Green
                      </Text>
                    </Stack>
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card shadow="sm" padding="lg">
            <Group justify="center">
              <RingProgress
                size={120}
                thickness={12}
                sections={[
                  {
                    value:
                      (clusterSummaries.filter((c) => c.health === 'yellow').length /
                        clusterSummaries.length) *
                      100,
                    color: 'yellow',
                  },
                ]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="xl" fw={700}>
                        {clusterSummaries.filter((c) => c.health === 'yellow').length}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Yellow
                      </Text>
                    </Stack>
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 4 }}>
          <Card shadow="sm" padding="lg">
            <Group justify="center">
              <RingProgress
                size={120}
                thickness={12}
                sections={[
                  {
                    value:
                      (clusterSummaries.filter((c) => c.health === 'red').length /
                        clusterSummaries.length) *
                      100,
                    color: 'red',
                  },
                ]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="xl" fw={700}>
                        {clusterSummaries.filter((c) => c.health === 'red').length}
                      </Text>
                      <Text size="xs" c="dimmed">
                        Red
                      </Text>
                    </Stack>
                  </Center>
                }
              />
            </Group>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Responsive table with horizontal scroll on mobile */}
      <Box style={{ overflowX: 'auto' }}>
        <SortableTable
          data={clusterSummaries}
          columns={columns}
          onRowClick={(row) => handleClusterClick(row.id)}
        />
      </Box>
    </Stack>
  );
}
