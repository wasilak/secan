import { Box, Text } from '@mantine/core';
import type { ReactNode } from 'react';

/**
 * Props for the GroupRenderer component
 * 
 * **Validates: Requirements 3.1, 3.2, 3.5**
 */
export interface GroupRendererProps {
  /** Unique identifier for the group */
  groupKey: string;
  /** Display label for the group */
  groupLabel: string;
  /** Array of nodes in this group (used for metadata/future features) */
  nodes: unknown[];
  /** Rendered node components to display within the group */
  children: ReactNode;
}

/**
 * GroupRenderer component renders a bordered container with a label for grouped nodes
 * in the topology view.
 * 
 * This component wraps groups of nodes with a visual border and displays a label
 * at the top-left corner. It uses Mantine theme variables for consistent styling
 * across light and dark modes.
 * 
 * **Validates: Requirements 3.1, 3.2, 3.5**
 * 
 * @example
 * ```tsx
 * <GroupRenderer
 *   groupKey="data-nodes"
 *   groupLabel="Data Nodes"
 *   nodes={dataNodes}
 * >
 *   {dataNodes.map(node => <ESNodeCard key={node.id} node={node} />)}
 * </GroupRenderer>
 * ```
 */
export function GroupRenderer({
  groupKey,
  groupLabel,
  nodes,
  children,
}: GroupRendererProps) {
  return (
    <Box
      data-group-key={groupKey}
      data-node-count={nodes.length}
      style={{
        position: 'relative',
        // Don't draw a heavy outer border here — let the inner node card
        // render its own border in Node View. Use subtle background and
        // padding to group nodes visually and avoid 2px seam artifacts.
        border: 'none',
        borderRadius: '8px',
        padding: '16px',
        marginBottom: '16px',
        backgroundColor: 'var(--mantine-color-body)',
        boxShadow: '0 1px 0 rgba(0,0,0,0.02) inset',
        overflow: 'visible',
      }}
    >
      {/* Group label positioned at top-left of border */}
      <Text
        size="sm"
        fw={600}
        style={{
          position: 'absolute',
          top: '-12px',
          left: '16px',
          backgroundColor: 'var(--mantine-color-body)',
          padding: '0 8px',
        }}
      >
        {groupLabel}
      </Text>

      {/* Rendered nodes */}
      {children}
    </Box>
  );
}
