---
title: Cluster Details
description: >-
  In-depth cluster management with tabs for overview, nodes, indices, and
  topology visualization
---

## Cluster Details Page

The Cluster Details page provides comprehensive management and monitoring of a single Elasticsearch cluster. It's organized into multiple tabs for easy navigation.

## Overview Tab

The Overview tab displays cluster health and key statistics:

* **Cluster Health**: Current health status with visual indicator
* **Cluster Statistics**: Node count, shard count, index count, document count
* **Cluster Settings**: Access to cluster-level configuration
* **Cluster Info**: Version information and cluster metadata

## Topology Tab

The Topology tab provides visual representations of shard allocation across nodes. It includes two complementary views:

### Dot View

* **Visual Overview**: Each shard shown as a colored 10x10px dot
* **Color Coding**: Green (healthy), Yellow (degraded), Red (critical)
* **Node Cards**: Compact cards showing node info and shard dots
* **Hover Tooltips**: Detailed shard information on hover
* **Best For**: Quick health assessment and visual learners

### Index View

* **Grid Layout**: Traditional table with indices as columns
* **Shard Cells**: Visual indicators for primary/replica shards
* **Detailed View**: Exact shard distribution per index
* **Best For**: Index-focused work and precise relocation

### Shared Features

Both views share:
* **Wildcard Filtering**: Filter indices and nodes with `*` and `?` patterns
* **Relocation Mode**: Visual shard relocation with destination highlighting
* **Context Menu**: Quick access to shard actions
* **Common Controls**: Allocation locks, state filters, statistics

See [Topology Visualization](/1.1/1.0/features/topology-visualization) for detailed documentation.

## Nodes Tab

The Nodes tab shows all nodes in the cluster with their statistics:

* **Node Name**: Node identifier
* **Host/IP**: Node address and port
* **Role**: Master, data, ingest, or combined roles
* **Heap**: Heap memory usage and capacity
* **Disk**: Disk space usage
* **Load Average**: CPU load metrics
* **Shards**: Number of shards on the node
* **Documents**: Number of documents on the node

Click on any node to view detailed node statistics and configuration.

## Indices Tab

The Indices tab displays all indices in the cluster:

* **Index Name**: Name of the index
* **Health**: Index health status
* **Status**: Open or closed status
* **Shards**: Total shards for the index
* **Replicas**: Replica configuration
* **Documents**: Number of documents in the index
* **Size**: Total index size on disk

### Index Management

From the Indices tab, you can:

* **View Index Details**: Click an index to see detailed statistics
* **Create Indices**: Add new indices with custom settings
* **Delete Indices**: Remove indices from the cluster
* **Modify Settings**: Change index settings and configurations
* **View Mappings**: Review field mappings and types

## Navigation

All tabs include a **Settings** option that opens cluster-level management controls for advanced configuration.

## What's Next

* Learn about [Topology Visualization](/1.1/1.0/features/topology-visualization) for visual shard allocation
* Learn about [Index Management](/1.1/1.0/features/index-management) for detailed index operations
* Explore [Shard Management](/1.1/1.0/features/shard-management) for shard allocation
* Check out [REST Console](/1.1/1.0/features/rest-console) to execute queries
