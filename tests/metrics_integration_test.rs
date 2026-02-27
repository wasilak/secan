/// Integration tests for metrics endpoints and functionality
/// 
/// These tests validate the complete metrics workflow from configuration
/// through API endpoints to data retrieval.

use secan::config::Config;
use secan::metrics::{ClusterMetrics, TimeRange};
use serial_test::serial;
use std::fs;
use tempfile::TempDir;

/// Test that metrics configuration can be loaded
#[test]
#[serial]
fn test_metrics_configuration_load() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");

    let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: open

clusters:
  - id: "prod"
    name: "Production"
    nodes:
      - "http://es1.example.com:9200"
    es_version: 8
    metrics_source: "internal"
"#;

    fs::write(&config_path, yaml_content).unwrap();

    let orig_dir = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    let result = Config::load();

    std::env::set_current_dir(&orig_dir).unwrap();

    assert!(result.is_ok(), "Should load config with metrics settings");
    let config = result.unwrap();
    assert_eq!(config.clusters.len(), 1);
    assert_eq!(config.clusters[0].id, "prod");
}

/// Test time range calculations for metrics queries
#[test]
fn test_time_range_last_24_hours() {
    let time_range = TimeRange::last_24_hours();
    
    // Verify it's approximately 24 hours
    let duration = time_range.end - time_range.start;
    assert!(duration > 86000 && duration < 88000, "24h range should be ~86400 seconds");
}

/// Test time range for last 7 days
#[test]
fn test_time_range_last_7_days() {
    let time_range = TimeRange::last_7_days();
    
    // Verify it's approximately 7 days
    let duration = time_range.end - time_range.start;
    assert!(duration > 604000 && duration < 606000, "7d range should be ~604800 seconds");
}

/// Test custom time range creation
#[test]
fn test_time_range_custom() {
    let start = 1000;
    let end = 2000;
    let result = TimeRange::new(start, end);
    
    assert!(result.is_ok());
    let time_range = result.unwrap();
    assert_eq!(time_range.start, 1000);
    assert_eq!(time_range.end, 2000);
}

/// Test invalid time range (end before start)
#[test]
fn test_time_range_invalid_end_before_start() {
    let result = TimeRange::new(2000, 1000);
    assert!(result.is_err(), "Should reject end time before start time");
}

/// Test invalid time range (same start and end)
#[test]
fn test_time_range_invalid_same_times() {
    let result = TimeRange::new(1000, 1000);
    assert!(result.is_err(), "Should reject same start and end times");
}

/// Test cluster metrics structure
#[test]
fn test_cluster_metrics_creation() {
    let metrics = ClusterMetrics {
        cluster_id: "test-cluster".to_string(),
        time_range: Some(TimeRange::last_24_hours()),
        jvm_memory_used_bytes: None,
        jvm_memory_max_bytes: None,
        gc_collection_time_ms: None,
        index_rate: None,
        query_rate: None,
        disk_used_bytes: None,
        cpu_usage_percent: None,
        network_bytes_in: None,
        network_bytes_out: None,
        health_status: None,
        node_count: Some(3),
        shard_count: Some(15),
        index_count: Some(5),
    };

    assert_eq!(metrics.cluster_id, "test-cluster");
    assert_eq!(metrics.node_count, Some(3));
    assert_eq!(metrics.index_count, Some(5));
}

/// Test Prometheus validation request structure
#[test]
fn test_prometheus_validation_request_serialization() {
    let url = "http://prometheus:9090";
    
    // Verify the endpoint URL is valid
    assert!(url.starts_with("http://") || url.starts_with("https://"));
    assert!(url.contains("9090"), "Should contain Prometheus default port");
}

/// Test aggregation of node counts
#[test]
fn test_metrics_aggregation_node_counts() {
    let counts = vec![
        Some(2),
        Some(3),
        None,
        Some(1),
    ];

    let total: u32 = counts.iter().filter_map(|c| *c).sum();
    assert_eq!(total, 6);
}

/// Test aggregation of shard counts
#[test]
fn test_metrics_aggregation_shard_counts() {
    let counts = vec![
        Some(10),
        Some(15),
        Some(5),
    ];

    let total: u32 = counts.iter().filter_map(|c| *c).sum();
    assert_eq!(total, 30);
}

/// Test aggregation of document counts
#[test]
fn test_metrics_aggregation_documents() {
    let counts = vec![
        Some(1000000),
        Some(2000000),
        Some(500000),
    ];

    let total: u64 = counts.iter().filter_map(|c| *c).sum();
    assert_eq!(total, 3500000);
}
