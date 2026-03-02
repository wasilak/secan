import { Tooltip, Box } from '@mantine/core';
import { ShardInfo } from '../../types/api';
import { getShardStateColor } from '../../utils/colors';

/**
 * ShardDot Component
 *
 * Renders a single shard as a small colored dot.
 */
export function ShardDot({
  shard,
  indexColor,
  size = 'md',
  onClick,
}: {
  shard: ShardInfo;
  indexColor: string;
  size?: 'sm' | 'md' | 'lg';
  onClick?: () => void;
}) {
  const sizeMap = { sm: 6, md: 8, lg: 12 };
  const dotSize = sizeMap[size];
  const stateColor = getShardStateColor(shard.state);

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
          borderRadius: '50%',
          backgroundColor: `var(--mantine-color-${stateColor}-6)`,
          border: `2px solid ${indexColor}`,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.3)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.2)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = 'none';
        }}
      />
    </Tooltip>
  );
}
