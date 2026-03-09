import React from 'react';
import { TimeSeriesChart as MultiSeriesChart } from '../charts/TimeSeriesChart';
import type { DataPoint } from '../../hooks/useSparklineData';
import type { MantineColor } from '@mantine/core';

interface TimeSeriesChartProps {
  title: string;
  data: DataPoint[];
  dataKey: string;
  color: string;
  gradientId: string;
  unit?: string;
  valueFormatter?: (value: number | undefined) => string;
  tickFormatter?: (value: number) => string;
  query?: string;
  height?: number;
}

/**
 * Single-series time series chart wrapper
 * Wraps the multi-series TimeSeriesChart component for backward compatibility
 * @deprecated Use TimeSeriesChart from '../charts/TimeSeriesChart' directly with series array
 */
export function TimeSeriesChart({
  title,
  data,
  dataKey: _dataKey,
  color,
  gradientId: _gradientId,
  unit,
  valueFormatter,
  tickFormatter,
  query,
  height = 200,
}: TimeSeriesChartProps) {
  // Extract color name from CSS variable or use as-is
  const colorMatch = color.match(/--mantine-color-(\w+)-/);
  const colorName = (colorMatch ? colorMatch[1] : 'blue') as MantineColor;

  return (
    <MultiSeriesChart
      title={title}
      series={[
        {
          name: title,
          color: colorName,
          data: data,
          unit: unit,
        },
      ]}
      height={height}
      query={query}
      valueFormatter={valueFormatter ? (value: number, _name: string) => valueFormatter(value) : undefined}
      tickFormatter={tickFormatter}
    />
  );
}
