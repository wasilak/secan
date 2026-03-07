import { Card, Stack, Text, type MantineColorScheme } from '@mantine/core';
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
import type { DataPoint } from '../../hooks/useSparklineData';
import CopyButton from '../CopyButton';

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
 * Generic time series area chart component
 */
export function TimeSeriesChart({
  title,
  data,
  dataKey,
  color,
  gradientId,
  unit,
  valueFormatter,
  tickFormatter,
  query,
  height = 200,
}: TimeSeriesChartProps) {
  const hasData = data && data.length > 0;

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          {title}
        </Text>
        {hasData ? (
          <ResponsiveContainer width="100%" height={height}>
            <AreaChart
              data={data.map((p) => ({
                time: formatTime(p.timestamp),
                value: p.value,
              }))}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                </linearGradient>
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
                width={unit ? 50 : 35}
                unit={unit}
                tickFormatter={tickFormatter}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-7)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '4px',
                  color: 'var(--mantine-color-gray-0)',
                }}
                labelStyle={{ color: 'var(--mantine-color-gray-0)' }}
                formatter={valueFormatter || ((value: any) => value)}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#${gradientId})`}
                name={title}
                dot={{ fill: color, r: 3 }}
                activeDot={{ r: 5 }}
              />
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
            <Text size="xs" c="dimmed" style={{ flex: 1 }}>
              <code
                style={{
                  backgroundColor: 'var(--mantine-color-dark-6)',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontSize: '11px',
                  display: 'block',
                  overflow: 'auto',
                }}
              >
                {query}
              </code>
            </Text>
            <CopyButton value={query} />
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
