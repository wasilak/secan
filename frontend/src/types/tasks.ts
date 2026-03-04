/**
 * Task management types for cluster tasks API
 * 
 * Corresponds to Elasticsearch Tasks API endpoints:
 * - GET /_tasks
 * - GET /_tasks/{task_id}
 * - POST /_tasks/{task_id}/_cancel
 */

/**
 * Basic task information from task list
 */
export interface TaskInfo {
  /** Node ID where task is running */
  node: string;
  
  /** Unique task ID within the node */
  id: number;
  
  /** Task type (e.g., "transport", "management", "search") */
  type: string;
  
  /** Task action (e.g., "cluster:monitor/tasks/lists", "indices:data/read/search") */
  action: string;
  
  /** Start time in milliseconds since epoch */
  start_time_in_millis: number;
  
  /** Whether the task can be cancelled */
  cancellable: boolean;
  
  /** Whether the task has been cancelled */
  cancelled: boolean;
  
  /** Parent task ID if this is a subtask */
  parent_task_id?: string;
  
  /** Running time in milliseconds (calculated from now - start time) */
  running_time_millis?: number;
}

/**
 * Detailed task information from single task API
 */
export interface TaskDetails extends TaskInfo {
  /** Raw Elasticsearch response for full task details */
  raw?: Record<string, unknown>;
}

/**
 * Response from list tasks endpoint
 */
export interface TasksListResponse {
  tasks: TaskInfo[];
  unique_types: string[];
  unique_actions: string[];
  timestamp: number;
}

/**
 * Response from get task details endpoint
 */
export interface TaskDetailsResponse {
  task: TaskDetails;
}

/**
 * Response from cancel task endpoint
 */
export interface CancelTaskResponse {
  success: boolean;
  message: string;
}

/**
 * Filter state for task list
 */
export interface TasksFilterState {
  selectedTypes: Set<string>;
  selectedActions: Set<string>;
}

/**
 * Composite state for tasks view
 */
export interface TasksViewState {
  tasks: TaskInfo[];
  uniqueTypes: string[];
  uniqueActions: string[];
  selectedTypes: string[];
  selectedActions: string[];
  sortBy: keyof TaskInfo | null;
  sortOrder: 'asc' | 'desc' | 'none';
  isLoading: boolean;
  error: Error | null;
  selectedTaskId: string | null;
}

/**
 * Props for tasks table component
 */
export interface TasksTableProps {
  tasks: TaskInfo[];
  sortBy: string | null;
  sortOrder: 'asc' | 'desc' | 'none';
  onSort: (column: string) => void;
  onRowClick: (task: TaskInfo) => void;
}

/**
 * Props for tasks filters component
 */
export interface TasksFiltersProps {
  uniqueTypes: string[];
  uniqueActions: string[];
  selectedTypes: string[];
  selectedActions: string[];
  onTypesChange: (types: string[]) => void;
  onActionsChange: (actions: string[]) => void;
}

/**
 * Props for task details modal
 */
export interface TaskDetailsModalProps {
  task: TaskInfo | null;
  isOpen: boolean;
  onClose: () => void;
  clusterId: string;
}

/**
 * Props for task actions menu
 */
export interface TaskActionsMenuProps {
  task: TaskInfo;
  onCancel: () => Promise<void>;
  isLoading?: boolean;
}

/**
 * API request query parameters for listing tasks
 */
export interface TasksQueryParams {
  type_filter?: string;
  action_filter?: string;
}

/**
 * Error response from tasks API
 */
export interface TaskErrorResponse {
  error: string;
  message: string;
}

/**
 * Combined composite ID for tasks (node:id)
 */
export type TaskId = `${string}:${number}`;

/**
 * Helper to create task ID from node and id
 */
export function createTaskId(node: string, id: number): TaskId {
  return `${node}:${id}` as TaskId;
}

/**
 * Helper to parse task ID into components
 */
export function parseTaskId(taskId: TaskId): { node: string; id: number } {
  const [node, idStr] = taskId.split(':');
  return { node, id: parseInt(idStr, 10) };
}
