//! OTLP exporter configuration
//!
//! This module handles the creation and configuration of OTLP exporters
//! for sending traces to collectors.

use crate::telemetry::config::TelemetryConfig;
use anyhow::Result;
use opentelemetry::KeyValue;
use opentelemetry_otlp::{WithExportConfig, WithHttpConfig};
use opentelemetry_sdk::trace::SdkTracerProvider;
use opentelemetry_sdk::Resource;

impl opentelemetry_sdk::trace::SpanExporter for LoggingExporter {
    fn export(
        &mut self,
        batch: Vec<opentelemetry_sdk::trace::SpanData>,
    ) -> std::pin::Pin<
        Box<dyn std::future::Future<Output = opentelemetry_sdk::trace::ExportResult> + Send + '_>,
    > {
        eprintln!("[LoggingExporter] Exporting {} spans", batch.len());
        for span in &batch {
            eprintln!(
                "[LoggingExporter] Span: {} - {}",
                span.name,
                span.span_context.trace_id()
            );
        }
        self.inner.export(batch)
    }

    fn shutdown(&mut self) {
        eprintln!("[LoggingExporter] Shutdown called");
        self.inner.shutdown()
    }
}

/// Initialize the tracer provider with OTLP exporter
pub fn init_tracer_provider(config: &TelemetryConfig) -> Result<SdkTracerProvider> {
    // Create the OTLP HTTP exporter
    let exporter = create_otlp_exporter(config)?;

    // Use SimpleSpanProcessor for immediate export (easier debugging)
    // In production, use BatchSpanProcessor for better performance
    let processor = opentelemetry_sdk::trace::SimpleSpanProcessor::new(exporter);

    // Build resource attributes
    let mut resource_attrs = vec![
        KeyValue::new("service.name", config.service_name.clone()),
        KeyValue::new("service.version", config.service_version.clone()),
        KeyValue::new("telemetry.sdk.name", "opentelemetry"),
        KeyValue::new("telemetry.sdk.language", "rust"),
        KeyValue::new("telemetry.sdk.version", env!("CARGO_PKG_VERSION")),
    ];

    // Add custom resource attributes
    for (key, value) in &config.resource_attributes {
        resource_attrs.push(KeyValue::new(key.clone(), value.clone()));
    }

    let resource = Resource::builder_empty()
        .with_attributes(resource_attrs)
        .build();

    // Create tracer provider with processor
    let provider = SdkTracerProvider::builder()
        .with_span_processor(processor)
        .with_resource(resource)
        .build();

    Ok(provider)
}

/// Create OTLP HTTP exporter
fn create_otlp_exporter(config: &TelemetryConfig) -> Result<opentelemetry_otlp::SpanExporter> {
    eprintln!(
        "[exporter] Creating OTLP HTTP exporter for endpoint: {}",
        config.otlp_endpoint
    );

    // Parse OTLP headers
    let headers: std::collections::HashMap<String, String> =
        config.otlp_headers.iter().cloned().collect();

    // Create HTTP exporter
    let builder = opentelemetry_otlp::SpanExporter::builder()
        .with_http()
        .with_endpoint(&config.otlp_endpoint)
        .with_timeout(config.batch_config.max_export_timeout);

    // Add headers if present
    let builder = if headers.is_empty() {
        builder
    } else {
        builder.with_headers(headers)
    };

    let exporter = builder
        .build()
        .map_err(|e| anyhow::anyhow!("Failed to build HTTP exporter: {}", e))?;

    eprintln!("[exporter] OTLP HTTP exporter created successfully");

    Ok(exporter)
}
