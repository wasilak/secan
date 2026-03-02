import { Card, Group, Text, Badge, Tooltip } from '@mantine/core';
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

  const formatLoad = (load?: number): string => load ? load.toFixed(2) : 'N/A';

  const healthColor = getHealthColorValue('green');

  const tooltipContent = (
    <div style={{ fontSize: 'var(--mantine-font-size-xs)' }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>{node.name}</div>
      <div><strong>IP:</strong> {node.ip || 'N/A'}</div>
      <div><strong>Roles:</strong> {node.roles?.join(', ') || 'N/A'}</div>
      <div><strong>CPU Load:</strong> {node.loadAverage ? formatLoad(node.loadAverage[0]) : 'N/A'}</div>
      <div><strong>Heap:</strong> {node.heapUsed ? formatSize(node.heapUsed) : 'N/A'}</div>
      <div><strong>Disk:</strong> {node.diskUsed ? formatSize(node.diskUsed) : 'N/A'}</div>
      <div><strong>Shards:</strong> {shards.length}</div>
    </div>
  );

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
