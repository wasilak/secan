import { useCallback } from 'react';
import { usePreferences } from './usePreferences';
import { RequestHistoryItem } from '../types/preferences';

/**
 * Maximum number of history entries to store
 * 
 * Requirements: 13.14, 13.15
 */
const MAX_HISTORY_ENTRIES = 100;

/**
 * Console history manager interface
 * 
 * Provides methods to manage REST console request history with
 * automatic persistence to localStorage via preferences.
 */
export interface ConsoleHistoryManager {
  /** Add a new entry to history */
  addEntry(request: Omit<RequestHistoryItem, 'timestamp'>): void;
  
  /** Get all history entries */
  getHistory(): RequestHistoryItem[];
  
  /** Clear all history */
  clearHistory(): void;
  
  /** Get a specific entry by index */
  getEntry(index: number): RequestHistoryItem | undefined;
}

/**
 * Hook for managing REST console request history
 * 
 * This hook provides a dedicated interface for managing console history,
 * separating concerns from the general preferences hook. It handles:
 * - Adding executed requests to history with timestamps
 * - Limiting history to maximum entries (default 100)
 * - Removing oldest entries when exceeding limit
 * - Clearing all history
 * - Retrieving history entries
 * 
 * History is persisted to localStorage via the preferences system.
 * 
 * Requirements: 13.11, 13.12, 13.14, 13.15, 13.16
 * 
 * @returns ConsoleHistoryManager interface
 * 
 * @example
 * ```tsx
 * function RestConsole() {
 *   const { addEntry, getHistory, clearHistory } = useConsoleHistory();
 *   
 *   const executeRequest = async () => {
 *     const result = await apiClient.proxyRequest(...);
 *     
 *     // Add to history
 *     addEntry({
 *       method: 'GET',
 *       path: '/_cluster/health',
 *       body: undefined,
 *       response: JSON.stringify(result)
 *     });
 *   };
 *   
 *   return (
 *     <div>
 *       <button onClick={executeRequest}>Execute</button>
 *       <button onClick={clearHistory}>Clear History</button>
 *       <HistoryList items={getHistory()} />
 *     </div>
 *   );
 * }
 * ```
 */
export function useConsoleHistory(): ConsoleHistoryManager {
  const { preferences, updatePreference } = usePreferences();

  /**
   * Add a new entry to history
   * 
   * Automatically adds timestamp and limits history to MAX_HISTORY_ENTRIES.
   * Deduplicates requests: if the same request (method + path + body) exists,
   * updates it with the new response instead of creating a duplicate entry.
   * Newest entries appear first in the history list.
   * 
   * Requirements: 13.11, 13.14, 13.15
   * 
   * @param request - Request details without timestamp (added automatically)
   */
  const addEntry = useCallback(
    (request: Omit<RequestHistoryItem, 'timestamp'>) => {
      const historyItem: RequestHistoryItem = {
        timestamp: Date.now(),
        method: request.method,
        path: request.path,
        body: request.body,
        response: request.response,
      };

      // Check if an identical request already exists (same method, path, and body)
      const existingIndex = preferences.restConsoleHistory.findIndex(
        (item) =>
          item.method === request.method &&
          item.path === request.path &&
          item.body === request.body
      );

      let newHistory: RequestHistoryItem[];
      
      if (existingIndex !== -1) {
        // Update existing entry with new response and timestamp
        newHistory = [...preferences.restConsoleHistory];
        newHistory[existingIndex] = historyItem;
        
        // Move updated entry to the front (newest first)
        const updatedEntry = newHistory.splice(existingIndex, 1)[0];
        newHistory.unshift(updatedEntry);
      } else {
        // Add new entry to beginning of history (newest first)
        newHistory = [historyItem, ...preferences.restConsoleHistory];
      }

      // Limit to MAX_HISTORY_ENTRIES, removing oldest entries
      const limitedHistory = newHistory.slice(0, MAX_HISTORY_ENTRIES);

      updatePreference('restConsoleHistory', limitedHistory);
    },
    [preferences.restConsoleHistory, updatePreference]
  );

  /**
   * Get all history entries
   * 
   * Returns history in reverse chronological order (newest first).
   * 
   * Requirements: 13.12
   * 
   * @returns Array of history items
   */
  const getHistory = useCallback((): RequestHistoryItem[] => {
    return preferences.restConsoleHistory;
  }, [preferences.restConsoleHistory]);

  /**
   * Clear all history
   * 
   * Removes all stored history entries from localStorage.
   * 
   * Requirements: 13.16
   */
  const clearHistory = useCallback(() => {
    updatePreference('restConsoleHistory', []);
  }, [updatePreference]);

  /**
   * Get a specific entry by index
   * 
   * @param index - Index in the history array (0 = newest)
   * @returns History item or undefined if index out of bounds
   */
  const getEntry = useCallback(
    (index: number): RequestHistoryItem | undefined => {
      return preferences.restConsoleHistory[index];
    },
    [preferences.restConsoleHistory]
  );

  return {
    addEntry,
    getHistory,
    clearHistory,
    getEntry,
  };
}
