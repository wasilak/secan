import { Modal, Group, Text, Alert, Stack } from '@mantine/core';
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
import React from 'react';

/**
 * Color utilities for shard display consistency (Requirements 7.1, 7.2, 7.3, 7.4, 7.5, 9.4)
 * 
 * Note: These utilities are imported to ensure they're available if/when individual shards
 * are displayed in the NodeModal. Currently, the modal only shows shard statistics and counts.
 * 
 * When shards are rendered:
 * - Use getShardBorderColor() for consistent border colors across all views
 * - Use getUnassignedShardColor() for differentiated unassigned shard colors
 * - Use sortShards() for deterministic shard ordering
 * 
 * These imports ensure color consistency with topology views and other components.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { getShardBorderColor, getUnassignedShardColor } from '../utils/colors';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { sortShards } from '../utils/shardOrdering';

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
 * Color Consistency (Requirements 7.1, 7.2, 7.3, 7.4, 7.5):
 * - Imports shared color utilities (getShardBorderColor, getUnassignedShardColor)
 * - Imports shard ordering utility (sortShards)
 * - These utilities ensure consistent shard display if/when individual shards are rendered
 * - Currently, the modal displays shard statistics and counts, not individual shard cells
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

  // Extract Prometheus queries from metrics response
  const prometheusQueries = nodeMetrics?.prometheus_queries;
  
  // Prepare Prometheus metrics data for charts - memoized to trigger re-renders
  const prometheusMetricsData = React.useMemo(() => {
    if (!isPrometheus || !nodeMetrics) return undefined;
    return {
      heapHistory: nodeMetrics.data.map(d => ({
        timestamp: d.timestamp,
        value: d.heap_used_bytes || 0,
      })),
      cpuHistory: nodeMetrics.data.map(d => ({
        timestamp: d.timestamp,
        value: d.cpu_percent || 0,
      })),
      diskHistory: nodeMetrics.data.map(d => ({
        timestamp: d.timestamp,
        value: d.disk_used_percent || 0,
      })),
      loadHistory: nodeMetrics.data.map(d => ({
        timestamp: d.timestamp,
        value: d.load_average_1m || 0,
      })),
      load5History: nodeMetrics.data.map(d => ({
        timestamp: d.timestamp,
        value: d.load_average_5m || 0,
      })),
      load15History: nodeMetrics.data.map(d => ({
        timestamp: d.timestamp,
        value: d.load_average_15m || 0,
      })),
    };
  }, [nodeMetrics, isPrometheus]);

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
          prometheusQueries={prometheusQueries}
          prometheusMetrics={prometheusMetricsData}
          selectedTimeRange={selectedTimeRange}
          onTimeRangeChange={setSelectedTimeRange}
          timeRangeDropdownOpened={timeRangeDropdownOpened}
          onTimeRangeDropdownChange={setTimeRangeDropdownOpened}
        />
      )}

      {!isLoading && !error && !nodeStats && (
        <Alert icon={<IconAlertCircle size={16} />} title="Error" color="red">
          Node statistics not found
        </Alert>
      )}


        </Modal.Body>
      </Modal.Content>
    </Modal.Root>
  );
}
