import { Handle, Position, useStore } from '@xyflow/react';
import ClusterESNodeCard from './ClusterESNodeCard';
import ShardPills from './ShardPills';
import type { ClusterGroupNodeDataFlat } from '../utils/canvasLayout';

export function ClusterESNodeCardFlowWrapper(props: { data: ClusterGroupNodeDataFlat }) {
  // useStore must be called unconditionally before any early returns (React hooks rule).
  // L0: compact glyph at zoom ≤ 0.35 (matches TopologyController L0 threshold).
  const isL0 = useStore((s) => s.transform[2] <= 0.35);
  const data = props.data as unknown as Record<string, unknown> | null;
  if (!data) {
     
    console.error('ClusterESNodeCardFlowWrapper received no data', props);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('ClusterESNodeCardFlowWrapper received no data');
    }
    return <></>;
  }

  // L0: compact glyph — name + shard pills footer, no inner borders.
  // Avoids rendering the full card at very low zoom levels.
  if (isL0) {
    const counts = data['summaryCounts'] as { primary?: number; replica?: number; total?: number } | undefined;
    const total = counts?.total ?? 0;
    const primary = counts?.primary;
    const replica = counts?.replica;
    const name =
      (data['name'] as string | undefined) ??
      ((data['node'] as { name?: string } | undefined)?.name) ??
      '...';
    return (
      <div style={{
        width: 200,
        padding: '8px 10px',
        boxSizing: 'border-box',
        borderRadius: 8,
        backgroundColor: 'var(--mantine-color-body)',
        border: '1px solid var(--mantine-color-default-border)',
      }}>
        <Handle type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', top: -6 }} />
        <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 6 }}>{name}</div>
        <ShardPills total={total} primary={primary} replica={replica} size="xs" />
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
