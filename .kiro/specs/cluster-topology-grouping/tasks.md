# Implementation Plan: Cluster Topology Grouping

## Overview

This implementation adds visual grouping capabilities to the existing cluster topology "dot view". The feature allows users to group nodes by roles, types, or custom labels, with grouping parameters encoded in the URL for bookmarking and sharing. The implementation is structured as a non-invasive layer that reuses existing node visualization and data fetching mechanisms.

## Tasks

- [x] 1. Create grouping utility functions
  - [x] 1.1 Implement topologyGrouping.ts utility module
    - Create `frontend/src/utils/topologyGrouping.ts` file
    - Define TypeScript types: `GroupingAttribute`, `GroupingConfig`, `NodeGroup`
    - Implement `parseGroupingFromUrl()` to extract grouping parameters from URL
    - Implement `buildGroupingUrl()` to construct URLs with grouping parameters
    - Implement `hasCustomLabels()` to check if nodes have custom labels
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 7.5_
  
  - [ ]* 1.2 Write property test for URL-state round trip
    - **Property 5: URL-State Round Trip**
    - **Validates: Requirements 4.1, 4.2, 4.3, 4.4**
    - Test that setting grouping updates URL and navigating to URL restores grouping
    - Use fast-check to generate random grouping configurations
    - Verify round-trip consistency for all valid configurations
  
  - [x] 1.3 Implement node grouping calculation logic
    - Implement `calculateNodeGroups()` to partition nodes by attribute
    - Handle grouping by role (master, data, ingest, ml, coordinating)
    - Handle grouping by type (node type classification)
    - Handle grouping by label (custom tags)
    - Create "undefined" group for nodes without the grouping attribute
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 3.3_
  
  - [ ]* 1.4 Write property test for node partitioning
    - **Property 3: Correct Node Partitioning**
    - **Validates: Requirements 2.2, 2.3, 2.4**
    - Test that every node appears in exactly one group
    - Test that all nodes in a group share the same attribute value
    - Test that no nodes are excluded from grouping
    - Use fast-check to generate random node arrays and grouping attributes
  
  - [x] 1.5 Implement group label generation
    - Implement `getGroupLabel()` to generate display labels for groups
    - Handle label formatting for different grouping attributes
    - Ensure "undefined" group has clear label
    - _Requirements: 3.2_
  
  - [ ]* 1.6 Write unit tests for grouping utilities
    - Test `parseGroupingFromUrl()` with valid and invalid parameters
    - Test `calculateNodeGroups()` with empty arrays, single nodes, multiple groups
    - Test `hasCustomLabels()` with nodes with and without labels
    - Test `buildGroupingUrl()` with different configurations
    - Test edge cases: nodes without attributes, invalid grouping types

- [x] 2. Checkpoint - Verify grouping utilities
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Implement GroupRenderer component
  - [x] 3.1 Create GroupRenderer component
    - Create `frontend/src/components/Topology/GroupRenderer.tsx` file
    - Define `GroupRendererProps` interface with groupKey, groupLabel, nodes, children
    - Implement component to render bordered container with label
    - Apply styling: border, border-radius, padding, relative positioning
    - Position group label at top-left of border
    - Use Mantine theme variables for colors
    - _Requirements: 3.1, 3.2, 3.5_
  
  - [ ]* 3.2 Write unit tests for GroupRenderer
    - Test that component renders border element
    - Test that component renders label with correct text
    - Test that children are rendered inside container
    - Test styling is applied correctly
    - Test with different group keys and labels

- [x] 4. Implement GroupingControl component
  - [x] 4.1 Create GroupingControl component
    - Create `frontend/src/components/Topology/GroupingControl.tsx` file
    - Define `GroupingControlProps` interface
    - Implement dropdown/select control using Mantine Select component
    - Display options: None, By Role, By Type, By Label
    - Disable "By Label" option when `availableLabels` is empty
    - Highlight currently active grouping option
    - Call `onGroupingChange` callback when selection changes
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [ ]* 4.2 Write unit tests for GroupingControl
    - Test that all grouping options are displayed
    - Test that "By Label" is disabled when no labels exist
    - Test that current grouping is highlighted
    - Test that selection triggers `onGroupingChange` callback
    - Test with different initial grouping states

- [x] 5. Checkpoint - Verify new components
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Enhance DotBasedTopologyView component
  - [x] 6.1 Add grouping state management to DotBasedTopologyView
    - Add `groupBy` and `groupValue` props to component interface
    - Add state for current grouping configuration
    - Parse grouping from URL on component mount using `parseGroupingFromUrl()`
    - Update URL when grouping changes using `buildGroupingUrl()`
    - Use React Router's `useSearchParams` for URL manipulation
    - _Requirements: 4.1, 4.2, 4.5_
  
  - [x] 6.2 Implement group calculation in DotBasedTopologyView
    - Call `calculateNodeGroups()` with current nodes and grouping config
    - Use `useMemo` to memoize group calculation for performance
    - Recalculate groups when nodes or grouping config changes
    - _Requirements: 2.1, 6.3_
  
  - [x] 6.3 Integrate GroupingControl into DotBasedTopologyView
    - Add GroupingControl component to topology view UI
    - Pass current grouping and available labels as props
    - Implement `onGroupingChange` handler to update state and URL
    - Check for custom labels using `hasCustomLabels()` utility
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_
  
  - [x] 6.4 Integrate GroupRenderer into node rendering
    - Wrap node rendering logic with GroupRenderer components
    - Render one GroupRenderer per group
    - Pass group key, label, and nodes to each GroupRenderer
    - Render existing NodeCard components inside GroupRenderer children
    - Ensure nodes without grouping render identically to original implementation
    - _Requirements: 1.4, 3.1, 3.2, 3.4, 5.1, 5.3, 5.5_
  
  - [ ]* 6.5 Write property test for complete node display
    - **Property 1: Complete Node Display**
    - **Validates: Requirements 1.1, 1.2, 1.3**
    - Test that all nodes are displayed regardless of roles or types
    - Use fast-check to generate random node arrays
    - Verify that rendered output contains all node IDs
  
  - [ ]* 6.6 Write property test for invalid parameter handling
    - **Property 6: Invalid Parameter Handling**
    - **Validates: Requirements 4.5**
    - Test that invalid grouping parameters default to no grouping
    - Test that invalid parameters don't cause errors or crashes
    - Use fast-check to generate random invalid parameter strings
  
  - [ ]* 6.7 Write unit tests for DotBasedTopologyView enhancements
    - Test that URL parameters are parsed on mount
    - Test that grouping state updates when URL changes
    - Test that URL updates when grouping selection changes
    - Test that groups are calculated correctly
    - Test that GroupRenderer components are rendered for each group
    - Test backward compatibility when grouping is disabled

- [x] 7. Checkpoint - Verify integration
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Performance optimization and error handling
  - [x] 8.1 Add performance optimizations
    - Verify `useMemo` is used for group calculation
    - Add debouncing to grouping changes if needed
    - Test performance with 100 nodes
    - Ensure render completes within 2 seconds for 100 nodes
    - Ensure grouping updates within 500ms for 100 nodes
    - _Requirements: 6.1, 6.2, 6.3, 6.4_
  
  - [x] 8.2 Implement error handling
    - Add console warning for invalid grouping parameters
    - Handle missing node attributes gracefully (create "undefined" group)
    - Filter out empty groups before rendering
    - Add error boundaries around grouping components
    - _Requirements: 4.5, 3.3_
  
  - [ ]* 8.3 Write property test for conditional label option
    - **Property 10: Conditional Label Option**
    - **Validates: Requirements 7.5**
    - Test that "By Label" option is disabled when nodes have no labels
    - Test that "By Label" option is enabled when nodes have labels
    - Use fast-check to generate node arrays with and without labels

- [ ] 9. Final integration and testing
  - [x] 9.1 Verify all node types are displayed
    - Test with clusters containing master, data, ingest, ml, coordinating nodes
    - Verify no nodes are filtered based on roles
    - Verify existing node visualization is unchanged
    - _Requirements: 1.1, 1.2, 1.3, 1.4_
  
  - [x] 9.2 Verify grouping functionality
    - Test grouping by role with various node configurations
    - Test grouping by type with various node configurations
    - Test grouping by label with custom labels
    - Test "undefined" group appears for nodes without attributes
    - Test switching between grouping options
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.3_
  
  - [x] 9.3 Verify URL state management
    - Test that selecting grouping updates URL
    - Test that navigating to URL with grouping applies it
    - Test that browser back/forward works correctly
    - Test that bookmarked URLs restore grouping
    - _Requirements: 4.1, 4.2, 4.3, 4.4_
  
  - [-] 9.4 Run all tests and verify build
    - Run `npm test` to verify all unit and property tests pass
    - Run `npm run build` to verify TypeScript compilation succeeds
    - Run `npm run lint` to verify code quality
    - Fix any errors or warnings
    - _Requirements: All_

- [ ] 10. Final checkpoint - Complete verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- The implementation reuses existing components and maintains backward compatibility
- Performance requirements are validated in task 8.1
- All grouping logic is isolated in utility functions for maintainability
