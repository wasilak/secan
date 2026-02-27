---
title: Index Management
description: Create, modify, and delete Elasticsearch indices
slug: 1.2/features/index-management
---

## Index Management

The Index Management features allow you to create, configure, and maintain Elasticsearch indices.

## Index Operations

### Create Index

Create new indices with custom settings:

* **Index Name**: Set the index identifier
* **Shards**: Configure primary shard count
* **Replicas**: Set replica configuration
* **Settings**: Custom index settings (refresh interval, merge settings, etc.)
* **Mappings**: Define field mappings and types

### Modify Index

Change existing index configuration:

* **Index Settings**: Modify refresh intervals, merge policies, and other settings
* **Aliases**: Add or remove index aliases
* **Mappings**: Update field mappings (with compatibility checking)

### Delete Index

Remove indices from the cluster. Requires confirmation to prevent accidental deletion.

## Index Information Tabs

When viewing an index, you can access several tabs:

### Settings Tab

View and edit index settings:

* Number of shards and replicas
* Refresh interval
* Merge policies
* Analysis settings
* Other index configuration

### Mappings Tab

View field mappings and types:

* Field names and data types
* Field properties and analyzers
* Nested fields and objects
* Dynamic mapping settings

### Statistics Tab

View index metrics:

* Document count
* Index size
* Segment count
* Merge activity

## Best Practices

* Always create indices with appropriate replication for high availability
* Use aliases for zero-downtime index updates
* Monitor index size and segment count regularly
* Archive or delete old indices to manage cluster size

## Related Features

* [Cluster Details](/1.2/features/cluster-details/) - View all indices in a cluster
* [Shard Management](/1.2/features/shard-management/) - Manage shard allocation
* [REST Console](/1.2/features/rest-console/) - Execute custom Elasticsearch queries
