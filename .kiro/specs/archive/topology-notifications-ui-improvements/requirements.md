# Requirements Document

## Introduction

This document specifies UI/UX improvements and bugfixes for the Cerebro Elasticsearch admin tool's topology visualization, notifications system, and cluster status display. The improvements address broken functionality, visual inconsistencies, and missing real-time feedback for cluster events.

## Glossary

- **Topology_View**: The visual representation of cluster nodes and shard distribution in both index and dot view modes
- **Toast_Notification**: A temporary, non-blocking notification message displayed to inform users of cluster events
- **Shard**: A single Lucene index instance, either primary or replica
- **Relocating_Shard**: A shard currently moving from one node to another
- **Initializing_Shard**: A shard being created or recovered
- **Unassigned_Shard**: A shard not currently assigned to any node
- **Allocation_Lock**: Cluster-level setting controlling whether shards can be moved or allocated
- **Dot_View**: Topology visualization mode showing nodes as compact cards with minimal shard details
- **Index_View**: Topology visualization mode showing detailed shard distribution per index
- **Node_Details_Modal**: A modal dialog displaying detailed information about a specific node
- **Side_Drawer**: The navigation menu for switching between clusters and views
- **Global_Timer**: The automatic refresh mechanism that polls cluster state at regular intervals

## Requirements

### Requirement 1: Real-time Toast Notifications for Cluster Events

**User Story:** As a cluster administrator, I want to receive temporary notifications when cluster topology changes occur, so that I can immediately see important events without manually refreshing.

#### Acceptance Criteria

1. WHEN the Global_Timer detects a node has joined the cluster, THE Toast_Notification SHALL display a message indicating which node joined
2. WHEN the Global_Timer detects a node has left the cluster, THE Toast_Notification SHALL display a message indicating which node left
3. WHEN the Global_Timer detects an index has been created, THE Toast_Notification SHALL display a message indicating which index was created
4. WHEN the Global_Timer detects an index has been deleted, THE Toast_Notification SHALL display a message indicating which index was deleted
5. THE Toast_Notification SHALL automatically dismiss after a reasonable timeout period
6. THE Toast_Notification SHALL be non-blocking and allow continued interaction with the interface

### Requirement 2: Cluster Allocation Lock Status Indicator

**User Story:** As a cluster administrator, I want to see the current allocation lock status at all times, so that I understand whether shard movements are permitted.

#### Acceptance Criteria

1. THE Topology_View SHALL display an allocation lock status icon on the same line as the cluster name and version
2. THE allocation lock icon SHALL be positioned at the maximum right of the display area for constant visibility
3. WHEN the cluster allocation is fully enabled, THE icon SHALL display an unlocked padlock visual
4. WHEN the cluster allocation is disabled for primaries, THE icon SHALL display a partially locked padlock visual distinct from other states
5. WHEN the cluster allocation is disabled for all shards, THE icon SHALL display a fully locked padlock visual
6. WHEN the cluster allocation is disabled for new primaries only, THE icon SHALL display a distinct visual state
7. THE allocation lock icon SHALL remain visible during scrolling and navigation within the topology view

### Requirement 3: Relocating Shard Visibility in Topology Views

**User Story:** As a cluster administrator, I want to see relocating shards in the topology visualization, so that I can monitor shard movements in real-time.

#### Acceptance Criteria

1. WHEN a Relocating_Shard exists in the cluster, THE Topology_View SHALL display the shard in the shards list
2. WHEN a Relocating_Shard exists in the cluster, THE Topology_View SHALL display the shard with a yellow color indicator
3. WHEN viewing in Dot_View mode, THE Topology_View SHALL display the source node of a Relocating_Shard as a yellow square
4. WHEN viewing in Dot_View mode, THE Topology_View SHALL display the destination node of a Relocating_Shard as a yellow square with a dotted border
5. WHEN the user hovers over a Relocating_Shard in either view, THE Topology_View SHALL display a curved line connecting the source and destination nodes
6. THE Topology_View SHALL display Relocating_Shard visual indicators that are visually distinct from Initializing_Shard indicators

### Requirement 4: Shard State Filter Functionality

**User Story:** As a cluster administrator, I want shard state filters to work correctly, so that I can focus on specific shard states during troubleshooting.

#### Acceptance Criteria

1. WHEN the user unchecks the "started" filter, THE Topology_View SHALL hide all started shards from the display
2. WHEN the user unchecks the "started" filter and Relocating_Shard instances exist, THE Topology_View SHALL continue to display the relocating shards
3. WHEN the user applies any shard state filter, THE Topology_View SHALL update the display to show only shards matching the selected states
4. WHEN the user applies multiple shard state filters, THE Topology_View SHALL display shards matching any of the selected states
5. THE Topology_View SHALL persist filter selections during navigation within the same session

### Requirement 5: Shard Color Differentiation

**User Story:** As a cluster administrator, I want clear visual distinction between different shard states, so that I can quickly identify shard health and status.

#### Acceptance Criteria

1. THE Topology_View SHALL display Initializing_Shard instances with a light blue color across the entire application
2. THE Topology_View SHALL display Relocating_Shard instances with a yellow-orange color that is visually distinct from the light blue of initializing shards
3. WHEN displaying Unassigned_Shard instances that are replicas, THE Topology_View SHALL use a dimmed red color with reduced brightness
4. WHEN displaying Unassigned_Shard instances that are primaries, THE Topology_View SHALL use a brighter red color
5. THE Topology_View SHALL display all Unassigned_Shard instances as squares without borders
6. THE Topology_View SHALL apply consistent color schemes across Index_View, Dot_View, and Node_Details_Modal

### Requirement 6: Enhanced Dot View Node Information

**User Story:** As a cluster administrator, I want to see comprehensive node metrics in dot view, so that I can assess node health and resource usage at a glance.

#### Acceptance Criteria

1. WHEN viewing in Dot_View mode, THE Topology_View SHALL display the node IP address to the right of the node name
2. THE node IP address SHALL be displayed with reduced visual prominence compared to the node name
3. WHEN viewing in Dot_View mode, THE Topology_View SHALL display CPU utilization with color coding
4. WHEN viewing in Dot_View mode, THE Topology_View SHALL display load average with color coding
5. WHEN viewing in Dot_View mode, THE Topology_View SHALL display the Elasticsearch version running on each node
6. THE Topology_View SHALL maintain existing heap and disk metrics display alongside the new metrics

### Requirement 7: Node Details Modal Consistency

**User Story:** As a cluster administrator, I want the node details modal to use the same visual improvements as the topology screen, so that I have a consistent experience across the interface.

#### Acceptance Criteria

1. THE Node_Details_Modal SHALL apply the same shard color scheme as the Topology_View
2. THE Node_Details_Modal SHALL display
 Initializing_Shard instances with light blue color
3. THE Node_Details_Modal SHALL display Relocating_Shard instances with yellow-orange color
4. THE Node_Details_Modal SHALL display Unassigned_Shard instances with the same dimmed/bright red color scheme based on replica or primary status
5. THE Node_Details_Modal SHALL display shard state information consistent with the main Topology_View

### Requirement 8: Side Drawer Cluster Name Visual Distinction

**User Story:** As a user managing multiple clusters, I want to easily distinguish cluster names from their submenu items in the side drawer, so that I can navigate more efficiently.

#### Acceptance Criteria

1. THE Side_Drawer SHALL display cluster names with visual styling that distinguishes them from submenu items
2. THE Side_Drawer SHALL use font weight, size, or color to create clear visual hierarchy between cluster names and submenu items
3. WHEN the Side_Drawer contains multiple clusters, THE visual distinction SHALL be consistent across all cluster entries
4. THE Side_Drawer SHALL maintain visual distinction in both collapsed and expanded states

### Requirement 9: Consistent Shard Ordering

**User Story:** As a cluster administrator, I want shards to maintain consistent ordering within each node across refreshes, so that I can track specific shards without visual disruption.

#### Acceptance Criteria

1. THE Topology_View SHALL display shards within each node in a consistent, deterministic order
2. WHEN the Global_Timer refreshes cluster state, THE shard ordering within each node SHALL remain stable
3. THE consistent ordering SHALL apply to both Index_View and Dot_View modes
4. THE Topology_View SHALL maintain shard ordering across navigation and view mode switches
5. THE shard ordering algorithm SHALL be deterministic and based on shard properties (e.g., index name, shard number, state)

### Requirement 10: Shard Context Menu and Modal Navigation

**User Story:** As a cluster administrator, I want to access both shard details and index details from the shard context menu, so that I can quickly navigate to the information I need.

#### Acceptance Criteria

1. WHEN the user right-clicks on a shard in Dot_View and selects "Display shard details", THE application SHALL open the shard details modal
2. WHEN the user right-clicks on a shard in Dot_View, THE context menu SHALL include a "Display index details" menu item
3. WHEN the user selects "Display index details" from the shard context menu, THE application SHALL open the index details modal
4. THE shard context menu title SHALL display the index name, shard number, and shard type (primary/replica)
5. WHEN the user clicks on an assigned shard in any index details modal visualization tab, THE application SHALL open the shard details modal on top of the index modal
6. WHEN the shard details modal is open on top of the index modal, pressing ESC or clicking outside SHALL close only the shard details modal
7. WHEN the shard details modal is closed, THE index modal SHALL remain open
8. WHEN the index modal is open without a shard modal on top, pressing ESC or clicking outside SHALL close the index modal
9. THE layered modal behavior SHALL apply regardless of which view the index modal was opened from
10. THE layered modal behavior SHALL NOT apply to unassigned shards

### Requirement 11: Node Role Filter Default State

**User Story:** As a cluster administrator, I want node role filters to be enabled by default, so that the visual state matches the actual filtering behavior.

#### Acceptance Criteria

1. WHEN the nodes list view loads, ALL node role filters SHALL be in the enabled (checked) state by default
2. WHEN all node role filters are enabled, ALL nodes SHALL be visible in the nodes list
3. WHEN the user unchecks a node role filter, THE nodes list SHALL hide nodes with that role
4. THE visual state of the role filters SHALL be consistent with the filtering behavior (enabled filters = nodes shown, disabled filters = nodes hidden)
