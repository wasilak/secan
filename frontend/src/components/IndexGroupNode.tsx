import { memo } from 'react';
import { Group, Text, Badge } from '@mantine/core';
import ShardPills from './ShardPills';
export type { IndexGroupNodeData } from './IndexGroupNode';
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
    <div style={{ width: '100%', boxSizing: 'border-box', padding: '6px 10px', backgroundColor: 'transparent', border: 'none' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Text fw={700} size="md" lineClamp={1} style={{ flex: 1, minWidth: 0 }}>
            {indexName}
          </Text>
          {health && (
            <Badge size="sm" color={getHealthColor(health)} variant="filled">
              {health}
            </Badge>
          )}
        </div>

        {shardCount !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-start' }}>
            <ShardPills total={shardCount as number} primary={primaryCount as number | undefined} replica={replicaCount as number | undefined} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

export const IndexGroupNode = memo(IndexGroupNodeComponent);
