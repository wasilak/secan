// dagreLayout utility for React Flow (vertical tree)
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';
// Use GROUP_WIDTH from canvasLayout so Dagre spacing matches actual node widths
import { GROUP_WIDTH, ESTIMATED_GROUP_HEIGHT, HORIZONTAL_GAP, VERTICAL_GAP } from './canvasLayout';

// Direction: "TB" = top-bottom (vertical)
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = GROUP_WIDTH;     // align with canvas GROUP_WIDTH
const nodeHeight = ESTIMATED_GROUP_HEIGHT;    // fallback estimated group height

export type DagreDirection = 'TB' | 'LR';

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: DagreDirection = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  // Prepare dagre nodes and edges. Use canvas layout gaps so dagre spacing
  // matches the rest of the UI. nodesep controls horizontal separation between
  // nodes in the same rank; ranksep controls vertical separation between ranks.
  dagreGraph.setGraph({
    rankdir: direction,
    nodesep: HORIZONTAL_GAP,
    ranksep: VERTICAL_GAP,
  });

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
    const coord = dagreGraph.node(node.id) as ({ x: number; y: number; width?: number; height?: number } | undefined);
    if (coord) {
      const usedWidth = (coord.width as number) || (node.width as number) || nodeWidth;
      const usedHeight = (coord.height as number) || (node.height as number) || nodeHeight;
      return {
        ...node,
        position: { x: coord.x - usedWidth / 2, y: coord.y - usedHeight / 2 },
        sourcePosition: direction === 'TB' ? Position.Bottom : Position.Right,
        targetPosition: direction === 'TB' ? Position.Top : Position.Left,
      };
    }
    return { ...node, position: node.position };
  });

  return { nodes: layoutedNodes, edges };
}
