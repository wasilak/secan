# Design Document: Index Details Visualization

## Implementation Note

**Updated Approach**: After analyzing the existing codebase, this feature will be implemented by adding a new "Visualization" tab to the existing Index Details Modal (first position, active by default). The implementation leverages existing infrastructure:

- ✅ **Index Details Modal**: Already exists in `ClusterView.tsx` using `IndexEdit` component with tabs for Settings, Mappings, and Stats
- ✅ **Shard API Endpoints**: `getShards()`, `getNodeShards()`, `getShardStats()` already implemented
- ✅ **Data Types**: `ShardInfo`, `NodeWithShards`, `DetailedShardStats` already defined in `frontend/src/types/api.ts`
- ✅ **Existing Components**: `ShardList`, `ShardGrid`, `ShardStatsModal` provide patterns to follow
- ✅ **Utilities**: `formatBytes`, `getHealthColor`, `getShardStateColor` already available

**No backend work required** - we only need to create the visualization component and add it as a new tab.

---

## Overview

This feature implements an APM-style visualization for Elasticsearch index details, providing an intuitive visual representation of shard distribution across cluster nodes. The visualization displays the index in the center with nodes containing primary shards on the left and nodes containing replica shards on the right, connected by visual lines. This design enables cluster administrators to quickly understand shard allocation, identify health issues, and navigate to detailed node information.

The implementation follows the existing Cerebro rewrite architecture with a Rust backend serving Elasticsearch data through REST APIs and a React/TypeScript frontend using Mantine UI components for consistent styling and user experience.

## Architecture

### High-Level Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React)                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Index Details Modal (ClusterView.tsx)                 │ │
│  │  ┌──────────────────────────────────────────────────┐ │ │
│  │  │  IndexEdit Component                             │ │ │
│  │  │  - Tabs: Visualization*, Settings, Mappings, Stats│ │ │
│  │  │  - *First tab, active by default                 │ │ │
│  │  └──────────────────────────────────────────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  IndexVisualization Component (NEW)                   │ │
│  │  - SVG-based APM-style rendering                      │ │
│  │  - Center index, left primary nodes, right replicas   │ │
│  │  - Interactive elements (tooltips, click handlers)    │ │
│  │  - Responsive layout                                  │ │
│  │  - Export functionality                               │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  useIndexShards Hook (NEW)                            │ │
│  │  - Wraps existing getShards() API                     │ │
│  │  - Filters shards by index name                       │ │
│  │  - TanStack Query with 30s cache                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                          │                                   │
│                          ▼                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Existing API Client                                  │ │
│  │  - getShards(clusterId) ✅ Already exists             │ │
│  │  - getNodes(clusterId) ✅ Already exists              │ │
│  │  - getShardStats() ✅ Already exists                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          │
                          │ HTTP/JSON (Already implemented)
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                     Backend (Rust/Axum)                      │
│  ✅ Existing Routes - No changes needed                     │
│  - GET /api/clusters/:id/shards                             │
│  - GET /api/clusters/:id/nodes                              │
│  - GET /api/clusters/:id/indices/:index/shards/:shard/stats │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

1. **User Navigation**: User clicks on index name → Index Details Modal opens with Visualization tab active (first tab)
2. **Data Fetching**: `useIndexShards` hook calls existing `getShards()` API and filters by index name
3. **Data Transformation**: Component groups shards by node, separates primary/replica
4. **Rendering**: SVG-based visualization renders with center index and side nodes
5. **User Interaction**: User interacts with visualization (hover for tooltips, click nodes to navigate)

## Components and Interfaces

### Frontend Components

#### IndexVisualization Component (NEW)

Main visualization component that renders the APM-style layout.

```typescript
interface IndexVisualizationProps {
  clusterId: string;
  indexName: string;
  onNodeClick?: (nodeId: string) => void;
  refreshInterval?: number; // milliseconds, default 30000
}

// Uses existing ShardInfo type from api.ts
// Uses existing NodeInfo type from api.ts
```

**Responsibilities**:
- Fetch shard data using `useIndexShards` hook (wraps existing `getShards()` API)
- Filter shards by index name
- Group shards by node and primary/replica status
- Render SVG-based layout with center index and side nodes
- Handle user interactions (hover, click)
- Manage responsive layout
- Provide export functionality

#### useIndexShards Hook (NEW)

Custom hook that wraps existing shard API.

```typescript
function useIndexShards(clusterId: string, indexName: string, refreshInterval: number = 30000) {
  return useQuery({
    queryKey: ['cluster', clusterId, 'shards', 'index', indexName],
    queryFn: async () => {
      // Call existing getShards() API
      const response = await apiClient.getShards(clusterId);
      // Filter shards for this specific index
      return response.items.filter(shard => shard.index === indexName);
    },
    refetchInterval: refreshInterval,
    staleTime: 30000,
  });
}
```

**Responsibilities**:
- Wrap existing `getShards()` API call
- Filter shards by index name
- Configure TanStack Query caching and refetching
- Handle loading, error, and success states

### Existing Components (Reused)

The following components and utilities already exist and will be reused:

- **ShardInfo type**: Already defined in `frontend/src/types/api.ts`
- **NodeInfo type**: Already defined in `frontend/src/types/api.ts`
- **formatBytes utility**: Already exists for size formatting
- **getHealthColor utility**: Already exists for health status colors
- **getShardStateColor utility**: Already exists for shard state colors
- **Mantine UI components**: Card, Badge, Tooltip, ActionIcon, ScrollArea, etc.

### Backend API Endpoints (Already Exist - No Changes Required)

The visualization leverages existing backend APIs:

- **GET /api/clusters/:cluster_id/shards** - Returns all shards (filter by index in frontend)
- **GET /api/clusters/:cluster_id/nodes** - Returns all nodes with resource metrics
- **GET /api/clusters/:cluster_id/indices/:index/shards/:shard/stats** - Returns detailed shard stats (optional)

## Data Models

All data types are already defined in `frontend/src/types/api.ts`:

- **ShardInfo**: Contains index, shard number, primary flag, state, node, docs, store, relocatingNode
- **NodeInfo**: Contains id, name, roles, heap, disk, CPU, IP, version, tags, master flags, load average, uptime
- **IndexInfo**: Contains name, health, status, shard counts, docs count, store size, UUID

### Data Transformation (Frontend Only)

The visualization component transforms API data:

1. **Filter shards**: Filter `getShards()` response by index name
2. **Separate shards**: Group shards by primary/replica and assigned/unassigned
3. **Group by node**: Aggregate shards by node for each side
4. **Handle edge cases**: Nodes with both primary and replica shards appear on both sides
5. **Calculate totals**: Sum primary and replica shard counts

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Primary shard nodes positioned on left

*For any* index visualization, all nodes containing primary shards for that index should be positioned on the left side of the center index element.

**Validates: Requirements 1.2, 2.3**

### Property 2: Replica shard nodes positioned on right

*For any* index visualization, all nodes containing replica shards for that index should be positioned on the right side of the center index element.

**Validates: Requirements 1.3, 2.4**

### Property 3: Visual connections exist for all nodes

*For any* node displayed in the visualization, there should be a visual connection element (line or path) linking that node to the center index element.

**Validates: Requirements 1.4**

### Property 4: Node names displayed for all nodes

*For any* node in the visualization, the node's name should be rendered and visible in the node card.

**Validates: Requirements 2.1**

### Property 5: Shard counts match actual allocation

*For any* node in the visualization, the displayed shard count should equal the actual number of shards allocated to that node for the index.

**Validates: Requirements 2.2**

### Property 6: Health status color mapping

*For any* shard displayed in the visualization, the shard's color should correspond to its health status: green for healthy (STARTED), yellow for warnings (INITIALIZING), red for unhealthy (RELOCATING with issues), and gray for unassigned.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4**

### Property 7: Node hover displays tooltip

*For any* node in the visualization, hovering over the node element should display a tooltip containing node details (name, ID, shard count, resource usage).

**Validates: Requirements 4.1**

### Property 8: Shard hover displays tooltip

*For any* shard indicator in the visualization, hovering over the shard should display a tooltip containing shard-specific information (index, shard number, state, docs, size).

**Validates: Requirements 4.2**

### Property 9: Node click triggers navigation

*For any* node in the visualization, clicking on the node element should trigger navigation to the node details view for that node.

**Validates: Requirements 4.3**

### Property 10: Total shard counts displayed

*For any* index visualization, the displayed total primary shard count and total replica shard count should match the actual shard configuration of the index.

**Validates: Requirements 4.4, 4.5**

### Property 11: Node filter reduces displayed nodes

*For any* search filter applied to the visualization, only nodes whose names match the filter pattern should be displayed in the visualization.

**Validates: Requirements 5.4**

### Property 12: Primary shard numbers displayed

*For any* primary shard in the visualization, the shard's number should be displayed on or near the shard indicator.

**Validates: Requirements 6.1**

### Property 13: Replica shard numbers displayed

*For any* replica shard in the visualization, both the shard number and replica number should be displayed on or near the shard indicator.

**Validates: Requirements 6.2**

### Property 14: Matching shards visually connected

*For any* primary shard and its corresponding replica shards, there should be visual connections indicating the relationship between the primary and each replica.

**Validates: Requirements 6.3**

### Property 15: Visualization refreshes on allocation changes

*For any* shard allocation change in the cluster, the visualization should automatically refetch data and update the display within the configured refresh interval.

**Validates: Requirements 7.4**

### Property 16: Layout adapts to viewport width

*For any* viewport width change, the visualization layout should recalculate positions and sizes to fit the available space while maintaining readability.

**Validates: Requirements 8.1, 8.5**

### Property 17: Font sizes scale responsively

*For any* zoom level or viewport size, font sizes for node names and shard labels should scale proportionally to maintain readability.

**Validates: Requirements 8.4**

### Property 18: API response parsing extracts shard data

*For any* valid Elasticsearch `_cat/shards` API response, the parsing function should correctly extract all shard allocation information including index, shard number, primary/replica status, state, node assignment, and metrics.

**Validates: Requirements 9.4**

### Property 19: Exported image contains metadata

*For any* visualization export, the generated image file should contain the index name and timestamp as visible text elements within the image.

**Validates: Requirements 10.4**

## Error Handling

### Frontend Error Handling

#### API Request Failures

- **Network errors**: Display Mantine Alert with error message and retry button
- **404 errors**: Show "Index not found" message
- **500 errors**: Show "Failed to fetch visualization data" with error details
- **Timeout errors**: Show "Request timed out" with retry option

#### Rendering Errors

- **Invalid data**: Fallback to error boundary with diagnostic information
- **SVG rendering failures**: Display simplified text-based view
- **Export failures**: Show error notification with failure reason

#### Data Handling

- **Empty shard arrays**: Display empty state message
- **Missing node information**: Use node ID as fallback name
- **Invalid shard data**: Skip invalid entries and log warning to console

## Testing Strategy

### Dual Testing Approach

This feature requires both unit tests and property-based tests for comprehensive coverage:

- **Unit tests**: Verify specific examples, edge cases, and error conditions
- **Property tests**: Verify universal properties across all inputs using randomized data
- Together, these approaches ensure both concrete correctness and general behavior

### Frontend Testing

#### Unit Tests (Vitest + React Testing Library)

**Component Rendering Tests**:
- Test IndexVisualization renders with valid data
- Test empty state when no shards exist
- Test loading state during data fetch
- Test error state when API fails
- Test visualization tab integration in index details page
- Test export button triggers download
- Test zoom controls update visualization
- Test node search filter reduces displayed nodes

**Interaction Tests**:
- Test node hover shows tooltip
- Test shard hover shows tooltip
- Test node click navigates to node details
- Test export button generates PNG
- Test export button generates SVG
- Test zoom in/out updates scale
- Test filter input filters nodes

**Edge Case Tests**:
- Test index with no replicas (only left side displayed)
- Test node with both primary and replica shards (appears on both sides)
- Test unassigned shards displayed separately
- Test relocating shard shows source and target
- Test initializing shard shows progress
- Test viewport width < 768px stacks nodes vertically
- Test more than 10 nodes enables scrolling
- Test more than 20 nodes enables grouping

#### Property-Based Tests (fast-check)

**Property Test Configuration**:
- Minimum 100 iterations per test
- Tag format: `Feature: index-details-visualization, Property {number}: {property_text}`

**Property Tests**:

```typescript
// Property 1: Primary shard nodes positioned on left
it('should position all primary shard nodes on the left side', () => {
  fc.assert(
    fc.property(
      fc.record({
        indexName: fc.string(),
        primaryNodes: fc.array(fc.record({
          id: fc.string(),
          name: fc.string(),
          shards: fc.array(fc.record({
            shardNumber: fc.nat(),
            primary: fc.constant(true),
          })),
        })),
      }),
      (data) => {
        const { container } = render(<IndexVisualization data={data} />);
        const leftSide = container.querySelector('.left-nodes');
        const primaryNodeElements = leftSide?.querySelectorAll('.node-card');
        expect(primaryNodeElements?.length).toBe(data.primaryNodes.length);
      }
    ),
    { numRuns: 100 }
  );
});

// Property 5: Shard counts match actual allocation
it('should display shard count matching actual allocation', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        nodeId: fc.string(),
        nodeName: fc.string(),
        shards: fc.array(fc.record({
          shardNumber: fc.nat(),
          primary: fc.boolean(),
        })),
      })),
      (nodes) => {
        const { container } = render(<IndexVisualization nodes={nodes} />);
        nodes.forEach(node => {
          const nodeElement = container.querySelector(`[data-node-id="${node.nodeId}"]`);
          const displayedCount = nodeElement?.querySelector('.shard-count')?.textContent;
          expect(parseInt(displayedCount || '0')).toBe(node.shards.length);
        });
      }
    ),
    { numRuns: 100 }
  );
});

// Property 18: API response parsing extracts shard data
it('should correctly parse all shard data from API response', () => {
  fc.assert(
    fc.property(
      fc.array(fc.record({
        index: fc.string(),
        shard: fc.nat(),
        prirep: fc.constantFrom('p', 'r'),
        state: fc.constantFrom('STARTED', 'INITIALIZING', 'RELOCATING', 'UNASSIGNED'),
        docs: fc.nat(),
        store: fc.nat(),
        node: fc.option(fc.string()),
      })),
      (apiResponse) => {
        const parsed = parseShardAllocationData(apiResponse);
        expect(parsed.length).toBe(apiResponse.length);
        parsed.forEach((shard, idx) => {
          expect(shard.shardNumber).toBe(apiResponse[idx].shard);
          expect(shard.primary).toBe(apiResponse[idx].prirep === 'p');
          expect(shard.state).toBe(apiResponse[idx].state);
        });
      }
    ),
    { numRuns: 100 }
  );
});
```

### Backend Testing

**No backend testing required** - all backend APIs already exist and are tested.

### Integration Testing

**End-to-End Tests**:
- Test complete flow from frontend to Elasticsearch
- Test visualization updates when shards are relocated
- Test export functionality generates valid files
- Test responsive behavior at different screen sizes
- Test large cluster performance (20+ nodes)

### Manual Testing Checklist

- [ ] Visualization displays correctly for index with 1 primary, 1 replica
- [ ] Visualization displays correctly for index with 5 primaries, 2 replicas
- [ ] Visualization displays correctly for index with no replicas
- [ ] Node hover shows tooltip with correct information
- [ ] Shard hover shows tooltip with correct information
- [ ] Node click navigates to node details page
- [ ] Export PNG generates valid image file
- [ ] Export SVG generates valid SVG file
- [ ] Zoom controls work correctly
- [ ] Node filter reduces displayed nodes
- [ ] Visualization refreshes automatically every 30 seconds
- [ ] Responsive layout works on mobile (< 768px width)
- [ ] Visualization handles 20+ nodes with grouping
- [ ] Unassigned shards displayed separately
- [ ] Relocating shards show source and target nodes
- [ ] Initializing shards show progress indicator

