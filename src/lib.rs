#![doc = include_str!("../README.md")]

/// Embedded frontend assets management
///
/// Handles serving pre-built frontend assets (HTML, CSS, JavaScript) that are embedded
/// into the binary during compilation using rust-embed.
pub mod assets;

/// Authentication and authorization system
///
/// Provides multiple authentication modes including:
/// - Open mode (no authentication)
/// - Local users with bcrypt password hashing
/// - OpenID Connect (OIDC) integration
///
/// Also includes session management, rate limiting, and role-based access control (RBAC).
pub mod auth;

/// Cluster metadata caching
///
/// Implements efficient caching of cluster information such as nodes, indices, and health status.
/// Reduces repeated queries to Elasticsearch clusters.
pub mod cache;

/// Elasticsearch/OpenSearch cluster management
///
/// Provides clients and managers for communicating with Elasticsearch clusters.
/// Handles cluster discovery, health checks, and API interactions.
pub mod cluster;

/// Configuration system
///
/// Manages application configuration from YAML files and environment variables.
/// Supports server settings, authentication modes, cluster definitions, and caching options.
pub mod config;

/// HTTP middleware and cross-cutting concerns
///
/// Contains middleware for request/response processing, such as logging, error handling,
/// and CORS configuration.
pub mod middleware;

/// Metrics abstraction layer
///
/// Provides unified interface for metrics from multiple sources (internal Elasticsearch or Prometheus).
/// Supports time-range queries, metric aggregation, and health checks.
pub mod metrics;

/// Prometheus metrics client integration
///
/// Provides HTTP client for querying Prometheus instances and parsing time-series metrics.
/// Used as alternative metrics source for cluster monitoring.
pub mod prometheus;

/// HTTP API routes and handlers
///
/// Defines REST API endpoints for authentication, cluster management, index operations,
/// and health checks. Built with Axum web framework.
pub mod routes;

/// HTTP server setup and initialization
///
/// Configures and starts the Axum HTTP server with all routes, middleware, and handlers.
pub mod server;

/// TLS/HTTPS configuration
///
/// Manages TLS certificate loading and HTTPS configuration for secure connections.
pub mod tls;

// Re-export commonly used types
pub use config::Config;
pub use server::Server;
