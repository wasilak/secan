import { Card, Grid, Stack, Text } from '@mantine/core';
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
  CartesianGrid,
} from 'recharts';

/**
 * ClusterStatistics component displays various charts for cluster metrics
 * Uses recharts to create Mantine-styled visualizations with professional design
 */

interface ClusterStatisticsProps {
  // Time series data
  nodesHistory: number[];
  indicesHistory: number[];
  documentsHistory: number[];
  shardsHistory: number[];
  unassignedHistory: number[];
  
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

export function ClusterStatistics({
  nodesHistory,
  indicesHistory,
  documentsHistory,
  shardsHistory,
  unassignedHistory,
  stats,
}: ClusterStatisticsProps) {
  // Prepare time series data for area charts
  const timeSeriesData = nodesHistory.map((_, index) => ({
    index,
    nodes: nodesHistory[index] || 0,
    indices: indicesHistory[index] || 0,
    documents: documentsHistory[index] || 0,
    shards: shardsHistory[index] || 0,
    unassigned: unassignedHistory[index] || 0,
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

  // Prepare radar chart data for cluster health overview
  const maxNodes = Math.max(...nodesHistory, 1);
  const maxIndices = Math.max(...indicesHistory, 1);
  const maxShards = Math.max(...shardsHistory, 1);
  const maxDocs = Math.max(...documentsHistory, 1);

  const radarData = [
    {
      metric: 'Nodes',
      value: ((stats?.numberOfNodes || 0) / maxNodes) * 100,
      fullMark: 100,
    },
    {
      metric: 'Indices',
      value: ((stats?.numberOfIndices || 0) / maxIndices) * 100,
      fullMark: 100,
    },
    {
      metric: 'Shards',
      value: ((stats?.activeShards || 0) / maxShards) * 100,
      fullMark: 100,
    },
    {
      metric: 'Documents',
      value: ((stats?.numberOfDocuments || 0) / maxDocs) * 100,
      fullMark: 100,
    },
    {
      metric: 'Health',
      value: stats?.unassignedShards === 0 ? 100 : stats?.unassignedShards === undefined ? 0 : Math.max(0, 100 - (stats.unassignedShards * 10)),
      fullMark: 100,
    },
  ];

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

      {/* Donut Charts and Radar Chart */}
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
              <Text size="sm" fw={500}>Cluster Health Overview</Text>
              <ResponsiveContainer width="100%" height={200}>
                <RadarChart data={radarData}>
                  <PolarGrid stroke="var(--mantine-color-dark-4)" />
                  <PolarAngleAxis
                    dataKey="metric"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 12 }}
                  />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} />
                  <Radar
                    name="Current"
                    dataKey="value"
                    stroke="var(--mantine-color-blue-6)"
                    fill="var(--mantine-color-blue-6)"
                    fillOpacity={0.6}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--mantine-color-dark-7)',
                      border: '1px solid var(--mantine-color-dark-4)',
                      borderRadius: '4px',
                    }}
                    formatter={(value: number | undefined) => `${(value || 0).toFixed(1)}%`}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>
    </Stack>
  );
}
