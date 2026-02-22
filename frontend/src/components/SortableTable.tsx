import { useState, useMemo } from 'react';
import { Table, UnstyledButton, Text } from '@mantine/core';
import { IconChevronUp, IconChevronDown, IconSelector } from '@tabler/icons-react';

/**
 * Sort configuration for a table
 */
export interface SortConfig<T> {
  key: keyof T;
  direction: 'asc' | 'desc';
}

/**
 * Column configuration for sortable table
 */
export interface SortableTableColumn<T> {
  key: keyof T;
  label: string;
  sortable?: boolean;
  defaultSort?: 'asc' | 'desc';
  render?: (value: T[keyof T], row: T) => React.ReactNode;
}

/**
 * Props for SortableTable component
 */
export interface SortableTableProps<T> {
  data: T[];
  columns: SortableTableColumn<T>[];
  defaultSort?: SortConfig<T>;
  onRowClick?: (row: T) => void;
}

/**
 * SortableTable component provides a reusable table with sortable column headers.
 *
 * Features:
 * - Three-state sorting: ascending -> descending -> unsorted
 * - Visual indicators for sort state (arrows)
 * - Support for default sort configuration
 * - Custom render functions for columns
 * - Optional row click handlers
 *
 * Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.7
 */
export function SortableTable<T>({
  data,
  columns,
  defaultSort,
  onRowClick,
}: SortableTableProps<T>): React.JSX.Element {
  const [sortConfig, setSortConfig] = useState<SortConfig<T> | null>(defaultSort || null);

  /**
   * Handle column header click for sorting
   * Implements three-state cycle: asc -> desc -> null (unsorted)
   * Requirements: 8.2, 8.3, 8.4
   */
  const handleSort = (column: SortableTableColumn<T>) => {
    if (!column.sortable) return;

    setSortConfig((current) => {
      // If clicking a different column, start with ascending
      if (!current || current.key !== column.key) {
        return { key: column.key, direction: 'asc' };
      }

      // If clicking the same column, cycle through states
      if (current.direction === 'asc') {
        return { key: column.key, direction: 'desc' };
      }

      // Third click: remove sort (return to default if exists)
      if (current.direction === 'desc') {
        return defaultSort || null;
      }

      return null;
    });
  };

  /**
   * Sort data based on current sort configuration
   */
  const sortedData = useMemo(() => {
    if (!sortConfig) {
      return data;
    }

    const sorted = [...data].sort((a, b) => {
      const aValue = a[sortConfig.key];
      const bValue = b[sortConfig.key];

      // Handle null/undefined values
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;

      // String comparison
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortConfig.direction === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      // Numeric comparison
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortConfig.direction === 'asc' ? aValue - bValue : bValue - aValue;
      }

      // Fallback: convert to string and compare
      const aStr = String(aValue);
      const bStr = String(bValue);
      return sortConfig.direction === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });

    return sorted;
  }, [data, sortConfig]);

  /**
   * Render sort indicator icon
   * Requirements: 8.5, 8.7
   */
  const renderSortIcon = (column: SortableTableColumn<T>) => {
    if (!column.sortable) return null;

    const isActive = sortConfig?.key === column.key;

    if (isActive && sortConfig?.direction === 'asc') {
      return <IconChevronUp size={14} aria-hidden="true" />;
    }

    if (isActive && sortConfig?.direction === 'desc') {
      return <IconChevronDown size={14} aria-hidden="true" />;
    }

    return <IconSelector size={14} opacity={0.5} aria-hidden="true" />;
  };

  /**
   * Get sort label for accessibility
   */
  const getSortLabel = (column: SortableTableColumn<T>) => {
    if (!column.sortable) return '';

    const isActive = sortConfig?.key === column.key;
    if (isActive) {
      return `Sorted ${sortConfig?.direction === 'asc' ? 'ascending' : 'descending'}`;
    }

    return 'Not sorted';
  };

  return (
    <Table striped highlightOnHover>
      <Table.Thead>
        <Table.Tr>
          {columns.map((column) => (
            <Table.Th key={String(column.key)}>
              {column.sortable ? (
                <UnstyledButton
                  onClick={() => handleSort(column)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    width: '100%',
                  }}
                  aria-label={`Sort by ${column.label}, ${getSortLabel(column)}`}
                >
                  <Text fw={500}>{column.label}</Text>
                  {renderSortIcon(column)}
                </UnstyledButton>
              ) : (
                <Text fw={500}>{column.label}</Text>
              )}
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {sortedData.map((row, index) => (
          <Table.Tr
            key={index}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            style={onRowClick ? { cursor: 'pointer' } : undefined}
          >
            {columns.map((column) => (
              <Table.Td key={String(column.key)}>
                {column.render
                  ? column.render(row[column.key], row)
                  : String(row[column.key] ?? '')}
              </Table.Td>
            ))}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}
