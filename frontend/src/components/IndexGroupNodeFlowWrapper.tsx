import React, { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { IndexGroupNode } from './IndexGroupNode';
import type { IndexGroupNodeData } from './IndexGroupNode';

type RFIndexNode = Node<IndexGroupNodeData, 'indexGroup'>;

function IndexGroupNodeFlowWrapperComponent(props: NodeProps<RFIndexNode>) {
  const data = props.data as IndexGroupNodeData | undefined;
  if (!data) return null;

  return (
    <div className="secan-rf-node-contains-card" style={{ position: 'relative', display: 'inline-block' }}>
      <Handle type="target" position={Position.Top} style={{ left: '50%', transform: 'translateX(-50%)', top: -6 }} />
      <IndexGroupNode data={data} />
      <Handle type="source" position={Position.Bottom} style={{ left: '50%', transform: 'translateX(-50%)', bottom: -6 }} />
    </div>
  );
}

export const IndexGroupNodeFlowWrapper = memo(IndexGroupNodeFlowWrapperComponent);
export default IndexGroupNodeFlowWrapper;
