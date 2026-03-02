import { Card, Text, Group, Box } from '@mantine/core';
import { ShardInfo } from '../../types/api';
import { NodeCard } from './NodeCard';

/**
 * UnassignedShardsRow Component
 *
 * Displays unassigned shards in a separate row.
 */
export function UnassignedShardsRow({
  shards,
  indexColors,
  onShardClick,
}: {
  shards: ShardInfo[];
  indexColors: Record<string, string>;
  onShardClick?: (shardId: string) => void;
}) {
  if (shards.length === 0) {
    return null;
  }

  return (
    <Card padding="md" radius="md" withBorder shadow="sm" mt="md">
      <Group gap="xs" mb="xs">
        <Text size="sm" fw={600} c="red">
          ⚠ Unassigned Shards ({shards.length})
        </Text>
      </Group>

      <Card.Section p="xs">
        <Group gap={4} wrap="wrap">
          {shards.map((shard) => (
            <Box
              key={`unassigned-${shard.index}[${shard.shard}]`}
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: `var(--mantine-color-red-6)`,
                border: `2px solid ${indexColors[shard.index] || '#888'}`,
                cursor: 'pointer',
              }}
              onClick={() => onShardClick?.(`${shard.index}[${shard.shard}]`)}
              title={`${shard.index}[${shard.shard}] - Unassigned`}
            />
          ))}
        </Group>
      </Card.Section>

      <Text size="xs" c="dimmed" mt="xs">
        These shards are not allocated to any node. Check cluster allocation settings.
      </Text>
    </Card>
  );
}
