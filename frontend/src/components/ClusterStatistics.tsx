import { Card, Grid, Stack, Text, useMantineColorScheme, type MantineColorScheme } from '@mantine/core';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
  Legend,
  YAxis,
  XAxis,
  CartesianGrid,
} from 'recharts';
import type { DataPoint } from '../hooks/useSparklineData';
import type { NodeInfo } from '../types/api';

/**
 * ClusterStatistics component displays various charts for cluster metrics
 * Uses recharts to create Mantine-styled visualizations with professional design
 */

interface ClusterStatisticsProps {
  // Time series data with timestamps
  nodesHistory: DataPoint[];
  indicesHistory: DataPoint[];
  documentsHistory: DataPoint[];
  shardsHistory: DataPoint[];
  unassignedHistory: DataPoint[];

  // Current stats
  stats?: {
    numberOfNodes?: number;
    numberOfDataNodes?: number;
    numberOfIndices?: number;
    numberOfDocuments?: number;
    activeShards?: number;
    activePrimaryShards?: number;
    unassignedShards?: number;
    relocatingShards?: number;
  };

  // Nodes data for role distribution
  nodes?: NodeInfo[];
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
 * Custom tooltip for pie charts with proper dark mode support
 */
interface PieTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: { name: string };
  }>;
  colorScheme: MantineColorScheme;
}

function PieTooltip({ active, payload, colorScheme }: PieTooltipProps) {
  if (active && payload && payload.length) {
    const data = payload[0];
    // Treat 'auto' as 'light' for tooltip styling
    const effectiveScheme = colorScheme === 'auto' ? 'light' : colorScheme;
    return (
      <div
        style={{
          backgroundColor: effectiveScheme === 'dark' ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
          border: `1px solid ${effectiveScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
          borderRadius: '4px',
          padding: '8px 12px',
          color: effectiveScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)',
        }}
      >
        <div style={{ fontSize: '12px', fontWeight: 500 }}>
          {data.payload.name} : {data.value}
        </div>
      </div>
    );
  }
  return null;
}

export function ClusterStatistics({
  nodesHistory,
  indicesHistory,
  documentsHistory,
  shardsHistory,
  unassignedHistory,
  stats,
  nodes,
}: ClusterStatisticsProps) {
  const { colorScheme } = useMantineColorScheme();

  // Theme-aware tooltip styles
  const tooltipStyle = {
    backgroundColor:
      colorScheme === 'dark' ? 'var(--mantine-color-dark-7)' : 'var(--mantine-color-gray-0)',
    border: `1px solid ${colorScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
    borderRadius: '4px',
    color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)',
  };

  // Theme-aware tooltip label styles
  const tooltipLabelStyle = {
    color: colorScheme === 'dark' ? 'var(--mantine-color-gray-0)' : 'var(--mantine-color-dark-7)',
  };

  // Prepare time series data for area charts
  // Merge all histories by timestamp
  const timeSeriesData = nodesHistory.map((nodePoint, index) => ({
    timestamp: nodePoint.timestamp,
    time: formatTime(nodePoint.timestamp),
    nodes: nodePoint.value,
    indices: indicesHistory[index]?.value || 0,
    documents: documentsHistory[index]?.value || 0,
    shards: shardsHistory[index]?.value || 0,
    unassigned: unassignedHistory[index]?.value || 0,
  }));

  // Calculate node counts by role for radar chart
  const roleCount = new Map<string, number>();
  nodes?.forEach((node) => {
    node.roles.forEach((role) => {
      roleCount.set(role, (roleCount.get(role) || 0) + 1);
    });
  });

  const nodeRolesData = Array.from(roleCount.entries()).map(([role, count]) => ({
    role: role, // Use actual role name from Elasticsearch
    count,
    fullMark: Math.max(...Array.from(roleCount.values())) + 2, // Add padding for better visualization
  }));

  // Prepare node types data for donut chart
  const nodeTypesData = [
    {
      name: 'Data Nodes',
      value: stats?.numberOfDataNodes || 0,
      color: 'var(--mantine-color-blue-6)',
    },
    {
      name: 'Other Nodes',
      value: (stats?.numberOfNodes || 0) - (stats?.numberOfDataNodes || 0),
      color: 'var(--mantine-color-gray-6)',
    },
  ].filter((item) => item.value > 0);

  // Prepare shard types data for donut chart
  const shardTypesData = [
    {
      name: 'Primary',
      value: stats?.activePrimaryShards || 0,
      color: 'var(--mantine-color-green-6)',
    },
    {
      name: 'Replica',
      value: (stats?.activeShards || 0) - (stats?.activePrimaryShards || 0),
      color: 'var(--mantine-color-cyan-6)',
    },
    {
      name: 'Unassigned',
      value: stats?.unassignedShards || 0,
      color: 'var(--mantine-color-red-6)',
    },
    {
      name: 'Relocating',
      value: stats?.relocatingShards || 0,
      color: 'var(--mantine-color-yellow-6)',
    },
  ].filter((item) => item.value > 0);

  return (
    <Stack gap="md">
      {/* Time Series Charts */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Nodes & Indices Over Time
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorNodes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="var(--mantine-color-blue-6)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient id="colorIndices" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--mantine-color-green-6)"
                        stopOpacity={0.3}
                      />
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
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Area
                    type="monotone"
                    dataKey="nodes"
                    stroke="var(--mantine-color-blue-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorNodes)"
                    name="Nodes"
                    dot={{ fill: 'var(--mantine-color-blue-6)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="indices"
                    stroke="var(--mantine-color-green-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorIndices)"
                    name="Indices"
                    dot={{ fill: 'var(--mantine-color-green-6)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Shards Over Time
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorShards" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--mantine-color-violet-6)"
                        stopOpacity={0.3}
                      />
                      <stop
                        offset="95%"
                        stopColor="var(--mantine-color-violet-6)"
                        stopOpacity={0.05}
                      />
                    </linearGradient>
                    <linearGradient id="colorUnassigned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-red-6)" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="var(--mantine-color-red-6)"
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
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Area
                    type="monotone"
                    dataKey="shards"
                    stroke="var(--mantine-color-violet-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorShards)"
                    name="Active Shards"
                    dot={{ fill: 'var(--mantine-color-violet-6)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="unassigned"
                    stroke="var(--mantine-color-red-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUnassigned)"
                    name="Unassigned"
                    dot={{ fill: 'var(--mantine-color-red-6)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Documents Time Series - Full Width */}
      <Card shadow="sm" padding="lg">
        <Stack gap="xs">
          <Text size="sm" fw={500}>
            Documents Over Time
          </Text>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDocuments" x1="0" y1="0" x2="0" y2="1">
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
                width={50}
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                contentStyle={tooltipStyle}
                labelStyle={tooltipLabelStyle}
                formatter={(value: number | undefined) => value?.toLocaleString() || '0'}
              />
              <Area
                type="monotone"
                dataKey="documents"
                stroke="var(--mantine-color-cyan-6)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDocuments)"
                name="Documents"
                dot={{ fill: 'var(--mantine-color-cyan-6)', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </Stack>
      </Card>

      {/* Donut Charts and Resource Trend Bar Chart */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Node Types
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={nodeTypesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {nodeTypesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip colorScheme={colorScheme} />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Shard Distribution
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={shardTypesData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {shardTypesData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip colorScheme={colorScheme} />} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Nodes by Role
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={nodeRolesData}>
                  <PolarGrid stroke="var(--mantine-color-dark-4)" />
                  <PolarAngleAxis
                    dataKey="role"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 11 }}
                  />
                  <PolarRadiusAxis
                    angle={90}
                    domain={[0, 'dataMax']}
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                  />
                  <Radar
                    name="Node Count"
                    dataKey="count"
                    stroke="var(--mantine-color-blue-6)"
                    fill="var(--mantine-color-blue-6)"
                    fillOpacity={0.5}
                  />
                  <Tooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
