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
//! ```rust,ignore
//! // Initialize telemetry at application startup
//! let _telemetry_guard = secan::telemetry::init_telemetry();
//!
//! // Tracing happens automatically via middleware
//! // Spans are created for HTTP requests and ES operations
//! ```

pub mod client;
pub mod config;
pub mod exporter;
pub mod middleware;

pub use config::{BatchConfig, OtlpProtocol, SamplerConfig, TelemetryConfig};

use anyhow::{Context, Result};
use opentelemetry::global;
use opentelemetry::trace::TracerProvider;
use tracing_subscriber::layer::SubscriberExt;
use tracing_subscriber::util::SubscriberInitExt;
use tracing_subscriber::EnvFilter;

/// Guard that keeps the telemetry runtime alive
///
/// This guard must be held for the lifetime of the application.
/// When dropped, the telemetry provider is shut down.
pub struct TelemetryGuard {
    #[allow(dead_code)]
    provider: Option<opentelemetry_sdk::trace::SdkTracerProvider>,
}

impl Drop for TelemetryGuard {
    fn drop(&mut self) {
        // In version 0.29, we need to handle cleanup differently
        // The provider will be dropped when the guard is dropped
        tracing::info!("OpenTelemetry telemetry shut down");
    }
}

/// Initialize telemetry with configuration from environment
///
/// Returns `Some(TelemetryGuard)` if telemetry is enabled, `None` if disabled.
/// The guard must be kept alive for the duration of the application.
///
/// # Example
///
/// ```rust,ignore
/// fn main() {
///     let _telemetry_guard = secan::telemetry::init_telemetry();
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
    let config = TelemetryConfig::from_env().context("Failed to parse telemetry configuration")?;

    if !config.enabled {
        tracing::info!("Telemetry is disabled via OTEL_SDK_DISABLED");
        return Ok(None);
    }

    // Check for console exporter mode (development)
    let use_console = std::env::var("OTEL_TRACES_EXPORTER")
        .map(|v| v == "console")
        .unwrap_or(false);

    if use_console {
        tracing::info!("Using console exporter for development");
        // For console mode, we'll just use the tracing subscriber without OTel
        init_tracing_subscriber_only()?;
        return Ok(Some(TelemetryGuard { provider: None }));
    }

    tracing::info!(
        service_name = %config.service_name,
        service_version = %config.service_version,
        otlp_endpoint = %config.otlp_endpoint,
        otlp_protocol = ?config.otlp_protocol,
        "Initializing OpenTelemetry telemetry"
    );

    // Initialize tracer provider
    let provider =
        exporter::init_tracer_provider(&config).context("Failed to initialize tracer provider")?;

    // Set as global provider
    global::set_tracer_provider(provider.clone());

    // Create the OpenTelemetry layer for tracing
    let otel_layer = tracing_opentelemetry::layer().with_tracer(provider.tracer("secan"));

    // Initialize the tracing subscriber with the OTel layer
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(otel_layer)
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("OpenTelemetry telemetry initialized successfully");

    Ok(Some(TelemetryGuard {
        provider: Some(provider),
    }))
}

/// Initialize tracing subscriber without OpenTelemetry (console mode)
fn init_tracing_subscriber_only() -> Result<()> {
    tracing_subscriber::registry()
        .with(EnvFilter::from_default_env())
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Tracing initialized (console mode)");
    Ok(())
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
        let guard = TelemetryGuard { provider: None };
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
