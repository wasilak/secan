import React, { useEffect, useState } from 'react';
import { Stack, Text, Group, Badge, Loader, Alert, Table, Button } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ManagedModalRoot } from './ManagedModalRoot';
import { Modal } from '@mantine/core';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../utils/queryKeys';
import { TaskInfo, TaskDetails } from '../types/api';
import { apiClient } from '../api/client';
import { JsonViewer } from './JsonViewer';
import { formatTimestamp } from '../utils/formatters';
import { DURATIONS, EASINGS } from '../lib/transitions';
import ModalRefreshButton from './ModalRefreshButton';

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
  openNodeModal?: (nodeId: string) => void;
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
  openNodeModal,
}: TaskDetailsModalProps): React.ReactElement | null {
  // Hooks must be called unconditionally
  const [taskDetails, setTaskDetails] = useState<TaskDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  // support stacking another TaskDetailsModal on top for parent tasks
  const [stackedTask, setStackedTask] = useState<TaskInfo | null>(null);
  const [isStackedOpen, setIsStackedOpen] = useState(false);
  const queryClient = useQueryClient();

  // allow null return when no task is provided (handled after hooks)

  useEffect(() => {
    if (!isOpen || !task) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const fetchDetails = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Capture current task to avoid TS complaining about potential null
        const currentTask = task;
        const taskId = `${currentTask.node}:${currentTask.id}`;
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
    return null;
  }

  const runningTime = Date.now() - task.start_time_in_millis;

  const handleRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    try {
      await (async () => {
        // Reuse fetchDetails logic by calling API directly
        const currentTask = task;
        const taskId = `${currentTask.node}:${currentTask.id}`;
        const response = await apiClient.getTaskDetails(clusterId, taskId);
        setTaskDetails(response.task);
      })();
      // Per requirement: do not show success notification
    } catch (err) {
      showErrorNotification({ title: 'Refresh failed', message: getErrorMessage(err) });
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <ManagedModalRoot opened={isOpen} onClose={onClose} size="90%">
          <Modal.Overlay />
          <Modal.Content
            style={{
              maxWidth: '100%',
            }}
          >
            <Modal.Header>
              <Modal.Title>Task Details: {task.id}</Modal.Title>
              <ModalRefreshButton onRefresh={handleRefresh} loading={isRefreshing} tooltip="Refresh task details" />
              <Modal.CloseButton />
            </Modal.Header>

            <Modal.Body
              style={{
                maxHeight: 'calc(100vh - 120px)',
                overflow: 'auto',
              }}
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

                  {/* Basic Info as table for clarity */}
                  <div>
                    <Text fw={500} mb="sm">
                      Basic Information
                    </Text>
                    <Table verticalSpacing="xs">
                      <tbody>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Task ID:</td>
                          <td><Text size="sm" fw={500}>{task.id}</Text></td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Node:</td>
                        <td>
                          <Text
                            size="sm"
                            fw={500}
                            className="clickable-name"
                            onClick={() => openNodeModal?.(task.node)}
                            style={{ textTransform: 'none', padding: 0, margin: 0 }}
                          >
                            {task.node}
                          </Text>
                        </td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Type:</td>
                          <td><Badge style={{ textTransform: 'none' }}>{task.type}</Badge></td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Action:</td>
                          <td><Text size="sm" fw={500}>{task.action}</Text></td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Start Time:</td>
                          <td><Text size="sm" fw={500}>{formatTimestamp(task.start_time_in_millis)}</Text></td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Running Time:</td>
                          <td><Text size="sm" fw={500}>{formatUptime(runningTime)}</Text></td>
                        </tr>
                        <tr>
                          <td style={{ color: 'var(--mantine-color-dimmed)' }}>Cancellable:</td>
                          <td><Badge color={task.cancellable ? 'green' : 'gray'}>{task.cancellable ? 'Yes' : 'No'}</Badge></td>
                        </tr>
                        {task.parent_task_id && (
                          <tr>
                            <td style={{ color: 'var(--mantine-color-dimmed)' }}>Parent Task:</td>
                            <td>
                              {/* Render parent task as two clickable parts: node and task id */}
                              {(() => {
                                const p = task.parent_task_id || '';
                                const idx = p.lastIndexOf(':');
                                const nodePart = idx === -1 ? p : p.substring(0, idx);
                                const idPart = idx === -1 ? '' : p.substring(idx + 1);

                                return (
                                  <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
                                    <Text
                                      size="sm"
                                      fw={500}
                                      className="clickable-name"
                                      onClick={(e) => { e.stopPropagation(); openNodeModal?.(nodePart); }}
                                      style={{ textTransform: 'none', padding: 0, margin: 0 }}
                                    >
                                      {nodePart}
                                    </Text>
                                    <Text size="sm">:</Text>
                                    <Text
                                      size="sm"
                                      fw={500}
                                      className="clickable-name"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (!idPart) return;
                                        // Open a stacked TaskDetailsModal for the parent task
                                        const minimal: TaskInfo = ({ node: nodePart, id: idPart, start_time_in_millis: Date.now(), action: '', type: '', cancellable: false, cancelled: false } as unknown) as TaskInfo;
                                        setStackedTask(minimal);
                                        setIsStackedOpen(true);
                                      }}
                                      style={{ textTransform: 'none', padding: 0, margin: 0 }}
                                    >
                                      {idPart}
                                    </Text>
                                  </div>
                                );
                              })()}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </Table>
                    {/* Cancel action */}
                    {task.cancellable && !task.cancelled && (
                      <div style={{ marginTop: '0.5rem' }}>
                        {cancelError && <Alert icon={<IconAlertCircle size={16} />} color="red">{cancelError}</Alert>}
                        <Button color="red" size="sm" onClick={async () => {
                          // simple confirm
                          if (!confirm('Cancel this task?')) return;
                          try {
                            setIsCancelling(true);
                            setCancelError(null);
                            const taskId = `${task.node}:${task.id}`;
                            await apiClient.cancelTask(clusterId, taskId);
                            // refresh task details and tasks list
                            const resp = await apiClient.getTaskDetails(clusterId, taskId);
                            setTaskDetails(resp.task);
                            // invalidate tasks list queries for this cluster
                            queryClient.invalidateQueries({ predicate: (query) => {
                              const k = query.queryKey;
                              return Array.isArray(k) && k[0] === 'cluster' && k[1] === clusterId && k[2] === 'tasks';
                            }});
                          } catch (err) {
                            const message = err instanceof Error ? err.message : 'Failed to cancel task';
                            setCancelError(message);
                          } finally {
                            setIsCancelling(false);
                          }
                        }} loading={isCancelling}>
                          Cancel Task
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* JSON details (single view) */}
                  {isLoading ? (
                    <Group justify="center" py="xl">
                      <Loader />
                    </Group>
                  ) : taskDetails ? (
                    <JsonViewer
                      data={taskDetails.raw || taskDetails}
                      title="Task JSON"
                      height={500}
                      showCopyButton={true}
                    />
                  ) : null}
                </Stack>
              </motion.div>
            </Modal.Body>
          </Modal.Content>
        </ManagedModalRoot>
      )}
      {/* Stacked parent task modal */}
      {isStackedOpen && stackedTask && (
        <TaskDetailsModal
          task={stackedTask}
          isOpen={isStackedOpen}
          onClose={() => { setIsStackedOpen(false); setStackedTask(null); }}
          clusterId={clusterId}
          openNodeModal={openNodeModal}
        />
      )}
    </AnimatePresence>
  );
}
