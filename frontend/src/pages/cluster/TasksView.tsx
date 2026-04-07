import type { ReactElement } from 'react';
import { TasksTab } from '../../components/TasksTab';

interface TasksViewProps {
  clusterId: string;
  // Optional prebuilt map from node id (or name) -> display name. When provided
  // TasksTab will use this instead of fetching nodes itself. This avoids
  // duplicate network calls when the surrounding ClusterView already loaded
  // node data.
  nodeNameMap?: Record<string, string>;
}

export function TasksView({
  clusterId,
  openNodeModal,
  nodeNameMap,
}: TasksViewProps & { openNodeModal?: (nodeId: string) => void }): ReactElement {
  return <TasksTab clusterId={clusterId} isActive nodeNameMap={nodeNameMap} openNodeModal={openNodeModal} />;
}
