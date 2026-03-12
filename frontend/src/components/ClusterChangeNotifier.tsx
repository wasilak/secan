/**
 * Component for displaying toast notifications when cluster topology changes
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import { useCallback } from 'react';
import type { ClusterChanges } from '../utils/clusterDiff';
import { hasChanges } from '../utils/clusterDiff';
import { showSpecialNotification } from '../utils/notifications';
import { useClusterChanges } from '../hooks/useClusterChanges';
import type { NodeInfo, IndexInfo } from '../types/api';

interface ClusterChangeNotifierProps {
  /** Cluster identifier for notification context */
  clusterId: string;
  /** Current list of nodes */
  nodes: NodeInfo[] | undefined;
  /** Current list of indices */
  indices: IndexInfo[] | undefined;
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
  nodes,
  indices,
}: ClusterChangeNotifierProps): null {
  // Handle changes via callback to avoid state updates during render
  const handleChanges = useCallback((changes: ClusterChanges | null) => {
    // Skip if no changes detected
    if (!changes || !hasChanges(changes)) {
      return;
    }

    // Notify about nodes added (violet/purple color)
    changes.nodesAdded.forEach((node) => {
      showSpecialNotification({
        title: 'Node Joined',
        message: `Node "${node.name}" (${node.id}) has joined`,
      });
    });

    // Notify about nodes removed (violet/purple color)
    changes.nodesRemoved.forEach((node) => {
      showSpecialNotification({
        title: 'Node Left',
        message: `Node "${node.name}" (${node.id}) has left`,
      });
    });

    // Notify about indices created (violet/purple color)
    changes.indicesCreated.forEach((index) => {
      showSpecialNotification({
        title: 'Index Created',
        message: `Index "${index.name}" has been created`,
      });
    });

    // Notify about indices deleted (violet/purple color)
    changes.indicesDeleted.forEach((index) => {
      showSpecialNotification({
        title: 'Index Deleted',
        message: `Index "${index.name}" has been deleted`,
      });
    });
  }, []);

  // Use the hook with callback pattern
  useClusterChanges(clusterId, nodes, indices, handleChanges);

  // This component doesn't render anything - it only triggers notifications
  return null;
}
