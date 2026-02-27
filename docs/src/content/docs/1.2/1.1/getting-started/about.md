---
title: About Secan
description: Understanding Secan - a modern Elasticsearch cluster management tool
slug: 1.2/1.1/getting-started/about
---

## What is Secan?

**Secan** (Old English: *sēcan* - to seek, to inquire) is a modern, lightweight web-based Elasticsearch cluster management tool built with Rust and React.

It provides a responsive, full-width interface for managing Elasticsearch clusters with features including:

* **Cluster Monitoring**: Real-time health status, node statistics, and index metrics
* **Index Management**: Create, delete, and modify indices with visual feedback
* **Shard Management**: Interactive grid-based shard allocation and relocation
* **REST Console**: Execute Elasticsearch queries directly from the UI
* **Multi-cluster Support**: Manage multiple Elasticsearch clusters from a single interface
* **Multiple Authentication Modes**: Open mode, local users, and OIDC support

## Technology Stack

* **Backend**: Rust with Axum web framework
* **Frontend**: React 18 with TypeScript
* **Deployment**: Single binary with embedded frontend assets
* **Containerization**: Docker and Kubernetes ready

## Key Features

### Single Binary Deployment

Secan compiles to a single, self-contained binary that includes all frontend assets. No additional dependencies required at runtime.

### No External Dependencies

Works with Elasticsearch 7.x, 8.x, 9.x, and OpenSearch. No external services or databases needed.

### Modern UI

Built with React and Mantine components for a clean, responsive interface optimized for modern displays.

### Heavily Inspired by Cerebro

Secan builds upon the foundation of [Cerebro](https://github.com/lmenezes/cerebro), the original Elasticsearch web admin tool, modernizing it for current technology stacks and user expectations.

## Who Should Use Secan?

* Elasticsearch cluster operators who need web-based cluster management
* Teams managing multiple Elasticsearch clusters
* Users who prefer a modern interface over command-line tools
* Organizations running Elasticsearch in Docker or Kubernetes

## Requirements

* No runtime dependencies (single binary)
* Elasticsearch/OpenSearch 7.x, 8.x, or 9.x

## Next Steps

Ready to get started? Check out the [Installation guide](/1.2/1.1/getting-started/installation/) to download and run Secan.
