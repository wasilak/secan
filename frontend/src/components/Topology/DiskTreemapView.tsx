import { TreeMap } from '@nivo/treemap';
import React from 'react';
import type { ComputedNodeWithoutStyles } from '@nivo/treemap';
import { Skeleton, Text, Box } from '@mantine/core';
import { getColorForIndex } from '../../utils/colors';
import { formatBytes } from '../../utils/formatters';
import type { IndexInfo, HealthStatus } from '../../types/api';
import { useMeasuredSize } from '../../hooks/useMeasuredSize';

// Internal sentinel constants used to mark synthetic group/root nodes in
// the treemap data structure. These are module-level so both the tooltip
// and rendering logic can reference them.
const GROUP_PREFIX = '__group__:';
const ROOT_ID = '__secan_disk_usage_root__';

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
  /** Optional index name filter (wildcard pattern) from the left sidebar */
  indexNameFilter?: string;
  /** Wildcard matcher used by the topology view so treemap uses same matching rules */
  matchesWildcard?: (text: string, pattern: string) => boolean;
  /** Optional callback to open index details modal when a leaf is clicked */
  openIndexModal?: (indexName: string) => void;
}

  function DiskTreemapTooltip({ node }: { node: ComputedNodeWithoutStyles<DiskTreemapDatum> }) {
    const datum = node.data as any;
    const computed: any = node as any;
    // Determine whether this computed node represents a real index (leaf)
    // by checking for index-specific fields that we populate for leaves.
    const isIndexLeaf = typeof datum?.shards === 'number' || typeof datum?.health === 'string';

    const cleanId = (id: string) => {
      if (!id) return id;
      if (id === ROOT_ID) return '';
      return id.startsWith(GROUP_PREFIX) ? id.slice(GROUP_PREFIX.length) : id;
    };

    const cleaned = cleanId(String(node.id));
    // Do not show a tooltip for the synthetic root node — return null to
    // avoid showing an empty/placeholder tooltip labeled "Disk Usage".
    if (!cleaned) return null;

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
          {cleanId(String(node.id)) || 'Disk Usage'}
        </Text>
        <Text size="xs">Size: {formatBytes(node.value)}</Text>
        {isIndexLeaf ? (
          // Leaf/index node: show index-specific fields
          <>
            <Text size="xs">Shards: {datum.shards}</Text>
            <Text size="xs" style={{ textTransform: 'capitalize' }}>
              Health: {datum.health}
            </Text>
          </>
        ) : (
          // Parent/group node: show aggregate info instead of per-index fields
          <>
            <Text size="xs">Group members: {(computed.children || []).length}</Text>
          </>
        )}
      </Box>
    );
  }

  // Custom node renderer: we intentionally skip rendering the top-level
  // root node so the treemap does not show a large 'Disk Usage' band.
  // For all other nodes we render a simple rectangle and centered label.
  const CustomNode: any = ({ node, borderWidth, enableLabel, labelSkipSize, enableParentLabel, parentLabelSize }: any) => {
    const n: any = node as any;
    // Skip the root node (treeDepth === 0)
    if (n.treeDepth === 0) return null;

    const x = n.x || 0;
    const y = n.y || 0;
    const width = n.width || 0;
    const height = n.height || 0;
    const color = n.color || 'var(--mantine-color-gray-3)';
    const borderColor = n.borderColor || 'black';

    const showLabel = enableLabel && width > labelSkipSize && height > labelSkipSize;

    return (
      <g
        transform={`translate(${x},${y})`}
        onClick={n.onClick}
        onMouseEnter={n.onMouseEnter}
        onMouseMove={n.onMouseMove}
        onMouseLeave={n.onMouseLeave}
        style={{ cursor: n.onClick ? 'pointer' : 'default', pointerEvents: 'all' }}
      >
        <rect x={0} y={0} width={width} height={height} fill={color} stroke={borderColor} strokeWidth={borderWidth || 1} />
        {showLabel && (
          <text x={width / 2} y={height / 2} dominantBaseline="middle" textAnchor="middle" style={{ pointerEvents: 'none', fontSize: 12, fill: n.labelTextColor || '#000' }}>
            {String(n.label)}
          </text>
        )}
        {enableParentLabel && n.parentLabel && (
          <text x={4} y={parentLabelSize || 12} dominantBaseline="hanging" style={{ pointerEvents: 'none', fontSize: parentLabelSize || 12, fill: n.parentLabelTextColor || '#000' }}>
            {String(n.parentLabel)}
          </text>
        )}
      </g>
    );
  };

export function DiskTreemapView({
  indices,
  isLoading,
  showSpecialIndices = true,
  // Default to treating system indices separately so examples like
  // `.my-index` and `my-index` map to distinct colors.
  separateSystemIndices = true,
  indexNameFilter,
  matchesWildcard,
  openIndexModal,
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
    // Apply index name filter from the left sidebar when present
    .filter((idx) => {
      if (!indexNameFilter) return true;
      if (matchesWildcard) return matchesWildcard(idx.name, indexNameFilter);
      // Fallback to simple includes (case-insensitive)
      return idx.name.toLowerCase().includes(indexNameFilter.toLowerCase());
    })
    .filter((idx) => idx.storeSize > 0);

  // Build a fast lookup of real index names so clicks on synthetic group
  // nodes (which we prefix with '__group__:') cannot accidentally open
  // the index modal. Only exact matches to real index names will open.
  const realIndexNames = new Set(filtered.map((i) => i.name));

  if (filtered.length === 0) {
    return (
      <Text c="dimmed" ta="center" py="xl">
        No disk data available
      </Text>
    );
  }

  // Group indices by a logical prefix so related time-series indices
  // (e.g. top_queries-2026.04.05-55107) are visually grouped together.
  // Grouping key logic mirrors the color-bucketing rules: strip
  // trailing numeric/date/timestamp-like suffixes and optionally
  // preserve the leading dot for system indices.
  const groups = new Map<string, DiskTreemapDatum[]>();
  // Use the same grouping key as the color util so grouping and colors match
  const { getIndexGroupingKey } = require('../../utils/colors');
  for (const idx of filtered) {
    const groupKey = getIndexGroupingKey(idx.name, separateSystemIndices);

    const leaf: DiskTreemapDatum = {
      id: idx.name,
      value: idx.storeSize,
      health: idx.health,
      shards: idx.primaryShards + idx.replicaShards,
    };

    const arr = groups.get(groupKey) ?? [];
    arr.push(leaf);
    groups.set(groupKey, arr);
  }

  // Always create an explicit parent node for each group so grouping is
  // visually explicit and parent labels can be rendered consistently.
  // Prefix group ids to avoid colliding with real index names. This makes
  // it impossible for a parent/group id to equal a real index name and
  // thus prevents accidental modal opens when users click a group. We
  // render a cleaned label below so the UI shows the human-friendly key.
  const GROUP_PREFIX = '__group__:';
  const ROOT_ID = '__secan_disk_usage_root__';
  const children = Array.from(groups.entries()).map(([groupId, leaves]) => ({
    id: `${GROUP_PREFIX}${groupId}`,
    // keep the actual leaves as children
    children: leaves,
  } as DiskTreemapDatum));

  // Use a root id that cannot collide with real index/group ids to avoid
  // accidental treating of the root as an actual index/group. Using a
  // sentinel reduces the chance of duplicate ids appearing in the tree.
  const data: DiskTreemapRoot = {
    id: '__secan_disk_usage_root__',
    children,
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
          // Render parent nodes so groups are visible and labeled.
          // Previously we only rendered leaves which hid grouping.
          leavesOnly={false}
          // Use squarify tiling for more balanced parent layouts (matches Nivo example)
          tile="squarify"
          colors={(node: ComputedNodeWithoutStyles<DiskTreemapDatum>) => {
            // For parent/group nodes we stored the id with a GROUP_PREFIX.
            // Strip that prefix when determining the color so groups and their
            // child indices share the same bucket.
            const id = node.id as string;
            const key = id.startsWith(GROUP_PREFIX) ? id.slice(GROUP_PREFIX.length) : id;
            return getColorForIndex(key, separateSystemIndices);
          }}
          nodeOpacity={0.9}
          borderWidth={2}
          borderColor={{ from: 'color', modifiers: [['darker', 0.3]] }}
           // Use a custom label accessor so group ids (which are prefixed
           // to avoid collisions) are shown without the internal prefix.
           // Also hide the root sentinel id so it is never displayed to users.
           label={(d: any) => {
             const id = String(d.id || '');
             if (id === ROOT_ID) return '';
             return id.startsWith(GROUP_PREFIX) ? id.slice(GROUP_PREFIX.length) : id;
           }}
           // Parent label accessor: hide the root as a parent label and
           // strip GROUP_PREFIX for displayed parent labels.
           parentLabel={(d: any) => {
             const path: string[] = d.pathComponents || [];
             if (path.length < 2) return '';
             const parentId = path[path.length - 2];
             if (parentId === ROOT_ID) return '';
             return parentId.startsWith(GROUP_PREFIX) ? parentId.slice(GROUP_PREFIX.length) : parentId;
           }}
          labelTextColor={{ from: 'color', modifiers: [['darker', 1.2]] }}
          // Nivo renders labels as SVG <text> elements which do not support
          // CSS text-overflow. However, setting labelSkipSize avoids rendering
          // labels on tiny tiles where text would overflow. For larger tiles the
          // SVG text will be clipped by the tile boundary so long overflowing
          // text does not visually exceed the tile. This keeps the view tidy.
          labelSkipSize={24}
          // Show parent labels and position them on the left to match the
          // expected visual grouping. Parent labels use the group's id.
          enableParentLabel={true}
          parentLabelPosition="left"
          parentLabelPadding={8}
          parentLabelSize={12}
          parentLabelTextColor={{ from: 'color', modifiers: [['darker', 2]] }}
          tooltip={({ node }) => <DiskTreemapTooltip node={node} />}
          nodeComponent={CustomNode}
          onClick={(node) => {
            // Only open modal for true leaf nodes. ComputedNode exposes
            // isLeaf/isParent flags which are reliable indicators of node
            // type. Use them directly rather than inspecting aggregated
            // datum fields (which can be present for parent nodes).
            try {
              if (!openIndexModal) return;
              const computed: any = node as any;
              // Use treeHeight===0 to reliably detect leaves (nodes with no
              // children). Additionally require the datum to contain index
              // specific fields (shards/health) to ensure this is a real
              // index and not a synthetic group node. This double-check
              // prevents any accidental modal opens for non-index groups.
              const isLeaf = Number(computed.treeHeight) === 0;
              const data = node.data as DiskTreemapDatum | undefined;
              // Only open modal when the clicked id is a real index name.
              if (!data) return;
              if (!isLeaf) return;
              if (!realIndexNames.has(data.id)) return;
              openIndexModal(data.id);
            } catch (e) {
              // swallow errors
            }
          }}
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
