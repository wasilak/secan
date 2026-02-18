# Requirements Document: Project Enhancements - Rebranding and Shard Reallocation

## Introduction

This document specifies enhancements to the Elasticsearch web administration tool rewrite project, including:
1. **Project rebranding** - Distance from "Cerebro" name while staying in the naming ballpark
2. **Full-width UI layout** - All views should use full-width layout like the current dashboard
3. **Interactive shard reallocation** - Mouse-click based shard reassignment with visual destination indicators

## Glossary

- **Shard**: A partition of an Elasticsearch index distributed across nodes
- **Shard_Reallocation**: The process of moving a shard from one node to another
- **Context_Menu**: A popup menu triggered by clicking on a shard
- **Destination_Indicator**: Visual representation (dashed/outlined shard) showing valid target nodes for relocation
- **Shard_Grid**: Visual matrix layout showing nodes (rows) and indices (columns) with shards at intersections
- **Node_Row**: A row in the shard grid representing a single Elasticsearch node with its statistics
- **Index_Column**: A column in the shard grid representing a single index with its metadata

## Project Name Proposals

The new project name should be:
- Short and catchy (1-2 syllables preferred)
- Easy to write and remember
- Related to brain/intelligence/search themes (staying in Cerebro's ballpark)
- Available as a crate name on crates.io and npm package name

### Selected Name: Secan

**Secan** (Old English: *sēcan* - to seek, to inquire)

**Rationale:**
- Short and memorable (2 syllables)
- Easy to write and pronounce
- Meaningful etymology: "to seek, to inquire" perfectly fits a search/cluster management tool
- Unique in the tech/software space (no conflicts with existing Elasticsearch tools)
- Professional and modern sounding
- Maintains the intelligence/search theme from Cerebro

**One-liner:** Secan is a lightweight, full-width cluster management tool for Elasticsearch, built to replace Cerebro with a focus on modern screen utility and efficient shard operations.

## Requirements

### Requirement 1: Project Rebranding

**User Story:** As a project maintainer, I want to rebrand the project with a new name that distances us from "Cerebro" while maintaining the theme, so that we establish our own identity.

#### Acceptance Criteria

1. THE Project SHALL be renamed to "Secan"
2. THE Documentation SHALL use the new project name consistently
3. THE Binary executable SHALL be named with the new project name
4. THE Cargo.toml package name SHALL use the new project name
5. THE package.json package name SHALL use the new project name
6. THE Docker image SHALL be tagged with the new project name
7. THE Code structure SHALL remain brand-agnostic (no project name in function/struct names)
8. THE User-facing messages SHALL display the new project name
9. THE README and documentation SHALL explain the project without referencing Cerebro
9a. THE README SHALL include the naming explanation: "Secan (Old English: sēcan - to seek, to inquire)"
10. THE Configuration examples SHALL use the new project name
11. THE GitHub repository name SHOULD be updated to reflect the new name

### Requirement 2: Full-Width Layout for All Views

**User Story:** As a user, I want all views to use full-width layout, so that I can see more information without horizontal scrolling and make better use of screen real estate.

#### Acceptance Criteria

1. THE Dashboard view SHALL use full-width layout (already implemented)
2. THE Cluster overview view SHALL use full-width layout
3. THE Nodes list view SHALL use full-width layout
4. THE Indices list view SHALL use full-width layout
5. THE Shards visualization view SHALL use full-width layout
6. THE REST console view SHALL use full-width layout
7. THE Aliases management view SHALL use full-width layout
8. THE Templates management view SHALL use full-width layout
9. THE Cluster settings view SHALL use full-width layout
10. THE Snapshot management view SHALL use full-width layout
11. THE Cat API view SHALL use full-width layout
12. THE Analysis tools view SHALL use full-width layout
13. THE AppShell component SHALL NOT constrain content width with max-width
14. THE Content area SHALL expand to fill available viewport width
15. THE Responsive breakpoints SHALL still apply for mobile/tablet layouts
16. THE Sidebar/navigation SHALL remain fixed width or collapsible

### Requirement 3: Shard Grid Visualization

**User Story:** As a cluster administrator, I want to see shards in a grid layout with nodes as rows and indices as columns, so that I can understand shard distribution at a glance.

#### Acceptance Criteria

1. THE Frontend SHALL display a shard grid with nodes as rows and indices as columns
2. THE Node rows SHALL display node name, IP address, and statistics (heap, disk, CPU, load)
3. THE Index columns SHALL display index name, shard count, document count, and size
4. THE Shards SHALL be displayed as numbered boxes at the intersection of node rows and index columns
5. THE Shard boxes SHALL use color coding for shard state:
   - Green border: STARTED (healthy)
   - Yellow border: INITIALIZING
   - Orange border: RELOCATING
   - Red border: UNASSIGNED
6. THE Shard boxes SHALL display the shard number (0, 1, 2, etc.)
7. THE Primary shards SHALL be visually distinguished from replica shards (e.g., filled vs outlined)
8. THE Grid SHALL be scrollable horizontally and vertically for large clusters
9. THE Grid SHALL use sticky headers for node names and index names
10. THE Grid SHALL display unassigned shards in a separate "unassigned" row
11. THE Grid SHALL show relocating shards in both source and destination nodes
12. THE Grid SHALL update in real-time or with configurable refresh interval

### Requirement 4: Interactive Shard Selection

**User Story:** As a cluster administrator, I want to click on a shard to select it, so that I can view its details or initiate relocation.

#### Acceptance Criteria

1. WHEN a user clicks on a shard box, THE Frontend SHALL highlight the selected shard
2. WHEN a shard is selected, THE Frontend SHALL display a context menu with options
3. THE Context menu SHALL include "Display shard stats" option
4. THE Context menu SHALL include "Select for relocation" option
5. WHEN "Display shard stats" is selected, THE Frontend SHALL show detailed shard information in a modal or panel
6. THE Shard stats SHALL include:
   - Shard number and type (primary/replica)
   - Index name
   - Node name and ID
   - Shard state (STARTED, INITIALIZING, RELOCATING, UNASSIGNED)
   - Document count
   - Size in bytes
   - Segments count
7. THE Context menu SHALL be implemented using Mantine Menu component
8. THE Context menu SHALL close when clicking outside or pressing Escape
9. THE Context menu SHALL be positioned near the clicked shard
10. WHEN a shard is UNASSIGNED, THE Context menu SHALL only show "Display shard stats"

### Requirement 5: Shard Relocation Mode

**User Story:** As a cluster administrator, I want to select a shard for relocation and see valid destination nodes, so that I can manually rebalance the cluster.

#### Acceptance Criteria

1. WHEN a user selects "Select for relocation" from the context menu, THE Frontend SHALL enter relocation mode
2. WHEN in relocation mode, THE Frontend SHALL display the selected shard with a distinct visual indicator (e.g., pulsing border)
3. WHEN in relocation mode, THE Frontend SHALL calculate and display valid destination nodes
4. THE Valid destination nodes SHALL be nodes that:
   - Are not the current node hosting the shard
   - Have the same shard number available (not already hosting that shard)
   - Are data nodes (not master-only or coordinating-only nodes)
5. THE Frontend SHALL display destination indicators as dashed/outlined shard boxes in valid destination cells
6. THE Destination indicators SHALL use a distinct color (e.g., purple/blue dashed border)
7. THE Destination indicators SHALL show the shard number that would be relocated
8. WHEN a user clicks on a destination indicator, THE Frontend SHALL show a confirmation dialog
9. THE Confirmation dialog SHALL display:
   - Source node name and ID
   - Destination node name and ID
   - Index name
   - Shard number
   - Warning about potential performance impact
10. WHEN a user confirms relocation, THE Backend SHALL execute the reroute API call
11. WHEN relocation is initiated, THE Frontend SHALL exit relocation mode
12. WHEN relocation is initiated, THE Frontend SHALL display a notification with status
13. THE User SHALL be able to cancel relocation mode by clicking outside or pressing Escape
14. THE Frontend SHALL only allow one shard to be in relocation mode at a time

### Requirement 6: Shard Relocation API

**User Story:** As a backend developer, I want to implement the shard relocation API endpoint, so that the frontend can trigger shard moves.

#### Acceptance Criteria

1. THE Backend SHALL provide a POST endpoint at `/api/clusters/:id/shards/relocate`
2. THE Endpoint SHALL accept JSON body with:
   - `index`: string (index name)
   - `shard`: number (shard number)
   - `from_node`: string (source node ID)
   - `to_node`: string (destination node ID)
3. THE Backend SHALL validate that all required parameters are present
4. THE Backend SHALL validate that the cluster ID exists
5. THE Backend SHALL construct the Elasticsearch `_cluster/reroute` API request
6. THE Backend SHALL send the reroute command to Elasticsearch:
   ```json
   {
     "commands": [
       {
         "move": {
           "index": "<index_name>",
           "shard": <shard_number>,
           "from_node": "<source_node_id>",
           "to_node": "<destination_node_id>"
         }
       }
     ]
   }
   ```
7. THE Backend SHALL return the Elasticsearch response to the frontend
8. IF the reroute fails, THE Backend SHALL return the Elasticsearch error message
9. THE Backend SHALL log all shard relocation attempts with full parameters
10. THE Backend SHALL require authentication for the relocation endpoint
11. THE Backend SHALL enforce RBAC for cluster access before allowing relocation

### Requirement 7: Shard Relocation Progress Tracking

**User Story:** As a cluster administrator, I want to see the progress of shard relocation, so that I know when the operation completes.

#### Acceptance Criteria

1. WHEN a shard relocation is initiated, THE Frontend SHALL display a notification with "Relocation initiated" message
2. THE Frontend SHALL poll the cluster state to track relocation progress
3. THE Frontend SHALL update the shard grid to show the shard in RELOCATING state
4. THE Relocating shard SHALL be displayed in both source and destination nodes
5. THE Source node SHALL show the shard with RELOCATING state (orange border)
6. THE Destination node SHALL show the shard with INITIALIZING state (yellow border)
7. WHEN relocation completes, THE Frontend SHALL display a success notification
8. WHEN relocation completes, THE Frontend SHALL update the shard grid to show final state
9. IF relocation fails, THE Frontend SHALL display an error notification with the failure reason
10. THE Frontend SHALL stop polling when relocation completes or fails
11. THE Polling interval SHALL be configurable (default: 2 seconds)
12. THE Frontend SHALL timeout polling after a configurable duration (default: 5 minutes)

### Requirement 8: Shard Relocation Validation

**User Story:** As a cluster administrator, I want the system to validate shard relocation requests, so that I don't accidentally create invalid cluster states.

#### Acceptance Criteria

1. THE Frontend SHALL validate that the destination node is different from the source node
2. THE Frontend SHALL validate that the destination node does not already host the same shard
3. THE Frontend SHALL validate that the destination node is a data node
4. THE Frontend SHALL validate that the shard is in STARTED state before allowing relocation
5. THE Frontend SHALL prevent relocation of UNASSIGNED shards (they need allocation, not relocation)
6. THE Frontend SHALL prevent relocation of already RELOCATING shards
7. THE Frontend SHALL display validation errors in the UI before attempting relocation
8. THE Backend SHALL perform the same validations server-side
9. THE Backend SHALL return 400 Bad Request for invalid relocation requests
10. THE Backend SHALL return descriptive error messages for validation failures

### Requirement 9: Shard Grid Performance Optimization

**User Story:** As a user with large clusters, I want the shard grid to perform well, so that I can manage clusters with hundreds of nodes and indices.

#### Acceptance Criteria

1. THE Frontend SHALL use virtualization for the shard grid when node count > 20 or index count > 20
2. THE Frontend SHALL render only visible rows and columns in the viewport
3. THE Frontend SHALL use memoization for shard state calculations
4. THE Frontend SHALL debounce scroll events to reduce re-renders
5. THE Frontend SHALL use CSS transforms for smooth scrolling
6. THE Frontend SHALL lazy-load node statistics on demand
7. THE Frontend SHALL cache cluster state data with configurable TTL
8. THE Frontend SHALL use Web Workers for heavy calculations (if needed)
9. THE Frontend SHALL display a loading skeleton while fetching data
10. THE Frontend SHALL handle clusters with up to 100 nodes and 500 indices without performance degradation

### Requirement 10: Shard Grid Accessibility

**User Story:** As a user relying on keyboard navigation, I want to navigate and interact with the shard grid using keyboard, so that I can manage shards without a mouse.

#### Acceptance Criteria

1. THE Shard grid SHALL support keyboard navigation with arrow keys
2. THE User SHALL be able to focus on shards using Tab key
3. THE User SHALL be able to select a shard using Enter or Space key
4. THE Context menu SHALL be navigable with arrow keys
5. THE Context menu SHALL support selection with Enter key
6. THE Destination indicators SHALL be focusable and selectable with keyboard
7. THE User SHALL be able to cancel relocation mode with Escape key
8. THE Focused shard SHALL have a visible focus indicator
9. THE Shard grid SHALL announce state changes to screen readers
10. THE Shard grid SHALL use ARIA labels for accessibility

### Requirement 11: Shard Grid Responsive Design

**User Story:** As a user on different screen sizes, I want the shard grid to adapt to my viewport, so that I can manage shards on various devices.

#### Acceptance Criteria

1. THE Shard grid SHALL be horizontally scrollable on smaller screens
2. THE Node names and index names SHALL remain visible when scrolling (sticky headers)
3. THE Shard boxes SHALL have minimum touch target size of 44x44px on mobile
4. THE Context menu SHALL be touch-friendly on mobile devices
5. THE Shard grid SHALL adapt to viewport width while maintaining full-width layout
6. THE Node statistics SHALL be collapsible on smaller screens
7. THE Index metadata SHALL be collapsible on smaller screens
8. THE Shard grid SHALL support pinch-to-zoom on touch devices
9. THE Shard grid SHALL maintain aspect ratio and readability at different zoom levels
10. THE Shard grid SHALL provide a compact view option for dense clusters

### Requirement 12: Dynamic Favicon Based on Cluster Health

**User Story:** As a user managing multiple clusters in different browser tabs, I want the favicon to change color based on cluster health, so that I can quickly identify cluster status without switching tabs.

#### Acceptance Criteria

1. THE Application SHALL display a neutral (gray) favicon when:
   - No cluster is connected
   - On the clusters list view
   - Cluster health state is unknown or loading
2. THE Application SHALL display a green favicon when viewing a cluster with "green" health status
3. THE Application SHALL display a yellow favicon when viewing a cluster with "yellow" health status
4. THE Application SHALL display a red favicon when viewing a cluster with "red" health status
5. THE Favicon SHALL update within 1 second of cluster health state change
6. THE Favicon SHALL use the SVG favicon files created for the project:
   - `favicon-neutral.svg` for neutral/unknown state
   - `favicon-green.svg` for healthy clusters
   - `favicon-yellow.svg` for warning state clusters
   - `favicon-red.svg` for critical state clusters
7. THE Favicon SHALL revert to neutral when navigating away from cluster view
8. THE Favicon SHALL revert to neutral when navigating to the clusters list
9. THE Frontend SHALL update the favicon dynamically using JavaScript
10. THE Favicon update SHALL not cause page flicker or layout shift
11. THE Favicon SHALL be visible in browser tabs, bookmarks, and history

## Non-Functional Requirements

### Performance

1. THE Shard grid SHALL render initial view within 2 seconds for clusters with 50 nodes and 200 indices
2. THE Shard relocation API call SHALL complete within 5 seconds
3. THE Frontend SHALL update the shard grid within 500ms of receiving new data
4. THE Polling for relocation progress SHALL not impact UI responsiveness

### Usability

1. THE Shard relocation workflow SHALL require no more than 3 clicks
2. THE Context menu SHALL appear within 100ms of clicking a shard
3. THE Destination indicators SHALL be clearly distinguishable from actual shards
4. THE Confirmation dialog SHALL clearly communicate the relocation action

### Reliability

1. THE Backend SHALL handle concurrent shard relocation requests safely
2. THE Frontend SHALL handle network errors gracefully during relocation
3. THE Frontend SHALL recover from failed relocation attempts without requiring page refresh
4. THE Backend SHALL validate all relocation requests to prevent invalid cluster states

### Security

1. THE Shard relocation endpoint SHALL require authentication
2. THE Shard relocation endpoint SHALL enforce RBAC
3. THE Backend SHALL log all shard relocation attempts for audit purposes
4. THE Backend SHALL rate-limit shard relocation requests to prevent abuse

## Success Metrics

1. Users can successfully relocate shards with 3 clicks or less
2. Shard grid renders within 2 seconds for typical clusters (20 nodes, 100 indices)
3. 95% of shard relocations complete successfully
4. Zero invalid cluster states caused by relocation feature
5. Positive user feedback on full-width layout and shard relocation UX

## Out of Scope

The following are explicitly out of scope for this specification:

1. Automatic shard rebalancing algorithms
2. Bulk shard relocation (moving multiple shards at once)
3. Shard allocation explain API integration
4. Historical shard movement tracking
5. Shard relocation scheduling
6. Integration with external monitoring tools
7. Shard size prediction for relocation impact
