/**
 * AllocationLockIndicator component displays and controls cluster allocation state
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7
 */

import { ActionIcon, Tooltip, Menu, Group } from '@mantine/core';
import {
  IconLockOpen,
  IconLock,
  IconLockSquare,
  IconLockCog,
} from '@tabler/icons-react';

export type AllocationState = 'all' | 'primaries' | 'new_primaries' | 'none';

interface AllocationLockIndicatorProps {
  /** Current allocation state */
  allocationState: AllocationState;
  /** Mutation for enabling allocation */
  enableAllocationMutation: { mutate: (variables?: void) => void; isPending: boolean };
  /** Mutation for disabling allocation */
  disableAllocationMutation: { mutate: (mode: string) => void; isPending: boolean };
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
  const { Icon, color, label } = getAllocationIcon(allocationState);
  const isEnabled = allocationState === 'all';

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
        {isEnabled ? (
          <>
            <Menu.Label>Disable Allocation</Menu.Label>
            <Menu.Item onClick={() => disableAllocationMutation.mutate('none')}>
              <Group gap="xs">
                <IconLock size={14} />
                None (disable all)
              </Group>
            </Menu.Item>
            <Menu.Item onClick={() => disableAllocationMutation.mutate('primaries')}>
              <Group gap="xs">
                <IconLockSquare size={14} />
                Primaries only
              </Group>
            </Menu.Item>
            <Menu.Item onClick={() => disableAllocationMutation.mutate('new_primaries')}>
              <Group gap="xs">
                <IconLockCog size={14} />
                New primaries only
              </Group>
            </Menu.Item>
          </>
        ) : (
          <>
            <Menu.Label>Enable Allocation</Menu.Label>
            <Menu.Item onClick={() => enableAllocationMutation.mutate()}>
              <Group gap="xs">
                <IconLockOpen size={14} />
                Enable all
              </Group>
            </Menu.Item>
          </>
        )}
      </Menu.Dropdown>
    </Menu>
  );
}
