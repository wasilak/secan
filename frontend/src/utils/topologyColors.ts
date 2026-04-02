/**
 * Topology Color Utilities
 *
 * Provides consistent color assignment for indices across sessions.
 */

const STORAGE_KEY = 'secan-topology-index-colors';

const COLOR_PALETTE = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#14b8a6',
];

function hashString(str: string, max: number): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash) % max;
}

export function getIndexColor(indexName: string): string {
  return COLOR_PALETTE[hashString(indexName, COLOR_PALETTE.length)];
}

export function getOrCreateIndexColors(indices: string[]): Record<string, string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const existing = stored ? JSON.parse(stored) : {};
    const updated: Record<string, string> = { ...existing };
    let hasChanges = false;

    indices.forEach((index) => {
      if (!updated[index]) {
        updated[index] = getIndexColor(index);
        hasChanges = true;
      }
    });

    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }

    return updated;
  } catch {
    const colors: Record<string, string> = {};
    indices.forEach((index, i) => {
      colors[index] = COLOR_PALETTE[i % COLOR_PALETTE.length];
    });
    return colors;
  }
}
