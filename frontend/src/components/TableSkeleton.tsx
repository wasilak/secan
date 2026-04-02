import React from 'react';
import { Skeleton } from '@mantine/core';

interface TableSkeletonProps {
  columnCount?: number;
  rowCount?: number;
}

/**
 * Small reusable table-body skeleton shown while table data is loading.
 * Renders a <tbody> with a configurable number of rows/columns so it can
 * be dropped directly into Mantine <Table> components.
 */
export function TableSkeleton({ columnCount = 6, rowCount = 6 }: TableSkeletonProps) {
  return (
    <tbody>
      {Array.from({ length: rowCount }).map((_, r) => (
        <tr key={r}>
          {Array.from({ length: columnCount }).map((_, c) => (
            <td key={c} style={{ padding: '0.5rem 0.75rem', verticalAlign: 'middle' }}>
              <Skeleton height={16} radius="sm" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export default TableSkeleton;
