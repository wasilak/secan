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
import React, { type ReactNode } from 'react';
import type { GroupingConfig } from './topologyGrouping';
import { calculateNodeGroups, getGroupLabel } from './topologyGrouping';
import { sortShards } from './shardOrdering';
import { getShardDotColor, getUnassignedShardColor } from './colors';
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
  load5m?: number;
  loadColor: string;

  groupLabel?: string;
  isValidDestination: boolean;

  // summaryCounts MUST be present. Keep as required to get compile-time checks.
  summaryCounts: {
    primary: number;
    replica: number;
    total: number;
  };
  badges: Array<{ label: string; color?: string }>;
  dots: Array<{
    color: string;
    tooltip: ReactNode;
    primary: boolean;
    // Include shard info so node renderer can emit shard-specific interactions
    shard: ShardInfo;
  }>;
   /** When true, UI should not display shard summary pills (used to avoid showing "0 shards") */
   suppressShardSummary?: boolean;
  /** When true, the node is currently loading/shard-list is not yet available. */
  loading?: boolean;

  // Handlers (should be stable and at most one or two, for simple id click)
  onNodeClick?: (nodeId: string) => void;
  onDestinationClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;
  /** When false the node renderer should not draw shard dots (useful for index viz where
   * shard leaf nodes are used for visuals and edges). Defaults to true when omitted.
   */
  renderDots?: boolean;
  /** Whether this node represents the special unassigned shard bucket */
  isUnassigned?: boolean;
}

/**
 * Estimate a minimum width (px) required to display the node header (name + version + role icons)
 * Uses a simple character-based heuristic to avoid measuring DOM synchronously.
 * Returned value is clamped to a reasonable maximum to avoid extremely wide nodes.
 */
export function estimateGroupMinWidth(node: Partial<NodeInfo>, iconSize = 13): number {
  const name = node.name ?? '';
  const nameChars = Math.max(0, name.length);
  const CHAR_PX = 8; // approximate average character width in 'sm' font
  const basePadding = 24; // left + right padding from card style
  const versionWidth = node.version ? 36 : 0; // small token for 'vX.Y.Z'
  const masterBadgeWidth = node.isMaster ? 28 : 0; // M badge
  const rolesWidth = (node.roles ? node.roles.length : 0) * (iconSize + 4); // icon + gap
  const extraGap = 12; // gap between name and icons
  const width = Math.ceil(basePadding + nameChars * CHAR_PX + versionWidth + masterBadgeWidth + rolesWidth + extraGap);
  // Clamp sensible min/max to avoid pathological widths
  const MAX = 1000;
  return Math.max(GROUP_WIDTH, Math.min(width, MAX));
}


// ─── Layout constants ────────────────────────────────────────────────────────
import TOPOLOGY_CONFIG from '../config/topologyConfig';

export const SHARD_SIZE = TOPOLOGY_CONFIG.SHARD_SIZE;
export const SHARD_GAP = TOPOLOGY_CONFIG.SHARD_GAP;
export const SHARDS_PER_ROW = TOPOLOGY_CONFIG.SHARDS_PER_ROW_BASE;
/** Estimated group height used only for inter-node vertical spacing. */
const ESTIMATED_HEADER_HEIGHT = 80;
const ESTIMATED_SHARD_ROW_HEIGHT = SHARD_SIZE + SHARD_GAP;
const GROUP_PADDING_BOTTOM = 12;
export const GROUP_WIDTH = TOPOLOGY_CONFIG.GROUP_WIDTH;
// Tuned gaps for Dagre + collision resolver to produce pleasant spacing
export const HORIZONTAL_GAP = 60;
export const VERTICAL_GAP = 40;

// Key used to collect shards that are not assigned to any node
export const UNASSIGNED_KEY = '__unassigned__';

const COLUMN_WIDTH = GROUP_WIDTH + HORIZONTAL_GAP;

// ─── Group container constants ───────────────────────────────────────────────
// Padding inside the RF parent (groupContainer) node. Children are inset by
// CONTAINER_PADDING_X from the left; CONTAINER_PADDING_TOP leaves room for the
// floating label; CONTAINER_PADDING_BOTTOM adds breathing room at the bottom.
export const CONTAINER_PADDING_X = 12;
export const CONTAINER_PADDING_TOP = 36;
export const CONTAINER_PADDING_BOTTOM = 24;
/** Vertical gap between child nodes inside a group container (grouped mode). */
export const CONTAINER_VERTICAL_GAP = 12;

// Estimated single-row group height used as a sensible fallback by layout
// consumers that need a non-content-driven height (eg. dagre layout).
export const ESTIMATED_GROUP_HEIGHT =
  ESTIMATED_HEADER_HEIGHT + ESTIMATED_SHARD_ROW_HEIGHT + GROUP_PADDING_BOTTOM;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface CanvasLayoutInput {
  clusterNodes: NodeInfo[];
  shardsByNode: Record<string, ShardInfo[]>;
  groupingConfig: GroupingConfig;
  /** Optional measured container width (pixels) used to calculate adaptive grid */
  containerWidth?: number;
  /** Optional measured container height (pixels) used to calculate adaptive grid */
  containerHeight?: number;
  onNodeClick?: (nodeId: string) => void;
  onShardClick?: (shard: ShardInfo, event?: React.MouseEvent) => void;
  relocationMode?: boolean;
  validDestinationNodes?: string[];
  onDestinationClick?: (nodeId: string) => void;
  getIndexHealthColor?: (indexName: string) => string;
  /**
   * When true, do not show shard summary badges/pills when the shard list for
   * a node is empty. Used by Canvas tile fallback when tiles are not yet
   * providing shard details to avoid misleading "0 shards" pills.
   */
  hideShardSummaryWhenEmpty?: boolean;
  /**
   * Cached count of unassigned shards from the most recent L2 visit.
   * Used at L0/L1 zoom (where allShards is undefined) to still emit the
   * synthetic Unassigned node with a count badge even without full shard data.
   */
  unassignedShardsHint?: number;
  /** Global loading flag propagated into generated node data (per-node loading preserved by caller). */
  loading?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Estimated group height for layout spacing (not used for actual rendering). */
function estimatedGroupHeight(shardCount: number): number {
  // Ensure we respect a maximum number of rows to avoid extremely tall nodes.
  const rows = Math.min(Math.ceil(shardCount / SHARDS_PER_ROW), TOPOLOGY_CONFIG.MAX_SHARD_ROWS);
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
import { formatBytes, getLoadColor } from '../utils/formatters';
import { computeHeapPercent, getHeapColor } from './heap';

/** Optional overrides for the RF node emitted by emitGroupNode. */
interface EmitOverrides {
  /** Override the RF node id (default: node.id). Use for duplicated nodes in grouped layouts. */
  rfNodeId?: string;
  /** If set, the node is a child of this parent RF node id. Adds parentId + extent: 'parent'. */
  parentId?: string;
}

function emitGroupNode(
  result: Node[],
  node: NodeInfo,
  position: { x: number; y: number },
  shards: ShardInfo[],
  input: CanvasLayoutInput,
  groupLabel?: string,
  overrides?: EmitOverrides,
): void {
  const isValidDestination =
    input.relocationMode &&
    input.validDestinationNodes?.some(
      (id) => id === node.id || id === node.name,
    );

  // Precompute metrics/colors
  // For unassigned placeholder nodes we should not attempt to show heap/disk
  // metrics (they are not actual ES nodes). The `node` parameter may be a
  // lightweight placeholder with id === UNASSIGNED_KEY.
  // Node may be a lightweight placeholder object (synthetic unassigned node).
  // Narrow to an object with optional id to avoid blanket `any`.
  const isUnassignedNode = (node as unknown as { id?: string }).id === UNASSIGNED_KEY;
  const heapPercent = isUnassignedNode ? 0 : computeHeapPercent(node.heapUsed, node.heapMax);
  const heapColor = isUnassignedNode ? 'dimmed' : getHeapColor(heapPercent);
  const cpuPercent = node.cpuPercent ?? undefined;
  const cpuColor =
    cpuPercent === undefined ? 'dimmed' : cpuPercent < 70 ? 'green' : cpuPercent < 85 ? 'yellow' : 'red';
  const load5m = node.loadAverage?.[1];
  const loadColor = getLoadColor(load5m);
  const diskDisplay = isUnassignedNode ? '0 B' : formatBytes(node.diskUsed);

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

  const dots = sortedShards.map((shard, _idx) => {
      // Use centralized shard color helpers so Canvas/Nodes/Dot views match
      const color = shard.state === 'UNASSIGNED'
        ? getUnassignedShardColor(shard.primary)
        : getShardDotColor(shard.state);
      return {
        color,
        tooltip: React.createElement(
          'div',
          null,
          React.createElement('div', null, 'Index: ', React.createElement('span', { style: { textTransform: 'none' } }, shard.index)),
          React.createElement('div', null, 'Shard: ', React.createElement('span', { style: { textTransform: 'none' } }, shard.shard)),
          React.createElement('div', null, shard.primary ? 'Primary' : 'Replica', ' · ', shard.state),
        ) as ReactNode,
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
    isUnassigned: isUnassignedNode,
    load5m,
    loadColor,
    groupLabel,
    isValidDestination: !!isValidDestination,
    summaryCounts: { primary: primaryCount, replica: replicaCount, total: totalShards },
    badges,
    dots,
    onNodeClick: input.onNodeClick,
    onDestinationClick: input.onDestinationClick,
    onShardClick: input.onShardClick,
    loading: input.loading ?? false,
  };

    // Provide a width hint based on node header content so dagre/collision
    // layout allocate enough space before the DOM measurement occurs. This
    // reduces transient truncation/flash for long node names.
    const minW = estimateGroupMinWidth(node);

    result.push({
      id: overrides?.rfNodeId ?? node.id,
      type: 'clusterGroup',
      position,
      // Provide a width hint used by dagre / layout engines
      width: minW,
      // Tag the RF node so we can target its wrapper element from CSS and
      // remove the wrapper border when our inner card renders the border.
      className: 'secan-rf-node-contains-card',
      // Nodes are not draggable in the canvas/cluster view by design (consistent with Index view)
      draggable: false,
      style: {
        // Let inner card drive width/height; provide minWidth so layout remains stable
        minWidth: minW,
        boxSizing: 'border-box',
        overflow: 'visible',
        transition: 'transform 0.4s ease',
        // Do not set border on the RF wrapper; the inner ClusterESNodeCard
        // is the authoritative source of the visible border. Setting border
        // here caused a double-border when both wrapper and inner card drew
        // borders. Avoid inline border to keep a single source of truth.
        borderRadius: '8px',
        backgroundColor: 'var(--mantine-color-body)',
      },
      data: groupData as unknown as Record<string, unknown>,
      // When placed inside a group container, set parentId for RF parent-child
      // positioning. Do NOT set extent: 'parent' — that would clamp child
      // positions to the initial (estimated, too-small) container height,
      // causing getNodes() to return clamped y-values and making the resize
      // effect underestimate neededHeight. Dragging is disabled anyway so the
      // constraint has no benefit.
      ...(overrides?.parentId !== undefined
        ? { parentId: overrides.parentId }
        : {}),
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

  // Tracks the bottom y-position of the tallest group/node column, used for
  // placing the synthetic Unassigned node below all real content.
  let contentBottomY = 0;
  // X position for the Unassigned node (after all groups in grouped mode).
  let unassignedX = COLUMN_WIDTH;

  if (groupingConfig.attribute === 'none') {
    // ── No-grouping: adaptive grid layout (greedy column-fill)
    // Aim: choose columns based on container aspect ratio and N so the
    // distribution matches the available rectangle (wide -> more columns,
    // square -> columns ~= rows). Use a greedy column-height balance to
    // avoid extremely tall columns when node heights vary.
    const sorted = sortClusterNodes(clusterNodes);

    const N = sorted.length;
    const W = input.containerWidth ?? 0;
    const H = input.containerHeight ?? 0;

    // Aspect ratio fallback and defensives
    const aspect = W > 0 && H > 0 ? Math.max(0.1, W / H) : 1;

    // Compute ideal column count using sqrt(N * aspect). Clamp to [1, N].
    let columns = Math.max(1, Math.round(Math.sqrt(N * aspect)));
    columns = Math.min(columns, N);

    // (Don't aggressively cap columns by a fixed minimum width here.)
    // We'll allow the computed column count and later scale column widths to
    // fit the container when a container width is available.

    // Prepare per-column cursors and widths (widths computed from node min widths)
    const colHeights = new Array<number>(columns).fill(0);
    const colWidths = new Array<number>(columns).fill(GROUP_WIDTH);
    const assignments: Array<{ node: NodeInfo; col: number } > = [];

    // First pass: assign each node to the column with smallest current height
    for (const node of sorted) {
      const shards = shardsByNode[node.name] ?? shardsByNode[node.id] ?? [];
      const estH = estimatedGroupHeight(shards.length);
      // pick column with minimal height
      let minCol = 0;
      let minVal = colHeights[0];
      for (let c = 1; c < columns; c++) {
        if (colHeights[c] < minVal) {
          minVal = colHeights[c];
          minCol = c;
        }
      }

      assignments.push({ node, col: minCol });
      colHeights[minCol] += estH + VERTICAL_GAP;

      // update column width to accommodate node's min width
      const minW = estimateGroupMinWidth(node);
      if (minW > colWidths[minCol]) colWidths[minCol] = minW;
    }

    // If container width known, scale column widths to fit if necessary.
    if (W > 0) {
      const totalGaps = Math.max(0, (columns - 1) * HORIZONTAL_GAP);
      let totalColsWidth = colWidths.reduce((a, b) => a + b, 0);
      if (totalColsWidth + totalGaps > W) {
        const available = Math.max(50, W - totalGaps);
        const scale = available / totalColsWidth;
        for (let c = 0; c < columns; c++) {
          // Ensure a sensible minimum so nodes don't become unusably narrow
          colWidths[c] = Math.max(120, Math.floor(colWidths[c] * scale));
        }
      }
    }

    // Compute X offsets for each column
    const colX: number[] = new Array(columns).fill(0);
    for (let c = 1; c < columns; c++) colX[c] = colX[c - 1] + colWidths[c - 1] + HORIZONTAL_GAP;

    // Emit nodes placed in assigned columns, stacking vertically per column.
    // The assignments array is in input order; to maintain a left-to-right
    // top-to-bottom visual flow we sort by column then by assigned order.
    const groupedByCol: Record<number, NodeInfo[]> = {};
    for (const [idx, asg] of assignments.entries()) {
      if (!groupedByCol[asg.col]) groupedByCol[asg.col] = [];
      groupedByCol[asg.col].push(asg.node);
    }

    const colYCursor = new Array<number>(columns).fill(0);
    for (let c = 0; c < columns; c++) {
      const nodesInCol = groupedByCol[c] ?? [];
      for (const node of nodesInCol) {
        const x = colX[c];
        const y = colYCursor[c];
        const shards = shardsByNode[node.name] ?? shardsByNode[node.id] ?? [];
        emitGroupNode(result, node, { x, y }, shards, input);
        const h = estimatedGroupHeight(shards.length);
        colYCursor[c] += h + VERTICAL_GAP;
      }
    }

    contentBottomY = Math.max(...colYCursor);
    // Set unassignedX to the next column after all grid columns.
    unassignedX = colX[columns - 1] + colWidths[columns - 1] + HORIZONTAL_GAP;
  } else {
    // ── Grouped: RF parent-node containers, one per group ────────────────
    // Each group becomes a 'groupContainer' RF parent node. Child cluster
    // nodes are positioned relative to the container's top-left corner.
    // Nodes that appear in multiple groups (e.g. role grouping) get distinct
    // RF node IDs: '<nodeId>__<containerId>'.
    const nodeGroups = calculateNodeGroups(clusterNodes, groupingConfig);
    let colX = 0;

    nodeGroups.forEach((groupNodes, groupKey) => {
      const sorted = sortClusterNodes(groupNodes);
      const label = getGroupLabel(groupKey, groupingConfig.attribute);
      const containerId = `group__${groupKey}`;

      // Compute the container's height from its children's estimated heights
      let totalContentHeight = 0;
      sorted.forEach((node, idx) => {
        const shards = shardsByNode[node.name] ?? shardsByNode[node.id] ?? [];
        totalContentHeight += estimatedGroupHeight(shards.length);
        if (idx < sorted.length - 1) totalContentHeight += CONTAINER_VERTICAL_GAP;
      });

      const containerWidth = GROUP_WIDTH + CONTAINER_PADDING_X * 2;
      const containerHeight =
        CONTAINER_PADDING_TOP + totalContentHeight + CONTAINER_PADDING_BOTTOM;

      // Emit the container parent node FIRST (RF requires parent before children)
      result.push({
        id: containerId,
        type: 'groupContainer',
        position: { x: colX, y: 0 },
        style: {
          width: containerWidth,
          height: containerHeight,
          // Render behind child cards
          zIndex: -1,
          // Container does not catch pointer events; clicks go to child cards
          pointerEvents: 'none',
        },
        data: { label } as unknown as Record<string, unknown>,
        draggable: false,
        selectable: false,
      });

      contentBottomY = Math.max(contentBottomY, containerHeight);

      // Emit children with positions relative to the container's top-left
      let childY = 0;
      sorted.forEach((node) => {
        const shards = shardsByNode[node.name] ?? shardsByNode[node.id] ?? [];
        emitGroupNode(
          result,
          node,
          { x: CONTAINER_PADDING_X, y: CONTAINER_PADDING_TOP + childY },
          shards,
          input,
          // No per-card group label — the container already shows the label
          undefined,
          { rfNodeId: `${node.id}__${containerId}`, parentId: containerId },
        );
        childY += estimatedGroupHeight(shards.length) + CONTAINER_VERTICAL_GAP;
      });

      colX += containerWidth + HORIZONTAL_GAP;
    });

    unassignedX = colX; // place unassigned after all group columns
  }

  // Emit synthetic Unassigned node if present in shardsByNode OR if a hint
  // count is provided (L0/L1 zoom where full shard data is not loaded yet).
  const unassigned = shardsByNode[UNASSIGNED_KEY];
  if ((unassigned?.length ?? 0) > 0 || (input.unassignedShardsHint ?? 0) > 0) {
    // Small typed placeholder for synthetic unassigned node to avoid `any`
    const uNode: Partial<NodeInfo> = {
      id: UNASSIGNED_KEY,
      name: 'Unassigned',
      roles: [],
      heapUsed: 0,
      heapMax: 0,
      diskUsed: 0,
    };
    // In no-grouping mode: place below the lowest node (middle column).
    // In grouped mode: contentBottomY is the tallest container height; place
    // the unassigned node after all groups on a new column.
    const ux = unassignedX;
    const maxY = contentBottomY > 0
      ? contentBottomY + VERTICAL_GAP
      : (result.length ? Math.max(...result.map((n) => (n.position?.y ?? 0))) + VERTICAL_GAP : 0);
    // For the synthetic Unassigned node, ensure it is not clickable to open a node modal
    // by clearing onNodeClick handler in the input for this emission.
    const safeInput = { ...input, onNodeClick: undefined } as CanvasLayoutInput;
    emitGroupNode(result, uNode as NodeInfo, { x: ux, y: maxY }, unassigned ?? [], safeInput, 'Unassigned');
  }

  return result;
}
