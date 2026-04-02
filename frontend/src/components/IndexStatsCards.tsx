import { SimpleGrid, Paper, Text, Stack } from '@mantine/core';
import { memo } from 'react';

/**
 * Props for IndexStatsCards component
 */
interface IndexStatsCardsProps {
  stats: {
    totalIndices: number;
    greenIndices: number;
    yellowIndices: number;
    redIndices: number;
    openIndices: number;
    closedIndices: number;
  };
}

/**
 * IndexStatsCards component displays index statistics in compact cards
 * matching the visual style of overview statistics cards.
 */
export const IndexStatsCards = memo(function IndexStatsCards({ stats }: IndexStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Indices
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalIndices}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Green
          </Text>
          <Text size="xl" fw={700} c="green">
            {stats.greenIndices}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Yellow
          </Text>
          <Text size="xl" fw={700} c="yellow">
            {stats.yellowIndices}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Red
          </Text>
          <Text size="xl" fw={700} c="red">
            {stats.redIndices}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Open
          </Text>
          <Text size="xl" fw={700} c="blue">
            {stats.openIndices}
          </Text>
        </Stack>
      </Paper>

      <Paper withBorder p="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Closed
          </Text>
          <Text size="xl" fw={700} c="gray">
            {stats.closedIndices}
          </Text>
        </Stack>
      </Paper>
    </SimpleGrid>
  );
});
