// dagreLayout utility for React Flow (vertical tree)
import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import { Position } from '@xyflow/react';
// Use GROUP_WIDTH from canvasLayout so Dagre spacing matches actual node widths
import { GROUP_WIDTH, ESTIMATED_GROUP_HEIGHT, HORIZONTAL_GAP, VERTICAL_GAP } from './canvasLayout';

// Direction: "TB" = top-bottom (vertical)
export type DagreDirection = 'TB' | 'LR';

const nodeWidth = GROUP_WIDTH;     // align with canvas GROUP_WIDTH
const nodeHeight = ESTIMATED_GROUP_HEIGHT;    // fallback estimated group height

export function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: DagreDirection = 'TB',
): { nodes: Node[]; edges: Edge[] } {
  // Create a fresh dagre graph for every layout call to avoid stale state
  // when applyDagreLayout is called multiple times during the app lifecycle.
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

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
      width: (node.width as number) || (node.data as any)?.width || nodeWidth,
      height: (node.height as number) || (node.data as any)?.height || nodeHeight,
    });
  });

  edges.forEach((edge) => {
    try {
      dagreGraph.setEdge(edge.source, edge.target);
    } catch (e) {
      // Ignore malformed/duplicate edges — Dagre will still layout nodes.
      // Keep this defensive to avoid runtime exceptions from external data.
      // eslint-disable-next-line no-console
      console.debug('applyDagreLayout: skipped edge', edge, e);
    }
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
    // If Dagre didn't produce coordinates for this node, preserve existing position
    return { ...node, position: node.position };
  });

  return { nodes: layoutedNodes, edges };
}
