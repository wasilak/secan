# Design Document: UI/UX Improvements and Refinements

## Overview

This design establishes a comprehensive consistency framework for the Secan Elasticsearch admin tool, addressing visual inconsistencies, navigation patterns, information display, and user interactions. The central principle is **consistency** - creating uniform patterns across all views, modals, tables, forms, and interactions to provide a predictable and cohesive user experience.

The design builds upon the existing Mantine UI component library and React architecture, extending current patterns to ensure uniformity while fixing specific bugs and adding missing functionality.

## Architecture

### Consistency Framework

The consistency framework defines standard patterns that must be applied uniformly across the application:

1. **Modal Pattern**: All detail views (nodes, indices, shards) use the same modal dialog pattern with URL-based routing
2. **Navigation Pattern**: All clickable elements that navigate to details use consistent link styling and behavior
3. **Table Pattern**: All data tables share consistent styling, pagination, filtering, and action menus
4. **Theme Pattern**: All UI elements respect the current theme (light/dark/system) consistently
5. **Label Pattern**: All labels, field names, and terminology use consistent formatting and capitalization
6. **Color Coding Pattern**: All state indicators (health, shard states) use consistent colors across views
7. **Icon Pattern**: All icons follow consistent sizing, placement, and semantic meaning
8. **Spacing Pattern**: All layouts use consistent spacing from Mantine's design system

### Component Hierarchy

```
AppShell (existing)
├── Header
│   ├── Secan Title (with tooltip - NEW)
│   └── RefreshControl
├── Navigation
└── Main Content
    └── ClusterView
        ├── Tabs
        │   ├── Overview (general stats only - MODIFIED)
        │   ├── Topology (overview table - NEW)
        │   ├── Statistics
        │   ├── Nodes
        │   ├── Indices
        │   ├── Shards
        │   └── Console
        ├── NodeModal (NEW - replaces NodeDetail page)
        ├── IndexModal (existing pattern)
        └── ShardModal (potential future addition)
```

### State Management

- URL-based routing for all modals (node, index, shard details)
- Search params for filters, pagination, and view state
- Zustand store for client-side preferences
- TanStack Query for server state and caching

## Components and Interfaces

### 1. Branding Tooltip Component

**Purpose**: Add informative tooltip to "secan" title

**Location**: `frontend/src/components/AppShell.tsx`

**Implementation**:
```typescript
// In HeaderTitle component
<Tooltip 
  label="Secan - Secure Elasticsearch Admin" 
  position="bottom"
  withArrow
>
  <Text 
    size="xl"
    fw={700} 
    component="h1"
    style={{ whiteSpace: 'nowrap', cursor: 'help' }}
  >
    Secan
  </Text>
</Tooltip>
```

**Theme Compliance**: Tooltip automatically inherits theme from Mantine's ThemeProvider

### 2. Theme-Aware Tooltip System

**Purpose**: Ensure all tooltips follow current theme

**Current Issue**: Statistics tab tooltips have black background in light theme

**Solution**: Verify all Tooltip components use Mantine's Tooltip (not custom implementations)

**Pattern**:
```typescript
// Correct - theme-aware
<Tooltip label="Description">
  <Component />
</Tooltip>

// Incorrect - hardcoded styles
<div title="Description" style={{ backgroundColor: 'black' }}>
  <Component />
</div>
```

**Files to Audit**:
- `frontend/src/components/ClusterStatistics.tsx`
- `frontend/src/components/NodeCharts.tsx`
- All components using tooltips

### 3. Responsive Pagination System

**Purpose**: Adapt table pagination to screen size

**Location**: `frontend/src/components/TablePagination.tsx` (existing)

**Enhancement**: Add responsive default page size

**Implementation**:
```typescript
import { useMediaQuery } from '@mantine/hooks';

export function useResponsivePageSize(): number {
  const isXL = useMediaQuery('(min-width: 1536px)');
  const isLarge = useMediaQuery('(min-width: 1200px)');
  const isMedium = useMediaQuery('(min-width: 768px)');
  
  if (isXL || isLarge) return 10;
  if (isMedium) return 7;
  return 5;
}

// Usage in table components
const defaultPageSize = useResponsivePageSize();
const pageSize = parseInt(searchParams.get('pageSize') || defaultPageSize.toString(), 10);
```

**Table Column Width**: Use Mantine's Table component with responsive column widths

```typescript
<Table.Th style={{ width: 'auto' }}>Flexible Column</Table.Th>
<Table.Th style={{ width: '200px', minWidth: '200px' }}>Fixed Node Column</Table.Th>
```

### 4. Shard State Filter Component

**Purpose**: Multi-select filter for shard states

**Location**: `frontend/src/pages/ClusterView.tsx` (in ShardAllocationGrid section)

**Implementation**:
```typescript
const SHARD_STATES = ['STARTED', 'UNASSIGNED', 'INITIALIZING', 'RELOCATING'] as const;

// In component state
const [selectedStates, setSelectedStates] = useState<string[]>(SHARD_STATES.slice());

// Filter UI
<MultiSelect
  label="Shard States"
  placeholder="Filter by state"
  data={SHARD_STATES.map(state => ({ value: state, label: state }))}
  value={selectedStates}
  onChange={setSelectedStates}
  clearable={false} // All states selected by default
/>

// Apply filter to shard data
const filteredShards = shards?.filter(shard => 
  selectedStates.includes(shard.state)
);
```

### 5. Tab Restructuring

**Purpose**: Separate general statistics from topology view

**Current Structure**:
- Overview tab: Contains both stats cards AND overview table

**New Structure**:
- Overview tab: Only general statistics cards (nodes, indices, documents, shards, memory, disk)
- Topology tab: Overview table with filters and shard relocation (moved from Overview)
- Statistics tab: Historical charts (unchanged)

**Implementation**:
```typescript
<Tabs.List>
  <Tabs.Tab value="overview">Overview</Tabs.Tab>
  <Tabs.Tab value="topology">Topology</Tabs.Tab>
  <Tabs.Tab value="statistics">Statistics</Tabs.Tab>
  <Tabs.Tab value="nodes">Nodes ({nodes?.length || 0})</Tabs.Tab>
  <Tabs.Tab value="indices">Indices ({indices?.length || 0})</Tabs.Tab>
  <Tabs.Tab value="shards">Shards ({shards?.length || 0})</Tabs.Tab>
  <Tabs.Tab value="console">Console</Tabs.Tab>
</Tabs.List>

<Tabs.Panel value="overview" pt="md">
  {/* Only statistics cards, memory/disk usage */}
  <ClusterStatisticsCards stats={stats} />
</Tabs.Panel>

<Tabs.Panel value="topology" pt="md">
  {/* Overview table with filters and relocation */}
  <Card shadow="sm" padding="lg">
    <ShardAllocationGrid 
      nodes={nodes} 
      indices={indices} 
      shards={shards}
      loading={nodesLoading || indicesLoading || shardsLoading}
      error={nodesError || indicesError || shardsError}
      openIndexModal={openIndexModal}
    />
  </Card>
</Tabs.Panel>
```

### 6. Node Navigation Links

**Purpose**: Make node names clickable to open node details

**Location**: `frontend/src/components/ShardGrid.tsx` (Overview table)

**Implementation**:
```typescript
// In node name cell
<Anchor
  component="button"
  onClick={(e) => {
    e.stopPropagation();
    openNodeModal(node.id);
  }}
  style={{ 
    textDecoration: 'none',
    '&:hover': { textDecoration: 'underline' }
  }}
>
  <Text size="sm" fw={500}>{node.name}</Text>
</Anchor>
```

**Navigation Flow**:
1. User clicks node name in overview table
2. URL updates to include node ID: `/cluster/{clusterId}?tab=topology&node={nodeId}`
3. Node modal opens over topology view
4. Modal is directly linkable and shareable

### 7. Node Details Modal Pattern

**Purpose**: Convert NodeDetail page to modal, matching Index modal pattern

**Current**: NodeDetail is a separate page at `/cluster/{id}/nodes/{nodeId}`

**New**: NodeDetail becomes a modal accessible from multiple contexts

**Modal Component**:
```typescript
interface NodeModalProps {
  clusterId: string;
  nodeId: string | null;
  opened: boolean;
  onClose: () => void;
  context: 'topology' | 'nodes' | 'shards'; // Where modal was opened from
}

export function NodeModal({ clusterId, nodeId, opened, onClose, context }: NodeModalProps) {
  // Fetch node stats
  const { data: nodeStats, isLoading } = useQuery({
    queryKey: ['cluster', clusterId, 'node', nodeId, 'stats'],
    queryFn: () => apiClient.getNodeStats(clusterId, nodeId!),
    enabled: !!nodeId && opened,
  });
  
  return (
    <Modal
      opened={opened}
      onClose={onClose}
      size="90%"
      title={
        <Group gap="xs">
          <MasterIndicator 
            isMaster={nodeStats?.isMaster} 
            isMasterEligible={nodeStats?.isMasterEligible}
          />
          <Text fw={600}>{nodeStats?.name || 'Node Details'}</Text>
        </Group>
      }
      styles={{
        body: {
          height: 'calc(100vh - 120px)',
          overflow: 'auto',
        },
      }}
    >
      {/* Node details content - same as current NodeDetail page */}
      <NodeDetailContent nodeStats={nodeStats} loading={isLoading} />
    </Modal>
  );
}
```

**URL Integration**:
```typescript
// In ClusterView component
const [searchParams, setSearchParams] = useSearchParams();
const nodeIdParam = searchParams.get('node');
const [nodeModalOpen, setNodeModalOpen] = useState(false);

// Open node modal
const openNodeModal = (nodeId: string) => {
  const params = new URLSearchParams(searchParams);
  params.set('node', nodeId);
  setSearchParams(params);
};

// Close node modal
const closeNodeModal = () => {
  const params = new URLSearchParams(searchParams);
  params.delete('node');
  setSearchParams(params);
};

// Sync modal state with URL
useEffect(() => {
  setNodeModalOpen(!!nodeIdParam);
}, [nodeIdParam]);
```

**Remove "Back to Nodes List" Button**: Modal close (X button or outside click) handles navigation

### 8. Shards List Data Fix

**Purpose**: Display actual shard size and document count instead of "N/A"

**Current Issue**: Shards list shows N/A for size and documents

**Root Cause**: Shard data from `/_cat/shards` API may not include all fields

**Solution**: Enhance shard data fetching to include stats

**API Enhancement**:
```typescript
// In backend/src/routes/shards.rs
// Fetch shards with stats
let response = client
    .cat()
    .shards()
    .format("json")
    .bytes("b") // Get bytes instead of human-readable
    .h(&[
        "index",
        "shard",
        "prirep",
        "state",
        "docs",      // Document count
        "store",     // Store size in bytes
        "ip",
        "node",
        "unassigned.reason",
        "unassigned.at",
    ])
    .send()
    .await?;
```

**Frontend Type Update**:
```typescript
// In frontend/src/types/api.ts
export interface ShardInfo {
  index: string;
  shard: number;
  primary: boolean;
  state: ShardState;
  docs?: number;        // Add document count
  storeSize?: number;   // Add store size in bytes
  node?: string;
  ip?: string;
  relocatingNode?: string;
  unassignedReason?: string;
  unassignedAt?: string;
}
```

**Display in Shards List**:
```typescript
<Table.Td>
  <Text size="sm">
    {shard.docs !== undefined ? shard.docs.toLocaleString() : '0'}
  </Text>
</Table.Td>
<Table.Td>
  <Text size="sm">
    {shard.storeSize !== undefined ? formatBytes(shard.storeSize) : '0 B'}
  </Text>
</Table.Td>
```

### 9. Unified Index Actions Menu

**Purpose**: Consolidate two separate context menus into one

**Current Issue**: Index list has two action menus:
1. IndexOperations component (open, close, delete, etc.)
2. Separate Menu with Settings and Mappings

**Solution**: Merge into single menu

**Implementation**:
```typescript
// Remove separate IndexOperations component call
// Combine all actions into one Menu

<Menu shadow="md" width={220}>
  <Menu.Target>
    <ActionIcon variant="subtle" color="gray">
      <IconDots size={16} />
    </ActionIcon>
  </Menu.Target>

  <Menu.Dropdown>
    <Menu.Label>Index Operations</Menu.Label>
    <Menu.Item
      leftSection={<IconSettings size={14} />}
      onClick={() => openIndexModal(index.name, 'settings')}
    >
      Settings
    </Menu.Item>
    <Menu.Item
      leftSection={<IconMap size={14} />}
      onClick={() => openIndexModal(index.name, 'mappings')}
    >
      Mappings
    </Item>
    
    <Menu.Divider />
    
    <Menu.Label>Index Management</Menu.Label>
    {index.status === 'open' ? (
      <Menu.Item
        leftSection={<IconLock size={14} />}
        onClick={() => handleCloseIndex(index.name)}
      >
        Close Index
      </Menu.Item>
    ) : (
      <Menu.Item
        leftSection={<IconLockOpen size={14} />}
        onClick={() => handleOpenIndex(index.name)}
      >
        Open Index
      </Menu.Item>
    )}
    
    <Menu.Item
      leftSection={<IconRefresh size={14} />}
      onClick={() => handleRefreshIndex(index.name)}
    >
      Refresh
    </Menu.Item>
    
    <Menu.Item
      leftSection={<IconTrash size={14} />}
      color="red"
      onClick={() => handleDeleteIndex(index.name)}
    >
      Delete Index
    </Menu.Item>
  </Menu.Dropdown>
</Menu>
```

### 10. Unassigned Shard Type Display

**Purpose**: Show whether unassigned shards are primary or replica

**Current**: Unassigned shards don't clearly indicate type

**Solution**: Add visual indicator for shard type

**Badge Component**:
```typescript
function ShardTypeBadge({ primary }: { primary: boolean }) {
  return (
    <Badge 
      size="xs" 
      variant="light"
      color={primary ? 'blue' : 'gray'}
    >
      {primary ? 'P' : 'R'}
    </Badge>
  );
}
```

**Usage in Shards List**:
```typescript
<Table.Td>
  <Group gap="xs">
    <ShardTypeBadge primary={shard.primary} />
    <Badge color={getShardStateColor(shard.state)}>
      {shard.state}
    </Badge>
  </Group>
</Table.Td>
```

**Usage in Index List** (unassigned column):
```typescript
<Table.Td>
  {unassignedCount > 0 ? (
    <Tooltip label={
      <Stack gap={4}>
        {unassignedByIndex[index.name]?.map((shard, i) => (
          <Text key={i} size="xs">
            Shard {shard.shard} ({shard.primary ? 'Primary' : 'Replica'})
          </Text>
        ))}
      </Stack>
    }>
      <Badge size="sm" color="red" variant="filled">
        {unassignedCount}
      </Badge>
    </Tooltip>
  ) : (
    <Text size="sm" c="dimmed">-</Text>
  )}
</Table.Td>
```

**Usage in Overview Table**:
```typescript
// In ShardCell component
{shard.state === 'UNASSIGNED' && (
  <Group gap={2}>
    <ShardTypeBadge primary={shard.primary} />
    <Badge size="xs" color="red">UNASSIGNED</Badge>
  </Group>
)}
```

### 11. Overview Table Visual Consistency

**Purpose**: Remove special background from unassigned shards row

**Current**: Unassigned shards row has different background color

**Solution**: Use consistent row background, rely on shard badges for state indication

**Implementation**:
```typescript
// Remove special styling from unassigned row
<Table.Tr
  style={{
    // Remove: backgroundColor: 'rgba(250, 82, 82, 0.15)'
    // Keep standard striped table styling
  }}
>
  <Table.Td>
    <Text fw={600} size="sm" c="red">
      Unassigned Shards
    </Text>
  </Table.Td>
  {/* Shard cells with red badges provide visual indication */}
</Table.Tr>
```

### 12. Special Indices Filter

**Purpose**: Hide system/internal indices (starting with ".") by default

**Current**: All indices are shown, including Elasticsearch internal indices like .security, .kibana, etc.

**Solution**: Add checkbox filter to show/hide special indices, default to hidden

**Implementation**:
```typescript
// In component state
const [showSpecialIndices, setShowSpecialIndices] = useState(false);

// Filter function
const isSpecialIndex = (indexName: string) => indexName.startsWith('.');

// Apply filter to indices
const filteredIndices = indices?.filter(index => 
  showSpecialIndices || !isSpecialIndex(index.name)
);

// Filter UI
<Checkbox
  label="Show special indices"
  checked={showSpecialIndices}
  onChange={(event) => setShowSpecialIndices(event.currentTarget.checked)}
/>
```

**Locations to Apply**:
- `frontend/src/pages/ClusterView.tsx` - IndicesList component
- `frontend/src/pages/ClusterView.tsx` - ShardsList component (filter shards by index)
- `frontend/src/components/ShardGrid.tsx` - Overview_Table (filter indices in grid)

**Consistency Note**: Overview_Table already has this checkbox - ensure same behavior across all views

### 13. Shards List Statistics Display

**Purpose**: Replace large statistics box with compact cards matching overview style

**Current**: Large box with shard statistics above shards list table

**Solution**: Use compact statistics cards similar to overview tab

**Implementation**:
```typescript
// Create compact statistics cards component
interface ShardStatsCardsProps {
  stats: {
    totalShards: number;
    primaryShards: number;
    replicaShards: number;
    unassignedShards: number;
    relocatingShards: number;
    initializingShards: number;
  };
}

function ShardStatsCards({ stats }: ShardStatsCardsProps) {
  return (
    <SimpleGrid cols={{ base: 2, sm: 3, md: 6 }} spacing="md" mb="md">
      <Card shadow="sm" padding="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Total Shards</Text>
        <Text size="xl" fw={700}>{stats.totalShards}</Text>
      </Card>
      
      <Card shadow="sm" padding="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Primary</Text>
        <Text size="xl" fw={700} c="blue">{stats.primaryShards}</Text>
      </Card>
      
      <Card shadow="sm" padding="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Replica</Text>
        <Text size="xl" fw={700} c="gray">{stats.replicaShards}</Text>
      </Card>
      
      <Card shadow="sm" padding="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Unassigned</Text>
        <Text size="xl" fw={700} c="red">{stats.unassignedShards}</Text>
      </Card>
      
      <Card shadow="sm" padding="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Relocating</Text>
        <Text size="xl" fw={700} c="orange">{stats.relocatingShards}</Text>
      </Card>
      
      <Card shadow="sm" padding="md">
        <Text size="xs" c="dimmed" tt="uppercase" fw={700}>Initializing</Text>
        <Text size="xl" fw={700} c="yellow">{stats.initializingShards}</Text>
      </Card>
    </SimpleGrid>
  );
}
```

**Location**: `frontend/src/pages/ClusterView.tsx` - ShardsList component

**Visual Consistency**: Match the style of overview statistics cards (same Card component, same layout, same typography)

### 14. Dashboard Loading Skeleton

**Purpose**: Add loading skeleton to main dashboard clusters list

**Current**: No loading skeleton on main dashboard, just blank space while loading

**Solution**: Add Mantine Skeleton component matching pattern from cluster view

**Implementation**:
```typescript
// In Dashboard component
import { Skeleton } from '@mantine/core';

function Dashboard() {
  const { data: clusters, isLoading } = useClusters();
  
  if (isLoading) {
    return (
      <Stack gap="md">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} shadow="sm" padding="lg">
            <Group justify="space-between" mb="md">
              <Skeleton height={24} width={200} />
              <Skeleton height={20} width={80} circle />
            </Group>
            <Group gap="md">
              <Skeleton height={16} width={120} />
              <Skeleton height={16} width={100} />
              <Skeleton height={16} width={140} />
            </Group>
          </Card>
        ))}
      </Stack>
    );
  }
  
  return <ClustersList clusters={clusters} />;
}
```

**Location**: `frontend/src/pages/Dashboard.tsx` or main clusters list component

**Pattern Consistency**: Match skeleton pattern used in cluster view tabs (similar structure, timing, animation)

### 15. Backend Logging Level Adjustment

**Purpose**: Move verbose operational logs from INFO to DEBUG level

**Current**: Logs like "returning... clusters", "found shard stats", "request completed" at INFO level

**Solution**: Change these logs to DEBUG level in backend

**Implementation**:
```rust
// In backend/src/routes/clusters.rs
// Change from:
tracing::info!("returning {} clusters", clusters.len());

// To:
tracing::debug!("returning {} clusters", clusters.len());

// In backend/src/routes/shards.rs
// Change from:
tracing::info!("found shard stats for {} shards", shards.len());

// To:
tracing::debug!("found shard stats for {} shards", shards.len());

// In middleware or request logging
// Change from:
tracing::info!("request completed: {} {}", method, path);

// To:
tracing::debug!("request completed: {} {}", method, path);
```

**Files to Update**:
- `backend/src/routes/clusters.rs`
- `backend/src/routes/shards.rs`
- `backend/src/routes/nodes.rs`
- `backend/src/routes/indices.rs`
- Any middleware with request completion logging

**Keep at INFO Level**:
- Server startup/shutdown
- Configuration loading
- Authentication events
- Cluster connection events
- Error conditions

### 16. API URL Double Slash Investigation and Fix

**Purpose**: Identify and fix double slash bug in API URLs

**Current**: Logs show URLs like `/api/clusters//stats` with double slashes

**Investigation Steps**:
1. Check API client base URL configuration
2. Check route path definitions in backend
3. Check SDK client initialization
4. Check how paths are concatenated in API calls

**Likely Causes**:
```typescript
// Frontend API client configuration
// Incorrect:
const baseURL = 'http://localhost:9000/api/';
const path = '/clusters/stats';
// Results in: /api//clusters/stats

// Correct:
const baseURL = 'http://localhost:9000/api';
const path = '/clusters/stats';
// Results in: /api/clusters/stats

// Or:
const baseURL = 'http://localhost:9000/api/';
const path = 'clusters/stats'; // No leading slash
// Results in: /api/clusters/stats
```

**Solution**:
```typescript
// In frontend/src/api/client.ts
export const apiClient = axios.create({
  baseURL: '/api', // No trailing slash
  timeout: 30000,
});

// Ensure all API calls use paths without leading slash
// Or ensure consistent pattern (all with leading slash, baseURL without trailing)

// Check SDK initialization
const esClient = new ElasticsearchClient({
  baseURL: clusterUrl, // Ensure no trailing slash
});
```

**Files to Check**:
- `frontend/src/api/client.ts` - API client configuration
- `frontend/src/api/*.ts` - All API method calls
- `backend/src/routes/*.rs` - Route path definitions
- `backend/src/cluster/client.rs` - Elasticsearch SDK initialization

**Console Feature Exception**: Console feature makes custom HTTP calls from cluster view, which is expected and should not use the SDK

**Testing**:
- Check network tab for all API calls
- Verify no double slashes in any URL
- Test all API endpoints (clusters, nodes, indices, shards, stats)
- Verify Console feature still works with custom calls

## Data Models

### Consistency Patterns

**Modal State Pattern**:
```typescript
interface ModalState {
  opened: boolean;
  itemId: string | null;
  context: 'list' | 'grid' | 'detail';
  activeTab?: string;
}
```

**Filter State Pattern**:
```typescript
interface FilterState {
  search: string;
  selectedOptions: string[];
  expandedView: boolean;
  sortDirection: 'asc' | 'desc';
  pageSize: number;
  currentPage: number;
}
```

**Theme-Aware Component Pattern**:
```typescript
// All components must use Mantine's theme system
import { useMantineTheme, useMantineColorScheme } from '@mantine/core';

function ThemedComponent() {
  const theme = useMantineTheme();
  const { colorScheme } = useMantineColorScheme();
  
  // Use theme colors, not hardcoded values
  const bgColor = colorScheme === 'dark' 
    ? theme.colors.dark[6] 
    : theme.colors.gray[0];
    
  return <div style={{ backgroundColor: bgColor }}>...</div>;
}
```

### Enhanced Shard Info Type

```typescript
export interface ShardInfo {
  index: string;
  shard: number;
  primary: boolean;
  state: ShardState;
  docs: number;           // Always present (0 if unavailable)
  storeSize: number;      // Always present in bytes (0 if unavailable)
  node?: string;
  ip?: string;
  relocatingNode?: string;
  unassignedReason?: string;
  unassignedAt?: string;
}

export type ShardState = 'STARTED' | 'UNASSIGNED' | 'INITIALIZING' | 'RELOCATING';
```

### Responsive Page Size Hook

```typescript
export function useResponsivePageSize(): number {
  const isXL = useMediaQuery('(min-width: 1536px)');
  const isLarge = useMediaQuery('(min-width: 1200px)');
  const isMedium = useMediaQuery('(min-width: 768px)');
  
  if (isXL || isLarge) return 10;
  if (isMedium) return 7;
  return 5;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Prework Analysis

Based on the requirements, I've analyzed each acceptance criterion for testability:

**Testable as Properties:**
- Modal URL synchronization (round-trip property)
- Theme-aware tooltip styling across all components
- Shard state filtering behavior
- Shard data display (size and document count)
- Shard type indication across all views
- Color coding consistency for states

**Testable as Examples:**
- Specific UI elements exist (tabs, filters, buttons)
- Responsive page size defaults for different screen widths
- Modal behavior in different contexts
- Menu consolidation

**Not Testable:**
- Visual styling consistency (CSS, spacing, layout)
- UI pattern consistency (architectural decisions)
- Timing behavior (tooltip delays)

### Property Reflection

After reviewing all testable criteria, I identified the following redundancies:

1. **Theme-aware tooltips** (3.1, 3.2, 3.3) → Combined into single property about tooltip theme compliance
2. **Shard filtering** (5.4, 5.5) → Combined into single property about filter state affecting display
3. **Modal URL sync** (8.2, 8.3) → Combined into round-trip property
4. **Shard data display** (9.1, 9.2) → Combined into single property about complete shard information
5. **Shard type display** (11.1, 11.2, 11.3) → Combined into single property across all views
6. **Row styling** (12.1, 12.2) → Combined into single property about consistent row backgrounds

### Correctness Properties

Property 1: Modal URL Round Trip
*For any* modal state (node, index, shard), opening a modal should update the URL with the item identifier, and navigating to a URL with that identifier should open the corresponding modal with the same item.
**Validates: Requirements 1.2, 8.2, 8.3**

Property 2: Theme-Aware Tooltip Styling
*For any* tooltip component in the application, when the theme is set to light, dark, or system, the tooltip should use the corresponding theme styling from Mantine's theme system (not hardcoded colors).
**Validates: Requirements 2.3, 3.1, 3.2, 3.3, 3.5**

Property 3: Consistent State Color Coding
*For any* state value (health status, shard state), the same state should always map to the same color across all views and components where that state is displayed.
**Validates: Requirements 1.5**

Property 4: Shard State Filter Behavior
*For any* set of shards and any selection of shard states in the filter, the displayed shards should include only those whose state is in the selected set, and changing the selection should immediately update the displayed shards.
**Validates: Requirements 5.4, 5.5**

Property 5: Complete Shard Data Display
*For any* shard in the shards list, the display should show actual numeric values for size (in bytes) and document count, with 0 as the minimum value (never "N/A" or undefined).
**Validates: Requirements 9.1, 9.2, 9.5**

Property 6: Shard Type Indication Consistency
*For any* unassigned shard displayed in any view (shards list, index list, overview table), the system should indicate whether it is a primary or replica shard using a consistent visual indicator.
**Validates: Requirements 11.1, 11.2, 11.3, 11.4, 11.5**

Property 7: Consistent Table Row Styling
*For any* table row in the overview table, including the unassigned shards row, the background color should follow the standard table styling (no special coloring), with state indication provided by badges within cells.
**Validates: Requirements 12.1, 12.2, 12.3, 12.4**

Property 8: Special Indices Filter Behavior
*For any* list of indices, when the "Show special indices" checkbox is unchecked, the displayed indices should exclude all indices whose names start with ".", and when checked, all indices should be displayed including those starting with ".".
**Validates: Requirements 13.1, 13.2, 13.3, 13.6, 13.7**

Property 9: Statistics Display Consistency
*For any* statistics display (overview cards, shard stats cards), the visual style, layout, and component structure should be consistent, using the same Card component, typography, and spacing patterns.
**Validates: Requirements 14.2, 14.3, 14.5**

Property 10: Loading State Indication
*For any* async data loading operation in the application, when data is loading, the system should display a loading skeleton using Mantine Skeleton component, and when loading completes, the skeleton should be replaced with actual data.
**Validates: Requirements 15.1, 15.2, 15.4**

Property 11: API URL Format Correctness
*For any* API request made by the frontend (excluding Console feature custom calls), the URL should be properly formatted with single slashes between path segments (no double slashes like `//`).
**Validates: Requirements 17.1, 17.5**

## Error Handling

### Theme System Errors

**Issue**: Component uses hardcoded colors instead of theme system
**Detection**: Visual inspection in both light and dark themes
**Resolution**: Replace hardcoded colors with Mantine theme colors

```typescript
// Incorrect
<div style={{ backgroundColor: 'black' }}>

// Correct
<div style={{ backgroundColor: theme.colors.dark[6] }}>
```

### Modal State Synchronization Errors

**Issue**: Modal state and URL params get out of sync
**Detection**: Modal opens but URL doesn't update, or vice versa
**Resolution**: Use useEffect to synchronize modal state with URL params

```typescript
useEffect(() => {
  const modalId = searchParams.get('node');
  setModalOpen(!!modalId);
  setSelectedNodeId(modalId);
}, [searchParams]);
```

### Missing Shard Data Errors

**Issue**: Shard data from API is incomplete
**Detection**: N/A or undefined values in shard list
**Resolution**: Provide default values and enhance API response

```typescript
const shardData: ShardInfo = {
  ...apiResponse,
  docs: apiResponse.docs ?? 0,
  storeSize: apiResponse.storeSize ?? 0,
};
```

### Responsive Layout Errors

**Issue**: Page size doesn't adapt to screen size
**Detection**: Too many/few items on different screen sizes
**Resolution**: Use media queries to set appropriate defaults

```typescript
const defaultPageSize = useResponsivePageSize();
```

## Testing Strategy

### Unit Tests

Unit tests focus on specific components and their behavior:

1. **Tooltip Theme Compliance**
   - Test that Tooltip components use Mantine's Tooltip (not custom implementations)
   - Verify tooltip props don't include hardcoded colors
   - Mock theme context and verify tooltip styling changes with theme

2. **Responsive Page Size Hook**
   - Test useResponsivePageSize returns correct values for different screen widths
   - Mock window.matchMedia for different breakpoints
   - Verify page size changes when screen size changes

3. **Shard State Filter**
   - Test filter component renders all shard states
   - Test all states are selected by default
   - Test filtering logic correctly filters shards based on selected states

4. **Modal URL Synchronization**
   - Test opening modal updates URL params
   - Test closing modal removes URL params
   - Test navigating to URL with params opens modal
   - Test modal displays correct item based on URL param

5. **Shard Data Display**
   - Test shard list displays numeric values for size and docs
   - Test fallback to 0 when data is unavailable
   - Test formatBytes utility function

6. **Shard Type Indicator**
   - Test ShardTypeBadge component renders correctly for primary/replica
   - Test badge appears in all views (shards list, index list, overview table)
   - Test consistent styling across views

7. **Unified Index Menu**
   - Test single menu contains all operations
   - Test menu items trigger correct actions
   - Test menu grouping with separators

8. **Tab Restructuring**
   - Test Overview tab contains only statistics cards
   - Test Topology tab contains overview table
   - Test tab order is correct

### Property-Based Tests

Property-based tests verify universal properties across many generated inputs:

1. **Property Test: Modal URL Round Trip**
   - Generate random modal states (node IDs, index names)
   - Open modal and verify URL contains identifier
   - Navigate to URL and verify modal opens with correct item
   - Close modal and verify URL is cleaned up
   - **Tag**: Feature: ui-ux-improvements, Property 1: Modal URL Round Trip

2. **Property Test: Theme-Aware Tooltips**
   - Generate random theme settings (light, dark, system)
   - Render components with tooltips in each theme
   - Verify tooltips use theme colors (not hardcoded)
   - Verify tooltip background/text colors match theme
   - **Tag**: Feature: ui-ux-improvements, Property 2: Theme-Aware Tooltip Styling

3. **Property Test: Consistent State Colors**
   - Generate random state values (health: green/yellow/red, shard: STARTED/UNASSIGNED/etc.)
   - Render state in multiple components
   - Verify same state always produces same color
   - **Tag**: Feature: ui-ux-improvements, Property 3: Consistent State Color Coding

4. **Property Test: Shard State Filtering**
   - Generate random shard data with various states
   - Generate random filter selections
   - Apply filter and verify only selected states are shown
   - Change filter and verify display updates correctly
   - **Tag**: Feature: ui-ux-improvements, Property 4: Shard State Filter Behavior

5. **Property Test: Complete Shard Data**
   - Generate random shard data (including incomplete data)
   - Render shards in list
   - Verify all shards show numeric values (never N/A)
   - Verify minimum value is 0 for missing data
   - **Tag**: Feature: ui-ux-improvements, Property 5: Complete Shard Data Display

6. **Property Test: Shard Type Indication**
   - Generate random unassigned shards (primary and replica)
   - Render in all views (shards list, index list, overview table)
   - Verify type indicator appears in all views
   - Verify indicator is consistent across views
   - **Tag**: Feature: ui-ux-improvements, Property 6: Shard Type Indication Consistency

7. **Property Test: Table Row Styling**
   - Generate random table data including unassigned shards
   - Render overview table
   - Verify all rows have consistent background
   - Verify no special styling on unassigned row
   - Verify state indicated by badges, not row background
   - **Tag**: Feature: ui-ux-improvements, Property 7: Consistent Table Row Styling

8. **Property Test: Special Indices Filter**
   - Generate random index data including special indices (starting with ".")
   - Render index list with filter unchecked
   - Verify special indices are hidden
   - Check filter checkbox
   - Verify all indices including special ones are shown
   - **Tag**: Feature: ui-ux-improvements, Property 8: Special Indices Filter Behavior

9. **Property Test: Statistics Display Consistency**
   - Generate random statistics data
   - Render overview statistics cards and shard statistics cards
   - Verify both use same Card component structure
   - Verify consistent typography and spacing
   - Verify consistent layout patterns
   - **Tag**: Feature: ui-ux-improvements, Property 9: Statistics Display Consistency

10. **Property Test: Loading State Indication**
    - Generate random loading states for different views
    - Render components in loading state
    - Verify Mantine Skeleton component is displayed
    - Complete loading
    - Verify skeleton is replaced with actual data
    - **Tag**: Feature: ui-ux-improvements, Property 10: Loading State Indication

11. **Property Test: API URL Format**
    - Generate random API endpoint paths
    - Make API requests through client
    - Intercept and verify URL format
    - Verify no double slashes in any URL
    - Verify proper path concatenation
    - **Tag**: Feature: ui-ux-improvements, Property 11: API URL Format Correctness

### Integration Tests

Integration tests verify components work together correctly:

1. **Node Modal Integration**
   - Test clicking node name in overview table opens modal
   - Test modal displays over correct context (topology tab)
   - Test URL updates when modal opens
   - Test modal closes and URL cleans up
   - Test direct navigation to URL with node param

2. **Tab Navigation Integration**
   - Test navigating between tabs preserves filters
   - Test Overview tab shows only stats
   - Test Topology tab shows overview table
   - Test tab order is correct

3. **Theme Switching Integration**
   - Test switching theme updates all tooltips
   - Test switching theme updates all color-coded elements
   - Test theme persists across page reloads

4. **Responsive Behavior Integration**
   - Test page size adapts to screen size changes
   - Test table columns adapt to screen size
   - Test mobile/tablet/desktop layouts

### Manual Testing Checklist

Manual testing verifies visual consistency and user experience:

1. **Branding Tooltip**
   - [ ] Hover over "secan" title shows tooltip
   - [ ] Tooltip contains meaningful text
   - [ ] Tooltip follows current theme
   - [ ] Tooltip appears/disappears smoothly

2. **Theme Compliance**
   - [ ] Switch to light theme, verify all tooltips are light
   - [ ] Switch to dark theme, verify all tooltips are dark
   - [ ] Check Statistics tab tooltips specifically
   - [ ] Verify no black backgrounds in light theme

3. **Responsive Pagination**
   - [ ] Resize to mobile (<768px), verify 5 items per page default
   - [ ] Resize to tablet (768-1200px), verify 7 items per page default
   - [ ] Resize to desktop (≥1200px), verify 10 items per page default
   - [ ] Verify no horizontal scrolling in overview table

4. **Shard State Filter**
   - [ ] Verify filter shows all shard states
   - [ ] Verify all states selected by default
   - [ ] Deselect a state, verify shards with that state are hidden
   - [ ] Re-select state, verify shards reappear

5. **Tab Restructuring**
   - [ ] Verify tab order: Overview → Topology → Statistics → ...
   - [ ] Verify Overview tab shows only statistics cards
   - [ ] Verify Topology tab shows overview table with filters
   - [ ] Verify all functionality works in Topology tab

6. **Node Navigation**
   - [ ] Click node name in overview table
   - [ ] Verify node modal opens
   - [ ] Verify URL includes node ID
   - [ ] Copy URL and open in new tab, verify modal opens
   - [ ] Close modal, verify URL cleans up

7. **Node Modal Pattern**
   - [ ] Open node modal from topology tab, verify modal over topology
   - [ ] Open node modal from nodes list, verify modal over nodes list
   - [ ] Open node modal from shards list, verify modal over shards list
   - [ ] Verify no "back to nodes list" button
   - [ ] Verify modal is directly linkable

8. **Shards List Data**
   - [ ] Verify all shards show actual size (not N/A)
   - [ ] Verify all shards show actual document count (not N/A)
   - [ ] Verify missing data shows 0, not N/A

9. **Unified Index Menu**
   - [ ] Verify only one action menu per index
   - [ ] Verify menu contains all operations (Settings, Mappings, Open/Close, Refresh, Delete)
   - [ ] Verify logical grouping with separators
   - [ ] Verify all actions work correctly

10. **Unassigned Shard Type**
    - [ ] Verify unassigned shards in shards list show type (P/R)
    - [ ] Verify unassigned shards in index list show type
    - [ ] Verify unassigned shards in overview table show type
    - [ ] Verify consistent indicator across all views

11. **Overview Table Styling**
    - [ ] Verify unassigned shards row has same background as other rows
    - [ ] Verify no special coloring on unassigned row
    - [ ] Verify shard state indicated by badges
    - [ ] Switch theme, verify consistent row backgrounds

12. **Special Indices Filter**
    - [ ] Verify index list hides indices starting with "." by default
    - [ ] Verify shards list hides shards from indices starting with "." by default
    - [ ] Verify overview table hides indices starting with "." by default
    - [ ] Check "Show special indices" checkbox in index list
    - [ ] Verify special indices appear in index list
    - [ ] Check "Show special indices" checkbox in shards list
    - [ ] Verify shards from special indices appear
    - [ ] Check "Show special indices" checkbox in overview table
    - [ ] Verify special indices appear in overview table
    - [ ] Verify checkbox label is clear and descriptive
    - [ ] Verify consistency across all three views

13. **Compact Shard Statistics**
    - [ ] Verify shards list shows compact statistics cards
    - [ ] Verify cards match style of overview statistics cards
    - [ ] Verify all statistics are displayed (Total, Primary, Replica, Unassigned, Relocating, Initializing)
    - [ ] Verify layout is consistent with overview cards
    - [ ] Verify no large statistics box above shards list

14. **Dashboard Loading Skeleton**
    - [ ] Navigate to main dashboard
    - [ ] Verify loading skeleton appears while clusters load
    - [ ] Verify skeleton uses Mantine Skeleton component
    - [ ] Verify skeleton matches clusters list layout
    - [ ] Verify skeleton is replaced with actual data when loading completes
    - [ ] Test on slow network connection

15. **Backend Logging Levels**
    - [ ] Enable DEBUG logging level in backend
    - [ ] Verify "returning... clusters" log appears at DEBUG level
    - [ ] Verify "found shard stats" log appears at DEBUG level
    - [ ] Verify "request completed" log appears at DEBUG level
    - [ ] Verify ERROR and WARNING logs still appear at appropriate levels
    - [ ] Verify INFO level logs are cleaner and more focused

16. **API URL Format**
    - [ ] Open browser developer tools network tab
    - [ ] Navigate through application and trigger various API calls
    - [ ] Verify no URLs contain double slashes (e.g., `/api/clusters//stats`)
    - [ ] Verify all API URLs are properly formatted
    - [ ] Test clusters, nodes, indices, shards, and stats endpoints
    - [ ] Verify Console feature custom calls still work correctly

### Test Configuration

**Property-Based Test Configuration**:
- Minimum 100 iterations per property test
- Use fast-check library for TypeScript
- Generate realistic test data (valid node IDs, index names, shard states)
- Test edge cases (empty data, missing fields, extreme values)

**Unit Test Configuration**:
- Use Vitest for test runner
- Use React Testing Library for component tests
- Mock API calls with MSW (Mock Service Worker)
- Mock theme context for theme-dependent tests
- Mock media queries for responsive tests

**Integration Test Configuration**:
- Use Playwright for end-to-end tests
- Test in multiple browsers (Chrome, Firefox, Safari)
- Test on multiple screen sizes (mobile, tablet, desktop)
- Test theme switching
- Test URL navigation

## Implementation Notes

### Migration Strategy

1. **Phase 1: Foundation** (Low Risk)
   - Add branding tooltip
   - Fix theme compliance issues
   - Add responsive page size hook
   - Add shard state filter

2. **Phase 2: Restructuring** (Medium Risk)
   - Restructure tabs (Overview/Topology split)
   - Add node navigation links
   - Consolidate index menus

3. **Phase 3: Modal Pattern** (Higher Risk)
   - Convert NodeDetail page to modal
   - Implement URL synchronization
   - Test all navigation contexts

4. **Phase 4: Data Fixes** (Low Risk)
   - Fix shards list data display
   - Add shard type indicators
   - Remove special row styling

### Backward Compatibility

- Existing URLs to `/cluster/{id}/nodes/{nodeId}` should redirect to `/cluster/{id}?tab=nodes&node={nodeId}`
- Existing bookmarks and links should continue to work
- No breaking changes to API contracts

### Performance Considerations

- Modal components should lazy-load to reduce initial bundle size
- Use React.memo for expensive components
- Debounce filter inputs to avoid excessive re-renders
- Use virtual scrolling for large tables (already implemented)

### Accessibility Considerations

- All modals must be keyboard accessible (Esc to close, Tab navigation)
- All links must be keyboard accessible (Tab to focus, Enter to activate)
- All tooltips must not interfere with keyboard navigation
- All color coding must be supplemented with text/icons (not color alone)
- All tables must have proper ARIA labels
- All filters must have proper labels and descriptions

### Browser Compatibility

- Support modern browsers (Chrome, Firefox, Safari, Edge)
- Use Mantine's built-in browser compatibility
- Test responsive behavior on mobile browsers
- Test theme switching on all browsers

### Documentation Updates

- Update user documentation with new tab structure
- Document modal navigation pattern
- Update screenshots to reflect new UI
- Document keyboard shortcuts for modals
