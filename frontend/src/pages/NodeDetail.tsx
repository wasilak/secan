import {
  Title,
  Text,
  Card,
  Group,
  Stack,
  Badge,
  Grid,
  Table,
  ScrollArea,
  Button,
  ThemeIcon,
  Anchor,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  IconArrowLeft,
  IconActivity,
  IconExternalLink,
} from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { useWatermarks } from '../hooks/useWatermarks';
import { MasterIndicator } from '../components/MasterIndicator';
import { NodeCharts } from '../components/NodeCharts';
import { getRoleIcon } from '../components/RoleIcons';
import { useSparklineData } from '../hooks/useSparklineData';
import { formatRate, formatBytesOptional, formatPercent, formatNumber } from '../utils/formatters';
import { NodeDetailSkeleton } from '../components/LoadingSkeleton';
import { StatsCard } from '../components/charts/StatsCard';
import { ProgressWithLabel } from '../components/ProgressWithLabel';
import { ErrorAlert } from '../components/ErrorAlert';
import type { NodeDetailStats, ThreadPoolStats } from '../types/api';
import type { DataPoint } from '../hooks/useSparklineData';

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
  const location = useLocation();
  const refreshInterval = useRefreshInterval();

  // Get current page/route as reset key for sparkline data
  // This ensures data resets when navigating away from this page
  const resetKey = `node-${nodeId}`;

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

  // Track historical data for charts
  // Pass resetKey so data resets when navigating away from this page
  // Request timestamps for proper time-series charts
  const heapHistory = useSparklineData(
    nodeStats?.heapPercent,
    50, // Keep last 50 data points
    resetKey,
    true // withTimestamps
  ) as DataPoint[];

  const diskHistory = useSparklineData(nodeStats?.diskPercent, 50, resetKey, true) as DataPoint[];

  const cpuHistory = useSparklineData(nodeStats?.cpuPercent, 50, resetKey, true) as DataPoint[];

  const loadHistory = useSparklineData(
    nodeStats?.loadAverage?.[0], // Use 1-minute load average
    50,
    resetKey,
    true
  ) as DataPoint[];

  if (!clusterId || !nodeId) {
    return (
      <FullWidthContainer>
        <ErrorAlert message="Cluster ID and Node ID are required" />
      </FullWidthContainer>
    );
  }

  if (isLoading) {
    return <NodeDetailSkeleton />;
  }

  if (error) {
    return (
      <FullWidthContainer>
        <ErrorAlert message={`Failed to load node statistics: ${(error as Error).message}`} />
      </FullWidthContainer>
    );
  }

  if (!nodeStats) {
    return (
      <FullWidthContainer>
        <ErrorAlert message="Node statistics not found" />
      </FullWidthContainer>
    );
  }

  return (
    <FullWidthContainer>
      {/* Node Header Card */}
      <Card shadow="sm" padding="lg" mb="md">
        <Group justify="space-between">
          <div>
            <Group gap="xs" mb="xs">
              <Button
                variant="subtle"
                leftSection={<IconArrowLeft size={16} />}
                onClick={() => navigate(`/cluster/${clusterId}?tab=nodes${location.search ? '&' + location.search.slice(1) : ''}`)}
              >
                Back to Nodes List
              </Button>
            </Group>
            <Group gap="xs" align="center">
              <MasterIndicator
                isMaster={nodeStats.isMaster}
                isMasterEligible={nodeStats.isMasterEligible}
                size="lg"
                showTooltip={true}
              />
              <Title order={1}>{nodeStats.name}</Title>
            </Group>
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
            <div>
              <Text size="sm" c="dimmed" mb="xs">
                Roles
              </Text>
              <Group gap="md">
                {nodeStats.roles.map((role) => {
                  const roleInfo = getRoleIcon(role);
                  const Icon = roleInfo.icon;
                  return (
                    <Group key={role} gap={4}>
                      <Icon size={16} color={`var(--mantine-color-${roleInfo.color}-6)`} />
                      <Text size="sm">{roleInfo.label}</Text>
                    </Group>
                  );
                })}
              </Group>
            </div>
          )}
        </Group>
      </Card>

      {/* Node Information Cards */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
          <StatsCard
            title="ES Version"
            value={nodeStats.version || 'N/A'}
            color="blue"
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
          <StatsCard
            title="JVM Version"
            value={nodeStats.jvmVersion || 'N/A'}
            color="grape"
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
          <StatsCard
            title="Uptime"
            value={nodeStats.uptime || 'N/A'}
            color="teal"
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
          <StatsCard
            title="CPU Usage"
            value={
              nodeStats.cpuPercent !== undefined && !isNaN(nodeStats.cpuPercent)
                ? `${formatNumber(nodeStats.cpuPercent, 1)}%`
                : 'N/A'
            }
            color="green"
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, sm: 6, md: 2.4 }}>
          <Card shadow="sm" padding="lg" h="100%">
            <Stack gap="xs">
              <Group gap="xs">
                <ThemeIcon size="sm" variant="light" color="orange">
                  <IconActivity size={16} />
                </ThemeIcon>
                <Text size="sm" c="dimmed">
                  Load Average
                </Text>
              </Group>
              {nodeStats.loadAverage &&
              Array.isArray(nodeStats.loadAverage) &&
              nodeStats.loadAverage.length >= 3 ? (
                <Group gap="xs">
                  <div>
                    <Text size="xs" c="dimmed">
                      1m
                    </Text>
                    <Text size="sm" fw={700}>
                      {formatNumber(nodeStats.loadAverage[0], 2)}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      5m
                    </Text>
                    <Text size="sm" fw={700}>
                      {formatNumber(nodeStats.loadAverage[1], 2)}
                    </Text>
                  </div>
                  <div>
                    <Text size="xs" c="dimmed">
                      15m
                    </Text>
                    <Text size="sm" fw={700}>
                      {formatNumber(nodeStats.loadAverage[2], 2)}
                    </Text>
                  </div>
                </Group>
              ) : (
                <Text size="lg" fw={700}>
                  N/A
                </Text>
              )}
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Memory and Disk Usage */}
      <Grid mb="md">
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            {nodeStats.heapPercent !== undefined && !isNaN(nodeStats.heapPercent) ? (
              <ProgressWithLabel
                label="Heap Memory Usage"
                value={nodeStats.heapPercent}
                color={getColor(nodeStats.heapPercent)}
                description={`${formatBytesOptional(nodeStats.heapUsed)} / ${formatBytesOptional(nodeStats.heapMax)} (${formatPercent(nodeStats.heapPercent)}%)`}
              />
            ) : (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Heap Memory Usage
                </Text>
                <Text size="xs" c="dimmed">
                  N/A
                </Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            {nodeStats.diskPercent !== undefined && !isNaN(nodeStats.diskPercent) ? (
              <ProgressWithLabel
                label="Disk Usage"
                value={nodeStats.diskPercent}
                color={getColor(nodeStats.diskPercent)}
                description={`${formatBytesOptional(nodeStats.diskUsed)} / ${formatBytesOptional(nodeStats.diskTotal)} (${formatPercent(nodeStats.diskPercent)}%)`}
              />
            ) : (
              <Stack gap="xs">
                <Text size="sm" fw={500}>
                  Disk Usage
                </Text>
                <Text size="xs" c="dimmed">
                  N/A
                </Text>
              </Stack>
            )}
          </Card>
        </Grid.Col>
      </Grid>

      {/* Performance Metrics - Time Series Charts */}
      <Card shadow="sm" padding="lg" mb="md">
        <Stack gap="md">
          <Title order={3}>Performance Metrics</Title>
          <NodeCharts
            heapHistory={heapHistory}
            diskHistory={diskHistory}
            cpuHistory={cpuHistory}
            loadHistory={loadHistory}
          />
        </Stack>
      </Card>

      {/* Data Node Section - Only show for data nodes */}
      {nodeStats.roles?.includes('data') && (
        <Card shadow="sm" padding="lg" mb="md">
          <Stack gap="md">
            <Group justify="space-between" align="center">
              <Title order={3}>Data Node Statistics</Title>
              <Badge size="lg" variant="light" color="blue">
                Data Node
              </Badge>
            </Group>

            {/* Shard Statistics Summary */}
            {nodeStats.shards && (
              <>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <StatsCard
                      title="Total Shards"
                      value={nodeStats.shards.total}
                      color="gray"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <StatsCard
                      title="Primary Shards"
                      value={nodeStats.shards.primary}
                      color="blue"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 4 }}>
                    <StatsCard
                      title="Replica Shards"
                      value={nodeStats.shards.replica}
                      color="gray"
                    />
                  </Grid.Col>
                </Grid>

                {/* Link to Shards Tab */}
                <Card withBorder>
                  <Group justify="space-between" align="center">
                    <div>
                      <Text size="sm" fw={500} mb={4}>
                        View Allocated Shards
                      </Text>
                      <Text size="xs" c="dimmed">
                        See all {nodeStats.shards.total} shards allocated to this node in the
                        cluster shards view
                      </Text>
                    </div>
                    <Anchor
                      href={`/cluster/${clusterId}?tab=shards&nodeFilter=${encodeURIComponent(nodeStats.name)}`}
                      onClick={(e) => {
                        e.preventDefault();
                        navigate(
                          `/cluster/${clusterId}?tab=shards&nodeFilter=${encodeURIComponent(nodeStats.name)}`
                        );
                      }}
                    >
                      <Button variant="light" rightSection={<IconExternalLink size={16} />}>
                        View Shards
                      </Button>
                    </Anchor>
                  </Group>
                </Card>
              </>
            )}

            {/* Indexing Metrics */}
            {nodeStats.indexing && (
              <div>
                <Title order={4} mb="sm">
                  Indexing Statistics
                </Title>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Documents Indexed"
                      value={nodeStats.indexing.indexTotal.toLocaleString()}
                      subtitle={`Rate: ${formatRate(
                        nodeStats.indexing.indexTotal,
                        nodeStats.indexing.indexTimeInMillis
                      )}`}
                      color="blue"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Indexing Time"
                      value={`${(nodeStats.indexing.indexTimeInMillis / 1000).toFixed(2)}s`}
                      subtitle={`Current: ${nodeStats.indexing.indexCurrent}`}
                      color="cyan"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Index Failures"
                      value={nodeStats.indexing.indexFailed.toLocaleString()}
                      color={nodeStats.indexing.indexFailed > 0 ? 'red' : 'gray'}
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Documents Deleted"
                      value={nodeStats.indexing.deleteTotal.toLocaleString()}
                      subtitle={`Time: ${(nodeStats.indexing.deleteTimeInMillis / 1000).toFixed(2)}s`}
                      color="orange"
                    />
                  </Grid.Col>
                </Grid>
              </div>
            )}

            {/* Search Metrics */}
            {nodeStats.search && (
              <div>
                <Title order={4} mb="sm">
                  Search Statistics
                </Title>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <StatsCard
                      title="Query Count"
                      value={nodeStats.search.queryTotal.toLocaleString()}
                      subtitle={`Rate: ${formatRate(
                        nodeStats.search.queryTotal,
                        nodeStats.search.queryTimeInMillis
                      )}`}
                      color="violet"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <StatsCard
                      title="Query Time"
                      value={`${(nodeStats.search.queryTimeInMillis / 1000).toFixed(2)}s`}
                      subtitle={`Current: ${nodeStats.search.queryCurrent}`}
                      color="indigo"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 4 }}>
                    <StatsCard
                      title="Fetch Count"
                      value={nodeStats.search.fetchTotal.toLocaleString()}
                      subtitle={`Time: ${(nodeStats.search.fetchTimeInMillis / 1000).toFixed(2)}s`}
                      color="grape"
                    />
                  </Grid.Col>
                </Grid>
              </div>
            )}

            {/* File System Information */}
            {nodeStats.fs && (
              <div>
                <Title order={4} mb="sm">
                  File System
                </Title>
                <Grid>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Total"
                      value={formatBytesOptional(nodeStats.fs.total)}
                      color="teal"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Available"
                      value={formatBytesOptional(nodeStats.fs.available)}
                      color="green"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <StatsCard
                      title="Used"
                      value={formatBytesOptional(nodeStats.fs.used)}
                      color="orange"
                    />
                  </Grid.Col>
                  <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                    <Card shadow="sm" padding="lg" h="100%">
                      <Stack gap="xs">
                        <Text size="sm" c="dimmed">
                          Path
                        </Text>
                        <Text size="sm" style={{ wordBreak: 'break-all' }}>
                          {nodeStats.fs.path}
                        </Text>
                        <Text size="xs" c="dimmed">
                          Type: {nodeStats.fs.type}
                        </Text>
                      </Stack>
                    </Card>
                  </Grid.Col>
                </Grid>
              </div>
            )}
          </Stack>
        </Card>
      )}

      {/* Thread Pool Statistics */}
      <Card shadow="sm" padding="lg">
        <Stack gap="md">
          <Title order={3}>Thread Pool Statistics</Title>
          <Text size="sm" c="dimmed">
            Thread pool statistics show the current state of various thread pools in the node. Queue
            sizes indicate pending work, and rejected counts show when pools are overloaded.
          </Text>

          {nodeStats.threadPools && Object.keys(nodeStats.threadPools).length > 0 ? (
            <ScrollArea w="100%">
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
                  {Object.entries(nodeStats.threadPools)
                    .sort(([nameA], [nameB]) => nameA.localeCompare(nameB))
                    .map(([poolName, stats]) => (
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
    </FullWidthContainer>
  );
}

/**
 * ThreadPoolRow component displays a single thread pool's statistics
 */
function ThreadPoolRow({ poolName, stats }: { poolName: string; stats: ThreadPoolStats }) {
  // Safe value extraction with fallbacks
  const threads = stats?.threads ?? 0;
  const active = stats?.active ?? 0;
  const queue = stats?.queue ?? 0;
  const largest = stats?.largest ?? 0;
  const completed = stats?.completed ?? 0;
  const rejected = stats?.rejected ?? 0;

  // Highlight pools with high queue sizes or rejections
  const hasHighQueue = queue > 100;
  const hasRejections = rejected > 0;
  const rowBg = hasRejections
    ? 'var(--mantine-color-red-light)'
    : hasHighQueue
      ? 'var(--mantine-color-yellow-light)'
      : undefined;

  return (
    <Table.Tr style={{ backgroundColor: rowBg }}>
      <Table.Td>
        <Text size="sm" fw={500}>
          {poolName}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{threads}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{active}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={hasHighQueue ? 700 : undefined} c={hasHighQueue ? 'yellow' : undefined}>
          {queue}
        </Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{largest}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm">{completed.toLocaleString()}</Text>
      </Table.Td>
      <Table.Td>
        <Text size="sm" fw={hasRejections ? 700 : undefined} c={hasRejections ? 'red' : undefined}>
          {rejected.toLocaleString()}
        </Text>
      </Table.Td>
    </Table.Tr>
  );
}
