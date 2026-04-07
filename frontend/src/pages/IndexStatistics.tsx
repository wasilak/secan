import { useState } from 'react';
import {
  Title,
  Text,
  Card,
  Button,
  Stack,
  Group,
  Grid,
  Table,
  Select,
} from '@mantine/core';
import { FullWidthContainer } from '../components/FullWidthContainer';
import { PageSkeleton } from '../components/PageSkeleton';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { IconRefresh } from '@tabler/icons-react';
import { apiClient } from '../api/client';
import { queryKeys } from '../utils/queryKeys';
import { getErrorMessage } from '../lib/errorHandling';
import { formatBytes, formatTime, formatNumberWithCommas } from '../utils/formatters';
import { StatsCard } from '../components/charts/StatsCard';
import { ErrorAlert } from '../components/ErrorAlert';

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
  const location = useLocation();
  const [statsLevel, setStatsLevel] = useState<'total' | 'primaries'>('total');

  // Fetch index statistics
  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: queryKeys.cluster(clusterId!).index(indexName!).stats(),
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
        <ErrorAlert message="Cluster ID and index name are required" />
      </FullWidthContainer>
    );
  }

  const loadError = error
    ? new Error(`Failed to load index statistics: ${getErrorMessage(error)}`)
    : undefined;

  if (!stats) {
    return (
      <FullWidthContainer>
        <ErrorAlert message="No statistics available for this index" />
      </FullWidthContainer>
    );
  }

  const currentStats = statsLevel === 'total' ? stats.total : stats.primaries;

  // Provide safe defaults for optional nested groups so the UI can access
  // fields without needing to null-check everywhere. These defaults align
  // with the normalized IndexStats shape produced by apiClient.getIndexStats.
  const segments = currentStats.segments ?? { count: 0, memoryInBytes: 0 };
  const indexing = {
    indexTotal: currentStats.indexing?.indexTotal ?? 0,
    indexTimeInMillis: currentStats.indexing?.indexTimeInMillis ?? 0,
    indexCurrent: currentStats.indexing?.indexCurrent ?? 0,
    indexFailed: currentStats.indexing?.indexFailed ?? 0,
    deleteTotal: currentStats.indexing?.deleteTotal ?? 0,
    deleteTimeInMillis: currentStats.indexing?.deleteTimeInMillis ?? 0,
    deleteCurrent: currentStats.indexing?.deleteCurrent ?? 0,
    throttleTimeInMillis: currentStats.indexing?.throttleTimeInMillis ?? 0,
  };
  const search = {
    queryTotal: currentStats.search?.queryTotal ?? 0,
    queryTimeInMillis: currentStats.search?.queryTimeInMillis ?? 0,
    queryCurrent: currentStats.search?.queryCurrent ?? 0,
    fetchTotal: currentStats.search?.fetchTotal ?? 0,
    fetchTimeInMillis: currentStats.search?.fetchTimeInMillis ?? 0,
    fetchCurrent: currentStats.search?.fetchCurrent ?? 0,
    scrollTotal: currentStats.search?.scrollTotal ?? 0,
    scrollTimeInMillis: currentStats.search?.scrollTimeInMillis ?? 0,
    scrollCurrent: currentStats.search?.scrollCurrent ?? 0,
  };
  const merges = {
    current: (currentStats.merges?.current as number) ?? 0,
    currentDocs: (currentStats.merges?.currentDocs as number) ?? 0,
    currentSizeInBytes: (currentStats.merges?.currentSizeInBytes as number) ?? 0,
    total: (currentStats.merges?.total as number) ?? 0,
    totalTimeInMillis: (currentStats.merges?.totalTimeInMillis as number) ?? 0,
    totalDocs: (currentStats.merges?.totalDocs as number) ?? 0,
    totalSizeInBytes: (currentStats.merges?.totalSizeInBytes as number) ?? 0,
  };
  const refresh = {
    total: (currentStats.refresh?.total as number) ?? 0,
    totalTimeInMillis: (currentStats.refresh?.totalTimeInMillis as number) ?? 0,
  };
  const flush = {
    total: (currentStats.flush?.total as number) ?? 0,
    totalTimeInMillis: (currentStats.flush?.totalTimeInMillis as number) ?? 0,
  };

  return (
    <FullWidthContainer>
      <PageSkeleton isLoading={isLoading} error={loadError}>
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
              onClick={() => navigate(`/cluster/${clusterId}${location.search}`)}
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
              <StatsCard
                title="Document Count"
                value={formatNumberWithCommas(currentStats.docs.count)}
                subtitle="Total documents in index"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <StatsCard
                title="Deleted Documents"
                value={formatNumberWithCommas(currentStats.docs.deleted)}
                subtitle="Documents marked for deletion"
              />
            </Grid.Col>
            <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
              <StatsCard
                title="Storage Size"
                value={formatBytes(currentStats.store.sizeInBytes)}
                subtitle="Total disk space used"
              />
            </Grid.Col>
                <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                  <StatsCard
                    title="Segments"
                    value={formatNumberWithCommas(segments.count)}
                    subtitle={`Memory: ${formatBytes(segments.memoryInBytes)}`}
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
                  <Table.Td>{formatNumberWithCommas(indexing.indexTotal)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Index Time</Table.Td>
                  <Table.Td>{formatTime(indexing.indexTimeInMillis)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Indexing Operations</Table.Td>
                  <Table.Td>{formatNumberWithCommas(indexing.indexCurrent)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Failed Index Operations</Table.Td>
                  <Table.Td>{formatNumberWithCommas(indexing.indexFailed)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Total Delete Operations</Table.Td>
                  <Table.Td>{formatNumberWithCommas(indexing.deleteTotal)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Delete Time</Table.Td>
                  <Table.Td>{formatTime(indexing.deleteTimeInMillis)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Delete Operations</Table.Td>
                  <Table.Td>{formatNumberWithCommas(indexing.deleteCurrent)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Throttle Time</Table.Td>
                  <Table.Td>{formatTime(indexing.throttleTimeInMillis)}</Table.Td>
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
                  <Table.Td>{formatNumberWithCommas(search.queryTotal)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Query Time</Table.Td>
                  <Table.Td>{formatTime(search.queryTimeInMillis)}</Table.Td>
                </Table.Tr>
              <Table.Tr>
                <Table.Td>Average Query Time</Table.Td>
                <Table.Td>
                    {search.queryTotal > 0
                      ? formatTime(search.queryTimeInMillis / search.queryTotal)
                      : '0ms'}
                </Table.Td>
              </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Queries</Table.Td>
                  <Table.Td>{formatNumberWithCommas(search.queryCurrent)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Total Fetches</Table.Td>
                  <Table.Td>{formatNumberWithCommas(search.fetchTotal)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Fetch Time</Table.Td>
                  <Table.Td>{formatTime(search.fetchTimeInMillis)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Fetches</Table.Td>
                  <Table.Td>{formatNumberWithCommas(search.fetchCurrent)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Total Scrolls</Table.Td>
                  <Table.Td>{formatNumberWithCommas(search.scrollTotal)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Scroll Time</Table.Td>
                  <Table.Td>{formatTime(search.scrollTimeInMillis)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Scrolls</Table.Td>
                  <Table.Td>{formatNumberWithCommas(search.scrollCurrent)}</Table.Td>
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
                  <Table.Td>{formatNumberWithCommas(merges.current)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Merge Docs</Table.Td>
                  <Table.Td>{formatNumberWithCommas(merges.currentDocs)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Current Merge Size</Table.Td>
                  <Table.Td>{formatBytes(merges.currentSizeInBytes)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Total Merges</Table.Td>
                  <Table.Td>{formatNumberWithCommas(merges.total)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Total Merge Time</Table.Td>
                  <Table.Td>{formatTime(merges.totalTimeInMillis)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                  <Table.Td>Total Merged Docs</Table.Td>
                  <Table.Td>{formatNumberWithCommas(merges.totalDocs)}</Table.Td>
                </Table.Tr>
                <Table.Tr>
                <Table.Td>Total Merged Size</Table.Td>
                <Table.Td>{formatBytes(merges.totalSizeInBytes)}</Table.Td>
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
                    <Table.Td>{formatNumberWithCommas(refresh.total)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Total Refresh Time</Table.Td>
                    <Table.Td>{formatTime(refresh.totalTimeInMillis)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Average Refresh Time</Table.Td>
                    <Table.Td>
                      {refresh.total > 0
                        ? formatTime(refresh.totalTimeInMillis / refresh.total)
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
                  <Table.Td>{formatNumberWithCommas(flush.total)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Total Flush Time</Table.Td>
                  <Table.Td>{formatTime(flush.totalTimeInMillis)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Average Flush Time</Table.Td>
                    <Table.Td>
                      {flush.total > 0
                        ? formatTime(flush.totalTimeInMillis / flush.total)
                        : '0ms'}
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            </Grid.Col>
          </Grid>
        </Card>
      </Stack>
      </PageSkeleton>
    </FullWidthContainer>
  );
}
