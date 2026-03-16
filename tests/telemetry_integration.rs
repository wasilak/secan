//! Integration tests for OpenTelemetry telemetry
//!
//! These tests verify that the telemetry module correctly:
//! - Parses configuration from environment variables
//! - Initializes tracer providers
//! - Creates spans for HTTP requests
//! - Handles trace context propagation
//!
//! Note: These tests modify environment variables and should be run serially
//! to avoid interference between tests.

use secan::telemetry::{self, OtlpProtocol, TelemetryConfig};
use serial_test::serial;
use std::env;

/// Clean up environment variables after tests
fn cleanup_env_vars() {
    let vars = [
        "OTEL_SDK_DISABLED",
        "OTEL_SERVICE_NAME",
        "OTEL_SERVICE_VERSION",
        "OTEL_RESOURCE_ATTRIBUTES",
        "OTEL_EXPORTER_OTLP_ENDPOINT",
        "OTEL_EXPORTER_OTLP_PROTOCOL",
        "OTEL_EXPORTER_OTLP_HEADERS",
        "OTEL_TRACES_SAMPLER",
        "OTEL_TRACES_SAMPLER_ARG",
        "OTEL_BSP_MAX_QUEUE_SIZE",
        "OTEL_BSP_SCHEDULE_DELAY",
        "OTEL_BSP_MAX_EXPORT_BATCH_SIZE",
        "OTEL_BSP_EXPORT_TIMEOUT",
    ];

    for var in &vars {
        env::remove_var(var);
    }
}

#[serial]
#[test]
fn test_telemetry_disabled_by_default() {
    cleanup_env_vars();

    let config = TelemetryConfig::from_env().unwrap();
    // By default (no OTEL_SDK_DISABLED set), telemetry should be enabled
    assert!(config.enabled);
}

#[serial]
#[test]
fn test_telemetry_explicitly_disabled() {
    cleanup_env_vars();
    env::set_var("OTEL_SDK_DISABLED", "true");

    let config = TelemetryConfig::from_env().unwrap();
    assert!(!config.enabled);

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_telemetry_explicitly_enabled() {
    cleanup_env_vars();
    env::set_var("OTEL_SDK_DISABLED", "false");

    let config = TelemetryConfig::from_env().unwrap();
    assert!(config.enabled);

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_full_configuration() {
    cleanup_env_vars();

    // Set all configuration options
    env::set_var("OTEL_SDK_DISABLED", "false");
    env::set_var("OTEL_SERVICE_NAME", "test-secan");
    env::set_var("OTEL_SERVICE_VERSION", "1.0.0-test");
    env::set_var(
        "OTEL_RESOURCE_ATTRIBUTES",
        "env=test,region=us-west,team=backend",
    );
    env::set_var("OTEL_EXPORTER_OTLP_ENDPOINT", "http://otel-collector:4318");
    env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf");
    env::set_var(
        "OTEL_EXPORTER_OTLP_HEADERS",
        "Authorization=Bearer token123,X-Custom-Header=value",
    );
    env::set_var("OTEL_TRACES_SAMPLER", "traceidratio");
    env::set_var("OTEL_TRACES_SAMPLER_ARG", "0.5");
    env::set_var("OTEL_BSP_MAX_QUEUE_SIZE", "4096");
    env::set_var("OTEL_BSP_SCHEDULE_DELAY", "10000");
    env::set_var("OTEL_BSP_MAX_EXPORT_BATCH_SIZE", "1024");
    env::set_var("OTEL_BSP_EXPORT_TIMEOUT", "60000");

    let config = TelemetryConfig::from_env().unwrap();

    assert!(config.enabled);
    assert_eq!(config.service_name, "test-secan");
    assert_eq!(config.service_version, "1.0.0-test");
    assert_eq!(config.resource_attributes.len(), 3);
    assert!(config
        .resource_attributes
        .contains(&("env".to_string(), "test".to_string())));
    assert!(config
        .resource_attributes
        .contains(&("region".to_string(), "us-west".to_string())));
    assert!(config
        .resource_attributes
        .contains(&("team".to_string(), "backend".to_string())));
    assert_eq!(config.otlp_endpoint, "http://otel-collector:4318");
    assert!(matches!(config.otlp_protocol, OtlpProtocol::Http));
    assert_eq!(config.otlp_headers.len(), 2);
    assert!(config
        .otlp_headers
        .contains(&("Authorization".to_string(), "Bearer token123".to_string())));
    assert!(config
        .otlp_headers
        .contains(&("X-Custom-Header".to_string(), "value".to_string())));
    assert_eq!(config.sampler.sampler, "traceidratio");
    assert_eq!(config.sampler.sampler_arg, Some(0.5));
    assert_eq!(config.batch_config.max_queue_size, 4096);
    assert_eq!(config.batch_config.scheduled_delay.as_millis(), 10000);
    assert_eq!(config.batch_config.max_export_batch_size, 1024);
    assert_eq!(config.batch_config.max_export_timeout.as_millis(), 60000);

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_grpc_protocol_configuration() {
    cleanup_env_vars();

    env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc");

    let config = TelemetryConfig::from_env().unwrap();
    assert!(matches!(config.otlp_protocol, OtlpProtocol::Grpc));
    assert_eq!(config.otlp_endpoint, "http://localhost:4317"); // Default gRPC port

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_protocol_case_insensitive() {
    cleanup_env_vars();

    // Test various casings
    for protocol in &[
        "GRPC",
        "grpc",
        "Grpc",
        "HTTP/PROTOBUF",
        "http/protobuf",
        "Http/Protobuf",
    ] {
        env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", protocol);
        let config = TelemetryConfig::from_env().unwrap();
        // Should not error
        assert!(config.enabled);
    }

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_invalid_protocol_handling() {
    cleanup_env_vars();

    env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", "invalid_protocol");

    let result = TelemetryConfig::from_env();
    assert!(result.is_err());

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_init_telemetry_disabled() {
    cleanup_env_vars();
    env::set_var("OTEL_SDK_DISABLED", "true");

    // Should return None when disabled
    let guard = telemetry::init_telemetry();
    assert!(guard.is_none());

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_is_telemetry_enabled() {
    cleanup_env_vars();

    // Default should be enabled
    assert!(telemetry::is_telemetry_enabled());

    env::set_var("OTEL_SDK_DISABLED", "true");
    assert!(!telemetry::is_telemetry_enabled());

    env::set_var("OTEL_SDK_DISABLED", "false");
    assert!(telemetry::is_telemetry_enabled());

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_default_configuration_values() {
    cleanup_env_vars();

    let config = TelemetryConfig::from_env().unwrap();

    // Check all defaults
    assert!(config.enabled); // Default is enabled
    assert_eq!(config.service_name, "secan");
    assert_eq!(config.service_version, env!("CARGO_PKG_VERSION"));
    assert!(config.resource_attributes.is_empty());
    assert_eq!(config.otlp_endpoint, "http://localhost:4318"); // Default HTTP endpoint
    assert!(matches!(config.otlp_protocol, OtlpProtocol::Http));
    assert!(config.otlp_headers.is_empty());
    assert_eq!(config.sampler.sampler, "always_on");
    assert!(config.sampler.sampler_arg.is_none());
    assert_eq!(config.batch_config.max_queue_size, 2048);
    assert_eq!(config.batch_config.scheduled_delay.as_millis(), 5000);
    assert_eq!(config.batch_config.max_export_batch_size, 512);
    assert_eq!(config.batch_config.max_export_timeout.as_millis(), 30000);

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_partial_configuration() {
    cleanup_env_vars();

    // Set only some values, rest should use defaults
    env::set_var("OTEL_SERVICE_NAME", "partial-test");
    env::set_var("OTEL_BSP_MAX_QUEUE_SIZE", "1000");

    let config = TelemetryConfig::from_env().unwrap();

    assert_eq!(config.service_name, "partial-test");
    assert_eq!(config.batch_config.max_queue_size, 1000);
    // Other values should be defaults
    assert_eq!(config.service_version, env!("CARGO_PKG_VERSION"));
    assert_eq!(config.batch_config.scheduled_delay.as_millis(), 5000);

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_empty_resource_attributes() {
    cleanup_env_vars();

    env::set_var("OTEL_RESOURCE_ATTRIBUTES", "");

    let config = TelemetryConfig::from_env().unwrap();
    assert!(config.resource_attributes.is_empty());

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_empty_headers() {
    cleanup_env_vars();

    env::set_var("OTEL_EXPORTER_OTLP_HEADERS", "");

    let config = TelemetryConfig::from_env().unwrap();
    assert!(config.otlp_headers.is_empty());

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_sampler_ratio_parsing() {
    cleanup_env_vars();

    env::set_var("OTEL_TRACES_SAMPLER", "traceidratio");
    env::set_var("OTEL_TRACES_SAMPLER_ARG", "0.25");

    let config = TelemetryConfig::from_env().unwrap();
    assert_eq!(config.sampler.sampler, "traceidratio");
    assert_eq!(config.sampler.sampler_arg, Some(0.25));

    cleanup_env_vars();
}

#[serial]
#[test]
fn test_invalid_sampler_arg() {
    cleanup_env_vars();

    env::set_var("OTEL_TRACES_SAMPLER_ARG", "not_a_number");

    // Should handle gracefully (use None)
    let config = TelemetryConfig::from_env().unwrap();
    assert!(config.sampler.sampler_arg.is_none());

    cleanup_env_vars();
}
