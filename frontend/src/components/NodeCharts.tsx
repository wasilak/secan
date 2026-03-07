import { Grid, Stack, Text, Card, Code, useMantineColorScheme } from '@mantine/core';
import { TimeSeriesChart } from './ClusterStatistics/TimeSeriesChart';
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
import type { DataPoint } from '../hooks/useSparklineData';

interface NodeChartsProps {
  heapHistory: DataPoint[];
  diskHistory: DataPoint[];
  cpuHistory: DataPoint[];
  loadHistory: DataPoint[];
  load5History?: DataPoint[];
  load15History?: DataPoint[];
  prometheusQueries?: {
    heap?: string;
    disk?: string;
    cpu?: string;
    load?: string;
    load1?: string;
    load5?: string;
    load15?: string;
  };
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
 * Load Average chart with 3 series (1min, 5min, 15min)
 */
function LoadAverageChart({
  loadHistory,
  load5History,
  load15History,
  prometheusQueries,
}: {
  loadHistory: DataPoint[];
  load5History?: DataPoint[];
  load15History?: DataPoint[];
  prometheusQueries?: { load1?: string; load5?: string; load15?: string };
}) {
  const { colorScheme } = useMantineColorScheme();
  const hasData = loadHistory && loadHistory.length > 0;
  
  // Theme-aware code block colors
  const isDark = colorScheme === 'dark';
  const codeBg = isDark ? 'var(--mantine-color-dark-6)' : 'var(--mantine-color-gray-1)';
  const codeColor = isDark ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)';
  
  // Combine all 3 series into single dataset
  const combinedData = loadHistory.map((point) => ({
    time: formatTime(point.timestamp),
    load1: point.value,
    load5: load5History?.find((p) => p.timestamp === point.timestamp)?.value || point.value,
    load15: load15History?.find((p) => p.timestamp === point.timestamp)?.value || point.value,
  }));

  return (
    <Card shadow="sm" padding="lg">
      <Stack gap="xs">
        <Text size="sm" fw={500}>
          Load Average Over Time
        </Text>
        {hasData ? (
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart
              data={combinedData}
              margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="colorLoad1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--mantine-color-orange-6)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--mantine-color-orange-6)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorLoad5" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="colorLoad15" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.05} />
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
                width={35}
                tickFormatter={(value) => value.toFixed(2)}
              />
              <RechartsTooltip
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-7)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '4px',
                  color: 'var(--mantine-color-gray-0)',
                }}
                labelStyle={{ color: 'var(--mantine-color-gray-0)' }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="load1"
                stroke="var(--mantine-color-orange-6)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLoad1)"
                name="1 min"
                dot={{ fill: 'var(--mantine-color-orange-6)', r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="load5"
                stroke="var(--mantine-color-blue-6)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLoad5)"
                name="5 min"
                dot={{ fill: 'var(--mantine-color-blue-6)', r: 2 }}
                activeDot={{ r: 4 }}
              />
              <Area
                type="monotone"
                dataKey="load15"
                stroke="var(--mantine-color-green-6)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorLoad15)"
                name="15 min"
                dot={{ fill: 'var(--mantine-color-green-6)', r: 2 }}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <Stack justify="center" align="center" style={{ height: 200 }}>
            <Text size="sm" c="dimmed">
              Load average data not available
            </Text>
          </Stack>
        )}
        {prometheusQueries?.load1 && (
          <Stack gap="xs">
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
              {`1m:  ${prometheusQueries.load1}
5m:  ${prometheusQueries.load5}
15m: ${prometheusQueries.load15}`}
            </Code>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}

/**
 * NodeCharts component displays time series charts for node metrics
 * Uses reusable TimeSeriesChart components with theme-aware styling
 */
export function NodeCharts({
  heapHistory,
  diskHistory,
  cpuHistory,
  loadHistory,
  load5History,
  load15History,
  prometheusQueries,
}: NodeChartsProps) {
  return (
    <Grid>
      {/* Heap Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="Heap Usage Over Time"
          data={heapHistory}
          dataKey="heap"
          color="var(--mantine-color-blue-6)"
          gradientId="colorHeap"
          unit="%"
          valueFormatter={(value: number | undefined) =>
            value !== undefined ? `${value.toFixed(1)}%` : 'N/A'
          }
          tickFormatter={(value: number) => `${value}%`}
          query={prometheusQueries?.heap}
        />
      </Grid.Col>

      {/* Disk Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="Disk Usage Over Time"
          data={diskHistory}
          dataKey="disk"
          color="var(--mantine-color-cyan-6)"
          gradientId="colorDisk"
          unit="%"
          valueFormatter={(value: number | undefined) =>
            value !== undefined ? `${value.toFixed(1)}%` : 'N/A'
          }
          tickFormatter={(value: number) => `${value}%`}
          query={prometheusQueries?.disk}
        />
      </Grid.Col>

      {/* CPU Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <TimeSeriesChart
          title="CPU Usage Over Time"
          data={cpuHistory}
          dataKey="cpu"
          color="var(--mantine-color-green-6)"
          gradientId="colorCpu"
          unit="%"
          valueFormatter={(value: number | undefined) =>
            value !== undefined ? `${value.toFixed(1)}%` : 'N/A'
          }
          tickFormatter={(value: number) => `${value}%`}
          query={prometheusQueries?.cpu}
        />
      </Grid.Col>

      {/* Load Average Over Time (3 series) */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <LoadAverageChart
          loadHistory={loadHistory}
          load5History={load5History}
          load15History={load15History}
          prometheusQueries={prometheusQueries}
        />
      </Grid.Col>
    </Grid>
  );
}

export default NodeCharts;
