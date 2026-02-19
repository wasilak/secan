import { useMemo } from 'react';
import {
  Modal,
  Stack,
  Text,
  Group,
  Button,
  Badge,
  ScrollArea,
  Box,
  Divider,
} from '@mantine/core';
import { validateBulkOperation, getBulkOperationDisplayName, hasValidIndices } from '../utils/bulk-operations';
import type { BulkOperationType, IndexInfo } from '../types/api';

export interface BulkOperationConfirmModalProps {
  /** Whether the modal is opened */
  opened: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The operation type to confirm */
  operation: BulkOperationType;
  /** Array of selected index names */
  selectedIndices: string[];
  /** All available indices with their metadata */
  indices: IndexInfo[];
  /** Callback when user confirms the operation */
  onConfirm: () => void;
  /** Whether the operation is currently executing */
  isExecuting?: boolean;
}

/**
 * BulkOperationConfirmModal component displays confirmation dialog for bulk operations
 *
 * This modal shows a summary of which indices will be affected and which will be
 * ignored, along with reasons for ignoring. The user can proceed with the operation
 * or cancel.
 *
 * Features:
 * - Shows operation name in title
 * - Displays summary (total, affected, ignored counts)
 * - Lists affected indices with green badges
 * - Lists ignored indices with gray badges and reasons
 * - Proceed button disabled if no valid indices
 * - Cancel button always enabled
 * - Loading state during execution
 * - Accessible with ARIA labels
 *
 * @example
 * ```tsx
 * <BulkOperationConfirmModal
 *   opened={modalOpened}
 *   onClose={() => setModalOpened(false)}
 *   operation="close"
 *   selectedIndices={['index1', 'index2']}
 *   indices={indices}
 *   onConfirm={handleConfirm}
 *   isExecuting={isExecuting}
 * />
 * ```
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
export function BulkOperationConfirmModal({
  opened,
  onClose,
  operation,
  selectedIndices,
  indices,
  onConfirm,
  isExecuting = false,
}: BulkOperationConfirmModalProps) {
  // Calculate validation result
  const validationResult = useMemo(() => {
    return validateBulkOperation(
      indices,
      operation,
      new Set(selectedIndices)
    );
  }, [indices, operation, selectedIndices]);

  const hasValid = hasValidIndices(validationResult);
  const operationName = getBulkOperationDisplayName(operation);

  // Get operation-specific confirmation message
  const getConfirmationMessage = () => {
    const actionVerb = getActionVerb(operation);
    
    if (validationResult.ignoredIndices.length === 0) {
      return `This will ${actionVerb.toLowerCase()} all ${validationResult.validIndices.length} selected indices.`;
    }

    return (
      <span>
        This will <strong>{actionVerb.toLowerCase()}</strong> {validationResult.validIndices.length} indices.&nbsp;
        {validationResult.ignoredIndices.length} indices will be skipped.
      </span>
    );
  };

  const getActionVerb = (op: BulkOperationType): string => {
    switch (op) {
      case 'open': return 'Open';
      case 'close': return 'Close';
      case 'delete': return 'Delete';
      case 'refresh': return 'Refresh';
      case 'set_read_only': return 'Set as Read-Only';
      case 'set_writable': return 'Set as Writable';
      default: return 'Modify';
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={`Bulk ${operationName} Operation`}
      centered
      size="lg"
      aria-labelledby="bulk-operation-modal-title"
      aria-describedby="bulk-operation-modal-description"
    >
      <Stack gap="md">
        {/* Summary section */}
        <Box>
          <Text size="sm" id="bulk-operation-modal-description">
            {getConfirmationMessage()}
          </Text>
          <Text size="xs" c="dimmed" mt="sm">
            Total selected: <Text span fw={600}>{selectedIndices.length}</Text>
            {' · '}
            Will be affected: <Text span fw={600} c="green">{validationResult.validIndices.length}</Text>
            {' · '}
            Will be ignored: <Text span fw={600} c="gray">{validationResult.ignoredIndices.length}</Text>
          </Text>
        </Box>

        <Divider />

        {/* Affected indices section */}
        {validationResult.validIndices.length > 0 && (
          <Box>
            <Text size="xs" fw={600} c="green" mb="xs">
              Will be affected ({validationResult.validIndices.length})
            </Text>
            <ScrollArea.Autosize mah={150} type="scroll">
              <Group gap="xs" wrap="wrap">
                {validationResult.validIndices.map((indexName) => (
                  <Badge
                    key={indexName}
                    color="green"
                    variant="light"
                    size="sm"
                  >
                    {indexName}
                  </Badge>
                ))}
              </Group>
            </ScrollArea.Autosize>
          </Box>
        )}

        {/* Ignored indices section */}
        {validationResult.ignoredIndices.length > 0 && (
          <Box>
            <Text size="xs" fw={600} c="gray" mb="xs">
              Will be ignored ({validationResult.ignoredIndices.length})
            </Text>
            <ScrollArea.Autosize mah={150} type="scroll">
              <Stack gap="xs">
                {validationResult.ignoredIndices.map((indexName) => (
                  <Group key={indexName} gap="xs" wrap="nowrap">
                    <Badge
                      color="gray"
                      variant="light"
                      size="sm"
                    >
                      {indexName}
                    </Badge>
                    <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                      {validationResult.ignoreReasons[indexName]}
                    </Text>
                  </Group>
                ))}
              </Stack>
            </ScrollArea.Autosize>
          </Box>
        )}

        {/* Action buttons */}
        <Group justify="flex-end" gap="sm" mt="md">
          <Button
            variant="default"
            onClick={onClose}
            disabled={isExecuting}
          >
            Cancel
          </Button>
          <Button
            color={operation === 'delete' ? 'red' : 'blue'}
            onClick={onConfirm}
            disabled={!hasValid || isExecuting}
            loading={isExecuting}
            aria-label={`Confirm bulk ${operation} operation`}
          >
            {operation === 'delete' ? 'Delete' : 'Proceed'}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
