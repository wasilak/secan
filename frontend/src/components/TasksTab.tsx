import React, { useState, useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';
import { Stack, LoadingOverlay, Alert, Button, Group, Modal, Text, Grid } from '@mantine/core';
import { IconAlertCircle, IconTrash } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { TaskInfo } from '../types/api';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { FilterSidebar } from './FacetedFilter';
import { TasksTable } from './TasksTable';
import { TaskDetailsModal } from './TaskDetailsModal';
import { TaskStatsCards } from './TaskStatsCards';
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
  isActive: boolean;
}

export function TasksTab({ clusterId, isActive }: TasksTabProps): ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedTask, setSelectedTask] = useState<TaskInfo | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [bulkCancelModalOpen, setBulkCancelModalOpen] = useState(false);
  const [isBulkCancelling, setIsBulkCancelling] = useState(false);
  const { selectedIndices, toggleSelection, selectAll, clearSelection, count } = useBulkSelection();

  // Get filters from URL params - memoize to prevent dependency issues
  const selectedTypes = useMemo(() => 
    searchParams.get('taskTypes')?.split(',').filter(Boolean) || [], 
    [searchParams]
  );
  const selectedActions = useMemo(() => 
    searchParams.get('taskActions')?.split(',').filter(Boolean) || [], 
    [searchParams]
  );
  const sortBy = searchParams.get('taskSortBy') || null;
  const sortOrder = (searchParams.get('taskSortOrder') || 'none') as 'asc' | 'desc' | 'none';

  // Memoize filters object to prevent unnecessary refetches
  const filters = useMemo(() => ({
    types: selectedTypes.length > 0 ? selectedTypes : undefined,
    actions: selectedActions.length > 0 ? selectedActions : undefined,
  }), [selectedTypes, selectedActions]);

  // Fetch tasks with auto-refresh and server-side filtering
  const refreshInterval = useRefreshInterval();
  const {
    data: tasksResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['cluster', clusterId, 'tasks', filters],
    queryFn: () => apiClient.getTasks(clusterId, filters),
    enabled: isActive,
    refetchInterval: refreshInterval,
    placeholderData: (previousData) => previousData,
  });

  // Memoize tasks to prevent dependency issues in other useMemo hooks
  const tasks = useMemo(() => tasksResponse?.tasks || [], [tasksResponse?.tasks]);
  const uniqueTypes = tasksResponse?.unique_types || [];
  const uniqueActions = tasksResponse?.unique_actions || [];

  // Calculate stats from server data (memoized)
  const stats = useMemo(() => ({
    totalTasks: tasks.length,
    runningTasks: tasks.filter(t => !t.cancelled).length,
    cancellableTasks: tasks.filter(t => t.cancellable && !t.cancelled).length,
    cancelledTasks: tasks.filter(t => t.cancelled).length,
  }), [tasks]);

  // Client-side sorting only (server handles filtering)
  const sortedTasks = useMemo(() => {
    if (!sortBy || sortOrder === 'none') {
      return tasks;
    }

    return [...tasks].sort((a, b) => {
      const aVal = a[sortBy as keyof TaskInfo];
      const bVal = b[sortBy as keyof TaskInfo];

      if (aVal === undefined || bVal === undefined) {
        return 0;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortOrder === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal);
      const bStr = String(bVal);
      return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
  }, [tasks, sortBy, sortOrder]);

  // Handle sort column click
  const handleSort = useCallback((column: string) => {
    const params = new URLSearchParams(searchParams);
    params.set('taskSortBy', column);
    
    const currentOrder = searchParams.get('taskSortOrder') || 'none';
    if (currentOrder === 'none') {
      params.set('taskSortOrder', 'asc');
    } else if (currentOrder === 'asc') {
      params.set('taskSortOrder', 'desc');
    } else {
      params.delete('taskSortBy');
      params.delete('taskSortOrder');
    }
    
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Handle filter changes
  const handleTypesChange = useCallback((types: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (types.length > 0) {
      params.set('taskTypes', types.join(','));
    } else {
      params.delete('taskTypes');
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  const handleActionsChange = useCallback((actions: string[]) => {
    const params = new URLSearchParams(searchParams);
    if (actions.length > 0) {
      params.set('taskActions', actions.join(','));
    } else {
      params.delete('taskActions');
    }
    setSearchParams(params);
  }, [searchParams, setSearchParams]);

  // Handle task row click to open details
  const handleTaskClick = useCallback((task: TaskInfo) => {
    setSelectedTask(task);
    setIsDetailModalOpen(true);
  }, []);

  // Handle bulk task cancellation
  const handleBulkCancel = useCallback(async () => {
    try {
      setIsBulkCancelling(true);
      const taskIds = Array.from(selectedIndices);
      await Promise.all(taskIds.map(taskId => apiClient.cancelTask(clusterId, taskId)));
      clearSelection();
      setBulkCancelModalOpen(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel tasks';
      setCancelError(message);
    } finally {
      setIsBulkCancelling(false);
    }
  }, [selectedIndices, clusterId, clearSelection]);

  // Detect if any filters are active
  const hasActiveFilters = selectedTypes.length > 0 || selectedActions.length > 0;

  // Only show "No tasks found" if there are truly no tasks AND no filters active
  if (!isLoading && !error && tasks.length === 0 && !hasActiveFilters) {
    return (
      <Stack gap="lg" style={{ width: '100%', padding: '0 1rem' }}>
        <Text c="dimmed" ta="center" py="xl">
          No active tasks found
        </Text>
      </Stack>
    );
  }

  return (
    <Grid gutter="md" p="md" overflow="hidden">
      <Grid.Col span={12}>
        <TaskStatsCards stats={stats} />
      </Grid.Col>
      <Grid.Col span={12}>
        <Group gap="md" wrap="nowrap" align="flex-start">
          <FilterSidebar
            categories={[
              {
                title: 'Task Type',
                options: uniqueTypes.map((type) => ({ label: type, value: type })),
                selected: selectedTypes,
                onChange: handleTypesChange,
              },
              {
                title: 'Task Action',
                options: uniqueActions.map((action) => ({ label: action, value: action })),
                selected: selectedActions,
                onChange: handleActionsChange,
              },
            ]}
          />
          <Stack gap="lg" style={{ flex: 1 }}>
            {/* Error Alert */}
            {error && (
              <Alert icon={<IconAlertCircle size={16} />} color="red">
                Failed to load tasks: {error.message}
              </Alert>
            )}

            {/* Bulk Actions Bar */}
            {count > 0 && (
              <Group justify="space-between" style={{ padding: '0.75rem 1rem', backgroundColor: '#f0f9ff', borderRadius: '0.5rem', border: '1px solid #bfdbfe' }}>
                <Text size="sm" fw={500}>
                  {count} task{count !== 1 ? 's' : ''} selected
                </Text>
                <Button
                  color="red"
                  variant="light"
                  size="sm"
                  leftSection={<IconTrash size={14} />}
                  onClick={() => setBulkCancelModalOpen(true)}
                  loading={isBulkCancelling}
                >
                  Cancel Selected
                </Button>
              </Group>
            )}

            {/* Table with Loading Overlay */}
            <div style={{ position: 'relative' }}>
              <LoadingOverlay visible={isLoading} zIndex={1000} />
              {sortedTasks.length === 0 ? (
                <Text c="dimmed" ta="center" py="xl">
                  No tasks match your filters
                </Text>
              ) : (
                <TasksTable
                  tasks={sortedTasks}
                  sortBy={sortBy}
                  sortOrder={sortOrder}
                  onSort={handleSort}
                  onRowClick={handleTaskClick}
                  selectedTasks={selectedIndices}
                  onToggleSelect={toggleSelection}
                  onSelectAll={(tasks) => selectAll(tasks.map(t => `${t.node}:${t.id}`))}
                  onClearSelection={clearSelection}
                />
              )}
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

            {/* Bulk Cancel Confirmation Modal */}
            <Modal
              opened={bulkCancelModalOpen}
              onClose={() => setBulkCancelModalOpen(false)}
              title="Cancel Tasks"
              centered
            >
              <Stack gap="md">
                <Text size="sm">
                  Are you sure you want to cancel {count} task{count !== 1 ? 's' : ''}?
                </Text>
                {cancelError && (
                  <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
                    {cancelError}
                  </Alert>
                )}
                <Group justify="flex-end">
                  <Button variant="light" onClick={() => setBulkCancelModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button color="red" onClick={handleBulkCancel} loading={isBulkCancelling}>
                    Confirm
                  </Button>
                </Group>
              </Stack>
            </Modal>
          </Stack>
        </Group>
      </Grid.Col>
    </Grid>
  );
}
