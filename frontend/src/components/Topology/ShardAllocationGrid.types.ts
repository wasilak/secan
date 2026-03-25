import type { NodeInfo, ShardInfo } from '../../types/api';

export interface ShardAllocationGridProps {
  nodes: NodeInfo[];
  shards: ShardInfo[];
  indices: { name: string }[];
  loading: boolean;
  error: unknown;
  openIndexModal: (indexName: string) => void;
  openNodeModal: (nodeId: string) => void;
  searchParams: URLSearchParams;
  setSearchParams: (params: URLSearchParams, options?: { replace?: boolean }) => void;
  sharedRelocationMode: boolean;
  sharedValidDestinationNodes: string[];
  onSharedRelocationCancel: () => void;
  onSharedSelectForRelocation: (shard: ShardInfo) => void;
  onSharedDestinationClick?: (nodeId: string) => void;
  indexNameFilter: string;
  nodeNameFilter: string;
  matchesWildcard: (text: string, pattern: string) => boolean;
  onShardClick?: (shard: ShardInfo, event: React.MouseEvent) => void;
}
