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
  Table,
  Progress,
  ScrollArea,
  Button,
} from '@mantine/core';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle, IconArrowLeft } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useWatermarks } from '../hooks/useWatermarks';
import type { NodeDetailStats, ThreadPoolStats } from '../types/api';

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
function formatPercent(value: number): number {
  return Math.round(value);
}

/**
 * NodeDetail component displays detailed statistics for a single node.
 * 
 * Features:
 * - Display detailed node statistics
 * - Show thread pool statistics
 * - Show queue sizes
 * - Display JVM version
 * 
 * Requirements: 14.7, 14.8
 */
export function NodeDetail() {
  const { id: clusterId, nodeId } = useParams<{ id: string; nodeId: string }>();
  const navigate = useNavigate();
  const refreshInterval = useRefreshInterval();
  
  // Fetch watermark thresholds for disk/memory coloring
  const { getColor } = useWatermarks(clusterId);

  // Fetch node statistics with auto-refresh
  const {
    data: nodeStats,
    isLoading,
    error,
  } = useQuery<NodeDetailStats>({
    queryKey: ['cluster', clusterId, 'node', nodeId, 'stats'],
    queryFn: () => apiClient.getNodeStats(clusterId!, nodeId!),
    refetchInterval: refreshInterval,
    enabled: !!clusterId && !!nodeId,
  });

  if (!clusterId || !nodeId) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID and Node ID are required
        </Alert>
      </Container>
    );
  }

  if (isLoading) {
    return (
      <Container size="xl">
        <Group justify="center" mt="xl">
          <Loader size="lg" />
        </Group>
      </Container>
    );
  }

  if (error) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load node statistics: {(error as Error).message}
        </Alert>
      </Container>
    );
  }

  if (!nodeStats) {
    return (
      <Container size="xl">
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Node statistics not found
        </Alert>
      </Container>
    );
  }

  return (
    <Container size="xl" py="md">
      <Group justify="space-between" mb="md">
        <div>
          <Group gap="xs" mb="xs">
            <Button
              variant="subtle"
              leftSection={<IconArrowLeft size={16} />}
              onClick={() => navigate(`/cluster/${clusterId}`)}
            >
              Back to Cluster
            </Button>
          </Group>
          <Title order={1}>{nodeStats.name}</Title>
          <Text size="sm" c="dimmed">
            Node ID: {nodeStats.id}
          </Text>
          {nodeStats.ip && (
            <Text size="sm" c="dimmed">
              IP: {nodeStats.ip}
            </Text>
          )}
        </div>
        {nodeStats.roles && nodeStats.roles.length > 0 && (
          <Group>
            {nodeStats.roles.map((role) => (
              <Badge key={role} size="lg" variant="light">
                {role}
              </Badge>
            ))}
          </Group>
        )}
      </Group>

      {/* Node Information Cards */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">Elasticsearch Version</Text>
              <Text size="lg" fw={700}>{nodeStats.version}</Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" c="dimmed">JVM Version</Text>
              <Text size="lg" fw={700}>{nodeStats.jvmVersion}</Text>
            </Stack>
          </Card>
        </Grid.Col>

        {nodeStats.uptime && (
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="lg">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">Uptime</Text>
                <Text size="lg" fw={700}>{nodeStats.uptime}</Text>
              </Stack>
            </Card>
          </Grid.Col>
        )}

        {nodeStats.cpuPercent !== undefined && (
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Card shadow="sm" padding="lg">
              <Stack gap="xs">
                <Text size="sm" c="dimmed">CPU Usage</Text>
                <Text size="lg" fw={700}>{nodeStats.cpuPercent}%</Text>
              </Stack>
            </Card>
          </Grid.Col>
        )}
      </Grid>

      {/* Load Average */}
      {nodeStats.loadAverage && nodeStats.loadAverage.length > 0 && (
        <Card shadow="sm" padding="lg" mb="md">
          <Stack gap="xs">
            <Text size="sm" fw={500}>Load Average</Text>
            <Group gap="xl">
              <div>
                <Text size="xs" c="dimmed">1 min</Text>
                <Text size="lg" fw={700}>{nodeStats.loadAverage[0]?.toFixed(2) || 'N/A'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">5 min</Text>
                <Text size="lg" fw={700}>{nodeStats.loadAverage[1]?.toFixed(2) || 'N/A'}</Text>
              </div>
              <div>
                <Text size="xs" c="dimmed">15 min</Text>
                <Text size="lg" fw={700}>{nodeStats.loadAverage[2]?.toFixed(2) || 'N/A'}</Text>
              </div>
            </Group>
          </Stack>
        </Card>
      )}

      {/* Memory and Disk Usage */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Heap Memory Usage</Text>
              <Progress
                value={nodeStats.heapPercent}
                color={getColor(nodeStats.heapPercent)}
                size="sm"
                radius="xs"
              />
              <Text size="xs" c="dimmed">
                {formatBytes(nodeStats.heapUsed)} / {formatBytes(nodeStats.heapMax)} (
                {formatPercent(nodeStats.heapPercent)}%)
              </Text>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Disk Usage</Text>
              <Progress
                value={nodeStats.diskPercent}
                color={getColor(nodeStats.diskPercent)}
                size="sm"
                radius="xs"
              />
              <Text size="xs" c="dimmed">
                {formatBytes(nodeStats.diskUsed)} / {formatBytes(nodeStats.diskTotal)} (
                {formatPercent(nodeStats.diskPercent)}%)
              </Text>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Thread Pool Statistics */}
      <Card shadow="sm" padding="lg">
        <Stack gap="md">
          <Title order={3}>Thread Pool Statistics</Title>
          <Text size="sm" c="dimmed">
            Thread pool statistics show the current state of various thread pools in the node.
            Queue sizes indicate pending work, and rejected counts show when pools are overloaded.
          </Text>

          {nodeStats.threadPools && Object.keys(nodeStats.threadPools).length > 0 ? (
            <ScrollArea>
              <Table striped highlightOnHover>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Pool Name</Table.Th>
                    <Table.Th>Threads</Table.Th>
                    <Table.Th>Active</Table.Th>
                    <Table.Th>Queue</Table.Th>
                    <Table.Th>Largest</Table.Th>
                    <Table.Th>Completed</Table.Th>
                    <Table.Th>Rejected</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {Object.entries(nodeStats.threadPools).map(([poolName, stats]) => (
                    <ThreadPoolRow key={poolName} poolName={poolName} stats={stats} />
                  ))}
                </Table.Tbody>
              </Table>
            </ScrollArea>
          ) : (
            <Text c="dimmed" ta="center" py="xl">
              No thread pool statistics available
            </Text>
          )}
        </Stack>
      </Card>
    </Container>
  );
}

/**
 * ThreadPoolRow component displays a single thread pool's statistics
 */
function ThreadPoolRow({
  poolName,
  stats,
}: {
  poolName: string;
  stats: ThreadPoolStats;
}) {
  // Highlight pools with high queue sizes or rejections
  const hasHighQueue = stats.queue > 100;
  const hasRejections = stats.rejected > 0;
  const rowBg = hasRejections 
    ? 'var(--mantine-color-red-light)' 
    : hasHighQueue 
    ? 'var(--mantine-color-yellow-light)' 
    : undefined;

  return (
    <Table.Tr style={{ backgroundColor: rowBg }}>
      <Table.Td>
        <Text size="sm" fw={500}>{poolName}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{stats.threads}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{stats.active}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={hasHighQueue ? 700 : undefined} c={hasHighQueue ? 'yellow' : undefined}>
          {stats.queue}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{stats.largest}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{stats.completed.toLocaleString()}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={hasRejections ? 700 : undefined} c={hasRejections ? 'red' : undefined}>
          {stats.rejected.toLocaleString()}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
