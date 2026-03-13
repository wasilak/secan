import { useEffect, useState, useRef } from 'react';
import { ShardInfo } from '../../types/api';

interface RelocatingShardOverlayProps {
  shards: ShardInfo[];
  hoveredShard: ShardInfo | null;
  containerRef: React.RefObject<HTMLElement>;
}

interface NodePosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * RelocatingShardOverlay Component
 * 
 * Renders an SVG overlay showing curved lines connecting source and destination nodes
 * for relocating shards when hovered.
 * 
 * Requirements: 3.5
 * - Shows curved line connecting source and destination nodes on hover
 */
export function RelocatingShardOverlay({
  shards,
  hoveredShard,
  containerRef,
}: RelocatingShardOverlayProps) {
  const [nodePositions, setNodePositions] = useState<Map<string, NodePosition>>(new Map());
  const [containerDimensions, setContainerDimensions] = useState<{ width: number; height: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Update node positions when layout changes
  useEffect(() => {
    if (!containerRef.current) return;

    const updatePositions = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const positions = new Map<string, NodePosition>();

      // Store container dimensions for SVG viewBox
      setContainerDimensions({
        width: containerRect.width,
        height: containerRect.height,
      });

      // Find all node cards by their data-node-id attribute
      const nodeCards = container.querySelectorAll('[data-node-id]');
      nodeCards.forEach((card) => {
        const nodeId = card.getAttribute('data-node-id');
        if (!nodeId) return;

        const rect = card.getBoundingClientRect();
        positions.set(nodeId, {
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top + rect.height / 2,
          width: rect.width,
          height: rect.height,
        });
      });

      setNodePositions(positions);
    };

    // Update positions on mount and when window resizes
    updatePositions();
    window.addEventListener('resize', updatePositions);
    window.addEventListener('scroll', updatePositions);

    // Use ResizeObserver to detect layout changes
    const resizeObserver = new ResizeObserver(updatePositions);
    const container = containerRef.current;
    if (container) {
      resizeObserver.observe(container);
    }

    return () => {
      window.removeEventListener('resize', updatePositions);
      window.removeEventListener('scroll', updatePositions);
      resizeObserver.disconnect();
    };
  }, [containerRef, shards]);

  // Don't render if no hovered shard or if it's not relocating
  if (!hoveredShard || hoveredShard.state !== 'RELOCATING' || !hoveredShard.relocatingNode) {
    return null;
  }

  const sourceNode = hoveredShard.node;
  const destNode = hoveredShard.relocatingNode;

  if (!sourceNode || !destNode) {
    return null;
  }

  const sourcePos = nodePositions.get(sourceNode);
  const destPos = nodePositions.get(destNode);

  if (!sourcePos || !destPos) {
    return null;
  }

  // Calculate curved path between source and destination
  const generateCurvedPath = (
    x1: number,
    y1: number,
    x2: number,
    y2: number
  ): string => {
    // Calculate control points for a smooth curve
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Control point offset (creates the curve)
    const offset = distance * 0.3;
    
    // Perpendicular direction for curve
    const perpX = -dy / distance;
    const perpY = dx / distance;
    
    // Control point in the middle, offset perpendicular to the line
    const cx = (x1 + x2) / 2 + perpX * offset;
    const cy = (y1 + y2) / 2 + perpY * offset;
    
    return `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  };

  const path = generateCurvedPath(sourcePos.x, sourcePos.y, destPos.x, destPos.y);

  // Don't render if container dimensions not yet calculated
  if (!containerDimensions) return null;

  return (
    <svg
      ref={svgRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 1000,
      }}
      viewBox={`0 0 ${containerDimensions.width} ${containerDimensions.height}`}
    >
      {/* Curved line connecting source and destination */}
      <path
        d={path}
        stroke="var(--mantine-color-yellow-6)"
        strokeWidth="3"
        fill="none"
        strokeDasharray="8 4"
        opacity="0.8"
      />
      
      {/* Arrow marker at destination */}
      <defs>
        <marker
          id="arrowhead"
          markerWidth="10"
          markerHeight="10"
          refX="9"
          refY="3"
          orient="auto"
        >
          <polygon
            points="0 0, 10 3, 0 6"
            fill="var(--mantine-color-yellow-6)"
          />
        </marker>
      </defs>
      
      <path
        d={path}
        stroke="var(--mantine-color-yellow-6)"
        strokeWidth="3"
        fill="none"
        markerEnd="url(#arrowhead)"
        opacity="0"
      />
      
      {/* Source node indicator */}
      <circle
        cx={sourcePos.x}
        cy={sourcePos.y}
        r="8"
        fill="var(--mantine-color-yellow-6)"
        opacity="0.6"
      />
      
      {/* Destination node indicator */}
      <circle
        cx={destPos.x}
        cy={destPos.y}
        r="8"
        fill="var(--mantine-color-yellow-6)"
        opacity="0.6"
        strokeDasharray="4 2"
        stroke="var(--mantine-color-yellow-8)"
        strokeWidth="2"
      />
    </svg>
  );
}
