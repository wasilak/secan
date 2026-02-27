---
title: Shard Management
description: Interactive shard allocation and relocation
slug: 1.2/features/shard-management
---

## Shard Management

The Shard Management feature provides a visual, grid-based interface for managing Elasticsearch shard allocation and relocation.

## Visual Shard Grid

Secan displays shards in an interactive grid where:

* **Rows** represent Elasticsearch nodes
* **Columns** represent different shards
* **Color coding** indicates shard status (primary, replica, unallocated)

## Shard Operations

### Shard Relocation

Relocate shards between nodes:

1. Click on a shard in the grid
2. Select the destination node
3. Confirm the relocation

The system validates the relocation is possible and tracks progress.

### Shard Status

Shards are color-coded to show status:

* **Blue**: Primary shard (allocated)
* **Green**: Replica shard (allocated)
* **Gray**: Unallocated shard (waiting for assignment)
* **Red**: Unallocated primary (cluster health affected)

## Use Cases

### Rebalancing

After node additions or removals, rebalance shards across the cluster for optimal distribution.

### Node Maintenance

Before taking a node offline, relocate its shards to other nodes using this interface.

### Performance Optimization

Move shards based on query patterns or resource usage to optimize performance.

## Important Notes

* Shard relocation consumes I/O resources; plan carefully
* Use during off-peak hours for large relocations
* Monitor cluster health during operations
* Elasticsearch throttles relocations to avoid overwhelming the cluster

## Related Features

* [Cluster Details](/1.2/features/cluster-details/) - View cluster and node status
* [Index Management](/1.2/features/index-management/) - Manage indices
* [REST Console](/1.2/features/rest-console/) - Execute shard allocation APIs directly
