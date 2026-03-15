---
title: Changelog
description: Secan version history and release notes
---

# Changelog

All notable changes to Secan will be documented in this file.

## [1.2.27] - 2026-03-14

### ✨ Major New Features

#### REST Console Enhancement
- **Persistent Console Drawer**: The REST Console now appears as a resizable right-side panel that stays open while you navigate between views
- **Detached Modal Mode**: Convert the drawer to a floating modal for focused work with more screen space
- **Console State Persistence**: Your console history, request/response content, and drawer width are saved per cluster across browser sessions
- **Resizable Panel**: Drag the left border to adjust the drawer width (400px minimum, up to 50% of viewport)
- **Quick Access Toggle**: Console toggle button moved to the cluster header for easy access

#### Cluster Change Detection & Notifications
- **Real-time Change Monitoring**: Secan now detects and notifies you of cluster changes:
  - Nodes added or removed from the cluster
  - Indices created or deleted
  - Cluster settings modified
- **Smart Notifications**: Notifications appear with violet styling in the top-right corner
- **First-Load Detection**: Intelligent filtering prevents notification spam on initial page load
- **Persistent State**: Change detection state is maintained across page refreshes

#### Shard Relocation Visualization
- **Visual Relocation Indicators**: Shards currently relocating show a yellow dot overlay
- **Interactive Relocation Workflow**: 
  - Right-click any shard and select "Select for Relocation"
  - Valid destination nodes are highlighted
  - Click a destination to initiate the move
  - Confirm in the modal dialog
- **Real-time Updates**: Watch relocation progress with live updates
- **Relocation Filter**: Filter topology view to show only relocating shards

#### Allocation Lock Management
- **Visual Status Indicator**: New indicator in cluster header showing allocation state:
  - 🟢 All Enabled: Full allocation active
  - 🟡 Primaries Only: Only primary shards being allocated
  - 🔴 All Disabled: No new shard allocations
- **Interactive Controls**: Click the indicator to open a context menu with options:
  - Enable All: Enable both primaries and replicas
  - Primaries Only: Enable only primary allocation
  - Disable All: Disable all allocation
  - Enable Replicas: Re-enable replica allocation
- **Immediate Application**: Changes are applied instantly with visual feedback

### 🎨 UI/UX Improvements

#### Smooth Animations & Transitions
- **Page Transitions**: Fade + slide animations when navigating between views (200ms)
- **Modal Animations**: Scale + fade effects for all modals (250ms)
- **Console Panel**: Smooth slide-in animation from the right (300ms)
- **Navigation Drawer**: Slide animation with backdrop fade (300ms)
- **Loading States**: Pulse animation on loading spinner (1.5s cycle)
- **Lazy Loading**: Fade-in effect for dynamically loaded content
- **Reduced Motion Support**: Full accessibility support for users who prefer reduced motion

#### Topology View Improvements
- **Fixed Pagination**: Index view now shows exactly 10 columns (indices) per page
- **Increased Node Column Width**: Expanded from 120px to 180px for better node name visibility
- **All Nodes Visible**: All nodes (rows) are always displayed; only indices paginate
- **Enhanced Dot View**: Additional node metrics displayed in the topology visualization
- **Improved Node Cards**: Better heap display and layout in node visualization

#### Visual Polish
- **Default Modal Width**: Set to 80% of viewport for better content display
- **Cluster Name Styling**: Improved visual hierarchy with background colors instead of bold text
- **Theme-Aware Colors**: Cluster name backgrounds adapt to light/dark themes
- **Better Icon Consistency**: Unified icon usage across the interface
- **Tooltip Positioning**: Fixed tooltip overflow and positioning issues

### 🔧 Backend Changes

#### Elasticsearch SDK Migration
- Migrated from Elasticsearch SDK to unified HTTP client implementation
- Simplified cluster client architecture
- Improved error handling and logging throughout
- Better compatibility with different Elasticsearch/OpenSearch versions

#### Configuration Updates
- Added `Default` derive to `ClusterConfig` struct for cleaner initialization
- Improved cluster settings query caching behavior
- Enhanced Prometheus metrics handling and aggregation

### 🐛 Bug Fixes

#### Console & Layout
- Fixed console modal flickering and focus conflicts
- Resolved console drawer full height issues on different screen sizes
- Fixed navigation drawer height calculation when console is closed
- Improved modal stacking and z-index handling

#### Shard & Index Management
- Fixed shard context menu title format to include index name
- Corrected allocation state extraction from cluster settings
- Fixed allocation menu logic to prevent invalid state transitions
- Improved shard ordering utility for consistent display

#### State Management
- Fixed React error #185 by using `useMemo` instead of `useState` in `useClusterChanges`
- Corrected cluster change notifications to align with violet styling
- Fixed first-load detection to handle nodes and indices loading separately
- Improved cluster settings query caching to prevent stale data

#### UI/UX
- Fixed multiple issues with navigation, filters, and metrics display
- Resolved unassigned shard border styling inconsistencies
- Corrected filter preservation when navigating between views

### 🔒 Security & CI/CD

#### GitHub Actions Updates
- Updated to Node.js 24 in all workflows
- Added `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` environment variable to suppress deprecation warnings
- Updated Docker actions to latest versions:
  - `docker/setup-buildx-action@v3.10.0`
  - `docker/metadata-action@v5.7.0`
  - `docker/build-push-action@v6.15.0`
- Fixed Rust formatting and linting issues in CI
- Added `RUSTFLAGS="-D warnings"` to catch unused variables in tests

### 📊 Test Updates

- Fixed `usePreferences.test.tsx` to include new preference fields:
  - `clusterConsoleStates`
  - `defaultConsoleWidth`
- Added appropriate eslint-disable comments for intentional hook dependency omissions
- Improved test coverage for new console features

### 📝 Documentation

#### New Documentation Pages
- **UI Animations & Accessibility**: Comprehensive guide to animations and reduced motion support
- **Updated REST Console**: Documented new drawer and detached modal modes
- **Updated Cluster Details**: Added cluster change notifications and allocation lock sections
- **Updated Shard Management**: Documented relocation workflow and topology improvements

#### Updated Pages
- **Homepage**: Added animations and enhanced console features to key features grid
- **Sidebar Navigation**: Added links to new documentation pages

### 📦 Dependencies

- Added `framer-motion@^12.4.10` for React animations (~30KB gzipped)
- Updated various development dependencies
- Maintained compatibility with existing Elasticsearch/OpenSearch versions

---

## [1.2.26] - Previous Version

For changes in version 1.2.26 and earlier, please refer to the git history or previous documentation.

---

## Version Numbering

Secan follows [Semantic Versioning](https://semver.org/):

- **MAJOR**: Incompatible API changes
- **MINOR**: New functionality (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

## Upgrade Notes

### From 1.2.26 to 1.2.27

No breaking changes. Simply pull the latest code and restart:

```bash
git pull origin main
just dev
```

New preference fields will be automatically initialized with default values.

## Feedback

Found a bug or have a feature request? Please open an issue on our [GitHub repository](https://github.com/your-org/secan/issues).
