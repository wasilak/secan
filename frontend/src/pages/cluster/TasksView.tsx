import type { ReactElement } from 'react';
import { TasksTab } from '../../components/TasksTab';

interface TasksViewProps {
  clusterId: string;
}

export function TasksView({ clusterId }: TasksViewProps): ReactElement {
  return <TasksTab clusterId={clusterId} isActive />;
}
