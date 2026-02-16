import { Menu, Portal } from '@mantine/core';
import { IconInfoCircle, IconArrowsMove } from '@tabler/icons-react';
import { useEffect, useRef } from 'react';
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
}: ShardContextMenuProps): JSX.Element | null {
  const targetRef = useRef<HTMLDivElement>(null);
  
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
  };
  
  const handleSelectForRelocation = () => {
    if (!isRelocationDisabled) {
      onSelectForRelocation(shard);
    }
  };
  
  // Handle Escape key to close menu - Requirements: 4.8
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && opened) {
        onClose();
      }
    };
    
    if (opened) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [opened, onClose]);
  
  if (!opened) {
    return null;
  }
  
  return (
    <>
      {/* Invisible target positioned at click location */}
      <div
        ref={targetRef}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: '1px',
          height: '1px',
          pointerEvents: 'none',
        }}
      />
      
      {/* Menu with Portal to render at document root */}
      <Portal>
        <Menu
          opened={opened}
          onChange={onClose}
          position="right-start"
          withArrow
          shadow="md"
          closeOnClickOutside
          closeOnEscape
        >
          <Menu.Target>
            <div
              style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: '1px',
                height: '1px',
              }}
            />
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
      </Portal>
    </>
  );
}
