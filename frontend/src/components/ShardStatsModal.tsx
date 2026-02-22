import { Modal, Stack, Group, Text, Badge, Table, Box, Loader, Alert } from '@mantine/core';
import { useEffect, useState } from 'react';
import { IconAlertCircle } from '@tabler/icons-react';
import type { ShardInfo, DetailedShardStats } from '../types/api';
import { apiClient } from '../api/client';

/**
 * Props for ShardStatsModal component
 */
interface ShardStatsModalProps {
  shard: ShardInfo | null;
  opened: boolean;
  onClose: () => void;
  clusterId?: string;
}

/**
 * ShardStatsModal component
 *
 * Displays detailed shard information in a modal dialog.
 * Shows shard number, type, index name, node, state, document count, and size.
 *
 * Requirements: 4.5, 4.6
 */
export function ShardStatsModal({
  shard,
  opened,
  onClose,
  clusterId,
}: ShardStatsModalProps): React.JSX.Element {
  const [detailedStats, setDetailedStats] = useState<DetailedShardStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch detailed shard stats when modal opens - Requirements: 4.6
  useEffect(() => {
    if (!opened || !shard || !clusterId || shard.state === 'UNASSIGNED') {
      setDetailedStats(null);
      setError(null);
      return;
    }

    const fetchDetailedStats = async () => {
      setLoading(true);
      setError(null);

      try {
        // Call shard stats API - Requirements: 4.6
        const stats = await apiClient.getShardStats(clusterId, shard.index, shard.shard);

        // Parse response and extract relevant metrics
        // The response structure depends on the Elasticsearch version
        // We'll extract segments, merges, refreshes, flushes if available
        const parsedStats: DetailedShardStats = {
          ...shard,
          segments: extractSegmentCount(stats),
          merges: extractMergeCount(stats),
          refreshes: extractRefreshCount(stats),
          flushes: extractFlushCount(stats),
        };

        setDetailedStats(parsedStats);
      } catch (err) {
        console.error('Failed to fetch detailed shard stats:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch shard statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchDetailedStats();
  }, [opened, shard, clusterId]);

  // Helper functions to extract metrics from ES response
  const extractSegmentCount = (stats: unknown): number | undefined => {
    try {
      const data = stats as Record<string, unknown>;
      const indices = data.indices as Record<string, unknown> | undefined;
      if (!indices) return undefined;

      const indexData = Object.values(indices)[0] as Record<string, unknown> | undefined;
      if (!indexData) return undefined;

      const shards = indexData.shards as Record<string, unknown[]> | undefined;
      if (!shards) return undefined;

      const shardArray = Object.values(shards)[0];
      if (!shardArray || shardArray.length === 0) return undefined;

      const shardData = shardArray[0] as Record<string, unknown>;
      const segments = shardData.segments as Record<string, unknown> | undefined;

      return segments?.count as number | undefined;
    } catch {
      return undefined;
    }
  };

  const extractMergeCount = (stats: unknown): number | undefined => {
    try {
      const data = stats as Record<string, unknown>;
      const indices = data.indices as Record<string, unknown> | undefined;
      if (!indices) return undefined;

      const indexData = Object.values(indices)[0] as Record<string, unknown> | undefined;
      if (!indexData) return undefined;

      const shards = indexData.shards as Record<string, unknown[]> | undefined;
      if (!shards) return undefined;

      const shardArray = Object.values(shards)[0];
      if (!shardArray || shardArray.length === 0) return undefined;

      const shardData = shardArray[0] as Record<string, unknown>;
      const merges = shardData.merges as Record<string, unknown> | undefined;

      return merges?.current as number | undefined;
    } catch {
      return undefined;
    }
  };

  const extractRefreshCount = (stats: unknown): number | undefined => {
    try {
      const data = stats as Record<string, unknown>;
      const indices = data.indices as Record<string, unknown> | undefined;
      if (!indices) return undefined;

      const indexData = Object.values(indices)[0] as Record<string, unknown> | undefined;
      if (!indexData) return undefined;

      const shards = indexData.shards as Record<string, unknown[]> | undefined;
      if (!shards) return undefined;

      const shardArray = Object.values(shards)[0];
      if (!shardArray || shardArray.length === 0) return undefined;

      const shardData = shardArray[0] as Record<string, unknown>;
      const refresh = shardData.refresh as Record<string, unknown> | undefined;

      return refresh?.total as number | undefined;
    } catch {
      return undefined;
    }
  };

  const extractFlushCount = (stats: unknown): number | undefined => {
    try {
      const data = stats as Record<string, unknown>;
      const indices = data.indices as Record<string, unknown> | undefined;
      if (!indices) return undefined;

      const indexData = Object.values(indices)[0] as Record<string, unknown> | undefined;
      if (!indexData) return undefined;

      const shards = indexData.shards as Record<string, unknown[]> | undefined;
      if (!shards) return undefined;

      const shardArray = Object.values(shards)[0];
      if (!shardArray || shardArray.length === 0) return undefined;

      const shardData = shardArray[0] as Record<string, unknown>;
      const flush = shardData.flush as Record<string, unknown> | undefined;

      return flush?.total as number | undefined;
    } catch {
      return undefined;
    }
  };
  // Format size in bytes to human-readable format
  const formatSize = (bytes?: number): string => {
    if (bytes === undefined || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Format number with commas
  const formatNumber = (value?: number): string => {
    if (value === undefined) return 'N/A';
    return value.toLocaleString();
  };

  // Get shard type label
  const getShardTypeLabel = (primary: boolean): string => {
    return primary ? 'Primary' : 'Replica';
  };

  // Get shard state color
  const getStateColor = (state: string): string => {
    switch (state) {
      case 'STARTED':
        return 'green';
      case 'INITIALIZING':
        return 'yellow';
      case 'RELOCATING':
        return 'orange';
      case 'UNASSIGNED':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (!shard) {
    return <></>;
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={
        <Group gap="sm">
          <Text fw={600} size="lg">
            Shard Details
          </Text>
          <Badge color={shard.primary ? 'blue' : 'gray'} variant="light">
            {getShardTypeLabel(shard.primary)}
          </Badge>
        </Group>
      }
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* Basic shard information - Requirements: 4.6 */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Basic Information
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              {/* Shard number and type - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500} w="40%">
                  Shard Number
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text>{shard.shard}</Text>
                    <Badge color={shard.primary ? 'blue' : 'gray'} size="sm" variant="light">
                      {getShardTypeLabel(shard.primary)}
                    </Badge>
                  </Group>
                </Table.Td>
              </Table.Tr>

              {/* Index name - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>Index Name</Table.Td>
                <Table.Td>
                  <Text ff="monospace" size="sm">
                    {shard.index}
                  </Text>
                </Table.Td>
              </Table.Tr>

              {/* Node name and ID - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>Node</Table.Td>
                <Table.Td>
                  {shard.node ? (
                    <Text ff="monospace" size="sm">
                      {shard.node}
                    </Text>
                  ) : (
                    <Text c="dimmed" size="sm">
                      Unassigned
                    </Text>
                  )}
                </Table.Td>
              </Table.Tr>

              {/* Shard state - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>State</Table.Td>
                <Table.Td>
                  <Badge color={getStateColor(shard.state)} variant="light">
                    {shard.state}
                  </Badge>
                </Table.Td>
              </Table.Tr>

              {/* Relocating node (if applicable) */}
              {shard.relocatingNode && (
                <Table.Tr>
                  <Table.Td fw={500}>Relocating To</Table.Td>
                  <Table.Td>
                    <Text ff="monospace" size="sm">
                      {shard.relocatingNode}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              )}
            </Table.Tbody>
          </Table>
        </Box>

        {/* Shard statistics - Requirements: 4.6 */}
        <Box>
          <Text size="sm" fw={600} mb="xs">
            Statistics
          </Text>
          <Table withTableBorder withColumnBorders>
            <Table.Tbody>
              {/* Document count - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500} w="40%">
                  Document Count
                </Table.Td>
                <Table.Td>
                  <Text>{formatNumber(shard.docs)}</Text>
                </Table.Td>
              </Table.Tr>

              {/* Size in bytes - Requirements: 4.6 */}
              <Table.Tr>
                <Table.Td fw={500}>Size</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text>{formatSize(shard.store)}</Text>
                    {shard.store !== undefined && (
                      <Text size="xs" c="dimmed">
                        ({formatNumber(shard.store)} bytes)
                      </Text>
                    )}
                  </Group>
                </Table.Td>
              </Table.Tr>
            </Table.Tbody>
          </Table>
        </Box>

        {/* Detailed statistics - Requirements: 4.6 */}
        {shard.state !== 'UNASSIGNED' && (
          <Box>
            <Text size="sm" fw={600} mb="xs">
              Detailed Statistics
            </Text>

            {loading && (
              <Box p="md" style={{ textAlign: 'center' }}>
                <Loader size="sm" />
                <Text size="sm" c="dimmed" mt="xs">
                  Loading detailed statistics...
                </Text>
              </Box>
            )}

            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                {error}
              </Alert>
            )}

            {!loading && !error && detailedStats && (
              <Table withTableBorder withColumnBorders>
                <Table.Tbody>
                  {/* Segments count - Requirements: 4.6 */}
                  <Table.Tr>
                    <Table.Td fw={500} w="40%">
                      Segments
                    </Table.Td>
                    <Table.Td>
                      <Text>{formatNumber(detailedStats.segments)}</Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Merges count - Requirements: 4.6 */}
                  <Table.Tr>
                    <Table.Td fw={500}>Merges (current)</Table.Td>
                    <Table.Td>
                      <Text>{formatNumber(detailedStats.merges)}</Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Refreshes count - Requirements: 4.6 */}
                  <Table.Tr>
                    <Table.Td fw={500}>Refreshes (total)</Table.Td>
                    <Table.Td>
                      <Text>{formatNumber(detailedStats.refreshes)}</Text>
                    </Table.Td>
                  </Table.Tr>

                  {/* Flushes count - Requirements: 4.6 */}
                  <Table.Tr>
                    <Table.Td fw={500}>Flushes (total)</Table.Td>
                    <Table.Td>
                      <Text>{formatNumber(detailedStats.flushes)}</Text>
                    </Table.Td>
                  </Table.Tr>
                </Table.Tbody>
              </Table>
            )}

            {!loading && !error && !detailedStats && (
              <Box
                p="sm"
                style={{
                  backgroundColor: 'var(--mantine-color-gray-light)',
                  borderRadius: 'var(--mantine-radius-sm)',
                }}
              >
                <Text size="sm" c="dimmed">
                  Detailed statistics are not available for this shard.
                </Text>
              </Box>
            )}
          </Box>
        )}

        {/* Note for unassigned shards */}
        {shard.state === 'UNASSIGNED' && (
          <Box
            p="sm"
            style={{
              backgroundColor: 'var(--mantine-color-yellow-light)',
              borderRadius: 'var(--mantine-radius-sm)',
            }}
          >
            <Text size="sm" c="dimmed">
              <strong>Note:</strong> Detailed statistics are not available for unassigned shards.
            </Text>
          </Box>
        )}
      </Stack>
    </Modal>
  );
}
