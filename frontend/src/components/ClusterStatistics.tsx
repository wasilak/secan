import { Card, Grid, Stack, Text } from '@mantine/core';
import {
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  ResponsiveContainer,
  Tooltip,
  Legend,
  YAxis,
  XAxis,
  CartesianGrid,
} from 'recharts';
import type { DataPoint } from '../hooks/useSparklineData';

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
    hour12: false 
  });
}

export function ClusterStatistics({
  nodesHistory,
  indicesHistory,
  documentsHistory,
  shardsHistory,
  unassignedHistory,
  stats,
}: ClusterStatisticsProps) {
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

  // Prepare node types data for donut chart
  const nodeTypesData = [
    { name: 'Data Nodes', value: stats?.numberOfDataNodes || 0, color: 'var(--mantine-color-blue-6)' },
    { name: 'Other Nodes', value: (stats?.numberOfNodes || 0) - (stats?.numberOfDataNodes || 0), color: 'var(--mantine-color-gray-6)' },
  ].filter(item => item.value > 0);

  // Prepare shard types data for donut chart
  const shardTypesData = [
    { name: 'Primary', value: stats?.activePrimaryShards || 0, color: 'var(--mantine-color-green-6)' },
    { name: 'Replica', value: (stats?.activeShards || 0) - (stats?.activePrimaryShards || 0), color: 'var(--mantine-color-cyan-6)' },
    { name: 'Unassigned', value: stats?.unassignedShards || 0, color: 'var(--mantine-color-red-6)' },
    { name: 'Relocating', value: stats?.relocatingShards || 0, color: 'var(--mantine-color-yellow-6)' },
  ].filter(item => item.value > 0);

  // Prepare resource usage bar chart data
  // Show trend of key metrics over time (last 5 data points)
  const recentDataPoints = Math.min(5, nodesHistory.length);
  const resourceTrendData = nodesHistory.slice(-recentDataPoints).map((nodePoint, index) => ({
    time: formatTime(nodePoint.timestamp),
    Nodes: nodePoint.value,
    Indices: indicesHistory.slice(-recentDataPoints)[index]?.value || 0,
    'Active Shards': shardsHistory.slice(-recentDataPoints)[index]?.value || 0,
    'Unassigned': unassignedHistory.slice(-recentDataPoints)[index]?.value || 0,
  }));

  return (
    <Stack gap="md">
      {/* Time Series Charts */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 6 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Nodes & Indices Over Time</Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorNodes" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorIndices" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-4)',
                      borderRadius: '4px',
                    }}
                  />
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
              <Text size="sm" fw={500}>Shards Over Time</Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorShards" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-violet-6)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--mantine-color-violet-6)" stopOpacity={0.05}/>
                    </linearGradient>
                    <linearGradient id="colorUnassigned" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-red-6)" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="var(--mantine-color-red-6)" stopOpacity={0.05}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-4)',
                      borderRadius: '4px',
                    }}
                  />
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
          <Text size="sm" fw={500}>Documents Over Time</Text>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={timeSeriesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorDocuments" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--mantine-color-cyan-6)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--mantine-color-cyan-6)" stopOpacity={0.05}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
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
                contentStyle={{
                  backgroundColor: 'var(--mantine-color-dark-7)',
                  border: '1px solid var(--mantine-color-dark-4)',
                  borderRadius: '4px',
                }}
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
              <Text size="sm" fw={500}>Node Types</Text>
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-4)',
                      borderRadius: '4px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Shard Distribution</Text>
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
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-4)',
                      borderRadius: '4px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Recent Metrics Snapshot</Text>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={resourceTrendData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
                  <XAxis 
                    dataKey="time"
                    stroke="var(--mantine-color-gray-6)" 
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 9 }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis 
                    stroke="var(--mantine-color-gray-6)" 
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    width={30}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-4)',
                      borderRadius: '4px',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ fontSize: '10px' }}
                    iconSize={8}
                  />
                  <Bar dataKey="Nodes" fill="var(--mantine-color-blue-6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Indices" fill="var(--mantine-color-green-6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Active Shards" fill="var(--mantine-color-violet-6)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Unassigned" fill="var(--mantine-color-red-6)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
