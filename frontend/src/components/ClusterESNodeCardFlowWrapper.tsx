import { Handle, Position } from '@xyflow/react';
import ClusterESNodeCard from './ClusterESNodeCard';
import type { ClusterGroupNodeDataFlat } from '../utils/canvasLayout';
import { computeHeapPercent, getHeapColor } from '../utils/heap';
import { formatBytes } from '../utils/formatters';
import { UNASSIGNED_KEY } from '../utils/canvasLayout';
import { getUnassignedShardColor, getShardDotColor } from '../utils/colors';
import type { ShardInfo, NodeInfo } from '../types/api';

export function ClusterESNodeCardFlowWrapper(props: { data: ClusterGroupNodeDataFlat }) {
  const data = props.data as unknown as Record<string, unknown> | null;
  if (!data) {
     
    console.error('ClusterESNodeCardFlowWrapper received no data', props);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('ClusterESNodeCardFlowWrapper received no data');
    }
    return <></>;
  }

  // Compatibility: index visualization emits { node, shards, onShardClick, getIndexHealthColor }
  // Normalize that shape into ClusterGroupNodeDataFlat so ClusterESNodeCard always receives the flat props.
  if ('node' in data && 'shards' in data) {
    // Merge node info from explicit `node` field with any raw payload that
    // tile sources may attach as `__raw`. Some tile payloads intentionally
    // include only a subset of node fields to reduce payload size; the full
    // details may still be present on __raw. Merge so we prefer explicit
    // `node` fields but fall back to raw values when missing.
    const rawNode = (data['__raw'] as Partial<NodeInfo>) ?? undefined;
    const explicitNode = (data['node'] as Partial<NodeInfo>) ?? undefined;
    // Helper: merge objects but do not overwrite existing values with `undefined`.
    const mergePreferDefined = (...objs: Array<Record<string, unknown> | undefined>) => {
      const out: Record<string, unknown> = {};
      for (const obj of objs) {
        if (!obj) continue;
        Object.keys(obj).forEach((k) => {
          const v = (obj as Record<string, unknown>)[k];
          if (v !== undefined) out[k] = v;
        });
      }
      return out as Partial<NodeInfo>;
    };
    // Precedence: rawNode overrides nothing, explicitNode overrides raw, but
    // do not replace defined values with undefined. Merge order: raw <- explicit
    const nodeInfo = mergePreferDefined(rawNode, explicitNode) as Partial<NodeInfo>;
    const providedShards = Array.isArray(data['shards']) ? (data['shards'] as ShardInfo[]) : undefined;
    const providedSummary = (data['summaryCounts'] as { primary?: number; replica?: number; total?: number } | undefined) ?? undefined;

    // Decide what to show: prefer explicit shards array (detailed). If absent,
    // but summaryCounts present, show totals (badges) without dots. If neither
    // present, fall back to zeros.
    let shards: ShardInfo[] = [];
    let primaryCount: number;
    let replicaCount: number;
    let totalShards: number;
    let showDots: boolean;

    if (providedShards && providedShards.length > 0) {
      shards = providedShards;
      primaryCount = shards.filter((s) => s.primary).length;
      replicaCount = shards.filter((s) => !s.primary).length;
      totalShards = shards.length;
      showDots = true;
    } else if (providedSummary) {
      primaryCount = providedSummary.primary ?? 0;
      replicaCount = providedSummary.replica ?? 0;
      totalShards = providedSummary.total ?? (primaryCount + replicaCount);
      showDots = false;
    } else {
      primaryCount = 0;
      replicaCount = 0;
      totalShards = 0;
      showDots = false;
    }

    const heapPercent = computeHeapPercent(nodeInfo.heapUsed as number | undefined, nodeInfo.heapMax as number | undefined);
    const heapColor = getHeapColor(heapPercent);
    const cpuPercent = nodeInfo.cpuPercent ?? undefined;
    const cpuColor = cpuPercent === undefined ? 'dimmed' : cpuPercent < 70 ? 'green' : cpuPercent < 85 ? 'yellow' : 'red';
    const load1m = (nodeInfo.loadAverage && nodeInfo.loadAverage.length > 0) ? nodeInfo.loadAverage[0] : undefined;
    const loadColor = load1m === undefined ? 'dimmed' : load1m < 4 ? 'green' : load1m < 6 ? 'yellow' : 'red';
    const diskDisplay = formatBytes((nodeInfo.diskUsed as number) ?? 0);

    // Index health helper may be provided by layout; not required here because
    // we use shard state-based coloring (getShardDotColor / getUnassignedShardColor).

    const badges = [{ label: `${totalShards} shards` } as { label: string }];
    if (primaryCount > 0) badges.push({ label: `${primaryCount} primary` });
    if (replicaCount > 0) badges.push({ label: `${replicaCount} replica` });

    const dots = showDots ? shards.map((shard) => ({
      // Use shard state based coloring: UNASSIGNED distinguishes primary/replica,
      // otherwise use the shard state color helper (STARTED, INITIALIZING, RELOCATING).
      color: shard.state === 'UNASSIGNED' ? getUnassignedShardColor(Boolean(shard.primary)) : getShardDotColor(shard.state),
      tooltip: (
        <div>
          <div>
            Index: <span style={{ textTransform: 'none' }}>{shard.index}</span>
          </div>
          <div>
            Shard: <span style={{ textTransform: 'none' }}>{shard.shard}</span>
          </div>
          <div>Type: {shard.primary ? 'Primary' : 'Replica'}</div>
          <div>State: {shard.state}</div>
        </div>
      ),
      primary: shard.primary,
      shard,
    })) : [];

    const isUnassigned = nodeInfo.id === UNASSIGNED_KEY || nodeInfo.name === 'Unassigned';

    const flat: ClusterGroupNodeDataFlat = {
      id: nodeInfo.id ?? `node__${nodeInfo.name ?? 'unknown'}`,
      name: nodeInfo.name ?? nodeInfo.id ?? 'unknown',
      version: nodeInfo.version,
      roles: nodeInfo.roles ?? [],
      isMaster: !!nodeInfo.isMaster,
      isMasterEligible: !!nodeInfo.isMasterEligible,
      ip: nodeInfo.ip,
      heapPercent,
      heapColor,
      cpuPercent,
      cpuColor,
      diskUsed: (nodeInfo.diskUsed as number) ?? 0,
      diskDisplay,
      load1m,
      loadColor,
      groupLabel: undefined,
      isValidDestination: false,
      summaryCounts: { primary: primaryCount, replica: replicaCount, total: totalShards },
      badges,
      dots,
      suppressShardSummary: totalShards === 0 && !showDots,
      // Allow node click handler when provided by layout/data
      onNodeClick: (data['onNodeClick'] as ((id: string) => void) | undefined) ?? undefined,
      onDestinationClick: (data['onDestinationClick'] as ((id: string) => void) | undefined) ?? undefined,
      onShardClick: (data['onShardClick'] as ((s: ShardInfo, e?: React.MouseEvent) => void) | undefined) ?? undefined,
      renderDots: showDots,
      isUnassigned,
    };

    // Debug: log presence of handlers in the normalized flat data
     
    console.debug('ClusterESNodeCardFlowWrapper flat has onNodeClick?', !!flat.onNodeClick, 'id', flat.id);

    return (
      <div className="secan-rf-node-contains-card" style={{ position: 'relative', display: 'inline-block', pointerEvents: 'auto' }}>
        <Handle type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', top: -6 }} />
        {/* Inner card should render the visible border. Avoid hiding the card's
            border so there is a single source of truth for node outline. */}
        <ClusterESNodeCard {...flat} isLoading={Boolean((data as unknown as { isLoading?: boolean }).isLoading)} />
        <Handle type="source" position={Position.Bottom} style={{ left: '50%', transform: 'translateX(-50%)', bottom: -6 }} />
      </div>
    );
  }

  // Validate summaryCounts presence at the wrapper boundary to fail early
  if (!('summaryCounts' in data) || !data.summaryCounts) {
     
    console.error('ClusterESNodeCardFlowWrapper data missing summaryCounts', data);
    if (process.env.NODE_ENV !== 'development') {
      // In production, defer to inner component's fallback UI
    return (
      <div className="secan-rf-node-contains-card">
        <Handle type="target" position={Position.Top} />
        <ClusterESNodeCard {...(data as unknown as ClusterGroupNodeDataFlat)} isLoading={Boolean((data as unknown as { isLoading?: boolean }).isLoading)} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
    }
    throw new Error('ClusterESNodeCardFlowWrapper data missing summaryCounts');
  }

  return (
    <div className="secan-rf-node-contains-card" style={{ position: 'relative', display: 'inline-block', pointerEvents: 'auto' }}>
      <Handle type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', top: -6 }} />
      <ClusterESNodeCard {...(data as unknown as ClusterGroupNodeDataFlat)} isLoading={Boolean((data as unknown as { isLoading?: boolean }).isLoading)} />
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', transform: 'translateX(-50%)', bottom: -6 }} />
    </div>
  );
}

export default ClusterESNodeCardFlowWrapper;
