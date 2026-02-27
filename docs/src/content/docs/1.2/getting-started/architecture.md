---
title: Architecture Overview
description: Technical architecture of Secan, showing how components interact
slug: 1.2/getting-started/architecture
---

## System Architecture

Secan follows a modern client-server architecture designed for efficient Elasticsearch cluster management.

```mermaid
graph TB
    subgraph Client["Browser / Client"]
        UI["React Frontend<br/>Dashboard & UI"]
    end
    
    subgraph Backend["Backend Server"]
        Router["HTTP Router<br/>&Middleware"]
        API["REST API<br/>Endpoints"]
        Auth["Authentication<br/>& Authorization"]
        Cache["Caching Layer<br/>Performance"]
    end
    
    subgraph ES["Elasticsearch Cluster"]
        Node1["ES Node 1<br/>Primary"]
        Node2["ES Node 2<br/>Replica"]
        Node3["ES Node 3<br/>Data"]
    end
    
    UI -->|HTTP/WebSocket| Router
    Router --> Auth
    Auth -->|Authenticated Request| API
    API --> Cache
    Cache -->|Query Results| API
    API -->|REST API Calls| ES
    ES -->|Cluster Status<br/>Index Data<br/>Shard Info| API
    API -->|JSON Response| Router
    Router -->|Update UI| UI
    
    style Client fill:#3b82f6,stroke:#1e40af,color:#fff
    style Backend fill:#10b981,stroke:#065f46,color:#fff
    style ES fill:#f59e0b,stroke:#92400e,color:#fff
```

## Component Breakdown

### Frontend (React)

* **Dashboard**: Visual overview of cluster health and metrics
* **Cluster Management**: View and manage cluster settings
* **Index Management**: Create, delete, and configure indices
* **Shard Management**: Monitor and manage shard allocation
* **REST Console**: Interactive API exploration tool

### Backend (Rust)

* **HTTP Server**: High-performance Actix-web server
* **Authentication**: Support for multiple auth methods (Basic, OAuth, API Keys)
* **Request Routing**: Intelligent routing to appropriate handlers
* **Caching**: Intelligent caching for frequently accessed data
* **API Proxying**: Secure communication with Elasticsearch clusters

### Elasticsearch Cluster

* **Nodes**: Multiple nodes for redundancy and scalability
* **Shards**: Distributed data storage and processing
* **Replicas**: Data redundancy and fault tolerance
* **Indices**: Organized data structures for efficient querying

## Data Flow

1. **User Interaction**: User interacts with React frontend
2. **HTTP Request**: Frontend sends HTTP request to backend
3. **Authentication**: Backend validates user credentials/tokens
4. **Request Processing**: Backend routes request to appropriate handler
5. **Elasticsearch Query**: Backend queries Elasticsearch cluster
6. **Response Processing**: Backend processes and caches response
7. **UI Update**: Frontend receives response and updates UI

## Security Architecture

* **Authentication Layer**: Protects backend endpoints
* **Encryption**: HTTPS for data in transit
* **Token-based Auth**: Support for JWT and API keys
* **Request Validation**: Input validation on all endpoints
* **Audit Logging**: Track all administrative actions

## Scalability Features

* **Stateless Backend**: Easy horizontal scaling
* **Connection Pooling**: Efficient resource utilization
* **Request Caching**: Reduced load on Elasticsearch
* **Multi-cluster Support**: Manage multiple Elasticsearch clusters
* **Async Processing**: Non-blocking operations for better throughput
