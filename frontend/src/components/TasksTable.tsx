import React from 'react';
import type { ReactElement } from 'react';
import { Table, Text, Tooltip, Group, Badge, Button, Menu } from '@mantine/core';
import { IconDots, IconTrash } from '@tabler/icons-react';
import { TaskInfo } from '../types/api';

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
 * Format timestamp to readable date
 */
function formatTimestamp(millis: number): string {
  return new Date(millis).toLocaleString();
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
  onRowClick: (task: TaskInfo) => void;
  onCancel?: (task: TaskInfo) => void;
  isLoadingCancel?: boolean;
}

export function TasksTable({
  tasks,
  sortBy,
  sortOrder,
  onSort,
  onRowClick,
  onCancel,
  isLoadingCancel,
}: TasksTableProps): ReactElement {
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
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          <SortableHeader label="Node ID" column="node" />
          <SortableHeader label="Task ID" column="id" />
          <SortableHeader label="Type" column="type" />
          <SortableHeader label="Action" column="action" />
          <SortableHeader label="Start Time" column="start_time_in_millis" />
          <SortableHeader label="Running Time" column="running_time_millis" />
          <Table.Th>Cancellable</Table.Th>
          <Table.Th>Actions</Table.Th>
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {tasks.map((task) => (
          <Table.Tr
            key={`${task.node}:${task.id}`}
            onClick={() => onRowClick(task)}
            style={{ cursor: 'pointer' }}
          >
            <Table.Td>
              <Tooltip label={task.node}>
                <Text size="sm" truncate>
                  {task.node.substring(0, 8)}...
                </Text>
              </Tooltip>
            </Table.Td>
            <Table.Td>
              <Text size="sm">{task.id}</Text>
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
            <Table.Td>
              {task.cancellable && onCancel && (
                <Menu shadow="md">
                  <Menu.Target>
                    <Button
                      variant="subtle"
                      size="xs"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <IconDots size={16} />
                    </Button>
                  </Menu.Target>
                  <Menu.Dropdown>
                    <Menu.Item
                      leftSection={<IconTrash size={14} />}
                      color="red"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCancel(task);
                      }}
                      disabled={isLoadingCancel}
                    >
                      Cancel Task
                    </Menu.Item>
                  </Menu.Dropdown>
                </Menu>
              )}
            </Table.Td>
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
