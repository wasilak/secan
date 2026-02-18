import { Menu, Portal } from '@mantine/core';
import { useMediaQuery } from '@mantine/hooks';
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
}: ShardContextMenuProps): React.JSX.Element | null {
  const targetRef = useRef<HTMLDivElement>(null);
  
  // Responsive sizing for touch-friendly menu - Requirements: 11.4
  const isMobile = useMediaQuery('(max-width: 768px)');
  
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
    console.log('[ShardContextMenu] handleShowStats called');
    onShowStats(shard);
  };
  
  const handleSelectForRelocation = () => {
    console.log('[ShardContextMenu] handleSelectForRelocation called');
    console.log('[ShardContextMenu] isRelocationDisabled:', isRelocationDisabled);
    console.log('[ShardContextMenu] shard:', shard);
    if (!isRelocationDisabled) {
      console.log('[ShardContextMenu] Calling onSelectForRelocation');
      onSelectForRelocation(shard);
    } else {
      console.log('[ShardContextMenu] Relocation is disabled, not calling handler');
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
          
          <Menu.Dropdown
            style={{
              // Make menu items larger and more touch-friendly on mobile - Requirements: 11.4
              minWidth: isMobile ? '200px' : '180px',
            }}
          >
            <Menu.Label
              style={{
                fontSize: isMobile ? '14px' : '12px',
                padding: isMobile ? '12px' : '8px',
              }}
            >
              Shard {shard.shard} ({shard.primary ? 'Primary' : 'Replica'})
            </Menu.Label>
            
            {/* Display shard stats option - Requirements: 4.3 */}
            <Menu.Item
              leftSection={<IconInfoCircle size={isMobile ? 20 : 16} />}
              onClick={handleShowStats}
              style={{
                fontSize: isMobile ? '16px' : '14px',
                padding: isMobile ? '14px 16px' : '10px 12px',
                minHeight: isMobile ? '48px' : 'auto', // Ensure touch target size
              }}
            >
              Display shard stats
            </Menu.Item>
            
            {/* Select for relocation option - Requirements: 4.4, 4.10 */}
            <Menu.Item
              leftSection={<IconArrowsMove size={isMobile ? 20 : 16} />}
              onClick={handleSelectForRelocation}
              disabled={isRelocationDisabled}
              title={isRelocationDisabled ? getDisabledReason() : undefined}
              style={{
                fontSize: isMobile ? '16px' : '14px',
                padding: isMobile ? '14px 16px' : '10px 12px',
                minHeight: isMobile ? '48px' : 'auto', // Ensure touch target size
              }}
            >
              Select for relocation
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </Portal>
    </>
  );
}
