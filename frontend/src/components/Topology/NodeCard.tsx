import { Card, Group, Text, Badge } from '@mantine/core';
import { NodeDetailStats, ShardInfo } from '../../types/api';
import { ShardDot } from './ShardDot';
import { RoleIcons } from '../RoleIcons';
import { getHealthColorValue } from '../../utils/colors';

/**
 * NodeCard Component for Dot-Based Topology View
 *
 * Displays a node with its shard dots.
 */
export function NodeCard({
  node,
  shards,
  isMaster,
  indexColors,
  onNodeClick,
  onShardClick,
}: {
  node: NodeDetailStats;
  shards: ShardInfo[];
  isMaster: boolean;
  indexColors: Record<string, string>;
  onNodeClick?: () => void;
  onShardClick?: (shardId: string) => void;
}) {
  const formatSize = (bytes?: number): string => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
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
      {/* Header */}
      <Group gap="xs" wrap="nowrap" mb="xs">
        <Text size="sm" fw={600} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {node.name}
        </Text>
        {isMaster && (
          <Badge size="xs" variant="filled" color="blue">
            Master
          </Badge>
        )}
        <Group gap={2} wrap="nowrap" ml="auto">
          <RoleIcons roles={node.roles || []} size={14} />
        </Group>
      </Group>

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
              />
            ))}
          </Group>
        </Card.Section>
      )}

      {/* Footer */}
      <Group gap="xs" justify="space-between" wrap="nowrap">
        <Text size="xs" c="dimmed">
          {shards.length} shards
        </Text>
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
    </Card>
  );
}
