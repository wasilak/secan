import type { BulkOperationType, BulkOperationValidationResult, IndexInfo } from '../types/api';

/**
 * Get user-friendly display name for bulk operation
 *
 * @param operation - The bulk operation type
 * @returns Human-readable operation name
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6
 */
export function getBulkOperationDisplayName(operation: BulkOperationType): string {
  const displayNames: Record<BulkOperationType, string> = {
    open: 'Open',
    close: 'Close',
    delete: 'Delete',
    refresh: 'Refresh',
    set_read_only: 'Set Read-Only',
    set_writable: 'Set Writable',
  };

  return displayNames[operation];
}

/**
 * Validate which indices can be affected by a bulk operation
 *
 * This function determines which selected indices are valid for the operation
 * and which should be ignored, along with reasons for ignoring.
 *
 * Validation logic per operation:
 * - open: Only closed indices (status === 'close')
 * - close: Only open indices (status === 'open')
 * - delete: All indices (no validation)
 * - refresh: Only open indices (status === 'open')
 * - set_read_only: Only writable indices (not read-only)
 * - set_writable: Only read-only indices
 *
 * @param indices - All available indices with their metadata
 * @param operation - The bulk operation type to validate
 * @param selectedIndices - Set of selected index names
 * @returns Validation result with valid and ignored indices
 *
 * Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6
 */
export function validateBulkOperation(
  indices: IndexInfo[],
  operation: BulkOperationType,
  selectedIndices: Set<string>
): BulkOperationValidationResult {
  const validIndices: string[] = [];
  const ignoredIndices: string[] = [];
  const ignoreReasons: Record<string, string> = {};

  // Create a map for quick index lookup
  const indexMap = new Map<string, IndexInfo>();
  indices.forEach((index) => indexMap.set(index.name, index));

  // Validate each selected index
  selectedIndices.forEach((indexName) => {
    const index = indexMap.get(indexName);

    if (!index) {
      // Index not found - ignore it
      ignoredIndices.push(indexName);
      ignoreReasons[indexName] = 'Index not found';
      return;
    }

    const isValid = validateIndexForOperation(index, operation);

    if (isValid) {
      validIndices.push(indexName);
    } else {
      ignoredIndices.push(indexName);
      ignoreReasons[indexName] = getIgnoreReason(index, operation);
    }
  });

  return {
    validIndices,
    ignoredIndices,
    ignoreReasons,
  };
}

/**
 * Validate if a single index can be affected by an operation
 *
 * @param index - Index information
 * @param operation - Operation type
 * @returns True if index is valid for the operation
 */
function validateIndexForOperation(index: IndexInfo, operation: BulkOperationType): boolean {
  switch (operation) {
    case 'open':
      // Can only open closed indices
      return index.status === 'close';

    case 'close':
      // Can only close open indices
      return index.status === 'open';

    case 'delete':
      // Can delete any index
      return true;

    case 'refresh':
      // Can only refresh open indices
      return index.status === 'open';

    case 'set_read_only':
      // Can only set read-only on writable indices
      // Note: For now, we assume all open indices are writable
      // In the future, this should check index.settings.index.blocks.write
      return index.status === 'open';

    case 'set_writable':
      // Can only set writable on read-only indices
      // Note: This is a placeholder - actual implementation would need
      // to check index settings to determine read-only status
      // For now, we assume no indices are read-only by default
      return false;

    default:
      // Unknown operation - not valid
      return false;
  }
}

/**
 * Get the reason why an index was ignored for an operation
 *
 * @param index - Index information
 * @param operation - Operation type
 * @returns Human-readable reason for ignoring
 */
function getIgnoreReason(index: IndexInfo, operation: BulkOperationType): string {
  switch (operation) {
    case 'open':
      return index.status === 'open' ? 'Already open' : 'Index not found';

    case 'close':
      return index.status === 'close' ? 'Already closed' : 'Index not found';

    case 'delete':
      return 'Index not found';

    case 'refresh':
      return index.status === 'close' ? 'Cannot refresh closed index' : 'Index not found';

    case 'set_read_only':
      if (index.status === 'close') {
        return 'Cannot modify settings on closed index';
      }
      return 'Already read-only';

    case 'set_writable':
      if (index.status === 'close') {
        return 'Cannot modify settings on closed index';
      }
      return 'Already writable';

    default:
      return 'Invalid operation';
  }
}

/**
 * Check if an operation has any valid indices
 *
 * @param validationResult - Result from validateBulkOperation
 * @returns True if there are valid indices for the operation
 */
export function hasValidIndices(validationResult: BulkOperationValidationResult): boolean {
  return validationResult.validIndices.length > 0;
}

/**
 * Get a summary of the validation result
 *
 * @param validationResult - Result from validateBulkOperation
 * @returns Summary string for display
 */
export function getValidationSummary(validationResult: BulkOperationValidationResult): string {
  const total = validationResult.validIndices.length + validationResult.ignoredIndices.length;
  const valid = validationResult.validIndices.length;
  const ignored = validationResult.ignoredIndices.length;

  if (ignored === 0) {
    return `All ${total} selected indices will be affected`;
  }

  return `${valid} will be affected, ${ignored} will be ignored`;
}
