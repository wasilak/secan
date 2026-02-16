import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title,
  Table,
  Badge,
  Text,
  Alert,
  Center,
  Stack,
  Group,
  UnstyledButton,
  RingProgress,
  Card,
  Grid,
  Box,
  Skeleton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { HealthStatus } from '../types/api';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useScreenReader } from '../lib/accessibility';
import { useFaviconManager } from '../hooks/useFaviconManager';

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
 * Sort direction
 */
type SortDirection = 'asc' | 'desc' | null;

/**
 * Sortable column keys
 */
type SortableColumn = keyof Pick<
  ClusterSummary,
  'name' | 'health' | 'nodes' | 'shards' | 'indices' | 'documents'
>;

/**
 * Get badge color for health status
 */
function getHealthColor(health: HealthStatus | 'unreachable'): string {
  switch (health) {
    case 'green':
      return 'green';
    case 'yellow':
      return 'yellow';
    case 'red':
      return 'red';
    case 'unreachable':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get numeric value for health status for sorting
 */
function getHealthSortValue(health: HealthStatus | 'unreachable'): number {
  switch (health) {
    case 'green':
      return 3;
    case 'yellow':
      return 2;
    case 'red':
      return 1;
    case 'unreachable':
      return 0;
    default:
      return 0;
  }
}

/**
 * Sort clusters by column
 */
function sortClusters(
  clusters: ClusterSummary[],
  column: SortableColumn,
  direction: SortDirection
): ClusterSummary[] {
  if (!direction) {
    return clusters;
  }

  const sorted = [...clusters].sort((a, b) => {
    let aValue: string | number;
    let bValue: string | number;

    if (column === 'health') {
      aValue = getHealthSortValue(a.health);
      bValue = getHealthSortValue(b.health);
    } else {
      aValue = a[column];
      bValue = b[column];
    }

    if (typeof aValue === 'string' && typeof bValue === 'string') {
      return direction === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    if (typeof aValue === 'number' && typeof bValue === 'number') {
      return direction === 'asc' ? aValue - bValue : bValue - aValue;
    }

    return 0;
  });

  return sorted;
}

/**
 * Table header with sort controls
 */
interface SortableHeaderProps {
  column: SortableColumn;
  currentColumn: SortableColumn | null;
  direction: SortDirection;
  onSort: (column: SortableColumn) => void;
  children: React.ReactNode;
}

function SortableHeader({
  column,
  currentColumn,
  direction,
  onSort,
  children,
}: SortableHeaderProps) {
  const isActive = currentColumn === column;
  const sortLabel = isActive
    ? `Sorted ${direction === 'asc' ? 'ascending' : 'descending'}`
    : 'Not sorted';

  return (
    <Table.Th>
      <UnstyledButton
        onClick={() => onSort(column)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          width: '100%',
        }}
        aria-label={`Sort by ${children}, ${sortLabel}`}
      >
        <Text fw={500}>{children}</Text>
        {isActive && direction === 'asc' && <IconChevronUp size={14} aria-hidden="true" />}
        {isActive && direction === 'desc' && <IconChevronDown size={14} aria-hidden="true" />}
        {!isActive && <IconSelector size={14} opacity={0.5} aria-hidden="true" />}
      </UnstyledButton>
    </Table.Th>
  );
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
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

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

  // Handle sort column click
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
        announce(`Sorted by ${column} descending`);
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
        announce(`Sort removed`);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
      announce(`Sorted by ${column} ascending`);
    }
  };

  // Handle cluster row click - navigate to cluster detail view
  const handleClusterClick = (clusterId: string) => {
    navigate(`/cluster/${clusterId}`);
  };

  // Apply sorting
  const sortedClusters = sortClusters(clusterSummaries, sortColumn!, sortDirection);

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
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="Error loading clusters"
          color="red"
        >
          {clustersError instanceof Error
            ? clustersError.message
            : 'Failed to load cluster list'}
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
        <Alert
          icon={<IconAlertCircle size={16} />}
          title="No clusters configured"
          color="blue"
        >
          No Elasticsearch or OpenSearch clusters are configured. Please check your
          configuration file.
        </Alert>
      </Stack>
    );
  }

  return (
    <Stack gap="md" p="md">
      <Group justify="space-between" wrap="wrap">
        <Title order={1} className="text-responsive-xl">Dashboard</Title>
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
                    value: (sortedClusters.filter(c => c.health === 'green').length / sortedClusters.length) * 100,
                    color: 'green',
                  },
                ]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="xl" fw={700}>
                        {sortedClusters.filter(c => c.health === 'green').length}
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
                    value: (sortedClusters.filter(c => c.health === 'yellow').length / sortedClusters.length) * 100,
                    color: 'yellow',
                  },
                ]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="xl" fw={700}>
                        {sortedClusters.filter(c => c.health === 'yellow').length}
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
                    value: (sortedClusters.filter(c => c.health === 'red').length / sortedClusters.length) * 100,
                    color: 'red',
                  },
                ]}
                label={
                  <Center>
                    <Stack gap={0} align="center">
                      <Text size="xl" fw={700}>
                        {sortedClusters.filter(c => c.health === 'red').length}
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
        <Table 
          highlightOnHover 
          striped 
          role="table" 
          aria-label="Cluster overview table"
          style={{ minWidth: '600px' }}
        >
          <Table.Thead>
            <Table.Tr>
              <SortableHeader
                column="name"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Cluster Name
              </SortableHeader>
              <SortableHeader
                column="health"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Health
              </SortableHeader>
              <SortableHeader
                column="nodes"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Nodes
              </SortableHeader>
              <SortableHeader
                column="shards"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Shards
              </SortableHeader>
              <SortableHeader
                column="indices"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Indices
              </SortableHeader>
              <SortableHeader
                column="documents"
                currentColumn={sortColumn}
                direction={sortDirection}
                onSort={handleSort}
              >
                Documents
              </SortableHeader>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedClusters.map((cluster) => (
              <Table.Tr
                key={cluster.id}
                onClick={() => handleClusterClick(cluster.id)}
                style={{ cursor: 'pointer' }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleClusterClick(cluster.id);
                  }
                }}
                aria-label={`View details for cluster ${cluster.name}`}
              >
                <Table.Td>
                  <Text fw={500}>{cluster.name}</Text>
                  {cluster.error && (
                    <Text size="xs" c="dimmed" role="alert">
                      {cluster.error}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <Badge color={getHealthColor(cluster.health)} variant="filled" aria-label={`Health status: ${cluster.health}`}>
                    {cluster.health}
                  </Badge>
                </Table.Td>
                <Table.Td>{cluster.nodes}</Table.Td>
                <Table.Td>{cluster.shards}</Table.Td>
                <Table.Td>{cluster.indices}</Table.Td>
                <Table.Td>{cluster.documents.toLocaleString()}</Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Box>
    </Stack>
  );
}
