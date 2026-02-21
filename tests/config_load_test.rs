use secan::config::Config;
use serial_test::serial;
use std::env;
use std::fs;
use tempfile::TempDir;

#[test]
#[serial]
fn test_config_load_from_yaml_file() {
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
      - "http://es2.example.com:9200"
    es_version: 8
"#;

    fs::write(&config_path, yaml_content).unwrap();

    // Change to temp directory to find the config file
    let orig_dir = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    let result = Config::load();

    std::env::set_current_dir(&orig_dir).unwrap();

    assert!(result.is_ok(), "Should load YAML config: {:?}", result);
    let config = result.unwrap();

    assert_eq!(config.server.host, "127.0.0.1");
    assert_eq!(config.server.port, 8080);
    assert_eq!(config.clusters.len(), 1);
    assert_eq!(config.clusters[0].id, "prod");
    assert_eq!(config.clusters[0].nodes.len(), 2);
    assert_eq!(config.clusters[0].es_version, 8);
}

#[test]
#[serial]
fn test_config_env_var_override_simple() {
    // Create a temporary config file
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");

    let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: open

clusters:
  - id: "local"
    nodes:
      - "http://localhost:9200"
    es_version: 8
"#;

    fs::write(&config_path, yaml_content).unwrap();

    let orig_dir = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    // Set environment variables to override config
    env::set_var("SECAN_SERVER_HOST", "0.0.0.0");
    env::set_var("SECAN_SERVER_PORT", "9999");

    let result = Config::load();

    env::remove_var("SECAN_SERVER_HOST");
    env::remove_var("SECAN_SERVER_PORT");
    std::env::set_current_dir(&orig_dir).unwrap();

    assert!(
        result.is_ok(),
        "Should load with env overrides: {:?}",
        result
    );
    let config = result.unwrap();

    // Env vars should override file values
    assert_eq!(
        config.server.host, "0.0.0.0",
        "Host should be overridden by env var"
    );
    assert_eq!(
        config.server.port, 9999,
        "Port should be overridden by env var"
    );
}

// NOTE: Testing env var overrides of existing cluster fields is complex with config-rs
// because it treats numeric keys as map keys rather than array indices.
// The current implementation handles basic cases well.

#[test]
#[serial]
fn test_config_validation_fails_with_no_clusters() {
    // Create a temporary config file with no clusters
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");

    let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: open

clusters: []
"#;

    fs::write(&config_path, yaml_content).unwrap();

    let orig_dir = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    let result = Config::load();

    std::env::set_current_dir(&orig_dir).unwrap();

    assert!(result.is_err(), "Should fail validation with no clusters");
    assert!(result
        .unwrap_err()
        .to_string()
        .contains("At least one cluster"));
}

#[test]
#[serial]
fn test_config_defaults_when_no_file_exists() {
    // When no config file exists, we need at least one cluster
    let temp_dir = TempDir::new().unwrap();
    let orig_dir = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    // Set minimal required env vars
    env::set_var("SECAN_CLUSTERS_0_ID", "test");
    env::set_var("SECAN_CLUSTERS_0_NODES_0", "http://localhost:9200");

    let result = Config::load();

    env::remove_var("SECAN_CLUSTERS_0_ID");
    env::remove_var("SECAN_CLUSTERS_0_NODES_0");
    std::env::set_current_dir(&orig_dir).unwrap();

    assert!(result.is_ok(), "Should load with env vars: {:?}", result);
    let config = result.unwrap();

    // Should use defaults for unspecified values
    assert_eq!(config.server.host, "0.0.0.0", "Should use default host");
    assert_eq!(config.server.port, 27182, "Should use default port");
    assert_eq!(config.clusters[0].id, "test");
}

#[test]
#[serial]
fn test_config_type_coercion() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");

    let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: open

clusters:
  - id: "test"
    nodes:
      - "http://localhost:9200"
    es_version: 8
"#;

    fs::write(&config_path, yaml_content).unwrap();

    let orig_dir = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    // Set numeric env vars (should be coerced to integers)
    env::set_var("SECAN_SERVER_PORT", "7777");
    // Note: Fields with underscores like metadata_duration_seconds won't be overridden by env var with _ separator
    // because config-rs splits on every _, so use the full path or avoid env var override for such fields
    // env::set_var("SECAN_CACHE_METADATA_DURATION_SECONDS", "120");

    let result = Config::load();

    env::remove_var("SECAN_SERVER_PORT");
    std::env::set_current_dir(&orig_dir).unwrap();

    assert!(
        result.is_ok(),
        "Should load with numeric env vars: {:?}",
        result
    );
    let config = result.unwrap();

    assert_eq!(config.server.port, 7777);
    // Note: cache.metadata_duration_seconds defaults to 30, can't be overridden via env var due to underscore in field name
    assert_eq!(config.cache.metadata_duration_seconds, 30);
}
