/**
 * Shard ordering utility for deterministic shard display
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 * - Provides consistent, deterministic ordering of shards
 * - Sorts by index name (alphabetical), shard number (numerical), primary before replica, state priority
 * - Ensures stable ordering across refreshes and view switches
 */

import type { ShardInfo } from '../types/api';

/**
 * State priority order for sorting
 * Lower numbers appear first in the sorted list
 */
const STATE_PRIORITY: Record<ShardInfo['state'], number> = {
  STARTED: 0,
  RELOCATING: 1,
  INITIALIZING: 2,
  UNASSIGNED: 3,
};

/**
 * Sort shards in a deterministic order
 *
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 * - Sorts by index name (alphabetical)
 * - Then by shard number (numerical)
 * - Then primary before replica
 * - Then by state priority (STARTED, RELOCATING, INITIALIZING, UNASSIGNED)
 *
 * @param shards - Array of shards to sort
 * @returns New array with shards sorted in deterministic order
 */
export function sortShards(shards: ShardInfo[]): ShardInfo[] {
  return [...shards].sort((a, b) => {
    // 1. Sort by index name (alphabetical)
    const indexCompare = a.index.localeCompare(b.index);
    if (indexCompare !== 0) return indexCompare;

    // 2. Sort by shard number (numerical)
    const shardCompare = a.shard - b.shard;
    if (shardCompare !== 0) return shardCompare;

    // 3. Primary before replica
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;

    // 4. Sort by state priority
    const stateA = STATE_PRIORITY[a.state] ?? 999;
    const stateB = STATE_PRIORITY[b.state] ?? 999;
    return stateA - stateB;
  });
}
