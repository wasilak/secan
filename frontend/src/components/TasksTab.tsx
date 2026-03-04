import React, { useState, useCallback } from 'react';
import type { ReactElement } from 'react';
import { Stack, Container, LoadingOverlay, Alert } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { TaskInfo } from '../types/api';
import { useTasksData } from '../hooks/useTasksData';
import { TasksFilters } from './TasksFilters';
import { TasksTable } from './TasksTable';
import { TaskDetailsModal } from './TaskDetailsModal';
import { TaskActionsMenu } from './TaskActionsMenu';
import { apiClient } from '../api/client';

/**
 * Tasks tab container component
 *
 * Orchestrates all task management UI components:
 * - Filters for type and action
 * - Sortable table display
 * - Task details modal
 * - Task cancellation
 *
 * Manages state for:
 * - Active sort column and order
 * - Selected filters
 * - Selected task for details modal
 *
 * Requirements: 1, 2, 3, 4, 5 (All task requirements)
 */
interface TasksTabProps {
  clusterId: string;
  refreshInterval?: number;
}

export function TasksTab({ clusterId, refreshInterval }: TasksTabProps): ReactElement {
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [selectedActions, setSelectedActions] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | 'none'>('none');
  const [selectedTask, setSelectedTask] = useState<TaskInfo | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isCancellingTask, setIsCancellingTask] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Fetch tasks with auto-refresh
  const { tasks, uniqueTypes, uniqueActions, isLoading, error, filterTasks, sortTasks } =
    useTasksData(clusterId, refreshInterval);

  // Filter and sort tasks
  const filteredTasks = filterTasks(tasks, selectedTypes, selectedActions);
  const displayTasks = sortTasks(filteredTasks, sortBy, sortOrder);

  // Handle sort column click
  const handleSort = useCallback((column: string) => {
    setSortBy(column);
    setSortOrder((prev) => {
      if (prev === 'none') return 'asc';
      if (prev === 'asc') return 'desc';
      return 'none';
    });
  }, []);

  // Handle task row click to open details
  const handleTaskClick = useCallback((task: TaskInfo) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  }, []);

  // Handle task cancellation
  const handleCancelTask = useCallback(
    async (taskId: string) => {
      try {
        setIsCancellingTask(true);
        setCancelError(null);
        await apiClient.cancelTask(clusterId, taskId);
        // Refetch tasks after successful cancellation
        setIsDetailModalOpen(false);
        setSelectedTask(null);
        // In production, trigger a refetch of tasks
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to cancel task';
        setCancelError(message);
      } finally {
        setIsCancellingTask(false);
      }
    },
    [clusterId]
  );

  return (
    <Container size="xl" py="md" fluid>
      <Stack gap="lg">
        {/* Error Alert */}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red">
            Failed to load tasks: {error.message}
          </Alert>
        )}

        {/* Filters */}
        <TasksFilters
          uniqueTypes={uniqueTypes}
          uniqueActions={uniqueActions}
          selectedTypes={selectedTypes}
          selectedActions={selectedActions}
          onTypesChange={setSelectedTypes}
          onActionsChange={setSelectedActions}
        />

        {/* Table with Loading Overlay */}
        <div style={{ position: 'relative' }}>
          <LoadingOverlay visible={isLoading} zIndex={1000} />
          <TasksTable
            tasks={displayTasks}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
            onRowClick={handleTaskClick}
            onCancel={selectedTask ? () => handleCancelTask(`${selectedTask.node}:${selectedTask.id}`) : undefined}
            isLoadingCancel={isCancellingTask}
          />
        </div>

        {/* Task Details Modal */}
        <TaskDetailsModal
          task={selectedTask}
          isOpen={isDetailModalOpen}
          onClose={() => {
            setIsDetailModalOpen(false);
            setSelectedTask(null);
            setCancelError(null);
          }}
          clusterId={clusterId}
        />
      </Stack>
    </Container>
  );
}
