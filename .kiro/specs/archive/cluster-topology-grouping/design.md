# Design Document: Cluster Topology Grouping

## Overview

This design enhances the existing cluster topology "dot view" to support visual grouping of nodes by attributes (roles, types, or custom labels). The enhancement is implemented as a non-invasive layer on top of the existing topology visualization, reusing all current node rendering and data fetching mechanisms.

### Goals

- Display all node types in the topology view (not just data nodes)
- Enable visual grouping by single attribute (roles, types, or labels)
- Maintain URL-based state for bookmarking and sharing
- Preserve existing component architecture and performance
- Support clusters with up to 100 nodes efficiently

### Non-Goals

- Multi-attribute grouping (e.g., group by role AND type simultaneously)
- Custom grouping expressions or filters
- Hierarchical or nested grouping
- Real-time grouping updates (grouping is applied on render)

## Architecture

### Component Structure

The grouping feature follows a layered architecture:

```
┌─────────────────────────────────────────┐
│   DotBasedTopologyView (Enhanced)       │
│   - URL parameter parsing               │
│   - Grouping state management           │
│   - Group calculation                   │
└─────────────────────────────────────────┘
                  │
                  ├─────────────────────────┐
                  │                         │
         ┌────────▼────────┐       ┌───────▼────────┐
         │  GroupRenderer  │       │  NodeCard      │
         │  (New)          │       │  (Existing)    │
         │  - Group borders│       │  - Node display│
         │  - Group labels │       │  - Shard dots  │
         └─────────────────┘       └────────────────┘
```

### Data Flow

```
URL Parameters → Parse Grouping Config → Calculate Groups → Render Groups → Render Nodes
     ↑                                                                          │
     └──────────────────────── User Selection ─────────────────────────────────┘
```

1. **URL Parsing**: Extract grouping parameters from URL query string
2. **Group Calculation**: Partition nodes into groups based on selected attribute
3. **Group Rendering**: Render visual group containers with borders and labels
4. **Node Rendering**: Render nodes within groups using existing components
5. **State Sync**: Update URL when user changes grouping selection

## Components and Interfaces

### 1. Enhanced DotBasedTopologyView Component

**Location**: `frontend/src/components/Topology/DotBasedTopologyView.tsx`

**New Props**:
```typescript
interface DotBasedTopologyViewProps {
  // ... existing props ...
  groupBy?: GroupingAttribute;  // 'role' | 'type' | 'label' | 'none'
  groupValue?: string;          // Specific value to group by (optional)
}
```

**New State**:
```typescript
interface GroupingState {
  attribute: GroupingAttribute;
  groups: Map<string, NodeInfo[]>;  // group key -> nodes
}
```

**Responsibilities**:
- Parse grouping parameters from URL
- Calculate node groups based on selected attribute
- Manage grouping state
- Coordinate rendering of groups and nodes

### 2. GroupRenderer Component (New)

**Location**: `frontend/src/components/Topology/GroupRenderer.tsx`

**Interface**:
```typescript
interface GroupRendererProps {
  groupKey: string;
  groupLabel: string;
  nodes: NodeInfo[];
  children: React.ReactNode;  // Rendered nodes
}

export function GroupRenderer({
  groupKey,
  groupLabel,
  nodes,
  children
}: GroupRendererProps): JSX.Element
```

**Responsibilities**:
- Render visual group container with border
- Display group label
- Position nodes within group
- Apply group-specific styling

**Styling**:
```typescript
const groupStyles = {
  border: '2px solid var(--mantine-color-gray-4)',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '16px',
  position: 'relative',
};

const labelStyles = {
  position: 'absolute',
  top: '-12px',
  left: '16px',
  backgroundColor: 'var(--mantine-color-body)',
  padding: '0 8px',
  fontWeight: 600,
  fontSize: '14px',
};
```

### 3. GroupingControl Component (New)

**Location**: `frontend/src/components/Topology/GroupingControl.tsx`

**Interface**:
```typescript
interface GroupingControlProps {
  currentGrouping: GroupingAttribute;
  availableLabels: string[];  // Custom labels present in cluster
  onGroupingChange: (attribute: GroupingAttribute) => void;
}

export function GroupingControl({
  currentGrouping,
  availableLabels,
  onGroupingChange
}: GroupingControlProps): JSX.Element
```

**Responsibilities**:
- Display grouping options dropdown
- Handle user selection
- Disable label option when no labels exist
- Indicate currently active grouping

### 4. Grouping Utility Functions (New)

**Location**: `frontend/src/utils/topologyGrouping.ts`

**Interface**:
```typescript
export type GroupingAttribute = 'none' | 'role' | 'type' | 'label';

export interface GroupingConfig {
  attribute: GroupingAttribute;
  value?: string;
}

// Parse grouping from URL parameters
export function parseGroupingFromUrl(
  searchParams: URLSearchParams
): GroupingConfig;

// Calculate node groups
export function calculateNodeGroups(
  nodes: NodeInfo[],
  config: GroupingConfig
): Map<string, NodeInfo[]>;

// Get group label for display
export function getGroupLabel(
  groupKey: string,
  attribute: GroupingAttribute
): string;

// Check if nodes have custom labels
export function hasCustomLabels(nodes: NodeInfo[]): boolean;

// Build URL with grouping parameters
export function buildGroupingUrl(
  baseUrl: string,
  config: GroupingConfig
): string;
```

## Data Models

### GroupingConfig

```typescript
export interface GroupingConfig {
  attribute: GroupingAttribute;
  value?: string;  // Optional specific value to filter by
}

export type GroupingAttribute = 'none' | 'role' | 'type' | 'label';
```

**URL Encoding**:
- No grouping: `/cluster/:id/topology/dot`
- Group by role: `/cluster/:id/topology/dot?groupBy=role`
- Group by specific role: `/cluster/:id/topology/dot?groupBy=role&groupValue=data`
- Group by type: `/cluster/:id/topology/dot?groupBy=type`
- Group by label: `/cluster/:id/topology/dot?groupBy=label&groupValue=zone-a`

### NodeGroup

```typescript
export interface NodeGroup {
  key: string;           // Unique group identifier
  label: string;         // Display label
  nodes: NodeInfo[];     // Nodes in this group
  attribute: GroupingAttribute;
}
```

### Grouping Logic

**By Role**:
- Groups nodes by primary role (master, data, ingest, ml, coordinating)
- Nodes with multiple roles are grouped by their first role
- Nodes without roles go to "undefined" group

**By Type**:
- Groups nodes by node type classification
- Uses same logic as role grouping but considers type hierarchy
- Master-eligible nodes → "master" group
- Data nodes → "data" group
- etc.

**By Label**:
- Groups nodes by custom label values (from `node.tags` array)
- If `groupValue` specified, creates two groups: matching and "other"
- If no `groupValue`, creates group per unique label value
- Nodes without labels go to "undefined" group

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Complete Node Display

*For any* set of nodes returned by the Elasticsearch API, all nodes should be displayed in the topology view regardless of their roles, types, or attributes.

**Validates: Requirements 1.1, 1.2, 1.3**

### Property 2: Single Grouping Constraint

*For any* topology view state, at most one grouping attribute should be active at any time.

**Validates: Requirements 2.1**

### Property 3: Correct Node Partitioning

*For any* grouping attribute and set of nodes, grouping should partition nodes such that:
- Every node appears in exactly one group
- All nodes in a group share the same value for the grouping attribute
- No node is excluded from grouping

**Validates: Requirements 2.2, 2.3, 2.4**

### Property 4: Group Visual Elements

*For any* active grouping with N groups, the rendered output should contain:
- N group border elements
- N group label elements
- Each label should identify its group

**Validates: Requirements 3.1, 3.2**

### Property 5: URL-State Round Trip

*For any* grouping configuration, setting the grouping should update the URL with appropriate parameters, and navigating to that URL should restore the same grouping configuration.

**Validates: Requirements 4.1, 4.2, 4.3, 4.4**

### Property 6: Invalid Parameter Handling

*For any* invalid grouping parameter in the URL, the topology view should:
- Display all nodes without grouping
- Log a warning message
- Not throw an error or crash

**Validates: Requirements 4.5**

### Property 7: Backward Compatibility

*For any* topology view with grouping disabled (groupBy='none' or not specified), the rendered output should be equivalent to the original implementation without grouping features.

**Validates: Requirements 5.5**

### Property 8: Selection Triggers Update

*For any* grouping selection by the user, the visualization should immediately update to reflect the new grouping.

**Validates: Requirements 7.3**

### Property 9: UI Reflects Active Grouping

*For any* active grouping configuration, the grouping control UI should indicate which grouping option is currently selected.

**Validates: Requirements 7.4**

### Property 10: Conditional Label Option

*For any* set of nodes without custom labels (empty or undefined `tags` array), the "By Label" grouping option should be disabled or hidden in the UI.

**Validates: Requirements 7.5**

## Error Handling

### Invalid Grouping Parameters

**Scenario**: URL contains invalid `groupBy` value (e.g., `groupBy=invalid`)

**Handling**:
```typescript
function parseGroupingFromUrl(searchParams: URLSearchParams): GroupingConfig {
  const groupBy = searchParams.get('groupBy');
  
  if (!groupBy || groupBy === 'none') {
    return { attribute: 'none' };
  }
  
  const validAttributes: GroupingAttribute[] = ['role', 'type', 'label'];
  if (!validAttributes.includes(groupBy as GroupingAttribute)) {
    console.warn(`Invalid groupBy parameter: ${groupBy}. Defaulting to no grouping.`);
    return { attribute: 'none' };
  }
  
  return {
    attribute: groupBy as GroupingAttribute,
    value: searchParams.get('groupValue') || undefined,
  };
}
```

### Missing Node Attributes

**Scenario**: Nodes lack the attribute being grouped by (e.g., no roles, no labels)

**Handling**:
- Create "undefined" group for nodes without the attribute
- Display "undefined" label clearly
- Ensure these nodes are still visible and functional

```typescript
function calculateNodeGroups(
  nodes: NodeInfo[],
  config: GroupingConfig
): Map<string, NodeInfo[]> {
  const groups = new Map<string, NodeInfo[]>();
  
  for (const node of nodes) {
    let groupKey: string;
    
    switch (config.attribute) {
      case 'role':
        groupKey = node.roles?.[0] || 'undefined';
        break;
      case 'type':
        groupKey = determineNodeType(node) || 'undefined';
        break;
      case 'label':
        groupKey = node.tags?.[0] || 'undefined';
        break;
      default:
        groupKey = 'all';
    }
    
    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }
    groups.get(groupKey)!.push(node);
  }
  
  return groups;
}
```

### Empty Groups

**Scenario**: Grouping results in empty groups (shouldn't happen with current logic)

**Handling**:
- Don't render empty groups
- Filter out groups with zero nodes before rendering

### Performance Degradation

**Scenario**: Large cluster (100+ nodes) causes slow grouping calculation

**Handling**:
- Use memoization for group calculation
- Debounce grouping changes
- Show loading indicator during calculation
- Consider virtualization for very large clusters

```typescript
const memoizedGroups = useMemo(() => {
  return calculateNodeGroups(nodes, groupingConfig);
}, [nodes, groupingConfig]);
```

## Testing Strategy

### Unit Tests

**Focus**: Specific examples, edge cases, and error conditions

**Test Cases**:

1. **Grouping Calculation**:
   - Empty node list returns empty groups
   - Single node creates single group
   - Nodes without attribute go to "undefined" group
   - Multiple nodes with same attribute grouped together

2. **URL Parsing**:
   - No parameters returns 'none' grouping
   - Valid parameters parsed correctly
   - Invalid parameters default to 'none'
   - Missing groupValue handled gracefully

3. **Component Rendering**:
   - GroupRenderer displays border and label
   - GroupingControl shows correct options
   - Label option disabled when no labels exist
   - Active grouping highlighted in UI

4. **Integration**:
   - Changing grouping updates URL
   - Loading URL applies grouping
   - Switching between groupings works smoothly

### Property-Based Tests

**Focus**: Universal properties across all inputs

**Library**: fast-check (TypeScript property-based testing)

**Configuration**: Minimum 100 iterations per test

**Test Cases**:

1. **Property 1: Complete Node Display**
```typescript
// Feature: cluster-topology-grouping, Property 1: Complete Node Display
fc.assert(
  fc.property(
    fc.array(arbitraryNodeInfo()),
    (nodes) => {
      const rendered = renderTopologyView(nodes, { attribute: 'none' });
      const displayedNodeIds = extractNodeIds(rendered);
      const expectedNodeIds = nodes.map(n => n.id);
      
      expect(displayedNodeIds.sort()).toEqual(expectedNodeIds.sort());
    }
  ),
  { numRuns: 100 }
);
```

2. **Property 3: Correct Node Partitioning**
```typescript
// Feature: cluster-topology-grouping, Property 3: Correct Node Partitioning
fc.assert(
  fc.property(
    fc.array(arbitraryNodeInfo()),
    fc.constantFrom('role', 'type', 'label'),
    (nodes, attribute) => {
      const groups = calculateNodeGroups(nodes, { attribute });
      
      // Every node appears exactly once
      const allGroupedNodes = Array.from(groups.values()).flat();
      expect(allGroupedNodes.length).toBe(nodes.length);
      
      // No duplicates
      const uniqueIds = new Set(allGroupedNodes.map(n => n.id));
      expect(uniqueIds.size).toBe(nodes.length);
      
      // All nodes in group share attribute value
      for (const [groupKey, groupNodes] of groups.entries()) {
        if (groupKey !== 'undefined') {
          for (const node of groupNodes) {
            const nodeValue = getNodeAttributeValue(node, attribute);
            expect(nodeValue).toBe(groupKey);
          }
        }
      }
    }
  ),
  { numRuns: 100 }
);
```

3. **Property 5: URL-State Round Trip**
```typescript
// Feature: cluster-topology-grouping, Property 5: URL-State Round Trip
fc.assert(
  fc.property(
    fc.record({
      attribute: fc.constantFrom('none', 'role', 'type', 'label'),
      value: fc.option(fc.string(), { nil: undefined }),
    }),
    (config) => {
      // Set grouping and get URL
      const url = buildGroupingUrl('/cluster/test/topology/dot', config);
      
      // Parse URL back to config
      const searchParams = new URLSearchParams(new URL(url, 'http://localhost').search);
      const parsedConfig = parseGroupingFromUrl(searchParams);
      
      // Should match original
      expect(parsedConfig.attribute).toBe(config.attribute);
      if (config.attribute !== 'none') {
        expect(parsedConfig.value).toBe(config.value);
      }
    }
  ),
  { numRuns: 100 }
);
```

4. **Property 6: Invalid Parameter Handling**
```typescript
// Feature: cluster-topology-grouping, Property 6: Invalid Parameter Handling
fc.assert(
  fc.property(
    fc.string().filter(s => !['none', 'role', 'type', 'label'].includes(s)),
    (invalidAttribute) => {
      const searchParams = new URLSearchParams({ groupBy: invalidAttribute });
      const config = parseGroupingFromUrl(searchParams);
      
      // Should default to 'none'
      expect(config.attribute).toBe('none');
      
      // Should not throw
      expect(() => calculateNodeGroups([], config)).not.toThrow();
    }
  ),
  { numRuns: 100 }
);
```

5. **Property 10: Conditional Label Option**
```typescript
// Feature: cluster-topology-grouping, Property 10: Conditional Label Option
fc.assert(
  fc.property(
    fc.array(arbitraryNodeInfo()),
    (nodes) => {
      const hasLabels = hasCustomLabels(nodes);
      const availableOptions = getAvailableGroupingOptions(nodes);
      
      if (!hasLabels) {
        expect(availableOptions).not.toContain('label');
      } else {
        expect(availableOptions).toContain('label');
      }
    }
  ),
  { numRuns: 100 }
);
```

### Manual Testing Checklist

1. **Visual Verification**:
   - [ ] Group borders render correctly
   - [ ] Group labels are readable and positioned well
   - [ ] Nodes within groups maintain proper spacing
   - [ ] No visual overlap or obscured content

2. **Interaction Testing**:
   - [ ] Grouping dropdown opens and closes
   - [ ] Selecting grouping updates view immediately
   - [ ] URL updates when grouping changes
   - [ ] Browser back/forward works with grouping

3. **Edge Cases**:
   - [ ] Single node cluster
   - [ ] All nodes in one group
   - [ ] Many small groups (10+ groups)
   - [ ] Nodes without grouping attribute
   - [ ] Empty cluster

4. **Performance**:
   - [ ] 10 nodes: instant grouping
   - [ ] 50 nodes: smooth grouping
   - [ ] 100 nodes: acceptable performance (<500ms)

5. **Cross-Browser**:
   - [ ] Chrome/Edge
   - [ ] Firefox
   - [ ] Safari

