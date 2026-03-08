---
title: Topology Visualization
description: Visual cluster topology with dot view and index view for shard allocation
---

## Topology Visualization

The Topology Visualization feature provides visual representations of how shards are distributed across your cluster nodes. It offers two complementary views to understand your cluster's shard allocation at a glance.

## Accessing Topology View

Navigate to the topology section using any of these URLs:

* **Main topology**: `/cluster/:id/topology` (redirects to Dot View)
* **Dot View**: `/cluster/:id/topology/dot`
* **Index View**: `/cluster/:id/topology/index`

The view type is reflected in the URL, making it easy to bookmark or share specific views.

## Dot View

The Dot View provides a compact visual overview using colored dots to represent shards.

### Features

* **Visual Representation**: Each shard is shown as a 10x10px colored square (dot)
* **Color Coding**: Dots are colored based on index health:
  * 🟢 **Green**: Healthy index
  * 🟡 **Yellow**: Degraded index (some replicas missing)
  * 🔴 **Red**: Critical index (primary shard missing)
* **Node Cards**: Each node displays:
  * Node name and roles (Master, Data, etc.)
  * Resource usage (Heap, Disk)
  * Shard dots in a compact grid
* **Hover Tooltips**: Hover over any dot to see:
  * Index name and shard number (e.g., `test[0]`)
  * Shard type (Primary/Replica)
  * Shard state (STARTED, UNASSIGNED, etc.)
  * Document count
  * Shard size in MB
* **Unassigned Shards**: Displayed in a separate row at the bottom

### Filtering

Use the wildcard filters at the top:

* **Filter indices**: Support for `*` (any characters) and `?` (single character)
  * Example: `te*st` matches "test", "testing", "latest"
  * Example: `*query*` matches "top_queries-2026.03.01"
* **Filter nodes**: Same wildcard pattern matching
  * Example: `node*` matches "node-1", "node-2", "opensearch-cluster-nodes-0"

## Index View

The Index View displays shard allocation in a traditional grid format with indices as columns and nodes as rows.

### Features

* **Grid Layout**: Table showing which shards are on which nodes
* **Index Columns**: Each index gets its own column
* **Node Rows**: Each node gets its own row
* **Shard Cells**: Cells show shard numbers with visual indicators:
  * **Green background**: Primary shard
  * **Dashed border**: Replica shard
  * **Purple dashed border**: Valid relocation destination
* **Detailed Information**: Click any shard to see details or relocate

### Filtering

Same wildcard filtering as Dot View:

* **Filter indices**: Wildcard patterns with `*` and `?`
* **Filter nodes**: Wildcard patterns for node names
* **Shard states**: Toggle visibility of STARTED, UNASSIGNED, INITIALIZING, RELOCATING
* **Special indices**: Toggle visibility of indices starting with `.`
* **Closed indices**: Toggle visibility of closed indices

## Shared Features

Both views share the same underlying functionality:

### Relocation Mode

1. **Start Relocation**:
   * Click any shard
   * Select "Relocate Shard" from context menu
   * Valid destinations highlight with purple dashed borders

2. **Select Destination**:
   * Click a highlighted destination node
   * Confirmation modal appears with details

3. **Confirm Relocation**:
   * Review source and destination nodes
   * Click "Relocate Shard" to execute
   * Backend initiates shard relocation

4. **Cancel Relocation**:
   * Click "Cancel Relocation" button in banner
   * Exits relocation mode

### Common Filter Bar

Both views use the same shared filter bar:

* **Allocation Controls**: Lock/unlock shard allocation
  * 🔓 **Green unlocked**: Allocation enabled
  * 🔒 **Red locked**: Allocation disabled
  * Menu options: None, Primaries only, New primaries only
* **Index Filter**: Wildcard pattern matching for index names
* **Node Filter**: Wildcard pattern matching for node names
* **Shard States**: Toggle visibility of different shard states
* **Special Indices**: Toggle visibility of `.*` indices
* **Statistics**: Live counts of nodes, indices, and shards

### Context Menu

Right-click or click any shard to access:

* **Show Stats**: View detailed shard information
* **Relocate Shard**: Start relocation process (if applicable)

### Confirmation Modal

When relocating, a modal shows:

```
┌─────────────────────────────────────────┐
│ Confirm Shard Relocation                │
├─────────────────────────────────────────┤
│ Index:          test                    │
│ Shard Number:   0                       │
│ Shard Type:     Primary                 │
│ Source Node:    opensearch-cluster-2    │
│ Destination:    opensearch-cluster-0    │
├─────────────────────────────────────────┤
│          [Cancel] [Relocate Shard]      │
└─────────────────────────────────────────┘
```

## Use Cases

### Dot View - Best For:

* **Quick health assessment**: See cluster health at a glance
* **Identifying hotspots**: Spot nodes with many shards
* **Visual learners**: Prefer graphical representation
* **Large clusters**: Compact view shows more at once

### Index View - Best For:

* **Detailed analysis**: See exact shard distribution per index
* **Index-focused work**: Managing specific indices
* **Traditional view**: Prefer table/grid layouts
* **Precise relocation**: Select specific shard to move

## Keyboard Shortcuts

* **Tab switching**: Click tabs or use URL directly
* **Filter focus**: Click filter fields to type
* **Context menu**: Click shard for options

## Tips

1. **Direct Linking**: Bookmark specific views
   * `/cluster/opensearch/topology/dot` for Dot View
   * `/cluster/opensearch/topology/index` for Index View

2. **Wildcard Patterns**:
   * `*` matches any sequence of characters
   * `?` matches a single character
   * Patterns are case-insensitive

3. **Relocation**:
   * Start in one view, finish in the other
   * Both views show the same relocation state
   * Purple dashed borders show valid destinations

4. **Performance**:
   * Dot View is more performant for large clusters
   * Index View provides more detail but uses more resources

## What's Next

* Learn about [Index Management](/1.1/1.0/features/index-management) for detailed index operations
* Explore [Shard Management](/1.1/1.0/features/shard-management) for advanced shard operations
* Check out [Cluster Health](/1.1/1.0/features/cluster-health) for health monitoring
