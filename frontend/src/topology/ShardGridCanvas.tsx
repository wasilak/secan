import React, { useRef, useEffect } from 'react';
import type { ShardInfo } from '../types/api';
import { getShardDotColor, getUnassignedShardColor, getShardBorderColor } from '../utils/colors';

export default function ShardGridCanvas({ shards, onShardClick: _onShardClick }: { shards: ShardInfo[]; onShardClick?: (s: ShardInfo, e?: React.MouseEvent) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const size = 8;
    const gap = 2;
    const cols = Math.floor(c.width / (size + gap)) || 1;
    ctx.clearRect(0, 0, c.width, c.height);
    shards.forEach((s, i) => {
      const x = (i % cols) * (size + gap);
      const y = Math.floor(i / cols) * (size + gap);
      // Use centralized shard color helpers for consistent coloring across views
      if (s.state === 'UNASSIGNED') {
        ctx.fillStyle = getUnassignedShardColor(Boolean(s.primary));
      } else {
        ctx.fillStyle = getShardDotColor(s.state);
      }
      ctx.fillRect(x, y, size, size);
      // Optional border for better separation
      const border = getShardBorderColor(s.state);
      if (border && border !== 'transparent') {
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, size - 1, size - 1);
      }
    });
  }, [shards]);

  // Simple fixed dimensions; caller can wrap with responsive layout if needed
  return <canvas ref={ref} width={600} height={200} style={{ width: '100%', height: 'auto' }} />;
}
