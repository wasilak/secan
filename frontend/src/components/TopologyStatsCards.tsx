import { SimpleGrid, Paper, Text, Stack } from '@mantine/core';
import { memo, useMemo } from 'react';
import type { NodeInfo, IndexInfo, ShardInfo } from '../types/api';

interface TopologyStatsCardsProps {
  filteredNodes: NodeInfo[];
  filteredIndices: IndexInfo[];
  filteredShards: ShardInfo[];
}

export const TopologyStatsCards = memo(function TopologyStatsCards({
  filteredNodes,
  filteredIndices,
  filteredShards,
}: TopologyStatsCardsProps) {
  const stats = useMemo(() => ({
    dataNodes: filteredNodes.filter(n => n.roles.includes('data')).length,
    indices: filteredIndices.length,
    shards: filteredShards.length,
    primaries: filteredShards.filter(s => s.primary).length,
    replicas: filteredShards.filter(s => !s.primary).length,
    unassigned: filteredShards.filter(s => s.state === 'UNASSIGNED').length,
  }), [filteredNodes, filteredIndices, filteredShards]);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Nodes
          </Text>
          <Text size="xl" fw={700} c="blue">
            {stats.dataNodes}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Indices
          </Text>
          <Text size="xl" fw={700}>
            {stats.indices}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Shards
          </Text>
          <Text size="xl" fw={700}>
            {stats.shards}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Primary
          </Text>
          <Text size="xl" fw={700} c="blue">
            {stats.primaries}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Replica
          </Text>
          <Text size="xl" fw={700} c="gray">
            {stats.replicas}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Unassigned
          </Text>
          <Text size="xl" fw={700} c="red">
            {stats.unassigned}
          </Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
});
