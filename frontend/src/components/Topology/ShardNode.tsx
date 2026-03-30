import { memo } from 'react';
import { Tooltip } from '@mantine/core';
import { type NodeProps } from '@xyflow/react';
import type { ShardInfo } from '../../types/api';
import { getShardDotColor, getShardBorderColor } from '../../utils/colors';
import { SHARD_SIZE } from '../../utils/canvasLayout';

/**
 * Data interface for ShardNode — shared by Canvas and Index Viz.
 *
 * Requirements: 5.1, 5.2, 5.3
 */
export interface ShardNodeData extends Record<string, unknown> {
  shard: ShardInfo;
  /** Optional: called on click. event is optional so Index Viz can omit it. */
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;
  /** When true the ShardNode should render invisibly and not handle pointer events.
   * Useful when ShardNodes are present only to act as edge endpoints in index viz.
   */
  invisible?: boolean;
}

/**
 * ShardNode — 24×24 px RF leaf node representing a single Elasticsearch shard.
 *
 * - Background colour from getShardDotColor(state)
 * - Border colour from getShardBorderColor(state)
 * - Centred shard number
 * - P / R badge (top-right)
 * - No RF handles
 * - draggable: false set by layout caller, not here
 *
 * Requirements: 5.1, 5.2, 5.3
 */
function ShardNodeComponent({ data }: NodeProps & { data: ShardNodeData }) {
  const { shard, onShardClick, invisible } = data as ShardNodeData;
  if (invisible) {
    // Render an invisible placeholder that retains RF position/size but
    // doesn't show visuals or receive pointer events. This allows edges to
    // connect to the node while the ClusterGroupNode renders the visible
    // shard dots.
    return (
      <div
        style={{
          width: SHARD_SIZE,
          height: SHARD_SIZE,
          boxSizing: 'border-box',
          pointerEvents: 'none',
          background: 'transparent',
        }}
      />
    );
  }
  const bg = getShardDotColor(shard.state);
  const border = getShardBorderColor(shard.state);
  const label = `${shard.index} / shard ${shard.shard} — ${shard.primary ? 'Primary' : 'Replica'} — ${shard.state}`;

  return (
    <Tooltip label={label} withArrow withinPortal>
      <div
        onClick={(e) => {
          if (onShardClick) {
            e.stopPropagation();
            onShardClick(shard, e);
          }
        }}
        onPointerDown={(e) => {
          // Prevent parent node click handlers from receiving pointer events
          e.stopPropagation();
        }}
        onMouseDown={(e) => {
          // Defensive: stop mouse down as well
          e.stopPropagation();
        }}
        style={{
          width: 24,
          height: 24,
          backgroundColor: bg,
          border: `2px solid ${border}`,
          borderRadius: 4,
          cursor: onShardClick ? 'pointer' : 'default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          boxSizing: 'border-box',
          transition: 'box-shadow 150ms ease, transform 150ms ease',
        }}
      >
        {/* Shard number */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#fff',
            lineHeight: 1,
            userSelect: 'none',
            textShadow: '0 0 2px rgba(0,0,0,0.6)',
          }}
        >
          {shard.shard}
        </span>

        {/* P / R badge — top-right corner */}
        <span
          style={{
            position: 'absolute',
            top: -4,
            right: -4,
            fontSize: 7,
            fontWeight: 900,
            color: '#fff',
            backgroundColor: shard.primary
              ? 'var(--mantine-color-blue-7)'
              : 'var(--mantine-color-gray-6)',
            borderRadius: 2,
            padding: '0 2px',
            lineHeight: '10px',
            userSelect: 'none',
          }}
        >
          {shard.primary ? 'P' : 'R'}
        </span>
      </div>
    </Tooltip>
  );
}

export const ShardNode = memo(ShardNodeComponent);
