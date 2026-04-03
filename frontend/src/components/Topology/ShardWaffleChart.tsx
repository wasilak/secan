import { ReactNode, FunctionComponent, MouseEvent } from 'react';
import { ResponsiveWaffleHtml, isDataCell } from '@nivo/waffle';
import type { CellComponentProps, TooltipProps, ComputedDatum } from '@nivo/waffle';
import { Box } from '@mantine/core';
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
    <div
      style={{
        position: 'absolute',
        // @ts-expect-error -- SpringValues are valid style props at runtime
        top: animatedProps.y,
        // @ts-expect-error -- SpringValues are valid style props at runtime
        left: animatedProps.x,
        // @ts-expect-error -- SpringValues are valid style props at runtime
        width: animatedProps.size,
        // @ts-expect-error -- SpringValues are valid style props at runtime
        height: animatedProps.size,
        borderRadius,
        // @ts-expect-error -- SpringValues are valid style props at runtime
        background: animatedProps.color,
        opacity: isPrimary ? 1 : 0.5,
        boxSizing: 'content-box',
        pointerEvents: 'none',
      }}
    />
  );
};

// ---------------------------------------------------------------------------
// Custom tooltip — renders the dot.tooltip ReactNode inside a dark box.
// ---------------------------------------------------------------------------

const ShardTooltip: FunctionComponent<TooltipProps<ShardDatum>> = ({ data }) => {
  return (
    <Box
      p={6}
      style={{
        background: 'var(--mantine-color-dark-7)',
        borderRadius: 4,
        fontSize: 12,
        color: 'var(--mantine-color-white)',
        pointerEvents: 'none',
      }}
    >
      {data.data.tooltipContent}
    </Box>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ShardWaffleChart({ dots, onShardClick }: ShardWaffleChartProps) {
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
    <Box
      mb={6}
      style={{ width: totalWidth, height: totalHeight, position: 'relative' }}
      onPointerDown={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <ResponsiveWaffleHtml<ShardDatum>
        data={data}
        total={dots.length}
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
        tooltip={ShardTooltip}
        isInteractive
        onClick={(cellData: ComputedDatum<ShardDatum>, event: MouseEvent<HTMLElement>) => {
          if (onShardClick) {
            event.stopPropagation();
            onShardClick(cellData.data.shard, event);
          }
        }}
        onMouseEnter={(_cellData: ComputedDatum<ShardDatum>, event: MouseEvent<HTMLElement>) => {
          event.stopPropagation();
        }}
        animate={false}
      />
    </Box>
  );
}
