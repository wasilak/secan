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

pub mod axum_middleware;
pub mod client;
pub mod config;
pub mod exporter;
pub mod middleware;

pub use config::{BatchConfig, OtlpProtocol, SamplerConfig, TelemetryConfig};

use anyhow::{Context, Result};
use opentelemetry::global;
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
        tracing::debug!("Shutting down OpenTelemetry telemetry...");

        // Force flush before shutdown to ensure all spans are exported
        if let Some(ref provider) = self.provider {
            if let Err(e) = provider.force_flush() {
                eprintln!("[telemetry] Error during force flush: {:?}", e);
            }
        }

        // Shutdown the provider to flush any remaining spans
        if let Some(provider) = self.provider.take() {
            if let Err(e) = provider.shutdown() {
                eprintln!("[telemetry] Error during shutdown: {:?}", e);
            } else {
                tracing::debug!("OpenTelemetry provider shut down successfully");
            }
        }
        tracing::debug!("OpenTelemetry telemetry shut down complete");
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
            // Use eprintln! since tracing subscriber may not be initialized yet
            eprintln!("[telemetry] ERROR: Failed to initialize telemetry: {}", e);
            None
        }
    }
}

fn init_telemetry_inner() -> Result<Option<TelemetryGuard>> {
    let config = TelemetryConfig::from_env().context("Failed to parse telemetry configuration")?;

    if !config.enabled {
        return Ok(None);
    }

    // Check for console exporter mode (development)
    let use_console = std::env::var("OTEL_TRACES_EXPORTER")
        .map(|v| v == "console")
        .unwrap_or(false);

    if use_console {
        init_tracing_subscriber_only()?;
        return Ok(Some(TelemetryGuard { provider: None }));
    }

    // Initialize tracer provider
    let provider =
        exporter::init_tracer_provider(&config).context("Failed to initialize tracer provider")?;

    // Set as global provider
    global::set_tracer_provider(provider.clone());

    // Create the OpenTelemetry layer for tracing
    // This automatically uses the global tracer provider
    let otel_layer = tracing_opentelemetry::layer();

    // Initialize the tracing subscriber with the OTel layer and JSON formatting
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(otel_layer)
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_target(true)
                .with_thread_ids(true)
                .with_line_number(true),
        )
        .init();

    tracing::debug!(
        service_name = %config.service_name,
        otlp_endpoint = %config.otlp_endpoint,
        otlp_protocol = ?config.otlp_protocol,
        "OpenTelemetry telemetry initialized"
    );

    Ok(Some(TelemetryGuard {
        provider: Some(provider),
    }))
}

/// Initialize tracing subscriber without OpenTelemetry (console mode)
fn init_tracing_subscriber_only() -> Result<()> {
    let env_filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            tracing_subscriber::fmt::layer()
                .json()
                .with_target(true)
                .with_thread_ids(true)
                .with_line_number(true),
        )
        .init();

    tracing::debug!("Tracing initialized (console mode)");
    Ok(())
}

/// Check if telemetry is enabled
pub fn is_telemetry_enabled() -> bool {
    TelemetryConfig::from_env()
        .map(|c| c.enabled)
        .unwrap_or(false)
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
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
