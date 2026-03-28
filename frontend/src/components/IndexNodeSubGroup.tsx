import { memo } from 'react';
import { Text } from '@mantine/core';
import { type NodeProps } from '@xyflow/react';

/**
 * Data interface for IndexNodeSubGroup.
 *
 * Requirements: 3.2, 3.4
 */
export interface IndexNodeSubGroupData extends Record<string, unknown> {
  nodeName: string;
}

/**
 * IndexNodeSubGroup — RF group-node that acts as a labelled background box
 * for one Elasticsearch cluster node's shards within the index visualisation.
 *
 * The box fills its full RF dimensions (set statically by the layout function).
 * Shard child nodes are placed inside by RF.
 *
 * Requirements: 3.2, 3.4
 */
function IndexNodeSubGroupComponent({ data }: NodeProps & { data: IndexNodeSubGroupData }) {
  const { nodeName } = data;

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        boxSizing: 'border-box',
        padding: '4px 6px',
        borderRadius: 'var(--mantine-radius-xs)',
        border: '1px solid var(--mantine-color-gray-3)',
        backgroundColor: 'var(--mantine-color-default)',
      }}
    >
      <Text
        size="xs"
        fw={600}
        lineClamp={1}
        style={{ userSelect: 'none' }}
      >
        {nodeName}
      </Text>
    </div>
  );
}

export const IndexNodeSubGroup = memo(IndexNodeSubGroupComponent);
