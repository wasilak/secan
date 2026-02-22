import { Badge, ScrollArea, Skeleton, Table, Text } from '@mantine/core';
import type { ShardInfo } from '../types/api';
import { formatBytes } from '../utils/formatters';

/**
 * ShardList component displays a table of shards allocated to a node
 *
 * Shows shard details including index name, shard number, type (primary/replica),
 * state, document count, and size
 */

interface ShardListProps {
  shards: ShardInfo[];
  loading: boolean;
}

/**
 * Get badge color based on shard state
 */
function getStateColor(state: ShardInfo['state']): string {
  switch (state) {
    case 'STARTED':
      return 'green';
    case 'INITIALIZING':
      return 'blue';
    case 'RELOCATING':
      return 'yellow';
    case 'UNASSIGNED':
      return 'red';
    default:
      return 'gray';
  }
}

export function ShardList({ shards, loading }: ShardListProps) {
  if (loading) {
    return <Skeleton height={200} />;
  }

  if (shards.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No shards allocated to this node
      </Text>
    );
  }

  return (
    <ScrollArea>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Index</Table.Th>
            <Table.Th>Shard</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>State</Table.Th>
            <Table.Th>Documents</Table.Th>
            <Table.Th>Size</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shards.map((shard, idx) => (
            <Table.Tr key={`${shard.index}-${shard.shard}-${idx}`}>
              <Table.Td>{shard.index}</Table.Td>
              <Table.Td>{shard.shard}</Table.Td>
              <Table.Td>
                <Badge color={shard.primary ? 'blue' : 'gray'} size="sm">
                  {shard.primary ? 'Primary' : 'Replica'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge color={getStateColor(shard.state)} size="sm">
                  {shard.state}
                </Badge>
              </Table.Td>
              <Table.Td>
                {shard.docs !== undefined && shard.docs !== null
                  ? shard.docs.toLocaleString()
                  : 'N/A'}
              </Table.Td>
              <Table.Td>
                {shard.store !== undefined && shard.store !== null
                  ? formatBytes(shard.store)
                  : 'N/A'}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
