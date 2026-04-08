import { TreeMap } from '@nivo/treemap';
import React from 'react';
import type { ComputedNodeWithoutStyles } from '@nivo/treemap';
import { Skeleton, Text, Box } from '@mantine/core';
import { getColorForIndex } from '../../utils/colors';
import { formatBytes } from '../../utils/formatters';
import type { IndexInfo, HealthStatus } from '../../types/api';
import { useMeasuredSize } from '../../hooks/useMeasuredSize';

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
  // Measure available space and pass explicit width/height to the non-responsive TreeMap
  const { containerRef, size, measure } = useMeasuredSize({ bottomMargin: 48, minHeight: 240, debounceMs: 120 });

  // Trigger measurement when the indices data changes (or loading flips).
  // If the first measurement yields zero size (layout not settled) schedule a
  // single short retry to capture any late layout changes (e.g. sidebar toggle).
  React.useEffect(() => {
    if (!containerRef || !containerRef.current) {
      // still mounting — rely on the hook's initial rAF measurement
      return;
    }
    measure();
    let retry: number | null = null;
    if (size.width === 0 || size.height === 0) {
      retry = window.setTimeout(() => {
        measure();
      }, 160) as unknown as number;
    }
    return () => {
      if (retry) window.clearTimeout(retry);
    };
  }, [indices, isLoading, measure, containerRef, size]);

  if (isLoading) {
    return (
      <div style={{ flex: 1, minHeight: 400, overflow: 'hidden' }}>
        <Skeleton height="100%" radius="sm" />
      </div>
    );
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
    <Box ref={containerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
      {/* Ensure we measure when data arrives so the treemap doesn't stay in skeleton
          when layout settles after async data or UI toggles. Retry once after a
          short delay to catch late layout changes. */}
      {/** measure-on-data-arrival effect */}
      {(() => {
        // Render-time hook shim: useEffect cannot be conditionally called, so
        // we rely on the top-level component effect below. This IIFE returns
        // null to avoid affecting the DOM.
        return null;
      })()}

      {size.width > 0 && size.height > 0 ? (
        <TreeMap<DiskTreemapDatum>
          width={size.width}
          height={size.height}
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
          // Use built-in labels and skip rendering for small tiles
          label="id"
          // Nivo renders labels as SVG <text> elements which do not support
          // CSS text-overflow. However, setting labelSkipSize avoids rendering
          // labels on tiny tiles where text would overflow. For larger tiles the
          // SVG text will be clipped by the tile boundary so long overflowing
          // text does not visually exceed the tile. This keeps the view tidy.
          labelSkipSize={24}
          enableParentLabel={false}
          tooltip={({ node }) => <DiskTreemapTooltip node={node} />}
          animate={true}
          margin={{ top: 4, right: 4, bottom: 4, left: 4 }}
        />
      ) : (
        <div style={{ height: '100%', minHeight: 200 }}>
          <Skeleton height="100%" radius="sm" />
        </div>
      )}
    </Box>
  );
}
