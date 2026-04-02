---
title: Shard Management
description: Interactive shard allocation and relocation
---

## Shard Management

The Shard Management feature provides a visual, grid-based interface for managing Elasticsearch shard allocation and relocation.

## Visual Shard Grid

Secan displays shards in an interactive grid where:

- **Rows** represent Elasticsearch nodes
- **Columns** represent indices (10 per page with pagination)
- **Color coding** indicates shard status (primary, replica, unallocated)

### Grid Layout

The grid shows all nodes as rows and paginates indices across columns:

- **Fixed Columns**: Always displays 10 indices per page
- **Pagination**: Navigate between index pages using the pagination controls
- **Node Column**: Sticky left column showing node names (180px width)
- **Unassigned Row**: Special row at the top showing unassigned shards

### Shard Status Colors

Shards are color-coded to show status:

- **Blue**: Primary shard (allocated)
- **Green**: Replica shard (allocated)
- **Gray**: Unallocated shard (waiting for assignment)
- **Red**: Unallocated primary (cluster health affected)

## Shard Operations

### Shard Relocation

Relocate shards between nodes using the interactive grid:

1. **Right-click** on a shard to open the context menu
2. Select **"Select for Relocation"**
3. **Destination nodes** will be highlighted in the grid
4. Click on a destination node to initiate the move
5. **Confirm** the relocation in the modal dialog

The system validates:
- Destination node has the data role
- Destination doesn't already have a copy of this shard
- Sufficient disk space is available

### Relocating Shard Indicators

Shards that are currently relocating show a **special visual indicator**:

- **Yellow dot overlay** on the shard cell
- **Tooltip** showing source and destination nodes
- **Real-time updates** as the relocation progresses

You can filter the view to show only relocating shards using the filter controls.

### Shard Context Menu

Right-click any shard to access:

- **View Stats**: Open shard statistics modal
- **Select for Relocation**: Start the relocation workflow
- **View Index Details**: Navigate to the index details page

### Shard Status

Shards are color-coded to show status:

- **Blue**: Primary shard (allocated)
- **Green**: Replica shard (allocated)
- **Gray**: Unallocated shard (waiting for assignment)
- **Red**: Unallocated primary (cluster health affected)

## Use Cases

### Rebalancing

After node additions or removals, rebalance shards across the cluster for optimal distribution.

### Node Maintenance

Before taking a node offline, relocate its shards to other nodes using this interface.

### Performance Optimization

Move shards based on query patterns or resource usage to optimize performance.

## Important Notes

- Shard relocation consumes I/O resources; plan carefully
- Use during off-peak hours for large relocations
- Monitor cluster health during operations
- Elasticsearch throttles relocations to avoid overwhelming the cluster

## Related Features

- [Cluster Details](../features/cluster-details) - View cluster and node status
- [Index Management](../features/index-management) - Manage indices
- [REST Console](../features/rest-console) - Execute shard allocation APIs directly
