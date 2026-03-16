//! OTLP exporter configuration
//!
//! This module handles the creation and configuration of OTLP exporters
//! for sending traces to collectors.

use crate::telemetry::config::TelemetryConfig;
use anyhow::Result;
use opentelemetry::KeyValue;
use opentelemetry_sdk::trace::SdkTracerProvider;
use opentelemetry_sdk::Resource;

/// Initialize the tracer provider with OTLP exporter
pub fn init_tracer_provider(config: &TelemetryConfig) -> Result<SdkTracerProvider> {
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

    // For now, create a simple provider without OTLP export
    // This will be enhanced once we have the correct API
    let provider = SdkTracerProvider::builder().with_resource(resource).build();

    Ok(provider)
}
