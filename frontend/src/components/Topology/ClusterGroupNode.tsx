import { memo } from 'react';
import { Group, Text, Badge, Divider, Flex, Box, Tooltip } from '@mantine/core';
import { type NodeProps } from '@xyflow/react';
import type { ClusterGroupNodeDataFlat } from '../../utils/canvasLayout';
import { RoleIcons } from '../RoleIcons';
import { formatBytes } from '../../utils/formatters';

// Debug: ensure this module loads in runtime builds
// eslint-disable-next-line no-console
console.log('ClusterGroupNode module loaded');

/**
 * Data interface for ClusterGroupNode.
 *
 * getIndexHealthColor is passed in from CanvasTopologyView so shard dots use
 * exactly the same health-based colouring as NodeCard in the list view.
 */
// Minimal shallow props only
// See ClusterGroupNodeDataFlat imported from canvasLayout.ts


// ─── Main component ───────────────────────────────────────────────────────────

function ClusterGroupNodeComponent({
  data,
  selected,
}: NodeProps & { data: ClusterGroupNodeDataFlat }) {
  if (!data) {
    // Defensive: avoid throwing during render when ReactFlow passes an unexpected node
    // eslint-disable-next-line no-console
    console.error('ClusterGroupNode rendered without data prop', { selected, data });
    return (
      <div style={{ padding: 8, border: '1px dashed red', background: 'rgba(255,0,0,0.04)' }}>
        Invalid node data
      </div>
    );
  }
  const {
    id,
    name,
    version,
    roles,
    isMaster,
    isMasterEligible,
    ip,
    heapPercent,
    heapColor,
    cpuPercent,
    cpuColor,
    diskUsed,
    diskDisplay,
    load1m,
    loadColor,
    groupLabel,
    isValidDestination,
    summaryCounts,
    badges,
    dots,
    onShardClick,
    onNodeClick,
    onDestinationClick,
  } = data;

  const isClickable = !!onNodeClick || !!isValidDestination || !!onShardClick;

  return (
    <div
      style={{
        width: '100%',
        boxSizing: 'border-box',
        borderRadius: 8,
        padding: '10px 12px 8px',
        backgroundColor: selected
          ? 'var(--mantine-color-blue-light)'
          : 'var(--mantine-color-body)',
        cursor: isClickable ? 'pointer' : 'default',
      }}
       onClick={() => {
         if (isValidDestination && onDestinationClick) {
           onDestinationClick(id);
         } else if (onNodeClick) {
           onNodeClick(id);
         }
       }}
    >
      {/* ── Row 1: name + version + role icons ─────────────────────────── */}
      <Group gap="xs" wrap="nowrap" justify="space-between" mb={4}>
        <Group gap="xs" wrap="nowrap" style={{ flex: 1, minWidth: 0 }}>
          <Text fw={700} size="sm" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </Text>
          {version && (
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              v{version}
            </Text>
          )}
        </Group>
        <Group gap={4} wrap="nowrap" style={{ flexShrink: 0 }}>
          {isMaster && (
            <Badge size="xs" variant="filled" color="blue">M</Badge>
          )}
          <RoleIcons roles={roles ?? []} size={13} />
        </Group>
      </Group>

      {/* optional group label */}
      {groupLabel && (
        <Text size="xs" c="dimmed" fw={500} mb={2}>{groupLabel}</Text>
      )}

      {/* ── Row 2: IP + metrics ─────────────────────────────────────────── */}
      <Flex gap="xs" wrap="wrap" mb={6}>
        {ip && <Text size="xs" c="dimmed">IP: {ip}</Text>}
        {cpuPercent !== undefined && (
          <Text size="xs" c={cpuColor}>CPU: {cpuPercent.toFixed(1)}%</Text>
        )}
        <Text size="xs" c={heapColor}>Heap: {heapPercent.toFixed(1)}%</Text>
        <Text size="xs" c="dimmed">Disk: {diskDisplay}</Text>
        {load1m !== undefined && (
          <Text size="xs" c={loadColor}>Load: {load1m.toFixed(2)}</Text>
        )}
      </Flex>

      <Divider mb={6} />

      {/* ── Shard dots ──────────────────────────────────────────────────── */}
      {dots.length > 0 && (
        <Flex gap={3} wrap="wrap" mb={6}>
          {dots.map((dot, idx) => (
            <Tooltip
              key={idx}
              label={dot.tooltip}
              withArrow
              withinPortal
            >
              <Box
                style={{
                  width: 14,
                  height: 14,
                  backgroundColor: dot.color,
                  borderRadius: 2,
                  opacity: dot.primary ? 1 : 0.5,
                  boxShadow: dot.primary ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                  flexShrink: 0,
                }}
                onClick={(e) => {
                  if (onShardClick) {
                    e.stopPropagation();
                    onShardClick(dot.shard as any, e as any);
                  }
                }}
                onPointerDown={(e) => {
                  // Stop pointer events so ReactFlow/parent node click isn't triggered
                  e.stopPropagation();
                }}
                onMouseDown={(e) => {
                  // Also stop mouse down to be defensive across browsers and event phases
                  e.stopPropagation();
                }}
              />
            </Tooltip>
          ))}
        </Flex>
      )}

      {/* ── Shard count badges ──────────────────────────────────────────── */}
      <Group gap="xs" wrap="nowrap">
        <Badge size="xs" variant="light">{summaryCounts.total} shards</Badge>
        {summaryCounts.primary > 0 && (
          <Badge size="xs" variant="light" color="blue">{summaryCounts.primary} primary</Badge>
        )}
        {summaryCounts.replica > 0 && (
          <Badge size="xs" variant="light" color="gray">{summaryCounts.replica} replica</Badge>
        )}
      </Group>
    </div>
  );
}

function shallowArrayEqual(a?: Record<string, any>[], b?: Record<string, any>[]): boolean {
  const aa = Array.isArray(a) ? a : [];
  const bb = Array.isArray(b) ? b : [];
  if (aa === bb) return true;
  if (aa.length !== bb.length) return false;
  for (let i = 0; i < aa.length; i++) {
    const ak = Object.keys(aa[i] || {});
    const bk = Object.keys(bb[i] || {});
    if (ak.length !== bk.length) return false;
    // Compare all keys shallowly
    for (const key of ak) {
      if (aa[i][key] !== bb[i][key]) return false;
    }
  }
  return true;
}

function arePropsEqual(prev: NodeProps & { data: ClusterGroupNodeDataFlat }, next: NodeProps & { data: ClusterGroupNodeDataFlat }) {
  // Compare relevant shallow props
  const pd = prev.data;
  const nd = next.data;
  // Fast path: all primitive and string props
  const keys: (keyof ClusterGroupNodeDataFlat)[] = [
    'id','name','version','isMaster','isMasterEligible','ip','heapPercent','heapColor',
    'cpuPercent','cpuColor','diskUsed','diskDisplay','load1m','loadColor','groupLabel','isValidDestination'
  ];
  for (const key of keys) {
    if (pd[key] !== nd[key]) return false;
  }
  // Roles can be array, need shallow check (defensive if missing)
  const pRoles = Array.isArray(pd.roles) ? pd.roles : [];
  const nRoles = Array.isArray(nd.roles) ? nd.roles : [];
  if (pRoles.length !== nRoles.length || pRoles.some((r, i) => r !== nRoles[i])) return false;
  // summaryCounts is small object with numbers
  const sc = ['primary','replica','total'] as const;
  for (const key of sc) {
    if (pd.summaryCounts[key] !== nd.summaryCounts[key]) return false;
  }
  // badges and dots are shallow arrays of objects (defensive)
  if (!shallowArrayEqual(pd.badges as any, nd.badges as any)) return false;
  if (!shallowArrayEqual(pd.dots as any, nd.dots as any)) return false;
  if (pd.onNodeClick !== nd.onNodeClick) return false;
  if (pd.onDestinationClick !== nd.onDestinationClick) return false;
  if (prev.selected !== next.selected) return false;
  return true;
}

export const ClusterGroupNode = memo(ClusterGroupNodeComponent, arePropsEqual);
