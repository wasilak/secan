import { useEffect, useState, useCallback, useRef } from 'react';
import { TaskInfo, TasksListResponse } from '../types/api';
import { apiClient } from '../api/client';

/**
 * Hook for fetching and managing cluster tasks data
 *
 * Handles:
 * - Fetching tasks from API with filter support
 * - Client-side filtering by type and action
 * - Sorting by task properties
 * - Loading and error states
 * - Automatic refetching on demand
 *
 * Requirements: 1, 2, 3 (Task display with filtering)
 */
export function useTasksData(clusterId: string, refreshInterval?: number) {
  const [tasks, setTasks] = useState<TaskInfo[]>([]);
  const [uniqueTypes, setUniqueTypes] = useState<string[]>([]);
  const [uniqueActions, setUniqueActions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const refetchTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch tasks from API
  const fetchTasks = useCallback(
    async (filters?: { types?: string[]; actions?: string[] }) => {
      try {
        setIsLoading(true);
        setError(null);
        const response = await apiClient.getTasks(clusterId, filters);
        setTasks(response.tasks);
        setUniqueTypes(response.unique_types);
        setUniqueActions(response.unique_actions);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to fetch tasks');
        setError(error);
        console.error('Error fetching tasks:', error);
      } finally {
        setIsLoading(false);
      }
    },
    [clusterId]
  );

  // Initial fetch on mount or when clusterId changes
  useEffect(() => {
    fetchTasks();

    // Set up auto-refresh if interval is provided
    if (refreshInterval && refreshInterval > 0) {
      refetchTimeoutRef.current = setInterval(() => {
        fetchTasks();
      }, refreshInterval);
    }

    return () => {
      if (refetchTimeoutRef.current) {
        clearInterval(refetchTimeoutRef.current);
      }
    };
  }, [clusterId, refreshInterval, fetchTasks]);

  // Helper function to sort tasks
  const sortTasks = useCallback(
    (tasksToSort: TaskInfo[], sortBy: string | null, sortOrder: 'asc' | 'desc' | 'none') => {
      if (!sortBy || sortOrder === 'none') {
        return tasksToSort;
      }

      const sorted = [...tasksToSort].sort((a, b) => {
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

      return sorted;
    },
    []
  );

  // Helper function to filter tasks
  const filterTasks = useCallback(
    (tasksToFilter: TaskInfo[], selectedTypes: string[], selectedActions: string[]) => {
      return tasksToFilter.filter((task) => {
        const typeMatch = selectedTypes.length === 0 || selectedTypes.includes(task.type as string);
        const actionMatch =
          selectedActions.length === 0 || selectedActions.includes(task.action);
        return typeMatch && actionMatch;
      });
    },
    []
  );

  // Calculate running time for display
  const enhancedTasks = tasks.map((task) => ({
    ...task,
    running_time_millis: Date.now() - task.start_time_in_millis,
  }));

  return {
    tasks: enhancedTasks,
    uniqueTypes,
    uniqueActions,
    isLoading,
    error,
    refetch: fetchTasks,
    sortTasks,
    filterTasks,
  };
}
