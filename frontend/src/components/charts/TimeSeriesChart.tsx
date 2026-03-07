import React from 'react';
import {
  Card,
  Stack,
  Text,
  Code,
  Group,
  ActionIcon,
  Tooltip,
  useMantineColorScheme,
  type MantineColor,
} from '@mantine/core';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  YAxis,
  XAxis,
  CartesianGrid,
  Legend,
} from 'recharts';
import { IconCopy, IconCheck } from '@tabler/icons-react';
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
  valueFormatter?: (value: number, seriesName: string) => string;
  tickFormatter?: (value: number) => string;
  showLegend?: boolean;
  showDots?: boolean;
}

/**
 * Format timestamp to HH:MM:SS
 */
function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * CopyButton component for copying query text
 */
function QueryCopyButton({ value }: { value: string }) {
  const [copied, setCopied] = React.useState(false);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Tooltip label={copied ? 'Copied!' : 'Copy query'} position="top">
      <ActionIcon
        variant="subtle"
        color={copied ? 'green' : 'gray'}
        size="sm"
        onClick={copyToClipboard}
      >
        {copied ? (
          <IconCheck style={{ width: '1rem', height: '1rem' }} />
        ) : (
          <IconCopy style={{ width: '1rem', height: '1rem' }} />
        )}
      </ActionIcon>
    </Tooltip>
  );
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
  showLegend = true,
  showDots = false,
}: TimeSeriesChartProps) {
  const { colorScheme } = useMantineColorScheme();
  
  // Theme-aware code block colors
  const isDark = colorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';

  // Combine all series into single dataset
  const hasData = series.length > 0 && series[0].data.length > 0;
  
  const combinedData = hasData ? series[0].data.map((point, index) => {
    const entry: Record<string, number | string> = {
      time: formatTime(point.timestamp),
      timestamp: point.timestamp,
    };
    
    series.forEach((s) => {
      const dataPoint = s.data[index];
      entry[s.name] = dataPoint ? dataPoint.value : 0;
    });
    
    return entry;
  }) : [];

  // Calculate Y-axis domain based on all series data
  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const maxValue = allValues.length > 0 ? Math.max(...allValues) : 100;
  const minValue = allValues.length > 0 ? Math.min(...allValues) : 0;
  const padding = maxValue * 0.1; // 10% padding
  
  const yDomain = [
    minValue > 0 ? Math.max(0, minValue - padding) : 0,
    maxValue + padding,
  ];

  // Generate gradient IDs
  const gradients = series.map((s) => ({
    id: `gradient-${s.name.replace(/\s+/g, '-').toLowerCase()}`,
    color: `var(--mantine-color-${s.color}-6)`,
  }));

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Text size="sm" fw={500}>
            {title}
          </Text>
          {query && (
            <Group gap="xs">
              {Array.isArray(query) ? (
                query.map((q, i) => <QueryCopyButton key={i} value={q} />)
              ) : (
                <QueryCopyButton value={query} />
              )}
            </Group>
          )}
        </Group>
        
        {hasData ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={combinedData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                {gradients.map((g) => (
                  <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={g.color} stopOpacity={0.3} />
                    <stop offset="95%" stopColor={g.color} stopOpacity={0.05} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--mantine-color-dark-4)"
                opacity={0.3}
              />
              <XAxis
                dataKey="time"
                stroke="var(--mantine-color-gray-6)"
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                height={40}
                angle={-45}
                textAnchor="end"
              />
              <YAxis
                stroke="var(--mantine-color-gray-6)"
                tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 11 }}
                width={yLabel ? 50 : 35}
                unit={yLabel}
                domain={yDomain}
                tickFormatter={tickFormatter}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: isDark
                    ? 'var(--mantine-color-dark-7)'
                    : 'var(--mantine-color-gray-0)',
                  border: `1px solid ${isDark ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
                  borderRadius: '4px',
                  color: isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)',
                }}
                labelStyle={{ color: isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)' }}
                formatter={(value: number | undefined, name: string | undefined) => {
                  if (valueFormatter && name) {
                    return [valueFormatter(value ?? 0, name), name];
                  }
                  return [value ?? 0, name || ''];
                }}
              />
              {showLegend && <Legend />}
              {series.map((s, index) => (
                <Area
                  key={s.name}
                  type="monotone"
                  dataKey={s.name}
                  stroke={`var(--mantine-color-${s.color}-6)`}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#${gradients[index].id})`}
                  name={s.name}
                  dot={showDots ? { fill: `var(--mantine-color-${s.color}-6)`, r: 3 } : false}
                  activeDot={{ r: 5 }}
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
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
                  key={i}
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
