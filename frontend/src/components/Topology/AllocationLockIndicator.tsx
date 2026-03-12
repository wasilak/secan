import { Tooltip, Box } from '@mantine/core';
import {
  IconLockOpen,
  IconLock,
  IconLockSquare,
  IconLockCog,
} from '@tabler/icons-react';

/**
 * Allocation state types for cluster shard allocation
 * Requirements: 2.3, 2.4, 2.5, 2.6
 */
export type AllocationState = 'all' | 'primaries' | 'new_primaries' | 'none';

/**
 * Props for AllocationLockIndicator component
 */
export interface AllocationLockIndicatorProps {
  /** Current allocation state of the cluster */
  allocationState: AllocationState;
  /** Cluster name for tooltip context */
  clusterName: string;
  /** Cluster version for tooltip context */
  clusterVersion: string;
}

/**
 * AllocationLockIndicator Component
 *
 * Displays the current cluster allocation lock status with an appropriate icon.
 * Shows a tooltip explaining the allocation state when hovered.
 *
 * Icon Mapping:
 * - 'all': IconLockOpen (unlocked) - All shard allocations enabled
 * - 'primaries': IconLockSquare (partially locked) - Only primary shard allocations enabled
 * - 'new_primaries': IconLockCog (lock with settings) - Only new primary shard allocations enabled
 * - 'none': IconLock (fully locked) - All shard allocations disabled
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */
export function AllocationLockIndicator({
  allocationState,
  clusterName: _clusterName,
  clusterVersion: _clusterVersion,
}: AllocationLockIndicatorProps) {
  // Map allocation states to icons and tooltip messages
  const getIconAndTooltip = () => {
    switch (allocationState) {
      case 'all':
        return {
          Icon: IconLockOpen,
          tooltip: 'Shard allocation: Enabled for all shards',
          color: 'var(--mantine-color-green-6)',
        };
      case 'primaries':
        return {
          Icon: IconLockSquare,
          tooltip: 'Shard allocation: Enabled for primaries only',
          color: 'var(--mantine-color-yellow-6)',
        };
      case 'new_primaries':
        return {
          Icon: IconLockCog,
          tooltip: 'Shard allocation: Enabled for new primaries only',
          color: 'var(--mantine-color-orange-6)',
        };
      case 'none':
        return {
          Icon: IconLock,
          tooltip: 'Shard allocation: Disabled for all shards',
          color: 'var(--mantine-color-red-6)',
        };
      default:
        // Fallback for unknown states
        return {
          Icon: IconLock,
          tooltip: 'Shard allocation: Unknown state',
          color: 'var(--mantine-color-gray-6)',
        };
    }
  };

  const { Icon, tooltip, color } = getIconAndTooltip();

  return (
    <Tooltip
      label={tooltip}
      withArrow
      position="bottom"
    >
      <Box
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          cursor: 'help',
        }}
      >
        <Icon
          size={20}
          style={{ color }}
          aria-label={tooltip}
        />
      </Box>
    </Tooltip>
  );
}
