import { Paper, Group, Text, Badge, Divider, Flex, Box, Tooltip, Skeleton, Grid, Wrap } from '@mantine/core';
import { NodeInfo, ShardInfo } from '../../types/api';
import { RoleIcons } from '../RoleIcons';
import { formatBytes } from '../../utils/formatters';

/**
 * NodeCard Component for Dot-Based Topology View
 *
 * Displays a node with its shard dots and enhanced metrics.
 */
export function NodeCard({
  node,
  shards,
  onNodeClick,
  onShardClick,
  _relocationMode,
  isValidDestination,
  onDestinationClick,
  getIndexHealthColor,
  isLoading,
}: {
  node: NodeInfo;
  shards: ShardInfo[];
  onNodeClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
  _relocationMode?: boolean;
  isValidDestination?: boolean;
  onDestinationClick?: (nodeId: string) => void;
  getIndexHealthColor: (indexName: string) => string;
  isLoading?: boolean;
}) {
  // Node card is clickable if onNodeClick is provided OR if it's a valid destination
  const isClickable = !!onNodeClick || isValidDestination;

  // Calculate shard counts
  const primaryCount = shards.filter(s => s.primary).length;
  const replicaCount = shards.filter(s => !s.primary).length;

  return (
    <Grid.Col span={{ base: 12, sm: 6, lg: 4, xl: 3 }} key={node.name}>
      <Paper
        shadow="xs"
        p="md"
        withBorder
        style={{
          borderColor: isValidDestination
            ? 'var(--mantine-color-violet-6)'
            : undefined,
          borderStyle: isValidDestination
            ? 'dashed'
            : undefined,
          borderWidth: isValidDestination
            ? '2px'
            : undefined,
          cursor: isClickable
            ? 'pointer'
            : 'default',
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
        {/* Upper Part: Node Information */}
        <Group gap="xs" wrap="nowrap" mb="xs" justify="space-between">
          <Group gap="xs" wrap="wrap" style={{ flex: 1, minWidth: 0 }}>
            <Text fw={600} size="sm">
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
                Master
              </Badge>
            )}
            {node && <RoleIcons roles={node.roles || []} size={14} />}
          </Group>
        </Group>

        {/* IP and Stats - single row with wrapping */}
        <Wrap gap="xs" mb="xs">
          {node?.ip && (
            <Text size="xs" c="dimmed">
              IP: {node.ip}
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
              Disk: {formatBytes(node.diskUsed)}
            </Text>
          )}
          {node?.loadAverage && node.loadAverage.length > 0 && (
            <Text 
              size="xs" 
              c={node.loadAverage[0] < 4 ? 'green' : node.loadAverage[0] < 6 ? 'yellow' : 'red'}
            >
              Load: {node.loadAverage[0].toFixed(2)}
            </Text>
          )}
        </Wrap>

        <Divider mb="xs" />

        {/* Loading State */}
        {isLoading && (
          <Box py="md">
            <Skeleton height={20} radius="sm" mb="xs" />
            <Skeleton height={20} radius="sm" mb="xs" />
            <Skeleton height={20} radius="sm" />
          </Box>
        )}

        {/* Shards Grid */}
        {!isLoading && shards.length > 0 && (
          <Flex gap={3} wrap="wrap">
            {shards.map((shard, idx) => {
              const indexColor = getIndexHealthColor(shard.index);
              const isPrimary = shard.primary;

              return (
                <Tooltip
                  key={`${shard.index}-${shard.shard}-${shard.node}-${idx}`}
                  label={`${shard.index} - Shard ${shard.shard}${isPrimary ? ' (Primary)' : ' (Replica)'} - ${shard.state}`}
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
        )}

        {/* Shard Count Badges */}
        <Group gap="xs" mt="xs" wrap="nowrap">
          <Badge size="xs" variant="light">
            {isLoading ? '...' : shards.length} shards
          </Badge>
          {primaryCount > 0 && (
            <Badge size="xs" variant="light" color="blue">
              {primaryCount} primary
            </Badge>
          )}
          {replicaCount > 0 && (
            <Badge size="xs" variant="light" color="gray">
              {replicaCount} replica
            </Badge>
          )}
        </Group>
      </Paper>
    </Grid.Col>
  );
}
