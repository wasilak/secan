//! Custom Axum middleware for OpenTelemetry tracing
//!
//! This middleware uses direct OpenTelemetry API for reliable span export.

use axum::extract::MatchedPath;
use axum::http::{Request, Response};
use opentelemetry::trace::{Span, Tracer, TracerProvider};
use std::future::Future;
use std::pin::Pin;
use std::task::{Context, Poll};
use std::time::Instant;
use tower::{Layer, Service};

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

    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> {
        self.inner.poll_ready(cx)
    }

    fn call(&mut self, request: Request<B>) -> Self::Future {
        // Get route info
        let route = request
            .extensions()
            .get::<MatchedPath>()
            .map(|mp| mp.as_str())
            .unwrap_or("unknown");

        // Create the OTel span directly (this exports reliably)
        let tracer = opentelemetry::global::tracer("secan-http");
        let mut span = tracer.start(format!("{} {}", request.method(), route));

        // Set span attributes
        span.set_attribute(opentelemetry::KeyValue::new(
            "http.method",
            request.method().to_string(),
        ));
        span.set_attribute(opentelemetry::KeyValue::new(
            "http.route",
            route.to_string(),
        ));
        span.set_attribute(opentelemetry::KeyValue::new(
            "http.target",
            request.uri().path().to_string(),
        ));
        span.set_attribute(opentelemetry::KeyValue::new("otel.kind", "server"));

        let start = Instant::now();
        let method = request.method().to_string();
        let path = request.uri().path().to_string();

        // Call the inner service
        let future = self.inner.call(request);

        Box::pin(async move {
            let result = future.await;
            let latency = start.elapsed();

            // Record response info
            if let Ok(response) = &result {
                span.set_attribute(opentelemetry::KeyValue::new(
                    "http.status_code",
                    response.status().as_u16() as i64,
                ));
            }

            // End the span (this triggers export)
            span.end();

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
