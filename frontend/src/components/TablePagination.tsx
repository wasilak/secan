import { Group, Pagination, Select, Text } from '@mantine/core';

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
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
}: TablePaginationProps) {
  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  return (
    <Group justify="space-between" mt="md" wrap="nowrap">
      <Group gap="xs">
        <Text size="sm" c="dimmed">
          Per page:
        </Text>
        <Select
          size="xs"
          value={pageSize.toString()}
          onChange={(value) => {
            if (value) {
              onPageSizeChange(parseInt(value, 10));
            }
          }}
          data={pageSizeOptions.map((size) => ({
            value: size.toString(),
            label: size.toString(),
          }))}
          w={70}
          comboboxProps={{ withinPortal: false }}
        />
      </Group>

      <Pagination total={totalPages} value={currentPage} onChange={onPageChange} size="sm" />

      <Text size="sm" c="dimmed" style={{ minWidth: '120px', textAlign: 'right' }}>
        {startItem}-{endItem} of {totalItems}
      </Text>
    </Group>
  );
}
