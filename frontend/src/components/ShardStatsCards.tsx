import { SimpleGrid, Paper, Text, Stack } from '@mantine/core';
import { memo } from 'react';

/**
 * Props for ShardStatsCards component
 */
interface ShardStatsCardsProps {
  stats: {
    totalShards: number;
    primaryShards: number;
    replicaShards: number;
    unassignedShards: number;
    relocatingShards: number;
    initializingShards: number;
  };
}

/**
 * ShardStatsCards component displays shard statistics in compact cards
 * matching the visual style of overview statistics cards.
 *
 * Requirements: 14.2, 14.3, 14.4, 14.5
 */
export const ShardStatsCards = memo(function ShardStatsCards({ stats }: ShardStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Shards
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalShards}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Primary
          </Text>
          <Text size="xl" fw={700} c="blue">
            {stats.primaryShards}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Replica
          </Text>
          <Text size="xl" fw={700} c="gray">
            {stats.replicaShards}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Unassigned
          </Text>
          <Text size="xl" fw={700} c="red">
            {stats.unassignedShards}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Relocating
          </Text>
          <Text size="xl" fw={700} c="orange">
            {stats.relocatingShards}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Initializing
          </Text>
          <Text size="xl" fw={700} c="yellow">
            {stats.initializingShards}
          </Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
});
