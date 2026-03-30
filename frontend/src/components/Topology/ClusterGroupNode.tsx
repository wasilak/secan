import { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import type { ClusterGroupNodeDataFlat } from '../../utils/canvasLayout';
import ClusterESNodeCard from '../ClusterESNodeCard';

// Debug: ensure this module loads in runtime builds
 
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

function ClusterGroupNodeComponent({ data, selected }: NodeProps & { data: ClusterGroupNodeDataFlat }) {
  if (!data) {
    // Defensive: avoid throwing during render when ReactFlow passes an unexpected node
     
    console.error('ClusterGroupNode rendered without data prop', { selected, data });
    return (
      <div style={{ padding: 8, border: '1px dashed red', background: 'rgba(255,0,0,0.04)' }}>
        Invalid node data
      </div>
    );
  }

  // Assert that required fields are present. Missing summaryCounts indicates a bug
  if (!('summaryCounts' in data) || !data.summaryCounts) {
     
    console.error('ClusterGroupNode data missing summaryCounts', data);
    if (process.env.NODE_ENV !== 'production') {
      throw new Error('ClusterGroupNode data missing summaryCounts');
    }
    // In production, render ClusterESNodeCard which will itself render a lightweight fallback
  }

  // Delegate visual rendering to the extracted mantine-only component
  // so we can reuse it across non-RF and RF contexts.
  return <ClusterESNodeCard {...data} selected={selected} />;
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
  // onShardClick affects behavior (context menu vs modal). Include in memo check.
  if (pd.onShardClick !== nd.onShardClick) return false;
  if (prev.selected !== next.selected) return false;
  return true;
}

export const ClusterGroupNode = memo(ClusterGroupNodeComponent, arePropsEqual);
