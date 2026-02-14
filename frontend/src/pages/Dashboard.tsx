import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Title,
  Table,
  Badge,
  Text,
  Loader,
  Alert,
  Center,
  Stack,
  Group,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRefresh,
  IconChevronUp,
  IconChevronDown,
  IconSelector,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { HealthStatus } from '../types/api';
import { usePreferences } from '../hooks/usePreferences';

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
      >
        <Text fw={500}>{children}</Text>
        {isActive && direction === 'asc' && <IconChevronUp size={14} />}
        {isActive && direction === 'desc' && <IconChevronDown size={14} />}
        {!isActive && <IconSelector size={14} opacity={0.5} />}
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
  const { preferences } = usePreferences();
  const [clusterSummaries, setClusterSummaries] = useState<ClusterSummary[]>([]);
  const [sortColumn, setSortColumn] = useState<SortableColumn | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>(null);

  // Fetch list of clusters
  const {
    data: clusters,
    isLoading: clustersLoading,
    error: clustersError,
  } = useQuery({
    queryKey: ['clusters'],
    queryFn: () => apiClient.getClusters(),
    refetchInterval: preferences.refreshInterval,
  });

  // Fetch health for all clusters
  useEffect(() => {
    if (!clusters || clusters.length === 0) {
      setClusterSummaries([]);
      return;
    }

    const fetchClusterHealth = async () => {
      const summaries = await Promise.all(
        clusters.map(async (cluster): Promise<ClusterSummary> => {
          try {
            const health = await apiClient.getClusterHealth(cluster.id);
            
            // Calculate total documents and indices from health data
            // Note: These would typically come from cluster stats API
            // For now, we'll use placeholder values that should be replaced
            // when the backend implements the full cluster stats endpoint
            return {
              id: cluster.id,
              name: cluster.name,
              health: health.status,
              nodes: health.numberOfNodes,
              shards: health.activeShards,
              indices: 0, // TODO: Get from cluster stats
              documents: 0, // TODO: Get from cluster stats
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

    fetchClusterHealth();

    // Set up auto-refresh interval
    const intervalId = setInterval(fetchClusterHealth, preferences.refreshInterval);

    return () => clearInterval(intervalId);
  }, [clusters, preferences.refreshInterval]);

  // Handle sort column click
  const handleSort = (column: SortableColumn) => {
    if (sortColumn === column) {
      // Cycle through: asc -> desc -> null
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else if (sortDirection === 'desc') {
        setSortDirection(null);
        setSortColumn(null);
      }
    } else {
      setSortColumn(column);
      setSortDirection('asc');
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
      <Container size="xl">
        <Title order={1} mb="md">
          Dashboard
        </Title>
        <Center h={200}>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading clusters...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // Error state
  if (clustersError) {
    return (
      <Container size="xl">
        <Title order={1} mb="md">
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
      </Container>
    );
  }

  // Empty state
  if (!clusters || clusters.length === 0) {
    return (
      <Container size="xl">
        <Title order={1} mb="md">
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
      </Container>
    );
  }

  return (
    <Container size="xl">
      <Group justify="space-between" mb="md">
        <Title order={1}>Dashboard</Title>
        <Group gap="xs">
          <IconRefresh size={16} />
          <Text size="sm" c="dimmed">
            Auto-refresh: {preferences.refreshInterval / 1000}s
          </Text>
        </Group>
      </Group>

      <Table highlightOnHover striped>
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
            >
              <Table.Td>
                <Text fw={500}>{cluster.name}</Text>
                {cluster.error && (
                  <Text size="xs" c="dimmed">
                    {cluster.error}
                  </Text>
                )}
              </Table.Td>
              <Table.Td>
                <Badge color={getHealthColor(cluster.health)} variant="filled">
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
    </Container>
  );
}
