import {
  Card,
  Grid,
  Stack,
  Text,
  useMantineColorScheme,
  type MantineColorScheme,
  Code,
  Group,
  ActionIcon,
  Tooltip as MantineTooltip,
  Box,
  Badge,
} from '@mantine/core';
import {
  IconCopy,
  IconCheck,
  IconEye,
  IconEyeOff,
} from '@tabler/icons-react';
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
  Tooltip as RechartsTooltip,
  Legend,
  YAxis,
  XAxis,
  CartesianGrid,
} from 'recharts';
import type { DataPoint } from '../hooks/useSparklineData';
import type { NodeInfo } from '../types/api';
import { formatBytes } from '../utils/formatters';

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
  diskUsageHistory?: DataPoint[];

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
    memoryUsed?: number;
    memoryTotal?: number;
    cpuPercent?: number;
    diskUsed?: number;
    diskTotal?: number;
  };

  // Nodes data for role distribution
  nodes?: NodeInfo[];
  
  // Prometheus queries used
  prometheusQueries?: Record<string, string>;
  
  // Hidden indices toggle
  showHiddenIndices?: boolean;
  onToggleHiddenIndices?: (show: boolean) => void;
  hiddenIndicesCount?: number;
  
  // All indices data for filtering (includes system indices)
  allIndices?: Array<{
    name: string;
    docsCount?: number;
    primaries?: number;
    replicas?: number;
  }>;
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
          backgroundColor:
            effectiveScheme === 'dark'
              ? 'var(--mantine-color-dark-7)'
              : 'var(--mantine-color-gray-0)',
          border: `1px solid ${effectiveScheme === 'dark' ? 'var(--mantine-color-dark-4)' : 'var(--mantine-color-gray-3)'}`,
          borderRadius: '4px',
          padding: '8px 12px',
          color:
            effectiveScheme === 'dark'
              ? 'var(--mantine-color-gray-0)'
              : 'var(--mantine-color-dark-7)',
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

/**
 * CopyButton component for copying query text
 */
interface QueryCopyButtonProps {
  value: string;
}

function QueryCopyButton({ value }: QueryCopyButtonProps) {
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <MantineTooltip label="Copy query" position="top">
      <ActionIcon variant="subtle" color="gray" size="sm" onClick={copyToClipboard}>
        <IconCopy style={{ width: '1rem', height: '1rem' }} />
      </ActionIcon>
    </MantineTooltip>
  );
}

/**
 * Display Prometheus query with copy button
 */
interface MetricQueryDisplayProps {
  metricName: string;
  query?: string;
}

function MetricQueryDisplay({ metricName, query }: MetricQueryDisplayProps) {
  if (!query) return null;

  const isApiQuery = query.includes('API');
  
  return (
    <Box mt="xs">
      <Group gap="xs" wrap="nowrap">
        <Text size="xs" c="dimmed" style={{ flex: 1 }}>
          <Code block>{query}</Code>
        </Text>
        <QueryCopyButton value={query} />
      </Group>
    </Box>
  );
}

/**
 * Hidden indices toggle button (similar to indices list filter)
 */
interface HiddenIndicesToggleProps {
  showHiddenIndices: boolean;
  onToggle: (show: boolean) => void;
  hiddenIndicesCount: number;
}

function HiddenIndicesToggle({ showHiddenIndices, onToggle, hiddenIndicesCount }: HiddenIndicesToggleProps) {
  return (
    <Group
      gap="xs"
      style={{
        cursor: 'pointer',
        opacity: showHiddenIndices ? 1 : 0.5,
        transition: 'opacity 150ms',
      }}
      onClick={() => onToggle(!showHiddenIndices)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle(!showHiddenIndices);
        }
      }}
      tabIndex={0}
      role="button"
    >
      {showHiddenIndices ? (
        <IconEye style={{ width: '1rem', height: '1rem' }} stroke={2} color="var(--mantine-color-violet-6)" />
      ) : (
        <IconEyeOff style={{ width: '1rem', height: '1rem' }} stroke={2} color="var(--mantine-color-violet-6)" />
      )}
      <Text size="xs" c="violet">
        special
      </Text>
      {hiddenIndicesCount > 0 && (
        <Badge size="xs" variant="light" color="violet">
          {hiddenIndicesCount}
        </Badge>
      )}
    </Group>
  );
}

export function ClusterStatistics({
  nodesHistory,
  indicesHistory,
  documentsHistory,
  shardsHistory,
  unassignedHistory,
  diskUsageHistory,
  stats,
  nodes,
  prometheusQueries,
  showHiddenIndices,
  onToggleHiddenIndices,
  hiddenIndicesCount,
  allIndices,
}: ClusterStatisticsProps) {
  const { colorScheme } = useMantineColorScheme();

  // Calculate system indices statistics from per-index data
  const systemIndicesCount = allIndices?.filter((idx) => idx.name.startsWith('.')).length || 0;
  const systemDocsCount = allIndices
    ?.filter((idx) => idx.name.startsWith('.'))
    .reduce((sum, idx) => sum + (idx.docsCount || 0), 0) || 0;
  const systemShardsCount = allIndices
    ?.filter((idx) => idx.name.startsWith('.'))
    .reduce((sum, idx) => sum + (idx.primaries || 0) + (idx.replicas || 0), 0) || 0;

  // Filter indices based on showHiddenIndices toggle
  const filteredIndicesHistory = indicesHistory.map(point => ({
    ...point,
    value: showHiddenIndices === false && systemIndicesCount > 0
      ? Math.max(0, point.value - systemIndicesCount)
      : point.value,
  }));
  
  // Filter documents based on showHiddenIndices toggle
  const filteredDocumentsHistory = documentsHistory.map(point => ({
    ...point,
    value: showHiddenIndices === false && systemDocsCount > 0
      ? Math.max(0, point.value - systemDocsCount)
      : point.value,
  }));
  
  // Filter shards based on showHiddenIndices toggle
  const filteredShardsHistory = shardsHistory.map(point => ({
    ...point,
    value: showHiddenIndices === false && systemShardsCount > 0
      ? Math.max(0, point.value - systemShardsCount)
      : point.value,
  }));

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
    indices: filteredIndicesHistory[index]?.value || 0,
    documents: filteredDocumentsHistory[index]?.value || 0,
    shards: filteredShardsHistory[index]?.value || 0,
    unassigned: unassignedHistory[index]?.value || 0,
    diskUsed: diskUsageHistory?.[index]?.value || 0,
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

  // Prepare node types data for donut chart - REPLACED with Memory Usage
  // Show current memory utilization from stats
  const memoryUsageData = stats?.memoryTotal && stats?.memoryTotal > 0 ? [
    {
      name: 'Used Memory',
      value: stats.memoryUsed || 0,
      color: 'var(--mantine-color-blue-6)',
    },
    {
      name: 'Free Memory',
      value: stats.memoryTotal - (stats.memoryUsed || 0),
      color: 'var(--mantine-color-gray-6)',
    },
  ].filter((item) => item.value > 0) : [];

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
      {/* Hidden Indices Toggle (top right) */}
      {onToggleHiddenIndices && hiddenIndicesCount !== undefined && (
        <Group justify="flex-end" align="flex-start" style={{ width: '100%' }}>
          <HiddenIndicesToggle
            showHiddenIndices={showHiddenIndices ?? false}
            onToggle={onToggleHiddenIndices}
            hiddenIndicesCount={hiddenIndicesCount}
          />
        </Group>
      )}

      {/* First Row: Nodes, Indices, and Disk Usage Over Time (3 columns) */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Nodes Over Time
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
                  <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
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
                </AreaChart>
              </ResponsiveContainer>
              <MetricQueryDisplay 
                metricName="nodes" 
                query={prometheusQueries?.nodes} 
              />
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Indices Over Time
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
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
                  <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
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
              <MetricQueryDisplay 
                metricName="indices" 
                query={prometheusQueries?.indices} 
              />
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Disk Usage Over Time
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor="var(--mantine-color-orange-6)"
                        stopOpacity={0.3}
                      />
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
                    width={50}
                    domain={[0, 'dataMax']}
                    tickFormatter={(value) => {
                      if (value === 0) return '0 B';
                      const kb = value / 1024;
                      const mb = value / (1024 * 1024);
                      const gb = value / (1024 * 1024 * 1024);
                      if (gb >= 1) return `${gb.toFixed(1)}GB`;
                      if (kb >= 1024) return `${mb.toFixed(1)}MB`;
                      return `${kb.toFixed(0)}KB`;
                    }}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return '0 B';
                      return formatBytes(value);
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="diskUsed"
                    stroke="var(--mantine-color-orange-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDisk)"
                    name="Disk Used"
                    dot={{ fill: 'var(--mantine-color-orange-6)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <MetricQueryDisplay 
                metricName="disk_usage" 
                query={prometheusQueries?.disk_used_bytes} 
              />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Second Row: Active Shards, Unassigned Shards, and Documents Over Time (3 columns) */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Active Shards Over Time
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
                  <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
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
                </AreaChart>
              </ResponsiveContainer>
              <MetricQueryDisplay
                metricName="shards"
                query={prometheusQueries?.shards}
              />
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Unassigned Shards Over Time
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
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
                  <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
                  <Area
                    type="monotone"
                    dataKey="unassigned"
                    stroke="var(--mantine-color-red-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorUnassigned)"
                    name="Unassigned Shards"
                    dot={{ fill: 'var(--mantine-color-red-6)', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
              <MetricQueryDisplay
                metricName="unassigned_shards"
                query={prometheusQueries?.unassigned_shards}
              />
            </Stack>
          </Card>
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Documents Over Time
              </Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart
                  data={timeSeriesData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="colorDocuments" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-cyan-6)" stopOpacity={0.3} />
                      <stop
                        offset="95%"
                        stopColor="var(--mantine-color-cyan-6)"
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
                    width={50}
                    tickFormatter={(value) => value.toLocaleString()}
                  />
                  <RechartsTooltip
                    contentStyle={tooltipStyle}
                    labelStyle={tooltipLabelStyle}
                    formatter={(value: number | undefined) => {
                      if (value === undefined) return '0';
                      // Format large numbers (documents, disk) with locale
                      return value > 1000000 ? value.toLocaleString() : value.toString();
                    }}
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
              <MetricQueryDisplay 
                metricName="documents" 
                query={prometheusQueries?.documents} 
              />
            </Stack>
          </Card>
        </Grid.Col>
      </Grid>

      {/* Donut Charts and Resource Trend Bar Chart */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>
                Memory Usage
              </Text>
              {memoryUsageData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={memoryUsageData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {memoryUsageData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip content={<PieTooltip colorScheme={colorScheme} />} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <Stack justify="center" align="center" style={{ height: 200 }}>
                  <Text size="sm" c="dimmed">
                    Memory data not available
                  </Text>
                </Stack>
              )}
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
                  <RechartsTooltip content={<PieTooltip colorScheme={colorScheme} />} />
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
                  <RechartsTooltip contentStyle={tooltipStyle} labelStyle={tooltipLabelStyle} />
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
