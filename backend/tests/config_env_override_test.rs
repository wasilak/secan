use cerebro_backend::config::Config;
use std::env;
use std::fs;
use tempfile::TempDir;

#[test]
fn test_env_override_precedence() {
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
    name: "Local"
    nodes:
      - "http://localhost:9200"
"#;

    fs::write(&config_path, yaml_content).unwrap();

    // Set environment variables
    env::set_var("CEREBRO_SERVER__PORT", "9999");
    env::set_var("CEREBRO_SERVER__HOST", "0.0.0.0");

    let config = Config::from_file(config_path.to_str().unwrap()).unwrap();
    
    // Debug output
    eprintln!("Loaded config - host: {}, port: {}", config.server.host, config.server.port);

    // Environment variables should override file values
    assert_eq!(config.server.host, "0.0.0.0", "Host should be overridden by env var");
    assert_eq!(config.server.port, 9999, "Port should be overridden by env var");

    // Clean up
    env::remove_var("CEREBRO_SERVER__PORT");
    env::remove_var("CEREBRO_SERVER__HOST");
}

#[test]
fn test_missing_config_file_uses_defaults() {
    // Clear any environment variables
    env::remove_var("CEREBRO_SERVER__PORT");
    env::remove_var("CEREBRO_SERVER__HOST");
    env::remove_var("CEREBRO_CONFIG_FILE");

    let result = Config::from_file("nonexistent.yaml");

    // Should fail because required fields are missing when no config file exists
    assert!(result.is_err(), "Should fail when config file is missing and no env vars are set");
}

#[test]
fn test_invalid_config_validation() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");

    // Config with no clusters (invalid)
    let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: open

clusters: []
"#;

    fs::write(&config_path, yaml_content).unwrap();

    let result = Config::from_file(config_path.to_str().unwrap());

    // Should fail validation
    assert!(result.is_err(), "Should fail validation with no clusters");
    assert!(result.unwrap_err().to_string().contains("At least one cluster"));
}

#[test]
fn test_invalid_auth_mode_validation() {
    let temp_dir = TempDir::new().unwrap();
    let config_path = temp_dir.path().join("config.yaml");

    // Local users mode without users
    let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: local_users

clusters:
  - id: "local"
    name: "Local"
    nodes:
      - "http://localhost:9200"
"#;

    fs::write(&config_path, yaml_content).unwrap();

    let result = Config::from_file(config_path.to_str().unwrap());

    // Should fail validation
    assert!(result.is_err(), "Should fail validation without local users");
    assert!(result.unwrap_err().to_string().contains("at least one user"));
}
