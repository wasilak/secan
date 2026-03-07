import { Grid, Stack, Group, useMantineColorScheme, Card, Text } from '@mantine/core';
import type { DataPoint } from '../../hooks/useSparklineData';
import type { NodeInfo } from '../../types/api';
import { TimeSeriesChart, DistributionChart, NodeRolesChart } from './index';
import HiddenIndicesToggle from './HiddenIndicesToggle';

interface ClusterStatisticsProps {
  // Time series data with timestamps
  nodesHistory: DataPoint[];
  cpuHistory?: DataPoint[];
  memoryHistory?: DataPoint[];
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
 * Format bytes to human-readable format
 */
function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes === 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const k = 1024;
  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const unitIndex = Math.min(i, units.length - 1);

  return `${(bytes / Math.pow(k, unitIndex)).toFixed(2)} ${units[unitIndex]}`;
}

/**
 * ClusterStatistics component displays various charts for cluster metrics
 * Uses modular sub-components for better maintainability
 */
export function ClusterStatistics({
  nodesHistory,
  cpuHistory,
  memoryHistory,
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
  const systemDocsCount =
    allIndices
      ?.filter((idx) => idx.name.startsWith('.'))
      .reduce((sum, idx) => sum + (idx.docsCount || 0), 0) || 0;
  const systemShardsCount =
    allIndices
      ?.filter((idx) => idx.name.startsWith('.'))
      .reduce((sum, idx) => sum + (idx.primaries || 0) + (idx.replicas || 0), 0) || 0;

  // Filter indices based on showHiddenIndices toggle
  const filteredIndicesHistory = indicesHistory.map((point) => ({
    ...point,
    value:
      showHiddenIndices === false && systemIndicesCount > 0
        ? Math.max(0, point.value - systemIndicesCount)
        : point.value,
  }));

  // Filter documents based on showHiddenIndices toggle
  const filteredDocumentsHistory = documentsHistory.map((point) => ({
    ...point,
    value:
      showHiddenIndices === false && systemDocsCount > 0
        ? Math.max(0, point.value - systemDocsCount)
        : point.value,
  }));

  // Filter shards based on showHiddenIndices toggle
  const filteredShardsHistory = shardsHistory.map((point) => ({
    ...point,
    value:
      showHiddenIndices === false && systemShardsCount > 0
        ? Math.max(0, point.value - systemShardsCount)
        : point.value,
  }));

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

  // Calculate node counts by role for radar chart
  const roleCount = new Map<string, number>();
  nodes?.forEach((node) => {
    node.roles.forEach((role) => {
      roleCount.set(role, (roleCount.get(role) || 0) + 1);
    });
  });

  const nodeRolesData = Array.from(roleCount.entries()).map(([role, count]) => ({
    role: role,
    count,
    fullMark: Math.max(...Array.from(roleCount.values())) + 2,
  }));

  // Prepare memory usage data for donut chart
  const memoryUsageData =
    stats?.memoryTotal && stats.memoryTotal > 0
      ? [
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
        ].filter((item) => item.value > 0)
      : [];

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

      {/* First Row: Cluster Resources (4 columns) - Nodes, CPU, Memory, Disk */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Nodes Over Time"
            data={nodesHistory}
            dataKey="nodes"
            color="var(--mantine-color-blue-6)"
            gradientId="colorNodes"
            query={prometheusQueries?.nodes}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="CPU Usage Over Time"
            data={cpuHistory || []}
            dataKey="cpu"
            color="var(--mantine-color-red-6)"
            gradientId="colorCpu"
            unit="%"
            valueFormatter={(value: number | undefined) => value?.toFixed(1) + '%'}
            query={prometheusQueries?.cpu_usage_percent}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Memory Usage Over Time"
            data={memoryHistory || []}
            dataKey="memory"
            color="var(--mantine-color-violet-6)"
            gradientId="colorMemory"
            valueFormatter={(value: number | undefined) => {
              if (!value) return '0 MB';
              const mb = value / (1024 * 1024);
              if (mb >= 1024) return `${(mb / 1024).toFixed(1)}GB`;
              return `${mb.toFixed(0)}MB`;
            }}
            tickFormatter={(value) => {
              const mb = value / (1024 * 1024);
              if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
              return `${mb.toFixed(0)}MB`;
            }}
            query={prometheusQueries?.jvm_memory_used_bytes}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Disk Usage Over Time"
            data={diskUsageHistory || []}
            dataKey="disk"
            color="var(--mantine-color-orange-6)"
            gradientId="colorDisk"
            valueFormatter={(value: number | undefined) => {
              if (value === undefined) return '0 B';
              return formatBytes(value);
            }}
            tickFormatter={(value) => {
              if (value === 0) return '0 B';
              const kb = value / 1024;
              const mb = value / (1024 * 1024);
              const gb = value / (1024 * 1024 * 1024);
              if (gb >= 1) return `${gb.toFixed(1)}GB`;
              if (kb >= 1024) return `${mb.toFixed(1)}MB`;
              return `${kb.toFixed(0)}KB`;
            }}
            query={prometheusQueries?.disk_used_bytes}
          />
        </Grid.Col>
      </Grid>

      {/* Second Row: Index & Shard Metrics (4 columns) */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Indices Over Time"
            data={filteredIndicesHistory}
            dataKey="indices"
            color="var(--mantine-color-green-6)"
            gradientId="colorIndices"
            query={prometheusQueries?.indices}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Documents Over Time"
            data={filteredDocumentsHistory}
            dataKey="documents"
            color="var(--mantine-color-cyan-6)"
            gradientId="colorDocuments"
            valueFormatter={(value: number | undefined) => {
              if (value === undefined) return '0';
              return value > 1000000 ? value.toLocaleString() : value.toString();
            }}
            query={prometheusQueries?.documents}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Active Shards Over Time"
            data={filteredShardsHistory}
            dataKey="shards"
            color="var(--mantine-color-violet-6)"
            gradientId="colorShards"
            query={prometheusQueries?.shards}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Unassigned Shards Over Time"
            data={unassignedHistory}
            dataKey="unassigned"
            color="var(--mantine-color-red-6)"
            gradientId="colorUnassigned"
            query={prometheusQueries?.unassigned_shards}
          />
        </Grid.Col>
      </Grid>

      {/* Third Row: Distribution Charts (3 columns) */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 4 }}>
          <DistributionChart
            title="Shard Distribution"
            data={shardTypesData}
            colorScheme={colorScheme}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {memoryUsageData.length > 0 ? (
            <DistributionChart
              title="Memory Usage"
              data={memoryUsageData}
              colorScheme={colorScheme}
            />
          ) : (
            <Card shadow="sm" padding="lg">
              <Stack justify="center" align="center" style={{ height: 200 }}>
                <Text size="sm" c="dimmed">
                  Memory data not available
                </Text>
              </Stack>
            </Card>
          )}
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          <NodeRolesChart title="Nodes by Role" data={nodeRolesData} />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export default ClusterStatistics;
