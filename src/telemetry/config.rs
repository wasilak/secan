//! OpenTelemetry telemetry configuration and initialization
//!
//! This module provides OpenTelemetry tracing support for Secan.
//! Tracing is opt-in via the OTEL_SDK_DISABLED environment variable.

use anyhow::Result;
use std::env;
use std::time::Duration;

/// Protocol for OTLP export
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub enum OtlpProtocol {
    #[default]
    Http,
    Grpc,
}

impl std::str::FromStr for OtlpProtocol {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "http" | "http/protobuf" => Ok(OtlpProtocol::Http),
            "grpc" => Ok(OtlpProtocol::Grpc),
            _ => Err(anyhow::anyhow!("Invalid OTLP protocol: {}", s)),
        }
    }
}

/// Configuration for the telemetry subsystem
#[derive(Debug, Clone)]
pub struct TelemetryConfig {
    /// Whether telemetry is enabled
    pub enabled: bool,

    /// Service name for traces
    pub service_name: String,

    /// Service version
    pub service_version: String,

    /// Additional resource attributes
    pub resource_attributes: Vec<(String, String)>,

    /// OTLP collector endpoint
    pub otlp_endpoint: String,

    /// Protocol for OTLP export
    pub otlp_protocol: OtlpProtocol,

    /// Headers for OTLP requests (authentication)
    pub otlp_headers: Vec<(String, String)>,

    /// Batch span processor configuration
    pub batch_config: BatchConfig,

    /// Trace sampler configuration
    pub sampler: SamplerConfig,
}

/// Batch span processor configuration
#[derive(Debug, Clone)]
pub struct BatchConfig {
    pub max_queue_size: usize,
    pub scheduled_delay: Duration,
    pub max_export_batch_size: usize,
    pub max_export_timeout: Duration,
}

impl Default for BatchConfig {
    fn default() -> Self {
        Self {
            max_queue_size: 2048,
            scheduled_delay: Duration::from_millis(5000),
            max_export_batch_size: 512,
            max_export_timeout: Duration::from_millis(30000),
        }
    }
}

/// Trace sampler configuration
#[derive(Debug, Clone)]
pub struct SamplerConfig {
    pub sampler: String,
    pub sampler_arg: Option<f64>,
}

impl Default for SamplerConfig {
    fn default() -> Self {
        Self {
            sampler: "always_on".to_string(),
            sampler_arg: None,
        }
    }
}

impl TelemetryConfig {
    /// Load configuration from environment variables
    ///
    /// Supported environment variables:
    /// - OTEL_SDK_DISABLED: Set to "true" to disable telemetry (default: false)
    /// - OTEL_SERVICE_NAME: Service name for traces (default: "secan")
    /// - OTEL_SERVICE_VERSION: Service version (default: from Cargo.toml)
    /// - OTEL_RESOURCE_ATTRIBUTES: Comma-separated key=value pairs
    /// - OTEL_EXPORTER_OTLP_ENDPOINT: OTLP collector endpoint
    /// - OTEL_EXPORTER_OTLP_PROTOCOL: "grpc" or "http/protobuf" (default: http/protobuf)
    /// - OTEL_EXPORTER_OTLP_HEADERS: Comma-separated key=value pairs for auth
    /// - OTEL_TRACES_SAMPLER: Sampler type (default: always_on)
    /// - OTEL_TRACES_SAMPLER_ARG: Sampler argument (for ratio-based samplers)
    /// - OTEL_BSP_MAX_QUEUE_SIZE: Max pending spans (default: 2048)
    /// - OTEL_BSP_SCHEDULE_DELAY: Export interval in ms (default: 5000)
    /// - OTEL_BSP_MAX_EXPORT_BATCH_SIZE: Max spans per batch (default: 512)
    /// - OTEL_BSP_EXPORT_TIMEOUT: Export timeout in ms (default: 30000)
    pub fn from_env() -> Result<Self> {
        // Check if telemetry is disabled
        let enabled = !env::var("OTEL_SDK_DISABLED")
            .map(|v| v.to_lowercase() == "true")
            .unwrap_or(false);

        let service_name = env::var("OTEL_SERVICE_NAME").unwrap_or_else(|_| "secan".to_string());

        let service_version = env::var("OTEL_SERVICE_VERSION")
            .unwrap_or_else(|_| env!("CARGO_PKG_VERSION").to_string());

        let resource_attributes =
            parse_key_value_list(&env::var("OTEL_RESOURCE_ATTRIBUTES").unwrap_or_default())?;

        let otlp_protocol = env::var("OTEL_EXPORTER_OTLP_PROTOCOL")
            .unwrap_or_else(|_| "http/protobuf".to_string())
            .parse::<OtlpProtocol>()?;

        let otlp_endpoint = env::var("OTEL_EXPORTER_OTLP_ENDPOINT")
            .unwrap_or_else(|_| default_otlp_endpoint(&otlp_protocol));

        let otlp_headers =
            parse_key_value_list(&env::var("OTEL_EXPORTER_OTLP_HEADERS").unwrap_or_default())?;

        let batch_config = BatchConfig {
            max_queue_size: env::var("OTEL_BSP_MAX_QUEUE_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(2048),
            scheduled_delay: Duration::from_millis(
                env::var("OTEL_BSP_SCHEDULE_DELAY")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(5000),
            ),
            max_export_batch_size: env::var("OTEL_BSP_MAX_EXPORT_BATCH_SIZE")
                .ok()
                .and_then(|v| v.parse().ok())
                .unwrap_or(512),
            max_export_timeout: Duration::from_millis(
                env::var("OTEL_BSP_EXPORT_TIMEOUT")
                    .ok()
                    .and_then(|v| v.parse().ok())
                    .unwrap_or(30000),
            ),
        };

        let sampler = SamplerConfig {
            sampler: env::var("OTEL_TRACES_SAMPLER").unwrap_or_else(|_| "always_on".to_string()),
            sampler_arg: env::var("OTEL_TRACES_SAMPLER_ARG")
                .ok()
                .and_then(|v| v.parse().ok()),
        };

        Ok(Self {
            enabled,
            service_name,
            service_version,
            resource_attributes,
            otlp_endpoint,
            otlp_protocol,
            otlp_headers,
            batch_config,
            sampler,
        })
    }

    /// Get the default OTLP endpoint based on protocol
    pub fn default_endpoint(&self) -> &str {
        &self.otlp_endpoint
    }
}

/// Parse a comma-separated list of key=value pairs
fn parse_key_value_list(input: &str) -> Result<Vec<(String, String)>> {
    let mut result = Vec::new();

    if input.is_empty() {
        return Ok(result);
    }

    for pair in input.split(',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }

        let parts: Vec<&str> = pair.splitn(2, '=').collect();
        if parts.len() != 2 {
            return Err(anyhow::anyhow!("Invalid key=value pair: {}", pair));
        }

        result.push((parts[0].trim().to_string(), parts[1].trim().to_string()));
    }

    Ok(result)
}

/// Get the default OTLP endpoint based on protocol
fn default_otlp_endpoint(protocol: &OtlpProtocol) -> String {
    match protocol {
        OtlpProtocol::Http => "http://localhost:4318".to_string(),
        OtlpProtocol::Grpc => "http://localhost:4317".to_string(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;

    #[test]
    fn test_parse_key_value_list() {
        let result = parse_key_value_list("key1=value1,key2=value2").unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], ("key1".to_string(), "value1".to_string()));
        assert_eq!(result[1], ("key2".to_string(), "value2".to_string()));
    }

    #[test]
    fn test_parse_key_value_list_empty() {
        let result = parse_key_value_list("").unwrap();
        assert!(result.is_empty());
    }

    #[test]
    fn test_parse_key_value_list_with_spaces() {
        let result = parse_key_value_list(" key1 = value1 , key2 = value2 ").unwrap();
        assert_eq!(result.len(), 2);
        assert_eq!(result[0], ("key1".to_string(), "value1".to_string()));
    }

    #[test]
    fn test_parse_key_value_list_invalid() {
        let result = parse_key_value_list("invalid_pair");
        assert!(result.is_err());
    }

    #[test]
    fn test_otlp_protocol_parsing() {
        assert!(matches!(
            "http/protobuf".parse::<OtlpProtocol>().unwrap(),
            OtlpProtocol::Http
        ));
        assert!(matches!(
            "grpc".parse::<OtlpProtocol>().unwrap(),
            OtlpProtocol::Grpc
        ));
        assert!("invalid".parse::<OtlpProtocol>().is_err());
    }

    #[test]
    fn test_default_otlp_endpoint() {
        assert_eq!(
            default_otlp_endpoint(&OtlpProtocol::Http),
            "http://localhost:4318"
        );
        assert_eq!(
            default_otlp_endpoint(&OtlpProtocol::Grpc),
            "http://localhost:4317"
        );
    }

    #[test]
    fn test_telemetry_config_from_env_disabled() {
        // Save original value
        let original = env::var("OTEL_SDK_DISABLED").ok();

        // Test disabled
        env::set_var("OTEL_SDK_DISABLED", "true");
        let config = TelemetryConfig::from_env().unwrap();
        assert!(!config.enabled);

        // Test enabled (explicit)
        env::set_var("OTEL_SDK_DISABLED", "false");
        let config = TelemetryConfig::from_env().unwrap();
        assert!(config.enabled);

        // Restore original
        match original {
            Some(v) => env::set_var("OTEL_SDK_DISABLED", v),
            None => env::remove_var("OTEL_SDK_DISABLED"),
        }
    }

    #[test]
    fn test_telemetry_config_service_name() {
        let original = env::var("OTEL_SERVICE_NAME").ok();

        env::set_var("OTEL_SERVICE_NAME", "test-service");
        let config = TelemetryConfig::from_env().unwrap();
        assert_eq!(config.service_name, "test-service");

        // Test default
        env::remove_var("OTEL_SERVICE_NAME");
        let config = TelemetryConfig::from_env().unwrap();
        assert_eq!(config.service_name, "secan");

        match original {
            Some(v) => env::set_var("OTEL_SERVICE_NAME", v),
            None => env::remove_var("OTEL_SERVICE_NAME"),
        }
    }

    #[test]
    fn test_telemetry_config_resource_attributes() {
        let original = env::var("OTEL_RESOURCE_ATTRIBUTES").ok();

        env::set_var("OTEL_RESOURCE_ATTRIBUTES", "env=prod,region=us-east");
        let config = TelemetryConfig::from_env().unwrap();
        assert_eq!(config.resource_attributes.len(), 2);
        assert!(config
            .resource_attributes
            .contains(&("env".to_string(), "prod".to_string())));
        assert!(config
            .resource_attributes
            .contains(&("region".to_string(), "us-east".to_string())));

        match original {
            Some(v) => env::set_var("OTEL_RESOURCE_ATTRIBUTES", v),
            None => env::remove_var("OTEL_RESOURCE_ATTRIBUTES"),
        }
    }

    #[test]
    fn test_telemetry_config_otlp_endpoint() {
        let original = env::var("OTEL_EXPORTER_OTLP_ENDPOINT").ok();

        env::set_var("OTEL_EXPORTER_OTLP_ENDPOINT", "http://custom:4318");
        let config = TelemetryConfig::from_env().unwrap();
        assert_eq!(config.otlp_endpoint, "http://custom:4318");

        match original {
            Some(v) => env::set_var("OTEL_EXPORTER_OTLP_ENDPOINT", v),
            None => env::remove_var("OTEL_EXPORTER_OTLP_ENDPOINT"),
        }
    }

    #[test]
    fn test_telemetry_config_otlp_protocol() {
        let original = env::var("OTEL_EXPORTER_OTLP_PROTOCOL").ok();

        env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", "grpc");
        let config = TelemetryConfig::from_env().unwrap();
        assert!(matches!(config.otlp_protocol, OtlpProtocol::Grpc));

        env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", "http/protobuf");
        let config = TelemetryConfig::from_env().unwrap();
        assert!(matches!(config.otlp_protocol, OtlpProtocol::Http));

        match original {
            Some(v) => env::set_var("OTEL_EXPORTER_OTLP_PROTOCOL", v),
            None => env::remove_var("OTEL_EXPORTER_OTLP_PROTOCOL"),
        }
    }

    #[test]
    fn test_batch_config_default() {
        let config = BatchConfig::default();
        assert_eq!(config.max_queue_size, 2048);
        assert_eq!(config.scheduled_delay, Duration::from_millis(5000));
        assert_eq!(config.max_export_batch_size, 512);
        assert_eq!(config.max_export_timeout, Duration::from_millis(30000));
    }

    #[test]
    fn test_sampler_config_default() {
        let config = SamplerConfig::default();
        assert_eq!(config.sampler, "always_on");
        assert!(config.sampler_arg.is_none());
    }
}
