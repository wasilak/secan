import { Tooltip, Box } from '@mantine/core';
import { ShardInfo } from '../../types/api';
import { getShardStateColor, getShardBorderColor } from '../../utils/colors';

/**
 * ShardDot Component
 *
 * Renders a single shard as a small colored dot.
 * 
 * Requirements: 3.3, 3.4, 3.6
 * - Displays relocating shards with orange-6 color
 * - Shows source node with solid yellow border
 * - Shows destination node with dotted yellow border
 */
export function ShardDot({
  shard,
  indexColor,
  size = 'md',
  onClick,
  isSource = false,
  isDestination = false,
  onHoverChange,
}: {
  shard: ShardInfo;
  indexColor: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
  isSource?: boolean;
  isDestination?: boolean;
  onHoverChange?: (shard: ShardInfo | null) => void;
}) {
  const sizeMap = { sm: 6, md: 8, lg: 12 };
  const dotSize = sizeMap[size];
  const stateColor = getShardStateColor(shard.state);

  // Determine border color and style for relocating shards
  // Requirements: 3.3, 3.4, 3.6
  const isRelocating = shard.state === 'RELOCATING';
  let borderColor = indexColor;
  let borderStyle: 'solid' | 'dotted' = 'solid';
  let backgroundColor = `var(--mantine-color-${stateColor}-6)`;

  if (isRelocating) {
    // Use orange-6 for relocating shards (Requirement 3.6)
    backgroundColor = 'var(--mantine-color-orange-6)';
    
    if (isSource) {
      // Source node: solid yellow border (Requirement 3.3)
      borderColor = 'var(--mantine-color-yellow-6)';
      borderStyle = 'solid';
    } else if (isDestination) {
      // Destination node: dotted yellow border (Requirement 3.4)
      borderColor = 'var(--mantine-color-yellow-6)';
      borderStyle = 'dotted';
    }
  }

  const formatSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const tooltipContent = (
    <div style={{ fontSize: 'var(--mantine-font-size-xs)' }}>
      <div style={{ fontWeight: 600, marginBottom: '4px' }}>
        {shard.index}[{shard.shard}]
      </div>
      <div><strong>State:</strong> {shard.state}</div>
      <div><strong>Type:</strong> {shard.primary ? 'Primary' : 'Replica'}</div>
      {shard.docs > 0 && <div><strong>Docs:</strong> {shard.docs.toLocaleString()}</div>}
      {shard.store > 0 && <div><strong>Size:</strong> {formatSize(shard.store)}</div>}
      {isRelocating && shard.relocatingNode && (
        <div><strong>Relocating to:</strong> {shard.relocatingNode}</div>
      )}
      {isSource && <div style={{ color: 'var(--mantine-color-yellow-6)' }}><strong>Source Node</strong></div>}
      {isDestination && <div style={{ color: 'var(--mantine-color-yellow-6)' }}><strong>Destination Node</strong></div>}
    </div>
  );

  return (
    <Tooltip
      label={tooltipContent}
      position="top"
      withArrow
      arrowSize={6}
      offset={4}
      openDelay={100}
      transitionProps={{ duration: 150 }}
    >
      <Box
        component="div"
        role="button"
        tabIndex={0}
        aria-label={`Shard ${shard.index}[${shard.shard}], ${shard.state}, ${shard.primary ? 'primary' : 'replica'}`}
        onClick={onClick}
        style={{
          width: `${dotSize}px`,
          height: `${dotSize}px`,
          borderRadius: isRelocating ? '2px' : '50%',
          backgroundColor,
          border: `2px ${borderStyle} ${borderColor}`,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.3)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
          // Trigger hover callback for relocating shards (Requirement 3.5)
          if (isRelocating && onHoverChange) {
            onHoverChange(shard);
          }
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
          // Clear hover callback for relocating shards (Requirement 3.5)
          if (isRelocating && onHoverChange) {
            onHoverChange(null);
          }
        }}
      />
    </Tooltip>
  );
}
