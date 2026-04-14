import React, { useState, useCallback, useMemo } from 'react';
import type { ReactElement } from 'react';
import { Stack, Alert, Button, Group, Modal, Text, Grid, Table, Card, Box } from '@mantine/core';
import { IconAlertCircle, IconTrash } from '@tabler/icons-react';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useClusterNodes } from '../hooks/useClusterNodes';
import { TaskInfo } from '../types/api';
import { TablePagination } from './TablePagination';
import { useBulkSelection } from '../hooks/useBulkSelection';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { FilterSidebar } from './FacetedFilter';
import { TasksTable } from './TasksTable';
import { TaskDetailsModal } from './TaskDetailsModal';
import { TaskStatsCards } from './TaskStatsCards';
import { apiClient } from '../api/client';
import { useTablePagination } from '../hooks/useTablePagination';
import { queryKeys } from '../utils/queryKeys';
import TableSkeleton from './TableSkeleton';

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
  // optional handler forwarded from ClusterView to open node modal without remounting
  openNodeModal?: (nodeId: string) => void;
  // Optional prebuilt map from node id (or name) -> display name. When provided
  // TasksTab will use this instead of fetching nodes itself. This avoids
  // duplicate network calls when the surrounding ClusterView already loaded
  // node data.
  nodeNameMap?: Record<string, string>;
}

export function TasksTab({ clusterId, isActive, openNodeModal, nodeNameMap }: TasksTabProps): ReactElement {
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
  // Pagination state for server-side paging
  const { page: tasksPage, pageSize: tasksPerPage, setPage: setTasksPage, setPageSize: setTasksPerPage, getPaginationProps } = useTablePagination(1, 20);

  const {
    data: tasksResponse,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryKeys.cluster(clusterId!).tasks(
      `${JSON.stringify(filters || {})}|p=${tasksPage}|ps=${tasksPerPage}`
    ),
    queryFn: () => apiClient.getTasks(clusterId, tasksPage, tasksPerPage, filters),
    enabled: isActive,
    refetchInterval: refreshInterval,
    placeholderData: (previousData) => previousData,
  });

  // Normalize response
  // Normalize response: support both legacy { tasks: [] } and paginated { items: [], total } shapes
  const tasks = useMemo(() => {
    const resp = tasksResponse as any;
    if (!resp) return [] as TaskInfo[];
    if (Array.isArray(resp.items)) return resp.items as TaskInfo[];
    if (Array.isArray(resp.tasks)) return resp.tasks as TaskInfo[];
    return [] as TaskInfo[];
  }, [tasksResponse]);
  const uniqueTypes = (tasksResponse as any)?.unique_types || (tasksResponse as any)?.uniqueTypes || [];
  const uniqueActions = (tasksResponse as any)?.unique_actions || (tasksResponse as any)?.uniqueActions || [];
  const totalTasks = (tasksResponse as any)?.total ?? (Array.isArray((tasksResponse as any)?.tasks) ? (tasksResponse as any).tasks.length : tasks.length);
  const totalPages = (tasksResponse as any)?.total_pages ?? Math.max(1, Math.ceil(totalTasks / tasksPerPage));

  // Calculate stats from server data (memoized)
  const stats = useMemo(() => ({
    totalTasks: tasks.length,
    runningTasks: tasks.filter((t: TaskInfo) => !t.cancelled).length,
    cancellableTasks: tasks.filter((t: TaskInfo) => t.cancellable && !t.cancelled).length,
    cancelledTasks: tasks.filter((t: TaskInfo) => t.cancelled).length,
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

  // Build or reuse a nodeNameMap for TasksTable. If a prebuilt map is provided
  // by the parent (ClusterView), prefer it to avoid duplicate fetching. Only
  // call useClusterNodes when we don't have a map already and the tab is active.
  const { data: nodesPaginated } = useClusterNodes(clusterId, {
    page: 1,
    pageSize: 1000,
    enabled: !!clusterId && isActive && !nodeNameMap,
    placeholderData: (previousData) => previousData,
  });

  // If parent provided nodeNameMap via props, use it; otherwise derive from fetched nodes
  const derivedNodeNameMap = nodeNameMap;

  const nodeNameMapComputed = useMemo(() => {
    if (derivedNodeNameMap) return derivedNodeNameMap;
    const map: Record<string, string> = {};
    const items = nodesPaginated?.items || [];
    for (const n of items) {
      if (n.id) map[n.id] = n.name || n.id;
      if (n.name) map[n.name] = n.name; // allow lookup by name too
    }
    return map;
  }, [derivedNodeNameMap, nodesPaginated?.items]);

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
                options: uniqueTypes.map((type: string) => ({ label: type, value: type })),
                    selected: selectedTypes,
                    onChange: handleTypesChange,
                  },
                  {
                    title: 'Task Action',
                options: uniqueActions.map((action: string) => ({ label: action, value: action })),
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

            {/* Table or skeleton while loading - wrapped in Card + native overflow Box
                to match ShardsList pattern and avoid Mantine ScrollArea chrome. */}
            <Card shadow="sm" padding="lg">
              <Box className="table-overflow" style={{ width: '100%' }}>
                {isLoading ? (
                  <Table striped highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th style={{ width: '2.5rem' }} />
                        <Table.Th>Node ID</Table.Th>
                        <Table.Th>Task ID</Table.Th>
                        <Table.Th>Type</Table.Th>
                        <Table.Th>Action</Table.Th>
                        <Table.Th>Start Time</Table.Th>
                        <Table.Th>Running Time</Table.Th>
                        <Table.Th>Cancellable</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <TableSkeleton columnCount={8} rowCount={6} />
                  </Table>
                ) : sortedTasks.length === 0 ? (
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
                    nodeNameMap={nodeNameMapComputed}
                    openNodeModal={openNodeModal}
                  />
                )}
              </Box>
            </Card>
            {/* Pagination controls - use full variant */}
            <TablePagination {...getPaginationProps(totalTasks, totalPages)} />

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
