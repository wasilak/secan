# Node Details Enhancement - Implementation Tasks

## Phase 1: Backend API Enhancements (Backend - Rust)

- [x] Task 1.1: Enhance Nodes List Endpoint
**File:** `backend/src/routes/clusters.rs` and `backend/src/routes/clusters/transform.rs`

**Objective:** Add load average, uptime, and tags to nodes list response

**Steps:**
1. Update `transform_nodes()` in `backend/src/routes/clusters/transform.rs` to extract additional fields
2. Extract load average from node stats (`os.cpu.load_average.1m`)
3. Extract uptime from node stats (`jvm.uptime_in_millis`)
4. Add helper function `format_uptime(uptime_millis: u64) -> String`
5. Extract tags/attributes from node info (`attributes` field)
6. Update `NodeInfoResponse` struct with new fields:
   - `load_average: Option<f64>` (1-minute average)
   - `uptime: Option<String>` (human-readable)
   - `uptime_millis: Option<u64>`
   - `tags: Option<Vec<String>>`

**Acceptance Criteria:**
- [x] GET `/api/clusters/:id/nodes` returns enhanced NodeInfo
- [x] Master node has `is_master: true`
- [x] Master-eligible nodes have `is_master_eligible: true`
- [x] Load average is numeric value (1-minute)
- [x] Uptime is human-readable string
- [x] Tags extracted from node attributes
- [x] All existing fields still present
- [x] Backend builds without errors (`cargo build`)
- [x] No clippy warnings (`cargo clippy`)

- [x] Task 1.2: Create Node Stats Endpoint
**File:** `backend/src/routes/clusters.rs`

**Objective:** Create new endpoint returning comprehensive node statistics

**Steps:**
1. Add new route handler `get_node_stats()` in `backend/src/routes/clusters.rs`
2. Fetch detailed node stats from Elasticsearch `/_nodes/:nodeId/stats`
3. Fetch shard information from `/_cat/shards` filtered by node
4. Fetch cluster state from `/_cluster/state` for master info
5. Create transform function `transform_node_detail_stats()` in `backend/src/routes/clusters/transform.rs`
6. Add helper functions:
   - `extract_load_average_all(node_stats: &Value) -> Option<[f64; 3]>`
   - `extract_thread_pools(node_stats: &Value) -> Option<HashMap<String, ThreadPoolStats>>`
   - `aggregate_shard_stats(node_id: &str, shards: &Value) -> ShardStats`
   - `extract_indexing_stats(node_stats: &Value) -> IndexingStats`
   - `extract_search_stats(node_stats: &Value) -> SearchStats`
7. Build comprehensive response with all metrics

   **Acceptance Criteria:**
   - [ ] GET `/api/clusters/:id/nodes/:nodeId/stats` returns comprehensive stats
   - [ ] All numeric fields are valid numbers (not NaN)
   - [ ] Optional fields are None when not available
   - [ ] Shard list includes all shards on the node
   - [ ] Thread pools include all ES thread pools
   - [ ] Response structure matches TypeScript interface
   - [ ] Backend builds without errors (`cargo build`)
   - [ ] No clippy warnings (`cargo clippy`)

- [x] Task 1.3: Add Response Structs
**File:** `backend/src/routes/clusters/transform.rs`

**Objective:** Create Rust structs for enhanced node data

**Steps:**
1. Update `NodeInfoResponse` struct with new fields (load_average, uptime, tags)
2. Create `NodeDetailStatsResponse` struct with comprehensive fields
3. Create `ThreadPoolStats` struct
4. Create `ShardStats` and `ShardInfo` structs
5. Create `IndexingStats` struct
6. Create `SearchStats` struct
7. Create `FileSystemStats` struct
8. Create `NetworkStats` struct
9. Create `JvmStats` and `GcCollectorStats` structs
10. Add `#[derive(Serialize)]` to all structs for JSON serialization

   **Acceptance Criteria:**
   - [ ] All structs compile without errors
   - [ ] JSON serialization works correctly (serde)
   - [ ] Structs match TypeScript interfaces
   - [ ] Backend builds without errors (`cargo build`)
   - [ ] No clippy warnings (`cargo clippy`)

## Phase 2: Frontend Type Definitions (Frontend - TypeScript)

- [x] Task 2.1: Update API Types
**File:** `frontend/src/types/api.ts`

**Objective:** Add new fields to NodeInfo and NodeDetailStats interfaces

**Steps:**
1. Update `NodeInfo` interface:
   ```typescript
   export interface NodeInfo {
     // ... existing fields ...
     isMaster: boolean;
     isMasterEligible: boolean;
     loadAverage: number; // 1-minute
     uptime: string;
     uptimeMillis?: number;
   }
   ```

2. Update `NodeDetailStats` interface:
   ```typescript
   export interface NodeDetailStats {
     // ... existing fields ...
     isMaster: boolean;
     isMasterEligible: boolean;
     loadAverage: [number, number, number]; // 1m, 5m, 15m
     uptime: string;
     uptimeMillis: number;
     shards?: ShardStats;
     indexing?: IndexingStats;
     search?: SearchStats;
     fs?: FileSystemStats;
     network?: NetworkStats;
     jvm?: JvmStats;
   }
   ```

3. Add new interfaces:
   ```typescript
   export interface ShardStats {
     total: number;
     primary: number;
     replica: number;
     list: ShardInfo[];
   }
   
   export interface IndexingStats {
     indexTotal: number;
     indexTimeInMillis: number;
     indexCurrent: number;
     indexFailed: number;
     deleteTotal: number;
     deleteTimeInMillis: number;
   }
   
   export interface SearchStats {
     queryTotal: number;
     queryTimeInMillis: number;
     queryCurrent: number;
     fetchTotal: number;
     fetchTimeInMillis: number;
   }
   
   export interface FileSystemStats {
     total: number;
     available: number;
     used: number;
     path: string;
     type: string;
   }
   
   export interface NetworkStats {
     rxBytes: number;
     txBytes: number;
   }
   
   export interface JvmStats {
     gcCollectors: Record<string, {
       collectionCount: number;
       collectionTimeInMillis: number;
     }>;
   }
   ```

**Acceptance Criteria:**
   - [ ] All interfaces compile without TypeScript errors
   - [ ] Interfaces match backend response structure
   - [ ] Optional fields marked with `?`
   - [ ] Frontend builds without errors

- [x] Task 2.2: Update API Client
**File:** `frontend/src/api/client.ts`

**Objective:** Ensure API client methods return correct types

**Steps:**
1. Verify `getNodes()` returns `NodeInfo[]` with new fields
2. Verify `getNodeStats()` returns `NodeDetailStats` with new fields
3. Add error handling for missing fields
4. Add default values for optional fields

   **Acceptance Criteria:**
   - [ ] API client compiles without errors
   - [ ] Methods return correct types
   - [ ] Error handling works for malformed responses
   - [ ] Frontend builds without errors

## Phase 3: Utility Functions (Frontend - TypeScript)

- [x] Task 3.1: Create Formatter Utilities
**File:** `frontend/src/utils/formatters.ts`

**Objective:** Add utility functions for formatting node data

**Steps:**
1. Add `formatUptime(milliseconds: number): string`
   - Returns "5d 3h" or "2h 45m" format
2. Add `formatUptimeDetailed(milliseconds: number): string`
   - Returns "5 days, 3 hours, 24 minutes" format
3. Add `formatLoadAverage(load: number): string`
   - Returns load with 2 decimal places
4. Add `getLoadColor(load: number, cpuCount?: number): string`
   - Returns color based on load per CPU
5. Add `formatRate(count: number, timeMs: number): string`
   - Returns rate per second (e.g., "1.5k/s")

   **Acceptance Criteria:**
   - [ ] All functions have proper TypeScript types
   - [ ] Functions handle edge cases (0, undefined, very large numbers)
   - [ ] Unit tests pass (if added)
   - [ ] Frontend builds without errors

## Phase 4: Reusable Components (Frontend - React)

- [x] Task 4.1: Create MasterIndicator Component
**File:** `frontend/src/components/MasterIndicator.tsx`

**Objective:** Display master status indicator (★ or ☆)

**Steps:**
1. Create component with props:
   - `isMaster: boolean`
   - `isMasterEligible: boolean`
   - `size?: 'sm' | 'md' | 'lg'`
   - `showTooltip?: boolean`
2. Render filled star (★) for master
3. Render hollow star (☆) for master-eligible
4. Return null if neither
5. Add Tooltip with "Current Master" or "Master Eligible"
6. Style with Mantine colors (yellow for master, gray for eligible)

   **Acceptance Criteria:**
   - [ ] Component renders correctly
   - [ ] Stars display with correct colors
   - [ ] Tooltips show on hover
   - [ ] Size prop works correctly
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 4.2: Create ShardList Component
**File:** `frontend/src/components/ShardList.tsx`

**Objective:** Display table of shards allocated to a node

**Steps:**
1. Create component with props:
   - `shards: ShardInfo[]`
   - `loading: boolean`
2. Render Mantine Table with columns:
   - Index name
   - Shard number
   - Type (Primary/Replica badge)
   - State (badge with color)
   - Documents count
   - Size
3. Add loading skeleton
4. Handle empty state
5. Make table scrollable

   **Acceptance Criteria:**
   - [ ] Table displays all shards
   - [ ] Badges show correct colors
   - [ ] Loading state works
   - [ ] Empty state shows message
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 4.3: Create NodeCharts Component
**File:** `frontend/src/components/NodeCharts.tsx`

**Objective:** Display time series charts for node metrics

**Steps:**
1. Create component with props:
   - `heapHistory: DataPoint[]`
   - `diskHistory: DataPoint[]`
   - `cpuHistory: DataPoint[]`
   - `loadHistory: DataPoint[]`
2. Create 4 area charts (2x2 grid):
   - Heap Usage Over Time
   - Disk Usage Over Time
   - CPU Usage Over Time
   - Load Average Over Time
3. Use recharts AreaChart component
4. Style consistently with ClusterStatistics
5. Add proper axes and labels

   **Acceptance Criteria:**
   - [ ] All 4 charts render correctly
   - [ ] Charts update on data change
   - [ ] Styling matches cluster statistics
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

## Phase 5: Enhance Nodes List (Frontend - React)

- [x] Task 5.1: Add Master Indicator Column
**File:** `frontend/src/pages/ClusterView.tsx` (NodesList component)

**Objective:** Add master indicator before node name

**Steps:**
1. Import MasterIndicator component
2. Add indicator in name cell (before node name)
3. Update table layout to accommodate indicator
4. Test with master and non-master nodes

   **Acceptance Criteria:**
   - [ ] Master indicator shows for master node
   - [ ] Master-eligible indicator shows for eligible nodes
   - [ ] No indicator for non-master nodes
   - [ ] Layout looks good
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 5.2: Add Load Average Column
**File:** `frontend/src/pages/ClusterView.tsx` (NodesList component)

**Objective:** Display 1-minute load average

**Steps:**
1. Add "Load" column header
2. Display `node.loadAverage` formatted to 2 decimals
3. Add color coding based on load value
4. Handle undefined/null values (show "N/A")
5. Make column sortable

   **Acceptance Criteria:**
   - [ ] Load average displays correctly
   - [ ] Color coding works (green/yellow/red)
   - [ ] N/A shows for missing data
   - [ ] Column is sortable
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 5.3: Add Uptime Column
**File:** `frontend/src/pages/ClusterView.tsx` (NodesList component)

**Objective:** Display node uptime in human-readable format

**Steps:**
1. Add "Uptime" column header
2. Display `node.uptime` (already formatted by backend)
3. Add tooltip with detailed uptime on hover
4. Handle undefined/null values (show "N/A")
5. Make column sortable

   **Acceptance Criteria:**
   - [ ] Uptime displays correctly
   - [ ] Tooltip shows detailed uptime
   - [ ] N/A shows for missing data
   - [ ] Column is sortable
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

## Phase 6: Redesign Node Details Page (Frontend - React)

- [x] Task 6.1: Fix Data Display Issues
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Fix NaN/undefined values in node details

**Steps:**
1. Add null/undefined checks for all displayed values
2. Use optional chaining (`?.`) for nested properties
3. Provide fallback values ("N/A" or 0)
4. Add loading states for all sections
5. Test with real Elasticsearch data

   **Acceptance Criteria:**
   - [ ] No NaN or undefined displayed
   - [ ] All values show correctly or "N/A"
   - [ ] Loading states work
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 6.2: Add Master Indicator to Header
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Show master status in node details header

**Steps:**
1. Import MasterIndicator component
2. Add indicator next to node name in header
3. Use large size for visibility
4. Add roles badges after indicator

   **Acceptance Criteria:**
   - [ ] Master indicator shows in header
   - [ ] Indicator is prominent and visible
   - [ ] Layout looks good
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 6.3: Enhance Overview Cards
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Add load average and uptime cards

**Steps:**
1. Add "Load Average" card showing 1m, 5m, 15m values
2. Add "Uptime" card with detailed uptime
3. Update existing cards to show actual data
4. Arrange in responsive grid (5 cards total)
5. Add icons to cards for visual appeal

**Acceptance Criteria:**
   - [ ] All 5 cards display correctly
   - [ ] Load average shows all 3 values
   - [ ] Uptime shows detailed format
   - [ ] Grid is responsive
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 6.4: Add Resource Usage Charts
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Add time series charts for heap, disk, CPU

**Steps:**
1. Import NodeCharts component
2. Use `useSparklineData` hook for each metric:
   - `heapHistory` from `nodeStats.heapPercent`
   - `diskHistory` from `nodeStats.diskPercent`
   - `cpuHistory` from `nodeStats.cpuPercent`
   - `loadHistory` from `nodeStats.loadAverage[0]`
3. Pass histories to NodeCharts component
4. Add section title "Performance Metrics"
5. Reset data when switching away from page

   **Acceptance Criteria:**
   - [ ] All 4 charts display correctly
   - [ ] Charts update on refresh
   - [ ] Data resets when leaving page
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [x] Task 6.5: Add Data Node Section
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Show shard and indexing statistics for data nodes

**Steps:**
1. Add conditional section: `if (nodeStats.roles?.includes('data'))`
2. Create "Data Node Statistics" card
3. Add shard statistics summary:
   - Total shards
   - Primary shards
   - Replica shards
4. Import and use ShardList component
5. Add indexing metrics:
   - Documents indexed (total and rate)
   - Indexing time
   - Index failures
6. Add search metrics:
   - Query count (total and rate)
   - Query time
   - Fetch count and time
7. Add file system information

   **Acceptance Criteria:**
   - [ ] Section only shows for data nodes
   - [ ] Shard statistics display correctly
   - [ ] Shard list table shows all shards
   - [ ] Indexing metrics display correctly
   - [ ] Search metrics display correctly
   - [ ] File system info displays correctly
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [ ] Task 6.6: Add Master Node Section
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Show cluster state information for master nodes

**Steps:**
1. Add conditional section: `if (nodeStats.roles?.includes('master'))`
2. Create "Master Node Information" card
3. Add cluster state metrics (if available):
   - Pending tasks count
   - Cluster state version
   - Last state update time
4. Add note about master responsibilities

   **Acceptance Criteria:**
   - [ ] Section only shows for master nodes
   - [ ] Cluster state info displays (if available)
   - [ ] Graceful handling if data not available
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [ ] Task 6.7: Add Ingest Node Section
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Show pipeline statistics for ingest nodes

**Steps:**
1. Add conditional section: `if (nodeStats.roles?.includes('ingest'))`
2. Create "Ingest Node Statistics" card
3. Add pipeline metrics (if available):
   - Active pipelines count
   - Documents processed
   - Processing time
   - Failures
4. Handle case where no pipelines exist

   **Acceptance Criteria:**
   - [ ] Section only shows for ingest nodes
   - [ ] Pipeline stats display (if available)
   - [ ] Empty state shows if no pipelines
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

- [ ] Task 6.8: Enhance Thread Pool Statistics
**File:** `frontend/src/pages/NodeDetail.tsx`

**Objective:** Improve thread pool table display

**Steps:**
1. Keep existing thread pool table
2. Add sorting capability
3. Add filtering (show only pools with activity)
4. Highlight pools with high queue or rejections
5. Add tooltips explaining each column

   **Acceptance Criteria:**
   - [ ] Table displays all thread pools
   - [ ] Sorting works on all columns
   - [ ] Filtering works correctly
   - [ ] Highlighting works for problematic pools
   - [ ] Tooltips provide helpful information
   - [ ] Component compiles without errors
   - [ ] Frontend builds without errors

## Phase 7: Testing and Polish

- [ ] Task 7.1: Manual Testing - Nodes List
**Objective:** Verify nodes list enhancements work correctly

   **Test Cases:**
   - [ ] Master indicator shows filled star for current master
   - [ ] Master indicator shows hollow star for master-eligible nodes
   - [ ] No indicator for non-master nodes
   - [ ] Load average displays numeric value
   - [ ] Uptime displays human-readable format
   - [ ] All progress bars show correct percentages
   - [ ] Table is sortable by all columns
   - [ ] Clicking row navigates to node details
   - [ ] Search and filter work correctly
   - [ ] Pagination works correctly

- [ ] Task 7.2: Manual Testing - Node Details (All Nodes)
**Objective:** Verify node details page works for all node types

   **Test Cases:**
   - [ ] Header shows correct master indicator
   - [ ] All overview cards display valid data (no NaN/undefined)
   - [ ] Load average card shows 1m, 5m, 15m values
   - [ ] Uptime card shows detailed format
   - [ ] Resource usage progress bars show correct values
   - [ ] All 4 charts display and update on refresh
   - [ ] Thread pool statistics table shows data
   - [ ] Back button returns to cluster view
   - [ ] Page refreshes automatically at interval

- [ ] Task 7.3: Manual Testing - Node Details (Data Nodes)
**Objective:** Verify data node specific sections

   **Test Cases:**
   - [ ] Data node section appears
   - [ ] Shard statistics show correct counts
   - [ ] Shard list table shows all shards on node
   - [ ] Shard list is sortable
   - [ ] Indexing statistics display correctly
   - [ ] Search statistics display correctly
   - [ ] File system information shows
   - [ ] Rates are calculated correctly


**Estimated Effort:**
- Phase 1 (Backend - Rust): 2-3 days
- Phase 2 (Types - TypeScript): 0.5 days
- Phase 3 (Utils - TypeScript): 0.5 days
- Phase 4 (Components - React): 1-2 days
- Phase 5 (Nodes List - React): 1 day
- Phase 6 (Node Details - React): 3-4 days
- Phase 7 (Testing): 2-3 days
- Phase 8 (Deployment): 1 day

**Total Estimated Time:** 11-17 days

**Dependencies:**
- Phase 2 depends on Phase 1
- Phase 4 depends on Phase 2, 3
- Phase 5 depends on Phase 4
- Phase 6 depends on Phase 4
- Phase 7 depends on Phase 5, 6
- Phase 8 depends on Phase 7

**Priority:**
1. Fix data display issues (Task 6.1) - CRITICAL
2. Add master indicators (Tasks 4.1, 5.1, 6.2) - HIGH
3. Add load/uptime (Tasks 5.2, 5.3, 6.3) - HIGH
4. Add charts (Tasks 4.3, 6.4) - MEDIUM
5. Add role-specific sections (Tasks 6.5, 6.6, 6.7) - MEDIUM
6. Polish and testing (Phase 7) - HIGH
