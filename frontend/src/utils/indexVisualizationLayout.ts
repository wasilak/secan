/**
 * Index visualisation layout engine.
 *
 * Pure function — no React imports, no side effects.
 * Converts a flat ShardInfo[] into a two-level RF hierarchy:
 *   index group  →  (sub-group per ES node  →  shard leaves)
 * plus edges connecting each primary shard to its replicas.
 *
 * Sub-groups are arranged horizontally (left to right) inside the index group.
 * Parent nodes always precede their children in the returned array (RF hard req).
 *
 * Requirements: 3.1–3.7, 4.4, 4.5
 */

import type { Node, Edge } from '@xyflow/react';
import type { ShardInfo } from '../types/api';
import { sortShards } from './shardOrdering';
import type { IndexGroupNodeData } from '../components/IndexGroupNode';
import type { IndexNodeSubGroupData } from '../components/IndexNodeSubGroup';
import type { ShardNodeData } from '../components/Topology/ShardNode';

// ─── Layout constants ────────────────────────────────────────────────────────
export const SHARD_SIZE = 24;
export const SHARD_GAP = 4;
export const SHARDS_PER_ROW = 6;
export const SUBGROUP_HEADER = 28;
export const SUBGROUP_PADDING = 8;
export const SUB_GROUP_GAP = 16;
export const INDEX_HEADER = 36;
export const INDEX_PADDING = 16;

export const SUBGROUP_WIDTH =
  SHARDS_PER_ROW * (SHARD_SIZE + SHARD_GAP) + SUBGROUP_PADDING * 2;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IndexVizLayoutInput {
  indexName: string;
  shards: ShardInfo[];
  health?: 'green' | 'yellow' | 'red';
  onShardClick?: (shard: ShardInfo) => void;
}

export interface IndexVizLayoutOutput {
  nodes: Node[];
  edges: Edge[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const UNASSIGNED_KEY = '__unassigned__';

function subgroupHeight(shardCount: number): number {
  const rows = Math.ceil(shardCount / SHARDS_PER_ROW);
  return (
    SUBGROUP_HEADER +
    rows * (SHARD_SIZE + SHARD_GAP) +
    SUBGROUP_PADDING * 2
  );
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Calculate the full Index Viz RF node + edge arrays.
 */
export function calculateIndexVizLayout(
  input: IndexVizLayoutInput,
): IndexVizLayoutOutput {
  const { indexName, shards, health, onShardClick } = input;

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  if (shards.length === 0) {
    // Emit a minimal index group so the canvas is not blank.
    const indexData: IndexGroupNodeData = {
      indexName,
      health,
      shardCount: 0,
    };
    nodes.push({
      id: 'idx',
      type: 'indexGroup',
      position: { x: 0, y: 0 },
      width: SUBGROUP_WIDTH + INDEX_PADDING * 2,
      height: INDEX_HEADER + INDEX_PADDING * 2,
      data: indexData as unknown as Record<string, unknown>,
    });
    return { nodes, edges };
  }

  // ── 1. Group shards by ES node name ──────────────────────────────────────
  const groupMap = new Map<string, ShardInfo[]>();

  for (const shard of shards) {
    const key = shard.node ?? UNASSIGNED_KEY;
    if (!groupMap.has(key)) groupMap.set(key, []);
    groupMap.get(key)!.push(shard);
  }

  // Sort sub-groups alphabetically (unassigned goes last).
  const sortedKeys = [...groupMap.keys()].sort((a, b) => {
    if (a === UNASSIGNED_KEY) return 1;
    if (b === UNASSIGNED_KEY) return -1;
    return a.localeCompare(b);
  });

  // ── 2. Compute sub-group dimensions and index group size ─────────────────
  let maxSubgroupH = 0;
  const subgroupHeights: number[] = sortedKeys.map((key) => {
    const h = subgroupHeight(groupMap.get(key)!.length);
    if (h > maxSubgroupH) maxSubgroupH = h;
    return h;
  });

  const totalSubgroupsWidth =
    sortedKeys.length * SUBGROUP_WIDTH +
    (sortedKeys.length - 1) * SUB_GROUP_GAP;

  const indexW = totalSubgroupsWidth + INDEX_PADDING * 2;
  const indexH = INDEX_HEADER + maxSubgroupH + INDEX_PADDING * 2;

  // ── 3. Emit index group node ──────────────────────────────────────────────
  const indexData: IndexGroupNodeData = {
    indexName,
    health,
    shardCount: shards.length,
  };

  nodes.push({
    id: 'idx',
    type: 'indexGroup',
    position: { x: 0, y: 0 },
    width: indexW,
    height: indexH,
    data: indexData as unknown as Record<string, unknown>,
  });

  // Map: `${shardNumber}__p` → nodeId (for edge building)
  const primaryShardNodeId = new Map<number, string>();
  // Map: shardNumber → replicaNodeIds[]
  const replicaShardNodeIds = new Map<number, string[]>();

  // ── 4. Emit sub-groups + their shard children ─────────────────────────────
  sortedKeys.forEach((nodeKey, sgIdx) => {
    const subgroupId = `sg__${nodeKey}`;
    const sgShards = sortShards(groupMap.get(nodeKey)!).sort((a, b) => {
      // primaries before replicas within same shard number
      if (a.shard !== b.shard) return 0; // sortShards already sorted by shard#
      if (a.primary && !b.primary) return -1;
      if (!a.primary && b.primary) return 1;
      return 0;
    });

    const sgX = INDEX_PADDING + sgIdx * (SUBGROUP_WIDTH + SUB_GROUP_GAP);
    const sgY = INDEX_HEADER + INDEX_PADDING;
    const sgH = subgroupHeights[sgIdx];

    // Sub-group node
    const sgData: IndexNodeSubGroupData = {
      nodeName: nodeKey === UNASSIGNED_KEY ? 'Unassigned' : nodeKey,
    };

    nodes.push({
      id: subgroupId,
      type: 'nodeSubGroup',
      parentId: 'idx',
      extent: 'parent',
      position: { x: sgX, y: sgY },
      width: SUBGROUP_WIDTH,
      height: sgH,
      draggable: false,
      data: sgData as unknown as Record<string, unknown>,
    });

    // Shard leaf nodes
    sgShards.forEach((shard, idx) => {
      const col = idx % SHARDS_PER_ROW;
      const row = Math.floor(idx / SHARDS_PER_ROW);
      const shardNodeId = `shard__${nodeKey}__${shard.shard}__${shard.primary ? 'p' : 'r'}`;

      const shardData: ShardNodeData = {
        shard,
        onShardClick: onShardClick
          ? (s: ShardInfo) => onShardClick(s)
          : undefined,
      };

      nodes.push({
        id: shardNodeId,
        type: 'shardNode',
        parentId: subgroupId,
        extent: 'parent',
        position: {
          x: SUBGROUP_PADDING + col * (SHARD_SIZE + SHARD_GAP),
          y: SUBGROUP_HEADER + SUBGROUP_PADDING + row * (SHARD_SIZE + SHARD_GAP),
        },
        width: SHARD_SIZE,
        height: SHARD_SIZE,
        draggable: false,
        selectable: false,
        data: shardData as unknown as Record<string, unknown>,
      });

      // Record for edge building
      if (shard.primary) {
        primaryShardNodeId.set(shard.shard, shardNodeId);
      } else {
        if (!replicaShardNodeIds.has(shard.shard)) {
          replicaShardNodeIds.set(shard.shard, []);
        }
        replicaShardNodeIds.get(shard.shard)!.push(shardNodeId);
      }
    });
  });

  // ── 5. Emit primary→replica edges ────────────────────────────────────────
  primaryShardNodeId.forEach((primaryId, shardNum) => {
    const replicas = replicaShardNodeIds.get(shardNum) ?? [];
    replicas.forEach((replicaId) => {
      edges.push({
        id: `edge__${primaryId}__${replicaId}`,
        source: primaryId,
        target: replicaId,
        zIndex: 1,
      });
    });
  });

  return { nodes, edges };
}
