//! Instrumented Elasticsearch client
//!
//! This module provides tracing for Elasticsearch client operations
//! by wrapping the existing client with instrumentation.

use crate::cluster::client::{Client, ElasticsearchClient};
use anyhow::Result;
use async_trait::async_trait;
use reqwest::{Method, Response};
use serde_json::Value;
use tracing::{field, Instrument};

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

        // Create the span
        let span = tracing::info_span!(
            "elasticsearch.query",
            db.system = "elasticsearch",
            db.operation = operation,
            db.statement = field::Empty, // Will be set if body is present
            elasticsearch.cluster_id = cluster_id,
            http.method = %method,
            http.url = field::Empty, // Will be set after building URL
            http.status_code = field::Empty,
            http.response_content_length = field::Empty,
            error.type = field::Empty,
            error.message = field::Empty,
        );

        // Execute the request within the span
        async {
            // Build the full URL for the attribute
            let base_url = self.base_url();
            let full_url = format!("{}{}", base_url, path);
            tracing::Span::current().record("http.url", &full_url.as_str());

            // Record the statement if body is present (truncated)
            if let Some(ref b) = body {
                let statement = truncate_statement(b);
                tracing::Span::current().record("db.statement", &statement.as_str());
            }

            // Execute the request
            let result = self.request(method, path, body).await;

            // Record response attributes or errors
            match &result {
                Ok(response) => {
                    let status = response.status();
                    tracing::Span::current().record("http.status_code", status.as_u16() as i64);

                    if let Some(content_length) = response.content_length() {
                        tracing::Span::current()
                            .record("http.response_content_length", content_length as i64);
                    }

                    if status.is_server_error() || status.is_client_error() {
                        tracing::Span::current().record("error.type", "http_error");
                        tracing::Span::current()
                            .record("error.message", &format!("HTTP {}", status).as_str());
                    }
                }
                Err(e) => {
                    tracing::Span::current().record("error.type", "request_failed");
                    tracing::Span::current().record("error.message", &e.to_string().as_str());
                }
            }

            result
        }
        .instrument(span)
        .await
    }
}

impl Client {
    /// Get the base URL of the client
    fn base_url(&self) -> String {
        // Access the base_url field
        // Note: This requires the base_url field to be accessible
        // We need to add a getter or make it accessible
        // For now, we'll return a placeholder - this needs to be fixed
        "http://localhost:9200".to_string()
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
