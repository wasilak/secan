import { memo } from 'react';
import { Group, Text, Badge } from '@mantine/core';
import { type NodeProps } from '@xyflow/react';
import type { HealthStatus } from '../types/api';
import { getHealthColor } from '../utils/colors';

/**
 * Data interface for IndexGroupNode.
 *
 * Requirements: 3.1, 3.8
 */
export interface IndexGroupNodeData extends Record<string, unknown> {
  indexName: string;
  health?: HealthStatus;
  shardCount?: number;
  primaryCount?: number;
  replicaCount?: number;
}

/**
 * IndexGroupNode — RF group-node header/background for the top-level index.
 *
 * Purely decorative — all sub-group and shard children are placed as RF
 * child nodes by the layout function.
 *
 * Requirements: 3.1, 3.8
 */
function IndexGroupNodeComponent({ data }: NodeProps & { data: IndexGroupNodeData }) {
  const { indexName, health, shardCount, primaryCount, replicaCount } = data;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '6px 10px',
        borderRadius: 'var(--mantine-radius-sm)',
        border: '1.5px solid var(--mantine-color-gray-4)',
        backgroundColor: 'var(--mantine-color-body)',
      }}
    >
      <Group gap="xs" align="center" wrap="nowrap">
        <Text fw={700} size="md" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
          {indexName}
        </Text>
        {health && (
          <Badge size="sm" color={getHealthColor(health)} variant="filled">
            {health}
          </Badge>
        )}
        {shardCount !== undefined && (
          <Badge size="sm" color="gray" variant="light">
            {shardCount} shards
          </Badge>
        )}
        {(primaryCount !== undefined || replicaCount !== undefined) && (
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>
            {primaryCount ?? 0} primaries · {replicaCount ?? 0} replicas
          </Text>
        )}
      </Group>
    </div>
  );
}

export const IndexGroupNode = memo(IndexGroupNodeComponent);
