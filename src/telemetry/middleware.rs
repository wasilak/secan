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

        tracing::info_span!(
            "http_request",
            otel.name = format!("{} {}", request.method(), route),
            http.method = %request.method(),
            http.route = route,
            http.target = %request.uri().path(),
            http.scheme = ?request.uri().scheme().unwrap_or(&axum::http::uri::Scheme::HTTP),
            http.host = ?request.headers().get(header::HOST).and_then(|v| v.to_str().ok()),
            http.status_code = field::Empty,
            http.response_content_length = field::Empty,
            otel.kind = "server",
        )
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

        // Explicitly log at info level within the span context to ensure it's recorded
        // This ensures the span gets the proper OTel treatment
        tracing::info!(
            parent: span,
            latency_ms = latency.as_millis(),
            status = %response.status(),
            "HTTP request completed"
        );
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
            .expect("build request body");

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
            .expect("build request body");

        let traceparent = extract_traceparent(&request);
        assert_eq!(traceparent, None);
    }
}
