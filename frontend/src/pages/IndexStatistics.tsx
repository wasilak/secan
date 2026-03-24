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
import { DetailPageSkeleton } from '../components/LoadingSkeleton';
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

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (error) {
    return (
      <FullWidthContainer>
        <ErrorAlert message={`Failed to load index statistics: ${getErrorMessage(error)}`} />
      </FullWidthContainer>
    );
  }

  if (!stats) {
    return (
      <FullWidthContainer>
        <ErrorAlert message="No statistics available for this index" />
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
          <Button variant="default" onClick={() => navigate(`/cluster/${clusterId}${location.search}`)}>
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
                value={formatNumberWithCommas(currentStats.segments.count)}
                subtitle={`Memory: ${formatBytes(currentStats.segments.memoryInBytes)}`}
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
                <Table.Td>{formatNumberWithCommas(currentStats.indexing.indexTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Index Time</Table.Td>
                <Table.Td>{formatTime(currentStats.indexing.indexTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Indexing Operations</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.indexing.indexCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Failed Index Operations</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.indexing.indexFailed)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Delete Operations</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.indexing.deleteTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Delete Time</Table.Td>
                <Table.Td>{formatTime(currentStats.indexing.deleteTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Delete Operations</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.indexing.deleteCurrent)}</Table.Td>
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
                <Table.Td>{formatNumberWithCommas(currentStats.search.queryTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Query Time</Table.Td>
                <Table.Td>{formatTime(currentStats.search.queryTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Average Query Time</Table.Td>
                <Table.Td>
                  {currentStats.search.queryTotal > 0
                    ? formatTime(
                        currentStats.search.queryTimeInMillis / currentStats.search.queryTotal
                      )
                    : '0ms'}
                </Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Queries</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.search.queryCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Fetches</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.search.fetchTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Fetch Time</Table.Td>
                <Table.Td>{formatTime(currentStats.search.fetchTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Fetches</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.search.fetchCurrent)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Scrolls</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.search.scrollTotal)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Scroll Time</Table.Td>
                <Table.Td>{formatTime(currentStats.search.scrollTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Scrolls</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.search.scrollCurrent)}</Table.Td>
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
                <Table.Td>{formatNumberWithCommas(currentStats.merges.current)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Merge Docs</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.merges.currentDocs)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Current Merge Size</Table.Td>
                <Table.Td>{formatBytes(currentStats.merges.currentSizeInBytes)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merges</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.merges.total)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merge Time</Table.Td>
                <Table.Td>{formatTime(currentStats.merges.totalTimeInMillis)}</Table.Td>
              </Table.Tr>
              <Table.Tr>
                <Table.Td>Total Merged Docs</Table.Td>
                <Table.Td>{formatNumberWithCommas(currentStats.merges.totalDocs)}</Table.Td>
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
                    <Table.Td>{formatNumberWithCommas(currentStats.refresh.total)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Total Refresh Time</Table.Td>
                    <Table.Td>{formatTime(currentStats.refresh.totalTimeInMillis)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Average Refresh Time</Table.Td>
                    <Table.Td>
                      {currentStats.refresh.total > 0
                        ? formatTime(
                            currentStats.refresh.totalTimeInMillis / currentStats.refresh.total
                          )
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
                    <Table.Td>{formatNumberWithCommas(currentStats.flush.total)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Total Flush Time</Table.Td>
                    <Table.Td>{formatTime(currentStats.flush.totalTimeInMillis)}</Table.Td>
                  </Table.Tr>
                  <Table.Tr>
                    <Table.Td>Average Flush Time</Table.Td>
                    <Table.Td>
                      {currentStats.flush.total > 0
                        ? formatTime(
                            currentStats.flush.totalTimeInMillis / currentStats.flush.total
                          )
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
