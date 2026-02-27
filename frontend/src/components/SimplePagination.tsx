import { Group, Pagination, Text } from '@mantine/core';

/**
 * SimplePagination component provides basic pagination without page size selector
 *
 * Features:
 * - Page navigation only
 * - Fixed page size
 * - Item count display
 *
 * Requirements: 11.0
 */
export function SimplePagination({
  currentPage,
  totalPages,
  pageSize,
  totalItems,
  onPageChange,
}: {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

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
