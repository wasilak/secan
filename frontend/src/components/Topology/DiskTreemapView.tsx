import { ResponsiveTreeMap } from '@nivo/treemap';
import type { ComputedNodeWithoutStyles } from '@nivo/treemap';
import { Skeleton, Text, Box } from '@mantine/core';
import { getColorForIndex } from '../../utils/colors';
import { formatBytes } from '../../utils/formatters';
import type { IndexInfo, HealthStatus } from '../../types/api';

interface DiskTreemapDatum {
  id: string;
  value?: number;
  health: HealthStatus;
  shards: number;
  children?: DiskTreemapDatum[];
}

interface DiskTreemapRoot {
  id: string;
  children: DiskTreemapDatum[];
}

export interface DiskTreemapViewProps {
  indices: IndexInfo[];
  isLoading?: boolean;
  showSpecialIndices?: boolean;
  /**
   * When true, treat leading-dot system indices as distinct buckets so
   * `.my-index` maps to a different color than `my-index`.
   */
  separateSystemIndices?: boolean;
}

function DiskTreemapTooltip({
  node,
}: {
  node: ComputedNodeWithoutStyles<DiskTreemapDatum>;
}) {
  const datum = node.data as DiskTreemapDatum;
  return (
    <Box
      p={8}
      style={{
        background: 'var(--mantine-color-dark-7)',
        borderRadius: 4,
        fontSize: 12,
        color: 'var(--mantine-color-white)',
        pointerEvents: 'none',
        minWidth: 160,
      }}
    >
      <Text size="xs" fw={600} mb={4}>
        {node.id}
      </Text>
      <Text size="xs">Size: {formatBytes(node.value)}</Text>
      <Text size="xs">Shards: {datum.shards}</Text>
      <Text size="xs" style={{ textTransform: 'capitalize' }}>
        Health: {datum.health}
      </Text>
    </Box>
  );
}

export function DiskTreemapView({
  indices,
  isLoading,
  showSpecialIndices = true,
  // Default to treating system indices separately so examples like
  // `.my-index` and `my-index` map to distinct colors.
  separateSystemIndices = true,
}: DiskTreemapViewProps) {
  if (isLoading) {
    return <Skeleton height={400} radius="sm" />;
  }

  const filtered = indices
    .filter((idx) => showSpecialIndices || !idx.name.startsWith('.'))
    .filter((idx) => idx.storeSize > 0);

  if (filtered.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No disk data available
      </Text>
    );
  }

  const data: DiskTreemapRoot = {
    id: 'disk-usage',
    children: filtered.map((idx) => ({
      id: idx.name,
      value: idx.storeSize,
      health: idx.health,
      shards: idx.primaryShards + idx.replicaShards,
    })),
  };

  // Truncate index names with a middle ellipsis so we retain both the
  // meaningful prefix and suffix (dates, suffixes) which are often the
  // distinguishing parts of index names like "service-live-2026...".
  const truncateIndexLabel = (name: string, maxLen = 24) => {
    if (name.length <= maxLen) return name;
    // Reserve one char for the ellipsis
    const keepPrefix = Math.ceil((maxLen - 1) / 2);
    const keepSuffix = (maxLen - 1) - keepPrefix;
    return `${name.slice(0, keepPrefix)}…${name.slice(name.length - keepSuffix)}`;
  };

  return (
    <Box style={{ height: 400 }}>
      <ResponsiveTreeMap<DiskTreemapDatum>
        data={data as unknown as DiskTreemapDatum}
        identity="id"
        value="value"
        leavesOnly
        colors={(node: ComputedNodeWithoutStyles<DiskTreemapDatum>) =>
          // Use deterministic color per index (based on prefix/hash) for better visual grouping
          // Allow caller to choose whether system indices (leading dot) are treated separately.
          getColorForIndex(node.id, separateSystemIndices)
        }
        nodeOpacity={0.9}
        borderWidth={2}
        borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
        labelSkipSize={24}
        label={(node) =>
          // Use middle-ellipsis truncation to keep both prefix and suffix
          truncateIndexLabel(node.id, 24)
        }
        enableParentLabel={false}
        tooltip={({ node }) => <DiskTreemapTooltip node={node} />}
        animate={true}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      />
    </Box>
  );
}
