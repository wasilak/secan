import { Menu } from '@mantine/core';
import { IconInfoCircle, IconArrowsMove } from '@tabler/icons-react';
import type { ShardInfo } from '../types/api';

/**
 * Props for ShardContextMenu component
 */
interface ShardContextMenuProps {
  shard: ShardInfo;
  opened: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  onShowStats: (shard: ShardInfo) => void;
  onSelectForRelocation: (shard: ShardInfo) => void;
}

/**
 * ShardContextMenu component
 * 
 * Displays a context menu when a shard is clicked.
 * 
 * Features:
 * - "Display shard stats" option
 * - "Select for relocation" option (disabled for invalid shards)
 * - Positioned near clicked shard
 * - Closes on outside click or Escape key
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.8, 4.9, 4.10
 */
export function ShardContextMenu({
  shard,
  opened,
  position,
  onClose,
  onShowStats,
  onSelectForRelocation,
}: ShardContextMenuProps): JSX.Element {
  // Determine if relocation should be disabled
  // Requirements: 4.10
  const isRelocationDisabled = 
    shard.state === 'UNASSIGNED' ||
    shard.state === 'RELOCATING' ||
    shard.state === 'INITIALIZING';
  
  // Get disabled reason for tooltip
  const getDisabledReason = (): string => {
    if (shard.state === 'UNASSIGNED') {
      return 'Cannot relocate unassigned shards';
    }
    if (shard.state === 'RELOCATING') {
      return 'Shard is already relocating';
    }
    if (shard.state === 'INITIALIZING') {
      return 'Cannot relocate initializing shards';
    }
    return '';
  };
  
  // Handle menu item clicks
  const handleShowStats = () => {
    onShowStats(shard);
    onClose();
  };
  
  const handleSelectForRelocation = () => {
    if (!isRelocationDisabled) {
      onSelectForRelocation(shard);
      onClose();
    }
  };
  
  return (
    <Menu
      opened={opened}
      onClose={onClose}
      position="right-start"
      withArrow
      shadow="md"
      closeOnClickOutside
      closeOnEscape
      // Position the menu near the clicked shard
      // Requirements: 4.9
      styles={{
        dropdown: {
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
        },
      }}
    >
      <Menu.Target>
        {/* Hidden target - menu is positioned manually */}
        <div style={{ display: 'none' }} />
      </Menu.Target>
      
      <Menu.Dropdown>
        <Menu.Label>
          Shard {shard.shard} ({shard.primary ? 'Primary' : 'Replica'})
        </Menu.Label>
        
        {/* Display shard stats option - Requirements: 4.3 */}
        <Menu.Item
          leftSection={<IconInfoCircle size={16} />}
          onClick={handleShowStats}
        >
          Display shard stats
        </Menu.Item>
        
        {/* Select for relocation option - Requirements: 4.4, 4.10 */}
        <Menu.Item
          leftSection={<IconArrowsMove size={16} />}
          onClick={handleSelectForRelocation}
          disabled={isRelocationDisabled}
          title={isRelocationDisabled ? getDisabledReason() : undefined}
        >
          Select for relocation
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
