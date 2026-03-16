//! Instrumented Elasticsearch client
//!
//! This module provides tracing for Elasticsearch client operations
//! by wrapping the existing client with instrumentation.

use anyhow::Result;
use axum::http::Method;
use serde_json::Value;

/// Trait for instrumented Elasticsearch client operations
///
/// This trait extends the existing Elasticsearch client to add
/// OpenTelemetry tracing to all ES operations.
pub trait InstrumentedElasticsearchClient {
    /// Make an instrumented request to ES
    ///
    /// Creates a child span for the ES operation with appropriate
    /// attributes and injects trace context into the request.
    async fn instrumented_request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        cluster_id: &str,
    ) -> Result<reqwest::Response>;
}

// TODO: Implement the trait for the existing Client in Task 6
