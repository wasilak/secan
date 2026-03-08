---
title: Dashboard & Overview
description: >-
  Global cluster overview and cross-cluster monitoring with Prometheus metrics
  integration
---

## Dashboard Overview

The Secan dashboard provides a high-level overview of all configured clusters, allowing you to quickly assess the health and status of your Elasticsearch infrastructure.

## Dashboard Features

### Cluster List

The dashboard displays all your configured clusters in a table with the following information:

- **Cluster Name**: Display name of the cluster
- **Health Status**: Current cluster health (green, yellow, red, or unreachable)
- **Node Count**: Number of nodes in the cluster
- **Shard Count**: Total shards across all indices
- **Index Count**: Number of indices in the cluster
- **Document Count**: Total documents across all indices
- **Disk Usage**: Total disk space used and percentage utilization

### Health Status Colors

- **Green**: All shards are allocated and cluster is healthy
- **Yellow**: All primary shards are allocated, but some replicas are missing
- **Red**: One or more primary shards are unallocated
- **Unreachable**: Cannot connect to the cluster

### Summary Metrics

At the top of the dashboard, view aggregate statistics across all clusters:

- **Total Clusters**: Number of configured clusters
- **Total Nodes**: Combined node count across all clusters
- **Total Indices**: Sum of all indices
- **Total Documents**: Combined document count
- **Total Shards**: Sum of all shards
- **Total Disk Usage**: Aggregate disk consumption with percentage

### Auto-Refresh with Smart Caching

The dashboard automatically refreshes at configurable intervals to keep statistics current:

- **Configurable Refresh Rate**: Set refresh interval from 5 seconds to 1 minute, or disable auto-refresh
- **Smart Caching**: Cache duration automatically calculated as 1.5x refresh interval for optimal performance
- **Manual Refresh**: Click the refresh button to update data immediately
- **Loading States**: Skeleton loaders show while data is being fetched

### Cluster Selection

Click on any cluster in the table to navigate to the [Cluster Details](/features/cluster-details) page where you can explore nodes, indices, and perform management operations.

### Prometheus Metrics Integration

The dashboard integrates with Prometheus to provide historical metrics and trending data:

- **Time Range Selection**: Choose from preset ranges (last 24 hours, 7 days, custom)
- **Historical Trends**: View how cluster metrics have changed over time
- **Metrics Aggregation**: See aggregated metrics across all clusters

## Performance Optimizations

### Client-Side Caching

- **React Query Cache**: Uses React Query for intelligent data caching
- **Stale Time**: Data marked as stale after cache duration expires
- **GC Time**: Cached data automatically cleaned up after extended periods
- **Deduplication**: Multiple requests for same data are deduplicated

### Efficient Data Loading

- **Skeleton Loaders**: Visual feedback during data loading
- **Parallel Fetching**: Cluster stats fetched in parallel for faster loading
- **Error Handling**: Graceful handling of unreachable clusters

## What's Next

Once you've identified a cluster to manage, proceed to [Cluster Details](/features/cluster-details) to explore nodes, indices, and other cluster-specific features.
