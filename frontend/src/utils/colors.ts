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
 * - Yellow for INITIALIZING and RELOCATING (transitional)
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
    case 'RELOCATING':
      return 'yellow';
    default:
      return 'gray';
  }
}

/**
 * Get border color for shard cells in the grid
 *
 * Requirements: 1.5, 3.5
 * - Uses CSS variables for theme compatibility
 * - Green border for STARTED (healthy)
 * - Yellow border for INITIALIZING
 * - Orange border for RELOCATING
 * - Red border for UNASSIGNED
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
      return 'var(--mantine-color-orange-6)';
    case 'UNASSIGNED':
      return 'var(--mantine-color-red-6)';
    default:
      return 'var(--mantine-color-gray-6)';
  }
}
