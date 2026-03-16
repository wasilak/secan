//! Axum HTTP middleware for OpenTelemetry tracing
//!
//! This module provides middleware that automatically creates spans
//! for incoming HTTP requests and extracts trace context.

use axum::extract::MatchedPath;
use axum::http::{header, Request, Response};
use std::time::Duration;
use tracing::{field, Span};

/// Create OTel HTTP layer for Axum
///
/// This returns a Tower layer that creates spans for each HTTP request
/// and extracts trace context from the traceparent header.
pub fn otel_http_layer<B>() -> tower_http::trace::TraceLayer<
    tower_http::classify::SharedClassifier<tower_http::classify::ServerErrorsAsFailures>,
    OtelMakeSpan,
    tower_http::trace::DefaultOnRequest,
    OtelOnResponse,
    tower_http::trace::DefaultOnBodyChunk,
    tower_http::trace::DefaultOnEos,
    tower_http::trace::DefaultOnFailure,
> {
    tower_http::trace::TraceLayer::new_for_http()
        .make_span_with(OtelMakeSpan)
        .on_response(OtelOnResponse)
}

/// MakeSpan implementation for creating OTel-compatible spans
#[derive(Clone, Copy)]
pub struct OtelMakeSpan;

impl<B> tower_http::trace::MakeSpan<B> for OtelMakeSpan {
    fn make_span(&mut self, request: &Request<B>) -> Span {
        // Get the matched path for the route pattern
        let route = request
            .extensions()
            .get::<MatchedPath>()
            .map(|mp| mp.as_str())
            .unwrap_or("unknown");

        // Extract trace context from headers if present
        let traceparent = request
            .headers()
            .get("traceparent")
            .and_then(|v| v.to_str().ok());

        let span = tracing::info_span!(
            "http_request",
            http.method = %request.method(),
            http.route = route,
            http.target = %request.uri().path(),
            http.scheme = ?request.uri().scheme().unwrap_or(&axum::http::uri::Scheme::HTTP),
            http.host = ?request.headers().get(header::HOST).and_then(|v| v.to_str().ok()),
            http.status_code = field::Empty,
            http.response_content_length = field::Empty,
            trace_id = field::Empty,
            span_id = field::Empty,
        );

        // If traceparent is present, log it for correlation
        if let Some(tp) = traceparent {
            tracing::debug!(parent: &span, traceparent = %tp, "Received trace context");
        }

        span
    }
}

/// OnResponse callback to add response attributes to the span
#[derive(Clone, Copy)]
pub struct OtelOnResponse;

impl<B> tower_http::trace::OnResponse<B> for OtelOnResponse {
    fn on_response(self, response: &Response<B>, latency: Duration, span: &Span) {
        // Record response attributes
        span.record("http.status_code", response.status().as_u16());

        if let Some(content_length) = response
            .headers()
            .get(header::CONTENT_LENGTH)
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<i64>().ok())
        {
            span.record("http.response_content_length", content_length);
        }

        // Log the request completion
        let status = response.status();
        if status.is_server_error() {
            tracing::error!(
                parent: span,
                latency_ms = latency.as_millis(),
                status = %status,
                "Request failed"
            );
        } else if status.is_client_error() {
            tracing::warn!(
                parent: span,
                latency_ms = latency.as_millis(),
                status = %status,
                "Request resulted in client error"
            );
        } else {
            tracing::info!(
                parent: span,
                latency_ms = latency.as_millis(),
                status = %status,
                "Request completed"
            );
        }
    }
}

/// Extract trace context from request headers
///
/// Returns the traceparent value if present
pub fn extract_traceparent<B>(request: &Request<B>) -> Option<&str> {
    request
        .headers()
        .get("traceparent")
        .and_then(|v| v.to_str().ok())
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    #[test]
    fn test_otel_make_span() {
        let request = Request::builder()
            .method("GET")
            .uri("/api/clusters")
            .header("host", "localhost:3000")
            .body(())
            .unwrap();

        let mut make_span = OtelMakeSpan;
        let span = make_span.make_span(&request);

        // Span should be created
        assert!(!span.is_disabled());
    }

    #[test]
    fn test_extract_traceparent() {
        let request = Request::builder()
            .method("GET")
            .uri("/test")
            .header(
                "traceparent",
                "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01",
            )
            .body(())
            .unwrap();

        let traceparent = extract_traceparent(&request);
        assert_eq!(
            traceparent,
            Some("00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01")
        );
    }

    #[test]
    fn test_extract_traceparent_missing() {
        let request = Request::builder()
            .method("GET")
            .uri("/test")
            .body(())
            .unwrap();

        let traceparent = extract_traceparent(&request);
        assert_eq!(traceparent, None);
    }
}
