import { Group, Box, Text } from '@mantine/core';
import { Sparkline } from './Sparkline';
import type { DataPoint } from '../hooks/useSparklineData';

/**
 * Historical metrics data for a cluster
 */
export interface ClusterMetricsHistory {
  nodes: DataPoint[];
  indices: DataPoint[];
  documents: DataPoint[];
  shards: DataPoint[];
  unassigned: DataPoint[];
}

/**
 * Props for ClusterSparklines component
 */
export interface ClusterSparklinesProps {
  /** Historical metrics data */
  history: ClusterMetricsHistory;
  /** Current values for display */
  current: {
    nodes: number;
    indices: number;
    documents: number;
    shards: number;
    unassigned: number;
  };
}

/**
 * Get color for metric type
 */
function getMetricColor(metric: string): string {
  const colors: Record<string, string> = {
    nodes: 'var(--mantine-color-blue-6)',
    indices: 'var(--mantine-color-green-6)',
    documents: 'var(--mantine-color-cyan-6)',
    shards: 'var(--mantine-color-violet-6)',
    unassigned: 'var(--mantine-color-red-6)',
  };
  return colors[metric] || 'var(--mantine-color-gray-6)';
}

/**
 * Format large numbers for display
 */
function formatValue(value: number, type: string): string {
  if (type === 'documents') {
    if (value >= 1000000) {
      return `${(value / 1000000).toFixed(1)}M`;
    }
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
  }
  return value.toString();
}

/**
 * ClusterSparklines component displays multiple sparkline charts
 * showing historical trends for cluster metrics
 *
 * Features:
 * - Shows trends for nodes, indices, documents, shards, and unassigned shards
 * - Color-coded sparklines matching metric types
 * - Compact display suitable for table cells
 * - Current values displayed alongside sparklines
 *
 * Requirements: Dashboard enhancement
 */
export function ClusterSparklines({ history, current }: ClusterSparklinesProps) {
  const metrics = [
    { key: 'nodes', label: 'Nodes', data: history.nodes, value: current.nodes },
    { key: 'indices', label: 'Indices', data: history.indices, value: current.indices },
    { key: 'documents', label: 'Documents', data: history.documents, value: current.documents },
    { key: 'shards', label: 'Shards', data: history.shards, value: current.shards },
    { key: 'unassigned', label: 'Unassigned', data: history.unassigned, value: current.unassigned },
  ];

  return (
    <Group gap="md" wrap="nowrap" style={{ overflowX: 'auto' }}>
      {metrics.map(({ key, label, data, value }) => {
        const color = getMetricColor(key);
        const values = data.map((d) => d.value);

        const displayValue = formatValue(value, key);

        return (
          <Box
            key={key}
            style={{
              flex: '0 0 auto',
              minWidth: '80px',
              maxWidth: '120px',
            }}
          >
            <Group justify="space-between" gap="xs" mb={4}>
              <Text size="xs" c="dimmed">
                {label}
              </Text>
              <Text size="xs" c={key === 'unassigned' && value > 0 ? 'red' : 'dimmed'}>
                {displayValue}
              </Text>
            </Group>
            <Sparkline
              data={values}
              color={color}
              height={30}
            />
          </Box>
        );
      })}
    </Group>
  );
}

export default ClusterSparklines;
