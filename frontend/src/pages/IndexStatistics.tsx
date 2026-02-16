import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Button,
  Stack,
  Group,
  Alert,
  Grid,
  Paper,
  Table,
  Select,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { DetailPageSkeleton } from '../components/LoadingSkeleton';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconAlertCircle, IconRefresh } from '@tabler/icons-react';
import { apiClient } from '../api/client';

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
 * Format milliseconds to human-readable format
 */
function formatTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(2)}m`;
  return `${(ms / 3600000).toFixed(2)}h`;
}

/**
 * Format number with thousands separator
 */
function formatNumber(num: number): string {
  return num.toLocaleString();
}

/**
 * StatCard component for displaying a single statistic
 */
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
}

function StatCard({ title, value, description }: StatCardProps) {
  return (
    <Paper p="md" withBorder>
      <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
        {title}
      </Text>
      <Text size="xl" fw={700} mt="xs">
        {value}
      </Text>
      {description && (
        <Text size="xs" c="dimmed" mt="xs">
          {description}
        </Text>
      )}
    </Paper>
  );
}

/**
 * IndexStatistics component displays detailed index statistics
 * 
 * Features:
 * - Display document count and storage size
 * - Show indexing statistics (operations, time, failures)
 * - Display search statistics (queries, fetches, scrolls)
 * - Show merge, refresh, and flush statistics
 * - Display segment information
 * - Support time range filtering (future enhancement)
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7
 */
export function IndexStatistics() {
  const { id: clusterId, indexName } = useParams<{ id: string; indexName: string }>();
  const navigate = useNavigate();
  const [statsLevel, setStatsLevel] = useState<'total' | 'primaries'>('total');

  // Fetch index statistics
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['cluster', clusterId, 'index', indexName, 'stats'],
    queryFn: async () => {
      if (!clusterId || !indexName) {
        throw new Error('Cluster ID and index name are required');
      }

      return await apiClient.getIndexStats(clusterId, indexName);
    },
    enabled: !!clusterId && !!indexName,
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  if (!clusterId || !indexName) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Cluster ID and index name are required
        </Alert>
      </FullWidthContainer>
    );
  }

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load index statistics: {(error as Error).message}
        </Alert>
      </FullWidthContainer>
    );
  }

  if (!stats) {
    return (
      <FullWidthContainer>
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          No statistics available for this index
        </Alert>
      </FullWidthContainer>
    );
  }

  const currentStats = statsLevel === 'total' ? stats.total : stats.primaries;

  return (
    <FullWidthContainer>
      <Group justify="space-between" mb="md">
        <div>
          <Title order={1}>Index Statistics</Title>
          <Text size="sm" c="dimmed">
            {indexName}
          </Text>
        </div>
        <Group>
          <Select
            value={statsLevel}
            onChange={(value) => setStatsLevel(value as 'total' | 'primaries')}
            data={[
              { value: 'total', label: 'Total (All Shards)' },
              { value: 'primaries', label: 'Primaries Only' },
            ]}
            w={200}
          />
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} />}
            onClick={() => refetch()}
          >
            Refresh
          </Button>
          <Button
            variant="default"
            onClick={() => navigate(`/cluster/${clusterId}`)}
          >
            Back to Cluster
          </Button>
        </Group>
      </Group>

      <Stack gap="md">
        {/* Document and Storage Statistics */}
        <Card shadow="sm" padding="lg">
          <Title order={3} mb="md">
            Documents & Storage
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Document Count"
                value={formatNumber(currentStats.docs.count)}
                description="Total documents in index"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Deleted Documents"
                value={formatNumber(currentStats.docs.deleted)}
                description="Documents marked for deletion"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Storage Size"
                value={formatBytes(currentStats.store.sizeInBytes)}
                description="Total disk space used"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <StatCard
                title="Segments"
                value={formatNumber(currentStats.segments.count)}
                description={`Memory: ${formatBytes(currentStats.segments.memoryInBytes)}`}
              />
            </Grid.Col>
          </Grid>
        </Card>

        {/* Indexing Statistics */}
        <Card shadow="sm" padding="lg">
          <Title order={3} mb="md">
            Indexing Statistics
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Metric</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Total Index Operations</Table.Td>
                <Table.Td>{formatNumber(currentStats.indexing.indexTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Index Time</Table.Td>
                <Table.Td>{formatTime(currentStats.indexing.indexTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Indexing Operations</Table.Td>
                <Table.Td>{formatNumber(currentStats.indexing.indexCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Failed Index Operations</Table.Td>
                <Table.Td>{formatNumber(currentStats.indexing.indexFailed)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Delete Operations</Table.Td>
                <Table.Td>{formatNumber(currentStats.indexing.deleteTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Delete Time</Table.Td>
                <Table.Td>{formatTime(currentStats.indexing.deleteTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Delete Operations</Table.Td>
                <Table.Td>{formatNumber(currentStats.indexing.deleteCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Throttle Time</Table.Td>
                <Table.Td>{formatTime(currentStats.indexing.throttleTimeInMillis)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        {/* Search Statistics */}
        <Card shadow="sm" padding="lg">
          <Title order={3} mb="md">
            Search Statistics
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Metric</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Total Queries</Table.Td>
                <Table.Td>{formatNumber(currentStats.search.queryTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Query Time</Table.Td>
                <Table.Td>{formatTime(currentStats.search.queryTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Average Query Time</Table.Td>
                <Table.Td>
                  {currentStats.search.queryTotal > 0
                    ? formatTime(currentStats.search.queryTimeInMillis / currentStats.search.queryTotal)
                    : '0ms'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Queries</Table.Td>
                <Table.Td>{formatNumber(currentStats.search.queryCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Fetches</Table.Td>
                <Table.Td>{formatNumber(currentStats.search.fetchTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Fetch Time</Table.Td>
                <Table.Td>{formatTime(currentStats.search.fetchTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Fetches</Table.Td>
                <Table.Td>{formatNumber(currentStats.search.fetchCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Scrolls</Table.Td>
                <Table.Td>{formatNumber(currentStats.search.scrollTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Scroll Time</Table.Td>
                <Table.Td>{formatTime(currentStats.search.scrollTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Scrolls</Table.Td>
                <Table.Td>{formatNumber(currentStats.search.scrollCurrent)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        {/* Merge Statistics */}
        <Card shadow="sm" padding="lg">
          <Title order={3} mb="md">
            Merge Statistics
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Metric</Table.Th>
                <Table.Th>Value</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              <Table.Tr>
                <Table.Td>Current Merges</Table.Td>
                <Table.Td>{formatNumber(currentStats.merges.current)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Merge Docs</Table.Td>
                <Table.Td>{formatNumber(currentStats.merges.currentDocs)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Merge Size</Table.Td>
                <Table.Td>{formatBytes(currentStats.merges.currentSizeInBytes)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merges</Table.Td>
                <Table.Td>{formatNumber(currentStats.merges.total)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merge Time</Table.Td>
                <Table.Td>{formatTime(currentStats.merges.totalTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merged Docs</Table.Td>
                <Table.Td>{formatNumber(currentStats.merges.totalDocs)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merged Size</Table.Td>
                <Table.Td>{formatBytes(currentStats.merges.totalSizeInBytes)}</Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Card>

        {/* Refresh and Flush Statistics */}
        <Card shadow="sm" padding="lg">
          <Title order={3} mb="md">
            Refresh & Flush Statistics
          </Title>
          <Grid>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th colSpan={2}>Refresh</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Total Refreshes</Table.Td>
                    <Table.Td>{formatNumber(currentStats.refresh.total)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Total Refresh Time</Table.Td>
                    <Table.Td>{formatTime(currentStats.refresh.totalTimeInMillis)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Average Refresh Time</Table.Td>
                    <Table.Td>
                      {currentStats.refresh.total > 0
                        ? formatTime(currentStats.refresh.totalTimeInMillis / currentStats.refresh.total)
                        : '0ms'}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 6 }}>
              <Table>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th colSpan={2}>Flush</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  <Table.Tr>
                    <Table.Td>Total Flushes</Table.Td>
                    <Table.Td>{formatNumber(currentStats.flush.total)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Total Flush Time</Table.Td>
                    <Table.Td>{formatTime(currentStats.flush.totalTimeInMillis)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Average Flush Time</Table.Td>
                    <Table.Td>
                      {currentStats.flush.total > 0
                        ? formatTime(currentStats.flush.totalTimeInMillis / currentStats.flush.total)
                        : '0ms'}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Grid.Col>
          </Grid>
        </Card>
      </Stack>
    </FullWidthContainer>
  );
}
