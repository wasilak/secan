import React from 'react';
import { Group, Paper, Text, Stack } from '@mantine/core';
import {
  IconActivity,
  IconPlayerPlay,
  IconPlayerPause,
  IconX,
} from '@tabler/icons-react';

interface TaskStats {
  totalTasks: number;
  runningTasks: number;
  cancellableTasks: number;
  cancelledTasks: number;
}

interface TaskStatsCardsProps {
  stats: TaskStats;
}

export const TaskStatsCards = React.memo(({ stats }: TaskStatsCardsProps) => {
  const cards = [
    {
      label: 'Total Tasks',
      value: stats.totalTasks,
      icon: IconActivity,
      color: 'blue',
    },
    {
      label: 'Running',
      value: stats.runningTasks,
      icon: IconPlayerPlay,
      color: 'green',
    },
    {
      label: 'Cancellable',
      value: stats.cancellableTasks,
      icon: IconPlayerPause,
      color: 'orange',
    },
    {
      label: 'Cancelled',
      value: stats.cancelledTasks,
      icon: IconX,
      color: 'red',
    },
  ];

  return (
    <Group gap="md" grow>
      {cards.map(({ label, value, icon: Icon, color }) => (
        <Paper key={label} p="md" withBorder>
          <Stack gap={4}>
            <Group justify="space-between" wrap="nowrap">
              <Text size="xs" c="dimmed" tt="uppercase" fw={700}>
                {label}
              </Text>
              <Icon size={18} color={`var(--mantine-color-${color}-6)`} />
            </Group>
            <Text size="xl" fw={700}>
              {value.toLocaleString()}
            </Text>
          </Stack>
        </Paper>
      ))}
    </Group>
  );
});

TaskStatsCards.displayName = 'TaskStatsCards';
