import { memo } from 'react';
import { Paper, Group, Text, Badge, Flex } from '@mantine/core';
import { type NodeProps } from '@xyflow/react';
import type { NodeInfo } from '../../types/api';
import { RoleIcons } from '../RoleIcons';
import { formatBytes } from '../../utils/formatters';

/**
 * Data interface for ClusterGroupNode.
 *
 * Requirements: 1.1, 1.7, 2.2
 */
export interface ClusterGroupNodeData extends Record<string, unknown> {
  node: NodeInfo;
  onNodeClick?: (nodeId: string) => void;
  isValidDestination?: boolean;
  onDestinationClick?: (nodeId: string) => void;
  groupLabel?: string;
}

/**
 * ClusterGroupNode — RF group-node header for one Elasticsearch cluster node.
 *
 * Renders the node's header area (name, version, roles, metrics).
 * Shards are placed as separate RF child nodes by the layout function.
 *
 * Requirements: 1.1, 1.7, 2.2
 */
function ClusterGroupNodeComponent({
  data,
  selected,
}: NodeProps & { data: ClusterGroupNodeData }) {
  const { node, onNodeClick, isValidDestination, onDestinationClick, groupLabel } = data;

  const isClickable = !!onNodeClick || !!isValidDestination;

  const heapPct =
    node.heapMax > 0 ? (node.heapUsed / node.heapMax) * 100 : 0;
  const heapColor =
    heapPct < 70 ? 'green' : heapPct < 85 ? 'yellow' : 'red';

  const cpuColor =
    node.cpuPercent === undefined
      ? 'dimmed'
      : node.cpuPercent < 70
      ? 'green'
      : node.cpuPercent < 85
      ? 'yellow'
      : 'red';

  const loadColor =
    node.loadAverage && node.loadAverage[0] !== undefined
      ? node.loadAverage[0] < 4
        ? 'green'
        : node.loadAverage[0] < 6
        ? 'yellow'
        : 'red'
      : 'dimmed';

  return (
    <Paper
      shadow="xs"
      p="xs"
      withBorder
      style={{
        width: '100%',
        borderColor: isValidDestination
          ? 'var(--mantine-color-violet-6)'
          : selected
          ? 'var(--mantine-color-blue-6)'
          : undefined,
        borderStyle: isValidDestination ? 'dashed' : undefined,
        borderWidth: isValidDestination || selected ? '2px' : undefined,
        cursor: isClickable ? 'pointer' : 'default',
        backgroundColor: 'var(--mantine-color-body)',
        boxSizing: 'border-box',
      }}
      onClick={() => {
        if (isValidDestination && onDestinationClick) {
          onDestinationClick(node.id);
        } else if (onNodeClick) {
          onNodeClick(node.id);
        }
      }}
    >
      {/* Row 1: name + version + badges */}
      <Group gap="xs" wrap="nowrap" justify="space-between" mb={2}>
        <Group gap="xs" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" lineClamp={1}>
            {node.name}
          </Text>
          {node.version && (
            <Text size="xs" c="dimmed">
              v{node.version}
            </Text>
          )}
        </Group>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {node.isMaster && (
            <Badge size="xs" variant="filled" color="blue">
              M
            </Badge>
          )}
          <RoleIcons roles={node.roles ?? []} size={13} />
        </Group>
      </Group>

      {/* Optional group label */}
      {groupLabel && (
        <Text size="xs" c="dimmed" fw={500} mb={2}>
          {groupLabel}
        </Text>
      )}

      {/* Row 2: IP + metrics */}
      <Flex gap="xs" wrap="wrap">
        {node.ip && (
          <Text size="xs" c="dimmed">
            {node.ip}
          </Text>
        )}
        {node.cpuPercent !== undefined && (
          <Text size="xs" c={cpuColor}>
            CPU {node.cpuPercent.toFixed(1)}%
          </Text>
        )}
        {node.heapMax > 0 && (
          <Text size="xs" c={heapColor}>
            Heap {heapPct.toFixed(1)}%
          </Text>
        )}
        {node.diskUsed > 0 && (
          <Text size="xs" c="dimmed">
            {formatBytes(node.diskUsed)}
          </Text>
        )}
        {node.loadAverage && node.loadAverage[0] !== undefined && (
          <Text size="xs" c={loadColor}>
            {node.loadAverage[0].toFixed(2)}
          </Text>
        )}
      </Flex>
    </Paper>
  );
}

export const ClusterGroupNode = memo(ClusterGroupNodeComponent);
