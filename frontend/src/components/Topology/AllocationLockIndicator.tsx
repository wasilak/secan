/**
 * AllocationLockIndicator component displays and controls cluster allocation state
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { ActionIcon, Tooltip, Menu, Group } from '@mantine/core';
import { useState, useEffect } from 'react';
import {
  IconLockOpen,
  IconLock,
  IconLockSquare,
  IconLockCog,
} from '@tabler/icons-react';

export type AllocationState = 'all' | 'primaries' | 'new_primaries' | 'none';

interface AllocationLockIndicatorProps {
  /** Current allocation state from server */
  allocationState: AllocationState;
  /** Mutation for enabling allocation */
  enableAllocationMutation: { 
    mutate: (variables?: void, options?: { onSuccess?: () => void }) => void; 
    isPending: boolean;
  };
  /** Mutation for disabling allocation */
  disableAllocationMutation: { 
    mutate: (mode: string, options?: { onSuccess?: () => void }) => void; 
    isPending: boolean;
  };
}

/**
 * Maps allocation states to visual indicators
 * 
 * Requirements:
 * - 2.3: all → unlocked padlock (green)
 * - 2.4: primaries → partially locked (yellow)
 * - 2.5: none → fully locked (red)
 * - 2.6: new_primaries → distinct state (orange)
 */
const getAllocationIcon = (state: AllocationState) => {
  switch (state) {
    case 'all':
      return { Icon: IconLockOpen, color: 'green', label: 'Allocation Enabled (All)' };
    case 'primaries':
      return { Icon: IconLockSquare, color: 'yellow', label: 'Allocation Enabled (Primaries Only)' };
    case 'new_primaries':
      return { Icon: IconLockCog, color: 'orange', label: 'Allocation Enabled (New Primaries Only)' };
    case 'none':
      return { Icon: IconLock, color: 'red', label: 'Allocation Disabled' };
  }
};

/**
 * AllocationLockIndicator component
 * 
 * Displays the current cluster allocation lock status with appropriate icon and color.
 * Opens context menu on click to change allocation state.
 * Positioned in cluster header for constant visibility.
 * 
 * Updates immediately to clicked state when mutation succeeds.
 * Syncs with server state on refresh (manual or automatic).
 * 
 * Requirements:
 * - 2.1: Display on same line as cluster name and version
 * - 2.2: Position at maximum right of display area
 * - 2.3, 2.4, 2.5, 2.6: Map states to distinct icons
 * - 2.7: Remain visible during scrolling
 */
export function AllocationLockIndicator({
  allocationState,
  enableAllocationMutation,
  disableAllocationMutation,
}: AllocationLockIndicatorProps) {
  // Local state for immediate updates after successful mutation
  const [displayState, setDisplayState] = useState<AllocationState>(allocationState);

  // Sync with server state when it changes (from refresh or external changes)
  useEffect(() => {
    setDisplayState(allocationState);
  }, [allocationState]);

  const { Icon, color, label } = getAllocationIcon(displayState);

  const handleEnableAll = () => {
    enableAllocationMutation.mutate(undefined, {
      onSuccess: () => {
        // Update display immediately on success
        setDisplayState('all');
      },
    });
  };

  const handleDisable = (mode: AllocationState) => {
    disableAllocationMutation.mutate(mode, {
      onSuccess: () => {
        // Update display immediately on success
        setDisplayState(mode);
      },
    });
  };

  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <Tooltip label={label} position="bottom">
          <ActionIcon
            variant="subtle"
            color={color}
            size="lg"
            loading={enableAllocationMutation.isPending || disableAllocationMutation.isPending}
          >
            <Icon size={20} />
          </ActionIcon>
        </Tooltip>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>Allocation State</Menu.Label>
        
        {/* Enable all option */}
        {displayState !== 'all' && (
          <Menu.Item onClick={handleEnableAll}>
            <Group gap="xs">
              <IconLockOpen size={14} />
              Enable all
            </Group>
          </Menu.Item>
        )}
        
        {/* Primaries only option */}
        {displayState !== 'primaries' && (
          <Menu.Item onClick={() => handleDisable('primaries')}>
            <Group gap="xs">
              <IconLockSquare size={14} />
              Primaries only
            </Group>
          </Menu.Item>
        )}
        
        {/* New primaries only option */}
        {displayState !== 'new_primaries' && (
          <Menu.Item onClick={() => handleDisable('new_primaries')}>
            <Group gap="xs">
              <IconLockCog size={14} />
              New primaries only
            </Group>
          </Menu.Item>
        )}
        
        {/* Disable all option */}
        {displayState !== 'none' && (
          <Menu.Item onClick={() => handleDisable('none')}>
            <Group gap="xs">
              <IconLock size={14} />
              None (disable all)
            </Group>
          </Menu.Item>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
