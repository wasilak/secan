import { memo } from 'react';
import { Paper, Group, Text, Badge, Flex, Box, Tooltip } from '@mantine/core';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { NodeInfo, ShardInfo } from '../../types/api';
import { RoleIcons } from '../RoleIcons';
import { formatBytes } from '../../utils/formatters';

export interface CanvasNodeData extends Record<string, unknown> {
  node: NodeInfo;
  shards: ShardInfo[];
  onNodeClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
  isValidDestination?: boolean;
  onDestinationClick?: (nodeId: string) => void;
  getIndexHealthColor: (indexName: string) => string;
  groupLabel?: string;
}

function CanvasNodeCardComponent({
  data,
  selected,
}: NodeProps & { data: CanvasNodeData }) {
  const { node, shards, onNodeClick, onShardClick, isValidDestination, onDestinationClick, getIndexHealthColor, groupLabel } = data;

  const isClickable = !!onNodeClick || isValidDestination;

  const primaryCount = shards.filter(s => s.primary).length;
  const replicaCount = shards.filter(s => !s.primary).length;

  return (
    <>
      <Paper
        shadow="xs"
        p="md"
        withBorder
        style={{
          width: 280,
          borderColor: isValidDestination
            ? 'var(--mantine-color-violet-6)'
            : selected
            ? 'var(--mantine-color-blue-6)'
            : undefined,
          borderStyle: isValidDestination
            ? 'dashed'
            : undefined,
          borderWidth: isValidDestination || selected
            ? '2px'
            : undefined,
          cursor: isClickable
            ? 'pointer'
            : 'default',
          backgroundColor: 'var(--mantine-color-body)',
          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
        }}
        onClick={() => {
          if (isValidDestination && onDestinationClick) {
            onDestinationClick(node.id);
          } else if (onNodeClick) {
            onNodeClick(node.id);
          }
        }}
        onMouseEnter={(e) => {
          if (isClickable) {
            e.currentTarget.style.transform = 'translateY(-2px)';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
          }
        }}
        onMouseLeave={(e) => {
          if (isClickable) {
            e.currentTarget.style.transform = 'translateY(0)';
            e.currentTarget.style.boxShadow = '';
          }
        }}
      >
        <Group gap="xs" wrap="nowrap" mb="xs" justify="space-between">
          <Group gap="xs" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="sm" lineClamp={1}>
              {node.name}
            </Text>
            {node?.version && (
              <Text size="xs" c="dimmed">
                v{node.version}
              </Text>
            )}
          </Group>
          <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
            {node?.isMaster && (
              <Badge size="xs" variant="filled" color="blue">
                M
              </Badge>
            )}
            {node && <RoleIcons roles={node.roles || []} size={14} />}
          </Group>
        </Group>
        {groupLabel && (
          <Text size="xs" c="dimmed" fw={500} mb="xs">
            {groupLabel}
          </Text>
        )}

        <Flex gap="xs" mb="xs" wrap="wrap">
          {node?.ip && (
            <Text size="xs" c="dimmed">
              {node.ip}
            </Text>
          )}
          {node?.cpuPercent !== undefined && (
            <Text
              size="xs"
              c={node.cpuPercent < 70 ? 'green' : node.cpuPercent < 85 ? 'yellow' : 'red'}
            >
              CPU: {node.cpuPercent.toFixed(1)}%
            </Text>
          )}
          {node?.heapUsed && node?.heapMax && (
            <Text
              size="xs"
              c={
                (node.heapUsed / node.heapMax) < 0.7
                  ? 'green'
                  : (node.heapUsed / node.heapMax) < 0.85
                  ? 'yellow'
                  : 'red'
              }
            >
              Heap: {((node.heapUsed / node.heapMax) * 100).toFixed(1)}%
            </Text>
          )}
          {node?.diskUsed && (
            <Text size="xs" c="dimmed">
              {formatBytes(node.diskUsed)}
            </Text>
          )}
          {node?.loadAverage && node.loadAverage.length > 0 && (
            <Text
              size="xs"
              c={node.loadAverage[0] < 4 ? 'green' : node.loadAverage[0] < 6 ? 'yellow' : 'red'}
            >
              {node.loadAverage[0].toFixed(2)}
            </Text>
          )}
        </Flex>

        <Box
          style={{
            borderTop: '1px solid var(--mantine-color-gray-3)',
            paddingTop: '8px',
          }}
        >
          <Flex gap={3} wrap="wrap">
            {shards.map((shard, idx) => {
              const indexColor = getIndexHealthColor(shard.index);
              const isPrimary = shard.primary;

              return (
                <Tooltip
                  key={`${shard.index}-${shard.shard}-${shard.node}-${idx}`}
                  label={`${shard.index} - ${shard.shard}${isPrimary ? ' (P)' : ' (R)'} - ${shard.state}`}
                  withArrow
                >
                  <Box
                    style={{
                      width: 14,
                      height: 14,
                      backgroundColor: indexColor,
                      borderRadius: 2,
                      cursor: onShardClick ? 'pointer' : 'default',
                      opacity: isPrimary ? 1 : 0.5,
                      boxShadow: isPrimary ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                    }}
                    onClick={(e) => {
                      if (onShardClick) {
                        e.stopPropagation();
                        onShardClick(shard, e);
                      }
                    }}
                  />
                </Tooltip>
              );
            })}
          </Flex>

          <Group gap="xs" mt="xs" wrap="nowrap">
            <Badge size="xs" variant="light">
              {shards.length} shards
            </Badge>
            {primaryCount > 0 && (
              <Badge size="xs" variant="light" color="blue">
                {primaryCount}P
              </Badge>
            )}
            {replicaCount > 0 && (
              <Badge size="xs" variant="light" color="gray">
                {replicaCount}R
              </Badge>
            )}
          </Group>
        </Box>
      </Paper>
    </>
  );
}

export const CanvasNodeCard = memo(CanvasNodeCardComponent);
