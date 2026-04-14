import React from 'react';
import type { ReactElement } from 'react';
import { Table, Text, Tooltip, Group, Badge, Checkbox, UnstyledButton } from '@mantine/core';
import { TaskInfo } from '../types/api';
import { formatTimestamp } from '../utils/formatters';

/**
 * Format milliseconds to readable uptime string
 */
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

/**
 * Tasks table component for displaying active tasks
 *
 * Displays sortable table with columns:
 * - Node ID
 * - Task ID
 * - Type
 * - Action
 * - Start Time
 * - Running Time
 * - Cancellable
 * - Actions
 *
 * Requirements: 1 (Task display)
 */
interface TasksTableProps {
  tasks: TaskInfo[];
  sortBy: string | null;
  sortOrder: 'asc' | 'desc' | 'none';
  onSort: (column: string) => void;
  // Only the Task ID cell should open details. Provide a dedicated handler.
  onTaskIdClick?: (task: TaskInfo) => void;
  selectedTasks?: Set<string>;
  onToggleSelect?: (taskId: string) => void;
  onSelectAll?: (tasks: TaskInfo[]) => void;
  onClearSelection?: () => void;
  // Optional mapping from node id (or node name) to display name
  nodeNameMap?: Record<string, string>;
  // Optional handler to open node modal; if provided the node name will be clickable
  openNodeModal?: (nodeId: string) => void;
}

export const TasksTable = React.memo(function TasksTable({
  tasks,
  sortBy,
  sortOrder,
  onSort,
  onTaskIdClick,
  selectedTasks = new Set(),
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  nodeNameMap,
  openNodeModal,
}: TasksTableProps): ReactElement {
  const cancellableTasks = tasks.filter(task => task.cancellable);
  const allSelected = cancellableTasks.length > 0 && cancellableTasks.every((task) => selectedTasks.has(`${task.node}:${task.id}`));
  const SortableHeader = ({ label, column }: { label: string; column: string }) => (
    <Table.Th
      onClick={() => onSort(column)}
      style={{ cursor: 'pointer', userSelect: 'none' }}
    >
      <Group gap={4}>
        <span>{label}</span>
        {sortBy === column && (
          <Text size="xs" c="blue">
            {sortOrder === 'asc' ? '↑' : '↓'}
          </Text>
        )}
      </Group>
    </Table.Th>
  );

  if (tasks.length === 0) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <Text c="dimmed">No active tasks</Text>
      </div>
    );
  }

  return (
    <Table 
      striped 
      highlightOnHover
      styles={{
        td: { 
          padding: '0.75rem 1rem',
          lineHeight: '1.5',
          verticalAlign: 'middle',
        },
        th: {
          padding: '0.75rem 1rem',
          lineHeight: '1.5',
        },
      }}
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th style={{ width: '2.5rem' }}>
            <Checkbox
              checked={allSelected}
              indeterminate={selectedTasks.size > 0 && !allSelected}
              disabled={cancellableTasks.length === 0}
              onChange={() => {
                if (allSelected) {
                  onClearSelection?.();
                } else if (onSelectAll) {
                  onSelectAll(cancellableTasks);
                }
              }}
            />
          </Table.Th>
          {/* Make Task ID the left-most data column after selection */}
          <SortableHeader label="Task ID" column="id" />
          <SortableHeader label="Node ID" column="node" />
          <SortableHeader label="Type" column="type" />
          <SortableHeader label="Action" column="action" />
          <SortableHeader label="Start Time" column="start_time_in_millis" />
          <SortableHeader label="Running Time" column="running_time_millis" />
          <Table.Th>Cancellable</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tasks.map((task) => {
          const taskId = `${task.node}:${task.id}`;
          return (
          <Table.Tr
            key={taskId}
            // row-level clicks should NOT open the details modal anymore
          >
            <Table.Td onClick={(e) => e.stopPropagation()}>
              <Checkbox
                checked={selectedTasks.has(taskId)}
                disabled={!task.cancellable}
                onChange={() => onToggleSelect?.(taskId)}
              />
            </Table.Td>
            {/* Task ID cell: the only cell that opens details */}
            <Table.Td>
              <UnstyledButton
                onClick={(e) => {
                  e.stopPropagation();
                  onTaskIdClick?.(task);
                }}
                aria-label={`Open task ${task.id} details`}
                style={{ padding: 0, margin: 0, display: 'inline-block', textAlign: 'left' }}
              >
                <Text size="sm" truncate style={{ textDecoration: onTaskIdClick ? 'underline' : undefined }}>
                  {task.id}
                </Text>
              </UnstyledButton>
            </Table.Td>
            <Table.Td>
              {nodeNameMap && nodeNameMap[task.node] ? (
                <Tooltip label={nodeNameMap[task.node]}>
                  <UnstyledButton
                    onClick={(e) => {
                      e.stopPropagation();
                      openNodeModal?.(task.node);
                    }}
                    aria-label={`Open node ${nodeNameMap[task.node]} details`}
                    style={{ padding: 0, margin: 0, display: 'inline-block', textAlign: 'left' }}
                  >
                    <Text size="sm" truncate style={{ textDecoration: openNodeModal ? 'underline' : undefined }}>
                      {nodeNameMap[task.node]}
                    </Text>
                  </UnstyledButton>
                </Tooltip>
              ) : (
                <Tooltip label={task.node}>
                  <Text size="sm" truncate>
                    {task.node.substring(0, 8)}...
                  </Text>
                </Tooltip>
              )}
            </Table.Td>
            <Table.Td>
              <Badge size="sm">{task.type}</Badge>
            </Table.Td>
            <Table.Td>
              <Tooltip label={task.action}>
                <Text size="sm" truncate>
                  {task.action}
                </Text>
              </Tooltip>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatTimestamp(task.start_time_in_millis)}</Text>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{formatUptime(task.running_time_millis || 0)}</Text>
            </Table.Td>
            <Table.Td>
              <Badge
                color={task.cancellable ? 'green' : 'gray'}
                size="sm"
              >
                {task.cancellable ? 'Yes' : 'No'}
              </Badge>
            </Table.Td>

            </Table.Tr>
            );
            })}
            </Table.Tbody>
    </Table>
  );
});
