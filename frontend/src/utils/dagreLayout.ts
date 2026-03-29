// dagreLayout utility for React Flow (vertical tree)
import dagre from '@dagrejs/dagre';
import type { Node, Edge, XYPosition } from '@xyflow/react';
import { Position } from '@xyflow/react';

// Direction: "TB" = top-bottom (vertical)
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 310;     // Typical card width (adjust as needed)
const nodeHeight = 120;    // Height per ESNodeCard (adjust as needed)

export type DagreDirection = 'TB' | 'LR';

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: DagreDirection = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  // Prepare dagre nodes and edges
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: (node.width as number) || nodeWidth,
      height: (node.height as number) || nodeHeight,
    });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  // Update node positions with dagre-generated coords
  const layoutedNodes = nodes.map((node) => {
    const coord = dagreGraph.node(node.id) as XYPosition | undefined;
    return {
      ...node,
      position: coord
        ? { x: coord.x - nodeWidth / 2, y: coord.y - nodeHeight / 2 }
        : node.position,
      // prevents React Flow from re-auto-positioning
      sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
      targetPosition: direction === 'TB' ? Position.Top : Position.Left,
    };
  });

  return { nodes: layoutedNodes, edges };
}
