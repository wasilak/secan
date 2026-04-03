//! OTLP exporter configuration
//!
//! This module handles the creation and configuration of OTLP exporters
//! for sending traces to collectors.

use crate::telemetry::config::{OtlpProtocol, TelemetryConfig};
use anyhow::Result;
use opentelemetry::KeyValue;
use opentelemetry_otlp::{Protocol, WithExportConfig, WithHttpConfig};
use opentelemetry_sdk::trace::{BatchSpanProcessor, SdkTracerProvider};
use opentelemetry_sdk::Resource;

/// Initialize the tracer provider with OTLP exporter
pub fn init_tracer_provider(config: &TelemetryConfig) -> Result<SdkTracerProvider> {
    // Build resource attributes (common for both protocols)
    let mut resource_attrs = vec![
        KeyValue::new("service.name", config.service_name.clone()),
        KeyValue::new("service.version", config.service_version.clone()),
        KeyValue::new("telemetry.sdk.name", "opentelemetry"),
        KeyValue::new("telemetry.sdk.language", "rust"),
        KeyValue::new("telemetry.sdk.version", env!("CARGO_PKG_VERSION")),
    ];

    for (key, value) in &config.resource_attributes {
        resource_attrs.push(KeyValue::new(key.clone(), value.clone()));
    }

    let resource = Resource::builder_empty()
        .with_attributes(resource_attrs)
        .build();

    // Create provider based on protocol
    let provider = match config.otlp_protocol {
        OtlpProtocol::Grpc => {
            let exporter = create_otlp_tonic_exporter(config)?;

            // Use BatchSpanProcessor for gRPC
            let batch_config = opentelemetry_sdk::trace::BatchConfigBuilder::default()
                .with_max_queue_size(config.batch_config.max_queue_size)
                .with_scheduled_delay(config.batch_config.scheduled_delay)
                .with_max_export_batch_size(config.batch_config.max_export_batch_size)
                .build();

            let processor = BatchSpanProcessor::builder(exporter)
                .with_batch_config(batch_config)
                .build();

            tracing::debug!(
                scheduled_delay_ms = config.batch_config.scheduled_delay.as_millis(),
                "Using BatchSpanProcessor for gRPC export"
            );

            SdkTracerProvider::builder()
                .with_span_processor(processor)
                .with_resource(resource)
                .build()
        }
        OtlpProtocol::Http => {
            let exporter = create_otlp_http_exporter(config)?;

            // Use BatchSpanProcessor with blocking reqwest client
            let batch_config = opentelemetry_sdk::trace::BatchConfigBuilder::default()
                .with_max_queue_size(config.batch_config.max_queue_size)
                .with_scheduled_delay(config.batch_config.scheduled_delay)
                .with_max_export_batch_size(config.batch_config.max_export_batch_size)
                .build();

            let processor = BatchSpanProcessor::builder(exporter)
                .with_batch_config(batch_config)
                .build();

            tracing::debug!(
                scheduled_delay_ms = config.batch_config.scheduled_delay.as_millis(),
                "Using BatchSpanProcessor for HTTP export"
            );

            SdkTracerProvider::builder()
                .with_span_processor(processor)
                .with_resource(resource)
                .build()
        }
    };

    Ok(provider)
}

/// Create OTLP Tonic (gRPC) exporter
///
/// In this build the gRPC/Tonic exporter is not enabled. Return an error
/// so callers which select gRPC are informed at runtime.
fn create_otlp_tonic_exporter(
    _config: &TelemetryConfig,
) -> Result<opentelemetry_otlp::SpanExporter> {
    Err(anyhow::anyhow!(
        "gRPC/Tonic OTLP exporter not enabled in this build (missing feature)"
    ))
}

/// Create OTLP HTTP exporter with async reqwest client
fn create_otlp_http_exporter(config: &TelemetryConfig) -> Result<opentelemetry_otlp::SpanExporter> {
    // Parse OTLP headers
    let headers: std::collections::HashMap<String, String> =
        config.otlp_headers.iter().cloned().collect();

    // Ensure endpoint has the correct path for traces
    let endpoint = if config.otlp_endpoint.ends_with("/v1/traces") {
        config.otlp_endpoint.clone()
    } else if config.otlp_endpoint.ends_with('/') {
        format!("{}v1/traces", config.otlp_endpoint)
    } else {
        format!("{}/v1/traces", config.otlp_endpoint)
    };

    // Create HTTP exporter builder with async reqwest client
    // Note: This requires the "reqwest-client" feature (not "reqwest-blocking-client")
    let mut builder = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_protocol(Protocol::HttpBinary)
        .with_endpoint(&endpoint)
        .with_timeout(config.batch_config.max_export_timeout);

    // Add headers if present
    if !headers.is_empty() {
        builder = builder.with_headers(headers);
    }

    let exporter = builder
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to build HTTP exporter: {}", e))?;

    Ok(exporter)
}
