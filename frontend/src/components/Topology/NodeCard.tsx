import { Card, Group, Text, Badge, Stack } from '@mantine/core';
import { NodeDetailStats, ShardInfo } from '../../types/api';
import { ShardDot } from './ShardDot';
import { RoleIcons } from '../RoleIcons';
import { getHealthColorValue } from '../../utils/colors';

/**
 * NodeCard Component for Dot-Based Topology View
 *
 * Displays a node with its shard dots and enhanced metrics.
 */
export function NodeCard({
  node,
  shards,
  isMaster,
  indexColors,
  onNodeClick,
  onShardClick,
  onShardHoverChange,
}: {
  node: NodeDetailStats;
  shards: ShardInfo[];
  isMaster: boolean;
  indexColors: Record<string, string>;
  onNodeClick?: () => void;
  onShardClick?: (shardId: string) => void;
  onShardHoverChange?: (shard: ShardInfo | null) => void;
}) {
  const formatSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  // Get CPU color based on thresholds: green <70%, yellow 70-85%, red >85%
  const getCpuColor = (cpuPercent?: number): string => {
    if (cpuPercent === undefined) return 'dimmed';
    if (cpuPercent < 70) return 'green';
    if (cpuPercent < 85) return 'yellow';
    return 'red';
  };

  // Get load average color based on CPU cores
  // Assuming typical server has 4-8 cores, using 4 as baseline
  // green <cores, yellow cores-1.5x, red >1.5x cores
  const getLoadColor = (load?: number, cores: number = 4): string => {
    if (load === undefined) return 'dimmed';
    if (load < cores) return 'green';
    if (load < cores * 1.5) return 'yellow';
    return 'red';
  };

  const healthColor = getHealthColorValue('green');

  return (
    <Card
      padding="sm"
      radius="md"
      withBorder
      shadow="sm"
      onClick={onNodeClick}
      style={{
        cursor: onNodeClick ? 'pointer' : 'default',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        borderTop: `3px solid ${healthColor}`,
      }}
    >
      {/* Header with node name and IP */}
      <Group gap="xs" wrap="nowrap" mb="xs" justify="space-between">
        <Group gap="xs" wrap="nowrap">
          <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {node.name}
          </Text>
          {node.ip && (
            <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
              {node.ip}
            </Text>
          )}
        </Group>
        <Group gap={4} wrap="nowrap">
          {isMaster && (
            <Badge size="xs" variant="filled" color="blue">
              Master
            </Badge>
          )}
          <RoleIcons roles={node.roles || []} size={14} />
        </Group>
      </Group>

      {/* Metrics section */}
      <Stack gap={4} mb="xs">
        {/* CPU and Load Average */}
        <Group gap="xs" wrap="nowrap">
          {node.cpuPercent !== undefined && (
            <Text size="xs" c={getCpuColor(node.cpuPercent)}>
              CPU: {node.cpuPercent.toFixed(1)}%
            </Text>
          )}
          {node.loadAverage && node.loadAverage.length >= 1 && (
            <Text size="xs" c={getLoadColor(node.loadAverage[0])}>
              Load: {node.loadAverage[0].toFixed(2)}
            </Text>
          )}
        </Group>

        {/* Heap and Disk */}
        <Group gap="xs" wrap="nowrap">
          {node.heapUsed && (
            <Text size="xs" c="dimmed">
              Heap: {formatSize(node.heapUsed)}
            </Text>
          )}
          {node.diskUsed && (
            <Text size="xs" c="dimmed">
              Disk: {formatSize(node.diskUsed)}
            </Text>
          )}
        </Group>

        {/* Elasticsearch Version */}
        {node.version && (
          <Text size="xs" c="dimmed">
            ES: {node.version}
          </Text>
        )}
      </Stack>

      {/* Shard dots */}
      {shards.length > 0 && (
        <Card.Section p="xs">
          <Group gap={4} wrap="wrap">
            {shards.map((shard) => (
              <ShardDot
                key={`${shard.index}[${shard.shard}]`}
                shard={shard}
                indexColor={indexColors[shard.index] || '#888'}
                size="md"
                onClick={() => onShardClick?.(`${shard.index}[${shard.shard}]`)}
                onHoverChange={onShardHoverChange}
              />
            ))}
          </Group>
        </Card.Section>
      )}

      {/* Footer */}
      <Group gap="xs" justify="space-between" wrap="nowrap" mt="xs">
        <Text size="xs" c="dimmed">
          {shards.length} shards
        </Text>
      </Group>
    </Card>
  );
}
