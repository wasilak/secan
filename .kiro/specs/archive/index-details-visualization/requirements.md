# Requirements Document

## Introduction

This feature adds an APM-style visualization tab to the existing Index Details Modal, providing a visual representation of shard distribution across nodes. The visualization displays the index in the center, with nodes containing primary shards on the left and nodes containing replica shards on the right, similar to APM service map layouts.

**Implementation Approach**: This is a frontend-only feature that adds a new "Visualization" tab (first position, active by default) to the existing Index Details Modal in ClusterView.tsx. It leverages existing backend APIs (getShards, getNodes) and data types (ShardInfo, NodeInfo) without requiring any backend changes.

## Glossary

- **Index_Visualization**: The visual component that displays the APM-style layout of an index and its shards
- **Shard_Node**: A visual representation of a node containing shards for the index
- **Primary_Shard**: A shard that serves as the primary copy of data
- **Replica_Shard**: A shard that serves as a replica copy of data
- **Index_Details_View**: The page or component that displays detailed information about a specific index
- **Shard_Distribution**: The arrangement of primary and replica shards across cluster nodes
- **Node_Connection**: A visual line or connection showing the relationship between the index and nodes
- **Shard_Health_Status**: The health state of a shard (green, yellow, red, unassigned)

## Requirements

### Requirement 1: Display Index-Centric Visualization

**User Story:** As a cluster administrator, I want to see an APM-style visualization of an index, so that I can quickly understand how shards are distributed across nodes.

#### Acceptance Criteria

1. WHEN an index is selected for detailed view, THE Index_Visualization SHALL display the index name in the center of the visualization
2. THE Index_Visualization SHALL display nodes with primary shards on the left side of the center index
3. THE Index_Visualization SHALL display nodes with replica shards on the right side of the center index
4. THE Index_Visualization SHALL use visual connections to link the center index to each node containing its shards
5. WHEN an index has no replicas configured, THE Index_Visualization SHALL display only the left side with primary shard nodes

### Requirement 2: Display Node Information

**User Story:** As a cluster administrator, I want to see which nodes contain shards for an index, so that I can understand the physical distribution of data.

#### Acceptance Criteria

1. FOR EACH node containing shards, THE Index_Visualization SHALL display the node name
2. FOR EACH node containing shards, THE Index_Visualization SHALL display the number of shards on that node
3. FOR EACH node containing primary shards, THE Index_Visualization SHALL display the node on the left side
4. FOR EACH node containing replica shards, THE Index_Visualization SHALL display the node on the right side
5. WHEN a node contains both primary and replica shards for the same index, THE Index_Visualization SHALL display the node on both sides with appropriate shard counts

### Requirement 3: Display Shard Health Status

**User Story:** As a cluster administrator, I want to see the health status of shards in the visualization, so that I can quickly identify issues.

#### Acceptance Criteria

1. FOR EACH shard displayed, THE Index_Visualization SHALL indicate the Shard_Health_Status using color coding
2. THE Index_Visualization SHALL use green color to indicate healthy shards
3. THE Index_Visualization SHALL use yellow color to indicate shards with warnings
4. THE Index_Visualization SHALL use red color to indicate unhealthy shards
5. WHEN a shard is unassigned, THE Index_Visualization SHALL display it with a distinct visual indicator

### Requirement 4: Provide Interactive Elements

**User Story:** As a cluster administrator, I want to interact with the visualization elements, so that I can access detailed information about nodes and shards.

#### Acceptance Criteria

1. WHEN a user hovers over a node in the visualization, THE Index_Visualization SHALL display a tooltip with node details
2. WHEN a user hovers over a shard indicator, THE Index_Visualization SHALL display shard-specific information
3. WHEN a user clicks on a node in the visualization, THE Index_Visualization SHALL navigate to the node details view
4. THE Index_Visualization SHALL display the total number of primary shards for the index
5. THE Index_Visualization SHALL display the total number of replica shards for the index

### Requirement 5: Handle Large-Scale Deployments

**User Story:** As a cluster administrator managing large clusters, I want the visualization to remain usable with many nodes, so that I can analyze shard distribution at scale.

#### Acceptance Criteria

1. WHEN an index has shards on more than 10 nodes, THE Index_Visualization SHALL provide scrolling or pagination
2. WHEN an index has shards on more than 10 nodes, THE Index_Visualization SHALL maintain visual clarity and readability
3. THE Index_Visualization SHALL group nodes by shard count when displaying more than 20 nodes
4. THE Index_Visualization SHALL provide a search or filter capability to find specific nodes
5. WHEN the visualization is too large for the viewport, THE Index_Visualization SHALL provide zoom controls

### Requirement 6: Display Shard Routing Information

**User Story:** As a cluster administrator, I want to see shard routing details, so that I can understand how data is allocated.

#### Acceptance Criteria

1. FOR EACH primary shard, THE Index_Visualization SHALL display the shard number
2. FOR EACH replica shard, THE Index_Visualization SHALL display the shard number and replica number
3. THE Index_Visualization SHALL visually connect matching primary and replica shards
4. WHEN a shard is relocating, THE Index_Visualization SHALL indicate the source and target nodes
5. WHEN a shard is initializing, THE Index_Visualization SHALL display the initialization progress

### Requirement 7: Integrate with Index Details Modal

**User Story:** As a cluster administrator, I want to access the APM-style visualization from the index details modal, so that I can view it alongside other index information.

#### Acceptance Criteria

1. THE Index_Details_Modal SHALL include a "Visualization" tab as the FIRST tab (leftmost position)
2. WHEN the Index_Details_Modal opens, THE "Visualization" tab SHALL be active by default
3. THE Index_Details_Modal SHALL provide tabs to switch between Visualization, Settings, Mappings, and Stats views
4. THE Index_Visualization SHALL refresh automatically when shard allocation changes (via TanStack Query refetch interval)
5. THE Index_Details_Modal SHALL display a loading indicator while fetching shard distribution data

### Requirement 8: Support Responsive Layout

**User Story:** As a cluster administrator using different screen sizes, I want the visualization to adapt to my viewport, so that I can view it on various devices.

#### Acceptance Criteria

1. THE Index_Visualization SHALL adapt its layout to the available viewport width
2. WHEN the viewport width is less than 768 pixels, THE Index_Visualization SHALL stack nodes vertically
3. THE Index_Visualization SHALL maintain readability at different zoom levels
4. THE Index_Visualization SHALL use responsive font sizes for node and shard labels
5. WHEN the viewport is resized, THE Index_Visualization SHALL recalculate and redraw the layout

### Requirement 9: Fetch Shard Allocation Data (Frontend Only)

**User Story:** As the visualization component, I need to retrieve shard allocation data from existing APIs, so that I can display accurate information.

#### Acceptance Criteria

1. THE Index_Visualization SHALL fetch shard allocation data using the existing `getShards()` API and filter by index name in the frontend
2. THE Index_Visualization SHALL fetch node information using the existing `getNodes()` API for tooltip details
3. WHEN the API request fails, THE Index_Visualization SHALL display an error message with retry option
4. THE Index_Visualization SHALL use TanStack Query to manage data fetching, caching, and automatic refetching
5. THE Index_Visualization SHALL cache shard allocation data for 30 seconds (via TanStack Query staleTime) to reduce API calls

### Requirement 10: Export Visualization

**User Story:** As a cluster administrator, I want to export the visualization, so that I can share it with my team or include it in reports.

#### Acceptance Criteria

1. THE Index_Visualization SHALL provide an export button
2. WHEN the export button is clicked, THE Index_Visualization SHALL generate a PNG image of the current visualization
3. THE Index_Visualization SHALL provide an option to export as SVG format
4. THE Index_Visualization SHALL include index name and timestamp in the exported image
5. WHEN the export is complete, THE Index_Visualization SHALL download the file to the user's device
