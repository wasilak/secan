/**
 * Color utility functions for consistent state color coding
 *
 * Requirements: 1.5
 * - Ensures consistent color coding for states across all views
 * - Centralizes color logic for health status and shard states
 */

import type { HealthStatus, ShardInfo } from '../types/api';

/**
 * Get badge color for health status
 *
 * Requirements: 1.5
 * - Green for healthy clusters
 * - Yellow for warning state
 * - Red for critical state
 * - Gray for unreachable clusters
 *
 * @param health - The health status of the cluster
 * @returns Mantine color name for the badge
 */
export function getHealthColor(health: HealthStatus | 'unreachable'): string {
  switch (health) {
    case 'green':
      return 'green';
    case 'yellow':
      return 'yellow';
    case 'red':
      return 'red';
    case 'unreachable':
      return 'gray';
    default:
      return 'gray';
  }
}

/**
 * Get CSS color variable for health status (for inline styles)
 *
 * @param health - The health status of the cluster
 * @returns CSS color variable for inline backgroundColor
 */
export function getHealthColorValue(health: HealthStatus | 'unreachable'): string {
  switch (health) {
    case 'green':
      return 'var(--mantine-color-green-6)';
    case 'yellow':
      return 'var(--mantine-color-yellow-6)';
    case 'red':
      return 'var(--mantine-color-red-6)';
    case 'unreachable':
      return 'var(--mantine-color-gray-6)';
    default:
      return 'var(--mantine-color-gray-6)';
  }
}

/**
 * Get badge color for shard state
 *
 * Requirements: 1.5
 * - Green for STARTED (healthy)
 * - Red for UNASSIGNED (critical)
 * - Yellow for INITIALIZING (transitional)
 * - Violet for RELOCATING (transitional, distinct from INITIALIZING)
 *
 * @param state - The state of the shard
 * @returns Mantine color name for the badge
 */
export function getShardStateColor(state: ShardInfo['state']): string {
  switch (state) {
    case 'STARTED':
      return 'green';
    case 'UNASSIGNED':
      return 'red';
    case 'INITIALIZING':
      return 'yellow';
    case 'RELOCATING':
      return 'violet';
    default:
      return 'gray';
  }
}

/**
 * Get border color for shard cells in the grid
 *
 * Requirements: 5.1, 5.2, 5.6, 16.1
 * - Uses CSS variables for theme compatibility
 * - Green border for STARTED (healthy)
 * - Yellow-6 border for INITIALIZING (transitional)
 * - Violet-6 border for RELOCATING (distinct transitional)
 * - Transparent (no border) for UNASSIGNED
 *
 * @param state - The state of the shard
 * @returns CSS color variable for the border
 */
export function getShardBorderColor(state: ShardInfo['state']): string {
  switch (state) {
    case 'STARTED':
      // Use a darker shade for borders so they remain visible
      // on light backgrounds (shade 9 provides stronger contrast).
      return 'var(--mantine-color-green-9)';
    case 'INITIALIZING':
      return 'var(--mantine-color-yellow-9)';
    case 'RELOCATING':
      return 'var(--mantine-color-violet-9)';
    case 'UNASSIGNED':
      return 'transparent'; // No border for unassigned shards
    default:
      return 'var(--mantine-color-gray-7)';
  }
}

/**
 * Get color for unassigned shards with differentiation between primary and replica
 *
 * Requirements: 5.3, 5.4
 * - Bright red (red-6) for unassigned primary shards
 * - Dimmed red (red-4) for unassigned replica shards
 *
 * @param isPrimary - Whether the shard is a primary shard
 * @returns CSS color variable for the unassigned shard
 */
export function getUnassignedShardColor(isPrimary: boolean): string {
  return isPrimary
    ? 'var(--mantine-color-red-6)' // Bright red for primaries
    : 'var(--mantine-color-red-4)'; // Dimmed red for replicas
}

/**
 * Get color for shard dots in topology view
 *
 * Requirements: 1.5
 * - Green for STARTED
 * - Yellow for INITIALIZING
 * - Violet for RELOCATING (distinct from INITIALIZING)
 * - Red for UNASSIGNED
 *
 * @param state - The state of the shard
 * @returns CSS color variable for the dot background
 */
export function getShardDotColor(state: ShardInfo['state']): string {
  switch (state) {
    case 'STARTED':
      return 'var(--mantine-color-green-6)';
    case 'INITIALIZING':
      return 'var(--mantine-color-yellow-6)';
    case 'RELOCATING':
      return 'var(--mantine-color-violet-6)';
    case 'UNASSIGNED':
      return 'var(--mantine-color-red-6)';
    default:
      return 'var(--mantine-color-gray-6)';
  }
}

/**
 * Deterministic color lookup for an index name.
 * Uses a simple hash of the index name and maps into a palette.
 */
/**
 * Deterministic color lookup for an index name.
 *
 * Behaviour:
 * - Strips common trailing numeric/date/time suffixes (e.g. -2026.02.03, -2026.02.03-232320, -232320)
 *   so variants of the same logical index map to the same color.
 * - Optionally, honors the leading dot (system indices) as distinct when
 *   `separateSystemIndexColors` is true (so `.my-index` becomes a different
 *   bucket than `my-index`). Default behaviour groups `.my-index` with
 *   `my-index` to produce fewer colors.
 *
 * @param indexName - Full index name
 * @param separateSystemIndexColors - If true, treat leading '.' as part of the key
 */
export function getColorForIndex(indexName: string, separateSystemIndexColors: boolean = true): string {
  if (!indexName) return 'var(--mantine-color-gray-6)';

  const isSystem = indexName.startsWith('.');
  // Work on the name without leading dot for extraction purposes
  let working = isSystem ? indexName.slice(1) : indexName;

  // Remove trailing numeric/date/timestamp-like suffixes. Examples:
  // -my-index-2026.02.03 -> my-index
  // -my-index-2026.02.03-232320 -> my-index
  // -my-index-232320 -> my-index
  // -my-index-2026-02-03 -> my-index
  // The regex removes one or more trailing groups that start with '-' and
  // contain digits possibly separated by '.' or '-'.
  // Place the hyphen at the end of the character class to avoid unnecessary
  // escaping which ESLint flags as a useless escape.
  working = working.replace(/(?:-\d+(?:[.-]\d+)*)+$/, '');

  // Fallback if stripping emptied the name (unlikely) — use the original stripped name
  if (!working) working = isSystem ? indexName.slice(1) : indexName;

  // Decide the key for hashing. If separateSystemIndexColors is true and
  // the index originally had a leading dot, prefix the key so it's different.
  const key = separateSystemIndexColors && isSystem ? `.${working}` : working;

  // simple djb2-like hash on the key
  let hash = 5381;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 33) ^ key.charCodeAt(i);
  }

  // Pastel palette: pick from a set of pleasing base hues and produce
  // a soft pastel fill using HSL. This yields nicer treemap visuals (soft
  // backgrounds and readable labels) while remaining deterministic.
  const baseHues = [12, 8, 340, 200, 170, 30, 260, 210]; // degrees
  const hue = baseHues[Math.abs(hash) % baseHues.length];

  // Pastel fill: lightness high, saturation moderate. Border/text shade
  // will be computed by the visualization library (Nivo) by darkening the
  // provided color; returning an HSL color string keeps that behaviour.
  const saturation = 50; // percent
  const lightness = 88; // percent
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

/**
 * Compute the canonical grouping key for an index name.
 * This mirrors the key derivation used by getColorForIndex so
 * grouping and coloring remain consistent.
 */
export function getIndexGroupingKey(indexName: string, separateSystemIndexColors: boolean = true): string {
  if (!indexName) return '';
  const isSystem = indexName.startsWith('.');
  let working = isSystem ? indexName.slice(1) : indexName;
  working = working.replace(/(?:-\d+(?:[.-]\d+)*)+$/, '');
  if (!working) working = isSystem ? indexName.slice(1) : indexName;
  return separateSystemIndexColors && isSystem ? `.${working}` : working;
}

/**
 * Get badge color for shard type (primary/replica)
 *
 * @param isPrimary - Whether the shard is a primary shard
 * @returns Mantine color name for the badge
 */
export function getShardTypeColor(isPrimary: boolean): string {
  return isPrimary ? 'blue' : 'gray';
}

/**
 * Centralized shard state colors for filter options
 * Use these constants to ensure consistent colors across all filter UIs
 */
export const SHARD_STATE_COLORS: Record<string, string> = {
  STARTED: 'var(--mantine-color-green-6)',
  INITIALIZING: 'var(--mantine-color-yellow-6)',
  RELOCATING: 'var(--mantine-color-violet-6)',
  UNASSIGNED: 'var(--mantine-color-red-6)',
};

/**
 * Centralized shard type colors for filter options
 */
export const SHARD_TYPE_COLORS: Record<string, string> = {
  primaries: 'var(--mantine-color-blue-6)',
  replicas: 'var(--mantine-color-gray-6)',
};

/**
 * Resolve final shard color for a shard object, using shard state helpers and
 * falling back to index health color when state is missing.
 */
export function resolveShardColor(shard: unknown, getIndexHealthColor?: (indexName: string) => string): string {
  if (!shard || typeof shard !== 'object' || shard === null) return 'var(--mantine-color-gray-6)';
  // narrow to the expected shape for safer access
  const s = shard as { state?: string; status?: string; primary?: boolean; index?: string };
  const rawState = s.state ?? s.status ?? '';
  const state = typeof rawState === 'string' ? rawState.toUpperCase() : '';
  if (state === 'UNASSIGNED') return getUnassignedShardColor(Boolean(s.primary));
  if (state) return getShardDotColor(state as ShardInfo['state']);
  if (getIndexHealthColor && typeof s.index === 'string') return getIndexHealthColor(s.index);
  return 'var(--mantine-color-gray-6)';
}
