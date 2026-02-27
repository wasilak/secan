---
title: Dashboard & Overview
description: Global cluster overview and cross-cluster monitoring
slug: 1.2/1.1/1.0/features/dashboard
---

## Dashboard Overview

The Secan dashboard provides a high-level overview of all configured clusters, allowing you to quickly assess the health and status of your Elasticsearch infrastructure.

## Dashboard Features

### Cluster List

The dashboard displays all your configured clusters in a table with the following information:

* **Cluster Name**: Display name of the cluster
* **Health Status**: Current cluster health (green, yellow, red, or unreachable)
* **Node Count**: Number of nodes in the cluster
* **Shard Count**: Total shards across all indices
* **Index Count**: Number of indices in the cluster
* **Document Count**: Total documents across all indices

### Health Status Colors

* **Green**: All shards are allocated and cluster is healthy
* **Yellow**: All primary shards are allocated, but some replicas are missing
* **Red**: One or more primary shards are unallocated
* **Unreachable**: Cannot connect to the cluster

### Auto-Refresh

The dashboard automatically refreshes at configurable intervals to keep statistics current. You can adjust the refresh rate in the settings.

### Cluster Selection

Click on any cluster in the table to navigate to the [Cluster Details](/1.2/1.1/1.0/features/cluster-details/) page where you can explore nodes, indices, and perform management operations.

## What's Next

Once you've identified a cluster to manage, proceed to [Cluster Details](/1.2/1.1/1.0/features/cluster-details/) to explore nodes, indices, and other cluster-specific features.
