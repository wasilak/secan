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

/// Group to cluster mapping for permission configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GroupClusterMapping {
    /// Group name (or "*" for all groups)
    pub group: String,
    /// List of cluster IDs accessible to this group (or "*" for all clusters)
    pub clusters: Vec<String>,
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
    #[serde(default)]
    pub permissions: Vec<GroupClusterMapping>,
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
    pub groups: Vec<String>,
}

/// OIDC configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OidcConfig {
    pub discovery_url: String,
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    #[serde(default = "default_groups_claim_key")]
    pub groups_claim_key: String,
}

fn default_groups_claim_key() -> String {
    "groups".to_string()
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
    #[serde(skip_serializing_if = "Option::is_none")]
    pub name: Option<String>,
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

        for perm in &self.permissions {
            perm.validate()?;
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

        if self.groups_claim_key.is_empty() {
            anyhow::bail!("OIDC groups_claim_key cannot be empty");
        }

        Ok(())
    }
}

impl GroupClusterMapping {
    /// Validate group cluster mapping configuration
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.group.is_empty() {
            anyhow::bail!("Group name cannot be empty");
        }

        if self.clusters.is_empty() {
            anyhow::bail!("Group '{}' must have at least one cluster", self.group);
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

        // Name is optional, but if provided it cannot be empty
        if self.name.as_ref().is_some_and(|n| n.is_empty()) {
            anyhow::bail!("Cluster name cannot be empty if provided");
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

mod defaults;

impl Config {
    /// Load configuration from environment variables and optional config files
    ///
    /// Priority (highest to lowest):
    /// 1. Environment variables (SECAN_* with _ separator, supports array indices like SECAN_CLUSTERS_0_ID)
    /// 2. Configuration files (config.yaml, config.local.yaml, config.toml) - supports ${VAR} substitution
    /// 3. Default values (hardcoded)
    pub fn load() -> anyhow::Result<Self> {
        use config::{Config as ConfigRs, Environment};
        use std::path::Path;

        let mut builder = ConfigRs::builder()
            // Set defaults first (lowest priority)
            .set_default("server.host", defaults::DEFAULT_SERVER_HOST)?
            .set_default("server.port", defaults::DEFAULT_SERVER_PORT)?
            .set_default("auth.mode", defaults::DEFAULT_AUTH_MODE)?
            .set_default(
                "auth.session_timeout_minutes",
                defaults::DEFAULT_AUTH_SESSION_TIMEOUT_MINUTES,
            )?
            .set_default(
                "cache.metadata_duration_seconds",
                defaults::DEFAULT_CACHE_METADATA_DURATION_SECONDS,
            )?;

        // Add optional config files (medium priority)
        // Support ${VAR} and ${VAR:-default} environment variable substitution in config files
        for filename in &[
            "config.yaml",
            "config.local.yaml",
            "config.yml",
            "config.local.yml",
            "config.toml",
        ] {
            if Path::new(filename).exists() {
                // Read file content and substitute environment variables
                let content = std::fs::read_to_string(filename)?;
                let substituted = Self::substitute_env_vars(&content);

                // Add as string source with substituted content
                builder = builder.add_source(config::File::from_str(
                    &substituted,
                    config::FileFormat::Yaml,
                ));
            }
        }

        // Add environment variables (highest priority)
        // Uses _ as separator which matches config-rs's expected format
        // Example: SECAN_CLUSTERS_0_ID -> clusters[0].id
        //          SECAN_CACHE_METADATA_DURATION_SECONDS -> cache.metadata_duration_seconds
        builder = builder.add_source(
            Environment::with_prefix("SECAN")
                .separator("_")
                .try_parsing(true),
        );

        // Build into raw config
        let config_rs = builder.build()?;

        // Try to deserialize; if it fails due to array index issues, fix and retry
        let final_config: Self = match config_rs.clone().try_deserialize() {
            Ok(config) => config,
            Err(_) => {
                // If direct deserialization fails, it's likely due to numeric-keyed maps
                // Convert to JSON and fix array indices
                let clusters_value = config_rs.get("clusters").unwrap_or(serde_json::json!({}));
                let mut config_json = serde_json::json!({
                    "server": {
                        "host": config_rs.get_string("server.host").unwrap_or_else(|_| defaults::DEFAULT_SERVER_HOST.to_string()),
                        "port": config_rs.get_int("server.port").unwrap_or(defaults::DEFAULT_SERVER_PORT as i64),
                    },
                    "auth": {
                        "mode": config_rs.get_string("auth.mode").unwrap_or_else(|_| defaults::DEFAULT_AUTH_MODE.to_string()),
                        "session_timeout_minutes": config_rs.get_int("auth.session_timeout_minutes").unwrap_or(defaults::DEFAULT_AUTH_SESSION_TIMEOUT_MINUTES as i64),
                    },
                    "cache": {
                        "metadata_duration_seconds": config_rs.get_int("cache.metadata_duration_seconds").unwrap_or(defaults::DEFAULT_CACHE_METADATA_DURATION_SECONDS as i64),
                    },
                    "clusters": clusters_value,
                });

                Self::fix_array_indices(&mut config_json);

                serde_json::from_value(config_json).map_err(|e| {
                    anyhow::anyhow!(
                        "Failed to deserialize configuration after fixing arrays: {}",
                        e
                    )
                })?
            }
        };

        // Validate configuration
        final_config.validate()?;

        Ok(final_config)
    }

    /// Fix array indices that config-rs treats as map keys
    /// Converts { "0": {...}, "1": {...} } to [...{...}, {...}]
    fn fix_array_indices(value: &mut serde_json::Value) {
        if let serde_json::Value::Object(map) = value {
            // First, recursively fix all nested values
            for v in map.values_mut() {
                Self::fix_array_indices(v);
            }

            // Then check if this object should be an array
            if Self::is_numeric_keyed_map(map) {
                // Convert object with numeric keys to array
                let mut indices: Vec<(usize, serde_json::Value)> = map
                    .iter()
                    .filter_map(|(k, v)| k.parse::<usize>().ok().map(|idx| (idx, v.clone())))
                    .collect();

                if !indices.is_empty() {
                    indices.sort_by_key(|(idx, _)| *idx);

                    // Determine the max index to size the array properly
                    let max_idx = indices.last().map(|(idx, _)| *idx).unwrap_or(0);
                    let mut array = vec![serde_json::Value::Null; max_idx + 1];

                    for (idx, v) in indices {
                        array[idx] = v;
                    }

                    *value = serde_json::Value::Array(array);
                }
            }
        } else if let serde_json::Value::Array(arr) = value {
            for v in arr.iter_mut() {
                Self::fix_array_indices(v);
            }
        }
    }

    /// Check if a map should be an array (has numeric keys, not necessarily all consecutive)
    fn is_numeric_keyed_map(map: &serde_json::Map<String, serde_json::Value>) -> bool {
        if map.is_empty() {
            return false;
        }

        // Most keys must be numeric for this to be an array
        // (Allow some non-numeric keys for flexibility)
        let numeric_keys = map.keys().filter(|k| k.parse::<usize>().is_ok()).count();
        numeric_keys > 0 && numeric_keys == map.len()
    }

    /// Substitute environment variables in content
    /// Supports ${VAR} and ${VAR:-default} syntax
    fn substitute_env_vars(content: &str) -> String {
        use std::env;

        // Match ${VAR:-default} or ${VAR}
        let re = regex::Regex::new(r"\$\{([^}:]+)(?::-([^}]*))?\}").unwrap();

        re.replace_all(content, |caps: &regex::Captures| {
            let var_name = &caps[1];
            let default_value = caps.get(2).map(|m| m.as_str());

            env::var(var_name).unwrap_or_else(|_| default_value.unwrap_or("").to_string())
        })
        .into_owned()
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
            permissions: Vec::new(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
            permissions: Vec::new(),
        };

        // Should fail without users
        assert!(config.validate().is_err());

        // Should succeed with valid user
        config.local_users = Some(vec![LocalUser {
            username: "admin".to_string(),
            password_hash: "$2b$12$test".to_string(),
            groups: vec!["admin".to_string()],
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
            permissions: Vec::new(),
        };

        // Should fail without OIDC config
        assert!(config.validate().is_err());

        // Should succeed with valid OIDC config
        config.oidc = Some(OidcConfig {
            discovery_url: "https://auth.example.com/.well-known/openid-configuration".to_string(),
            client_id: "secan".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "https://secan.example.com/api/auth/oidc/redirect".to_string(),
            groups_claim_key: "groups".to_string(),
        });
        assert!(config.validate().is_ok());
    }

    #[test]
    fn test_cluster_config_validation() {
        let mut cluster = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test Cluster".to_string()),
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
}
