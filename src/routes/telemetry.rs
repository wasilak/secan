//! OTLP Trace Proxy Endpoint
//!
//! This module provides an HTTP endpoint at `/v1/traces` that receives
//! OTLP trace export requests from the frontend and proxies them to the
//! OTLP collector. This allows the browser to send traces via HTTP while
//! the backend can use gRPC for better performance to the collector.
//!
//! ## Architecture
//!
//! ```text
//! Frontend (Browser) → POST /v1/traces → Backend Proxy → OTLP Collector
//!         HTTP                HTTP              gRPC/HTTP
//! ```
//!
//! ## Benefits
//!
//! - Browser-compatible HTTP endpoint (avoids CORS issues with same-origin)
//! - Backend can use gRPC for better performance to collector
//! - Centralized authentication (backend adds collector auth headers)
//! - Consistent error handling and logging

use axum::{
    body::Bytes,
    extract::State,
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    routing::post,
    Router,
};
use std::sync::Arc;
use tracing::{debug, error, warn};

/// State for the OTLP proxy endpoint
#[derive(Clone)]
pub struct OtelProxyState {
    /// The OTLP collector endpoint URL
    collector_endpoint: String,
    /// Optional authentication headers for the collector
    collector_headers: Vec<(String, String)>,
    /// HTTP client for forwarding requests
    http_client: reqwest::Client,
}

impl OtelProxyState {
    /// Create new proxy state from telemetry configuration
    pub fn new(collector_endpoint: String, collector_headers: Vec<(String, String)>) -> Self {
        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client for OTLP proxy");

        // Ensure endpoint ends with /v1/traces
        let collector_endpoint = if collector_endpoint.ends_with("/v1/traces") {
            collector_endpoint
        } else if collector_endpoint.ends_with('/') {
            format!("{}v1/traces", collector_endpoint)
        } else {
            format!("{}/v1/traces", collector_endpoint)
        };

        Self {
            collector_endpoint,
            collector_headers,
            http_client,
        }
    }
}

/// OTLP trace export endpoint
///
/// Receives OTLP/HTTP trace export requests and forwards them to the collector.
/// This endpoint accepts binary protobuf format (application/x-protobuf).
pub async fn trace_export_handler(
    State(state): State<Arc<OtelProxyState>>,
    headers: HeaderMap,
    body: Bytes,
) -> impl IntoResponse {
    debug!(body_size = body.len(), "Received OTLP trace export request");

    // Check content type
    let content_type = headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("application/x-protobuf");

    if !content_type.contains("application/x-protobuf") {
        warn!("Invalid content type: {}", content_type);
        return (
            StatusCode::UNSUPPORTED_MEDIA_TYPE,
            "Only application/x-protobuf is supported",
        );
    }

    // Forward the request to the collector
    match forward_to_collector(&state, body, content_type).await {
        Ok(status) => {
            debug!("Successfully forwarded traces to collector");
            (status, "")
        }
        Err(e) => {
            error!("Failed to forward traces to collector: {}", e);
            (
                StatusCode::SERVICE_UNAVAILABLE,
                "Failed to forward to collector",
            )
        }
    }
}

/// Forward trace data to the OTLP collector
async fn forward_to_collector(
    state: &OtelProxyState,
    body: Bytes,
    content_type: &str,
) -> Result<StatusCode, Box<dyn std::error::Error>> {
    let mut request = state
        .http_client
        .post(&state.collector_endpoint)
        .header("Content-Type", content_type);

    // Add authentication headers if configured
    for (key, value) in &state.collector_headers {
        request = request.header(key, value);
    }

    // Send the request
    let response = request.body(body).send().await?;

    let status = response.status();

    // Log the response
    if status.is_success() {
        debug!("Collector accepted traces: {}", status);
    } else {
        let body_text = response.text().await.unwrap_or_default();
        warn!(
            status = %status,
            body = %body_text,
            "Collector returned error"
        );
    }

    // Map collector status to our response status
    let axum_status =
        StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

    Ok(axum_status)
}

/// Create the OTLP proxy router
pub fn create_otlp_proxy_router(
    collector_endpoint: String,
    collector_headers: Vec<(String, String)>,
) -> Router {
    let state = Arc::new(OtelProxyState::new(collector_endpoint, collector_headers));

    Router::new()
        .route("/v1/traces", post(trace_export_handler))
        .with_state(state)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_otel_proxy_state_new() {
        // Test endpoint normalization
        let state1 = OtelProxyState::new("http://localhost:4318".to_string(), vec![]);
        assert_eq!(state1.collector_endpoint, "http://localhost:4318/v1/traces");

        let state2 = OtelProxyState::new("http://localhost:4318/".to_string(), vec![]);
        assert_eq!(state2.collector_endpoint, "http://localhost:4318/v1/traces");

        let state3 = OtelProxyState::new("http://localhost:4318/v1/traces".to_string(), vec![]);
        assert_eq!(state3.collector_endpoint, "http://localhost:4318/v1/traces");
    }
}
