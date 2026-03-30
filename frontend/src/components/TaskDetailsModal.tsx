import React, { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Modal, Stack, Text, Group, Badge, Loader, Alert, Tabs } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskInfo, TaskDetails } from '../types/api';
import { apiClient } from '../api/client';
import { JsonViewer } from './JsonViewer';
import { formatTimestamp } from '../utils/formatters';
import { DURATIONS, EASINGS } from '../lib/transitions';

/**
 * Task details modal component
 *
 * Displays detailed task information including:
 * - Task basic info (ID, type, action, timing)
 * - Full task JSON in syntax-highlighted format
 *
 * Requirements: 4 (Task details modal)
 */
interface TaskDetailsModalProps {
  task: TaskInfo | null;
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
}

function formatUptime(millis: number): string {
  const seconds = Math.floor(millis / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m`;
  }
  return `${seconds}s`;
}

export function TaskDetailsModal({
  task,
  isOpen,
  onClose,
  clusterId,
}: TaskDetailsModalProps): ReactElement {
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!task || !isOpen) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        const taskId = `${task.node}:${task.id}`;
        const response = await apiClient.getTaskDetails(clusterId, taskId);
        if (signal.aborted) return;
        setTaskDetails(response.task);
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message = err instanceof Error ? err.message : 'Failed to fetch task details';
        setError(message);
      } finally {
        if (!signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchDetails();

    return () => {
      controller.abort();
    };
  }, [task, isOpen, clusterId]);

  if (!task) {
    return <Modal opened={false} onClose={onClose} />;
  }

  const runningTime = Date.now() - task.start_time_in_millis;

  return (
    <AnimatePresence>
      {isOpen && (
        <Modal
          opened={isOpen}
          onClose={onClose}
          title={`Task Details: ${task.id}`}
          size="xl"
          centered

        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{
              duration: DURATIONS.slow,
              ease: EASINGS.default,
            }}
          >
            <Stack gap="md">
        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            {error}
          </Alert>
        )}

        {/* Basic Info */}
        <div>
          <Text fw={500} mb="sm">
            Basic Information
          </Text>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Task ID:
              </Text>
              <Text size="sm" fw={500}>
                {task.id}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Node:
              </Text>
              <Text size="sm" fw={500}>
                {task.node}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Type:
              </Text>
              <Badge>{task.type}</Badge>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Action:
              </Text>
              <Text size="sm" fw={500}>
                {task.action}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Start Time:
              </Text>
              <Text size="sm" fw={500}>
                {formatTimestamp(task.start_time_in_millis)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Running Time:
              </Text>
              <Text size="sm" fw={500}>
                {formatUptime(runningTime)}
              </Text>
            </Group>
            <Group justify="space-between">
              <Text size="sm" c="dimmed">
                Cancellable:
              </Text>
              <Badge color={task.cancellable ? 'green' : 'gray'}>
                {task.cancellable ? 'Yes' : 'No'}
              </Badge>
            </Group>
            {task.parent_task_id && (
              <Group justify="space-between">
                <Text size="sm" c="dimmed">
                  Parent Task:
                </Text>
                <Text size="sm" fw={500}>
                  {task.parent_task_id}
                </Text>
              </Group>
            )}
          </Stack>
        </div>

        {/* Details Tab */}
        {isLoading ? (
          <Group justify="center" py="xl">
            <Loader />
          </Group>
        ) : taskDetails ? (
          <Tabs defaultValue="json">
            <Tabs.List>
              <Tabs.Tab value="json">JSON</Tabs.Tab>
            </Tabs.List>
            <Tabs.Panel value="json">
              <JsonViewer
                data={taskDetails.raw || taskDetails}
                title="Task JSON"
                height={500}
                showCopyButton={true}
              />
            </Tabs.Panel>
          </Tabs>
        ) : null}
            </Stack>
          </motion.div>
        </Modal>
      )}
    </AnimatePresence>
  );
}
