# Implementation Plan: Project Enhancements - Rebranding and Shard Reallocation

## Overview

This implementation plan covers three major enhancements:
1. Project rebranding from "Cerebro" to "Secan"
2. Full-width layout implementation across all views
3. Interactive shard reallocation with visual grid

The tasks are organized into phases for incremental delivery.

## Tasks

### Phase 1: Project Rebranding

- [x] 1. Rebrand backend to Secan
  - [x] 1.1 Update backend package name and metadata
    - Update Cargo.toml package name to "secan"
    - Update package description
    - Update binary name
    - Update authors and repository URLs
    - _Requirements: 1.2, 1.3, 1.4_
  
  - [x] 1.2 Update backend user-facing messages
    - Update startup message in main.rs
    - Update help text and CLI messages
    - Update log messages that reference project name
    - Update error messages
    - _Requirements: 1.8_
  
  - [x] 1.3 Update backend documentation
    - Update backend/README.md
    - Update code comments referencing Cerebro
    - Update configuration examples
    - _Requirements: 1.9, 1.10_
  
  - [x] 1.4 Test backend builds with new name
    - Run cargo build
    - Run cargo test
    - Verify binary name is correct
    - Test configuration loading
    - _Requirements: 1.2, 1.3_

- [x] 2. Rebrand frontend to Secan
  - [x] 2.1 Update frontend package name and metadata
    - Update package.json name to "secan-frontend"
    - Update package description
    - Update title in index.html
    - Update manifest.json
    - _Requirements: 1.5_
  
  - [x] 2.2 Update frontend user-facing text
    - Update App.tsx title
    - Update login page branding
    - Update header/footer text
    - Update about/help text
    - _Requirements: 1.8_
  
  - [x] 2.3 Update frontend documentation
    - Update frontend/README.md
    - Update code comments
    - _Requirements: 1.9_
  
  - [x] 2.4 Test frontend builds with new name
    - Run npm run build
    - Run npm test
    - Verify title displays correctly
    - Test embedded assets
    - _Requirements: 1.5_

- [x] 3. Update root documentation and configuration
  - [x] 3.1 Update root README and documentation
    - Update README.md with new project name
    - Add naming explanation to README: "Secan (Old English: sēcan - to seek, to inquire)"
    - Update CONFIGURATION.md examples
    - Update DOCKER.md instructions
    - Update CONTRIBUTING.md
    - Remove references to Cerebro
    - _Requirements: 1.9, 1.9a, 1.10_
  
  - [x] 3.2 Update Docker configuration
    - Update Dockerfile labels and image name
    - Update docker-compose.yml
    - Update .dockerignore if needed
    - _Requirements: 1.6_
  
  - [x] 3.3 Update build configuration
    - Update Taskfile.yml task names
    - Update GitHub Actions workflows
    - Update release scripts
    - _Requirements: 1.4_

- [x] 5. Checkpoint - Rebranding complete (Phase 1)
  - Verify all builds succeed with new name
  - Test Docker image builds
  - Verify no references to "Cerebro" in user-facing text
  - Note: Original Cerebro source files will be removed later (after shard reallocation implementation)
  - Ask user if questions arise

### Phase 2: Full-Width Layout

- [x] 6. Implement full-width layout infrastructure
  - [x] 6.1 Update AppShell component for full-width
    - Remove Container max-width constraints
    - Use Box with 100% width
    - Add minimal horizontal padding (1rem)
    - Maintain responsive breakpoints
    - _Requirements: 2.13, 2.14, 2.15_
  
  - [x] 6.2 Create full-width layout utility
    - Create FullWidthContainer component
    - Add responsive padding utilities
    - Add breakpoint-aware spacing
    - _Requirements: 2.14, 2.15_
  
  - [x] 6.3 Test AppShell full-width layout
    - Test on desktop (1920px+)
    - Test on laptop (1366px)
    - Test on tablet (768px)
    - Test on mobile (375px)
    - _Requirements: 2.15_

- [x] 7. Apply full-width layout to all views
  - [x] 7.1 Update Dashboard view
    - Already full-width, verify consistency
    - Test responsive behavior
    - _Requirements: 2.1_
  
  - [x] 7.2 Update Cluster overview view
    - Remove width constraints
    - Apply full-width layout
    - Test responsive behavior
    - _Requirements: 2.2_
  
  - [x] 7.3 Update Nodes list view
    - Remove width constraints
    - Apply full-width layout
    - Test table responsiveness
    - _Requirements: 2.3_
  
  - [x] 6.4 Update Indices list view
    - Remove width constraints
    - Apply full-width layout
    - Test table responsiveness
    - _Requirements: 2.4_
  
  - [x] 6.5 Update Shards visualization view
    - Remove width constraints
    - Apply full-width layout (critical for shard grid)
    - Test grid responsiveness
    - _Requirements: 2.5_
  
  - [x] 6.6 Update REST console view
    - Remove width constraints
    - Apply full-width layout
    - Test editor responsiveness
    - _Requirements: 2.6_
  
  - [x] 6.7 Update remaining views
    - Update Aliases management view
    - Update Templates management view
    - Update Cluster settings view
    - Update Snapshot management view
    - Update Cat API view
    - Update Analysis tools view
    - _Requirements: 2.7, 2.8, 2.9, 2.10, 2.11, 2.12_

- [x] 7. Checkpoint - Full-width layout complete
  - Test all views on different screen sizes
  - Verify no horizontal scrolling on desktop
  - Verify responsive behavior on mobile
  - Ask user if questions arise

### Phase 3: Shard Grid Foundation

- [x] 8. Implement shard grid data structures
  - **Note**: Build upon existing overview table in cluster details (1st tab)
  - [x] 8.1 Create shard grid TypeScript types
    - Define ShardInfo interface
    - Define NodeWithShards interface
    - Define IndexMetadata interface
    - Define ShardGridData interface
    - Review existing overview table types and extend as needed
    - _Requirements: 3.1, 3.2, 3.3_
  
  - [x] 8.2 Create shard grid state management
    - Create Zustand store for shard grid
    - Add state for nodes, indices, shards
    - Add state for selection and relocation mode
    - Add actions for grid operations
    - Integrate with existing cluster state management
    - _Requirements: 3.1_
  
  - [x] 8.3 Implement cluster state parsing
    - Parse Elasticsearch cluster state response
    - Extract node information
    - Extract index information
    - Build shard map from routing table
    - Handle relocating shards (create destination indicators)
    - Leverage existing cluster state parsing from overview table
    - _Requirements: 3.1, 3.11_

- [x] 9. Implement ShardCell component
  - [x] 9.1 Create ShardCell component
    - Render shard box with number
    - Apply color coding based on state
    - Distinguish primary vs replica shards
    - Handle click events
    - _Requirements: 3.4, 3.5, 3.6, 3.7_
  
  - [x] 9.2 Implement shard state styling
    - Green border for STARTED
    - Yellow border for INITIALIZING
    - Orange border for RELOCATING
    - Red border for UNASSIGNED
    - Purple dashed border for destination indicators
    - Pulsing animation for selected shards
    - _Requirements: 3.5_
  
  - [x] 9.3 Add primary/replica visual distinction
    - Solid fill for primary shards
    - Outlined/hollow for replica shards
    - _Requirements: 3.7_
  
  - [x] 9.4 Test ShardCell component
    - Test all shard states render correctly
    - Test click handling
    - Test color contrast for accessibility
    - _Requirements: 3.5, 3.6_

- [x] 10. Implement ShardGrid component
  - [x] 10.1 Create ShardGrid layout structure
    - Create grid container with rows and columns
    - Implement sticky headers for nodes and indices
    - Add horizontal and vertical scrolling
    - _Requirements: 3.1, 3.8, 3.9_
  
  - [x] 10.2 Render node rows
    - Display node name and IP
    - Display node statistics (heap, disk, CPU, load)
    - Render shards for each node
    - _Requirements: 3.2_
  
  - [x] 10.3 Render index columns
    - Display index name
    - Display shard count, docs, size
    - Align with node rows
    - _Requirements: 3.3_
  
  - [x] 10.4 Render unassigned shards row
    - Create separate row for unassigned shards
    - Display all unassigned shards
    - _Requirements: 3.10_
  
  - [x] 10.5 Implement grid refresh
    - Add auto-refresh with configurable interval
    - Poll cluster state API
    - Update grid on data changes
    - _Requirements: 3.12_
  
  - [x] 10.6 Test ShardGrid component
    - Test with small cluster (5 nodes, 10 indices)
    - Test with medium cluster (20 nodes, 50 indices)
    - Test scrolling behavior
    - Test sticky headers
    - _Requirements: 3.1, 3.8, 3.9_

- [x] 11. Checkpoint - Shard grid foundation complete
  - Verify shard grid renders correctly
  - Test with real Elasticsearch cluster
  - Verify all shard states display correctly
  - Ask user if questions arise

### Phase 4: Shard Selection and Context Menu

- [x] 12. Implement shard selection
  - [x] 12.1 Add click handling to ShardCell
    - Handle shard click events
    - Update selected shard in state
    - Highlight selected shard
    - _Requirements: 4.1_
  
  - [x] 12.2 Implement ShardContextMenu component
    - Create Mantine Menu component
    - Position menu near clicked shard
    - Add "Display shard stats" option
    - Add "Select for relocation" option
    - Handle menu close on outside click
    - Handle menu close on Escape key
    - _Requirements: 4.2, 4.3, 4.4, 4.8, 4.9_
  
  - [x] 12.3 Disable relocation for invalid shards
    - Disable "Select for relocation" for UNASSIGNED shards
    - Disable for RELOCATING shards
    - Disable for INITIALIZING shards
    - _Requirements: 4.10_
  
  - [x] 12.4 Test shard selection
    - Test click handling
    - Test context menu positioning
    - Test menu options
    - Test keyboard navigation
    - _Requirements: 4.1, 4.2, 4.8_

- [x] 13. Implement shard stats modal
  - [x] 13.1 Create ShardStatsModal component
    - Create Mantine Modal component
    - Display shard number and type
    - Display index name
    - Display node name and ID
    - Display shard state
    - Display document count and size
    - _Requirements: 4.5, 4.6_
  
  - [x] 13.2 Fetch detailed shard stats
    - Call shard stats API
    - Parse response
    - Display segments, merges, refreshes, flushes
    - _Requirements: 4.6_
  
  - [x] 13.3 Test shard stats modal
    - Test modal opens on menu selection
    - Test all stats display correctly
    - Test modal close
    - _Requirements: 4.5, 4.6_

- [x] 14. Checkpoint - Shard selection complete
  - Test shard selection workflow
  - Verify context menu works
  - Verify shard stats display correctly
  - Ask user if questions arise

### Phase 5: Shard Relocation Mode

- [x] 15. Implement relocation mode
  - [x] 15.1 Add relocation mode state
    - Add relocationMode boolean to state
    - Add selectedShard to state
    - Add destinationIndicators map to state
    - _Requirements: 5.1, 5.2_
  
  - [x] 15.2 Implement enter relocation mode
    - Handle "Select for relocation" menu click
    - Set relocationMode to true
    - Store selected shard
    - Calculate valid destinations
    - _Requirements: 5.1, 5.3_
  
  - [x] 15.3 Implement destination calculation
    - Filter out source node
    - Filter out nodes already hosting the shard
    - Filter out non-data nodes
    - Create destination indicators
    - _Requirements: 5.4, 5.6_
  
  - [x] 15.4 Render destination indicators
    - Display dashed shard boxes in valid cells
    - Use purple/blue color
    - Show shard number
    - Make indicators clickable
    - _Requirements: 5.5, 5.6, 5.7_
  
  - [x] 15.5 Implement exit relocation mode
    - Handle outside click
    - Handle Escape key
    - Clear selected shard
    - Clear destination indicators
    - _Requirements: 5.13_
  
  - [x] 15.6 Test relocation mode
    - Test entering relocation mode
    - Test destination calculation
    - Test destination indicators display
    - Test exiting relocation mode
    - _Requirements: 5.1, 5.3, 5.4, 5.13_

- [x] 16. Implement relocation confirmation
  - [x] 16.1 Create RelocationConfirmDialog component
    - Create Mantine Modal component
    - Display source node details
    - Display destination node details
    - Display index and shard info
    - Add warning message
    - Add Cancel and Confirm buttons
    - _Requirements: 5.8, 5.9_
  
  - [x] 16.2 Handle destination indicator click
    - Show confirmation dialog
    - Pass source and destination details
    - _Requirements: 5.8_
  
  - [x] 16.3 Test confirmation dialog
    - Test dialog displays correct information
    - Test cancel action
    - Test confirm action
    - _Requirements: 5.8, 5.9_

- [x] 17. Checkpoint - Relocation mode complete
  - Test relocation mode workflow
  - Verify destination indicators appear correctly
  - Verify confirmation dialog works
  - Ask user if questions arise

### Phase 6: Shard Relocation Backend

- [x] 18. Implement shard relocation API
  - [x] 18.1 Create shard relocation endpoint
    - Add POST /api/clusters/:id/shards/relocate route
    - Define RelocateShardRequest struct
    - Parse request body
    - _Requirements: 6.1, 6.2_
  
  - [x] 18.2 Implement request validation
    - Validate all required parameters present
    - Validate cluster ID exists
    - Validate source and destination are different
    - Validate index name format
    - _Requirements: 6.3, 6.4, 8.1, 8.2, 8.3, 8.4_
  
  - [x] 18.3 Implement reroute API call
    - Build Elasticsearch reroute command JSON
    - Execute POST /_cluster/reroute
    - Parse response
    - Return response to frontend
    - _Requirements: 6.5, 6.6, 6.7_
  
  - [x] 18.4 Add error handling
    - Handle Elasticsearch errors
    - Return descriptive error messages
    - Log all relocation attempts
    - _Requirements: 6.8, 6.9_
  
  - [x] 18.5 Add authentication and authorization
    - Require authentication for endpoint
    - Enforce RBAC for cluster access
    - _Requirements: 6.10, 6.11_
  
  - [x] 18.6 Test shard relocation API
    - Test with valid request
    - Test with invalid requests
    - Test error handling
    - Test authentication
    - _Requirements: 6.1, 6.2, 6.3, 6.8_

- [x] 19. Integrate frontend with backend API
  - [x] 19.1 Add API client method
    - Add relocateShard method to API client
    - Handle request/response
    - Handle errors
    - _Requirements: 6.1_
  
  - [x] 19.2 Call API on confirmation
    - Call relocateShard when user confirms
    - Handle success response
    - Handle error response
    - _Requirements: 5.10_
  
  - [x] 19.3 Display notifications
    - Show "Relocation initiated" on success
    - Show error message on failure
    - _Requirements: 5.11, 5.12_
  
  - [x] 19.4 Test API integration
    - Test successful relocation
    - Test failed relocation
    - Test error handling
    - _Requirements: 5.10, 5.11, 5.12_

- [-] 20. Checkpoint - Backend integration complete
  - Test end-to-end relocation flow
  - Verify API calls succeed
  - Verify error handling works
  - Ask user if questions arise

### Phase 7: Relocation Progress Tracking

- [ ] 21. Implement relocation progress tracking
  - [ ] 21.1 Add polling for relocation progress
    - Start polling after relocation initiated
    - Poll cluster state every 2 seconds
    - Update shard grid with new data
    - _Requirements: 7.2, 7.3_
  
  - [ ] 21.2 Display relocating shard state
    - Show shard in RELOCATING state on source node
    - Show shard in INITIALIZING state on destination node
    - _Requirements: 7.4, 7.5, 7.6_
  
  - [ ] 21.3 Detect relocation completion
    - Check if shard is no longer RELOCATING
    - Check if shard is STARTED on destination
    - Stop polling when complete
    - _Requirements: 7.7, 7.8, 7.10_
  
  - [ ] 21.4 Handle relocation failure
    - Detect if relocation fails
    - Display error notification
    - Stop polling
    - _Requirements: 7.9, 7.10_
  
  - [ ] 21.5 Add polling timeout
    - Set timeout to 5 minutes
    - Stop polling after timeout
    - Display timeout message
    - _Requirements: 7.12_
  
  - [ ] 21.6 Test progress tracking
    - Test polling starts after relocation
    - Test grid updates during relocation
    - Test completion detection
    - Test failure handling
    - Test timeout
    - _Requirements: 7.1, 7.2, 7.3, 7.7, 7.9, 7.12_

- [ ] 22. Checkpoint - Progress tracking complete
  - Test relocation progress tracking
  - Verify grid updates during relocation
  - Verify completion detection works
  - Ask user if questions arise

### Phase 8: Performance Optimization

- [ ] 23. Implement performance optimizations
  - [ ] 23.1 Add virtualization for large grids
    - Install @tanstack/react-virtual
    - Implement row virtualization
    - Implement column virtualization
    - Enable for grids with >20 nodes or >20 indices
    - _Requirements: 9.1, 9.2_
  
  - [ ] 23.2 Add memoization
    - Memoize ShardCell component
    - Memoize expensive calculations
    - Use useMemo for derived state
    - _Requirements: 9.3_
  
  - [ ] 23.3 Optimize scrolling
    - Debounce scroll events
    - Use CSS transforms for smooth scrolling
    - _Requirements: 9.4, 9.5_
  
  - [ ] 23.4 Add caching
    - Cache cluster state data
    - Set configurable TTL
    - Invalidate cache on mutations
    - _Requirements: 9.7_
  
  - [ ] 23.5 Add loading states
    - Display loading skeleton while fetching
    - Show loading indicators during operations
    - _Requirements: 9.9_
  
  - [ ] 23.6 Test performance
    - Test with 100 nodes and 500 indices
    - Measure render time
    - Verify no performance degradation
    - _Requirements: 9.10_

- [ ] 24. Checkpoint - Performance optimization complete
  - Test with large clusters
  - Verify virtualization works
  - Measure performance improvements
  - Ask user if questions arise

### Phase 9: Accessibility and Polish

- [ ] 25. Implement accessibility features
  - [ ] 25.1 Add keyboard navigation
    - Support arrow key navigation
    - Support Tab key for focus
    - Support Enter/Space for selection
    - Support Escape for cancel
    - _Requirements: 10.1, 10.2, 10.3, 10.7_
  
  - [ ] 25.2 Add ARIA labels
    - Add role="grid" to shard grid
    - Add role="row" to node rows
    - Add role="gridcell" to shard cells
    - Add aria-label to all interactive elements
    - _Requirements: 10.9, 10.10_
  
  - [ ] 25.3 Add focus indicators
    - Add visible focus outline
    - Ensure focus is always visible
    - _Requirements: 10.8_
  
  - [ ] 25.4 Add screen reader support
    - Add screen reader announcements
    - Announce state changes
    - _Requirements: 10.9_
  
  - [ ] 25.5 Test accessibility
    - Test keyboard navigation
    - Test with screen reader
    - Verify ARIA labels
    - Test focus management
    - _Requirements: 10.1, 10.2, 10.3, 10.8, 10.9_

- [ ] 26. Implement dynamic favicon based on cluster health
  - [ ] 26.1 Create useFaviconManager hook
    - Create custom React hook for favicon management
    - Accept cluster health state as parameter
    - Update favicon link element dynamically
    - Handle null/unknown health state
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 26.2 Integrate favicon manager in ClusterView
    - Import useFaviconManager hook
    - Pass cluster health state to hook
    - Update favicon when health changes
    - _Requirements: 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 26.3 Integrate favicon manager in ClustersList
    - Import useFaviconManager hook
    - Pass null to show neutral favicon
    - _Requirements: 12.1, 12.7, 12.8_
  
  - [ ] 26.4 Add favicon files to public assets
    - Copy favicon-neutral.svg to frontend/public/
    - Copy favicon-green.svg to frontend/public/
    - Copy favicon-yellow.svg to frontend/public/
    - Copy favicon-red.svg to frontend/public/
    - Update index.html to reference favicon-neutral.svg by default
    - _Requirements: 12.6, 12.11_
  
  - [ ] 26.5 Test favicon updates
    - Test favicon changes when viewing green cluster
    - Test favicon changes when viewing yellow cluster
    - Test favicon changes when viewing red cluster
    - Test favicon reverts to neutral on clusters list
    - Test favicon updates within 1 second of health change
    - Test no page flicker during favicon update
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.7, 12.8, 12.10_

- [ ] 27. Implement responsive design
  - [ ] 26.1 Add responsive grid layout
    - Make grid horizontally scrollable on small screens
    - Maintain sticky headers
    - Ensure minimum touch target size (44x44px)
    - _Requirements: 11.1, 11.2, 11.3_
  
  - [ ] 26.2 Add touch support
    - Make context menu touch-friendly
    - Support pinch-to-zoom
    - _Requirements: 11.4, 11.8_
  
  - [ ] 26.3 Add collapsible sections
    - Make node stats collapsible on small screens
    - Make index metadata collapsible
    - _Requirements: 11.6, 11.7_
  
  - [ ] 26.4 Add compact view option
    - Provide compact view for dense clusters
    - Reduce padding and spacing
    - _Requirements: 11.10_
  
  - [ ] 26.5 Test responsive design
    - Test on desktop (1920px+)
    - Test on laptop (1366px)
    - Test on tablet (768px)
    - Test on mobile (375px)
    - _Requirements: 11.1, 11.5, 11.9_

- [ ] 27. Final polish and testing
  - [ ] 27.1 Add validation feedback
    - Show validation errors in UI
    - Prevent invalid operations
    - _Requirements: 8.7_
  
  - [ ] 27.2 Improve error messages
    - Make error messages user-friendly
    - Provide actionable guidance
    - _Requirements: 8.10_
  
  - [ ] 27.3 Add loading and progress indicators
    - Show loading states
    - Show progress during operations
    - _Requirements: 9.9_
  
  - [ ] 27.4 Test edge cases
    - Test with no shards
    - Test with all unassigned shards
    - Test with relocating shards
    - Test with very large clusters
    - Test with network errors
    - Test with authentication errors

- [ ] 28. Checkpoint - All features complete
  - Test complete shard relocation workflow
  - Verify all accessibility features work
  - Verify responsive design works
  - Test with real Elasticsearch clusters
  - Ask user if questions arise

### Phase 9.5: Cleanup Original Cerebro Files

- [ ] 29. Remove all original Cerebro source files
  - **Note**: Now that shard reallocation is complete, we can safely remove original Cerebro files as we have reference implementations
  - [ ] 29.1 Remove Scala application source code
    - Delete app/ directory (Scala Play Framework code)
    - Delete conf/ directory (Play Framework configuration)
    - Delete project/ directory (SBT build configuration)
    - Delete build.sbt file
    - _Requirements: 1.1_
  
  - [ ] 29.2 Remove original Cerebro build and CI files
    - Delete .travis.yml (Travis CI configuration)
    - Delete Gruntfile.js (Grunt build configuration)
    - Delete any .babelrc, .eslintrc, or other old config files
    - Keep .github/ directory (now contains Secan workflows)
    - _Requirements: 1.1_
  
  - [ ] 29.3 Remove original Cerebro documentation
    - Delete CHANGES.md (old changelog)
    - Delete RELEASE.md (old release process)
    - Delete RUNNING.md (old running instructions)
    - Delete TEST_API.md (old API test docs)
    - Keep only files relevant to new Secan implementation
    - _Requirements: 1.9_
  
  - [ ] 29.4 Clean up root directory files
    - Review and remove any remaining Cerebro-specific files
    - Keep: LICENSE, .gitignore, Taskfile.yml, Dockerfile
    - Keep: CONFIGURATION.md, DOCKER.md, CONTRIBUTING.md (already updated for Secan)
    - Remove: Any example configs, old scripts, or unused files
    - _Requirements: 1.9, 1.10_
  
  - [ ] 29.5 Verify clean repository state
    - Run git status to check for removed files
    - Ensure no Scala/Play Framework files remain
    - Ensure no old CI/build configuration remains
    - Verify only Rust backend and React frontend code exists
    - _Requirements: 1.1_

- [ ] 30. Checkpoint - Cleanup complete
  - Verify all builds succeed after cleanup
  - Verify no references to original Cerebro implementation
  - Verify README reflects Secan with Cerebro attribution
  - Ask user if questions arise

### Phase 10: Documentation and Deployment

- [ ] 31. Update documentation
- [ ] 31. Update documentation
  - [ ] 31.1 Document shard relocation feature
    - Add user guide for shard relocation
    - Add screenshots
    - Document keyboard shortcuts
    - _Requirements: 1.9_
  
  - [ ] 31.2 Document API endpoints
    - Document POST /api/clusters/:id/shards/relocate
    - Add request/response examples
    - Document error codes
    - _Requirements: 6.1, 6.2_
  
  - [ ] 31.3 Update configuration documentation
    - Document new configuration options
    - Update examples
    - _Requirements: 1.10_

- [ ] 32. Final testing and deployment
  - [ ] 32.1 Run full test suite
    - Run cargo test
    - Run npm test
    - Run integration tests
  
  - [ ] 32.2 Build release artifacts
    - Build backend binary
    - Build frontend assets
    - Build Docker image
    - _Requirements: 1.4, 1.6_
  
  - [ ] 32.3 Test release artifacts
    - Test single binary
    - Test Docker image
    - Test on different platforms
  
  - [ ] 32.4 Create release notes
    - Document new features
    - Document breaking changes
    - Document migration guide

- [ ] 33. Final checkpoint - Project complete
  - All features implemented and tested
  - Documentation complete
  - Release artifacts ready
  - Ready for production deployment

## Summary

Total estimated tasks: 33 major tasks with 100+ subtasks
Estimated time: 8-10 days
Priority: High (critical UX improvements)

The implementation follows an incremental approach:
1. Rebrand first (low risk, high visibility)
2. Full-width layout (medium risk, high impact)
3. Shard grid foundation (high complexity, core feature)
4. Interactive features (high complexity, high value)
5. Performance and polish (medium complexity, high quality)
6. Cleanup original files (after implementation complete)
