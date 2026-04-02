import React, { memo } from 'react';
import type { ShardInfo } from '../types/api';
import ClusterESNodeCard from '../components/ClusterESNodeCard';
import ShardGridCanvas from './ShardGridCanvas';
import type { ClusterGroupNodeDataFlat } from '../utils/canvasLayout';
import TOPOLOGY_CONFIG from '../config/topologyConfig';
import { getShardDotColor, getUnassignedShardColor, getShardBorderColor } from '../utils/colors';

export type LOD = 'L0' | 'L1' | 'L2';

interface NodeProps {
  nodeId: string;
  mode: LOD;
  minimalData?: { id: string; name: string; summaryCounts?: { total: number } };
  detailData?: Record<string, unknown> | undefined; // node metadata
  shards?: ShardInfo[];
  onShardClick?: (s: ShardInfo, e?: React.MouseEvent) => void;
}

function NodeComponent({ nodeId, mode, minimalData, detailData, shards = [], onShardClick }: NodeProps) {
  // L0: compact glyph
  if (mode === 'L0') {
    return (
      <div style={{ width: 140, padding: 6, boxSizing: 'border-box', textAlign: 'left' }}>
        <div style={{ fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{minimalData?.name ?? nodeId}</div>
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--mantine-color-gray-5)' }}>{minimalData?.summaryCounts?.total ?? ''} shards</div>
      </div>
    );
  }

  // For L1 and L2 we reuse ClusterESNodeCard for consistent visuals; pass isLoading false.
  const cardProps = {
    id: detailData?.id ?? minimalData?.id ?? nodeId,
    name: detailData?.name ?? minimalData?.name ?? nodeId,
    version: detailData?.version,
    roles: detailData?.roles ?? [],
    isMaster: detailData?.isMaster ?? false,
    isMasterEligible: detailData?.isMasterEligible ?? false,
    ip: detailData?.ip,
    heapPercent: detailData?.heapPercent ?? 0,
    heapColor: detailData?.heapColor ?? 'dimmed',
    cpuPercent: detailData?.cpuPercent,
    cpuColor: detailData?.cpuColor ?? 'dimmed',
    diskUsed: detailData?.diskUsed ?? 0,
    diskDisplay: detailData?.diskDisplay ?? '',
    load5m: detailData?.load5m,
    loadColor: detailData?.loadColor ?? 'dimmed',
    groupLabel: detailData?.groupLabel,
    isValidDestination: detailData?.isValidDestination ?? false,
    summaryCounts: detailData?.summaryCounts ?? minimalData?.summaryCounts ?? { primary: 0, replica: 0, total: shards.length },
    badges: detailData?.badges ?? [],
    dots: [],
    onNodeClick: undefined,
    onDestinationClick: undefined,
    onShardClick: onShardClick,
    renderDots: false,
  } as unknown as ClusterGroupNodeDataFlat;

  return (
    <div style={{ minWidth: TOPOLOGY_CONFIG.GROUP_WIDTH }}>
      <ClusterESNodeCard {...cardProps} />
      {mode === 'L2' && shards && shards.length > 0 && (
        <div style={{ padding: '6px 12px' }}>
              {shards.length > 200 ? (
            <ShardGridCanvas shards={shards} onShardClick={onShardClick} />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fill, ${TOPOLOGY_CONFIG.SHARD_SIZE}px)`, gap: TOPOLOGY_CONFIG.SHARD_GAP }}>
              {shards.map((s, i) => {
                const bg = s.state === 'UNASSIGNED' ? getUnassignedShardColor(Boolean(s.primary)) : getShardDotColor(s.state);
                const border = getShardBorderColor(s.state);
                return (
                  <div
                    key={i}
                    onClick={(e) => onShardClick?.(s, e)}
                    style={{
                      width: TOPOLOGY_CONFIG.SHARD_SIZE,
                      height: TOPOLOGY_CONFIG.SHARD_SIZE,
                      backgroundColor: bg,
                      border: border && border !== 'transparent' ? `1px solid ${border}` : 'none',
                      borderRadius: 2,
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export const Node = memo(NodeComponent);
export default Node;
