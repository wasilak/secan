import { Badge } from '@mantine/core';

/**
 * ShardTypeBadge component displays a badge indicating whether a shard is primary or replica
 * 
 * Requirements: 11.4
 */
interface ShardTypeBadgeProps {
  /** Whether the shard is primary (true) or replica (false) */
  primary: boolean;
}

export function ShardTypeBadge({ primary }: ShardTypeBadgeProps) {
  return (
    <Badge 
      size="xs" 
      variant="light"
      color={primary ? 'blue' : 'gray'}
    >
      {primary ? 'P' : 'R'}
    </Badge>
  );
}
