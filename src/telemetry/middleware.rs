//! Axum HTTP middleware for OpenTelemetry tracing
//!
//! This module provides middleware that automatically creates spans
//! for incoming HTTP requests and extracts trace context.

use axum::http::Request;

/// Create OTel HTTP layer for Axum
///
/// This layer creates spans for each incoming HTTP request and
/// extracts trace context from the traceparent header.
pub fn otel_http_layer() {
    // TODO: Implement in Task 5
    todo!("OTel HTTP middleware implementation pending")
}

/// MakeSpan implementation for creating OTel-compatible spans
#[derive(Clone)]
pub struct OtelMakeSpan;

impl<B> tower_http::trace::MakeSpan<B> for OtelMakeSpan {
    fn make_span(&mut self, request: &Request<B>) -> tracing::Span {
        // TODO: Implement in Task 5
        tracing::info_span!("http_request")
    }
}
