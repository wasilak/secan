import { Grid, Stack, Group, useMantineColorScheme, Card, Text } from '@mantine/core';
import { useMemo } from 'react';
import type { DataPoint } from '../../hooks/useSparklineData';
import type { NodeInfo } from '../../types/api';
import { DistributionChart, NodeRolesChart } from './index';
import { TimeSeriesChart } from '../charts/TimeSeriesChart';
import HiddenIndicesToggle from './HiddenIndicesToggle';
import { formatBytes } from '../../utils/formatters';

interface ClusterStatisticsProps {
  // Time series data with timestamps
  nodesHistory: DataPoint[];
  cpuHistory?: DataPoint[];
  cpuSeries?: Array<{ name: string; data: DataPoint[]; labels: Record<string, string> }>;
  memoryHistory?: DataPoint[];
  memorySeries?: Array<{ name: string; data: DataPoint[]; labels: Record<string, string> }>;
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

  // Whether metrics data is currently being refreshed in the background
  metricsLoading?: boolean;
}

/**
 * ClusterStatistics component displays various charts for cluster metrics
 * Uses modular sub-components for better maintainability
 */
export function ClusterStatistics({
  nodesHistory,
  cpuHistory,
  cpuSeries,
  memoryHistory,
  memorySeries,
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
  metricsLoading,
}: ClusterStatisticsProps) {
  const { colorScheme } = useMantineColorScheme();

  // Memoize series arrays to prevent unnecessary re-renders
  const nodesSeries = useMemo(() => [{
    name: 'Nodes',
    color: 'blue' as const,
    data: nodesHistory,
  }], [nodesHistory]);

  const cpuSeriesMemoized = useMemo(() => {
    // For Prometheus: use cpuSeries if available (grouped by labels)
    // For Internal: cpuSeries will be empty, use cpuHistory directly
    if (cpuSeries && cpuSeries.length > 0) {
      const colors: Array<'red' | 'orange' | 'yellow' | 'pink'> = ['red', 'orange', 'yellow', 'pink'];
      return cpuSeries.map((s, idx) => ({
        name: s.name,
        color: colors[idx % 4],
        data: s.data,
      }));
    }
    // Fallback to cpuHistory (used for internal metrics)
    return [{
      name: 'CPU',
      color: 'red' as const,
      data: cpuHistory || [],
      unit: '%',
    }];
  }, [cpuSeries, cpuHistory]);

  const memorySeriesMemoized = useMemo(() => {
    // For Prometheus: use memorySeries if available (grouped by labels)
    // For Internal: memorySeries will be empty, use memoryHistory directly
    if (memorySeries && memorySeries.length > 0) {
      const colors: Array<'violet' | 'grape' | 'indigo' | 'blue'> = ['violet', 'grape', 'indigo', 'blue'];
      return memorySeries.map((s, idx) => ({
        name: s.name,
        color: colors[idx % 4],
        data: s.data,
      }));
    }
    // Fallback to memoryHistory (used for internal metrics)
    return [{
      name: 'Memory',
      color: 'violet' as const,
      data: memoryHistory || [],
    }];
  }, [memorySeries, memoryHistory]);

  // Build a map of timestamp → total bytes across all memory series (for percentage calculation)
  const memoryTotalsByTimestamp = useMemo(() => {
    const totals = new Map<number, number>();
    for (const s of memorySeriesMemoized) {
      for (const point of s.data) {
        totals.set(point.timestamp, (totals.get(point.timestamp) ?? 0) + point.value);
      }
    }
    return totals;
  }, [memorySeriesMemoized]);

  const diskSeries = useMemo(() => [{
    name: 'Disk',
    color: 'orange' as const,
    data: diskUsageHistory || [],
  }], [diskUsageHistory]);

  // Calculate system indices statistics from per-index data (memoized)
  const systemIndicesCount = useMemo(() => 
    allIndices?.filter((idx) => idx.name.startsWith('.')).length || 0,
    [allIndices]
  );
  
  const systemDocsCount = useMemo(() =>
    allIndices
      ?.filter((idx) => idx.name.startsWith('.'))
      .reduce((sum, idx) => sum + (idx.docsCount || 0), 0) || 0,
    [allIndices]
  );
  
  const systemShardsCount = useMemo(() =>
    allIndices
      ?.filter((idx) => idx.name.startsWith('.'))
      .reduce((sum, idx) => sum + (idx.primaries || 0) + (idx.replicas || 0), 0) || 0,
    [allIndices]
  );

  // Filter indices based on showHiddenIndices toggle (memoized)
  const filteredIndicesHistory = useMemo(() => 
    indicesHistory.map((point) => ({
      ...point,
      value:
        showHiddenIndices === false && systemIndicesCount > 0
          ? Math.max(0, point.value - systemIndicesCount)
          : point.value,
    })),
    [indicesHistory, showHiddenIndices, systemIndicesCount]
  );

  // Filter documents based on showHiddenIndices toggle (memoized)
  const filteredDocumentsHistory = useMemo(() =>
    documentsHistory.map((point) => ({
      ...point,
      value:
        showHiddenIndices === false && systemDocsCount > 0
          ? Math.max(0, point.value - systemDocsCount)
          : point.value,
    })),
    [documentsHistory, showHiddenIndices, systemDocsCount]
  );

  // Filter shards based on showHiddenIndices toggle (memoized)
  const filteredShardsHistory = useMemo(() =>
    shardsHistory.map((point) => ({
      ...point,
      value:
        showHiddenIndices === false && systemShardsCount > 0
          ? Math.max(0, point.value - systemShardsCount)
          : point.value,
    })),
    [shardsHistory, showHiddenIndices, systemShardsCount]
  );

  // Prepare shard types data for donut chart (memoized)
  const shardTypesData = useMemo(() => [
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
  ].filter((item) => item.value > 0), [stats]);

  // Calculate node counts by role for radar chart (memoized)
  const nodeRolesData = useMemo(() => {
    const roleCount = new Map<string, number>();
    nodes?.forEach((node) => {
      node.roles.forEach((role) => {
        roleCount.set(role, (roleCount.get(role) || 0) + 1);
      });
    });

    return Array.from(roleCount.entries()).map(([role, count]) => ({
      role: role,
      count,
      fullMark: Math.max(...Array.from(roleCount.values())) + 2,
    }));
  }, [nodes]);

  // Prepare memory usage data for donut chart (memoized)
  const memoryUsageData = useMemo(() =>
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
      : [],
    [stats]
  );

  // When Prometheus memorySeries is available, build donut data from the latest
  // data point of each area series (heap/non-heap) instead of stats used/free.
  const memoryAreaDistributionData = useMemo(() => {
    if (!memorySeriesMemoized.length || !memorySeriesMemoized[0].data.length) {
      return memoryUsageData;
    }
    const mantineColors: Record<string, string> = {
      violet: 'var(--mantine-color-violet-6)',
      grape: 'var(--mantine-color-grape-6)',
      indigo: 'var(--mantine-color-indigo-6)',
      blue: 'var(--mantine-color-blue-6)',
    };
    return memorySeriesMemoized.map((s) => {
      // Use the most recent data point for the snapshot value
      const latest = s.data.reduce((prev, curr) =>
        curr.timestamp > prev.timestamp ? curr : prev
      );
      return {
        name: s.name,
        value: latest.value,
        color: mantineColors[s.color] ?? `var(--mantine-color-${s.color}-6)`,
      };
    }).filter((item) => item.value > 0);
  }, [memorySeriesMemoized, memoryUsageData]);

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
            series={nodesSeries}
            query={prometheusQueries?.nodes}
            isLoading={metricsLoading}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="CPU Usage Over Time"
            series={cpuSeriesMemoized}
            valueFormatter={(value: number) => value.toFixed(1) + '%'}
            tickFormatter={(value) => value.toFixed(0) + '%'}
            query={prometheusQueries?.cpu_usage_percent}
            isLoading={metricsLoading}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Memory Usage Over Time"
            series={memorySeriesMemoized}
            valueFormatter={(value: number, _seriesName: string, timestamp?: number) => {
              if (!value) return '0 MB';
              const mb = value / (1024 * 1024);
              const sizeStr = mb >= 1024 ? `${(mb / 1024).toFixed(1)}GB` : `${mb.toFixed(0)}MB`;
              if (timestamp !== undefined && memorySeriesMemoized.length > 1) {
                const total = memoryTotalsByTimestamp.get(timestamp);
                if (total && total > 0) {
                  const pct = ((value / total) * 100).toFixed(0);
                  return `${sizeStr} (${pct}%)`;
                }
              }
              return sizeStr;
            }}
            tickFormatter={(value) => {
              const mb = value / (1024 * 1024);
              if (mb >= 1024) return `${(mb / 1024).toFixed(0)}GB`;
              return `${mb.toFixed(0)}MB`;
            }}
            query={prometheusQueries?.jvm_memory_used_bytes}
            isLoading={metricsLoading}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Disk Usage Over Time"
            series={diskSeries}
            valueFormatter={(value: number) => {
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
            isLoading={metricsLoading}
          />
        </Grid.Col>
      </Grid>

      {/* Second Row: Index & Shard Metrics (4 columns) */}
      <Grid>
        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Indices Over Time"
            series={[
              {
                name: 'Indices',
                color: 'green',
                data: filteredIndicesHistory,
              },
            ]}
            query={prometheusQueries?.indices}
            isLoading={metricsLoading}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Documents Over Time"
            series={[
              {
                name: 'Documents',
                color: 'cyan',
                data: filteredDocumentsHistory,
              },
            ]}
            valueFormatter={(value: number) => {
              if (value === undefined) return '0';
              return value > 1000000 ? value.toLocaleString() : value.toString();
            }}
            query={prometheusQueries?.documents}
            isLoading={metricsLoading}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Active Shards Over Time"
            series={[
              {
                name: 'Shards',
                color: 'violet',
                data: filteredShardsHistory,
              },
            ]}
            query={prometheusQueries?.shards}
            isLoading={metricsLoading}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 3 }}>
          <TimeSeriesChart
            title="Unassigned Shards Over Time"
            series={[
              {
                name: 'Unassigned',
                color: 'red',
                data: unassignedHistory,
              },
            ]}
            query={prometheusQueries?.unassigned_shards}
            isLoading={metricsLoading}
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
            query={prometheusQueries?.shards}
          />
        </Grid.Col>

        <Grid.Col span={{ base: 12, md: 4 }}>
          {memoryAreaDistributionData.length > 0 ? (
            <DistributionChart
              title="Memory Usage"
              data={memoryAreaDistributionData}
              colorScheme={colorScheme}
              valueFormatter={formatBytes}
              query={prometheusQueries?.jvm_memory_used_bytes}
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
          <NodeRolesChart
            title="Nodes by Role"
            data={nodeRolesData}
            query={prometheusQueries?.nodes}
          />
        </Grid.Col>
      </Grid>
    </Stack>
  );
}

export default ClusterStatistics;
