import { Card, Grid, Stack, Text, useMantineColorScheme } from '@mantine/core';
import {
  AreaChart,
  Area,
  ResponsiveContainer,
  Tooltip,
  YAxis,
  XAxis,
  CartesianGrid,
} from 'recharts';
import type { DataPoint } from '../hooks/useSparklineData';

/**
 * NodeCharts component displays time series charts for node metrics
 * Uses recharts to create Mantine-styled visualizations with theme-aware tooltips
 */

interface NodeChartsProps {
  heapHistory: DataPoint[];
  diskHistory: DataPoint[];
  cpuHistory: DataPoint[];
  loadHistory: DataPoint[];
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
 * Format percentage value for tooltip
 */
function formatPercentage(value: number | undefined): string {
  return value !== undefined ? `${value.toFixed(1)}%` : 'N/A';
}

/**
 * Format load average value for tooltip
 */
function formatLoadValue(value: number | undefined): string {
  return value !== undefined ? value.toFixed(2) : 'N/A';
}

export function NodeCharts({ heapHistory, diskHistory, cpuHistory, loadHistory }: NodeChartsProps) {
  const { colorScheme } = useMantineColorScheme();

  // Theme-aware tooltip styles for good contrast in both light and dark modes
  const tooltipStyle = {
    backgroundColor:
      colorScheme === 'dark' ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
    border: `1px solid ${colorScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
    borderRadius: '4px',
    color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)',
  };

  // Prepare heap data with formatted time
  const heapData = heapHistory.map((point) => ({
    timestamp: point.timestamp,
    time: formatTime(point.timestamp),
    value: point.value,
  }));

  // Prepare disk data with formatted time
  const diskData = diskHistory.map((point) => ({
    timestamp: point.timestamp,
    time: formatTime(point.timestamp),
    value: point.value,
  }));

  // Prepare CPU data with formatted time
  const cpuData = cpuHistory.map((point) => ({
    timestamp: point.timestamp,
    time: formatTime(point.timestamp),
    value: point.value,
  }));

  // Prepare load average data with formatted time
  const loadData = loadHistory.map((point) => ({
    timestamp: point.timestamp,
    time: formatTime(point.timestamp),
    value: point.value,
  }));

  return (
    <Grid>
      {/* Heap Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card shadow="sm" padding="lg">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              Heap Usage Over Time
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={heapData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorHeap" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.05} />
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
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                   contentStyle={tooltipStyle}
                   formatter={formatPercentage}
                 />
                 <Area
                   type="monotone"
                   dataKey="value"
                   stroke="var(--mantine-color-blue-6)"
                   strokeWidth={2}
                   fillOpacity={1}
                   fill="url(#colorHeap)"
                   name="Heap Usage"
                   dot={{ fill: 'var(--mantine-color-blue-6)', r: 3 }}
                   activeDot={{ r: 5 }}
                 />
                </AreaChart>
                </ResponsiveContainer>
                </Stack>
                </Card>
                </Grid.Col>

                {/* Disk Usage Over Time */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg">
                <Stack gap="xs">
                <Text size="sm" fw={500}>
                Disk Usage Over Time
                </Text>
                <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={diskData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--mantine-color-cyan-6)" stopOpacity={0.3} />
                     <stop offset="95%" stopColor="var(--mantine-color-cyan-6)" stopOpacity={0.05} />
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
                   domain={[0, 100]}
                   tickFormatter={(value) => `${value}%`}
                 />
                 <Tooltip
                   contentStyle={tooltipStyle}
                   formatter={formatPercentage}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--mantine-color-cyan-6)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDisk)"
                  name="Disk Usage"
                  dot={{ fill: 'var(--mantine-color-cyan-6)', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Stack>
        </Card>
      </Grid.Col>

      {/* CPU Usage Over Time */}
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card shadow="sm" padding="lg">
          <Stack gap="xs">
            <Text size="sm" fw={500}>
              CPU Usage Over Time
            </Text>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={cpuData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.3} />
                    <stop
                      offset="95%"
                      stopColor="var(--mantine-color-green-6)"
                      stopOpacity={0.05}
                    />
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
                  domain={[0, 100]}
                  tickFormatter={(value) => `${value}%`}
                />
                <Tooltip
                   contentStyle={tooltipStyle}
                   formatter={formatPercentage}
                 />
                 <Area
                   type="monotone"
                   dataKey="value"
                   stroke="var(--mantine-color-green-6)"
                   strokeWidth={2}
                   fillOpacity={1}
                   fill="url(#colorCpu)"
                   name="CPU Usage"
                   dot={{ fill: 'var(--mantine-color-green-6)', r: 3 }}
                   activeDot={{ r: 5 }}
                 />
                </AreaChart>
                </ResponsiveContainer>
                </Stack>
                </Card>
                </Grid.Col>

                {/* Load Average Over Time */}
                <Grid.Col span={{ base: 12, md: 6 }}>
                <Card shadow="sm" padding="lg">
                <Stack gap="xs">
                <Text size="sm" fw={500}>
                Load Average Over Time
                </Text>
                <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={loadData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                 <defs>
                   <linearGradient id="colorLoad" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="var(--mantine-color-orange-6)" stopOpacity={0.3} />
                     <stop
                       offset="95%"
                       stopColor="var(--mantine-color-orange-6)"
                       stopOpacity={0.05}
                     />
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
                 <Tooltip
                   contentStyle={tooltipStyle}
                   formatter={formatLoadValue}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="var(--mantine-color-orange-6)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorLoad)"
                  name="Load Average"
                  dot={{ fill: 'var(--mantine-color-orange-6)', r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </Stack>
        </Card>
      </Grid.Col>
    </Grid>
  );
}
