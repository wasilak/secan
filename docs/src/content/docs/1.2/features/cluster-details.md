---
title: Cluster Details
description: In-depth cluster management with tabs for overview, nodes, and indices
slug: 1.2/features/cluster-details
---

## Cluster Details Page

The Cluster Details page provides comprehensive management and monitoring of a single Elasticsearch cluster. It's organized into multiple tabs for easy navigation.

## Overview Tab

The Overview tab displays cluster health and key statistics:

* **Cluster Health**: Current health status with visual indicator
* **Cluster Statistics**: Node count, shard count, index count, document count
* **Cluster Settings**: Access to cluster-level configuration
* **Cluster Info**: Version information and cluster metadata

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

## Settings Tab

The Settings tab provides access to cluster-level configuration through a visual editor:

* **JSON Editor**: View and modify cluster settings in a Monaco editor with syntax highlighting
* **Show Defaults**: Toggle to include default settings in the configuration display
* **Copy Settings**: Easily copy configuration for backup or sharing
* **Persistent & Transient**: Manage both persistent and transient cluster settings

### Common Settings

* `cluster.max_shards_per_node`: Maximum shards per node limit
* `cluster.routing.allocation`: Shard allocation settings  
* `indices.memory`: Memory-related index settings
* `indices.queries.cache.size`: Query cache configuration

## Statistics Tab

View detailed cluster metrics and performance data:

* **Cluster Health Graph**: Historical cluster health visualization
* **Node Versions**: Distribution of Elasticsearch versions across nodes
* **Memory Usage**: Heap and disk usage trends
* **Auto-Refresh**: Statistics automatically update at configurable intervals

## Pagination for Large Clusters

For clusters with many nodes, indices, or shards, the Nodes, Indices, and Shards tabs implement pagination:

* **Page Controls**: Navigate between pages of results (50 items per page by default)
* **Total Count**: See the total number of items across all pages
* **Performance**: Optimized loading - only the requested page is loaded into memory
* **Responsive**: Pagination adapts to screen size

This significantly reduces memory usage when managing large clusters with thousands of nodes or shards.

## Navigation

All tabs include configuration and management options for advanced operations.

## What's Next

* Learn about [Index Management](/1.2/features/index-management/) for detailed index operations
* Explore [Shard Management](/1.2/features/shard-management/) for shard allocation
* Check out [REST Console](/1.2/features/rest-console/) to execute queries
