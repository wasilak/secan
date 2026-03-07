# Requirements Document: UI/UX Improvements and Refinements

## Introduction

This specification defines a series of user interface and user experience improvements for the Secan Elasticsearch admin tool, with **consistency** as the central design principle. These enhancements establish uniform patterns for displaying information, navigating between views, presenting modals, formatting labels, styling components, and using color coding and icons. The improvements address theme compliance issues, add missing functionality, restructure navigation for better usability, fix data display bugs, and most importantly, create a cohesive and predictable user experience through consistent design patterns across all views and interactions.

## Glossary

- **Secan**: The Elasticsearch web admin tool (rewrite of Cerebro)
- **Overview_Table**: The table displaying shard distribution across nodes in the cluster
- **Topology_Tab**: New dedicated tab for displaying the Overview_Table with filters
- **Node_Modal**: Modal dialog displaying detailed information about a specific node
- **Index_Modal**: Modal dialog displaying detailed information about a specific index
- **Shard_State**: The current state of a shard (STARTED, UNASSIGNED, INITIALIZING, RELOCATING)
- **Theme**: Visual appearance mode (light, dark, or system)
- **Mantine_UI**: The React component library used for the frontend
- **Context_Menu**: Action menu displayed for table rows (index operations, etc.)
- **Details_Modal**: Modal dialog pattern used consistently for displaying detailed information (nodes, indices, shards)
- **Consistency_Pattern**: Uniform approach to UI elements, navigation, styling, and information display across the application

## Requirements

### Requirement 1: UI Consistency Framework

**User Story:** As a user, I want consistent patterns across all views and interactions, so that I can predict how the interface will behave and quickly learn new features.

#### Acceptance Criteria

1. THE System SHALL use the Details_Modal pattern for all detail views (nodes, indices, shards)
2. THE System SHALL make all Details_Modal views directly linkable via URL
3. THE System SHALL apply consistent label formatting across all views (capitalization, punctuation, terminology)
4. THE System SHALL use consistent search field styling and grouping patterns across all list views
5. THE System SHALL apply consistent color coding for states (shard states, health status, etc.) across all views
6. THE System SHALL use consistent icon sets and icon placement patterns across all views
7. THE System SHALL apply consistent table styling (headers, rows, hover states, selection) across all tables
8. THE System SHALL use consistent action menu patterns (Context_Menu) across all list views
9. THE System SHALL apply consistent spacing, padding, and layout patterns following Mantine_UI design system
10. THE System SHALL use consistent navigation patterns (links, buttons, breadcrumbs) across all views
11. THE System SHALL apply consistent empty state messaging and error handling patterns
12. THE System SHALL use consistent loading indicators and skeleton screens across all async operations

### Requirement 2: Branding Enhancement

**User Story:** As a user, I want to understand what "secan" means, so that I can appreciate the tool's name and branding.

#### Acceptance Criteria

1. WHEN a user hovers over the "secan" title in the top left corner, THEN the System SHALL display a Mantine tooltip
2. THE Tooltip SHALL contain the meaning or expansion of "secan"
3. THE Tooltip SHALL follow the current theme styling (light/dark/system)
4. THE Tooltip SHALL appear within 200ms of hover and disappear when hover ends

### Requirement 3: Theme-Compliant Tooltips

**User Story:** As a user using light theme, I want all tooltips to follow the theme, so that the interface is visually consistent.

#### Acceptance Criteria

1. WHEN the application is in light theme, THEN the System SHALL display all tooltips with light theme styling
2. WHEN the application is in dark theme, THEN the System SHALL display all tooltips with dark theme styling
3. WHEN the application is in system theme, THEN the System SHALL display all tooltips matching the system preference
4. THE Statistics_Tab tooltips SHALL NOT have black backgrounds in light theme
5. FOR ALL tooltips across the application, the System SHALL apply consistent theme-aware styling

### Requirement 4: Responsive Table Pagination

**User Story:** As a user on different screen sizes, I want the table pagination to adapt to my screen, so that I can view an appropriate amount of data without excessive scrolling.

#### Acceptance Criteria

1. WHEN the screen width is large (≥1200px) or extra-large (≥1536px), THEN the System SHALL set the default "per page" value to 10
2. WHEN the screen width is medium (≥768px and <1200px), THEN the System SHALL set the default "per page" value to 7
3. WHEN the screen width is small (<768px), THEN the System SHALL set the default "per page" value to 5
4. THE Overview_Table column widths SHALL auto-fit the available horizontal space
5. THE Overview_Table "node" column SHALL maintain a fixed width
6. THE Overview_Table SHALL NOT display a horizontal scrollbar under normal viewing conditions

### Requirement 5: Shard State Filtering

**User Story:** As a cluster administrator, I want to filter shards by their state, so that I can focus on specific shard conditions.

#### Acceptance Criteria

1. THE System SHALL provide a multi-select filter for shard states in the cluster overview
2. THE Shard_State filter SHALL include all possible shard states (STARTED, UNASSIGNED, INITIALIZING, RELOCATING)
3. WHEN the page loads, THEN the System SHALL select all shard states by default
4. WHEN a user deselects a shard state, THEN the System SHALL hide shards with that state from the Overview_Table
5. WHEN a user selects a previously deselected state, THEN the System SHALL show shards with that state in the Overview_Table
6. THE Shard_State filter SHALL be positioned with existing filters in the interface

### Requirement 6: Navigation Restructuring

**User Story:** As a user, I want a dedicated topology view, so that I can clearly separate general cluster statistics from detailed shard distribution.

#### Acceptance Criteria

1. THE System SHALL create a new "Topology" tab in the cluster view
2. THE Topology_Tab SHALL contain the Overview_Table with all existing filters and shard relocation functionality
3. THE Overview tab SHALL retain only general cluster statistics (not the Overview_Table)
4. THE Tab order SHALL be: Overview → Topology → Statistics → (remaining tabs)
5. WHEN a user navigates to the Topology tab, THEN the System SHALL display the Overview_Table with current cluster data
6. THE Topology_Tab SHALL maintain all existing Overview_Table functionality (filters, sorting, shard relocation)

### Requirement 7: Node Navigation Links

**User Story:** As a cluster administrator, I want to click on node names to view node details, so that I can quickly navigate from the topology view to specific node information.

#### Acceptance Criteria

1. WHEN a node name is displayed in the Overview_Table, THEN the System SHALL render it as a clickable link
2. WHEN a user clicks a node name link, THEN the System SHALL navigate to the nodes list view
3. WHEN the nodes list view loads from a node link, THEN the System SHALL automatically open the Node_Modal for that specific node
4. THE Node link SHALL provide visual feedback on hover (underline, color change, or cursor change)
5. THE Node link SHALL be keyboard accessible (focusable and activatable via Enter key)

### Requirement 8: Node Details Modal Pattern

**User Story:** As a user, I want to view node details in a modal with a shareable link, so that I can easily reference specific nodes and maintain context of my current view.

#### Acceptance Criteria

1. THE System SHALL display node details in a modal dialog (Node_Modal)
2. WHEN a user opens a Node_Modal, THEN the System SHALL update the URL to include the node identifier
3. WHEN a user navigates to a URL with a node identifier, THEN the System SHALL open the Node_Modal for that node
4. WHEN the Node_Modal is opened from the Overview_Table, THEN the System SHALL display the modal over the Topology_Tab
5. WHEN the Node_Modal is opened from the nodes list, THEN the System SHALL display the modal over the nodes list
6. WHEN the Node_Modal is opened from the shards list, THEN the System SHALL display the modal over the shards list
7. THE Node_Modal SHALL NOT include a "back to nodes list" button
8. WHEN a user closes the Node_Modal, THEN the System SHALL remove the node identifier from the URL and return to the previous view

### Requirement 9: Shards List Data Accuracy

**User Story:** As a cluster administrator, I want to see accurate shard information in the shards list, so that I can make informed decisions about shard management.

#### Acceptance Criteria

1. WHEN the shards list displays a shard, THEN the System SHALL show the actual shard size (not "N/A")
2. WHEN the shards list displays a shard, THEN the System SHALL show the actual document count (not "N/A")
3. IF shard data is unavailable from the Elasticsearch API, THEN the System SHALL display "0" or an appropriate indicator
4. THE System SHALL fetch complete shard statistics from the Elasticsearch cluster
5. FOR ALL shards in the shards list, the System SHALL display size and document count accurately

### Requirement 10: Unified Index Actions Menu

**User Story:** As a user managing indices, I want a single consolidated actions menu, so that I can access all index operations from one place.

#### Acceptance Criteria

1. THE System SHALL provide a single Context_Menu for each index in the index list table
2. THE Context_Menu SHALL contain all index operations previously split across two menus
3. THE "Index Management" options SHALL be merged into the "Index Operations" menu
4. WHEN a user opens the Context_Menu, THEN the System SHALL display all available actions in a single menu
5. THE Context_Menu SHALL maintain logical grouping of related actions (separators between groups)
6. THE System SHALL remove the second separate context menu from the index list table

### Requirement 11: Unassigned Shard Type Display

**User Story:** As a cluster administrator, I want to see whether unassigned shards are primary or replica, so that I can understand the severity and nature of the unassigned state.

#### Acceptance Criteria

1. WHEN an unassigned shard is displayed in the shards list, THEN the System SHALL indicate whether it is a primary or replica shard
2. WHEN an unassigned shard is displayed in the index list, THEN the System SHALL indicate whether it is a primary or replica shard
3. WHEN an unassigned shard is displayed in the Overview_Table, THEN the System SHALL indicate whether it is a primary or replica shard
4. THE System SHALL use a consistent visual indicator for primary vs replica shards (icon, label, or badge)
5. FOR ALL unassigned shards across all views, the System SHALL provide shard type information

### Requirement 12: Overview Table Visual Consistency

**User Story:** As a user, I want the overview table to have consistent row styling, so that the interface is clean and shard states are indicated by their badges rather than row backgrounds.

#### Acceptance Criteria

1. THE Overview_Table unassigned shards row SHALL have the same background color as other rows
2. THE System SHALL NOT apply special background coloring to the unassigned shards row
3. THE Shard state SHALL be indicated by color badges within cells (not row background)
4. WHEN the theme changes, THEN the System SHALL maintain consistent row backgrounds across all rows
5. THE Overview_Table SHALL maintain visual consistency with other tables in the application

### Requirement 13: Special Indices Filter

**User Story:** As a cluster administrator, I want to hide system/internal indices by default, so that I can focus on application indices without clutter from Elasticsearch internal indices.

#### Acceptance Criteria

1. THE System SHALL NOT display indices starting with "." by default in the index list
2. THE System SHALL NOT display indices starting with "." by default in the shards list
3. THE System SHALL NOT display indices starting with "." by default in the Overview_Table
4. THE System SHALL provide a checkbox to show/hide special indices
5. THE Checkbox SHALL be labeled "Show special indices" or similar descriptive text
6. WHEN the checkbox is unchecked, THEN the System SHALL hide all indices starting with "."
7. WHEN the checkbox is checked, THEN the System SHALL display all indices including those starting with "."
8. THE Checkbox default state SHALL be unchecked (special indices hidden)
9. THE System SHALL maintain consistency with the existing checkbox in the Overview_Table

### Requirement 14: Shards List Statistics Display

**User Story:** As a user, I want shard statistics displayed in a compact format, so that the interface is consistent with other views and doesn't waste vertical space.

#### Acceptance Criteria

1. THE System SHALL replace the large statistics box above the shards list table
2. THE System SHALL display shard statistics in compact cards similar to the overview statistics cards
3. THE Statistics cards SHALL match the visual style of the overview statistics cards (nodes/indices/shards/memory/disk)
4. THE Statistics cards SHALL maintain the same information as the current large box
5. THE System SHALL use consistent layout and spacing with other statistics displays

### Requirement 15: Dashboard Loading Skeleton

**User Story:** As a user, I want to see a loading skeleton on the main dashboard, so that I have visual feedback while clusters are loading.

#### Acceptance Criteria

1. WHEN the main dashboard is loading clusters, THEN the System SHALL display a loading skeleton
2. THE Loading skeleton SHALL use Mantine Skeleton component
3. THE Loading skeleton SHALL match the pattern used in other views (cluster view tabs)
4. WHEN clusters finish loading, THEN the System SHALL replace the skeleton with actual cluster data
5. THE Loading skeleton SHALL provide appropriate visual feedback for the clusters list layout

### Requirement 16: Backend Logging Level Adjustment

**User Story:** As a system administrator, I want verbose operational logs at debug level, so that production logs are cleaner and more focused on important events.

#### Acceptance Criteria

1. THE System SHALL change "returning... clusters" log from INFO to DEBUG level
2. THE System SHALL change "found shard stats" log from INFO to DEBUG level
3. THE System SHALL change "request completed" log from INFO to DEBUG level
4. THE System SHALL maintain ERROR and WARNING logs at appropriate levels
5. THE System SHALL keep important operational events at INFO level

### Requirement 17: API URL Double Slash Investigation

**User Story:** As a developer, I want to identify and fix the double slash bug in API calls, so that API requests are properly formatted.

#### Acceptance Criteria

1. THE System SHALL NOT generate API URLs with double slashes (e.g., `/api/clusters//stats`)
2. THE Investigation SHALL identify the source of double slashes in API client or SDK configuration
3. THE System SHALL use SDK calls for all API requests except Console feature
4. THE Console feature MAY make custom HTTP calls from cluster view (this is expected behavior)
5. THE Fix SHALL ensure all API URLs are properly formatted with single slashes
