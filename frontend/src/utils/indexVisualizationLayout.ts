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
import type { ShardInfo, NodeInfo } from '../types/api';
import React, { type ReactNode } from 'react';
import { sortShards } from './shardOrdering';
import type { IndexGroupNodeData } from '../components/IndexGroupNode';
import { computeHeapPercent, getHeapColor } from './heap';
import { getShardDotColor } from './colors';
import { formatBytes } from '../utils/formatters';
import type { ClusterGroupNodeDataFlat } from '../utils/canvasLayout';
import { GROUP_WIDTH } from './canvasLayout';

// Simple width estimator for the index header node based on text lengths.
function estimateIndexNodeWidth(indexName: string, total: number, primary: number, replica: number): number {
  const charWidth = 8; // conservative average char width in px
  const badgeCharWidth = 9; // badges have padding
  const nameWidth = Math.max(40, indexName.length * charWidth);
  const pills = [`${total} shards`, `${primary} primary`, `${replica} replica`].filter(Boolean).join(' ');
  const pillsWidth = Math.max(40, pills.length * badgeCharWidth);
  const padding = 32; // left+right padding inside node
  return Math.ceil(nameWidth + pillsWidth + padding);
}

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
  // authoritative node metadata for all nodes referenced by shards
  nodes: NodeInfo[];
  health?: 'green' | 'yellow' | 'red';
  onShardClick?: (shard: ShardInfo) => void;
  onNodeClick?: (nodeId: string) => void;
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
  const { indexName, shards, health, onShardClick, onNodeClick } = input;
  const nodeInfos = input.nodes ?? [];

  const nodes: Node[] = [];
  const edges: Edge[] = [];

  // Compute top-level shard counts for the index header
  const totalShards = shards.length;
  const totalPrimaries = shards.filter((s) => s.primary).length;
  const totalReplicas = totalShards - totalPrimaries;

  if (shards.length === 0) {
    // Emit an indexGroup root node so the canvas/modal is not blank.
    nodes.push({
      id: 'idx',
      type: 'indexGroup',
      position: { x: 0, y: 0 },
      draggable: false,
      // Provide an estimated width so Dagre can center the node accurately
      width: Math.max(120, estimateIndexNodeWidth(indexName, 0, 0, 0)),
      data: {
        indexName,
        health,
        shardCount: 0,
        primaryCount: 0,
        replicaCount: 0,
      } as IndexGroupNodeData,
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
  // Compute subgroup heights for layout; keep max height for index group sizing.
  for (const key of sortedKeys) {
    const h = subgroupHeight(groupMap.get(key)!.length);
    if (h > maxSubgroupH) maxSubgroupH = h;
  }

  const totalSubgroupsWidth =
    sortedKeys.length * SUBGROUP_WIDTH +
    (sortedKeys.length - 1) * SUB_GROUP_GAP;

  const indexW = totalSubgroupsWidth + INDEX_PADDING * 2;

  // ── 3. Emit root node (index header) ────────────────────────────────────
  nodes.push({
    id: 'idx',
    type: 'indexGroup',
    position: { x: 0, y: 0 },
    draggable: false,
    // Estimate width from content so dagre centers this node above its children.
    width: Math.max(120, Math.min(indexW, estimateIndexNodeWidth(indexName, totalShards, totalPrimaries, totalReplicas))),
    style: {
      boxSizing: 'border-box',
      overflow: 'visible',
      transition: 'transform 0.4s ease',
      borderRadius: '8px',
      backgroundColor: 'transparent',
    },
    data: {
      indexName,
      health,
      shardCount: totalShards,
      primaryCount: totalPrimaries,
      replicaCount: totalReplicas,
    } as IndexGroupNodeData,
  });

  // We'll render the index header at the top and create a clusterGroup-style
  // node for each ES node below. Each clusterGroup node will receive only the
  // shards belonging to this index and will render them using the same
  // ClusterGroupNode component. We still emit shard-level nodes for edges
  // between primary and replicas so we can draw connections.
  // primary/replica node tracking removed: index visualization omits explicit
  // ShardNode leaf emission and primary->replica edges (requirements).

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

    // Find authoritative node info by id, name or ip. Some upstream data
    // sources may supply shard.node as either the node NAME or the node ID
    // (and occasionally an IP). Accept all of them so the layout is tolerant
    // to mixed inputs — similar to other frontend components.
    const nodeInfoByIdentifier = new Map<string, NodeInfo>();
    for (const n of nodeInfos) {
      if (n.id) nodeInfoByIdentifier.set(n.id, n);
      if (n.name) nodeInfoByIdentifier.set(n.name, n);
      if ((n as NodeInfo).ip) nodeInfoByIdentifier.set((n as NodeInfo).ip as string, n);
    }

    let nodeInfo = nodeInfoByIdentifier.get(nodeKey);

    // Special-case unassigned shards: provide a lightweight placeholder so the
    // index visualization can render an "Unassigned" subgroup without requiring
    // a full NodeInfo from the backend. All other missing NodeInfo entries are
    // considered errors and will fail fast to surface backend gaps.
    if (!nodeInfo) {
      if (nodeKey === UNASSIGNED_KEY) {
        nodeInfo = {
          id: UNASSIGNED_KEY,
          name: 'Unassigned',
          roles: [],
          heapUsed: 0,
          heapMax: 0,
          heapPercent: 0,
          diskUsed: 0,
          diskTotal: 0,
          cpuPercent: undefined,
          ip: undefined,
          version: undefined,
          isMaster: false,
          isMasterEligible: false,
          loadAverage: undefined,
          uptime: undefined,
          uptimeMillis: undefined,
          tags: undefined,
        } as unknown as NodeInfo;
      } else {
        throw new Error(`Index visualization: missing NodeInfo for node '${nodeKey}'. Backend must supply full node metadata.`);
      }
    }

    // Build dots and badges for this node using the shards of this index
    const primaryCount = sgShards.filter((s) => s.primary).length;
    const replicaCount = sgShards.filter((s) => !s.primary).length;
    const totalShardsForNode = sgShards.length;

    const badgesForNode: Array<{ label: string; color?: string }> = [
      { label: `${totalShardsForNode} shards` },
    ];
    if (primaryCount > 0) badgesForNode.push({ label: `${primaryCount} primary`, color: 'blue' });
    if (replicaCount > 0) badgesForNode.push({ label: `${replicaCount} replica`, color: 'gray' });

    // Use shard-state-based dot coloring (consistent with other topology views)
    const dotsForNode = sgShards.map((shard: ShardInfo) => ({
      color: getShardDotColor(shard.state),
      tooltip: React.createElement(
        'div',
        null,
        React.createElement('div', null, 'Index: ', React.createElement('span', { style: { textTransform: 'none' } }, shard.index)),
        React.createElement('div', null, 'Shard: ', React.createElement('span', { style: { textTransform: 'none' } }, shard.shard)),
        React.createElement('div', null, 'Type: ', shard.primary ? 'Primary' : 'Replica'),
        React.createElement('div', null, 'State: ', shard.state),
      ) as ReactNode,
      primary: shard.primary,
      shard,
    }));

    // Build flat ClusterGroupNodeDataFlat so IndexVisualization reuses the same renderer
    const heapPercent = computeHeapPercent(nodeInfo.heapUsed as number | undefined, nodeInfo.heapMax as number | undefined);
    const flat: ClusterGroupNodeDataFlat = {
      id: nodeInfo.id ?? `node__${nodeInfo.name ?? 'unknown'}`,
      name: nodeInfo.name ?? nodeInfo.id ?? 'unknown',
      version: nodeInfo.version,
      roles: nodeInfo.roles ?? [],
      isMaster: !!nodeInfo.isMaster,
      isMasterEligible: !!nodeInfo.isMasterEligible,
      ip: nodeInfo.ip,
      heapPercent,
      heapColor: getHeapColor(heapPercent),
      cpuPercent: nodeInfo.cpuPercent ?? undefined,
      cpuColor: nodeInfo.cpuPercent === undefined ? 'dimmed' : nodeInfo.cpuPercent < 70 ? 'green' : nodeInfo.cpuPercent < 85 ? 'yellow' : 'red',
      diskUsed: (nodeInfo.diskUsed as number) ?? 0,
      diskDisplay: formatBytes(nodeInfo.diskUsed ?? 0),
      load1m: nodeInfo.loadAverage && nodeInfo.loadAverage.length > 0 ? nodeInfo.loadAverage[0] : undefined,
      loadColor: (nodeInfo.loadAverage && nodeInfo.loadAverage.length > 0) ? (nodeInfo.loadAverage[0] < 4 ? 'green' : nodeInfo.loadAverage[0] < 6 ? 'yellow' : 'red') : 'dimmed',
      groupLabel: undefined,
      isValidDestination: false,
      summaryCounts: { primary: primaryCount, replica: replicaCount, total: totalShardsForNode },
      badges: badgesForNode,
      dots: dotsForNode,
      onNodeClick: nodeInfo.id && nodeInfo.id !== UNASSIGNED_KEY ? (() => onNodeClick?.(nodeInfo.id as string)) : undefined,
      onDestinationClick: undefined,
      onShardClick: onShardClick ?? undefined,
      renderDots: true,
      isUnassigned: nodeKey === UNASSIGNED_KEY,
    };

    nodes.push({
      id: subgroupId,
      type: 'clusterGroup',
      position: { x: sgX, y: sgY },
      // Visual width is driven by the inner card (ClusterESNodeCard) which
      // sets minWidth/width. Do not set RF node width to avoid clipping the
      // inner card border due to double-sizing / subpixel rounding.
      // Do not set RF node height: let the DOM/card drive its own height so
      // React Flow places handles/connectors correctly (avoids clipped borders
      // and mis-positioned bottom handles due to stale fixed heights).
      draggable: false,
      style: {
        // Provide minWidth to avoid clipping while allowing DOM-driven sizing
        minWidth: GROUP_WIDTH,
        boxSizing: 'border-box',
        overflow: 'visible',
        transition: 'transform 0.4s ease',
        border: '1px solid var(--mantine-color-default-border)',
        borderRadius: '8px',
        backgroundColor: 'var(--mantine-color-body)',
      },
      data: flat as unknown as Record<string, unknown>,
    });

    // Connect the index header node to the subgroup (node card) with a single edge
      edges.push({
        id: `edge__idx__${subgroupId}`,
        source: 'idx',
        target: subgroupId,
      });

    // Omit emission of visible ShardNode leaf nodes; all relevant shards are shown in the ClusterGroupNode dot rendering above.
    // If edges between primary and replica shards are still needed, re-add invisible ShardNodes here; otherwise remove all below.
    // (No code for emitting ShardNodes or edges to them.)

  });

  // ── 5. Emit primary→replica edges ────────────────────────────────────────
  // NOOP for this index visualization: omit primary→replica edges (per requirements)
  // primaryShardNodeId.forEach((primaryId, shardNum) => {
  //   const replicas = replicaShardNodeIds.get(shardNum) ?? [];
  //   replicas.forEach((replicaId) => {
  //     edges.push({
  //       id: `edge__${primaryId}__${replicaId}`,
  //       source: primaryId,
  //       target: replicaId,
  //       zIndex: 1,
  //     });
  //   });
  // });

  return { nodes, edges };
}
