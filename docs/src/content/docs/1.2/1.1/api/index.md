---
title: API Reference
description: Rust API documentation for Secan
slug: 1.2/1.1/api
---

## Rust API Documentation

Secan's backend is written in Rust using the Axum web framework. The complete API documentation is automatically generated from source code comments using rustdoc.

## Key Modules

### [Config Module](/1.2/1.1/api/secan/config/index.html)

Application configuration system:

* `Config` - Main configuration structure
* `ServerConfig` - Server bind address and port settings
* `AuthConfig` - Authentication mode configuration
* `ClusterConfig` - Elasticsearch cluster definitions
* `CacheConfig` - Caching options

```rust
pub struct Config {
    pub server: ServerConfig,
    pub auth: AuthConfig,
    pub clusters: Vec<ClusterConfig>,
    pub cache: CacheConfig,
}
```

### [Auth Module](/1.2/1.1/api/secan/auth/index.html)

Authentication and authorization system:

* `LocalAuthProvider` - Local user authentication with bcrypt
* `OidcAuthProvider` - OpenID Connect provider integration
* `SessionManager` - Session lifecycle management
* `RbacManager` - Role-based access control
* `RateLimiter` - Login attempt rate limiting

Support for three authentication modes:

* Open (no authentication)
* Local users with password hashing
* OIDC integration with external providers

### [Cluster Module](/1.2/1.1/api/secan/cluster/index.html)

Elasticsearch cluster communication:

* `Client` / `ElasticsearchClient` - Low-level HTTP client for Elasticsearch
* `Manager` - High-level cluster operations (health checks, node info, index management)
* `ClusterConnection` - Per-cluster connection management
* `HealthStatus` - Cluster health state representation

### [Routes Module](/1.2/1.1/api/secan/routes/index.html)

HTTP API endpoints (REST handlers):

* `auth` - Authentication endpoints (login, logout, OIDC callback)
* `clusters` - Cluster management API
* `health` - Health check endpoint
* `static_assets` - Frontend asset serving

### [Cache Module](/1.2/1.1/api/secan/cache/index.html)

Metadata caching for performance:

* Cluster information cache
* Node statistics cache
* Index metadata cache
* Configurable cache TTL

### [Server Module](/1.2/1.1/api/secan/server/index.html)

Server initialization and configuration:

* `Server` - HTTP server setup and startup
* Middleware configuration (CORS, compression, logging)
* Route registration
* Graceful shutdown handling

### [TLS Module](/1.2/1.1/api/secan/tls/index.html)

HTTPS and certificate management:

* TLS configuration from PEM files
* Certificate validation
* Secure connection setup

## Navigating the Documentation

The full API documentation is generated using Rust's standard `rustdoc` tool. To explore:

1. **Browse modules** - Each module has submodules and public items listed
2. **Search** - Use the search function to find specific types or functions
3. **View source** - Click "source" links to see implementation details
4. **Read docstrings** - Each public item has documentation with examples

## Building Docs Locally

Generate documentation on your machine:

```bash
cargo doc --no-deps --open
```

This opens the documentation in your default browser at `target/doc/secan/index.html`.

## Code Examples

The Rust API documentation includes examples for common operations:

```rust
// Example: Loading configuration
use secan::Config;

let config = Config::load("config.yaml")?;
println!("Server runs on {}:{}", config.server.host, config.server.port);
```

## Common Tasks

### Managing Clusters

See the [Cluster Module](/1.2/1.1/api/secan/cluster/index.html) for operations like:

* Connecting to clusters
* Getting cluster health
* Listing nodes
* Querying index information

### Authentication

See the [Auth Module](/1.2/1.1/api/secan/auth/index.html) for:

* User verification
* Session management
* RBAC evaluation
* Rate limiting

### Configuration

See the [Config Module](/1.2/1.1/api/secan/config/index.html) for:

* Loading from YAML
* Applying environment variables
* Validating settings

## For Developers

If you're extending Secan or building tools that integrate with it:

1. Read the [Config Module](/1.2/1.1/api/secan/config/index.html) to understand configuration loading
2. Check the [Routes Module](/1.2/1.1/api/secan/routes/index.html) to see existing API endpoints
3. Review the [Cluster Module](/1.2/1.1/api/secan/cluster/index.html) for cluster communication patterns
4. Examine [Auth Module](/1.2/1.1/api/secan/auth/index.html) for authentication integration

## Updates

The API documentation is automatically regenerated on each code change and deployed with the documentation site. Always check this reference for the latest API.

***

**Note**: The Rust API is internal and may change between versions. If you depend on Secan's Rust libraries, pin specific versions in your Cargo.toml.
