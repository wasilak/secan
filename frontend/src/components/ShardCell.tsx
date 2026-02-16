import { Box } from '@mantine/core';
import { memo } from 'react';
import type { ShardInfo } from '../types/api';

/**
 * Props for ShardCell component
 */
interface ShardCellProps {
  shard: ShardInfo;
  isSelected?: boolean;
  isDestinationIndicator?: boolean;
  onClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
}

/**
 * Get border color based on shard state
 * 
 * Requirements: 3.5
 * - Green border for STARTED (healthy)
 * - Yellow border for INITIALIZING
 * - Orange border for RELOCATING
 * - Red border for UNASSIGNED
 */
function getShardBorderColor(state: ShardInfo['state']): string {
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

/**
 * Get background color for shard based on primary/replica status
 * 
 * Requirements: 3.7
 * - Solid fill for primary shards
 * - Outlined/hollow for replica shards
 */
function getShardBackgroundColor(primary: boolean, state: ShardInfo['state']): string {
  if (state === 'UNASSIGNED') {
    // Unassigned shards have no fill
    return 'transparent';
  }
  
  if (primary) {
    // Primary shards have solid fill
    return 'var(--mantine-color-blue-1)';
  }
  
  // Replica shards are hollow (transparent background)
  return 'transparent';
}

/**
 * ShardCell component
 * 
 * Renders an individual shard box in the shard grid.
 * 
 * Features:
 * - Color coding based on shard state (green/yellow/orange/red)
 * - Visual distinction between primary and replica shards
 * - Click handling for shard selection
 * - Support for destination indicators (dashed border)
 * - Pulsing animation for selected shards
 * - Memoized for performance optimization
 * 
 * Requirements: 3.4, 3.5, 3.6, 3.7, 4.1, 9.3
 */
export const ShardCell = memo(function ShardCell({
  shard,
  isSelected = false,
  isDestinationIndicator = false,
  onClick,
}: ShardCellProps): JSX.Element {
  const borderColor = getShardBorderColor(shard.state);
  const backgroundColor = getShardBackgroundColor(shard.primary, shard.state);
  
  // Destination indicators use purple dashed border
  // Requirements: 5.5, 5.6
  const borderStyle = isDestinationIndicator ? 'dashed' : 'solid';
  const finalBorderColor = isDestinationIndicator 
    ? 'var(--mantine-color-violet-6)' 
    : borderColor;
  
  // Selected shards have thicker border and pulsing animation
  // Requirements: 4.1
  const borderWidth = isSelected ? '3px' : '2px';
  
  // Handle click events for shard selection
  // Requirements: 4.1
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event bubbling
    if (onClick) {
      onClick(shard, e);
    }
  };
  
  return (
    <>
      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.8;
              transform: scale(1.05);
            }
          }
          
          .shard-cell:hover {
            transform: scale(1.05);
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05), 0 1px 2px rgba(0, 0, 0, 0.1);
          }
          
          .shard-cell-no-hover:hover {
            transform: none;
            box-shadow: none;
          }
        `}
      </style>
      <Box
        onClick={handleClick}
        className={onClick ? 'shard-cell' : 'shard-cell-no-hover'}
        style={{
          width: '40px',
          height: '40px',
          border: `${borderWidth} ${borderStyle} ${finalBorderColor}`,
          backgroundColor,
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: onClick ? 'pointer' : 'default',
          fontSize: '14px',
          fontWeight: 600,
          color: 'var(--mantine-color-gray-9)',
          userSelect: 'none',
          transition: 'all 0.2s ease',
          animation: isSelected ? 'pulse 1.5s ease-in-out infinite' : 'none',
          position: 'relative',
        }}
        // Accessibility
        role="gridcell"
        aria-label={`Shard ${shard.shard} of index ${shard.index}, ${shard.primary ? 'primary' : 'replica'}, state ${shard.state}`}
        tabIndex={onClick ? 0 : -1}
        onKeyDown={(e) => {
          if (onClick && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            handleClick(e as unknown as React.MouseEvent);
          }
        }}
        >
        {/* Shard number */}
        {shard.shard}
        
        {/* Primary indicator (small dot in corner) */}
        {shard.primary && shard.state !== 'UNASSIGNED' && (
          <Box
            style={{
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: 'var(--mantine-color-blue-6)',
            }}
            aria-hidden="true"
          />
        )}
      </Box>
    </>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for optimal re-rendering - Requirements: 9.3
  // Only re-render if these specific props change
  return (
    prevProps.shard.state === nextProps.shard.state &&
    prevProps.shard.shard === nextProps.shard.shard &&
    prevProps.shard.index === nextProps.shard.index &&
    prevProps.shard.primary === nextProps.shard.primary &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.isDestinationIndicator === nextProps.isDestinationIndicator
  );
});
