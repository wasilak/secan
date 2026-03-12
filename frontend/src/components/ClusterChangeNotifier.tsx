/**
 * Component for displaying toast notifications when cluster topology changes
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { useEffect } from 'react';
import { notifications } from '@mantine/notifications';
import { IconCirclePlus, IconCircleMinus } from '@tabler/icons-react';
import type { ClusterChanges } from '../utils/clusterDiff';
import { hasChanges } from '../utils/clusterDiff';

interface ClusterChangeNotifierProps {
  /** Cluster identifier for notification context */
  clusterId: string;
  /** Detected cluster changes from useClusterChanges hook */
  changes: ClusterChanges | null;
}

/**
 * ClusterChangeNotifier component
 * 
 * Displays toast notifications for cluster topology changes:
 * - Nodes added/removed
 * - Indices created/deleted
 * 
 * Requirements:
 * - 1.1: Display notifications for nodes added/removed
 * - 1.2: Display notifications for indices created/deleted
 * - 1.3: Consume changes from useClusterChanges hook
 * - 1.4: Return structured ClusterChanges object
 * - 1.5: Auto-dismiss after 5 seconds
 * - 1.6: Non-blocking notifications with color coding
 */
export function ClusterChangeNotifier({
  clusterId,
  changes,
}: ClusterChangeNotifierProps): null {
  useEffect(() => {
    // Skip if no changes detected
    if (!changes || !hasChanges(changes)) {
      return;
    }

    // Notify about nodes added (blue color for additions)
    changes.nodesAdded.forEach((node) => {
      notifications.show({
        title: 'Node Joined',
        message: `Node "${node.name}" (${node.id}) has joined cluster "${clusterId}"`,
        color: 'blue',
        icon: <IconCirclePlus size={18} />,
        autoClose: 5000,
        position: 'top-right',
      });
    });

    // Notify about nodes removed (orange color for removals)
    changes.nodesRemoved.forEach((node) => {
      notifications.show({
        title: 'Node Left',
        message: `Node "${node.name}" (${node.id}) has left cluster "${clusterId}"`,
        color: 'orange',
        icon: <IconCircleMinus size={18} />,
        autoClose: 5000,
        position: 'top-right',
      });
    });

    // Notify about indices created (blue color for additions)
    changes.indicesCreated.forEach((index) => {
      notifications.show({
        title: 'Index Created',
        message: `Index "${index.name}" has been created in cluster "${clusterId}"`,
        color: 'blue',
        icon: <IconCirclePlus size={18} />,
        autoClose: 5000,
        position: 'top-right',
      });
    });

    // Notify about indices deleted (orange color for removals)
    changes.indicesDeleted.forEach((index) => {
      notifications.show({
        title: 'Index Deleted',
        message: `Index "${index.name}" has been deleted from cluster "${clusterId}"`,
        color: 'orange',
        icon: <IconCircleMinus size={18} />,
        autoClose: 5000,
        position: 'top-right',
      });
    });
  }, [clusterId, changes]);

  // This component doesn't render anything - it only triggers notifications
  return null;
}
