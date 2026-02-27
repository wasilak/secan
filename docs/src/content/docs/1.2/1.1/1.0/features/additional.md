---
title: Additional Features
description: Templates, aliases, snapshots, repositories, and cluster settings
slug: 1.2/1.1/1.0/features/additional
---

## Additional Features

Beyond the core features, Secan provides access to other Elasticsearch management capabilities.

## Index Templates

Manage index templates that define settings and mappings for new indices:

* **View Templates**: Browse all index and component templates
* **Create Templates**: Define new templates with patterns and settings
* **Delete Templates**: Remove templates from the cluster
* **View Template Mappings**: See field definitions in templates

## Aliases

Manage index aliases for flexible index management:

* **View Aliases**: See all alias definitions
* **Create Aliases**: Create new aliases pointing to indices
* **Remove Aliases**: Delete alias associations
* **Multi-Index Aliases**: Create aliases spanning multiple indices

## Snapshots

Manage Elasticsearch snapshots for backup and recovery:

* **View Snapshots**: List all available snapshots with status
* **View Snapshot Details**: Repository, indices included, and timing information
* **Delete Snapshots**: Remove old snapshots to save space

## Repositories

Configure snapshot repositories where backups are stored:

* **View Repositories**: List all configured repositories
* **View Repository Settings**: Type, location, and configuration details
* **Register Repositories**: Add new snapshot repositories
* **Delete Repositories**: Remove repository configurations

## Cluster Settings

Access cluster-level configuration:

* **View Settings**: Current persistent and transient settings
* **Modify Settings**: Change cluster configuration
* **Reset Settings**: Revert transient settings to defaults

Common settings include:

* `cluster.max_shards_per_node`: Maximum shards per node limit
* `cluster.routing.allocation`: Shard allocation settings
* `indices.memory`: Memory-related index settings
* Authentication and security settings

## Category Tabs

When available in the UI, these features may be organized under tabs in the cluster view for easy access.

## Related Features

* [REST Console](/1.2/1.1/1.0/features/rest-console/) - Execute custom API calls for advanced management
* [Index Management](/1.2/1.1/1.0/features/index-management/) - Manage individual indices
* [Cluster Details](/1.2/1.1/1.0/features/cluster-details/) - View cluster status and nodes
