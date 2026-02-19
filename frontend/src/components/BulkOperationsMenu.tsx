import { useMemo } from 'react';
import { Button, Group, Menu, Text, Tooltip } from '@mantine/core';
import {
  IconDots,
  IconFolderOpen,
  IconFolderOff,
  IconTrash,
  IconRefresh,
  IconLock,
  IconLockOpen,
} from '@tabler/icons-react';
import { validateBulkOperation, getBulkOperationDisplayName, hasValidIndices } from '../utils/bulk-operations';
import type { BulkOperationType, IndexInfo } from '../types/api';

export interface BulkOperationsMenuProps {
  /** Set of selected index names */
  selectedIndices: Set<string>;
  /** All available indices with their metadata */
  indices: IndexInfo[];
  /** Callback when an operation is selected from the menu */
  onOperationSelect: (operation: BulkOperationType) => void;
}

/**
 * BulkOperationsMenu component displays a menu button for bulk operations
 *
 * This component appears when 1 or more indices are selected and provides
 * a dropdown menu with available bulk operations. Operations are intelligently
 * enabled/disabled based on the selected indices' states.
 *
 * Features:
 * - Shows menu button only when indices are selected
 * - Displays available operations based on selection
 * - Disables operations with no valid indices
 * - Shows count of selected indices in tooltip
 * - Accessible with ARIA labels
 *
 * @example
 * ```tsx
 * <BulkOperationsMenu
 *   clusterId={clusterId}
 *   selectedIndices={selectedIndices}
 *   indices={indices}
 *   onOperationSelect={handleOperationSelect}
 * />
 * ```
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export function BulkOperationsMenu({
  selectedIndices,
  indices,
  onOperationSelect,
}: BulkOperationsMenuProps) {
  // Calculate which operations are available based on selected indices
  const availableOperations = useMemo(() => {
    const operations: Array<{
      type: BulkOperationType;
      label: string;
      icon: React.ReactNode;
      disabled: boolean;
      validCount: number;
    }> = [];

    // Helper to check operation availability
    const checkOperation = (type: BulkOperationType, icon: React.ReactNode) => {
      const validation = validateBulkOperation(indices, type, selectedIndices);
      const isValid = hasValidIndices(validation);

      return {
        type,
        label: getBulkOperationDisplayName(type),
        icon,
        disabled: !isValid,
        validCount: validation.validIndices.length,
      };
    };

    // Check each operation type
    operations.push(checkOperation('open', <IconFolderOpen size={14} />));
    operations.push(checkOperation('close', <IconFolderOff size={14} />));
    operations.push(checkOperation('delete', <IconTrash size={14} />));
    operations.push(checkOperation('refresh', <IconRefresh size={14} />));
    operations.push(checkOperation('set_read_only', <IconLock size={14} />));
    operations.push(checkOperation('set_writable', <IconLockOpen size={14} />));

    return operations;
  }, [indices, selectedIndices]);

  // Don't render if no indices selected
  if (selectedIndices.size === 0) {
    return null;
  }

  const selectedCount = selectedIndices.size;

  return (
    <Menu shadow="md" width={220} position="bottom-end">
      <Menu.Target>
        <Tooltip
          label={`${selectedCount} index${selectedCount === 1 ? '' : 'es'} selected`}
          withArrow
        >
          <Button
            variant="filled"
            color="blue"
            leftSection={<IconDots size={18} />}
            aria-label={`Bulk operations for ${selectedCount} selected indices`}
          >
            Bulk Actions
          </Button>
        </Tooltip>
      </Menu.Target>

      <Menu.Dropdown>
        <Menu.Label>
          Bulk Operations ({selectedCount} selected)
        </Menu.Label>
        <Menu.Divider />

        {availableOperations.map((op) => (
          <Menu.Item
            key={op.type}
            leftSection={op.icon}
            onClick={() => !op.disabled && onOperationSelect(op.type)}
            disabled={op.disabled}
            rightSection={!op.disabled && op.validCount < selectedCount ? (
              <Text size="xs" c="dimmed">
                ({op.validCount}/{selectedCount})
              </Text>
            ) : null}
          >
            <Group gap="xs" justify="space-between">
              <Text size="sm">{op.label}</Text>
            </Group>
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  );
}
