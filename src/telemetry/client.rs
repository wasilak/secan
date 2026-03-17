//! Instrumented Elasticsearch client
//!
//! This module provides tracing for Elasticsearch client operations
//! by wrapping the existing client with instrumentation using direct OTel API.

use crate::cluster::client::{Client, ElasticsearchClient};
use anyhow::Result;
use async_trait::async_trait;
use opentelemetry::trace::{Span, Tracer, TracerProvider};
use reqwest::{Method, Response};
use serde_json::Value;

/// Extension trait to add instrumentation to ES client operations
///
/// This trait provides methods that wrap ES operations with OpenTelemetry spans
/// and proper trace context propagation.
#[async_trait]
pub trait InstrumentedElasticsearchClient: ElasticsearchClient {
    /// Execute an instrumented request against Elasticsearch
    ///
    /// Creates a child span for the ES operation with appropriate attributes
    /// and injects the trace context into the request headers.
    async fn instrumented_request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        cluster_id: &str,
    ) -> Result<Response>;
}

#[async_trait]
impl InstrumentedElasticsearchClient for Client {
    async fn instrumented_request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        cluster_id: &str,
    ) -> Result<Response> {
        // Extract the operation name from the path
        let operation = extract_operation_name(path);

        // Create OTel span directly (reliable export)
        let tracer = opentelemetry::global::tracer("secan-elasticsearch");
        let mut span = tracer.start(format!("ES {}", operation));

        // Set span attributes
        span.set_attribute(opentelemetry::KeyValue::new("db.system", "elasticsearch"));
        span.set_attribute(opentelemetry::KeyValue::new(
            "db.operation",
            operation.clone(),
        ));
        span.set_attribute(opentelemetry::KeyValue::new(
            "elasticsearch.cluster_id",
            cluster_id.to_string(),
        ));
        span.set_attribute(opentelemetry::KeyValue::new(
            "http.method",
            method.to_string(),
        ));

        // Build the full URL
        let base_url = self.base_url();
        let full_url = format!("{}{}", base_url, path);
        span.set_attribute(opentelemetry::KeyValue::new("http.url", full_url.clone()));

        // Record the statement if body is present (truncated)
        if let Some(ref b) = body {
            let statement = truncate_statement(b);
            span.set_attribute(opentelemetry::KeyValue::new("db.statement", statement));
        }

        // Execute the request
        let result = self.request(method, path, body).await;

        // Record response attributes or errors
        match &result {
            Ok(response) => {
                let status = response.status();
                span.set_attribute(opentelemetry::KeyValue::new(
                    "http.status_code",
                    status.as_u16() as i64,
                ));

                if let Some(content_length) = response.content_length() {
                    span.set_attribute(opentelemetry::KeyValue::new(
                        "http.response_content_length",
                        content_length as i64,
                    ));
                }

                if status.is_server_error() || status.is_client_error() {
                    span.set_attribute(opentelemetry::KeyValue::new("error.type", "http_error"));
                    span.set_attribute(opentelemetry::KeyValue::new(
                        "error.message",
                        format!("HTTP {}", status),
                    ));
                }
            }
            Err(e) => {
                span.set_attribute(opentelemetry::KeyValue::new("error.type", "request_failed"));
                span.set_attribute(opentelemetry::KeyValue::new("error.message", e.to_string()));
            }
        }

        // End the span (triggers export)
        span.end();

        result
    }
}

/// Extract operation name from ES path
///
/// Examples:
/// - "/_cluster/health" -> "_cluster/health"
/// - "/index/_search" -> "_search"
/// - "/_cat/indices" -> "_cat/indices"
fn extract_operation_name(path: &str) -> String {
    // Remove leading slash
    let path = path.trim_start_matches('/');

    // Split by query string
    let path = path.split('?').next().unwrap_or(path);

    // Extract the operation part (usually the last segment)
    let segments: Vec<&str> = path.split('/').collect();

    // For paths like _cluster/health, return the full API path
    // For paths like index/_search, return _search
    if segments.len() >= 2 && segments[0].starts_with('_') {
        // API path like _cluster/health, _cat/indices
        segments[..2.min(segments.len())].join("/")
    } else if let Some(last) = segments.last() {
        // Return the last segment (usually the operation)
        last.to_string()
    } else {
        path.to_string()
    }
}

/// Truncate statement for span attribute
///
/// Limits the size to avoid large payloads in traces
fn truncate_statement(body: &Value) -> String {
    let json = body.to_string();
    const MAX_LENGTH: usize = 1000;

    if json.len() > MAX_LENGTH {
        format!(
            "{}... [truncated, {} bytes total]",
            &json[..MAX_LENGTH],
            json.len()
        )
    } else {
        json
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_extract_operation_name() {
        assert_eq!(
            extract_operation_name("/_cluster/health"),
            "_cluster/health"
        );
        assert_eq!(extract_operation_name("/index/_search"), "_search");
        assert_eq!(extract_operation_name("/_cat/indices"), "_cat/indices");
        assert_eq!(extract_operation_name("/_nodes/stats"), "_nodes/stats");
        assert_eq!(
            extract_operation_name("/_cluster/health?level=indices"),
            "_cluster/health"
        );
    }

    #[test]
    fn test_truncate_statement() {
        let small_body = json!({"query": {"match_all": {}}});
        let result = truncate_statement(&small_body);
        assert!(result.contains("query"));
        assert!(!result.contains("truncated"));

        let large_body = json!({"large_field": "x".repeat(2000)});
        let result = truncate_statement(&large_body);
        assert!(result.contains("truncated"));
    }
}
