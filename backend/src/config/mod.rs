use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Main configuration structure for the application
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Config {
    #[serde(default)]
    pub server: ServerConfig,
    #[serde(default)]
    pub auth: AuthConfig,
    #[serde(default)]
    pub clusters: Vec<ClusterConfig>,
    #[serde(default)]
    pub cache: CacheConfig,
}

/// Server configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    #[serde(default = "default_host")]
    pub host: String,
    #[serde(default = "default_port")]
    pub port: u16,
    pub tls: Option<TlsServerConfig>,
}

fn default_host() -> String {
    "0.0.0.0".to_string()
}

fn default_port() -> u16 {
    27182
}

/// Cache configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CacheConfig {
    /// Duration in seconds to cache cluster metadata
    #[serde(default = "default_cache_duration")]
    pub metadata_duration_seconds: u64,
}

fn default_cache_duration() -> u64 {
    30 // 30 seconds default
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            metadata_duration_seconds: 30,
        }
    }
}

/// TLS configuration for the server
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsServerConfig {
    pub cert_file: PathBuf,
    pub key_file: PathBuf,
}

/// Authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthConfig {
    pub mode: AuthMode,
    #[serde(default = "default_session_timeout")]
    pub session_timeout_minutes: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub local_users: Option<Vec<LocalUser>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oidc: Option<OidcConfig>,
    #[serde(default)]
    pub roles: Vec<RoleConfig>,
}

fn default_session_timeout() -> u64 {
    60
}

/// Authentication mode
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum AuthMode {
    LocalUsers,
    Oidc,
    Open,
}

/// Local user configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalUser {
    pub username: String,
    pub password_hash: String,
    pub roles: Vec<String>,
}

/// OIDC configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcConfig {
    pub discovery_url: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
}

/// Role configuration for RBAC
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoleConfig {
    pub name: String,
    pub cluster_patterns: Vec<String>,
}

/// Cluster configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterConfig {
    pub id: String,
    pub name: String,
    pub nodes: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub auth: Option<ClusterAuth>,
    #[serde(default)]
    pub tls: TlsConfig,
    /// Elasticsearch major version (7, 8, or 9)
    /// Used to select the appropriate SDK client version
    #[serde(default = "default_es_version")]
    pub es_version: u8,
}

/// Cluster authentication configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClusterAuth {
    Basic { username: String, password: String },
    ApiKey { key: String },
    None,
}

/// TLS configuration for cluster connections
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TlsConfig {
    #[serde(default = "default_tls_verify")]
    pub verify: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ca_cert_file: Option<PathBuf>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ca_cert_dir: Option<PathBuf>,
}

impl Default for TlsConfig {
    fn default() -> Self {
        Self {
            verify: true,
            ca_cert_file: None,
            ca_cert_dir: None,
        }
    }
}

fn default_tls_verify() -> bool {
    true
}

fn default_es_version() -> u8 {
    8 // Default to Elasticsearch 8.x
}

/// Client type for Elasticsearch communication
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "snake_case")]
pub enum ClientType {
    #[default]
    Sdk,
}

// Validation implementations
impl Config {
    /// Validate the entire configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        self.server.validate()?;
        self.auth.validate()?;

        if self.clusters.is_empty() {
            anyhow::bail!("At least one cluster must be configured");
        }

        for cluster in &self.clusters {
            cluster.validate()?;
        }

        Ok(())
    }
}

impl ServerConfig {
    /// Validate server configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.host.is_empty() {
            anyhow::bail!("Server host cannot be empty");
        }

        if self.port == 0 {
            anyhow::bail!("Server port must be greater than 0");
        }

        if let Some(tls) = &self.tls {
            tls.validate()?;
        }

        Ok(())
    }
}

impl TlsServerConfig {
    /// Validate TLS server configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if !self.cert_file.exists() {
            anyhow::bail!("TLS certificate file does not exist: {:?}", self.cert_file);
        }

        if !self.key_file.exists() {
            anyhow::bail!("TLS key file does not exist: {:?}", self.key_file);
        }

        Ok(())
    }
}

impl AuthConfig {
    /// Validate authentication configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.session_timeout_minutes == 0 {
            anyhow::bail!("Session timeout must be greater than 0");
        }

        match self.mode {
            AuthMode::LocalUsers => {
                if self.local_users.is_none() || self.local_users.as_ref().unwrap().is_empty() {
                    anyhow::bail!("Local users mode requires at least one user to be configured");
                }

                if let Some(users) = &self.local_users {
                    for user in users {
                        user.validate()?;
                    }
                }
            }
            AuthMode::Oidc => {
                if self.oidc.is_none() {
                    anyhow::bail!("OIDC mode requires OIDC configuration");
                }

                if let Some(oidc) = &self.oidc {
                    oidc.validate()?;
                }
            }
            AuthMode::Open => {
                // No validation needed for open mode
            }
        }

        for role in &self.roles {
            role.validate()?;
        }

        Ok(())
    }
}

impl LocalUser {
    /// Validate local user configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.username.is_empty() {
            anyhow::bail!("Username cannot be empty");
        }

        if self.password_hash.is_empty() {
            anyhow::bail!("Password hash cannot be empty for user: {}", self.username);
        }

        Ok(())
    }
}

impl OidcConfig {
    /// Validate OIDC configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.discovery_url.is_empty() {
            anyhow::bail!("OIDC discovery URL cannot be empty");
        }

        if self.client_id.is_empty() {
            anyhow::bail!("OIDC client ID cannot be empty");
        }

        if self.client_secret.is_empty() {
            anyhow::bail!("OIDC client secret cannot be empty");
        }

        if self.redirect_uri.is_empty() {
            anyhow::bail!("OIDC redirect URI cannot be empty");
        }

        Ok(())
    }
}

impl RoleConfig {
    /// Validate role configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.name.is_empty() {
            anyhow::bail!("Role name cannot be empty");
        }

        if self.cluster_patterns.is_empty() {
            anyhow::bail!(
                "Role '{}' must have at least one cluster pattern",
                self.name
            );
        }

        Ok(())
    }
}

impl ClusterConfig {
    /// Validate cluster configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.id.is_empty() {
            anyhow::bail!("Cluster ID cannot be empty");
        }

        if self.name.is_empty() {
            anyhow::bail!("Cluster name cannot be empty");
        }

        if self.nodes.is_empty() {
            anyhow::bail!("Cluster '{}' must have at least one node", self.id);
        }

        for node in &self.nodes {
            if node.is_empty() {
                anyhow::bail!("Cluster '{}' has an empty node URL", self.id);
            }

            // Basic URL validation
            if !node.starts_with("http://") && !node.starts_with("https://") {
                anyhow::bail!(
                    "Cluster '{}' node URL must start with http:// or https://: {}",
                    self.id,
                    node
                );
            }
        }

        // Validate Elasticsearch version
        if self.es_version < 7 || self.es_version > 9 {
            anyhow::bail!(
                "Cluster '{}' has invalid Elasticsearch version: {}. Supported versions are 7, 8, or 9",
                self.id,
                self.es_version
            );
        }

        self.tls.validate()?;

        if let Some(auth) = &self.auth {
            auth.validate(&self.id)?;
        }

        Ok(())
    }
}

impl ClusterAuth {
    /// Validate cluster authentication configuration
    pub fn validate(&self, cluster_id: &str) -> anyhow::Result<()> {
        match self {
            ClusterAuth::Basic { username, password } => {
                if username.is_empty() {
                    anyhow::bail!(
                        "Cluster '{}' basic auth username cannot be empty",
                        cluster_id
                    );
                }
                if password.is_empty() {
                    anyhow::bail!(
                        "Cluster '{}' basic auth password cannot be empty",
                        cluster_id
                    );
                }
            }
            ClusterAuth::ApiKey { key } => {
                if key.is_empty() {
                    anyhow::bail!("Cluster '{}' API key cannot be empty", cluster_id);
                }
            }
            ClusterAuth::None => {
                // No validation needed
            }
        }
        Ok(())
    }
}

impl TlsConfig {
    /// Validate TLS configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if let Some(ca_cert_file) = &self.ca_cert_file {
            if !ca_cert_file.exists() {
                anyhow::bail!("CA certificate file does not exist: {:?}", ca_cert_file);
            }
        }

        if let Some(ca_cert_dir) = &self.ca_cert_dir {
            if !ca_cert_dir.exists() {
                anyhow::bail!("CA certificate directory does not exist: {:?}", ca_cert_dir);
            }

            if !ca_cert_dir.is_dir() {
                anyhow::bail!("CA certificate path is not a directory: {:?}", ca_cert_dir);
            }
        }

        Ok(())
    }
}

use config::{Environment, File};
use std::env;

impl Config {
    /// Load configuration from file and environment variables
    ///
    /// Priority (highest to lowest):
    /// 1. Environment variables (CEREBRO_*)
    /// 2. Configuration file
    /// 3. Default values
    pub fn load() -> anyhow::Result<Self> {
        let config_path =
            env::var("CEREBRO_CONFIG_FILE").unwrap_or_else(|_| "config.yaml".to_string());

        Self::from_file(&config_path)
    }

    /// Load configuration from a specific file path
    pub fn from_file(path: &str) -> anyhow::Result<Self> {
        let builder = config::Config::builder()
            // Start with default values
            .set_default("server.host", "0.0.0.0")?
            .set_default("server.port", 27182)?
            .set_default("auth.session_timeout_minutes", 60)?;

        // Add file source if it exists
        let builder = if std::path::Path::new(path).exists() {
            builder.add_source(File::with_name(path))
        } else {
            tracing::warn!("Configuration file not found: {}, using defaults", path);
            builder
        };

        // Add environment variable overrides
        // Environment variables should be prefixed with CEREBRO_
        // and use double underscore for nested fields
        // Example: CEREBRO_SERVER__PORT=27182
        let builder = builder.add_source(
            Environment::with_prefix("CEREBRO")
                .separator("__")
                .try_parsing(true)
                .prefix_separator("_"),
        );

        let config = builder.build()?;

        let parsed_config: Config = config.try_deserialize()?;

        // Validate configuration
        parsed_config.validate()?;

        Ok(parsed_config)
    }

    /// Apply environment variable overrides to an existing config
    pub fn with_env_overrides(self) -> anyhow::Result<Self> {
        // Convert current config to a config builder
        let yaml = serde_yaml::to_string(&self)?;

        let builder = config::Config::builder()
            .add_source(File::from_str(&yaml, config::FileFormat::Yaml))
            .add_source(
                Environment::with_prefix("CEREBRO")
                    .separator("__")
                    .try_parsing(true),
            );

        let config = builder.build()?;
        let parsed_config: Config = config.try_deserialize()?;

        // Validate configuration
        parsed_config.validate()?;

        Ok(parsed_config)
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 27182,
            tls: None,
        }
    }
}

impl Default for AuthConfig {
    fn default() -> Self {
        Self {
            mode: AuthMode::Open,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            roles: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    #[test]
    fn test_config_validation_empty_clusters() {
        let config = Config {
            server: ServerConfig::default(),
            auth: AuthConfig::default(),
            clusters: Vec::new(),
            cache: CacheConfig::default(),
        };

        assert!(config.validate().is_err());
    }

    #[test]
    fn test_server_config_validation() {
        let mut config = ServerConfig::default();
        assert!(config.validate().is_ok());

        config.host = String::new();
        assert!(config.validate().is_err());

        config.host = "localhost".to_string();
        config.port = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_auth_config_validation_local_users() {
        let mut config = AuthConfig {
            mode: AuthMode::LocalUsers,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            roles: Vec::new(),
        };

        // Should fail without users
        assert!(config.validate().is_err());

        // Should succeed with valid user
        config.local_users = Some(vec![LocalUser {
            username: "admin".to_string(),
            password_hash: "$2b$12$test".to_string(),
            roles: vec!["admin".to_string()],
        }]);
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_auth_config_validation_oidc() {
        let mut config = AuthConfig {
            mode: AuthMode::Oidc,
            session_timeout_minutes: 60,
            local_users: None,
            oidc: None,
            roles: Vec::new(),
        };

        // Should fail without OIDC config
        assert!(config.validate().is_err());

        // Should succeed with valid OIDC config
        config.oidc = Some(OidcConfig {
            discovery_url: "https://auth.example.com/.well-known/openid-configuration".to_string(),
            client_id: "cerebro".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://cerebro.example.com/api/auth/oidc/redirect".to_string(),
        });
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_cluster_config_validation() {
        let mut cluster = ClusterConfig {
            id: "test".to_string(),
            name: "Test Cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            es_version: 8,
        };

        assert!(cluster.validate().is_ok());

        // Test empty ID
        cluster.id = String::new();
        assert!(cluster.validate().is_err());
        cluster.id = "test".to_string();

        // Test empty nodes
        cluster.nodes = Vec::new();
        assert!(cluster.validate().is_err());
        cluster.nodes = vec!["http://localhost:9200".to_string()];

        // Test invalid node URL
        cluster.nodes = vec!["invalid-url".to_string()];
        assert!(cluster.validate().is_err());
        cluster.nodes = vec!["http://localhost:9200".to_string()];

        // Test invalid ES version
        cluster.es_version = 6;
        assert!(cluster.validate().is_err());
        cluster.es_version = 10;
        assert!(cluster.validate().is_err());
        cluster.es_version = 8;
        assert!(cluster.validate().is_ok());
    }

    #[test]
    fn test_cluster_auth_validation() {
        let cluster_id = "test";

        // Basic auth validation
        let auth = ClusterAuth::Basic {
            username: "user".to_string(),
            password: "pass".to_string(),
        };
        assert!(auth.validate(cluster_id).is_ok());

        let auth = ClusterAuth::Basic {
            username: String::new(),
            password: "pass".to_string(),
        };
        assert!(auth.validate(cluster_id).is_err());

        // API key validation
        let auth = ClusterAuth::ApiKey {
            key: "key123".to_string(),
        };
        assert!(auth.validate(cluster_id).is_ok());

        let auth = ClusterAuth::ApiKey { key: String::new() };
        assert!(auth.validate(cluster_id).is_err());

        // None auth
        let auth = ClusterAuth::None;
        assert!(auth.validate(cluster_id).is_ok());
    }

    #[test]
    fn test_config_from_yaml() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.yaml");

        let yaml_content = r#"
server:
  host: "127.0.0.1"
  port: 8080

auth:
  mode: open
  session_timeout_minutes: 30

clusters:
  - id: "local"
    name: "Local Elasticsearch"
    nodes:
      - "http://localhost:9200"
    es_version: 8
"#;

        fs::write(&config_path, yaml_content).unwrap();

        let config = Config::from_file(config_path.to_str().unwrap()).unwrap();

        assert_eq!(config.server.host, "127.0.0.1");
        assert_eq!(config.server.port, 8080);
        assert_eq!(config.auth.mode, AuthMode::Open);
        assert_eq!(config.auth.session_timeout_minutes, 30);
        assert_eq!(config.clusters.len(), 1);
        assert_eq!(config.clusters[0].id, "local");
    }

    #[test]
    fn test_config_defaults() {
        let temp_dir = TempDir::new().unwrap();
        let config_path = temp_dir.path().join("config.yaml");

        let yaml_content = r#"
auth:
  mode: open

clusters:
  - id: "local"
    name: "Local"
    nodes:
      - "http://localhost:9200"
"#;

        fs::write(&config_path, yaml_content).unwrap();

        let config = Config::from_file(config_path.to_str().unwrap()).unwrap();

        // Check defaults are applied
        assert_eq!(config.server.host, "0.0.0.0");
        assert_eq!(config.server.port, 27182);
        assert_eq!(config.auth.session_timeout_minutes, 60);
    }

    #[test]
    fn test_role_config_validation() {
        let role = RoleConfig {
            name: "admin".to_string(),
            cluster_patterns: vec!["*".to_string()],
        };
        assert!(role.validate().is_ok());

        let role = RoleConfig {
            name: String::new(),
            cluster_patterns: vec!["*".to_string()],
        };
        assert!(role.validate().is_err());

        let role = RoleConfig {
            name: "admin".to_string(),
            cluster_patterns: Vec::new(),
        };
        assert!(role.validate().is_err());
    }
}
