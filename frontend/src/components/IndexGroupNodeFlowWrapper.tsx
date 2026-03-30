import { Handle, Position } from '@xyflow/react';
import IndexGroupNode, { IndexGroupNodeData } from './IndexGroupNode';

export function IndexGroupNodeFlowWrapper(props: { data: IndexGroupNodeData }) {
  const data = props.data as IndexGroupNodeData | null;
  if (!data) return null;

  return (
    <div className="secan-rf-node-contains-card">
      <Handle type="target" position={Position.Top} />
      <IndexGroupNode data={data} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

export default IndexGroupNodeFlowWrapper;
