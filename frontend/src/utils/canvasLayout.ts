/**
 * Canvas topology layout engine.
 *
 * Pure function — no React imports, no side effects.
 * Converts NodeInfo[] + shardsByNode + GroupingConfig into a flat RF Node[]
 * where every group node (type 'clusterGroup') immediately precedes its shard
 * children (type 'shardNode').  Parent-before-children order is a hard RF
 * requirement.
 *
 * Requirements: 1.2, 1.3, 1.4, 1.6, 1.9, 2.1
 */

import type { Node } from '@xyflow/react';
import type { NodeInfo, ShardInfo } from '../types/api';
import type { GroupingConfig } from './topologyGrouping';
import { calculateNodeGroups, getGroupLabel } from './topologyGrouping';
import { sortShards } from './shardOrdering';
import type { ClusterGroupNodeData } from '../components/Topology/ClusterGroupNode';
import type { ShardNodeData } from '../components/Topology/ShardNode';

// ─── Layout constants ────────────────────────────────────────────────────────
export const SHARD_SIZE = 24;
export const SHARD_GAP = 4;
export const SHARDS_PER_ROW = 8;
export const GROUP_HEADER_HEIGHT = 72;
export const GROUP_PADDING = 8;
export const GROUP_WIDTH = 280;
export const HORIZONTAL_GAP = 50;
export const VERTICAL_GAP = 30;

const COLUMN_WIDTH = GROUP_WIDTH + HORIZONTAL_GAP;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CanvasLayoutInput {
  clusterNodes: NodeInfo[];
  shardsByNode: Record<string, ShardInfo[]>;
  groupingConfig: GroupingConfig;
  onNodeClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  getIndexHealthColor?: (indexName: string) => string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function groupHeight(shardCount: number): number {
  const rows = Math.ceil(shardCount / SHARDS_PER_ROW);
  return (
    GROUP_HEADER_HEIGHT +
    rows * (SHARD_SIZE + SHARD_GAP) +
    GROUP_PADDING * 2
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

/** Emit group + child shard nodes for a single cluster node. */
function emitNodes(
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

  const nodeShards = sortShards(shards);
  const h = groupHeight(nodeShards.length);

  // ── Group (parent) node ───────────────────────────────────────────────────
  const groupData: ClusterGroupNodeData = {
    node,
    onNodeClick: input.onNodeClick,
    isValidDestination: !!isValidDestination,
    onDestinationClick: input.onDestinationClick,
    groupLabel,
  };

  result.push({
    id: node.id,
    type: 'clusterGroup',
    position,
    width: GROUP_WIDTH,
    height: h,
    draggable: true,
    style: { transition: 'transform 0.4s ease' },
    data: groupData as unknown as Record<string, unknown>,
  });

  // ── Shard child nodes ────────────────────────────────────────────────────
  nodeShards.forEach((shard, idx) => {
    const col = idx % SHARDS_PER_ROW;
    const row = Math.floor(idx / SHARDS_PER_ROW);

    const shardData: ShardNodeData = {
      shard,
      onShardClick: input.onShardClick,
    };

    result.push({
      id: `${node.id}__shard__${shard.index}__${shard.shard}__${shard.primary ? 'p' : 'r'}`,
      type: 'shardNode',
      parentId: node.id,
      extent: 'parent',
      position: {
        x: GROUP_PADDING + col * (SHARD_SIZE + SHARD_GAP),
        y: GROUP_HEADER_HEIGHT + GROUP_PADDING + row * (SHARD_SIZE + SHARD_GAP),
      },
      width: SHARD_SIZE,
      height: SHARD_SIZE,
      draggable: false,
      selectable: false,
      data: shardData as unknown as Record<string, unknown>,
    });
  });
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Calculate the full Canvas RF node array.
 *
 * Returns a flat array where every group node immediately precedes its
 * children (RF hard requirement for sub-flows).
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
      const h = groupHeight(shards.length);

      emitNodes(result, node, { x: col * COLUMN_WIDTH, y }, shards, input);

      colY[col] = y + h + VERTICAL_GAP;
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
        const h = groupHeight(shards.length);

        emitNodes(result, node, { x: colX, y }, shards, input, label);

        y += h + VERTICAL_GAP;
      });

      colX += COLUMN_WIDTH;
    });
  }

  return result;
}
