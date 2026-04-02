import React from 'react';
import {
  Card,
  Stack,
  Text,
  Code,
  Group,
  Loader,
  useMantineColorScheme,
  type MantineColor,
} from '@mantine/core';
import { ResponsiveLine, type Serie, type SliceTooltipProps } from '@nivo/line';
import { useNivoTheme } from '../../hooks/useNivoTheme';
import { formatChartTime } from '../../utils/formatters';
import type { DataPoint } from '../../hooks/useSparklineData';

export interface TimeSeriesData {
  name: string;
  color: MantineColor;
  data: DataPoint[];
  unit?: string;
}

export interface TimeSeriesChartProps {
  title: string;
  series: TimeSeriesData[];
  height?: number;
  query?: string | string[];
  yLabel?: string;
  valueFormatter?: (value: number, seriesName: string, timestamp?: number) => string;
  tickFormatter?: (value: number) => string;
  showLegend?: boolean;
  showDots?: boolean;
  isLoading?: boolean;
}

interface NivoSerieWithColor extends Serie {
  color: string;
}

/**
 * Reusable time series chart component
 * Supports multiple series, auto-scaling, and theme-aware styling
 */
export function TimeSeriesChart({
  title,
  series,
  height = 200,
  query,
  yLabel,
  valueFormatter,
  tickFormatter,
  showLegend = false,
  showDots = false,
  isLoading = false,
}: TimeSeriesChartProps) {
  const { colorScheme } = useMantineColorScheme();
  const nivoTheme = useNivoTheme();

  // Theme-aware code block colors
  const isDark = colorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';

  const hasData = series.length > 0 && series[0].data.length > 0;

  // Calculate Y-axis domain based on all series data
  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 100;
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const padding = maxValue * 0.1;
  const yMin = minValue > 0 ? Math.max(0, minValue - padding) : 0;
  const yMax = maxValue + padding;

  // Shape data for nivo — sort each series independently by timestamp.
  // Use actual Date objects as x-values so nivo's time scale handles ordering correctly.
  // Using HH:MM strings (as was done previously) causes a "bounce-back" visual artifact when
  // the time range spans ~24 hours: the last point formats to the same string as the first
  // point, causing nivo's categorical scale to connect the final segment back to x=0.
  const nivoData: NivoSerieWithColor[] = series.map((s) => ({
    id: s.name,
    color: `var(--mantine-color-${s.color}-6)`,
    data: [...s.data]
      .sort((a, b) => a.timestamp - b.timestamp)
      .map((point) => ({
        x: new Date(point.timestamp),
        y: point.value,
        timestamp: point.timestamp,
      })),
  }));

  // Compute sparse tick values (Date objects) so axisBottom shows at most ~8 evenly-spaced labels.
  const allDates = (nivoData[0]?.data.map((d) => d.x as Date)) ?? [];
  const tickStep = Math.max(1, Math.floor(allDates.length / 8));
  const tickValues = allDates.filter(
    (_, i) => i % tickStep === 0 || i === allDates.length - 1
  );

  const SliceTooltip = ({ slice }: SliceTooltipProps) => {
    const firstPoint = slice.points[0];
    const rawDatum = firstPoint?.data as (typeof firstPoint.data & { timestamp?: number }) | undefined;
    const timestamp = rawDatum?.timestamp;
    const timeLabel = timestamp
      ? new Date(timestamp).toLocaleString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : String(firstPoint?.data?.x ?? '');

    return (
      <div
        style={{
          background: nivoTheme.tooltip?.container?.background as string | undefined,
          color: nivoTheme.tooltip?.container?.color as string | undefined,
          border: nivoTheme.tooltip?.container?.border as string | undefined,
          borderRadius: '4px',
          padding: '8px 12px',
          fontSize: 12,
        }}
      >
        <div style={{ marginBottom: 6, fontWeight: 600 }}>{timeLabel}</div>
        {slice.points.map((point) => {
          const numValue = typeof point.data.y === 'number' ? point.data.y : 0;
          const seriesName = String(point.serieId);
          const displayValue = valueFormatter
            ? valueFormatter(numValue, seriesName, timestamp)
            : String(numValue);
          return (
            <div key={point.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: point.serieColor,
                }}
              />
              <span>
                {seriesName}: {displayValue}
              </span>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Group justify="space-between" align="center">
          <Text size="sm" fw={500}>
            {title}
          </Text>
          {isLoading && <Loader size="xs" />}
        </Group>

        {hasData ? (
          <div style={{ height }}>
            <ResponsiveLine
              data={nivoData}
              theme={nivoTheme}
              margin={{ top: 10, right: 10, left: yLabel ? 50 : 35, bottom: 50 }}
              xScale={{ type: 'time', format: 'native', useUTC: false, precision: 'minute' }}
              yScale={{ type: 'linear', min: yMin, max: yMax }}
              axisBottom={{
                tickRotation: -45,
                tickValues,
                format: (v: unknown) => formatChartTime((v as Date).getTime()),
              }}
              axisLeft={{
                legend: yLabel,
                legendOffset: -40,
                legendPosition: 'middle',
                format: tickFormatter,
              }}
              enableArea={series.length === 1}
              areaOpacity={0.1}
              colors={(serie: NivoSerieWithColor) => serie.color}
              pointSize={showDots ? 6 : 0}
              pointBorderWidth={2}
              pointBorderColor={{ from: 'serieColor' }}
              useMesh={true}
              enableSlices="x"
              sliceTooltip={SliceTooltip}
              legends={
                showLegend
                  ? [
                      {
                        anchor: 'bottom-right',
                        direction: 'column',
                        itemWidth: 120,
                        itemHeight: 20,
                        itemsSpacing: 2,
                        symbolSize: 10,
                        symbolShape: 'circle',
                      },
                    ]
                  : []
              }
            />
          </div>
        ) : (
          <Stack justify="center" align="center" style={{ height }}>
            <Text size="sm" c="dimmed">
              Data not available
            </Text>
          </Stack>
        )}

        {query && (
          <Stack gap="xs">
            {Array.isArray(query) ? (
              query.map((q, i) => (
                <Code
                  key={`${i}-${q.slice(0, 20)}`}
                  block
                  style={{
                    backgroundColor: codeBg,
                    color: codeColor,
                    padding: '8px 12px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                  }}
                >
                  {q}
                </Code>
              ))
            ) : (
              <Code
                block
                style={{
                  backgroundColor: codeBg,
                  color: codeColor,
                  padding: '8px 12px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'monospace',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {query}
              </Code>
            )}
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

export default TimeSeriesChart;
