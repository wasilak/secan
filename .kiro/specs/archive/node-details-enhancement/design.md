# Node Details Enhancement - Design Document (Rust Rewrite)

## Architecture Overview

This enhancement touches three main areas:
1. **Backend API** (Rust/Axum) - Enhanced data collection from Elasticsearch
2. **Frontend Data Layer** (TypeScript) - Updated types and API client
3. **Frontend UI** (React/Mantine) - Enhanced nodes list and redesigned node details page

## Component Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     ClusterView                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │              Nodes Tab                                  │ │
│  │  ┌──────────────────────────────────────────────────┐  │ │
│  │  │           NodesList Component                     │  │ │
│  │  │  - Master indicators                              │  │ │
│  │  │  - Load average column                            │  │ │
│  │  │  - Uptime column                                  │  │ │
│  │  │  - Enhanced metrics                               │  │ │
│  │  └──────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ Click node row
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   NodeDetail Page                            │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Header (with MasterIndicator)                         │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Overview Cards Grid                                   │ │
│  │  [Version] [JVM] [Uptime] [CPU] [Load]                │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Resource Usage (Progress + Charts)                   │ │
│  │  - Heap Memory                                         │ │
│  │  - Disk Usage                                          │ │
│  │  - CPU Usage                                           │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  NodeCharts Component                                  │ │
│  │  - Time series for heap, disk, CPU, load              │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Role-Specific Sections (Conditional)                 │ │
│  │  - Master: Cluster state info                         │ │
│  │  - Data: Shard statistics, indexing/search metrics    │ │
│  │  - Ingest: Pipeline statistics                        │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Thread Pool Statistics Table                         │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow Diagram

```
┌──────────────┐
│   Frontend   │
│  (React UI)  │
└──────┬───────┘
       │
       │ GET /api/clusters/:id/nodes
       │ GET /api/clusters/:id/nodes/:nodeId/stats
       │
       ▼
┌──────────────┐
│   Backend    │
│ (Rust/Axum)  │
└──────┬───────┘
       │
       │ cluster.nodes_info()
       │ cluster.nodes_stats()
       │ cluster.cluster_state() → master_node
       │ cluster.cat_shards()
       │
       ▼
┌──────────────┐
│Elasticsearch │
│   Cluster    │
└──────────────┘
```

## Backend Design (Rust/Axum)

### Routes Module Enhancement

**File:** `backend/src/routes/clusters.rs`

#### Current Implementation
```rust
pub async fn get_nodes(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
) -> Result<Json<Vec<NodeInfoResponse>>, ClusterErrorResponse> {
    // Get the cluster
    let cluster = state.cluster_manager.get_cluster(&cluster_id).await?;

    // Get nodes info and stats using SDK typed methods
    let nodes_info = cluster.nodes_info().await?;
    let nodes_stats = cluster.nodes_stats().await?;
    
    // Get cluster state to determine master node
    let master_node_id = match cluster.cluster_state().await {
        Ok(cluster_state) => {
            cluster_state
                .get("master_node")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        }
        Err(e) => {
            tracing::warn!("Failed to get cluster state: {}", e);
            None
        }
    };

    // Transform to frontend format
    let response = transform_nodes(&nodes_info, &nodes_stats, master_node_id.as_deref());

    Ok(Json(response))
}
```

#### Enhanced Implementation (TODO)
```rust
pub async fn get_nodes(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
) -> Result<Json<Vec<NodeInfoResponse>>, ClusterErrorResponse> {
    // Get the cluster
    let cluster = state.cluster_manager.get_cluster(&cluster_id).await?;

    // Get nodes info and stats
    let nodes_info = cluster.nodes_info().await?;
    let nodes_stats = cluster.nodes_stats().await?;
    
    // Get cluster state for master node ID
    let master_node_id = match cluster.cluster_state().await {
        Ok(cluster_state) => {
            cluster_state
                .get("master_node")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
        }
        Err(e) => {
            tracing::warn!("Failed to get cluster state: {}", e);
            None
        }
    };

    // Transform to frontend format with enhanced fields
    let response = transform_nodes_enhanced(
        &nodes_info,
        &nodes_stats,
        master_node_id.as_deref()
    );

    Ok(Json(response))
}

// NEW ENDPOINT
pub async fn get_node_stats(
    State(state): State<ClusterState>,
    Path((cluster_id, node_id)): Path<(String, String)>,
) -> Result<Json<NodeDetailStatsResponse>, ClusterErrorResponse> {
    // Get the cluster
    let cluster = state.cluster_manager.get_cluster(&cluster_id).await?;

    // Get detailed node stats
    let node_stats = cluster.node_stats(&node_id).await?;
    
    // Get cluster state for master info
    let cluster_state = cluster.cluster_state().await?;
    
    // Get shards for data nodes
    let shards = if has_data_role(&node_stats) {
        Some(cluster.cat_shards().await?)
    } else {
        None
    };

    // Transform to frontend format
    let response = transform_node_detail_stats(
        &node_id,
        &node_stats,
        &cluster_state,
        shards.as_ref()
    );

    Ok(Json(response))
}
```

### Transform Module Enhancement

**File:** `backend/src/routes/clusters/transform.rs`

#### Current Implementation
```rust
pub fn transform_nodes(
    nodes_info: &Value,
    nodes_stats: &Value,
    master_node_id: Option<&str>,
) -> Vec<NodeInfoResponse> {
    let mut result = Vec::new();

    if let Some(nodes_obj) = nodes_info["nodes"].as_object() {
        for (node_id, node_info) in nodes_obj {
            let node_stats = &nodes_stats["nodes"][node_id];

            // Parse roles
            let roles: Vec<String> = if let Some(roles_array) = node_info["roles"].as_array() {
                roles_array
                    .iter()
                    .filter_map(|r| r.as_str().map(|s| s.to_string()))
                    .collect()
            } else {
                Vec::new()
            };

            // Determine master status
            let is_master_eligible = roles.contains(&"master".to_string());
            let is_master = master_node_id.is_some_and(|mid| mid == node_id);

            // Parse resource stats...
            // (existing code)

            result.push(NodeInfoResponse {
                id: node_id.clone(),
                name: node_info["name"].as_str().unwrap_or("").to_string(),
                roles,
                // ... existing fields ...
                is_master,
                is_master_eligible,
            });
        }
    }

    result
}
```

#### Enhanced Implementation (TODO)
```rust
pub fn transform_nodes_enhanced(
    nodes_info: &Value,
    nodes_stats: &Value,
    master_node_id: Option<&str>,
) -> Vec<NodeInfoResponse> {
    let mut result = Vec::new();

    if let Some(nodes_obj) = nodes_info["nodes"].as_object() {
        for (node_id, node_info) in nodes_obj {
            let node_stats = &nodes_stats["nodes"][node_id];

            // Parse roles
            let roles = extract_roles(node_info);

            // Determine master status
            let is_master_eligible = roles.contains(&"master".to_string());
            let is_master = master_node_id.is_some_and(|mid| mid == node_id);

            // Extract load average
            let load_average = extract_load_average(node_stats);

            // Extract and format uptime
            let uptime_millis = node_stats["jvm"]["uptime_in_millis"]
                .as_u64()
                .unwrap_or(0);
            let uptime = format_uptime(uptime_millis);

            // Extract tags/attributes
            let tags = extract_node_attributes(node_info);

            // Parse resource stats (existing code)...

            result.push(NodeInfoResponse {
                id: node_id.clone(),
                name: node_info["name"].as_str().unwrap_or("").to_string(),
                roles,
                // ... existing fields ...
                is_master,
                is_master_eligible,
                load_average,
                uptime: Some(uptime),
                uptime_millis: Some(uptime_millis),
                tags,
            });
        }
    }

    result
}

// NEW FUNCTION
pub fn transform_node_detail_stats(
    node_id: &str,
    node_stats: &Value,
    cluster_state: &Value,
    shards: Option<&Value>,
) -> NodeDetailStatsResponse {
    // Extract all detailed stats
    let roles = extract_roles(&node_stats["nodes"][node_id]);
    let is_master_eligible = roles.contains(&"master".to_string());
    let master_node_id = cluster_state.get("master_node").and_then(|v| v.as_str());
    let is_master = master_node_id.map_or(false, |mid| mid == node_id);

    // Extract load average (1m, 5m, 15m)
    let load_average = extract_load_average_all(&node_stats["nodes"][node_id]);

    // Extract uptime
    let uptime_millis = node_stats["nodes"][node_id]["jvm"]["uptime_in_millis"]
        .as_u64()
        .unwrap_or(0);
    let uptime = format_uptime(uptime_millis);

    // Extract thread pools
    let thread_pools = extract_thread_pools(&node_stats["nodes"][node_id]);

    // Extract shard stats (for data nodes)
    let shard_stats = if roles.contains(&"data".to_string()) {
        shards.map(|s| aggregate_shard_stats(node_id, s))
    } else {
        None
    };

    // Extract indexing/search stats (for data nodes)
    let indexing = if roles.contains(&"data".to_string()) {
        Some(extract_indexing_stats(&node_stats["nodes"][node_id]))
    } else {
        None
    };

    let search = if roles.contains(&"data".to_string()) {
        Some(extract_search_stats(&node_stats["nodes"][node_id]))
    } else {
        None
    };

    // Build response
    NodeDetailStatsResponse {
        id: node_id.to_string(),
        // ... all fields ...
        is_master,
        is_master_eligible,
        load_average,
        uptime,
        uptime_millis,
        thread_pools,
        shards: shard_stats,
        indexing,
        search,
        // ... other fields ...
    }
}
```

### Helper Functions (TODO)

```rust
fn extract_load_average(node_stats: &Value) -> Option<f64> {
    node_stats["os"]["cpu"]["load_average"]["1m"]
        .as_f64()
        .or_else(|| node_stats["os"]["load_average"].as_f64())
}

fn extract_load_average_all(node_stats: &Value) -> Option<[f64; 3]> {
    let load_obj = &node_stats["os"]["cpu"]["load_average"];
    if let (Some(m1), Some(m5), Some(m15)) = (
        load_obj["1m"].as_f64(),
        load_obj["5m"].as_f64(),
        load_obj["15m"].as_f64(),
    ) {
        Some([m1, m5, m15])
    } else {
        None
    }
}

fn format_uptime(millis: u64) -> String {
    let seconds = millis / 1000;
    let minutes = seconds / 60;
    let hours = minutes / 60;
    let days = hours / 24;

    if days > 0 {
        format!("{}d {}h", days, hours % 24)
    } else if hours > 0 {
        format!("{}h {}m", hours, minutes % 60)
    } else if minutes > 0 {
        format!("{}m", minutes)
    } else {
        format!("{}s", seconds)
    }
}

fn extract_node_attributes(node_info: &Value) -> Option<Vec<String>> {
    node_info["attributes"]
        .as_object()
        .map(|attrs| {
            attrs
                .iter()
                .map(|(k, v)| format!("{}:{}", k, v.as_str().unwrap_or("")))
                .collect()
        })
}

fn extract_thread_pools(node_stats: &Value) -> Option<HashMap<String, ThreadPoolStats>> {
    node_stats["thread_pool"]
        .as_object()
        .map(|pools| {
            pools
                .iter()
                .map(|(name, stats)| {
                    (
                        name.clone(),
                        ThreadPoolStats {
                            threads: stats["threads"].as_u64().unwrap_or(0) as u32,
                            queue: stats["queue"].as_u64().unwrap_or(0) as u32,
                            active: stats["active"].as_u64().unwrap_or(0) as u32,
                            rejected: stats["rejected"].as_u64().unwrap_or(0),
                            largest: stats["largest"].as_u64().unwrap_or(0) as u32,
                            completed: stats["completed"].as_u64().unwrap_or(0),
                        },
                    )
                })
                .collect()
        })
}

fn aggregate_shard_stats(node_id: &str, shards: &Value) -> ShardStats {
    // Parse shards response and filter by node_id
    // Count primary/replica shards
    // Build shard list
    // Return ShardStats
    todo!("Implement shard aggregation")
}

fn extract_indexing_stats(node_stats: &Value) -> IndexingStats {
    let indexing = &node_stats["indices"]["indexing"];
    IndexingStats {
        index_total: indexing["index_total"].as_u64().unwrap_or(0),
        index_time_in_millis: indexing["index_time_in_millis"].as_u64().unwrap_or(0),
        index_current: indexing["index_current"].as_u64().unwrap_or(0) as u32,
        index_failed: indexing["index_failed"].as_u64().unwrap_or(0),
        delete_total: indexing["delete_total"].as_u64().unwrap_or(0),
        delete_time_in_millis: indexing["delete_time_in_millis"].as_u64().unwrap_or(0),
    }
}

fn extract_search_stats(node_stats: &Value) -> SearchStats {
    let search = &node_stats["indices"]["search"];
    SearchStats {
        query_total: search["query_total"].as_u64().unwrap_or(0),
        query_time_in_millis: search["query_time_in_millis"].as_u64().unwrap_or(0),
        query_current: search["query_current"].as_u64().unwrap_or(0) as u32,
        fetch_total: search["fetch_total"].as_u64().unwrap_or(0),
        fetch_time_in_millis: search["fetch_time_in_millis"].as_u64().unwrap_or(0),
    }
}
```

## Frontend Design

### Component Hierarchy

```
ClusterView
└── Tabs
    └── Nodes Tab
        └── NodesList
            ├── Search/Filter Controls
            ├── Table
            │   └── NodeRow (for each node)
            │       ├── MasterIndicator
            │       ├── Name + IP
            │       ├── Node ID
            │       ├── Roles (badges)
            │       ├── Tags (badges)
            │       ├── Load Average
            │       ├── Uptime
            │       ├── Heap Progress
            │       ├── Disk Progress
            │       └── CPU Progress
            └── Pagination

NodeDetail (separate page)
├── Header
│   ├── Back Button
│   ├── MasterIndicator
│   ├── Node Name
│   ├── Node ID
│   ├── IP Address
│   ├── Roles (badges)
│   └── Tags (badges)
├── Overview Cards Grid
│   ├── ES Version Card
│   ├── JVM Version Card
│   ├── Uptime Card
│   ├── CPU Card
│   └── Load Average Card
├── Resource Usage Section
│   ├── Heap Memory (Progress + Chart)
│   ├── Disk Usage (Progress + Chart)
│   └── CPU Usage (Progress + Chart)
├── NodeCharts Component
│   ├── Heap Over Time
│   ├── Disk Over Time
│   ├── CPU Over Time
│   └── Load Average Over Time
├── Role-Specific Sections (Conditional)
│   ├── MasterSection (if master role)
│   ├── DataNodeSection (if data role)
│   │   ├── ShardStatistics
│   │   ├── ShardList Table
│   │   ├── IndexingMetrics
│   │   └── SearchMetrics
│   └── IngestSection (if ingest role)
└── ThreadPoolStatistics Table
```

### State Management

#### Nodes List State
```typescript
// URL parameters
const searchQuery = searchParams.get('nodesSearch') || '';
const selectedRoles = searchParams.get('roles')?.split(',') || [];
const sortBy = searchParams.get('sortBy') || 'name';
const sortOrder = searchParams.get('sortOrder') || 'asc';

// React Query
const { data: nodes, loading, error } = useQuery({
  queryKey: ['cluster', clusterId, 'nodes'],
  queryFn: () => apiClient.getNodes(clusterId),
  refetchInterval: refreshInterval,
});
```

#### Node Details State
```typescript
// URL parameters
const { clusterId, nodeId } = useParams();

// React Query
const { data: nodeStats, loading, error } = useQuery({
  queryKey: ['cluster', clusterId, 'node', nodeId, 'stats'],
  queryFn: () => apiClient.getNodeStats(clusterId, nodeId),
  refetchInterval: refreshInterval,
});

// Sparkline data for charts
const heapHistory = useSparklineData(
  nodeStats?.heapPercent,
  refreshInterval,
  activeTab, // Reset when switching tabs
  true // withTimestamps
);

const diskHistory = useSparklineData(
  nodeStats?.diskPercent,
  refreshInterval,
  activeTab,
  true
);

const cpuHistory = useSparklineData(
  nodeStats?.cpuPercent,
  refreshInterval,
  activeTab,
  true
);

const loadHistory = useSparklineData(
  nodeStats?.loadAverage?.[0],
  refreshInterval,
  activeTab,
  true
);
```

### Reusable Components

#### MasterIndicator Component
```typescript
interface MasterIndicatorProps {
  isMaster: boolean;
  isMasterEligible: boolean;
  size?: 'sm' | 'md' | 'lg';
  showTooltip?: boolean;
}

export function MasterIndicator({
  isMaster,
  isMasterEligible,
  size = 'md',
  showTooltip = true,
}: MasterIndicatorProps) {
  if (!isMaster && !isMasterEligible) {
    return null;
  }

  const icon = isMaster ? '★' : '☆';
  const color = isMaster ? 'yellow' : 'gray';
  const tooltip = isMaster ? 'Current Master' : 'Master Eligible';
  
  const fontSize = size === 'sm' ? '14px' : size === 'md' ? '18px' : '24px';

  return (
    <Tooltip label={tooltip} disabled={!showTooltip}>
      <Text
        component="span"
        c={color}
        style={{ fontSize, cursor: 'default' }}
      >
        {icon}
      </Text>
    </Tooltip>
  );
}
```

#### NodeCharts Component
```typescript
interface NodeChartsProps {
  heapHistory: DataPoint[];
  diskHistory: DataPoint[];
  cpuHistory: DataPoint[];
  loadHistory: DataPoint[];
}

export function NodeCharts({
  heapHistory,
  diskHistory,
  cpuHistory,
  loadHistory,
}: NodeChartsProps) {
  return (
    <Grid>
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card>
          <Title order={4}>Heap Usage Over Time</Title>
          <AreaChart
            data={heapHistory}
            dataKey="value"
            xAxisKey="timestamp"
            color="blue"
          />
        </Card>
      </Grid.Col>
      
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card>
          <Title order={4}>Disk Usage Over Time</Title>
          <AreaChart
            data={diskHistory}
            dataKey="value"
            xAxisKey="timestamp"
            color="cyan"
          />
        </Card>
      </Grid.Col>
      
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card>
          <Title order={4}>CPU Usage Over Time</Title>
          <AreaChart
            data={cpuHistory}
            dataKey="value"
            xAxisKey="timestamp"
            color="green"
          />
        </Card>
      </Grid.Col>
      
      <Grid.Col span={{ base: 12, md: 6 }}>
        <Card>
          <Title order={4}>Load Average Over Time</Title>
          <AreaChart
            data={loadHistory}
            dataKey="value"
            xAxisKey="timestamp"
            color="orange"
          />
        </Card>
      </Grid.Col>
    </Grid>
  );
}
```

#### ShardList Component
```typescript
interface ShardListProps {
  shards: ShardInfo[];
  loading: boolean;
}

export function ShardList({ shards, loading }: ShardListProps) {
  if (loading) {
    return <Skeleton height={200} />;
  }

  return (
    <ScrollArea>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Index</Table.Th>
            <Table.Th>Shard</Table.Th>
            <Table.Th>Type</Table.Th>
            <Table.Th>State</Table.Th>
            <Table.Th>Documents</Table.Th>
            <Table.Th>Size</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {shards.map((shard, idx) => (
            <Table.Tr key={idx}>
              <Table.Td>{shard.index}</Table.Td>
              <Table.Td>{shard.shard}</Table.Td>
              <Table.Td>
                <Badge color={shard.primary ? 'blue' : 'gray'}>
                  {shard.primary ? 'Primary' : 'Replica'}
                </Badge>
              </Table.Td>
              <Table.Td>
                <Badge color={getStateColor(shard.state)}>
                  {shard.state}
                </Badge>
              </Table.Td>
              <Table.Td>
                {shard.docs !== undefined ? shard.docs.toLocaleString() : 'N/A'}
              </Table.Td>
              <Table.Td>
                {shard.store !== undefined ? formatBytes(shard.store) : 'N/A'}
              </Table.Td>
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
    </ScrollArea>
  );
}
```

### Utility Functions

#### Uptime Formatting
```typescript
export function formatUptime(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

export function formatUptimeDetailed(milliseconds: number): string {
  const seconds = Math.floor(milliseconds / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  const parts: string[] = [];
  
  if (days > 0) parts.push(`${days} day${days > 1 ? 's' : ''}`);
  if (hours % 24 > 0) parts.push(`${hours % 24} hour${hours % 24 > 1 ? 's' : ''}`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60} minute${minutes % 60 > 1 ? 's' : ''}`);
  
  return parts.join(', ') || '0 minutes';
}
```

#### Load Average Formatting
```typescript
export function formatLoadAverage(load: number): string {
  return load.toFixed(2);
}

export function getLoadColor(load: number, cpuCount: number = 1): string {
  const normalized = load / cpuCount;
  if (normalized > 1.5) return 'red';
  if (normalized > 1.0) return 'yellow';
  return 'green';
}
```

#### Rate Calculation
```typescript
export function formatRate(count: number, timeMs: number): string {
  if (timeMs === 0) return '0/s';
  const perSecond = (count / timeMs) * 1000;
  if (perSecond > 1000) {
    return `${(perSecond / 1000).toFixed(2)}k/s`;
  }
  return `${perSecond.toFixed(2)}/s`;
}
```

## Styling Guidelines

### Master Indicator
- Filled star (★): `color: var(--mantine-color-yellow-6)`
- Hollow star (☆): `color: var(--mantine-color-gray-6)`
- Size: 18px in table, 24px in details header
- Tooltip on hover

### Load Average
- Display: Monospace font, 2 decimal places
- Color coding:
  - Green: < 1.0 per CPU
  - Yellow: 1.0 - 1.5 per CPU
  - Red: > 1.5 per CPU

### Uptime
- Short format in table: "5d 3h" or "2h 45m"
- Detailed format in details: "5 days, 3 hours, 24 minutes"
- Color: Dimmed text

### Role-Specific Sections
- Each section in a Card component
- Section title with role badge
- Consistent spacing and layout
- Conditional rendering based on node roles

## Performance Considerations

1. **Data Fetching**
   - Use React Query for caching and automatic refetching
   - Debounce search inputs (300ms)
   - Paginate nodes list if > 100 nodes

2. **Chart Rendering**
   - Limit sparkline data points to last 50 samples
   - Use `useMemo` for chart data transformations
   - Lazy load charts (render only when tab is active)

3. **Table Rendering**
   - Virtualize table rows if > 50 nodes
   - Use `React.memo` for row components
   - Optimize re-renders with proper key props

4. **Backend Optimization**
   - Cache master node ID (refresh every 30s)
   - Batch Elasticsearch requests where possible
   - Use `filter_path` to reduce response size

## Error Handling

### Missing Data
- Display "N/A" for undefined/null values
- Show placeholder for missing charts
- Graceful degradation for unsupported ES versions

### API Errors
- Show error alert with retry button
- Log errors to console for debugging
- Maintain last known good state

### Edge Cases
- Node with no roles (show warning)
- Node disconnected (show offline status)
- Very old ES version (show compatibility warning)

## Accessibility

- Master indicators have ARIA labels
- All charts have descriptive titles
- Tables are keyboard navigable
- Color is not the only indicator (use icons + text)
- Tooltips provide additional context

## Browser Compatibility

- Modern browsers (Chrome, Firefox, Safari, Edge)
- Responsive design for mobile/tablet
- Graceful degradation for older browsers
- Test on different screen sizes

## Security Considerations

- No sensitive data in URLs
- Sanitize node names/IDs before display
- Validate all API responses
- Handle malformed Elasticsearch responses gracefully
