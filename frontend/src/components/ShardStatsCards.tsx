import { SimpleGrid, Card, Text, Stack } from '@mantine/core';

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
export function ShardStatsCards({ stats }: ShardStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Card shadow="sm" padding="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Total Shards
          </Text>
          <Text size="xl" fw={700}>
            {stats.totalShards}
          </Text>
        </Stack>
      </Card>

      <Card shadow="sm" padding="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Primary
          </Text>
          <Text size="xl" fw={700} c="blue">
            {stats.primaryShards}
          </Text>
        </Stack>
      </Card>

      <Card shadow="sm" padding="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Replica
          </Text>
          <Text size="xl" fw={700} c="gray">
            {stats.replicaShards}
          </Text>
        </Stack>
      </Card>

      <Card shadow="sm" padding="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Unassigned
          </Text>
          <Text size="xl" fw={700} c="red">
            {stats.unassignedShards}
          </Text>
        </Stack>
      </Card>

      <Card shadow="sm" padding="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Relocating
          </Text>
          <Text size="xl" fw={700} c="orange">
            {stats.relocatingShards}
          </Text>
        </Stack>
      </Card>

      <Card shadow="sm" padding="md">
        <Stack gap={4}>
          <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
            Initializing
          </Text>
          <Text size="xl" fw={700} c="yellow">
            {stats.initializingShards}
          </Text>
        </Stack>
      </Card>
    </SimpleGrid>
  );
}
