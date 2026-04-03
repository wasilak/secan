import { ResponsiveTreeMap } from '@nivo/treemap';
import type { ComputedNodeWithoutStyles } from '@nivo/treemap';
import { Skeleton, Text, Box } from '@mantine/core';
import { getHealthColorValue } from '../../utils/colors';
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

export function DiskTreemapView({ indices, isLoading, showSpecialIndices = true }: DiskTreemapViewProps) {
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

  return (
    <Box style={{ height: 400 }}>
      <ResponsiveTreeMap<DiskTreemapDatum>
        data={data as unknown as DiskTreemapDatum}
        identity="id"
        value="value"
        leavesOnly
        colors={(node: ComputedNodeWithoutStyles<DiskTreemapDatum>) =>
          getHealthColorValue((node.data as DiskTreemapDatum).health)
        }
        nodeOpacity={0.9}
        borderWidth={2}
        borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
        labelSkipSize={24}
        label={(node) => node.id}
        enableParentLabel={false}
        tooltip={({ node }) => <DiskTreemapTooltip node={node} />}
        animate={false}
        margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
      />
    </Box>
  );
}
