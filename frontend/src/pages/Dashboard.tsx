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
import { PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer } from 'recharts';
import { apiClient } from '../api/client';
import { HealthStatus } from '../types/api';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useScreenReader } from '../lib/accessibility';
import { useFaviconManager } from '../hooks/useFaviconManager';
import { SortableTable, SortableTableColumn } from '../components/SortableTable';
import { getHealthColor } from '../utils/colors';

/**
 * Simple metric card for dashboard
 */
interface MetricCardProps {
  label: string;
  value: number;
  color?: string;
  subValue?: string;
}

function MetricCard({ label, value, color = 'var(--mantine-color-blue-6)', subValue }: MetricCardProps) {
  return (
    <Card shadow="sm" padding="lg" style={{ flex: 1, minWidth: '150px' }}>
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          {label}
        </Text>
        <Group justify="space-between" align="flex-end">
          <Text size="xl" fw={700} style={{ color }}>
            {value.toLocaleString()}
          </Text>
          {subValue && (
            <Text size="xs" c="dimmed">
              {subValue}
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  );
}

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
  esVersion?: string;
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

  // Fetch list of clusters with caching
  const {
    data: clusters,
    isLoading: clustersLoading,
    error: clustersError,
  } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(),
    refetchInterval: refreshInterval,
    staleTime: 30 * 1000, // Keep data fresh for 30 seconds
    gcTime: 5 * 60 * 1000, // Cache data for 5 minutes (formerly cacheTime)
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
      try {
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
                esVersion: stats.esVersion,
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
      } catch (error) {
        console.error('Failed to fetch cluster stats:', error);
      }
    };

    fetchClusterStats();
  }, [clusters]);

  // Handle cluster row click - navigate to cluster detail view
  const handleClusterClick = (clusterId: string) => {
    navigate(`/cluster/${clusterId}`);
  };

  // Calculate totals
  const totals = clusterSummaries.reduce(
    (acc, cluster) => {
      if (!cluster.id.includes('__total__')) {
        acc.nodes += cluster.nodes;
        acc.shards += cluster.shards;
        acc.indices += cluster.indices;
        acc.documents += cluster.documents;
      }
      return acc;
    },
    { nodes: 0, shards: 0, indices: 0, documents: 0 }
  );

  // Add totals row to display data (but don't include in sorting/filtering)
  const displayData: ClusterSummary[] = [
    ...clusterSummaries.filter((c) => !c.id.includes('__total__')),
    {
      id: '__total__',
      name: 'TOTAL',
      health: 'green' as HealthStatus,
      nodes: totals.nodes,
      shards: totals.shards,
      indices: totals.indices,
      documents: totals.documents,
    },
  ];

  // Define columns for SortableTable
  const columns: SortableTableColumn<ClusterSummary>[] = [
    {
      key: 'name' as keyof ClusterSummary,
      label: 'Cluster Name',
      sortable: true,
      render: (value, row) => (
        <div>
          <Text fw={row.id === '__total__' ? 700 : 500}>
            {value as string}
          </Text>
          {row.error && (
            <Text size="xs" c="dimmed" role="alert">
              {row.error}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'health' as keyof ClusterSummary,
      label: 'Health',
      sortable: true,
      render: (value, row) => {
        // Don't show health for totals row
        if (row.id === '__total__') {
          return <Text c="dimmed">-</Text>;
        }
        return (
          <Badge
            color={getHealthColor(value as HealthStatus | 'unreachable')}
            variant="filled"
            aria-label={`Health status: ${value}`}
          >
            {value as string}
          </Badge>
        );
      },
    },
    {
      key: 'esVersion' as keyof ClusterSummary,
      label: 'Version',
      sortable: true,
      render: (value, row) => {
        if (row.id === '__total__') {
          return <Text c="dimmed">-</Text>;
        }
        return (
          <Text size="sm" c="dimmed">
            {value as string || '-'}
          </Text>
        );
      },
    },
    {
      key: 'nodes' as keyof ClusterSummary,
      label: 'Nodes',
      sortable: true,
    },
    {
      key: 'shards' as keyof ClusterSummary,
      label: 'Shards',
      sortable: true,
    },
    {
      key: 'indices' as keyof ClusterSummary,
      label: 'Indices',
      sortable: true,
    },
    {
      key: 'documents' as keyof ClusterSummary,
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
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <Card shadow="sm" padding="lg" h={200}>
            <Group justify="center" h="100%">
              <RingProgress
                size={100}
                thickness={10}
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

        <Grid.Col span={{ base: 12, sm: 3 }}>
         <Card shadow="sm" padding="lg" h={200}>
           <Group justify="center" h="100%">
             <RingProgress
               size={100}
               thickness={10}
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

        <Grid.Col span={{ base: 12, sm: 3 }}>
         <Card shadow="sm" padding="lg" h={200}>
           <Group justify="center" h="100%">
             <RingProgress
               size={100}
               thickness={10}
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

        {/* Elasticsearch Versions */}
        <Grid.Col span={{ base: 12, sm: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              {(() => {
                // Count versions
                const versionCounts = new Map<string, number>();
                clusterSummaries.forEach((cluster) => {
                  if (cluster.esVersion && cluster.id !== '__total__') {
                    const version = cluster.esVersion;
                    versionCounts.set(version, (versionCounts.get(version) || 0) + 1);
                  }
                });

                if (versionCounts.size === 0) {
                  return (
                    <Center h={200}>
                      <Text size="xs" c="dimmed">
                        No version data
                      </Text>
                    </Center>
                  );
                }

                // Prepare data for pie chart with distinct colors
                const colors = [
                  '#3b82f6', // blue
                  '#10b981', // green
                  '#f59e0b', // amber
                  '#ef4444', // red
                  '#8b5cf6', // purple
                  '#06b6d4', // cyan
                ];
                
                const versionData = Array.from(versionCounts.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([version, count], index) => ({
                    name: version,
                    value: count,
                    color: colors[index % colors.length],
                  }));

                return (
                  <ResponsiveContainer width="100%" height={160}>
                    <PieChart>
                      <Pie
                        data={versionData}
                        cx="50%"
                        cy="45%"
                        innerRadius={28}
                        outerRadius={50}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {versionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Legend wrapperStyle={{ paddingTop: '4px' }} height={24} />
                      <Tooltip formatter={(value: number | undefined) => value ? `${value} cluster${value !== 1 ? 's' : ''}` : '0'} />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })()}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Aggregated Metrics - Total across all clusters */}
      <Group gap="md" wrap="wrap">
        <MetricCard
          label="Total Nodes"
          value={totals.nodes}
          color="var(--mantine-color-blue-6)"
          subValue={`${clusters?.length || 0} cluster${clusters?.length !== 1 ? 's' : ''}`}
        />
        <MetricCard
          label="Total Indices"
          value={totals.indices}
          color="var(--mantine-color-green-6)"
        />
        <MetricCard
          label="Total Documents"
          value={totals.documents}
          color="var(--mantine-color-cyan-6)"
        />
        <MetricCard
          label="Total Shards"
          value={totals.shards}
          color="var(--mantine-color-violet-6)"
        />
      </Group>

      {/* Responsive table with horizontal scroll on mobile */}
      <Box style={{ overflowX: 'auto' }}>
        <SortableTable
          data={displayData}
          columns={columns}
          onRowClick={(row) => {
            // Don't navigate when clicking the totals row
            if (row.id !== '__total__') {
              handleClusterClick(row.id);
            }
          }}
        />
      </Box>
    </Stack>
  );
}
