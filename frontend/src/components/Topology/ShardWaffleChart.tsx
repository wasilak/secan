import { ReactNode, FunctionComponent, MouseEvent, useState } from 'react';
import { animated } from '@react-spring/web';
import { ResponsiveWaffleHtml, isDataCell } from '@nivo/waffle';
import type { CellComponentProps, ComputedDatum } from '@nivo/waffle';
import { Box, Portal } from '@mantine/core';
import type { ShardInfo } from '../../types/api';

/** Shape of each shard dot — matches the `dots` array produced by DotBasedTopologyView
 *  and canvasLayout. */
export interface ShardDot {
  color: string;
  tooltip: ReactNode;
  primary: boolean;
  shard: ShardInfo;
}

export interface ShardWaffleChartProps {
  dots: ShardDot[];
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
}

/** Each waffle datum carries the full ShardDot payload so we can access colour
 *  and interaction data inside the cell and tooltip renderers. */
interface ShardDatum {
  id: string;
  label: string;
  value: number;
  color: string;
  primary: boolean;
  shard: ShardInfo;
  tooltipContent: ReactNode;
}

// ---------------------------------------------------------------------------
// Custom cell — renders a rect with opacity 0.5 for replicas.
// We use the WaffleHtml variant (div cells) to avoid @react-spring/web SVG
// attribute type issues on the SVG variant.
// ---------------------------------------------------------------------------

const ShardCell: FunctionComponent<CellComponentProps<ShardDatum>> = ({
  cell,
  animatedProps,
  borderRadius,
}) => {
  const isPrimary = isDataCell(cell) ? cell.data.data.primary : true;

  return (
    <animated.div
      style={{
        position: 'absolute',
        top: animatedProps.y,
        left: animatedProps.x,
        width: animatedProps.size,
        height: animatedProps.size,
        borderRadius,
        background: animatedProps.color,
        opacity: isPrimary ? 1 : 0.5,
        boxSizing: 'content-box',
        pointerEvents: 'none',
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Nivo tooltip stub — we manage our own portal-based tooltip so this is a
// no-op. Passing it explicitly silences nivo's default tooltip.
// ---------------------------------------------------------------------------
const NoopTooltip = () => null;

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShardWaffleChart({ dots, onShardClick }: ShardWaffleChartProps) {
  const [hoveredDatum, setHoveredDatum] = useState<ShardDatum | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  if (dots.length === 0) return null;

  const columns = Math.min(dots.length, 10);
  const rows = Math.ceil(dots.length / columns);

  // Each cell ~14px; 2px padding between cells gives 16px per cell
  const cellSize = 14;
  const padding = 2;
  const totalWidth = columns * cellSize + (columns - 1) * padding + padding * 2;
  const totalHeight = rows * cellSize + (rows - 1) * padding + padding * 2;

  const data: ShardDatum[] = dots.map((dot, idx) => ({
    id: `shard-${idx}-${dot.shard.index}-${dot.shard.shard}-${dot.primary ? 'p' : 'r'}`,
    label: `${dot.shard.index} #${dot.shard.shard}`,
    value: 1,
    color: dot.color,
    primary: dot.primary,
    shard: dot.shard,
    tooltipContent: dot.tooltip,
  }));

  return (
    <>
      <Box
        mb={6}
        style={{ width: totalWidth, height: totalHeight, position: 'relative', cursor: 'pointer', zIndex: 1 }}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onMouseMove={(e) => setMousePos({ x: e.clientX, y: e.clientY })}
        onMouseLeave={() => {
          setHoveredDatum(null);
          setMousePos(null);
        }}
      >
        <ResponsiveWaffleHtml<ShardDatum>
          data={data}
          total={rows * columns}
          rows={rows}
          columns={columns}
          padding={padding}
          margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
          colors={{ datum: 'color' }}
          borderRadius={2}
          borderWidth={0}
          emptyColor="transparent"
          emptyOpacity={0}
          cellComponent={ShardCell}
          tooltip={NoopTooltip}
          isInteractive
          onClick={(cellData: ComputedDatum<ShardDatum>, event: MouseEvent<HTMLElement>) => {
            if (onShardClick) {
              event.stopPropagation();
              onShardClick(cellData.data.shard, event);
            }
          }}
          onMouseEnter={(cellData: ComputedDatum<ShardDatum>, event: MouseEvent<HTMLElement>) => {
            event.stopPropagation();
            setHoveredDatum(cellData.data);
          }}
          onMouseLeave={() => {
            setHoveredDatum(null);
          }}
          animate={true}
        />
      </Box>

      {/* Portal-based tooltip — renders at document body level so it cannot
          overflow into the sidebar or be clipped by parent containers. */}
      {hoveredDatum && mousePos && (
        <Portal>
          <Box
            p={6}
            style={{
              position: 'fixed',
              top: mousePos.y + 12,
              left: mousePos.x + 12,
              background: 'var(--mantine-color-dark-7)',
              borderRadius: 4,
              fontSize: 12,
              color: 'var(--mantine-color-white)',
              pointerEvents: 'none',
              whiteSpace: 'nowrap',
              zIndex: 9999,
            }}
          >
            {hoveredDatum.tooltipContent}
          </Box>
        </Portal>
      )}
    </>
  );
}
