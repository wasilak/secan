# Design Document: Topology Notifications and UI Improvements

## Overview

This design addresses UI/UX improvements and bugfixes for the Cerebro Elasticsearch admin tool's topology visualization, notifications system, and cluster status display. The improvements focus on real-time feedback, visual consistency, and enhanced information display across topology views.

### Goals

- Implement real-time toast notifications for cluster topology changes
- Add cluster allocation lock status indicator for immediate visibility
- Fix relocating shard visibility in topology views
- Repair broken shard state filtering functionality
- Standardize shard color differentiation across all views
- Enhance dot view with additional node metrics
- Ensure visual consistency in node details modal
- Improve side drawer cluster name distinction
- Implement deterministic shard ordering

### Non-Goals

- Backend API changes for cluster management
- New topology visualization modes beyond existing index and dot views
- Performance optimization of large cluster rendering (already addressed)
- Authentication or authorization changes

## Architecture

### Component Structure


```
frontend/src/
├── components/
│   ├── Topology/
│   │   ├── DotBasedTopologyView.tsx          # Main dot view component
│   │   ├── NodeCard.tsx                       # Individual node card in dot view
│   │   ├── ShardDot.tsx                       # Shard visualization in dot view
│   │   └── AllocationLockIndicator.tsx        # NEW: Allocation lock status icon
│   ├── IndexVisualization.tsx                 # Index view component
│   ├── ShardCell.tsx                          # Shard cell component
│   ├── ShardStateFilter.tsx                   # Shard state filter controls
│   ├── NodeModal.tsx                          # Node details modal
│   ├── IndexModal.tsx                         # Index details modal (UPDATED)
│   ├── ShardModal.tsx                         # Shard details modal (UPDATED)
│   ├── ShardContextMenu.tsx                   # NEW: Shard context menu
│   └── AppShell.tsx                           # Side drawer with cluster navigation
├── hooks/
│   ├── useClusterChanges.ts                   # NEW: Detect cluster topology changes
│   ├── useModalStack.ts                       # NEW: Modal stack management
│   └── useTopologyFilters.ts                  # Topology filter state management
├── utils/
│   ├── topologyColors.ts                      # Color assignment utilities
│   ├── colors.ts                              # Shard state color mapping
│   ├── shardOrdering.ts                       # NEW: Deterministic shard ordering
│   └── clusterDiff.ts                         # NEW: Cluster state comparison
└── contexts/
    └── RefreshContext.tsx                     # Global refresh timer
```

### Data Flow

1. **Refresh Timer** → Triggers periodic cluster state fetches via TanStack Query
2. **Cluster State Changes** → Detected by `useClusterChanges` hook
3. **Change Detection** → Triggers toast notifications via Mantine notifications
4. **Topology Views** → Consume cluster state and apply filters/ordering
5. **User Interactions** → Update filter state in URL params and local state



## Components and Interfaces

### 1. Toast Notification System

#### useClusterChanges Hook

```typescript
interface ClusterState {
  nodes: NodeInfo[];
  indices: IndexInfo[];
  timestamp: number;
}

interface ClusterChanges {
  nodesAdded: NodeInfo[];
  nodesRemoved: NodeInfo[];
  indicesCreated: IndexInfo[];
  indicesDeleted: IndexInfo[];
}

function useClusterChanges(
  clusterId: string,
  currentState: ClusterState | undefined
): ClusterChanges | null
```

**Responsibilities:**
- Compare previous and current cluster states
- Identify nodes added/removed
- Identify indices created/deleted
- Return structured change information

**Implementation Notes:**
- Uses `useRef` to store previous state
- Compares node IDs and index names
- Triggers on every cluster state update from TanStack Query



#### Notification Trigger Component

```typescript
function ClusterChangeNotifier({ 
  clusterId: string,
  changes: ClusterChanges | null 
}): null
```

**Responsibilities:**
- Consume changes from `useClusterChanges`
- Trigger Mantine toast notifications for each change
- Configure notification appearance and timeout

**Notification Configuration:**
- Auto-dismiss after 5 seconds
- Position: top-right
- Color coding: blue for additions, orange for removals
- Non-blocking overlay

### 2. Allocation Lock Indicator

#### AllocationLockIndicator Component

```typescript
interface AllocationLockIndicatorProps {
  allocationState: 'all' | 'primaries' | 'new_primaries' | 'none';
  clusterName: string;
  clusterVersion: string;
}

function AllocationLockIndicator(
  props: AllocationLockIndicatorProps
): JSX.Element
```

**Responsibilities:**
- Display appropriate lock icon based on allocation state
- Show tooltip with allocation status explanation
- Position at far right of cluster header

**Icon Mapping:**
- `all`: Unlocked padlock (IconLockOpen)
- `primaries`: Partially locked (IconLockHalf)
- `new_primaries`: Lock with key (IconLockAccess)
- `none`: Fully locked (IconLock)



### 3. Relocating Shard Visualization

#### Color Mapping Updates

Update `utils/colors.ts`:

```typescript
export function getShardBorderColor(state: ShardInfo['state']): string {
  switch (state) {
    case 'STARTED':
      return 'var(--mantine-color-green-6)';
    case 'INITIALIZING':
      return 'var(--mantine-color-blue-4)';  // Light blue
    case 'RELOCATING':
      return 'var(--mantine-color-orange-6)'; // Yellow-orange
    case 'UNASSIGNED':
      return 'var(--mantine-color-red-6)';
    default:
      return 'var(--mantine-color-gray-6)';
  }
}

export function getUnassignedShardColor(isPrimary: boolean): string {
  return isPrimary 
    ? 'var(--mantine-color-red-6)'      // Bright red
    : 'var(--mantine-color-red-4)';     // Dimmed red
}
```

#### Relocating Shard Display in Dot View

Update `ShardDot.tsx`:

```typescript
interface ShardDotProps {
  shard: ShardInfo;
  isSource?: boolean;      // Is this the source node?
  isDestination?: boolean; // Is this the destination node?
}
```

**Visual Treatment:**
- Source node: Yellow square (solid border)
- Destination node: Yellow square with dotted border
- Hover: Show curved line connecting source to destination (SVG overlay)



### 4. Shard State Filtering

#### Filter Logic Fix

Update `DotBasedTopologyView.tsx` and `IndexVisualization.tsx`:

```typescript
const filteredShards = useMemo(() => {
  return allShards.filter((shard) => {
    // RELOCATING shards should always be visible
    if (shard.state === 'RELOCATING') {
      return true;
    }
    
    // Apply state filter for other shards
    if (!selectedShardStates.includes(shard.state)) {
      return false;
    }
    
    // Apply index filter
    if (!filteredIndicesList.find((i) => i.name === shard.index)) {
      return false;
    }
    
    return true;
  });
}, [allShards, selectedShardStates, filteredIndicesList]);
```

**Key Changes:**
- Relocating shards bypass the "started" filter
- Filter state persisted in URL params
- Filter applies consistently across both views

### 5. Enhanced Dot View Metrics

#### NodeCard Component Updates

Add to `NodeCard.tsx`:

```typescript
interface NodeCardProps {
  node: NodeInfo;
  shards: ShardInfo[];
  onNodeClick?: (nodeId: string) => void;
}

interface NodeInfo {
  id: string;
  name: string;
  ip: string;              // NEW
  roles: string[];
  isMaster: boolean;
  heapUsed?: number;
  heapMax?: number;
  diskUsed?: number;
  diskTotal?: number;
  cpuPercent?: number;     // NEW
  loadAverage?: number[];  // NEW: [1m, 5m, 15m]
  version?: string;        // NEW: Elasticsearch version
}
```



**Display Layout:**

```
┌─────────────────────────────┐
│ node-name-01    192.168.1.5 │ ← Name (bold) + IP (dimmed)
│ [Master] [data] [ingest]    │ ← Roles
├─────────────────────────────┤
│ CPU: 45% | Load: 2.3        │ ← NEW: Color-coded metrics
│ Heap: 8.5GB | Disk: 450GB   │ ← Existing metrics
│ Version: 8.11.0             │ ← NEW: ES version
├─────────────────────────────┤
│ [Shard visualization]       │
│ 24 shards (12 primary)      │
└─────────────────────────────┘
```

**Color Coding:**
- CPU: Green (<70%), Yellow (70-85%), Red (>85%)
- Load: Green (<cores), Yellow (cores to 1.5x), Red (>1.5x cores)

### 6. Shard Ordering

#### shardOrdering.ts Utility

```typescript
export function sortShards(shards: ShardInfo[]): ShardInfo[] {
  return [...shards].sort((a, b) => {
    // 1. Sort by index name (alphabetical)
    const indexCompare = a.index.localeCompare(b.index);
    if (indexCompare !== 0) return indexCompare;
    
    // 2. Sort by shard number (numerical)
    const shardCompare = a.shard - b.shard;
    if (shardCompare !== 0) return shardCompare;
    
    // 3. Primary before replica
    if (a.primary && !b.primary) return -1;
    if (!a.primary && b.primary) return 1;
    
    // 4. Sort by state (STARTED, RELOCATING, INITIALIZING, UNASSIGNED)
    const stateOrder = { STARTED: 0, RELOCATING: 1, INITIALIZING: 2, UNASSIGNED: 3 };
    return stateOrder[a.state] - stateOrder[b.state];
  });
}
```

**Application:**
- Apply to all shard lists before rendering
- Use in both Index View and Dot Vi
ew
- Memoize sorted results to prevent unnecessary re-sorting

### 7. Side Drawer Styling

#### AppShell Component Updates

Update cluster name styling in `AppShell.tsx`:

```typescript
// Cluster name styling
const clusterNameStyles = {
  fontSize: '16px',
  fontWeight: 700,
  color: 'var(--mantine-color-blue-6)',
  marginBottom: '4px',
};

// Submenu item styling
const submenuItemStyles = {
  fontSize: '14px',
  fontWeight: 400,
  color: 'var(--mantine-color-gray-7)',
};
```

**Visual Hierarchy:**
- Cluster names: Larger, bold, colored
- Submenu items: Smaller, normal weight, dimmed
- Consistent spacing and indentation

### 8. Node Role Filter Initialization

#### NodeRoleFilter Component Updates

Update node role filter component to initialize with all roles enabled:

```typescript
interface NodeRoleFilterProps {
  availableRoles: string[];
  selectedRoles: string[];
  onRoleToggle: (role: string) => void;
}

function NodeRoleFilter({ 
  availableRoles, 
  selectedRoles, 
  onRoleToggle 
}: NodeRoleFilterProps): JSX.Element {
  // Initialize with all roles enabled by default
  const [enabledRoles, setEnabledRoles] = useState<string[]>(() => {
    // If selectedRoles is empty on first load, enable all roles
    return selectedRoles.length === 0 ? availableRoles : selectedRoles;
  });
  
  return (
    <Stack>
      {availableRoles.map(role => (
        <Checkbox
          key={role}
          label={role}
          checked={enabledRoles.includes(role)}
          onChange={() => onRoleToggle(role)}
        />
      ))}
    </Stack>
  );
}
```

**Responsibilities:**
- Initialize all role filters to enabled/checked state on first load
- Show all nodes when all filters are enabled (default state)
- Hide nodes with specific roles when those role filters are unchecked
- Maintain visual consistency between filter state and displayed nodes

**Implementation Notes:**
- Check if selectedRoles is empty on component mount
- If empty, initialize with all available roles enabled
- Persist filter state in URL params or local state
- Ensure filter state matches actual filtering behavior

### 9. Shard Context Menu and Layered Modal Navigation

#### Context Menu Updates

Update `ShardDot.tsx` and related components:

```typescript
interface ShardContextMenuProps {
  shard: ShardInfo;
  onDisplayShardDetails: () => void;
  onDisplayIndexDetails: () => void;
}

function ShardContextMenu({ 
  shard, 
  onDisplayShardDetails, 
  onDisplayIndexDetails 
}: ShardContextMenuProps): JSX.Element {
  const menuTitle = `${shard.index} / Shard ${shard.shard} (${shard.primary ? 'Primary' : 'Replica'})`;
  
  return (
    <Menu>
      <Menu.Label>{menuTitle}</Menu.Label>
      <Menu.Item onClick={onDisplayShardDetails}>
        Display shard details
      </Menu.Item>
      <Menu.Item onClick={onDisplayIndexDetails}>
        Display index details
      </Menu.Item>
    </Menu>
  );
}
```

**Responsibilities:**
- Display context menu with formatted title showing index name, shard number, and type
- Provide "Display shard details" menu item (fixes bug where it opened index modal)
- Provide "Display index details" menu item (new feature)
- Trigger appropriate modal based on selection

#### Layered Modal System

Implement modal stack management:

```typescript
interface ModalStackState {
  modals: ModalConfig[];
}

interface ModalConfig {
  id: string;
  type: 'index' | 'shard' | 'node';
  data: IndexInfo | ShardInfo | NodeInfo;
  sourceView?: string; // Track where modal was opened from
}

function useModalStack() {
  const [modalStack, setModalStack] = useState<ModalConfig[]>([]);
  
  const pushModal = (modal: ModalConfig) => {
    setModalStack(prev => [...prev, modal]);
  };
  
  const popModal = () => {
    setModalStack(prev => prev.slice(0, -1));
  };
  
  const clearModals = () => {
    setModalStack([]);
  };
  
  const topModal = modalStack[modalStack.length - 1];
  
  return { modalStack, topModal, pushModal, popModal, clearModals };
}
```

**Modal Stack Behavior:**
- Stack maintains order of opened modals
- Top modal is the currently visible/active modal
- Closing removes only the top modal from stack
- ESC or click-outside closes only top modal
- When stack is empty, no modals are shown

#### Index Modal with Layered Support

Update `IndexModal.tsx`:

```typescript
interface IndexModalProps {
  index: IndexInfo;
  isOpen: boolean;
  onClose: () => void;
  onShardClick?: (shard: ShardInfo) => void; // NEW: Handle shard clicks
  hasModalAbove?: boolean; // NEW: Indicates if another modal is layered on top
}

function IndexModal({ 
  index, 
  isOpen, 
  onClose, 
  onShardClick,
  hasModalAbove = false 
}: IndexModalProps): JSX.Element {
  const handleShardClick = (shard: ShardInfo) => {
    // Only open shard modal for assigned shards
    if (shard.node && onShardClick) {
      onShardClick(shard);
    }
  };
  
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      closeOnClickOutside={!hasModalAbove} // Don't close if modal above
      closeOnEscape={!hasModalAbove}       // Don't close if modal above
      size="xl"
    >
      <Tabs defaultValue="overview">
        <Tabs.Panel value="visualization">
          <ShardVisualization 
            shards={index.shards}
            onShardClick={handleShardClick}
          />
        </Tabs.Panel>
        {/* Other tabs */}
      </Tabs>
    </Modal>
  );
}
```

**Key Features:**
- `onShardClick` callback for opening shard details modal
- `hasModalAbove` prop disables close-on-escape/click-outside when layered
- Only assigned shards trigger layered modal (unassigned shards ignored)
- Works regardless of which view opened the index modal

#### Shard Modal Component

Update `ShardModal.tsx`:

```typescript
interface ShardModalProps {
  shard: ShardInfo;
  isOpen: boolean;
  onClose: () => void;
  isLayered?: boolean; // NEW: Indicates this is layered on top of another modal
}

function ShardModal({ 
  shard, 
  isOpen, 
  onClose,
  isLayered = false 
}: ShardModalProps): JSX.Element {
  return (
    <Modal
      opened={isOpen}
      onClose={onClose}
      closeOnClickOutside={true}  // Always closeable
      closeOnEscape={true}         // Always closeable
      size="lg"
      zIndex={isLayered ? 300 : 200} // Higher z-index when layered
    >
      <Stack>
        <Title order={3}>
          {shard.index} / Shard {shard.shard} ({shard.primary ? 'Primary' : 'Replica'})
        </Title>
        {/* Shard details content */}
      </Stack>
    </Modal>
  );
}
```

**Key Features:**
- Always closeable with ESC or click-outside
- Higher z-index when layered on top of another modal
- Closing doesn't affect underlying modal

#### Integration with Topology Views

Update topology view components to use modal stack:

```typescript
function TopologyView(): JSX.Element {
  const { modalStack, topModal, pushModal, popModal, clearModals } = useModalStack();
  
  const handleShardContextMenu = (shard: ShardInfo) => {
    // Show context menu with both options
    showContextMenu({
      items: [
        {
          label: 'Display shard details',
          onClick: () => pushModal({ 
            id: `shard-${shard.index}-${shard.shard}`,
            type: 'shard', 
            data: shard 
          })
        },
        {
          label: 'Display index details',
          onClick: () => pushModal({ 
            id: `index-${shard.index}`,
            type: 'index', 
            data: getIndexInfo(shard.index) 
          })
        }
      ]
    });
  };
  
  const handleShardClickInIndexModal = (shard: ShardInfo) => {
    // Only for assigned shards
    if (shard.node) {
      pushModal({ 
        id: `shard-${shard.index}-${shard.shard}`,
        type: 'shard', 
        data: shard 
      });
    }
  };
  
  return (
    <>
      <DotBasedTopologyView onShardContextMenu={handleShardContextMenu} />
      
      {/* Render modals from stack */}
      {modalStack.map((modal, index) => {
        const isTopModal = index === modalStack.length - 1;
        const hasModalAbove = !isTopModal;
        
        if (modal.type === 'index') {
          return (
            <IndexModal
              key={modal.id}
              index={modal.data as IndexInfo}
              isOpen={true}
              onClose={isTopModal ? popModal : undefined}
              onShardClick={handleShardClickInIndexModal}
              hasModalAbove={hasModalAbove}
            />
          );
        } else if (modal.type === 'shard') {
          return (
            <ShardModal
              key={modal.id}
              shard={modal.data as ShardInfo}
              isOpen={true}
              onClose={popModal}
              isLayered={modalStack.length > 1}
            />
          );
        }
        return null;
      })}
    </>
  );
}
```

**Integration Points:**
- Context menu on shard right-click provides both options
- Index modal can trigger shard modal for assigned shards
- Modal stack manages layering and close behavior
- Works from any view (dot view, index view, etc.)

## Data Models

### ClusterState Interface

```typescript
interface ClusterState {
  clusterId: string;
  clusterName: string;
  clusterVersion: string;
  allocationState: 'all' | 'primaries' | 'new_primaries' | 'none';
  nodes: NodeInfo[];
  indices: IndexInfo[];
  shards: ShardInfo[];
  timestamp: number;
}
```

### ShardInfo Extensions

```typescript
interface ShardInfo {
  index: string;
  shard: number;
  primary: boolean;
  state: 'STARTED' | 'INITIALIZING' | 'RELOCATING' | 'UNASSIGNED';
  node: string | null;
  relocatingNode?: string;  // Destination node for RELOCATING shards
  docs: number;
  store: number;
}
```



### NodeInfo Extensions

```typescript
interface NodeInfo {
  id: string;
  name: string;
  ip: string;
  roles: string[];
  isMaster: boolean;
  heapUsed?: number;
  heapMax?: number;
  diskUsed?: number;
  diskTotal?: number;
  cpuPercent?: number;
  loadAverage?: number[];
  version?: string;
  tags?: string[];  // For grouping
}
```

### Modal Stack Types

```typescript
interface ModalConfig {
  id: string;
  type: 'index' | 'shard' | 'node';
  data: IndexInfo | ShardInfo | NodeInfo;
  sourceView?: string;
}

interface ModalStackState {
  modals: ModalConfig[];
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cluster Change Detection

*For any* two consecutive cluster states, the change detection algorithm should correctly identify all nodes added, nodes removed, indices created, and indices deleted by comparing node IDs and index names.

**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Notification Auto-Dismiss

*For any* toast notification created by the cluster change notifier, the notification should have an autoClose property set to a positive timeout value (5000ms).

**Validates: Requirements 1.5**

### Property 3: Allocation State Icon Mapping

*For any* cluster allocation state value ('all', 'primaries', 'new_primaries', 'none'), the allocation lock indicator should display a unique icon that is visually distinct from icons for other states.

**Validates: Requirements 2.3, 2.4, 2.5, 2.6**



### Property 4: Relocating Shard Visibility

*For any* cluster state containing relocating shards, those shards should appear in the filtered shard list regardless of other filter settings, and should be displayed with yellow-orange color (orange-6) that is visually distinct from initializing shards (blue-4).

**Validates: Requirements 3.1, 3.2, 3.6**

### Property 5: Relocating Shard Visual Indicators

*For any* relocating shard in dot view, the source node should display a yellow square with solid border, and the destination node should display a yellow square with dotted border style.

**Validates: Requirements 3.3, 3.4**

### Property 6: Shard State Filter Behavior

*For any* combination of selected shard states, the topology view should display only shards whose state matches one of the selected states, with the exception that relocating shards are always visible.

**Validates: Requirements 4.1, 4.3, 4.4**

### Property 7: Filter State Persistence

*For any* filter configuration applied during a session, navigating within the topology view and returning should restore the same filter state from URL parameters.

**Validates: Requirements 4.5**

### Property 8: Shard Color Consistency

*For any* shard state (STARTED, INITIALIZING, RELOCATING, UNASSIGNED), the color used to display that shard should be identical across Index View, Dot View, and Node Details Modal components.

**Validates: Requirements 5.1, 5.2, 5.6, 7.1, 7.2, 7.3, 7.5**

### Property 9: Unassigned Shard Color Differentiation

*For any* unassigned shard, if it is a primary shard it should use bright red color (red-6), and if it is a replica shard it should use dimmed red color (red-4).

**Validates: Requirements 5.3, 5.4, 7.4**



### Property 10: Unassigned Shard Border Style

*For any* unassigned shard displayed in the topology view, the shard should have no visible border or a border-width of 0.

**Validates: Requirements 5.5**

### Property 11: Metric Color Coding

*For any* node with CPU or load average metrics, the displayed value should be color-coded: green when below threshold, yellow when in warning range, and red when above critical threshold.

**Validates: Requirements 6.3, 6.4**

### Property 12: Deterministic Shard Ordering

*For any* list of shards belonging to the same node, applying the sort algorithm should produce the same order when given the same input shards, with ordering based on: index name (alphabetical), shard number (numerical), primary before replica, and state priority (STARTED, RELOCATING, INITIALIZING, UNASSIGNED).

**Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5**

### Property 13: Cluster Name Visual Distinction

*For any* cluster entry in the side drawer, the cluster name should have larger font size and heavier font weight than its submenu items, creating a clear visual hierarchy.

**Validates: Requirements 8.1, 8.2, 8.3**

### Property 14: Shard Context Menu Title Format

*For any* shard, the context menu title should contain the index name, shard number, and shard type (primary or replica) in a formatted string.

**Validates: Requirements 10.4**

### Property 15: Layered Modal Triggering

*For any* assigned shard clicked in an index modal visualization tab, a shard details modal should open on top of the index modal, but for any unassigned shard, no layered modal should open.

**Validates: Requirements 10.5, 10.9, 10.10**

### Property 16: Layered Modal Close Behavior

*For any* modal stack with multiple modals, pressing ESC or clicking outside should close only the top modal and leave underlying modals open, but when only one modal is open, ESC or clicking outside should close that modal.

**Validates: Requirements 10.6, 10.7, 10.8**

### Property 17: Node Role Filter Default State

*For any* nodes list view on initial load, all node role filters should be in the enabled (checked) state, and all nodes should be visible regardless of their roles.

**Validates: Requirements 11.1, 11.2, 11.4**

### Property 18: Node Role Filter Behavior

*For any* node role filter that is unchecked, nodes with that role should be hidden from the nodes list, and for any node role filter that is checked, nodes with that role should be visible in the nodes list.

**Validates: Requirements 11.3, 11.4**

## Error Handling

### Notification System

**Missing Data Handling:**
- If node/index name is undefined, use ID as fallback
- If change detection fails, log error but don't crash
- Gracefully handle notification API failures

**Rate Limiting:**
- Batch multiple changes into single notification if they occur within 1 second
- Prevent notification spam during cluster instability



### Allocation Lock Indicator

**Missing Allocation State:**
- Default to 'none' (fully locked) if state is undefined
- Show warning tooltip if state cannot be determined

### Relocating Shards

**Missing Destination Node:**
- Display relocating shard even if destination is unknown
- Show "Unknown destination" in tooltip
- Log warning for investigation

### Metrics Display

**Missing Node Metrics:**
- Gracefully hide missing metrics (don't show "N/A")
- Display only available metrics
- Don't break layout if metrics are unavailable

### Color Utilities

**Invalid State Values:**
- Fall back to gray color for unknown states
- Log warning for unexpected state values
- Maintain visual consistency

### Modal Stack Management

**Invalid Modal Operations:**
- Prevent pushing duplicate modals (same id already in stack)
- Handle pop on empty stack gracefully (no-op)
- Validate modal data before pushing to stack
- Log warnings for invalid modal configurations

**Missing Modal Data:**
- Gracefully handle missing shard/index/node data
- Display error message in modal if data cannot be loaded
- Provide fallback UI for incomplete data

**Z-Index Conflicts:**
- Ensure layered modals have appropriate z-index values
- Handle edge cases with multiple modal libraries
- Maintain proper stacking order

## Testing Strategy

### Unit Testing

**Test Coverage:**
- Cluster change detection logic (useClusterChanges hook)
- Shard ordering algorithm (sortShards function)
- Color mapping functions (getShardBorderColor, getUnassignedShardColor)
- Filter logic (shard state filtering with relocating exception)
- Allocation state to icon mapping
- Node role filter initialization and behavior

**Example Unit Tests:**

```typescript
describe('sortShards', () => {
  it('should sort by index name first', () => {
    const shards = [
      { index: 'logs-b', shard: 0, primary: true, state: 'STARTED' },
      { index: 'logs-a', shard: 0, primary: true, state: 'STARTED' },
    ];
    const sorted = sortShards(shards);
    expect(sorted[0].index).toBe('logs-a');
  });
  
  it('should place primaries before replicas', () => {
    const shards = [
      { index: 'logs', shard: 0, primary: false, state: 'STARTED' },
      { index: 'logs', shard: 0, primary: true, state: 'STARTED' },
    ];
    const sorted = sortShards(shards);
    expect(sorted[0].primary).toBe(true);
  });
});
```



```typescript
describe('useClusterChanges', () => {
  it('should detect added nodes', () => {
    const previous = { nodes: [{ id: 'node1', name: 'Node 1' }] };
    const current = { 
      nodes: [
        { id: 'node1', name: 'Node 1' },
        { id: 'node2', name: 'Node 2' }
      ] 
    };
    const changes = detectChanges(previous, current);
    expect(changes.nodesAdded).toHaveLength(1);
    expect(changes.nodesAdded[0].id).toBe('node2');
  });
});

describe('getShardBorderColor', () => {
  it('should return distinct colors for each state', () => {
    const colors = {
      STARTED: getShardBorderColor('STARTED'),
      INITIALIZING: getShardBorderColor('INITIALIZING'),
      RELOCATING: getShardBorderColor('RELOCATING'),
      UNASSIGNED: getShardBorderColor('UNASSIGNED'),
    };
    
    const uniqueColors = new Set(Object.values(colors));
    expect(uniqueColors.size).toBe(4);
  });
});

describe('generateShardContextMenuTitle', () => {
  it('should format title with index, shard number, and type', () => {
    const shard = {
      index: 'logs-2024',
      shard: 3,
      primary: true,
      state: 'STARTED',
      node: 'node-1',
    };
    
    const title = generateShardContextMenuTitle(shard);
    expect(title).toBe('logs-2024 / Shard 3 (Primary)');
  });
  
  it('should show Replica for non-primary shards', () => {
    const shard = {
      index: 'logs-2024',
      shard: 3,
      primary: false,
      state: 'STARTED',
      node: 'node-1',
    };
    
    const title = generateShardContextMenuTitle(shard);
    expect(title).toBe('logs-2024 / Shard 3 (Replica)');
  });
});

describe('useModalStack', () => {
  it('should push modal to stack', () => {
    const { result } = renderHook(() => useModalStack());
    
    act(() => {
      result.current.pushModal({
        id: 'index-1',
        type: 'index',
        data: mockIndexInfo,
      });
    });
    
    expect(result.current.modalStack).toHaveLength(1);
    expect(result.current.topModal?.type).toBe('index');
  });
  
  it('should pop only top modal', () => {
    const { result } = renderHook(() => useModalStack());
    
    act(() => {
      result.current.pushModal({ id: 'index-1', type: 'index', data: mockIndexInfo });
      result.current.pushModal({ id: 'shard-1', type: 'shard', data: mockShardInfo });
    });
    
    expect(result.current.modalStack).toHaveLength(2);
    
    act(() => {
      result.current.popModal();
    });
    
    expect(result.current.modalStack).toHaveLength(1);
    expect(result.current.topModal?.type).toBe('index');
  });
  
  it('should handle empty stack', () => {
    const { result } = renderHook(() => useModalStack());
    
    act(() => {
      result.current.popModal(); // Should not crash
    });
    
    expect(result.current.modalStack).toHaveLength(0);
    expect(result.current.topModal).toBeUndefined();
  });
});

describe('NodeRoleFilter', () => {
  it('should initialize with all roles enabled', () => {
    const availableRoles = ['master', 'data', 'ingest'];
    const { result } = renderHook(() => useNodeRoleFilter(availableRoles));
    
    expect(result.current.selectedRoles).toEqual(availableRoles);
    expect(result.current.selectedRoles).toHaveLength(3);
  });
  
  it('should show all nodes when all roles enabled', () => {
    const nodes = [
      { id: 'node1', roles: ['master', 'data'] },
      { id: 'node2', roles: ['data', 'ingest'] },
      { id: 'node3', roles: ['master'] },
    ];
    const selectedRoles = ['master', 'data', 'ingest'];
    
    const filtered = filterNodesByRoles(nodes, selectedRoles);
    expect(filtered).toHaveLength(3);
  });
  
  it('should hide nodes when role filter unchecked', () => {
    const nodes = [
      { id: 'node1', roles: ['master', 'data'] },
      { id: 'node2', roles: ['data', 'ingest'] },
      { id: 'node3', roles: ['ingest'] },
    ];
    const selectedRoles = ['master', 'data']; // ingest unchecked
    
    const filtered = filterNodesByRoles(nodes, selectedRoles);
    expect(filtered).toHaveLength(2);
    expect(filtered.find(n => n.id === 'node3')).toBeUndefined();
  });
});
```

### Property-Based Testing

**Property Test Configuration:**
- Use fast-check library for TypeScript property-based testing
- Run minimum 100 iterations per property test
- Tag each test with feature name and property number

**Property Test Examples:**

```typescript
import fc from 'fast-check';

describe('Property 1: Cluster Change Detection', () => {
  it('should detect all node additions and removals', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({ id: fc.string(), name: fc.string() })),
        fc.array(fc.record({ id: fc.string(), name: fc.string() })),
        (previousNodes, currentNodes) => {
          const changes = detectChanges(
            { nodes: previousNodes, indices: [], timestamp: 0 },
            { nodes: currentNodes, indices: [], timestamp: 1 }
          );
          
          // All nodes in current but not in previous should be in nodesAdded
          const expectedAdded = currentNodes.filter(
            n => !previousNodes.some(p => p.id === n.id)
          );
          expect(changes.nodesAdded).toHaveLength(expectedAdded.length);
          
          // All nodes in previous but not in current should be in nodesRemoved
          const expectedRemoved = previousNodes.filter(
            n => !currentNodes.some(c => c.id === n.id)
          );
          expect(changes.nodesRemoved).toHaveLength(expectedRemoved.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
```



```typescript
describe('Property 6: Shard State Filter Behavior', () => {
  it('should filter shards by selected states except relocating', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          index: fc.string(),
          shard: fc.nat(),
          primary: fc.boolean(),
          state: fc.constantFrom('STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED'),
          node: fc.option(fc.string(), { nil: null }),
        })),
        fc.array(fc.constantFrom('STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED')),
        (shards, selectedStates) => {
          const filtered = filterShardsByState(shards, selectedStates);
          
          // All relocating shards should be included
          const relocatingShards = shards.filter(s => s.state === 'RELOCATING');
          relocatingShards.forEach(shard => {
            expect(filtered).toContainEqual(shard);
          });
          
          // Non-relocating shards should only be included if their state is selected
          const nonRelocatingFiltered = filtered.filter(s => s.state !== 'RELOCATING');
          nonRelocatingFiltered.forEach(shard => {
            expect(selectedStates).toContain(shard.state);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 12: Deterministic Shard Ordering', () => {
  it('should produce consistent order for same input', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          index: fc.string(),
          shard: fc.nat(),
          primary: fc.boolean(),
          state: fc.constantFrom('STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED'),
          node: fc.option(fc.string(), { nil: null }),
        })),
        (shards) => {
          const sorted1 = sortShards(shards);
          const sorted2 = sortShards(shards);
          
          // Same input should produce identical output
          expect(sorted1).toEqual(sorted2);
          
          // Verify ordering rules
          for (let i = 0; i < sorted1.length - 1; i++) {
            const current = sorted1[i];
            const next = sorted1[i + 1];
            
            // If same index, shard number should be ascending
            if (current.index === next.index && current.shard === next.shard) {
              // Primary should come before replica
              if (current.primary && !next.primary) {
                // Correct order
              } else if (!current.primary && next.primary) {
                throw new Error('Primary should come before replica');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tags:**
- Feature: topology-notifications-ui-improvements, Property 1: Cluster change detection
- Feature: topology-notifications-ui-improvements, Property 6: Shard state filter behavior
- Feature: topology-notifications-ui-improvements, Property 12: Deterministic shard ordering

```typescript
describe('Property 14: Shard Context Menu Title Format', () => {
  it('should include index name, shard number, and type in title', () => {
    fc.assert(
      fc.property(
        fc.record({
          index: fc.string({ minLength: 1 }),
          shard: fc.nat(),
          primary: fc.boolean(),
          state: fc.constantFrom('STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED'),
          node: fc.option(fc.string(), { nil: null }),
        }),
        (shard) => {
          const menuTitle = generateShardContextMenuTitle(shard);
          
          // Title should contain index name
          expect(menuTitle).toContain(shard.index);
          
          // Title should contain shard number
          expect(menuTitle).toContain(shard.shard.toString());
          
          // Title should contain type (Primary or Replica)
          const expectedType = shard.primary ? 'Primary' : 'Replica';
          expect(menuTitle).toContain(expectedType);
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 15: Layered Modal Triggering', () => {
  it('should open layered modal for assigned shards only', () => {
    fc.assert(
      fc.property(
        fc.record({
          index: fc.string(),
          shard: fc.nat(),
          primary: fc.boolean(),
          state: fc.constantFrom('STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED'),
          node: fc.option(fc.string(), { nil: null }),
        }),
        (shard) => {
          const shouldOpenLayered = shouldTriggerLayeredModal(shard);
          
          // Assigned shards (with node) should trigger layered modal
          // Unassigned shards (no node) should not
          if (shard.node !== null) {
            expect(shouldOpenLayered).toBe(true);
          } else {
            expect(shouldOpenLayered).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 16: Layered Modal Close Behavior', () => {
  it('should close only top modal when multiple modals open', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.string(),
          type: fc.constantFrom('index', 'shard', 'node'),
        }), { minLength: 1, maxLength: 5 }),
        (modals) => {
          const stack = createModalStack(modals);
          const initialLength = stack.length;
          
          // Close top modal
          const newStack = closeTopModal(stack);
          
          if (initialLength === 1) {
            // If only one modal, stack should be empty
            expect(newStack.length).toBe(0);
          } else {
            // If multiple modals, only top should be removed
            expect(newStack.length).toBe(initialLength - 1);
            
            // Remaining modals should be unchanged
            for (let i = 0; i < newStack.length; i++) {
              expect(newStack[i]).toEqual(stack[i]);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 17: Node Role Filter Default State', () => {
  it('should initialize all role filters as enabled', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 1 }), { minLength: 1, maxLength: 10 }),
        (availableRoles) => {
          const initialState = initializeNodeRoleFilters(availableRoles);
          
          // All roles should be enabled by default
          expect(initialState.length).toBe(availableRoles.length);
          availableRoles.forEach(role => {
            expect(initialState).toContain(role);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('Property 18: Node Role Filter Behavior', () => {
  it('should show/hide nodes based on role filter state', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.string(),
          roles: fc.array(fc.string(), { minLength: 1 }),
        }), { minLength: 1 }),
        fc.array(fc.string()),
        (nodes, selectedRoles) => {
          const filtered = filterNodesByRoles(nodes, selectedRoles);
          
          // Each filtered node should have at least one role in selectedRoles
          filtered.forEach(node => {
            const hasSelectedRole = node.roles.some(role => 
              selectedRoles.includes(role)
            );
            expect(hasSelectedRole).toBe(true);
          });
          
          // Nodes without any selected roles should not be in filtered list
          const excluded = nodes.filter(n => !filtered.includes(n));
          excluded.forEach(node => {
            const hasSelectedRole = node.roles.some(role => 
              selectedRoles.includes(role)
            );
            expect(hasSelectedRole).toBe(false);
          });
        }
      ),
      { numRuns: 100 }
    );
  });
});
```

**Feature Tags:**
- Feature: topology-notifications-ui-improvements, Property 14: Shard context menu title format
- Feature: topology-notifications-ui-improvements, Property 15: Layered modal triggering
- Feature: topology-notifications-ui-improvements, Property 16: Layered modal close behavior
- Feature: topology-notifications-ui-improvements, Property 17: Node role filter default state
- Feature: topology-notifications-ui-improvements, Property 18: Node role filter behavior



### Component Testing

**React Component Tests:**
- AllocationLockIndicator: Verify correct icon for each state
- NodeCard: Verify all metrics display correctly
- ShardCell: Verify color consistency across states
- ClusterChangeNotifier: Verify notifications triggered for changes
- ShardContextMenu: Verify menu items and title format
- ModalStack: Verify push/pop operations
- IndexModal: Verify shard click handling
- ShardModal: Verify layered z-index
- NodeRoleFilter: Verify default enabled state and filtering behavior

**Integration Tests:**
- Topology view with relocating shards
- Filter state persistence across navigation
- Shard ordering consistency across view switches
- Color consistency across all views
- Context menu opens correct modals
- Layered modal behavior across different views
- Modal stack state management

### Manual Testing Checklist

**Notification System:**
- [ ] Add a node to cluster, verify toast appears with node name
- [ ] Remove a node, verify toast appears with node name
- [ ] Create an index, verify toast appears with index name
- [ ] Delete an index, verify toast appears with index name
- [ ] Verify notifications auto-dismiss after 5 seconds
- [ ] Verify notifications don't block UI interaction

**Allocation Lock Indicator:**
- [ ] Set allocation to 'all', verify unlocked icon
- [ ] Set allocation to 'primaries', verify partially locked icon
- [ ] Set allocation to 'new_primaries', verify lock with key icon
- [ ] Set allocation to 'none', verify fully locked icon
- [ ] Verify icon remains visible during scrolling

**Relocating Shards:**
- [ ] Trigger shard relocation, verify yellow-orange color
- [ ] Verify relocating shards visible when "started" filter unchecked
- [ ] In dot view, verify source node shows yellow square
- [ ] In dot view, verify destination node shows yellow dotted square
- [ ] Hover over relocating shard, verify connection line appears

**Shard Filtering:**
- [ ] Uncheck "started", verify started shards hidden
- [ ] Uncheck "started" with relocating shards, verify relocating still visible
- [ ] Apply multiple filters, verify OR logic works
- [ ] Navigate away and back, verify filters persist

**Color Consistency:**
- [ ] Compare shard colors in index view, dot view, and node modal
- [ ] Verify INITIALIZING uses light blue across all views
- [ ] Verify RELOCATING uses yellow-orange across all views
- [ ] Verify unassigned primaries use bright red
- [ ] Verify unassigned replicas use dimmed red

**Dot View Enhancements:**
- [ ] Verify node IP displays to right of node name
- [ ] Verify IP has reduced visual prominence
- [ ] Verify CPU displays with color coding
- [ ] Verify load average displays with color coding
- [ ] Verify Elasticsearch version displays
- [ ] Verify heap and disk metrics still present

**Shard Ordering:**
- [ ] Refresh topology view multiple times, verify shard order stable
- [ ] Switch between index and dot view, verify order consistent
- [ ] Verify shards sorted by index name, then shard number
- [ ] Verify primaries appear before replicas

**Side Drawer:**
- [ ] Verify cluster names are bold and larger
- [ ] Verify submenu items are smaller and dimmed
- [ ] Verify consistent styling across multiple clusters

**Shard Context Menu and Layered Modals:**
- [ ] Right-click on shard in dot view, verify context menu appears
- [ ] Verify context menu title shows index name, shard number, and type (Primary/Replica)
- [ ] Verify "Display shard details" menu item exists
- [ ] Verify "Display index details" menu item exists
- [ ] Select "Display shard details", verify shard modal opens (not index modal)
- [ ] Select "Display index details", verify index modal opens
- [ ] Open index modal, click on assigned shard in visualization tab
- [ ] Verify shard modal opens on top of index modal
- [ ] With both modals open, press ESC, verify only shard modal closes
- [ ] Verify index modal remains open after closing shard modal
- [ ] With both modals open, click outside, verify only shard modal closes
- [ ] With only index modal open, press ESC, verify index modal closes
- [ ] Open index modal from different views (dot view, index view), verify layered behavior works consistently
- [ ] Click on unassigned shard in index modal, verify no layered modal opens
- [ ] Verify shard modal has higher z-index when layered

**Node Role Filters:**
- [ ] Load nodes list view, verify all role filters are checked/enabled by default
- [ ] With all filters enabled, verify all nodes are visible
- [ ] Uncheck a role filter (e.g., "data"), verify nodes with that role are hidden
- [ ] Uncheck multiple role filters, verify only nodes with remaining enabled roles are shown
- [ ] Re-check a previously unchecked filter, verify nodes with that role reappear
- [ ] Verify filter state matches visual state (checked = nodes shown, unchecked = nodes hidden)

