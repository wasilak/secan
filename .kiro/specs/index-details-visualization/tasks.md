# Implementation Plan: Index Details Visualization

## Overview

This implementation plan adds an APM-style visualization tab to the existing Index Details Modal. The visualization shows shard distribution across nodes, with the index in the center, primary shard nodes on the left, and replica shard nodes on the right. 

**Key Insight**: This feature leverages existing infrastructure - the Index Details Modal, shard API endpoints (`getShards`, `getNodeShards`, `getShardStats`), and shard data structures (`ShardInfo`, `NodeWithShards`) are already implemented. We only need to add a new "Visualization" tab and create the visualization component.

## Tasks

- [x] 1. Create IndexVisualization component structure
  - Create `frontend/src/components/IndexVisualization.tsx` component
  - Define TypeScript interfaces for props (clusterId, indexName, onNodeClick)
  - Component will consume existing `ShardInfo[]` data from `getShards()` API
  - Filter shards by index name within the component
  - _Requirements: 1.1, 7.1_

- [ ] 2. Implement data fetching using existing API
  - [x] 2.1 Create custom hook for index shard data
    - Create `useIndexShards` hook that wraps existing `getShards()` API
    - Filter returned shards to only include shards for the specific index
    - Use TanStack Query with 30-second cache time
    - Configure automatic refetching every 30 seconds
    - _Requirements: 9.1, 9.5, 7.4_
  
  - [x] 2.2 Fetch node information using existing API
    - Use existing `getNodes()` API to get node details for tooltips
    - Leverage existing `NodeInfo` type with heap, disk, CPU data
    - _Requirements: 9.2, 4.1_
  
  - [ ]* 2.3 Write unit tests for data filtering
    - Test shard filtering by index name
    - Test handling of empty shard arrays
    - Test error states
    - _Requirements: 9.3_

- [ ] 3. Implement data transformation logic
  - [x] 3.1 Group shards by node
    - Separate shards into primary and replica groups
    - Group shards by node for each group
    - Handle nodes with both primary and replica shards (appear on both sides)
    - Calculate total shard counts per node
    - _Requirements: 2.1, 2.2, 2.5_
  
  - [ ]* 3.2 Write property test for shard count matching
    - **Property 5: Shard counts match actual allocation**
    - **Validates: Requirements 2.2**
  
  - [x] 3.3 Handle unassigned shards
    - Filter shards with no node assignment
    - Collect unassigned shards into separate array
    - _Requirements: 3.5_

- [ ] 4. Implement SVG-based visualization rendering
  - [x] 4.1 Implement center index element
    - Render center index card with index name
    - Display index health status with color coding (reuse existing `getHealthColor` utility)
    - Display total primary and replica shard counts
    - _Requirements: 1.1, 4.4, 4.5_
  
  - [x] 4.2 Implement node positioning logic
    - Calculate positions for primary nodes on left side
    - Calculate positions for replica nodes on right side
    - Handle vertical spacing for multiple nodes
    - _Requirements: 1.2, 1.3, 2.3, 2.4_
  
  - [x] 4.3 Implement visual connections
    - Draw SVG lines connecting center index to each node
    - Use appropriate line styling (color, width, curve)
    - _Requirements: 1.4_
  
  - [ ]* 4.4 Write property test for node positioning
    - **Property 1: Primary shard nodes positioned on left**
    - **Property 2: Replica shard nodes positioned on right**
    - **Validates: Requirements 1.2, 1.3, 2.3, 2.4**

- [ ] 5. Implement node cards with shard indicators
  - [x] 5.1 Render node card with name and shard count
    - Display node name
    - Display total shard count for the node
    - Apply Mantine Card and Badge components for consistency
    - _Requirements: 2.1, 2.2_
  
  - [x] 5.2 Render shard indicators with health colors
    - Display individual shard indicators (reuse pattern from `ShardCell` component)
    - Apply color coding based on shard state (reuse existing `getShardStateColor` utility)
    - Display shard numbers for primary shards
    - Display shard and replica numbers for replica shards
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 6.1, 6.2_
  
  - [ ]* 5.3 Write property test for health status color mapping
    - **Property 6: Health status color mapping**
    - **Validates: Requirements 3.1, 3.2, 3.3, 3.4**

- [ ] 6. Implement interactive elements
  - [x] 6.1 Implement node hover tooltips
    - Add hover event handlers to node cards
    - Display Mantine Tooltip with node details (name, ID, shard count, heap, disk, CPU)
    - Reuse existing node data from `NodeInfo` type
    - _Requirements: 4.1_
  
  - [ ]* 6.2 Write property test for node hover tooltips
    - **Property 7: Node hover displays tooltip**
    - **Validates: Requirements 4.1**
  
  - [x] 6.3 Implement shard hover tooltips
    - Add hover event handlers to shard indicators
    - Display Mantine Tooltip with shard details (index, shard number, state, docs, size)
    - Reuse existing `formatBytes` utility for size formatting
    - _Requirements: 4.2_
  
  - [ ]* 6.4 Write property test for shard hover tooltips
    - **Property 8: Shard hover displays tooltip**
    - **Validates: Requirements 4.2**
  
  - [x] 6.5 Implement node click navigation
    - Add click event handlers to node cards
    - Use existing `openNodeModal` or `navigateToNode` pattern from ClusterView
    - Pass node ID to navigation handler
    - _Requirements: 4.3_
  
  - [ ]* 6.6 Write property test for node click navigation
    - **Property 9: Node click triggers navigation**
    - **Validates: Requirements 4.3**

- [ ] 7. Implement responsive layout
  - [x] 7.1 Implement viewport width adaptation
    - Calculate layout based on available viewport width
    - Stack nodes vertically when viewport width < 768px (reuse responsive patterns from ShardGrid)
    - Recalculate layout on window resize using `useMediaQuery` hook
    - _Requirements: 8.1, 8.2, 8.5_
  
  - [ ]* 7.2 Write property test for layout adaptation
    - **Property 16: Layout adapts to viewport width**
    - **Validates: Requirements 8.1, 8.5**
  
  - [x] 7.3 Implement responsive font sizes
    - Scale font sizes based on zoom level
    - Ensure readability at different viewport sizes
    - _Requirements: 8.4_
  
  - [ ]* 7.4 Write property test for responsive font sizes
    - **Property 17: Font sizes scale responsively**
    - **Validates: Requirements 8.4**

- [ ] 8. Implement visualization controls
  - [x] 8.1 Implement zoom controls
    - Add zoom in, zoom out, and reset zoom buttons using Mantine ActionIcon
    - Update SVG transform scale on zoom changes
    - Maintain zoom level state
    - _Requirements: 5.5_
  
  - [x] 8.2 Implement node search/filter
    - Add Mantine TextInput for search
    - Filter displayed nodes based on search query
    - Update visualization to show only matching nodes
    - _Requirements: 5.4_
  
  - [ ]* 8.3 Write property test for node filter
    - **Property 11: Node filter reduces displayed nodes**
    - **Validates: Requirements 5.4**
  
  - [x] 8.4 Implement export functionality
    - Add export buttons for PNG and SVG formats using Mantine Menu
    - Generate PNG image using html-to-image library
    - Generate SVG by serializing SVG DOM
    - Include index name and timestamp in exported image
    - Trigger file download
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_
  
  - [ ]* 8.5 Write property test for export metadata
    - **Property 19: Exported image contains metadata**
    - **Validates: Requirements 10.4**

- [ ] 9. Handle large-scale deployments
  - [-] 9.1 Implement scrolling for many nodes
    - Add Mantine ScrollArea when more than 10 nodes
    - Maintain visual clarity with scroll indicators
    - _Requirements: 5.1, 5.2_
  
  - [~] 9.2 Implement node grouping for very large clusters
    - Group nodes by shard count when more than 20 nodes
    - Display grouped nodes with Mantine Collapse for expand/collapse
    - _Requirements: 5.3_

- [ ] 10. Add visualization tab to Index Details Modal
  - [~] 10.1 Update IndexEdit component to add Visualization tab
    - Add new Tabs.Tab with value="visualization" and icon (IconMap or IconTopology)
    - Position as FIRST tab (before Settings, Mappings, Stats)
    - Set as DEFAULT active tab when modal opens
    - Update tab change handler to support "visualization" value
    - _Requirements: 7.1, 7.2_
  
  - [~] 10.2 Update IndexEdit to render IndexVisualization component
    - Add Tabs.Panel for "visualization" tab
    - Render IndexVisualization component with clusterId and indexName props
    - Pass openNodeModal handler from ClusterView context
    - Display loading state while fetching shard data
    - _Requirements: 7.2, 7.5_
  
  - [~] 10.3 Update default tab logic in ClusterView
    - Modify openIndexModal to default to "visualization" tab instead of "general"
    - Update URL parameter handling to set "indexTab=visualization" by default
    - Ensure backward compatibility with direct tab navigation
    - _Requirements: 7.1, 7.3_
  
  - [ ]* 10.4 Write integration test for tab navigation
    - Test visualization tab is first in tab list
    - Test visualization tab is active by default when modal opens
    - Test switching between tabs preserves state
    - _Requirements: 7.1, 7.2, 7.3_

- [ ] 11. Implement automatic refresh
  - [~] 11.1 Configure TanStack Query refetch interval
    - Set refetchInterval to 30000ms in useIndexShards hook
    - Display subtle refresh indicator when data is being updated
    - _Requirements: 7.4_
  
  - [ ]* 11.2 Write property test for automatic refresh
    - **Property 15: Visualization refreshes on allocation changes**
    - **Validates: Requirements 7.4**

- [ ] 12. Implement error handling and edge cases
  - [~] 12.1 Handle API errors in frontend
    - Display Mantine Alert when shard data fetch fails
    - Provide retry button for failed requests
    - Handle empty shard arrays gracefully
    - _Requirements: 9.3_
  
  - [~] 12.2 Handle edge cases in visualization
    - Display only left side when index has no replicas
    - Display node on both sides when it has both primary and replica shards
    - Display unassigned shards in separate section at bottom
    - Show relocating shard with source and target indicators (reuse pattern from ShardGrid)
    - Show initializing shard with progress indicator
    - _Requirements: 1.5, 2.5, 3.5, 6.4, 6.5_
  
  - [ ]* 12.3 Write unit tests for edge cases
    - Test index with no replicas
    - Test node with both primary and replica shards
    - Test unassigned shards display
    - Test relocating shard display
    - Test initializing shard display
    - _Requirements: 1.5, 2.5, 3.5, 6.4, 6.5_

- [~] 13. Final checkpoint - Complete feature verification
  - Ensure frontend builds with `npm run build` and passes `npm test`
  - Manually test complete flow: open index details modal → visualization tab is first and active
  - Test with real Elasticsearch cluster (various index configurations)
  - Test responsive behavior at different screen sizes
  - Test export functionality generates valid files
  - Test all interactive elements (hover, click, zoom, filter)
  - Test automatic refresh updates visualization
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across randomized inputs
- Unit tests validate specific examples and edge cases

## Key Implementation Strategy

**Leverage Existing Infrastructure**:
- ✅ Index Details Modal already exists in `ClusterView.tsx` using `IndexEdit` component
- ✅ Shard API endpoints already implemented: `getShards()`, `getNodeShards()`, `getShardStats()`
- ✅ Shard data types already defined: `ShardInfo`, `NodeWithShards`, `DetailedShardStats`
- ✅ Shard components exist: `ShardList`, `ShardGrid`, `ShardStatsModal`
- ✅ Utility functions exist: `formatBytes`, `getHealthColor`, `getShardStateColor`
- ✅ Responsive patterns exist in `ShardGrid` component

**What We're Building**:
- 🆕 New "Visualization" tab (first position, active by default) in Index Details Modal
- 🆕 `IndexVisualization` component with APM-style layout
- 🆕 Custom hook `useIndexShards` to filter existing shard data by index
- 🆕 SVG-based visualization with center index, left primary nodes, right replica nodes

**No Backend Work Required**: All necessary APIs and data structures already exist!
