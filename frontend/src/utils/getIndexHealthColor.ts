// Backwards-compatible wrapper for existing inline helpers
// Provide a single exported function that returns a CSS variable string
// for an index health status.
import type { IndexInfo } from '../types/api';

/**
 * Factory that returns a function mapping indexName -> CSS color variable
 * based on the provided index health map.
 */
export function getIndexHealthColor(map: Map<string, IndexInfo['health']>) {
  return (indexName: string): string => {
    const health = map.get(indexName);
    switch (health) {
      case 'green': return 'var(--mantine-color-green-6)';
      case 'yellow': return 'var(--mantine-color-yellow-6)';
      case 'red': return 'var(--mantine-color-red-6)';
      default: return 'var(--mantine-color-gray-6)';
    }
  };
}

// (Alias removed) Use getIndexHealthColor(map) directly. Removed legacy alias.
