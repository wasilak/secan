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
      return 'var(--mantine-color-green-6)';
    case 'INITIALIZING':
      return 'var(--mantine-color-yellow-6)';
    case 'RELOCATING':
      return 'var(--mantine-color-violet-6)';
    case 'UNASSIGNED':
      return 'transparent'; // No border for unassigned shards
    default:
      return 'var(--mantine-color-gray-6)';
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
