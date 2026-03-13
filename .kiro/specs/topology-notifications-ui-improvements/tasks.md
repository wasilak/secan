# Implementation Plan: Topology Notifications and UI Improvements

## Overview

This implementation plan covers UI/UX improvements and bugfixes for the topology visualization, notifications system, and cluster status display. The tasks are organized to build incrementally, with testing integrated throughout to catch errors early.

## Tasks

- [x] 1. Create utility modules for color mapping and shard ordering
  - [x] 1.1 Update color utility functions in `utils/colors.ts`
    - Update `getShardBorderColor()` to include RELOCATING state with orange-6 color
    - Update `getShardBorderColor()` to use blue-4 for INITIALIZING state
    - Implement `getUnassignedShardColor(isPrimary)` function for differentiated red colors
    - Ensure all shard states have distinct, visually different colors
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  
  - [ ]* 1.2 Write property test for color mapping
    - **Property 8: Shard Color Consistency**
    - **Validates: Requirements 5.1, 5.2, 5.6, 7.1, 7.2, 7.3, 7.5**
  
  - [x] 1.3 Create shard ordering utility in `utils/shardOrdering.ts`
    - Implement `sortShards()` function with deterministic ordering algorithm
    - Sort by: index name (alphabetical), shard number (numerical), primary before replica, state priority
    - Export function for use across components
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ]* 1.4 Write property test for shard ordering
    - **Property 12: Deterministic Shard Ordering**
    - **Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

- [x] 2. Implement cluster change detection and notification system
  - [x] 2.1 Create cluster state comparison utility in `utils/clusterDiff.ts`
    - Implement `detectClusterChanges()` function to compare previous and current cluster states
    - Identify nodes added/removed by comparing node IDs
    - Identify indices created/deleted by comparing index names
    - Return structured `ClusterChanges` object
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [ ]* 2.2 Write property test for cluster change detection
    - **Property 1: Cluster Change Detection**
    - **Validates: Requirements 1.1, 1.2, 1.3, 1.4**
  
  - [x] 2.3 Create `useClusterChanges` hook in `hooks/useClusterChanges.ts`
    - Use `useRef` to store previous cluster state
    - Call `detectClusterChanges()` on state updates
    - Return `ClusterChanges` object or null
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 2.4 Create `ClusterChangeNotifier` component
    - Consume changes from `useClusterChanges` hook
    - Trigger Mantine toast notifications for each change type
    - Configure notifications: 5 second auto-dismiss, top-right position, color coding
    - Use blue for additions (nodes/indices), orange for removals
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_
  
  - [ ]* 2.5 Write property test for notification auto-dismiss
    - **Property 2: Notification Auto-Dismiss**
    - **Validates: Requirements 1.5**
  
  - [ ]* 2.6 Write unit tests for notification component
    - Test notification triggering for each change type
    - Test notification configuration (timeout, position, colors)
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6_

- [x] 3. Checkpoint - Verify notification system
  - Ensure all tests pass, ask the user if questions arise.

- [x] 4. Implement allocation lock status indicator
  - [x] 4.1 Create `AllocationLockIndicator` component in `components/Topology/AllocationLockIndicator.tsx`
    - Accept `allocationState`, `clusterName`, and `clusterVersion` props
    - Map allocation states to Tabler icons: all→IconLockOpen, primaries→IconLockHalf, new_primaries→IconLockAccess, none→IconLock
    - Add tooltip with allocation status explanation
    - Style for far-right positioning in cluster header
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7_
  
  - [ ]* 4.2 Write property test for allocation state icon mapping
    - **Property 3: Allocation State Icon Mapping**
    - **Validates: Requirements 2.3, 2.4, 2.5, 2.6**
  
  - [x] 4.3 Integrate `AllocationLockIndicator` into topology view header
    - Add component to cluster header on same line as cluster name and version
    - Position at maximum right of display area
    - Ensure visibility during scrolling
    - _Requirements: 2.1, 2.2, 2.7_
  
  - [ ]* 4.4 Write unit tests for allocation lock indicator
    - Test icon rendering for each allocation state
    - Test tooltip content
    - _Requirements: 2.3, 2.4, 2.5, 2.6_

- [x] 5. Fix shard state filtering and add relocating shard visibility
  - [x] 5.1 Update filter logic in `DotBasedTopologyView.tsx`
    - Modify `filteredShards` logic to always include shards in ANY state
    - Maintain index filter logic
    - Apply `sortShards()` to filtered results
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.3_
  
  - [x] 5.2 Update filter logic in `IndexVisualization.tsx`
    - Apply same RELOCATING bypass logic as dot view
    - Ensure consistent filtering behavior across views
    - Apply `sortShards()` to filtered results
    - _Requirements: 3.1, 3.2, 4.1, 4.2, 4.3, 4.4, 9.1, 9.2, 9.3_
  
  - [ ]* 5.3 Write property test for shard state filter behavior
    - **Property 6: Shard State Filter Behavior**
    - **Validates: Requirements 4.1, 4.3, 4.4**
  
  - [ ]* 5.4 Write property test for relocating shard visibility
    - **Property 4: Relocating Shard Visibility**
    - **Validates: Requirements 3.1, 3.2, 3.6**
  
  - [x] 5.3 Ensure filter state persistence in URL params
    - Verify filter state is stored in URL parameters
    - Test navigation and return to verify persistence
    - _Requirements: 4.5_
  
  - [ ]* 5.6 Write property test for filter state persistence
    - **Property 7: Filter State Persistence**
    - **Validates: Requirements 4.5**

- [x] 6. Implement relocating shard visual indicators in dot view
  - [x] 6.1 Update `ShardDot.tsx` component
    - Add `isSource` and `isDestination` props to `ShardDotProps`
    - Implement visual treatment: source node with solid yellow border, destination with dotted yellow border
    - Use orange-6 color for relocating shards
    - _Requirements: 3.3, 3.4, 3.6_
  
  - [x] 6.2 Add hover interaction for relocating shards
    - Implement SVG overlay to show curved line connecting source and destination nodes
    - Trigger on hover over relocating shard
    - _Requirements: 3.5_
  
  - [ ]* 6.3 Write property test for relocating shard visual indicators
    - **Property 5: Relocating Shard Visual Indicators**
    - **Validates: Requirements 3.3, 3.4**
  
  - [ ]* 6.4 Write unit tests for relocating shard display
    - Test source node styling (solid border)
    - Test destination node styling (dotted border)
    - Test hover interaction
    - _Requirements: 3.3, 3.4, 3.5_

- [-] 7. Checkpoint - Verify filtering and relocating shard features
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 8. Enhance dot view with additional node metrics
  - [ ] 8.1 Update `NodeInfo` interface to include new fields
    - Add `ip: string` field
    - Add `cpuPercent?: number` field
    - Add `loadAverage?: number[]` field (1m, 5m, 15m)
    - Add `version?: string` field for Elasticsearch version
    - _Requirements: 6.1, 6.3, 6.4, 6.5_
  
  - [ ] 8.2 Update `NodeCard.tsx` component layout
    - Display node IP to the right of node name with reduced visual prominence
    - Add CPU utilization display with color coding (green <70%, yellow 70-85%, red >85%)
    - Add load average display with color coding (green <cores, yellow cores-1.5x, red >1.5x)
    - Add Elasticsearch version display
    - Maintain existing heap and disk metrics
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  
  - [ ]* 8.3 Write property test for metric color coding
    - **Property 11: Metric Color Coding**
    - **Validates: Requirements 6.3, 6.4**
  
  - [ ]* 8.4 Write unit tests for node card enhancements
    - Test IP display and styling
    - Test CPU color coding thresholds
    - Test load average color coding thresholds
    - Test version display
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 9. Apply color consistency to node details modal
  - [ ] 9.1 Update `NodeModal.tsx` to use shared color utilities
    - Import and use `getShardBorderColor()` from `utils/colors.ts`
    - Import and use `getUnassignedShardColor()` from `utils/colors.ts`
    - Apply same color scheme as topology views
    - Apply `sortShards()` to shard lists in modal
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 9.4_
  
  - [ ]* 9.2 Write unit tests for node modal color consistency
    - Test INITIALIZING shards use blue-4
    - Test RELOCATING shards use orange-6
    - Test unassigned primary shards use red-6
    - Test unassigned replica shards use red-4
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [ ] 10. Update side drawer cluster name styling
  - [ ] 10.1 Update `AppShell.tsx` cluster name styling
    - Apply larger font size (16px) and bold weight (700) to cluster names
    - Apply blue-6 color to cluster names
    - Apply smaller font size (14px) and normal weight (400) to submenu items
    - Apply gray-7 color to submenu items
    - Ensure consistent spacing and indentation
    - _Requirements: 8.1, 8.2, 8.3, 8.4_
  
  - [ ]* 10.2 Write property test for cluster name visual distinction
    - **Property 13: Cluster Name Visual Distinction**
    - **Validates: Requirements 8.1, 8.2, 8.3**
  
  - [ ]* 10.3 Write unit tests for side drawer styling
    - Test cluster name font size and weight
    - Test submenu item font size and weight
    - Test color differentiation
    - _Requirements: 8.1, 8.2, 8.3_

- [ ] 11. Checkpoint - Verify visual enhancements
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement modal stack management system
  - [ ] 12.1 Create `useModalStack` hook in `hooks/useModalStack.ts`
    - Implement modal stack state with `useState`
    - Implement `pushModal()` function to add modal to stack
    - Implement `popModal()` function to remove top modal
    - Implement `clearModals()` function to empty stack
    - Return `modalStack`, `topModal`, and management functions
    - Handle edge cases: duplicate modals, pop on empty stack
    - _Requirements: 10.6, 10.7, 10.8_
  
  - [ ]* 12.2 Write property test for layered modal close behavior
    - **Property 16: Layered Modal Close Behavior**
    - **Validates: Requirements 10.6, 10.7, 10.8**
  
  - [ ]* 12.3 Write unit tests for modal stack management
    - Test push operation
    - Test pop operation
    - Test clear operation
    - Test empty stack handling
    - Test duplicate modal prevention
    - _Requirements: 10.6, 10.7, 10.8_

- [ ] 13. Implement shard context menu
  - [ ] 13.1 Create `ShardContextMenu` component in `components/ShardContextMenu.tsx`
    - Accept `shard`, `onDisplayShardDetails`, and `onDisplayIndexDetails` props
    - Generate menu title: `{index} / Shard {shard} (Primary|Replica)`
    - Add "Display shard details" menu item
    - Add "Display index details" menu item
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 13.2 Write property test for shard context menu title format
    - **Property 14: Shard Context Menu Title Format**
    - **Validates: Requirements 10.4**
  
  - [ ]* 13.3 Write unit tests for shard context menu
    - Test menu title format with primary shard
    - Test menu title format with replica shard
    - Test menu item rendering
    - Test menu item callbacks
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

- [ ] 14. Update modals for layered navigation support
  - [ ] 14.1 Update `ShardModal.tsx` for layered support
    - Add `isLayered` prop to `ShardModalProps`
    - Set z-index to 300 when layered, 200 otherwise
    - Keep `closeOnClickOutside` and `closeOnEscape` always true
    - Update modal title to show index, shard number, and type
    - _Requirements: 10.5, 10.6, 10.7_
  
  - [ ] 14.2 Update `IndexModal.tsx` for layered support
    - Add `onShardClick` prop to `IndexModalProps`
    - Add `hasModalAbove` prop to `IndexModalProps`
    - Implement `handleShardClick()` to only trigger for assigned shards (shard.node !== null)
    - Set `closeOnClickOutside` and `closeOnEscape` to `!hasModalAbove`
    - Pass `onShardClick` to shard visualization components
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_
  
  - [ ]* 14.3 Write property test for layered modal triggering
    - **Property 15: Layered Modal Triggering**
    - **Validates: Requirements 10.5, 10.9, 10.10**
  
  - [ ]* 14.4 Write unit tests for modal layering
    - Test shard modal z-index when layered
    - Test index modal close behavior with modal above
    - Test index modal close behavior without modal above
    - Test shard click handling for assigned shards
    - Test shard click handling for unassigned shards
    - _Requirements: 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [ ] 15. Integrate modal stack and context menu into topology views
  - [ ] 15.1 Update topology view components to use modal stack
    - Import and use `useModalStack` hook
    - Implement `handleShardContextMenu()` to show context menu with both options
    - Implement `handleShardClickInIndexModal()` to push shard modal for assigned shards
    - Render modals from modal stack with appropriate props
    - Pass `hasModalAbove` to index modals based on stack position
    - Pass `isLayered` to shard modals based on stack length
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8, 10.9_
  
  - [ ] 15.2 Update `ShardDot.tsx` to trigger context menu on right-click
    - Add right-click event handler
    - Call `onShardContextMenu` callback with shard data
    - _Requirements: 10.1, 10.2_
  
  - [ ] 15.3 Update shard visualization components in index modal
    - Add `onShardClick` prop to shard visualization components
    - Trigger callback when assigned shard is clicked
    - Do not trigger for unassigned shards
    - _Requirements: 10.5, 10.9, 10.10_
  
  - [ ]* 15.4 Write integration tests for modal navigation
    - Test context menu opens from shard right-click
    - Test "Display shard details" opens shard modal
    - Test "Display index details" opens index modal
    - Test clicking assigned shard in index modal opens layered shard modal
    - Test clicking unassigned shard in index modal does nothing
    - Test ESC closes only top modal when multiple modals open
    - Test ESC closes modal when only one modal open
    - _Requirements: 10.1, 10.2, 10.3, 10.5, 10.6, 10.7, 10.8, 10.9, 10.10_

- [ ] 16. Apply unassigned shard border styling
  - [ ] 16.1 Update shard components to remove borders for unassigned shards
    - Update `ShardCell.tsx` to set border-width to 0 for UNASSIGNED state
    - Update `ShardDot.tsx` to set border-width to 0 for UNASSIGNED state
    - Apply in node modal shard displays
    - _Requirements: 5.5_
  
  - [ ]* 16.2 Write property test for unassigned shard border style
    - **Property 10: Unassigned Shard Border Style**
    - **Validates: Requirements 5.5**
  
  - [ ]* 16.3 Write unit tests for unassigned shard styling
    - Test border-width is 0 for unassigned shards
    - Test border-width is non-zero for other states
    - _Requirements: 5.5_

- [ ] 17. Implement node role filter default state
  - [ ] 17.1 Update node role filter initialization logic
    - Modify node role filter component to initialize with all roles enabled by default
    - Check if selectedRoles is empty on first load and initialize with all available roles
    - Ensure all nodes are visible when all role filters are enabled
    - Maintain visual consistency between filter state (checked) and filtering behavior (nodes shown)
    - _Requirements: 11.1, 11.2, 11.4_
  
  - [ ]* 17.2 Write property test for node role filter default state
    - **Property 17: Node Role Filter Default State**
    - **Validates: Requirements 11.1, 11.2, 11.4**
  
  - [ ]* 17.3 Write property test for node role filter behavior
    - **Property 18: Node Role Filter Behavior**
    - **Validates: Requirements 11.3, 11.4**
  
  - [ ]* 17.4 Write unit tests for node role filter
    - Test initialization with all roles enabled
    - Test filtering behavior when roles are unchecked
    - Test that all nodes are visible with all roles enabled
    - Test that nodes are hidden when their role filter is unchecked
    - _Requirements: 11.1, 11.2, 11.3, 11.4_

- [ ] 18. Final checkpoint - Comprehensive testing and verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at logical breaks
- Property tests validate universal correctness properties from the design document
- Unit tests validate specific examples and edge cases
- Integration tests verify end-to-end functionality
- All color utilities are centralized in `utils/colors.ts` for consistency
- Shard ordering is centralized in `utils/shardOrdering.ts` for consistency
- Modal stack management enables layered modal navigation
- Context menu provides access to both shard and index details
