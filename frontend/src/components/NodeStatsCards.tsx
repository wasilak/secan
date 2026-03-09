import { SimpleGrid, Paper, Text, Stack } from '@mantine/core';
import { memo, useMemo } from 'react';
import type { NodeInfo } from '../types/api';

/**
 * Props for NodeStatsCards component
 */
interface NodeStatsCardsProps {
  nodes: NodeInfo[];
}

/**
 * NodeStatsCards component displays node statistics in compact cards
 * matching the visual style of overview statistics cards.
 * 
 * Memoized to prevent unnecessary re-renders when nodes data hasn't changed.
 */
export const NodeStatsCards = memo(function NodeStatsCards({ nodes }: NodeStatsCardsProps) {
  // Memoize stats calculation to prevent recalculation on every render
  const stats = useMemo(() => {
    const totalNodes = nodes.length;
    const masterNodes = nodes.filter((n) => n.roles.includes('master')).length;
    const dataNodes = nodes.filter((n) => n.roles.includes('data')).length;
    const ingestNodes = nodes.filter((n) => n.roles.includes('ingest')).length;
    const coordinatingNodes = nodes.filter((n) => 
      !n.roles.includes('master') && 
      !n.roles.includes('data') && 
      !n.roles.includes('ingest')
    ).length;
    const mlNodes = nodes.filter((n) => n.roles.includes('ml')).length;

    return { totalNodes, masterNodes, dataNodes, ingestNodes, coordinatingNodes, mlNodes };
  }, [nodes]);

  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Nodes
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalNodes}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Master
          </Text>
          <Text size="xl" fw={700} c="violet">
            {stats.masterNodes}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Data
          </Text>
          <Text size="xl" fw={700} c="blue">
            {stats.dataNodes}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Ingest
          </Text>
          <Text size="xl" fw={700} c="green">
            {stats.ingestNodes}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Coordinating
          </Text>
          <Text size="xl" fw={700} c="gray">
            {stats.coordinatingNodes}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            ML
          </Text>
          <Text size="xl" fw={700} c="orange">
            {stats.mlNodes}
          </Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
});
