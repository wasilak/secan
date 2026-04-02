# Node Details Enhancement Specification (Rust Rewrite)

## Overview

Enhance the node details page and nodes list to provide comprehensive node information, visual indicators for master nodes, and role-specific statistics. This brings the node management experience to parity with the original Cerebro while adding modern visualizations.

**Target Architecture:** Rust backend (Axum) + React frontend (Mantine UI)

## Goals

1. Fix data display issues in node details page (currently showing NaN/undefined)
2. Add visual indicators for master and master-eligible nodes
3. Display load average and uptime in nodes list and details
4. Create comprehensive node details page with charts and statistics
5. Provide role-specific sections for different node types (master, data, ingest, etc.)

## User Stories

### US-1: Master Node Identification
**As a** cluster administrator  
**I want to** quickly identify the current master and master-eligible nodes  
**So that** I can understand cluster leadership and failover capabilities

**Acceptance Criteria:**
- Current master node shows filled star (★) icon
- Master-eligible nodes show hollow star (☆) icon
- Icons appear in both nodes list and node details
- Visual distinction is clear and consistent

### US-2: Node Performance Metrics
**As a** cluster administrator  
**I want to** see load average and uptime for each node  
**So that** I can assess node health and stability

**Acceptance Criteria:**
- Load average displayed in nodes list (1-minute average)
- Uptime displayed in nodes list (human-readable format)
- Both metrics visible in node details page
- Load average shows all three values (1m, 5m, 15m) in details

### US-3: Comprehensive Node Details
**As a** cluster administrator  
**I want to** see detailed statistics and charts for a specific node  
**So that** I can diagnose issues and monitor node performance

**Acceptance Criteria:**
- Node details page shows all available metrics
- Charts visualize trends over time (similar to cluster statistics)
- Thread pool statistics displayed in table format
- Shard allocation shown for data nodes
- Role-specific sections displayed based on node roles

### US-4: Role-Specific Information
**As a** cluster administrator  
**I want to** see role-specific statistics for each node  
**So that** I can understand how each node contributes to the cluster

**Acceptance Criteria:**
- Master nodes show cluster state information
- Data nodes show shard statistics and indexing/search metrics
- Ingest nodes show pipeline statistics
- All nodes show common metrics (CPU, memory, disk, network)

## Design

### Nodes List Enhancements

#### Current State
- Name, Node ID, Roles, Tags, Heap Usage, Disk Usage, CPU

#### Enhanced State
- **Master Indicator** (before name)
  - ★ (filled star) for current master
  - ☆ (hollow star) for master-eligible
  - No star for non-master nodes
- **Name** with IP address
- **Node ID** (monospace)
- **Roles** (lowercase badges)
- **Tags** (outline badges)
- **Load Average** (1-minute value)
- **Uptime** (human-readable: "5d 3h" or "2h 45m")
- **Heap Usage** (progress bar)
- **Disk Usage** (progress bar)
- **CPU** (progress bar)

#### Layout
```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Name          │ Node ID  │ Roles │ Tags │ Load │ Uptime │ Heap │ Disk │ CPU │
├─────────────────────────────────────────────────────────────────────────────┤
│ ★ es01        │ abc123   │ [m]   │ prod │ 1.94 │ 5d 3h  │ ████ │ ████ │ ███ │
│   172.22.0.2  │          │ [d]   │      │      │        │ 45%  │ 34%  │ 12% │
├─────────────────────────────────────────────────────────────────────────────┤
│ ☆ es02        │ def456   │ [m]   │ prod │ 0.89 │ 2d 1h  │ ████ │ ████ │ ███ │
│   172.22.0.3  │          │ [d]   │      │      │        │ 38%  │ 29%  │ 8%  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Node Details Page Design

#### Header Section
- **Back to Cluster** button
- **Master Indicator** (★ or ☆) next to node name
- **Node Name** (large title)
- **Node ID** (monospace, copyable)
- **IP Address**
- **Roles** (badges)
- **Tags** (badges)
- **Uptime** (prominent display)

#### Overview Cards (Grid Layout)
1. **Elasticsearch Version**
2. **JVM Version**
3. **Uptime** (detailed: "5 days, 3 hours, 24 minutes")
4. **CPU Usage** (current percentage)
5. **Load Average** (1m, 5m, 15m)

#### Resource Usage Section
- **Heap Memory Usage** (progress bar + chart)
- **Disk Usage** (progress bar + chart)
- **CPU Usage** (progress bar + chart)
- **Network I/O** (if available)

#### Charts Section (Similar to Cluster Statistics)
- **Time Series Charts:**
  - Heap usage over time
  - Disk usage over time
  - CPU usage over time
  - Load average over time
  - JVM GC activity (if available)

#### Role-Specific Sections

##### For Master Nodes
- **Cluster State Management**
  - Pending tasks count
  - Cluster state version
  - Last state update time

##### For Data Nodes
- **Shard Statistics**
  - Total shards on this node
  - Primary shards count
  - Replica shards count
  - Shard list (table with index name, shard number, size)
- **Indexing Statistics**
  - Documents indexed (rate)
  - Indexing time
  - Index failures
- **Search Statistics**
  - Query count (rate)
  - Query time
  - Fetch count and time

##### For Ingest Nodes
- **Pipeline Statistics**
  - Active pipelines
  - Documents processed
  - Processing time
  - Failures

##### For All Nodes
- **Thread Pool Statistics** (existing table)
  - Pool name, threads, active, queue, largest, completed, rejected
  - Highlight pools with high queue or rejections

#### File System Section (for Data Nodes)
- **Disk Breakdown**
  - Total space
  - Available space
  - Used space
  - Mount point
  - File system type

## Technical Requirements

### Backend API Changes (Rust/Axum)

#### 1. Enhance Nodes List Endpoint
**Endpoint:** `GET /api/clusters/:clusterId/nodes`

**Current Implementation:** `backend/src/routes/clusters.rs` - `get_nodes()` function

**Current Response Structure:**
```rust
// backend/src/routes/clusters/transform.rs
pub struct NodeInfoResponse {
    pub id: String,
    pub name: String,
    pub roles: Vec<String>,
    pub heap_used: u64,
    pub heap_max: u64,
    pub disk_used: u64,
    pub disk_total: u64,
    pub cpu_percent: Option<u32>,
    pub ip: Option<String>,
    pub version: Option<String>,
    pub is_master: bool,              // ✅ IMPLEMENTED
    pub is_master_eligible: bool,     // ✅ IMPLEMENTED
}
```

**Required Additional Fields:**
```rust
pub load_average: Option<f64>,    // TODO: 1-minute average
pub uptime: Option<String>,       // TODO: Human-readable
pub uptime_millis: Option<u64>,   // TODO: For calculations
pub tags: Option<Vec<String>>,    // TODO: Node attributes/tags
```

**Implementation Notes:**
- Master status determination: ✅ Compare node ID with `cluster_state.master_node`
- Load average: Extract from `node_stats.os.cpu.load_average.1m`
- Uptime: Calculate from `node_stats.jvm.uptime_in_millis`
- Tags: Extract from `node_info.attributes`

#### 2. Create Node Detail Stats Endpoint
**Endpoint:** `GET /api/clusters/:clusterId/nodes/:nodeId/stats`

**New Implementation:** Add to `backend/src/routes/clusters.rs`

**Required Response Structure:**
```rust
pub struct NodeDetailStatsResponse {
    // Basic info
    pub id: String,
    pub name: String,
    pub roles: Vec<String>,
    pub ip: Option<String>,
    pub version: String,
    pub jvm_version: String,
    
    // Master status
    pub is_master: bool,
    pub is_master_eligible: bool,
    
    // Resource usage
    pub heap_used: u64,
    pub heap_max: u64,
    pub heap_percent: u32,
    pub disk_used: u64,
    pub disk_total: u64,
    pub disk_percent: u32,
    pub cpu_percent: Option<u32>,
    
    // Load and uptime
    pub load_average: Option<[f64; 3]>, // 1m, 5m, 15m
    pub uptime: String,
    pub uptime_millis: u64,
    
    // Thread pools
    pub thread_pools: Option<HashMap<String, ThreadPoolStats>>,
    
    // Shard statistics (for data nodes)
    pub shards: Option<ShardStats>,
    
    // Indexing stats (for data nodes)
    pub indexing: Option<IndexingStats>,
    
    // Search stats (for data nodes)
    pub search: Option<SearchStats>,
    
    // File system (for data nodes)
    pub fs: Option<FileSystemStats>,
    
    // Network stats
    pub network: Option<NetworkStats>,
    
    // JVM stats
    pub jvm: Option<JvmStats>,
}
```

**Supporting Structs:**
```rust
pub struct ThreadPoolStats {
    pub threads: u32,
    pub queue: u32,
    pub active: u32,
    pub rejected: u64,
    pub largest: u32,
    pub completed: u64,
}

pub struct ShardStats {
    pub total: u32,
    pub primary: u32,
    pub replica: u32,
    pub list: Vec<ShardInfo>,
}

pub struct IndexingStats {
    pub index_total: u64,
    pub index_time_in_millis: u64,
    pub index_current: u32,
    pub index_failed: u64,
    pub delete_total: u64,
    pub delete_time_in_millis: u64,
}

pub struct SearchStats {
    pub query_total: u64,
    pub query_time_in_millis: u64,
    pub query_current: u32,
    pub fetch_total: u64,
    pub fetch_time_in_millis: u64,
}

pub struct FileSystemStats {
    pub total: u64,
    pub available: u64,
    pub used: u64,
    pub path: String,
    pub fs_type: String,
}

pub struct NetworkStats {
    pub rx_bytes: u64,
    pub tx_bytes: u64,
}

pub struct JvmStats {
    pub gc_collectors: HashMap<String, GcCollectorStats>,
}

pub struct GcCollectorStats {
    pub collection_count: u64,
    pub collection_time_in_millis: u64,
}
```

### Frontend Changes

#### 1. Update API Types
**File:** `frontend/src/types/api.ts`

- Update `NodeInfo` interface with master status, load, uptime
- Update `NodeDetailStats` interface with all new fields
- Add new interfaces for shard stats, indexing stats, search stats

#### 2. Update API Client
**File:** `frontend/src/api/client.ts`

- Ensure `getNodes()` returns enhanced NodeInfo
- Ensure `getNodeStats()` returns enhanced NodeDetailStats
- Add error handling for missing fields

#### 3. Enhance Nodes List
**File:** `frontend/src/pages/ClusterView.tsx` (NodesList component)

**Changes:**
- Add master indicator column (before name)
- Add load average column
- Add uptime column
- Update table header and rows
- Add icon components for stars

#### 4. Redesign Node Details Page
**File:** `frontend/src/pages/NodeDetail.tsx`

**Major Refactor:**
- Fix data display (handle undefined/null values)
- Add master indicator to header
- Add overview cards grid
- Add resource usage charts (reuse chart components from ClusterStatistics)
- Add role-specific sections with conditional rendering
- Add shard statistics table for data nodes
- Add indexing/search metrics for data nodes
- Enhance thread pool statistics display

#### 5. Create Reusable Components

**File:** `frontend/src/components/MasterIndicator.tsx`
```typescript
interface MasterIndicatorProps {
  isMaster: boolean;
  isMasterEligible: boolean;
  size?: 'sm' | 'md' | 'lg';
}
```

**File:** `frontend/src/components/NodeCharts.tsx`
```typescript
// Time series charts for node metrics
// Similar to ClusterStatistics but for single node
```

**File:** `frontend/src/components/ShardList.tsx`
```typescript
// Table showing shards allocated to this node
```

#### 6. Add Utility Functions

**File:** `frontend/src/utils/formatters.ts`
```typescript
export function formatUptime(milliseconds: number): string;
export function formatLoadAverage(load: number): string;
export function formatRate(count: number, timeMs: number): string;
```

## Data Flow

### Nodes List
1. User navigates to Cluster View → Nodes tab
2. Frontend fetches `GET /api/clusters/:id/nodes`
3. Backend calls `cluster.nodes_info()` and `cluster.nodes_stats()` (Elasticsearch SDK)
4. Backend fetches `cluster.cluster_state()` to get `master_node` ID
5. Backend determines master status for each node by comparing IDs
6. Backend calculates load average and uptime from node stats
7. Backend transforms data using `transform_nodes()` in `backend/src/routes/clusters/transform.rs`
8. Frontend displays enhanced nodes list with all metrics

### Node Details
1. User clicks on node row in nodes list
2. Frontend navigates to `/cluster/:id/nodes/:nodeId`
3. Frontend fetches `GET /api/clusters/:id/nodes/:nodeId/stats`
4. Backend queries Elasticsearch `/_nodes/:nodeId/stats` with detailed metrics
5. Backend queries `/_cat/shards` filtered by node (for data nodes)
6. Backend queries `/_cluster/state` for master info
7. Backend aggregates and formats response using transform functions
8. Frontend displays comprehensive node details with charts

## Implementation Tasks

See `tasks.md` for detailed implementation tasks.

## Testing Requirements

### Manual Testing

#### Nodes List
- [ ] Master indicator shows filled star for current master
- [ ] Master indicator shows hollow star for master-eligible nodes
- [ ] Load average displays correctly (numeric value)
- [ ] Uptime displays in human-readable format
- [ ] All progress bars show correct percentages
- [ ] Table is sortable by all columns
- [ ] Clicking row navigates to node details

#### Node Details - All Nodes
- [ ] Header shows correct master indicator
- [ ] All overview cards display valid data (no NaN/undefined)
- [ ] Resource usage progress bars show correct values
- [ ] Charts display and update on refresh
- [ ] Thread pool statistics table shows data
- [ ] Back button returns to cluster view

#### Node Details - Master Nodes
- [ ] Cluster state section appears
- [ ] Pending tasks count displays
- [ ] Cluster state version shows

#### Node Details - Data Nodes
- [ ] Shard statistics section appears
- [ ] Shard list table shows all shards on node
- [ ] Indexing statistics display
- [ ] Search statistics display
- [ ] File system information shows

#### Node Details - Ingest Nodes
- [ ] Pipeline statistics section appears (if pipelines exist)
- [ ] Pipeline metrics display correctly

### Edge Cases
- [ ] Node with no load average data (show N/A)
- [ ] Node with no uptime data (show N/A)
- [ ] Node with no shards (data node)
- [ ] Node with multiple roles (show all relevant sections)
- [ ] Very long uptime (format correctly: "365d 12h")
- [ ] Very high load average (display without truncation)

## Success Metrics

1. **Data Accuracy:** All metrics display valid data (no NaN/undefined)
2. **Visual Clarity:** Master nodes easily identifiable at a glance
3. **Information Density:** Node details page provides comprehensive view without overwhelming
4. **Performance:** Page loads and refreshes smoothly with all charts
5. **Usability:** Users can quickly assess node health and role

## Future Enhancements

- Real-time metrics streaming (WebSocket)
- Historical data retention (store metrics in backend)
- Alerting on node metrics (high load, low disk space)
- Node comparison view (compare two nodes side-by-side)
- Export node metrics to CSV/JSON
- Custom metric dashboards per node role
