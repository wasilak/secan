import React, { useState } from 'react';
import { Button, Modal, Text, Group, Stack, Loader, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { TaskInfo } from '../types/api';

/**
 * Task actions menu component
 *
 * Provides UI for task actions including:
 * - Cancel task with confirmation
 * - Disabled state for non-cancellable tasks
 *
 * Requirements: 5 (Cancel task action)
 */
interface TaskActionsMenuProps {
  task: TaskInfo;
  onCancel: (taskId: string) => Promise<void>;
  isLoading?: boolean;
}

export function TaskActionsMenu({ task, onCancel, isLoading }: TaskActionsMenuProps): JSX.Element {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      setError(null);
      const taskId = `${task.node}:${task.id}`;
      await onCancel(taskId);
      setShowConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel task';
      setError(message);
    } finally {
      setIsCancelling(false);
    }
  };

  const isDisabled = !task.cancellable || isLoading || isCancelling;

  return (
    <>
      <Button
        variant="subtle"
        color="red"
        size="sm"
        onClick={() => setShowConfirm(true)}
        disabled={isDisabled}
        loading={isCancelling}
        title={
          !task.cancellable
            ? 'This task cannot be cancelled'
            : 'Cancel this task'
        }
      >
        {isCancelling ? <Loader size={14} /> : 'Cancel'}
      </Button>

      <Modal
        opened={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Confirm Task Cancellation"
        centered
      >
        <Stack gap="md">
          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red">
              {error}
            </Alert>
          )}

          <div>
            <Text size="sm" fw={500}>
              Task ID: {task.id}
            </Text>
            <Text size="sm" c="dimmed">
              Node: {task.node}
            </Text>
            <Text size="sm" c="dimmed">
              Action: {task.action}
            </Text>
          </div>

          <Text size="sm">
            Are you sure you want to cancel this task? This action cannot be undone.
          </Text>

          <Group justify="flex-end">
            <Button
              variant="default"
              onClick={() => setShowConfirm(false)}
              disabled={isCancelling}
            >
              Cancel
            </Button>
            <Button
              color="red"
              onClick={handleCancel}
              loading={isCancelling}
            >
              Confirm Cancellation
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  );
}
