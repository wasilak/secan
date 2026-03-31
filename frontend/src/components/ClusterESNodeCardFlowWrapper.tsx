import { Handle, Position } from '@xyflow/react';
import ClusterESNodeCard from './ClusterESNodeCard';
import type { ClusterGroupNodeDataFlat } from '../utils/canvasLayout';
import { computeHeapPercent, getHeapColor } from '../utils/heap';
import { formatBytes } from '../utils/formatters';
import { UNASSIGNED_KEY } from '../utils/canvasLayout';
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
    const nodeInfo = data['node'] as Partial<NodeInfo>;
    const shards = Array.isArray(data['shards']) ? (data['shards'] as ShardInfo[]) : [];

    const primaryCount = shards.filter((s) => s.primary).length;
    const replicaCount = shards.filter((s) => !s.primary).length;
    const totalShards = shards.length;

    const heapPercent = computeHeapPercent(nodeInfo.heapUsed as number | undefined, nodeInfo.heapMax as number | undefined);
    const heapColor = getHeapColor(heapPercent);
    const cpuPercent = nodeInfo.cpuPercent ?? undefined;
    const cpuColor = cpuPercent === undefined ? 'dimmed' : cpuPercent < 70 ? 'green' : cpuPercent < 85 ? 'yellow' : 'red';
    const load1m = (nodeInfo.loadAverage && nodeInfo.loadAverage.length > 0) ? nodeInfo.loadAverage[0] : undefined;
    const loadColor = load1m === undefined ? 'dimmed' : load1m < 4 ? 'green' : load1m < 6 ? 'yellow' : 'red';
    const diskDisplay = formatBytes((nodeInfo.diskUsed as number) ?? 0);

    const getIndexHealthColor = (data['getIndexHealthColor'] as ((indexName: string) => string) | undefined) ?? (() => 'var(--mantine-color-gray-6)');

    const badges = [{ label: `${totalShards} shards` } as { label: string }];
    if (primaryCount > 0) badges.push({ label: `${primaryCount} primary` });
    if (replicaCount > 0) badges.push({ label: `${replicaCount} replica` });

    const dots = shards.map((shard) => ({
      color: getIndexHealthColor(shard.index),
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
    }));

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
      // Allow node click handler when provided by layout/data
      onNodeClick: (data['onNodeClick'] as ((id: string) => void) | undefined) ?? undefined,
      onDestinationClick: undefined,
      onShardClick: (data['onShardClick'] as ((s: ShardInfo, e?: React.MouseEvent) => void) | undefined) ?? undefined,
      renderDots: true,
      isUnassigned,
    };

    // Debug: log presence of handlers in the normalized flat data
     
    console.debug('ClusterESNodeCardFlowWrapper flat has onNodeClick?', !!flat.onNodeClick, 'id', flat.id);

    return (
      <div className="secan-rf-node-contains-card" style={{ position: 'relative', display: 'inline-block', pointerEvents: 'auto' }}>
        <Handle type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', top: -6 }} />
        {/* In RF contexts we want the RF node to render the border, so hide inner card border */}
        <ClusterESNodeCard {...flat} hideInnerBorder isLoading={Boolean((data as unknown as { isLoading?: boolean }).isLoading)} />
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
        <ClusterESNodeCard {...(data as unknown as ClusterGroupNodeDataFlat)} hideInnerBorder isLoading={Boolean((data as unknown as { isLoading?: boolean }).isLoading)} />
        <Handle type="source" position={Position.Bottom} />
      </div>
    );
    }
    throw new Error('ClusterESNodeCardFlowWrapper data missing summaryCounts');
  }

  return (
    <div className="secan-rf-node-contains-card" style={{ position: 'relative', display: 'inline-block', pointerEvents: 'auto' }}>
      <Handle type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', top: -6 }} />
      <ClusterESNodeCard {...(data as unknown as ClusterGroupNodeDataFlat)} hideInnerBorder isLoading={Boolean((data as unknown as { isLoading?: boolean }).isLoading)} />
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', transform: 'translateX(-50%)', bottom: -6 }} />
    </div>
  );
}

export default ClusterESNodeCardFlowWrapper;
