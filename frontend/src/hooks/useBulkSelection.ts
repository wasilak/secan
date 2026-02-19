import { useState, useCallback } from 'react';

/**
 * Return type for useBulkSelection hook
 */
export interface UseBulkSelectionReturn {
  /** Set of selected index names */
  selectedIndices: Set<string>;
  /** Check if an index is selected */
  isSelected: (indexName: string) => boolean;
  /** Toggle selection for an index */
  toggleSelection: (indexName: string) => void;
  /** Select all indices from a list */
  selectAll: (indices: string[]) => void;
  /** Clear all selections */
  clearSelection: () => void;
  /** Number of selected indices */
  count: number;
}

/**
 * Hook to manage bulk selection state for index rows
 *
 * This hook provides efficient O(1) selection operations using a Set data structure.
 * It manages the selection state for row-based interfaces where users can select
 * multiple items for bulk operations.
 *
 * Features:
 * - Efficient O(1) lookup and modification using Set
 * - Toggle individual selections
 * - Select all items from a list
 * - Clear all selections
 * - Track selection count
 *
 * @example
 * ```tsx
 * const { selectedIndices, isSelected, toggleSelection, selectAll, clearSelection, count } = useBulkSelection();
 *
 * // Toggle selection on checkbox click
 * <Checkbox
 *   checked={isSelected(index.name)}
 *   onChange={() => toggleSelection(index.name)}
 * />
 *
 * // Select all visible indices
 * <Button onClick={() => selectAll(visibleIndices.map(i => i.name))}>
 *   Select All
 * </Button>
 * ```
 *
 * @returns Selection state and operations
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */
export function useBulkSelection(): UseBulkSelectionReturn {
  const [selectedIndices, setSelectedIndices] = useState<Set<string>>(new Set());

  /**
   * Check if an index is selected
   * O(1) operation
   */
  const isSelected = useCallback((indexName: string): boolean => {
    return selectedIndices.has(indexName);
  }, [selectedIndices]);

  /**
   * Toggle selection for an index
   * Adds if not selected, removes if already selected
   * O(1) operation
   */
  const toggleSelection = useCallback((indexName: string) => {
    setSelectedIndices(prev => {
      const next = new Set(prev);
      if (next.has(indexName)) {
        next.delete(indexName);
      } else {
        next.add(indexName);
      }
      return next;
    });
  }, []);

  /**
   * Select all indices from a list
   * O(n) operation where n = number of indices
   */
  const selectAll = useCallback((indices: string[]) => {
    setSelectedIndices(new Set(indices));
  }, []);

  /**
   * Clear all selections
   * O(1) operation
   */
  const clearSelection = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  return {
    selectedIndices,
    isSelected,
    toggleSelection,
    selectAll,
    clearSelection,
    count: selectedIndices.size,
  };
}
