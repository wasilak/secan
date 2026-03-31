//! Instrumented Elasticsearch client
//!
//! This module provides tracing for Elasticsearch client operations
//! using the tracing crate with OpenTelemetry integration.

use crate::cluster::client::{Client, ElasticsearchClient};
use anyhow::Result;
use async_trait::async_trait;
use reqwest::{Method, Response};
use serde_json::Value;
use tracing::instrument;

/// Extension trait to add instrumentation to ES client operations
///
/// This trait provides methods that wrap ES operations with tracing spans
/// that are automatically exported via OpenTelemetry.
#[async_trait]
pub trait InstrumentedElasticsearchClient: ElasticsearchClient {
    /// Execute an instrumented request against Elasticsearch
    ///
    /// Creates a child span for the ES operation with appropriate attributes.
    /// The span will automatically be parented to the current tracing span.
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
    #[instrument(
        skip(self, body),
        fields(
            db.system = "elasticsearch",
            db.operation = %extract_operation_name(path),
            elasticsearch.cluster_id = %cluster_id,
            http.method = %method,
        )
    )]
    async fn instrumented_request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
        cluster_id: &str,
    ) -> Result<Response> {
        let _operation = extract_operation_name(path);
        let full_url = format!("{}{}", self.base_url(), path);

        // Execute the request
        let result = self.request(method, path, body.clone()).await;

        // Record response attributes or errors using tracing
        match &result {
            Ok(response) => {
                let status = response.status();
                tracing::Span::current().record("http.status_code", status.as_u16() as i64);

                if let Some(content_length) = response.content_length() {
                    tracing::Span::current()
                        .record("http.response_content_length", content_length as i64);
                }

                if status.is_server_error() || status.is_client_error() {
                    tracing::error!(
                        status = %status,
                        cluster_id = %cluster_id,
                        url = %full_url,
                        "ES request failed with HTTP error"
                    );
                }
            }
            Err(e) => {
                tracing::error!(
                    error = %e,
                    cluster_id = %cluster_id,
                    url = %full_url,
                    "ES request failed"
                );
            }
        }

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

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

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
}
