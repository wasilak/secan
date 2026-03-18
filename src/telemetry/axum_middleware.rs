//! Custom Axum middleware for OpenTelemetry tracing
//!
//! This middleware uses the tracing crate with OpenTelemetry integration
//! for proper async context propagation.

use axum::extract::MatchedPath;
use axum::http::{header, Request, Response};
use opentelemetry::propagation::TextMapPropagator;
use opentelemetry::trace::{SpanKind, TraceContextExt, Tracer};
use opentelemetry::Context;
use opentelemetry_sdk::propagation::TraceContextPropagator;
use std::future::Future;
use std::pin::Pin;
use std::task::{Context as TaskContext, Poll};
use std::time::Instant;
use tower::{Layer, Service};
use tracing_opentelemetry::OpenTelemetrySpanExt;

/// Extract trace context from request headers
fn extract_trace_context<B>(request: &Request<B>) -> Context {
    let propagator = TraceContextPropagator::new();
    let headers = request.headers();

    // Create a header extractor to read traceparent/tracestate
    struct HeaderExtractor<'a>(&'a header::HeaderMap);

    impl<'a> opentelemetry::propagation::Extractor for HeaderExtractor<'a> {
        fn get(&self, key: &str) -> Option<&str> {
            self.0.get(key).and_then(|v| v.to_str().ok())
        }

        fn keys(&self) -> Vec<&str> {
            self.0.keys().map(|k| k.as_str()).collect()
        }
    }

    let extractor = HeaderExtractor(headers);
    propagator.extract(&extractor)
}

/// Middleware that creates OTel spans for each request
#[derive(Clone)]
pub struct OtelTraceLayer;

impl<S> Layer<S> for OtelTraceLayer {
    type Service = OtelTraceMiddleware<S>;

    fn layer(&self, inner: S) -> Self::Service {
        OtelTraceMiddleware { inner }
    }
}

/// The middleware service
#[derive(Clone)]
pub struct OtelTraceMiddleware<S> {
    inner: S,
}

impl<S, B, ResBody> Service<Request<B>> for OtelTraceMiddleware<S>
where
    S: Service<Request<B>, Response = Response<ResBody>>,
    S::Future: Send + 'static,
{
    type Response = S::Response;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;

    fn poll_ready(&mut self, cx: &mut TaskContext<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request<B>) -> Self::Future {
        // Get route info
        let route = request
            .extensions()
            .get::<MatchedPath>()
            .map(|mp| mp.as_str())
            .unwrap_or("unknown");

        // Extract trace context from incoming request (if any)
        let parent_context = extract_trace_context(&request);

        // Create the OTel span with parent context
        let tracer = opentelemetry::global::tracer("secan-http");
        let span = tracer
            .span_builder(format!("{} {}", request.method(), route))
            .with_kind(SpanKind::Server)
            .start_with_context(&tracer, &parent_context);

        // Create a tracing span that wraps the OTel span
        let tracing_span = tracing::info_span!(
            "http_request",
            http.method = %request.method(),
            http.route = %route,
            http.target = %request.uri().path(),
        );

        // Set the OTel context on the tracing span
        let cx = parent_context.with_span(span);
        tracing_span.set_parent(cx);

        let start = Instant::now();
        let method = request.method().to_string();
        let path = request.uri().path().to_string();

        // Call the inner service
        let future = self.inner.call(request);

        Box::pin(async move {
            // Enter the tracing span - this sets the context for all child operations
            let _enter = tracing_span.enter();

            let result = future.await;
            let latency = start.elapsed();

            // Record response info
            if let Ok(response) = &result {
                tracing_span.record("http.status_code", response.status().as_u16() as i64);
            }

            // Also log via tracing for local visibility
            match &result {
                Ok(response) => {
                    tracing::info!(
                        latency_ms = latency.as_millis(),
                        status = %response.status(),
                        "HTTP {} {} completed",
                        method,
                        path
                    );
                }
                Err(_) => {
                    tracing::error!(
                        latency_ms = latency.as_millis(),
                        "HTTP {} {} failed",
                        method,
                        path
                    );
                }
            }

            result
        })
    }
}
