# Requirements Document

## Introduction

This feature enhances the existing cluster topology "dot view" to display all node types (not just data nodes) and adds visual grouping capabilities. Users can group nodes by roles, types, or custom labels, with grouping parameters encoded in the URL for bookmarking and sharing. The enhancement reuses existing node visualization and data fetching mechanisms, adding only a visual grouping layer.

## Glossary

- **Topology_Dot_View**: The existing cluster topology visualization that displays nodes and their relationships in a dot/graph format
- **Node**: An Elasticsearch cluster node with specific roles and attributes
- **Node_Role**: A functional capability assigned to a node (master-eligible, data, ingest, ml, coordinating, etc.)
- **Node_Type**: The primary classification of a node based on its roles
- **Node_Label**: Custom tags or labels assigned to nodes for organizational purposes
- **Visual_Group**: A bordered region in the visualization containing nodes that share a common attribute
- **Grouping_Parameter**: URL query parameter that specifies how nodes should be grouped
- **Renderer**: The component responsible for drawing nodes and groups in the topology view

## Requirements

### Requirement 1: Display All Node Types

**User Story:** As a cluster administrator, I want to see all nodes in the topology view regardless of their roles, so that I can understand the complete cluster structure.

#### Acceptance Criteria

1. THE Topology_Dot_View SHALL display all nodes returned by the Elasticsearch cluster API
2. WHEN the topology view loads, THE Topology_Dot_View SHALL include master nodes, data nodes, ingest nodes, ml nodes, coordinating nodes, and any other node types
3. THE Topology_Dot_View SHALL NOT filter nodes based on their roles or types
4. THE Topology_Dot_View SHALL display each node using the existing node visualization component

### Requirement 2: Group Nodes by Single Attribute

**User Story:** As a cluster administrator, I want to group nodes by a single attribute at a time, so that I can organize the topology view based on different perspectives.

#### Acceptance Criteria

1. THE Topology_Dot_View SHALL support grouping nodes by exactly one attribute at a time
2. THE Topology_Dot_View SHALL support grouping by node roles (master-eligible vs non-master-eligible, data vs non-data)
3. THE Topology_Dot_View SHALL support grouping by node types (master, data, ingest, ml, coordinating)
4. THE Topology_Dot_View SHALL support grouping by node labels when custom labels are present
5. WHEN no grouping is specified, THE Topology_Dot_View SHALL display all nodes without visual grouping

### Requirement 3: Visual Group Representation

**User Story:** As a cluster administrator, I want grouped nodes to be visually distinct with labeled borders, so that I can easily identify which nodes belong to each group.

#### Acceptance Criteria

1. WHEN nodes are grouped, THE Renderer SHALL draw a border around each Visual_Group
2. THE Renderer SHALL display a group label for each Visual_Group
3. THE Renderer SHALL create a Visual_Group labeled "undefined" for nodes that do not match any defined group
4. THE Renderer SHALL maintain the existing node visualization appearance within each Visual_Group
5. THE Visual_Group borders SHALL NOT obscure node details or connections

### Requirement 4: URL-Based Grouping Configuration

**User Story:** As a cluster administrator, I want grouping settings to be encoded in the URL, so that I can bookmark and share specific topology views with my team.

#### Acceptance Criteria

1. WHEN a user selects a grouping option, THE Topology_Dot_View SHALL update the URL with the appropriate Grouping_Parameter
2. WHEN a user navigates to a URL with Grouping_Parameter values, THE Topology_Dot_View SHALL apply the specified grouping
3. THE Grouping_Parameter SHALL include the grouping attribute type (role, type, or label)
4. THE Grouping_Parameter SHALL include the specific grouping value when applicable
5. WHEN the URL contains invalid Grouping_Parameter values, THE Topology_Dot_View SHALL display all nodes without grouping and log a warning

### Requirement 5: Reuse Existing Components

**User Story:** As a developer, I want to reuse existing node visualization and data fetching mechanisms, so that the implementation is maintainable and consistent with the current codebase.

#### Acceptance Criteria

1. THE Topology_Dot_View SHALL use the existing node visualization components without modification
2. THE Topology_Dot_View SHALL use the existing data fetching mechanisms to retrieve node information
3. THE Topology_Dot_View SHALL add grouping logic as a separate layer that does not modify existing node rendering code
4. THE Topology_Dot_View SHALL maintain the same data structures for node representation
5. WHEN grouping is disabled, THE Topology_Dot_View SHALL render identically to the current implementation

### Requirement 6: Performance with Large Clusters

**User Story:** As a cluster administrator with a large cluster, I want the topology view to remain responsive when grouping is enabled, so that I can analyze cluster structure without performance degradation.

#### Acceptance Criteria

1. WHEN rendering a cluster with up to 100 nodes, THE Topology_Dot_View SHALL complete initial render within 2 seconds
2. WHEN applying grouping to a cluster with up to 100 nodes, THE Topology_Dot_View SHALL update the visualization within 500 milliseconds
3. THE Topology_Dot_View SHALL calculate group membership efficiently without blocking the UI thread
4. WHEN switching between grouping options, THE Topology_Dot_View SHALL maintain smooth transitions without flickering

### Requirement 7: Grouping UI Controls

**User Story:** As a cluster administrator, I want intuitive controls to select grouping options, so that I can easily switch between different topology views.

#### Acceptance Criteria

1. THE Topology_Dot_View SHALL provide a dropdown or selection control for choosing the grouping attribute
2. THE Topology_Dot_View SHALL display available grouping options (None, By Role, By Type, By Label)
3. WHEN a user selects a grouping option, THE Topology_Dot_View SHALL immediately update the visualization
4. THE Topology_Dot_View SHALL indicate the currently active grouping option in the UI
5. WHEN no custom labels exist, THE Topology_Dot_View SHALL disable or hide the "By Label" grouping option
