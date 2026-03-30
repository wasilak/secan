import React, { useMemo, useState } from 'react';
import { Table, Text, Group, Badge, Anchor } from '@mantine/core';
import { useResponsivePageSize } from '../hooks/useResponsivePageSize';
import { TablePagination } from './TablePagination';
import type { ShardInfo } from '../types/api';
import { ShardTypeBadge } from './ShardTypeBadge';
import { getShardStateColor } from '../utils/colors';

export default function ShardsTable({
  shards = [],
  loading = false,
  onShardClick,
  onIndexClick,
  onNodeClick,
  nodeNameMap,
}: {
  shards?: ShardInfo[];
  loading?: boolean;
  onShardClick?: (s: ShardInfo) => void;
  onIndexClick?: (indexName: string) => void;
  onNodeClick?: (nodeId: string) => void;
  nodeNameMap?: Map<string, string>;
}) {
  const defaultPageSize = useResponsivePageSize();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(defaultPageSize);

  const totalPages = Math.ceil((shards?.length || 0) / pageSize);
  const paginated = useMemo(() => {
    return shards?.slice((currentPage - 1) * pageSize, currentPage * pageSize) ?? [];
  }, [shards, currentPage, pageSize]);

  return (
    <>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Index</Table.Th>
            <Table.Th>Shard</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>State</Table.Th>
            <Table.Th>Node</Table.Th>
            <Table.Th>Documents</Table.Th>
            <Table.Th>Size</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {paginated.map((shard, idx) => (
            <Table.Tr key={`${shard.index}-${shard.shard}-${idx}`}>
              <Table.Td>
                <Text
                  size="sm"
                  fw={500}
                  className="clickable-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    onIndexClick && onIndexClick(shard.index);
                  }}
                >
                  {shard.index}
                </Text>
              </Table.Td>
              <Table.Td>
                <Text
                  size="sm"
                  fw={500}
                  className="clickable-name"
                  onClick={(e) => {
                    e.stopPropagation();
                    onShardClick && onShardClick(shard);
                  }}
                >
                  {shard.shard}
                </Text>
              </Table.Td>
              <Table.Td>
                <ShardTypeBadge primary={shard.primary} />
              </Table.Td>
              <Table.Td>
                <Group gap="xs">
                  <Badge size="sm" color={getShardStateColor(shard.state)}>
                    {shard.state}
                  </Badge>
                </Group>
              </Table.Td>
              <Table.Td>
                {shard.node ? (
                  <Anchor
                    component="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onNodeClick && onNodeClick(shard.node!);
                    }}
                    style={{ textDecoration: 'none', cursor: 'pointer', color: 'inherit' }}
                  >
                    <Text size="sm" fw={500} className="clickable-name">
                      {nodeNameMap?.get(shard.node!) ?? shard.node}
                    </Text>
                  </Anchor>
                ) : (
                  <Text size="sm">N/A</Text>
                )}
              </Table.Td>
              <Table.Td>
                <Text size="sm">{shard.docs.toLocaleString()}</Text>
              </Table.Td>
              <Table.Td>
                <Text size="sm">{(shard.store ?? 0) >= 0 ? String(shard.store) : '0'}</Text>
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>

      {shards && shards.length > pageSize && (
        <TablePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={shards.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={() => {}}
        />
      )}
    </>
  );
}
