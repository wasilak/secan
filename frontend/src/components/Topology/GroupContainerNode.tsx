/**
 * GroupContainerNode — React Flow custom node type 'groupContainer'.
 *
 * Renders a labeled bordered container that visually groups cluster nodes
 * in the canvas topology view. This is the RF-native equivalent of
 * GroupRenderer (used in node view) — a parent node whose children are
 * positioned relative to its top-left corner.
 *
 * The container size is driven by layout constants set in canvasLayout.ts;
 * children are positioned inside it with relative coordinates.
 *
 * pointer-events are set to 'none' on the outer box so that clicks on the
 * canvas pass through to child nodes without interference.
 */
import { Text } from '@mantine/core';
import type { NodeProps } from '@xyflow/react';

export interface GroupContainerData extends Record<string, unknown> {
  label: string;
}

export function GroupContainerNode({ data }: NodeProps) {
  const label = (data as GroupContainerData).label ?? '';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        borderRadius: '10px',
        border: '1.5px solid var(--mantine-color-default-border)',
        backgroundColor: 'var(--mantine-color-body)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.06) inset',
        pointerEvents: 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Group label floats above the top border, matching GroupRenderer style */}
      <Text
        size="sm"
        fw={600}
        style={{
          position: 'absolute',
          top: '-12px',
          left: '16px',
          backgroundColor: 'var(--mantine-color-body)',
          padding: '0 8px',
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          zIndex: 1,
        }}
      >
        {label}
      </Text>
    </div>
  );
}
