# Implementation Plan: UI/UX Improvements and Refinements

## Overview

This implementation plan breaks down the UI/UX improvements into discrete, incremental tasks that build upon each other. The plan follows a phased approach to minimize risk, starting with low-risk foundational improvements and progressing to more complex restructuring and modal pattern changes.

The implementation focuses on establishing consistency across the application through uniform patterns for modals, navigation, tables, theming, and visual indicators.

## Tasks

- [x] 1. Phase 1: Foundation - Low Risk Improvements
  - Implement basic improvements that don't require major restructuring
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 5.1, 5.2, 5.3, 5.4, 5.5_

  - [x] 1.1 Add branding tooltip to Secan title
    - Modify `frontend/src/components/AppShell.tsx`
    - Wrap "Secan" title in Mantine Tooltip component
    - Add tooltip text explaining "Secan - Secure Elasticsearch Admin"
    - Ensure tooltip follows current theme (light/dark/system)
    - Add cursor: help style to indicate tooltip presence
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 1.2 Write unit test for branding tooltip
    - Test tooltip renders with correct text
    - Test tooltip follows theme (light/dark/system)
    - Test tooltip appears on hover
    - _Requirements: 2.1, 2.2, 2.3_

  - [x] 1.3 Audit and fix theme compliance for all tooltips
    - Search codebase for all Tooltip usages
    - Identify tooltips with hardcoded colors (especially in Statistics tab)
    - Replace hardcoded colors with Mantine theme colors
    - Verify all tooltips use Mantine's Tooltip component
    - Test in both light and dark themes
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

  - [ ]* 1.4 Write property test for theme-aware tooltips
    - **Property 2: Theme-Aware Tooltip Styling**
    - **Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.5**
    - Generate random theme settings (light, dark, system)
    - Render components with tooltips in each theme
    - Verify tooltips use theme colors (not hardcoded)
    - _Requirements: 2.3, 3.1, 3.2, 3.3, 3.5_

  - [x] 1.5 Create responsive page size hook
    - Create `frontend/src/hooks/useResponsivePageSize.ts`
    - Implement hook using useMediaQuery from Mantine
    - Return 10 for large/XL screens (≥1200px)
    - Return 7 for medium screens (768-1199px)
    - Return 5 for small screens (<768px)
    - Export hook for use in table components
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 1.6 Write unit tests for responsive page size hook
    - Test returns 10 for large screens
    - Test returns 7 for medium screens
    - Test returns 5 for small screens
    - Mock window.matchMedia for different breakpoints
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.7 Apply responsive page size to table components
    - Update `frontend/src/pages/ClusterView.tsx` (NodesList, IndicesList, ShardsList)
    - Import and use useResponsivePageSize hook
    - Set default page size from hook
    - Allow user override via URL params
    - Test on different screen sizes
    - _Requirements: 4.1, 4.2, 4.3_

  - [x] 1.8 Implement shard state filter component
    - Modify `frontend/src/pages/ClusterView.tsx` (ShardAllocationGrid section)
    - Add MultiSelect component for shard states
    - Include all states: STARTED, UNASSIGNED, INITIALIZING, RELOCATING
    - Set all states selected by default
    - Store selected states in component state
    - Position filter with existing filters
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.9 Implement shard state filtering logic
    - Filter shards based on selected states
    - Update displayed shards when filter changes
    - Ensure filter works with existing filters
    - Test with various state combinations
    - _Requirements: 5.4, 5.5_

  - [ ]* 1.10 Write property test for shard state filtering
    - **Property 4: Shard State Filter Behavior**
    - **Validates: Requirements 5.4, 5.5**
    - Generate random shard data with various states
    - Generate random filter selections
    - Apply filter and verify only selected states shown
    - Change filter and verify display updates
    - _Requirements: 5.4, 5.5_

- [x] 2. Checkpoint - Verify Phase 1 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Phase 2: Tab Restructuring and Menu Consolidation
  - Restructure tabs and consolidate menus
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 10.1, 10.2, 10.3, 10.4, 10.6_

  - [x] 3.1 Create Topology tab and restructure Overview tab
    - Modify `frontend/src/pages/ClusterView.tsx`
    - Add new "Topology" tab after Overview tab
    - Move ShardAllocationGrid from Overview to Topology tab
    - Keep only statistics cards in Overview tab
    - Update tab order: Overview → Topology → Statistics → ...
    - Preserve all filters and functionality in Topology tab
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [ ]* 3.2 Write unit tests for tab restructuring
    - Test Overview tab contains only statistics cards
    - Test Topology tab contains overview table
    - Test tab order is correct
    - Test navigation between tabs works
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_

  - [x] 3.3 Consolidate index action menus
    - Modify `frontend/src/pages/ClusterView.tsx` (IndicesList component)
    - Remove separate IndexOperations component call
    - Create single unified Menu component
    - Add all operations: Settings, Mappings, Open/Close, Refresh, Delete
    - Group operations with Menu.Divider and Menu.Label
    - Ensure all actions work correctly
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

  - [ ]* 3.4 Write unit tests for unified index menu
    - Test single menu contains all operations
    - Test menu items trigger correct actions
    - Test menu grouping with separators
    - Test menu opens and closes correctly
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.6_

- [x] 4. Checkpoint - Verify Phase 2 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Phase 3: Node Modal Pattern Implementation
  - Convert NodeDetail page to modal with URL synchronization
  - _Requirements: 1.2, 7.1, 7.2, 7.3, 7.5, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_

  - [x] 5.1 Create NodeModal component
    - Create `frontend/src/components/NodeModal.tsx`
    - Extract content from `frontend/src/pages/NodeDetail.tsx`
    - Wrap in Mantine Modal component
    - Add props: clusterId, nodeId, opened, onClose, context
    - Implement modal title with MasterIndicator and node name
    - Set modal size to 90% with scrollable body
    - _Requirements: 8.1_

  - [x] 5.2 Implement NodeDetailContent component
    - Extract node details rendering logic from NodeDetail page
    - Create reusable NodeDetailContent component
    - Accept nodeStats and loading props
    - Render all node information, charts, and statistics
    - Remove "Back to Nodes List" button
    - _Requirements: 8.7_

  - [x] 5.3 Add URL synchronization for node modal
    - Modify `frontend/src/pages/ClusterView.tsx`
    - Add nodeIdParam from searchParams
    - Add nodeModalOpen state
    - Implement openNodeModal function (updates URL)
    - Implement closeNodeModal function (removes URL param)
    - Sync modal state with URL using useEffect
    - _Requirements: 8.2, 8.3, 8.8_

  - [ ]* 5.4 Write property test for modal URL round trip
    - **Property 1: Modal URL Round Trip**
    - **Validates: Requirements 1.2, 8.2, 8.3**
    - Generate random node IDs
    - Open modal and verify URL contains node ID
    - Navigate to URL and verify modal opens
    - Close modal and verify URL is cleaned up
    - _Requirements: 1.2, 8.2, 8.3, 8.8_

  - [x] 5.5 Add node navigation links in overview table
    - Modify `frontend/src/components/ShardGrid.tsx`
    - Wrap node names in Anchor component
    - Add onClick handler to open node modal
    - Add hover styling (underline)
    - Ensure keyboard accessibility (Tab, Enter)
    - _Requirements: 7.1, 7.5_

  - [x] 5.6 Add node navigation links in nodes list
    - Modify `frontend/src/pages/ClusterView.tsx` (NodesList component)
    - Make node names clickable
    - Open node modal on click
    - Preserve context (nodes list)
    - _Requirements: 7.2, 7.3, 8.5_

  - [x] 5.7 Add node navigation links in shards list
    - Modify `frontend/src/pages/ClusterView.tsx` (ShardsList component)
    - Make node names clickable in shard rows
    - Open node modal on click
    - Preserve context (shards list)
    - _Requirements: 8.6_

  - [x] 5.8 Integrate NodeModal into ClusterView
    - Add NodeModal component to ClusterView
    - Pass clusterId, nodeId, opened, onClose props
    - Test modal opens from all contexts (topology, nodes, shards)
    - Test modal displays over correct view
    - Test URL updates and direct navigation
    - _Requirements: 8.4, 8.5, 8.6_

  - [ ]* 5.9 Write integration tests for node modal
    - Test clicking node name opens modal
    - Test modal displays over correct context
    - Test URL updates when modal opens
    - Test direct navigation to URL with node param
    - Test modal closes and URL cleans up
    - _Requirements: 7.1, 7.2, 7.3, 8.2, 8.3, 8.4, 8.5, 8.6, 8.8_

  - [x] 5.10 Add URL redirect for old NodeDetail page
    - Modify `frontend/src/router.tsx`
    - Add redirect from `/cluster/{id}/nodes/{nodeId}` to `/cluster/{id}?tab=nodes&node={nodeId}`
    - Ensure backward compatibility with existing bookmarks
    - Test redirect works correctly
    - _Requirements: 8.1_

- [x] 6. Checkpoint - Verify Phase 3 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Phase 4: Data Fixes and Visual Consistency
  - Fix shard data display and visual consistency issues
  - _Requirements: 9.1, 9.2, 9.3, 9.5, 11.1, 11.2, 11.3, 11.4, 11.5, 12.1, 12.2, 12.3, 12.4_

  - [x] 7.1 Enhance backend shard data API
    - Modify `backend/src/routes/shards.rs`
    - Update /_cat/shards API call to include docs and store fields
    - Add bytes="b" parameter for numeric byte values
    - Ensure all shard data includes size and document count
    - Return 0 for missing values (not null/undefined)
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 7.2 Update frontend ShardInfo type
    - Modify `frontend/src/types/api.ts`
    - Add docs: number field to ShardInfo
    - Add storeSize: number field to ShardInfo
    - Update all shard-related components to use new fields
    - _Requirements: 9.1, 9.2_

  - [x] 7.3 Update shards list to display complete data
    - Modify `frontend/src/pages/ClusterView.tsx` (ShardsList component)
    - Display shard.docs with toLocaleString() formatting
    - Display shard.storeSize with formatBytes() utility
    - Show 0 instead of N/A for missing data
    - Test with various shard data
    - _Requirements: 9.1, 9.2, 9.3, 9.5_

  - [ ]* 7.4 Write property test for complete shard data
    - **Property 5: Complete Shard Data Display**
    - **Validates: Requirements 9.1, 9.2, 9.5**
    - Generate random shard data (including incomplete data)
    - Render shards in list
    - Verify all shards show numeric values (never N/A)
    - Verify minimum value is 0 for missing data
    - _Requirements: 9.1, 9.2, 9.5_

  - [x] 7.5 Create ShardTypeBadge component
    - Create `frontend/src/components/ShardTypeBadge.tsx`
    - Accept primary: boolean prop
    - Render Badge with "P" for primary, "R" for replica
    - Use blue color for primary, gray for replica
    - Size: xs, variant: light
    - Export component
    - _Requirements: 11.4_

  - [ ]* 7.6 Write unit test for ShardTypeBadge
    - Test renders "P" for primary shards
    - Test renders "R" for replica shards
    - Test uses correct colors
    - _Requirements: 11.4_

  - [x] 7.7 Add shard type indicators to shards list
    - Modify `frontend/src/pages/ClusterView.tsx` (ShardsList component)
    - Import ShardTypeBadge component
    - Add ShardTypeBadge next to shard state badge
    - Display for all shards (especially unassigned)
    - _Requirements: 11.1, 11.5_

  - [x] 7.8 Add shard type indicators to index list
    - Modify `frontend/src/pages/ClusterView.tsx` (IndicesList component)
    - Add tooltip to unassigned count badge
    - Show list of unassigned shards with type (Primary/Replica)
    - Use ShardTypeBadge or text indicator
    - _Requirements: 11.2, 11.5_

  - [x] 7.9 Add shard type indicators to overview table
    - Modify `frontend/src/components/ShardCell.tsx`
    - Add ShardTypeBadge for unassigned shards
    - Display next to shard state badge
    - Ensure consistent styling with other views
    - _Requirements: 11.3, 11.5_

  - [ ]* 7.10 Write property test for shard type indication
    - **Property 6: Shard Type Indication Consistency**
    - **Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**
    - Generate random unassigned shards (primary and replica)
    - Render in all views (shards list, index list, overview table)
    - Verify type indicator appears in all views
    - Verify indicator is consistent across views
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

  - [x] 7.11 Remove special styling from unassigned shards row
    - Modify `frontend/src/components/ShardGrid.tsx`
    - Remove special backgroundColor from unassigned shards row
    - Use standard table striping
    - Rely on shard badges for state indication
    - Test in both light and dark themes
    - _Requirements: 12.1, 12.2, 12.3_

  - [ ]* 7.12 Write property test for table row styling
    - **Property 7: Consistent Table Row Styling**
    - **Validates: Requirements 12.1, 12.2, 12.3, 12.4**
    - Generate random table data including unassigned shards
    - Render overview table
    - Verify all rows have consistent background
    - Verify no special styling on unassigned row
    - Verify state indicated by badges, not row background
    - _Requirements: 12.1, 12.2, 12.3, 12.4_

- [x] 8. Checkpoint - Verify Phase 4 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 9. Final Integration and Testing
  - Verify all improvements work together
  - _Requirements: 1.5, 3.1, 3.2, 3.3, 3.5_

  - [x] 9.1 Verify consistent state color coding
    - Audit all components that display health status
    - Audit all components that display shard states
    - Ensure getHealthColor and getShardStateColor functions used consistently
    - Test same state produces same color across all views
    - _Requirements: 1.5_

  - [ ]* 9.2 Write property test for consistent state colors
    - **Property 3: Consistent State Color Coding**
    - **Validates: Requirements 1.5**
    - Generate random state values (health, shard states)
    - Render state in multiple components
    - Verify same state always produces same color
    - _Requirements: 1.5_

  - [x] 9.3 Run full test suite
    - Run all unit tests: `npm test`
    - Run all property tests
    - Run all integration tests
    - Fix any failing tests
    - Ensure 100% of tests pass

  - [x] 9.4 Perform manual testing
    - Follow manual testing checklist from design document
    - Test on multiple screen sizes (mobile, tablet, desktop)
    - Test in multiple browsers (Chrome, Firefox, Safari)
    - Test theme switching (light, dark, system)
    - Test all navigation flows
    - Test all modal interactions
    - Test all filters and sorting
    - Document any issues found

  - [x] 9.5 Update documentation
    - Update user documentation with new tab structure
    - Document modal navigation pattern
    - Update screenshots to reflect new UI
    - Document keyboard shortcuts for modals
    - Update README if needed

- [x] 10. Final Checkpoint - Verify all improvements complete
  - Ensure all tests pass, ask the user if questions arise.
u
- [x] 11. Phase 5: Additional UI/UX Refinements
  - Implement special indices filter, compact shard stats, loading skeleton, logging adjustments, and API URL fix
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 15.2, 15.3, 15.4, 15.5, 16.1, 16.2, 16.3, 16.4, 16.5, 17.1, 17.2, 17.3, 17.4, 17.5_

  - [x] 11.1 Implement special indices filter for index list
    - Modify `frontend/src/pages/ClusterView.tsx` (IndicesList component)
    - Add state for showSpecialIndices (default: false)
    - Add Checkbox component labeled "Show special indices"
    - Filter indices to exclude those starting with "." when unchecked
    - Position checkbox with existing filters
    - _Requirements: 13.1, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 11.2 Implement special indices filter for shards list
    - Modify `frontend/src/pages/ClusterView.tsx` (ShardsList component)
    - Add state for showSpecialIndices (default: false)
    - Add Checkbox component labeled "Show special indices"
    - Filter shards by index name (exclude indices starting with ".")
    - Position checkbox with existing filters
    - _Requirements: 13.2, 13.4, 13.5, 13.6, 13.7, 13.8_

  - [x] 11.3 Implement special indices filter for overview table
    - Modify `frontend/src/components/ShardGrid.tsx`
    - Add state for showSpecialIndices (default: false)
    - Add Checkbox component labeled "Show special indices"
    - Filter indices in grid to exclude those starting with "."
    - Ensure consistency with existing checkbox if present
    - Position checkbox with existing filters
    - _Requirements: 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9_

  - [ ]* 11.4 Write property test for special indices filter
    - **Property 8: Special Indices Filter Behavior**
    - **Validates: Requirements 13.1, 13.2, 13.3, 13.6, 13.7**
    - Generate random index data including special indices (starting with ".")
    - Render index list with filter unchecked
    - Verify special indices are hidden
    - Check filter checkbox
    - Verify all indices including special ones are shown
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 13.7_

  - [x] 11.5 Create ShardStatsCards component
    - Create `frontend/src/components/ShardStatsCards.tsx`
    - Accept stats prop with shard statistics
    - Render SimpleGrid with 6 compact cards
    - Display: Total Shards, Primary, Replica, Unassigned, Relocating, Initializing
    - Match visual style of overview statistics cards
    - Use same Card component, typography, and spacing
    - _Requirements: 14.2, 14.3, 14.4, 14.5_

  - [ ]* 11.6 Write unit test for ShardStatsCards component
    - Test renders all 6 statistics cards
    - Test displays correct values
    - Test uses consistent styling with overview cards
    - _Requirements: 14.2, 14.3, 14.4, 14.5_

  - [x] 11.7 Replace large shard stats box with compact cards
    - Modify `frontend/src/pages/ClusterView.tsx` (ShardsList component)
    - Remove existing large statistics box
    - Import and use ShardStatsCards component
    - Calculate shard statistics from shard data
    - Position cards above shards list table
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [ ]* 11.8 Write property test for statistics display consistency
    - **Property 9: Statistics Display Consistency**
    - **Validates: Requirements 14.2, 14.3, 14.5**
    - Generate random statistics data
    - Render overview statistics cards and shard statistics cards
    - Verify both use same Card component structure
    - Verify consistent typography and spacing
    - _Requirements: 14.2, 14.3, 14.5_

  - [x] 11.9 Add loading skeleton to main dashboard
    - Modify `frontend/src/pages/Dashboard.tsx` or main clusters list component
    - Import Skeleton component from Mantine
    - Add loading state check
    - Render skeleton cards while loading (3-5 skeleton items)
    - Match skeleton structure to actual cluster cards
    - Replace skeleton with actual data when loading completes
    - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

  - [ ]* 11.10 Write property test for loading state indication
    - **Property 10: Loading State Indication**
    - **Validates: Requirements 15.1, 15.2, 15.4**
    - Generate random loading states for different views
    - Render components in loading state
    - Verify Mantine Skeleton component is displayed
    - Complete loading
    - Verify skeleton is replaced with actual data
    - _Requirements: 15.1, 15.2, 15.4_

  - [x] 11.11 Adjust backend logging levels
    - Modify `backend/src/routes/clusters.rs`
    - Change "returning... clusters" log from info! to debug!
    - Modify `backend/src/routes/shards.rs`
    - Change "found shard stats" log from info! to debug!
    - Modify request completion logs in middleware
    - Change "request completed" log from info! to debug!
    - Verify ERROR and WARNING logs remain at appropriate levels
    - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_

  - [x] 11.12 Investigate API URL double slash bug
    - Check `frontend/src/api/client.ts` for baseURL configuration
    - Check all API method calls for path formatting
    - Check `backend/src/routes/*.rs` for route path definitions
    - Check `backend/src/cluster/client.rs` for SDK initialization
    - Identify source of double slashes in URLs
    - Document findings
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 11.13 Fix API URL double slash bug
    - Fix baseURL configuration (remove trailing slash or adjust path concatenation)
    - Ensure consistent path formatting across all API calls
    - Update SDK client initialization if needed
    - Verify Console feature custom calls still work
    - Test all API endpoints for proper URL formatting
    - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

  - [ ]* 11.14 Write property test for API URL format
    - **Property 11: API URL Format Correctness**
    - **Validates: Requirements 17.1, 17.5**
    - Generate random API endpoint paths
    - Make API requests through client
    - Intercept and verify URL format
    - Verify no double slashes in any URL
    - Verify proper path concatenation
    - _Requirements: 17.1, 17.5_

- [x] 12. Checkpoint - Verify Phase 5 complete
  - Ensure all tests pass, ask the user if questions arise.

- [x] 13. Final Integration and Verification
  - Verify all improvements work together including new refinements
  - _Requirements: All requirements 1-17_

  - [x] 13.1 Run full test suite including new tests
    - Run all unit tests: `npm test`
    - Run all property tests including new properties 8-11
    - Run all integration tests
    - Fix any failing tests
    - Ensure 100% of tests pass

  - [x] 13.2 Perform manual testing for new features
    - Test special indices filter in all views (index list, shards list, overview table)
    - Test compact shard statistics cards display
    - Test dashboard loading skeleton
    - Verify backend logs at appropriate levels (check with DEBUG level enabled)
    - Verify no double slashes in API URLs (check network tab)
    - Test on multiple screen sizes
    - Test in multiple browsers
    - Test theme switching

  - [x] 13.3 Update documentation for new features
    - Document special indices filter functionality
    - Document compact statistics cards
    - Update screenshots if needed
    - Document logging level changes for administrators
    - Update API documentation if URL format changed

- [x] 14. Final Checkpoint - Verify all improvements complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional test tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end flows
- Manual testing verifies visual consistency and user experience
- Phased approach minimizes risk and allows for early feedback
