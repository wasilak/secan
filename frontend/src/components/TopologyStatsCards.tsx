import { SimpleGrid, Paper, Text, Stack } from '@mantine/core';
import { memo } from 'react';

interface TopologyStatsCardsProps {
  nodeCount: number;
  indexCount: number;
  shardCount: number;
  primaryCount: number;
  replicaCount: number;
  unassignedCount: number;
}

export const TopologyStatsCards = memo(function TopologyStatsCards({
  nodeCount,
  indexCount,
  shardCount,
  primaryCount,
  replicaCount,
  unassignedCount,
}: TopologyStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Nodes
          </Text>
          <Text size="xl" fw={700} c="blue">
            {nodeCount}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Indices
          </Text>
          <Text size="xl" fw={700}>
            {indexCount}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Shards
          </Text>
          <Text size="xl" fw={700}>
            {shardCount}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Primary
          </Text>
          <Text size="xl" fw={700} c="blue">
            {primaryCount}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Replica
          </Text>
          <Text size="xl" fw={700} c="gray">
            {replicaCount}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Unassigned
          </Text>
          <Text size="xl" fw={700} c="red">
            {unassignedCount}
          </Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
});
