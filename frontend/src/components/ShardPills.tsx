import React from 'react';
import { Group, Badge } from '@mantine/core';

interface ShardPillsProps {
  total: number;
  primary?: number;
  replica?: number;
  size?: 'xs' | 'sm';
}

export function ShardPills({ total, primary, replica, size = 'xs' }: ShardPillsProps) {
  return (
    <Group gap="xs" wrap="nowrap" style={{ flexShrink: 0 }}>
      <Badge className="secan-shard-dot" size={size} variant="light" color="violet" style={{ textTransform: 'none' }}>
        {total} shards
      </Badge>
      {primary !== undefined && primary > 0 && (
        <Badge className="secan-shard-dot" size={size} variant="light" color="blue" style={{ textTransform: 'none' }}>
          {primary} primary
        </Badge>
      )}
      {replica !== undefined && replica > 0 && (
        <Badge className="secan-shard-dot" size={size} variant="light" color="gray" style={{ textTransform: 'none' }}>
          {replica} replica
        </Badge>
      )}
    </Group>
  );
}

export default ShardPills;
