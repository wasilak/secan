import { Modal, Group, Text, Alert, Stack, Card, Title } from '@mantine/core';
import { IconAlertCircle } from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../api/client';
import { useRefreshInterval } from '../contexts/RefreshContext';
import { MasterIndicator } from './MasterIndicator';
import { NodeDetailSkeleton } from './LoadingSkeleton';
import { NodeDetailContent } from './NodeDetailContent';
import { TimeRangePicker, TIME_RANGE_PRESETS, type TimeRangePreset } from './TimeRangePicker';
import type { NodeDetailStats, NodeMetricsHistoryResponse } from '../types/api';
import type { ClusterInfo } from '../types/api';
import { useState } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from 'recharts';

/**
 * Props for NodeModal component
 */
interface NodeModalProps {
  clusterId: string;
  nodeId: string | null;
  opened: boolean;
  onClose: () => void;
  context: 'topology' | 'nodes' | 'shards';
  clusterInfo?: ClusterInfo;
}

/**
 * NodeModal component displays detailed node information in a modal dialog.
 *
 * This modal can be opened from multiple contexts (topology view, nodes list, shards list)
 * and maintains URL synchronization for direct linking and sharing.
 *
 * Features:
 * - Modal dialog with node details
 * - URL synchronization for direct navigation
 * - Context-aware display (shows over correct view)
 * - Master indicator in title
 * - Scrollable body for long content
 *
 * Requirements: 8.1
 */
export function NodeModal({
  clusterId,
  nodeId,
  opened,
  onClose,
  clusterInfo,
}: NodeModalProps): React.JSX.Element {
  const refreshInterval = useRefreshInterval();
  const isPrometheus = clusterInfo?.metrics_source === 'prometheus';
  const [timeRangeDropdownOpened, setTimeRangeDropdownOpened] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<TimeRangePreset>(TIME_RANGE_PRESETS[2]); // Default 24h

  // Fetch node statistics with auto-refresh
  const {
    data: nodeStats,
    isLoading,
    error,
  } = useQuery<NodeDetailStats>({
    queryKey: ['cluster', clusterId, 'node', nodeId, 'stats'],
    queryFn: () => apiClient.getNodeStats(clusterId, nodeId!),
    refetchInterval: refreshInterval,
    enabled: !!nodeId && opened,
  });

  // Fetch Prometheus node metrics when available
  const { data: nodeMetrics } = useQuery<NodeMetricsHistoryResponse>({
    queryKey: ['cluster', clusterId, 'node', nodeId, 'metrics', selectedTimeRange],
    queryFn: async () => {
      if (!nodeId) throw new Error('Node ID is required');
      const now = Math.floor(Date.now() / 1000);
      const start = now - selectedTimeRange.minutes * 60;
      return apiClient.getNodeMetrics(clusterId, nodeId, { start, end: now });
    },
    enabled: !!nodeId && opened && isPrometheus,
    staleTime: 60000,
  });

  return (
    <Modal.Root opened={opened} onClose={onClose} size="90%">
      <Modal.Overlay />
      <Modal.Content
        style={{
          maxWidth: '100%',
        }}
      >
        <Modal.Header>
          <Modal.Title>
            <Group gap="xs">
              {nodeStats && (
                <MasterIndicator
                  isMaster={nodeStats.isMaster}
                  isMasterEligible={nodeStats.isMasterEligible}
                  size="lg"
                  showTooltip={true}
                />
              )}
              <Text size="lg" fw={600}>
                {nodeStats ? nodeStats.name : 'Node Details'}
              </Text>
            </Group>
          </Modal.Title>
          <Modal.CloseButton />
        </Modal.Header>
        <Modal.Body>
      {isLoading && <NodeDetailSkeleton />}

      {error && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Failed to load node statistics: {(error as Error).message}
        </Alert>
      )}

      {!isLoading && !error && nodeStats && (
        <NodeDetailContent
          nodeStats={nodeStats}
          loading={isLoading}
          isPrometheus={isPrometheus}
        />
      )}

      {!isLoading && !error && !nodeStats && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Node statistics not found
        </Alert>
      )}

      {/* Prometheus Metrics Section - Only shown when using Prometheus metrics source */}
      {isPrometheus && nodeMetrics && nodeMetrics.data.length > 0 && (
        <Stack gap="md" style={{ marginTop: 'var(--mantine-spacing-md)' }}>
          <Group justify="space-between">
            <Title order={3}>Historical Metrics (Prometheus)</Title>
            <TimeRangePicker
              selectedTimeRange={selectedTimeRange}
              onChange={(preset) => {
                setSelectedTimeRange(preset);
                setTimeRangeDropdownOpened(false);
              }}
              opened={timeRangeDropdownOpened}
              onOpenedChange={setTimeRangeDropdownOpened}
            />
          </Group>

          {/* Heap Usage Chart */}
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Heap Usage (bytes)</Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={nodeMetrics.data}>
                  <defs>
                    <linearGradient id="colorHeap" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--mantine-color-blue-6)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString()}
                    stroke="var(--mantine-color-gray-6)"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    height={40}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="var(--mantine-color-gray-6)"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    width={50}
                    tickFormatter={(v) => `${(v / 1024 / 1024).toFixed(0)}MB`}
                  />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts * 1000).toLocaleString()}
                    formatter={(value: number | undefined) => `${((value || 0) / 1024 / 1024).toFixed(1)} MB`}
                  />
                  <Area
                    type="monotone"
                    dataKey="heap_used_bytes"
                    stroke="var(--mantine-color-blue-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorHeap)"
                    name="Heap Used"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Stack>
          </Card>

          {/* CPU Usage Chart */}
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>CPU Usage (%)</Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={nodeMetrics.data}>
                  <defs>
                    <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--mantine-color-green-6)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString()}
                    stroke="var(--mantine-color-gray-6)"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    height={40}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="var(--mantine-color-gray-6)"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    width={40}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts * 1000).toLocaleString()}
                    formatter={(value: number | undefined) => `${(value || 0).toFixed(1)}%`}
                  />
                  <Area
                    type="monotone"
                    dataKey="cpu_percent"
                    stroke="var(--mantine-color-green-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorCpu)"
                    name="CPU %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Stack>
          </Card>

          {/* Disk Usage Chart */}
          <Card shadow="sm" padding="lg">
            <Stack gap="xs">
              <Text size="sm" fw={500}>Disk Usage (%)</Text>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={nodeMetrics.data}>
                  <defs>
                    <linearGradient id="colorDisk" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--mantine-color-violet-6)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--mantine-color-violet-6)" stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--mantine-color-dark-4)" opacity={0.3} />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={(ts) => new Date(ts * 1000).toLocaleTimeString()}
                    stroke="var(--mantine-color-gray-6)"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    height={40}
                    angle={-45}
                    textAnchor="end"
                  />
                  <YAxis
                    stroke="var(--mantine-color-gray-6)"
                    tick={{ fill: 'var(--mantine-color-gray-6)', fontSize: 10 }}
                    width={40}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    labelFormatter={(ts) => new Date(ts * 1000).toLocaleString()}
                    formatter={(value: number | undefined) => `${(value || 0).toFixed(1)}%`}
                  />
                  <Area
                    type="monotone"
                    dataKey="disk_used_percent"
                    stroke="var(--mantine-color-violet-6)"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorDisk)"
                    name="Disk %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </Stack>
          </Card>
        </Stack>
      )}
        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
