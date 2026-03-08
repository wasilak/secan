---
title: Cluster Details
description: 'In-depth cluster management with tabs for overview, nodes, indices, and tasks'
---

## Cluster Details Page

The Cluster Details page provides comprehensive management and monitoring of a single Elasticsearch cluster. It's organized into multiple tabs for easy navigation.

## Navigation Tabs

The cluster view includes the following tabs:

- **Overview**: Cluster health and key statistics
- **Nodes**: Node information and metrics
- **Indices**: Index management and statistics
- **Tasks**: Cluster task monitoring and management
- **Topology**: Visual shard allocation view
- **REST Console**: Direct API access
- **Additional**: Templates, aliases, snapshots, and repositories

## Overview Tab

The Overview tab displays cluster health and key statistics:

- **Cluster Health**: Current health status with visual indicator
- **Cluster Statistics**: Node count, shard count, index count, document count
- **Cluster Settings**: Access to cluster-level configuration
- **Cluster Info**: Version information and cluster metadata
- **Prometheus Metrics**: Historical metrics with time range selection

### Prometheus Metrics Integration

View historical metrics for the cluster:

- **Time Range Picker**: Select from preset ranges (last 24 hours, 7 days, custom)
- **Metrics Display**: Graphs showing metrics over time
- **Node Metrics**: Per-node metric breakdown
- **Disk Usage Trends**: Track disk consumption over time
- **Memory Usage**: Heap and memory utilization trends

## Nodes Tab

The Nodes tab shows all nodes in the cluster with their statistics:

- **Node Name**: Node identifier
- **Host/IP**: Node address and port
- **Role**: Master, data, ingest, or combined roles
- **Heap**: Heap memory usage and capacity
- **Disk**: Disk space usage
- **Load Average**: CPU load metrics
- **Shards**: Number of shards on the node
- **Documents**: Number of documents on the node

### Node Detail Modal

Click on any node to view detailed information:

- **Node Information**: ID, name, IP, transport address
- **JVM Details**: Version, heap configuration, memory usage
- **OS Information**: OS type, version, available processors
- **CPU & Load**: CPU usage, load averages (1, 5, 15 minutes)
- **Disk Metrics**: Total, available, and used disk space with percentages
- **Heap Usage**: Visual representation of heap utilization
- **Shard Distribution**: List of shards allocated to the node
- **Prometheus Metrics**: Historical metrics for the selected node

#### Node Metrics Time Picker

The node modal includes a time range picker for viewing historical metrics:

- **Quick Ranges**: Last 24 hours, last 7 days
- **Custom Range**: Select specific start and end times
- **Auto-Refresh**: Metrics update based on global refresh settings
- **Export**: Download metrics data for analysis

## Indices Tab

The Indices tab displays all indices in the cluster:

- **Index Name**: Name of the index
- **Health**: Index health status
- **Status**: Open or closed status
- **Shards**: Total shards for the index
- **Replicas**: Replica configuration
- **Documents**: Number of documents in the index
- **Size**: Total index size on disk

### Index Filtering and Search

- **Search Box**: Filter indices by name (with 300ms debounce)
- **Health Filters**: Toggle visibility by health status (green, yellow, red)
- **Status Filters**: Show/hide open or closed indices
- **Special Indices**: Toggle visibility of system indices (starting with `.`)
- **Affected Only**: Show only indices with problem shards

### Index Management

From the Indices tab, you can:

- **View Index Details**: Click an index to see detailed statistics
- **Create Indices**: Add new indices with custom settings
- **Delete Indices**: Remove indices from the cluster
- **Modify Settings**: Change index settings and configurations
- **View Mappings**: Review field mappings and types
- **Bulk Operations**: Select multiple indices for batch operations

### Index Detail Modal

Click on an index to view:

- **General Information**: Health, status, document count, size
- **Settings**: Index configuration and settings
- **Mappings**: Field definitions and types
- **Statistics**: Detailed index statistics
- **Analyzers**: Configured analyzers and their usage
- **Preserved Filters**: All filters from the indices list are preserved when navigating back

## Tasks Tab

The Tasks tab provides real-time monitoring of cluster operations:

- **Active Tasks**: View all running tasks
- **Task Filtering**: Filter by action, node, or status
- **Task Details**: Click to view detailed task information
- **Cancel Tasks**: Stop individual or multiple tasks
- **Bulk Operations**: Select and manage multiple tasks

See [Cluster Tasks Management](../features/cluster-tasks) for detailed information.

## Topology Tab

Visual representation of shard allocation across nodes:

- **Dot View**: Visual representation with nodes and shard dots
- **Index View**: Grid view showing shard distribution
- **Filtering**: Filter by index name or node name
- **Shard Relocation**: Interactive shard movement
- **Health Indicators**: Color-coded shard health

## Navigation

All tabs include a **Settings** option that opens cluster-level management controls for advanced configuration.

## Filter Preservation

Secan preserves your filter settings when navigating between views:

- **URL-Based Filters**: All filters stored in URL parameters
- **Browser Navigation**: Back/forward buttons maintain filter state
- **Bookmark Support**: Share URLs with filters intact
- **Modal Navigation**: Filters preserved when opening/closing modals

## What's Next

- Learn about [Index Management](../features/index-management) for detailed index operations
- Explore [Shard Management](../features/shard-management) for shard allocation
- Check out [REST Console](../features/rest-console) to execute queries
- Monitor [Cluster Tasks](../features/cluster-tasks) for operation management
