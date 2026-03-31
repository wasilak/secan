import React, { useRef, useEffect } from 'react';
import type { ShardInfo } from '../types/api';

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
      ctx.fillStyle = s.state === 'UNASSIGNED' ? '#666' : '#2ecc71';
      ctx.fillRect(x, y, size, size);
    });
  }, [shards]);

  // Simple fixed dimensions; caller can wrap with responsive layout if needed
  return <canvas ref={ref} width={600} height={200} style={{ width: '100%', height: 'auto' }} />;
}
