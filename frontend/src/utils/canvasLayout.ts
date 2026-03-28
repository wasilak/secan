/**
 * Canvas topology layout engine.
 *
 * Pure function — no React imports, no side effects.
 * Converts NodeInfo[] + shardsByNode + GroupingConfig into a flat RF Node[]
 * of group nodes only (type 'clusterGroup').  Shards are rendered as JSX
 * inside ClusterGroupNode so the group height is content-driven — no fixed
 * height constant, no shard child nodes.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.6, 1.9, 2.1
 */

import type { Node } from '@xyflow/react';
import type { NodeInfo, ShardInfo } from '../types/api';
import type { GroupingConfig } from './topologyGrouping';
import { calculateNodeGroups, getGroupLabel } from './topologyGrouping';
import { sortShards } from './shardOrdering';
// Minimal data for ClusterGroupNode — flat, shallow props only for top performance
export interface ClusterGroupNodeDataFlat {
  id: string;
  name: string;
  version?: string;
  roles: string[];
  isMaster: boolean;
  isMasterEligible: boolean;
  ip?: string;

  heapPercent: number;
  heapColor: string;
  cpuPercent?: number;
  cpuColor: string;
  diskUsed: number;
  diskDisplay: string;
  load1m?: number;
  loadColor: string;

  groupLabel?: string;
  isValidDestination: boolean;

  summaryCounts: {
    primary: number;
    replica: number;
    total: number;
  };
  badges: Array<{ label: string; color?: string }>;
  dots: Array<{
    color: string;
    tooltip: string;
    primary: boolean;
    // Include shard info so node renderer can emit shard-specific interactions
    shard: ShardInfo;
  }>;

  // Handlers (should be stable and at most one or two, for simple id click)
  onNodeClick?: (nodeId: string) => void;
  onDestinationClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;
}


// ─── Layout constants ────────────────────────────────────────────────────────
export const SHARD_SIZE = 24;
export const SHARD_GAP = 4;
export const SHARDS_PER_ROW = 8;
/** Estimated group height used only for inter-node vertical spacing. */
const ESTIMATED_HEADER_HEIGHT = 80;
const ESTIMATED_SHARD_ROW_HEIGHT = SHARD_SIZE + SHARD_GAP;
const GROUP_PADDING_BOTTOM = 12;
export const GROUP_WIDTH = 360;
export const HORIZONTAL_GAP = 50;
export const VERTICAL_GAP = 30;

const COLUMN_WIDTH = GROUP_WIDTH + HORIZONTAL_GAP;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CanvasLayoutInput {
  clusterNodes: NodeInfo[];
  shardsByNode: Record<string, ShardInfo[]>;
  groupingConfig: GroupingConfig;
  onNodeClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;
  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  getIndexHealthColor?: (indexName: string) => string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Estimated group height for layout spacing (not used for actual rendering). */
function estimatedGroupHeight(shardCount: number): number {
  const rows = Math.ceil(shardCount / SHARDS_PER_ROW);
  return (
    ESTIMATED_HEADER_HEIGHT +
    rows * ESTIMATED_SHARD_ROW_HEIGHT +
    GROUP_PADDING_BOTTOM
  );
}

/** Sort cluster nodes: master-eligible first, then data, then others, alpha within each bucket. */
function sortClusterNodes(nodes: NodeInfo[]): NodeInfo[] {
  return [...nodes].sort((a, b) => {
    const aIsMaster = a.roles?.includes('master') ?? false;
    const bIsMaster = b.roles?.includes('master') ?? false;
    if (aIsMaster && !bIsMaster) return -1;
    if (!aIsMaster && bIsMaster) return 1;
    return a.name.localeCompare(b.name);
  });
}

/** Determine layout column index for a node (no-grouping mode). */
function columnFor(node: NodeInfo): number {
  if (node.roles?.includes('master')) return 0;
  if (node.roles?.includes('ingest') || node.roles?.includes('ml')) return 2;
  return 1;
}

/** Emit a single group node (shards embedded in data, rendered by ClusterGroupNode). */
import { formatBytes } from '../utils/formatters';

function emitGroupNode(
  result: Node[],
  node: NodeInfo,
  position: { x: number; y: number },
  shards: ShardInfo[],
  input: CanvasLayoutInput,
  groupLabel?: string,
): void {
  const isValidDestination =
    input.relocationMode &&
    input.validDestinationNodes?.some(
      (id) => id === node.id || id === node.name,
    );

  // Precompute metrics/colors
  const heapPercent = node.heapMax > 0 ? (node.heapUsed / node.heapMax) * 100 : 0;
  const heapColor = heapPercent < 70 ? 'green' : heapPercent < 85 ? 'yellow' : 'red';
  const cpuPercent = node.cpuPercent ?? undefined;
  const cpuColor =
    cpuPercent === undefined ? 'dimmed' : cpuPercent < 70 ? 'green' : cpuPercent < 85 ? 'yellow' : 'red';
  const load1m = node.loadAverage?.[0];
  const loadColor =
    load1m === undefined ? 'dimmed' : load1m < 4 ? 'green' : load1m < 6 ? 'yellow' : 'red';
  const diskDisplay = formatBytes(node.diskUsed);

  // Shard dot and badge summaries (precompute all)
  const sortedShards = sortShards(shards);
  const primaryCount = sortedShards.filter((s) => s.primary).length;
  const replicaCount = sortedShards.filter((s) => !s.primary).length;
  const totalShards = sortedShards.length;

  const badges: Array<{ label: string; color?: string }> = [
    { label: `${totalShards} shards` },
  ];
  if (primaryCount > 0) badges.push({ label: `${primaryCount} primary`, color: 'blue' });
  if (replicaCount > 0) badges.push({ label: `${replicaCount} replica`, color: 'gray' });

  const dots = sortedShards.map((shard, idx) => {
    const color = input.getIndexHealthColor
      ? input.getIndexHealthColor(shard.index)
      : 'var(--mantine-color-gray-6)';
    return {
      color,
      tooltip: `${shard.index} · shard ${shard.shard} · ${shard.primary ? 'Primary' : 'Replica'} · ${shard.state}`,
      primary: shard.primary,
      shard,
    };
  });

  const groupData: ClusterGroupNodeDataFlat = {
    id: node.id,
    name: node.name,
    version: node.version,
    roles: node.roles,
    isMaster: node.isMaster,
    isMasterEligible: node.isMasterEligible,
    ip: node.ip,
    heapPercent,
    heapColor,
    cpuPercent,
    cpuColor,
    diskUsed: node.diskUsed,
    diskDisplay,
    load1m,
    loadColor,
    groupLabel,
    isValidDestination: !!isValidDestination,
    summaryCounts: { primary: primaryCount, replica: replicaCount, total: totalShards },
    badges,
    dots,
    onNodeClick: input.onNodeClick,
    onDestinationClick: input.onDestinationClick,
  };

  result.push({
    id: node.id,
    type: 'clusterGroup',
    position,
    draggable: true,
    style: {
      width: GROUP_WIDTH,
      transition: 'transform 0.4s ease',
      border: isValidDestination
        ? '2px dashed var(--mantine-color-violet-6)'
        : '1px solid var(--mantine-color-default-border)',
      borderRadius: '8px',
      backgroundColor: 'var(--mantine-color-body)',
    },
    data: groupData as unknown as Record<string, unknown>,
  });
}


// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Calculate the Canvas RF node array (group nodes only).
 *
 * Each node is a 'clusterGroup' with its shards embedded in data.
 * ClusterGroupNode renders shards as inline JSX so the group height is
 * driven by content, not a static constant.
 */
export function calculateCanvasLayout(input: CanvasLayoutInput): Node[] {
  const { clusterNodes, shardsByNode, groupingConfig } = input;

  if (clusterNodes.length === 0) return [];

  const result: Node[] = [];

  if (groupingConfig.attribute === 'none') {
    // ── No-grouping: 3-column layout ─────────────────────────────────────
    const sorted = sortClusterNodes(clusterNodes);
    const colY = [0, 0, 0]; // y-cursor for each column

    sorted.forEach((node) => {
      const col = columnFor(node);
      const y = colY[col];
      const shards = shardsByNode[node.name] ?? shardsByNode[node.id] ?? [];

      emitGroupNode(result, node, { x: col * COLUMN_WIDTH, y }, shards, input);

      colY[col] = y + estimatedGroupHeight(shards.length) + VERTICAL_GAP;
    });
  } else {
    // ── Grouped: one column per group ────────────────────────────────────
    const nodeGroups = calculateNodeGroups(clusterNodes, groupingConfig);
    let colX = 0;

    nodeGroups.forEach((groupNodes, groupKey) => {
      const sorted = sortClusterNodes(groupNodes);
      const label = getGroupLabel(groupKey, groupingConfig.attribute);
      let y = 0;

      sorted.forEach((node) => {
        const shards = shardsByNode[node.name] ?? shardsByNode[node.id] ?? [];

        emitGroupNode(result, node, { x: colX, y }, shards, input, label);

        y += estimatedGroupHeight(shards.length) + VERTICAL_GAP;
      });

      colX += COLUMN_WIDTH;
    });
  }

  return result;
}
