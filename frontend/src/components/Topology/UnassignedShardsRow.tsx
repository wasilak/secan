import { useState } from 'react';
import { Card, Text, Group, Box, Portal } from '@mantine/core';
import { getUnassignedShardColor } from '../../utils/colors';
import { ShardInfo } from '../../types/api';

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
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
}) {
  const [hoveredShard, setHoveredShard] = useState<ShardInfo | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  if (shards.length === 0) {
    return null;
  }

  return (
    <>
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
                  width: '14px',
                  height: '14px',
                  borderRadius: 2,
                  backgroundColor: getUnassignedShardColor(!!shard.primary),
                  border: `2px solid ${indexColors[shard.index] || '#888'}`,
                  cursor: 'pointer',
                  opacity: shard.primary ? 1 : 0.6,
                  boxShadow: shard.primary ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                }}
                onClick={(e) => onShardClick?.(shard, e)}
                onMouseEnter={(e) => {
                  setHoveredShard(shard);
                  setMousePos({ x: e.clientX, y: e.clientY });
                }}
                onMouseMove={(e) => {
                  setMousePos({ x: e.clientX, y: e.clientY });
                }}
                onMouseLeave={() => {
                  setHoveredShard(null);
                  setMousePos(null);
                }}
              />
            ))}
          </Group>
        </Card.Section>

        <Text size="xs" c="dimmed" mt="xs">
          These shards are not allocated to any node. Check cluster allocation settings.
        </Text>
      </Card>

      {/* Portal-based tooltip — same pattern as ShardWaffleChart to avoid overflow clipping */}
      {hoveredShard && mousePos && (
        <Portal>
          <Box
            p={6}
            style={{
              position: 'fixed',
              top: mousePos.y + 12,
              left: mousePos.x + 12,
              background: 'var(--mantine-color-dark-7)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--mantine-color-white)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 9999,
            }}
          >
            <div>
              Index: <span style={{ textTransform: 'none' }}>{hoveredShard.index}</span>
            </div>
            <div>Shard: {hoveredShard.shard}</div>
            <div>{hoveredShard.primary ? 'Primary' : 'Replica'} · Unassigned</div>
          </Box>
        </Portal>
      )}
    </>
  );
}
