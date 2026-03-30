import { Group, Pagination, Select, Text } from '@mantine/core';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
  simple?: boolean;
}

/**
 * TablePagination component provides pagination controls with per-page selector
 *
 * Features:
 * - Page navigation
 * - Configurable page size
 * - Item count display
 */
export function TablePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100, 200],
  simple = false,
}: TablePaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (simple) {
    return (
      <Group justify="space-between" mt="md" wrap="nowrap">
        <div style={{ flex: 1 }} />

        <Pagination total={totalPages} value={currentPage} onChange={onPageChange} size="sm" />

        <Text size="sm" c="dimmed" style={{ minWidth: '120px', textAlign: 'right' }}>
          {startItem}-{endItem} of {totalItems}
        </Text>
      </Group>
    );
  }

  return (
    <Group justify="space-between" mt="md" wrap="nowrap">
      {/* Hide per-page selector in modals / simplified tables per UX request. */}
      <div style={{ flex: 1 }} />

      <Pagination total={totalPages} value={currentPage} onChange={onPageChange} size="sm" />

      <Text size="sm" c="dimmed" style={{ minWidth: '120px', textAlign: 'right' }}>
        {startItem}-{endItem} of {totalItems}
      </Text>
    </Group>
  );
}
