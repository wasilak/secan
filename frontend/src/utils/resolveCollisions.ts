/**
 * Naive O(n²) node collision resolver.
 *
 * Adapted from the official React Flow node-collision-algorithms example:
 * https://reactflow.dev/examples/layout/node-collisions
 *
 * Works on any RF Node array. Uses node.measured.width/height (set by RF after
 * first render) so dimensions are always accurate.
 *
 * For <50 nodes this completes in <0.1ms — perfectly fine for our use case.
 */

import type { Node } from '@xyflow/react';

export interface ResolveCollisionsOptions {
  /** Max iterations before giving up. Default: Infinity */
  maxIterations?: number;
  /** Minimum overlap (px) before resolving. Default: 0.5 */
  overlapThreshold?: number;
  /** Extra gap to maintain between nodes (px). Default: 20 */
  margin?: number;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  moved: boolean;
  node: Node;
}

export function resolveCollisions(
  nodes: Node[],
  {
    maxIterations = Infinity,
    overlapThreshold = 0.5,
    margin = 20,
  }: ResolveCollisionsOptions = {},
): Node[] {
  if (nodes.length < 2) return nodes;

  // Build bounding boxes — use measured dimensions if available, fall back to
  // style.width/height, then a sensible default.
  const boxes: Box[] = nodes.map((node) => {
    const w =
      (node.measured?.width ?? (node.style?.width as number | undefined) ?? 280) +
      margin * 2;
    const h =
      (node.measured?.height ?? (node.style?.height as number | undefined) ?? 120) +
      margin * 2;
    return {
      x: node.position.x - margin,
      y: node.position.y - margin,
      width: w,
      height: h,
      moved: false,
      node,
    };
  });

  let iter = 0;
  while (iter <= maxIterations) {
    let moved = false;

    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const A = boxes[i];
        const B = boxes[j];

        const centerAX = A.x + A.width * 0.5;
        const centerAY = A.y + A.height * 0.5;
        const centerBX = B.x + B.width * 0.5;
        const centerBY = B.y + B.height * 0.5;

        const dx = centerAX - centerBX;
        const dy = centerAY - centerBY;

        const px = (A.width + B.width) * 0.5 - Math.abs(dx);
        const py = (A.height + B.height) * 0.5 - Math.abs(dy);

        if (px > overlapThreshold && py > overlapThreshold) {
          A.moved = B.moved = moved = true;

          if (px < py) {
            const sx = dx > 0 ? 1 : -1;
            const moveAmount = (px / 2) * sx;
            A.x += moveAmount;
            B.x -= moveAmount;
          } else {
            const sy = dy > 0 ? 1 : -1;
            const moveAmount = (py / 2) * sy;
            A.y += moveAmount;
            B.y -= moveAmount;
          }
        }
      }
    }

    iter++;
    if (!moved) break;
  }

  return boxes.map((box) =>
    box.moved
      ? { ...box.node, position: { x: box.x + margin, y: box.y + margin } }
      : box.node,
  );
}
