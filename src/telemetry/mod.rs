//! OpenTelemetry telemetry module for Secan
//!
//! This module provides distributed tracing capabilities for the application.
//! Tracing is opt-in and disabled by default to ensure zero overhead when not needed.
//!
//! # Configuration
//!
//! Telemetry is configured via standard OpenTelemetry environment variables:
//! - `OTEL_SDK_DISABLED=true` - Disable telemetry (default: enabled)
//! - `OTEL_SERVICE_NAME` - Service name in traces (default: "secan")
//! - `OTEL_EXPORTER_OTLP_ENDPOINT` - OTLP collector URL
//! - `OTEL_EXPORTER_OTLP_PROTOCOL` - "grpc" or "http/protobuf"
//! - `OTEL_TRACES_SAMPLER` - Sampling strategy
//!
//! # Usage
//!
//! ```rust
//! // Initialize telemetry at application startup
//! let _telemetry_guard = telemetry::init_telemetry();
//!
//! // Tracing happens automatically via middleware
//! // Spans are created for HTTP requests and ES operations
//! ```

pub mod config;
pub mod exporter;
pub mod middleware;
pub mod client;

pub use config::{TelemetryConfig, OtlpProtocol, BatchConfig, SamplerConfig};

use anyhow::Result;
use std::sync::Arc;

/// Guard that keeps the telemetry runtime alive
///
/// This guard must be held for the lifetime of the application.
/// When dropped, the telemetry provider is shut down.
pub struct TelemetryGuard {
    _provider: Option<Arc<opentelemetry_sdk::trace::TracerProvider>>,
}

impl TelemetryGuard {
    fn new(provider: Option<Arc<opentelemetry_sdk::trace::TracerProvider>>) -> Self {
        Self { _provider: provider }
    }
}

/// Initialize telemetry with configuration from environment
///
/// Returns `Some(TelemetryGuard)` if telemetry is enabled, `None` if disabled.
/// The guard must be kept alive for the duration of the application.
///
/// # Example
///
/// ```rust
/// fn main() {
///     let _telemetry_guard = telemetry::init_telemetry();
///     
///     // Run your application
///     // Telemetry is active as long as _telemetry_guard is in scope
/// }
/// ```
pub fn init_telemetry() -> Option<TelemetryGuard> {
    match init_telemetry_inner() {
        Ok(guard) => guard,
        Err(e) => {
            tracing::error!("Failed to initialize telemetry: {}", e);
            None
        }
    }
}

fn init_telemetry_inner() -> Result<Option<TelemetryGuard>> {
    let config = TelemetryConfig::from_env()
        .context("Failed to parse telemetry configuration")?;

    if !config.enabled {
        tracing::info!("Telemetry is disabled via OTEL_SDK_DISABLED");
        return Ok(None);
    }

    tracing::info!(
        service_name = %config.service_name,
        service_version = %config.service_version,
        otlp_endpoint = %config.otlp_endpoint,
        otlp_protocol = ?config.otlp_protocol,
        "Initializing OpenTelemetry telemetry"
    );

    // Initialize tracer provider
    let provider = exporter::init_tracer_provider(&config)
        .context("Failed to initialize tracer provider")?;

    // Create guard to keep provider alive
    let guard = TelemetryGuard::new(Some(Arc::new(provider)));

    tracing::info!("OpenTelemetry telemetry initialized successfully");

    Ok(Some(guard))
}

/// Check if telemetry is enabled
pub fn is_telemetry_enabled() -> bool {
    TelemetryConfig::from_env()
        .map(|c| c.enabled)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_telemetry_guard_creation() {
        let guard = TelemetryGuard::new(None);
        // Guard should be created successfully
        drop(guard);
    }

    #[test]
    fn test_is_telemetry_enabled() {
        // This test depends on environment variables
        // In CI, telemetry should be disabled by default
        let enabled = is_telemetry_enabled();
        // Just verify the function doesn't panic
        let _ = enabled;
    }
}
