//! Configuration structures for authentication
//!
//! This module defines the configuration data structures for all authentication modes,
//! including local users, OIDC, session management, and security settings.

use anyhow::{anyhow, Context, Result};
use config::{Config, Environment, File};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;

/// Main authentication configuration
#[derive(Debug, Clone, Deserialize)]
pub struct AuthConfig {
    pub mode: AuthMode,
    pub local: Option<LocalAuthConfig>,
    pub oidc: Option<OidcConfig>,
    pub session: SessionConfig,
    pub security: SecurityConfig,
}

/// Authentication mode selection
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AuthMode {
    Local,
    Oidc,
    Open,
}

/// Configuration for local user authentication
#[derive(Debug, Clone, Deserialize)]
pub struct LocalAuthConfig {
    pub users: Vec<LocalUser>,
}

/// Local user definition
#[derive(Debug, Clone, Deserialize)]
pub struct LocalUser {
    pub username: String,
    pub password_hash: String,
    pub hash_algorithm: HashAlgorithm,
    pub roles: Vec<String>,
}

/// Password hashing algorithm
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HashAlgorithm {
    Bcrypt,
    Argon2,
}

/// OIDC provider configuration
#[derive(Debug, Clone, Deserialize)]
pub struct OidcConfig {
    pub client_id: String,
    pub client_secret: String,
    pub redirect_uri: String,
    pub discovery_url: Option<String>,
    pub authorization_endpoint: Option<String>,
    pub token_endpoint: Option<String>,
    pub userinfo_endpoint: Option<String>,
    pub jwks_uri: Option<String>,
    pub group_claim_key: Option<String>,
    pub required_groups: Vec<String>,
}

/// Session management configuration
#[derive(Debug, Clone, Deserialize)]
pub struct SessionConfig {
    pub timeout_seconds: u64,
    pub renewal_mode: RenewalMode,
    pub cookie_name: String,
    pub secure_only: bool,
}

/// Session renewal mode
#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RenewalMode {
    SlidingWindow,
    FixedExpiration,
}

/// Security configuration
#[derive(Debug, Clone, Deserialize)]
pub struct SecurityConfig {
    pub rate_limit_attempts: u32,
    pub rate_limit_window_seconds: u64,
    pub min_password_length: usize,
    pub require_https: bool,
}

/// Configuration loader with validation
pub struct ConfigLoader {
    file_path: PathBuf,
}

impl ConfigLoader {
    /// Create a new ConfigLoader with the specified file path
    pub fn new(file_path: PathBuf) -> Self {
        Self { file_path }
    }

    /// Load authentication configuration from file and environment variables
    ///
    /// Environment variables take precedence over file configuration.
    /// Use the prefix CEREBRO_AUTH__ with double underscores as separators.
    pub fn load(&self) -> Result<AuthConfig> {
        // Build configuration from file
        let mut builder = Config::builder()
            .add_source(File::from(self.file_path.clone()).required(false));

        // Override with environment variables (higher precedence)
        builder = builder.add_source(
            Environment::with_prefix("CEREBRO_AUTH")
                .separator("__")
                .try_parsing(true),
        );

        let config = builder
            .build()
            .context("Failed to build configuration")?;

        let auth_config: AuthConfig = config
            .try_deserialize()
            .context("Failed to deserialize authentication configuration")?;

        // Validate the configuration
        self.validate(&auth_config)?;

        Ok(auth_config)
    }

    /// Validate the authentication configuration
    fn validate(&self, config: &AuthConfig) -> Result<()> {
        match config.mode {
            AuthMode::Local => {
                let local = config
                    .local
                    .as_ref()
                    .ok_or_else(|| anyhow!("Local auth mode requires local configuration"))?;

                if local.users.is_empty() {
                    return Err(anyhow!("Local auth mode requires at least one user"));
                }

                for user in &local.users {
                    self.validate_local_user(user)?;
                }
            }
            AuthMode::Oidc => {
                let oidc = config
                    .oidc
                    .as_ref()
                    .ok_or_else(|| anyhow!("OIDC auth mode requires OIDC configuration"))?;

                self.validate_oidc_config(oidc)?;
            }
            AuthMode::Open => {
                // No validation needed for open mode
            }
        }

        Ok(())
    }

    /// Validate a local user configuration
    fn validate_local_user(&self, user: &LocalUser) -> Result<()> {
        if user.username.is_empty() {
            return Err(anyhow!("Username cannot be empty"));
        }

        if user.password_hash.is_empty() {
            return Err(anyhow!("Password hash cannot be empty"));
        }

        // Validate hash format based on algorithm
        match user.hash_algorithm {
            HashAlgorithm::Bcrypt => {
                if !user.password_hash.starts_with("$2") {
                    return Err(anyhow!(
                        "Invalid bcrypt hash format for user '{}'. Hash must start with '$2'",
                        user.username
                    ));
                }
            }
            HashAlgorithm::Argon2 => {
                if !user.password_hash.starts_with("$argon2") {
                    return Err(anyhow!(
                        "Invalid argon2 hash format for user '{}'. Hash must start with '$argon2'",
                        user.username
                    ));
                }
            }
        }

        Ok(())
    }

    /// Validate OIDC configuration
    fn validate_oidc_config(&self, oidc: &OidcConfig) -> Result<()> {
        if oidc.client_id.is_empty() {
            return Err(anyhow!("OIDC client_id is required"));
        }

        if oidc.client_secret.is_empty() {
            return Err(anyhow!("OIDC client_secret is required"));
        }

        if oidc.redirect_uri.is_empty() {
            return Err(anyhow!("OIDC redirect_uri is required"));
        }

        // Either discovery_url OR all manual endpoints must be provided
        if oidc.discovery_url.is_none() {
            if oidc.authorization_endpoint.is_none()
                || oidc.token_endpoint.is_none()
                || oidc.userinfo_endpoint.is_none()
                || oidc.jwks_uri.is_none()
            {
                return Err(anyhow!(
                    "OIDC requires either discovery_url or all manual endpoints \
                     (authorization_endpoint, token_endpoint, userinfo_endpoint, jwks_uri)"
                ));
            }
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::TempDir;

    fn create_test_config_file(dir: &TempDir, content: &str) -> PathBuf {
        let config_path = dir.path().join("config.yaml");
        fs::write(&config_path, content).unwrap();
        config_path
    }

    #[test]
    fn test_load_local_auth_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_content = r#"
mode: local
local:
  users:
    - username: admin
      password_hash: $2b$12$abcdefghijklmnopqrstuv
      hash_algorithm: bcrypt
      roles:
        - admin
session:
  timeout_seconds: 3600
  renewal_mode: sliding_window
  cookie_name: session_token
  secure_only: true
security:
  rate_limit_attempts: 5
  rate_limit_window_seconds: 300
  min_password_length: 8
  require_https: false
"#;
        let config_path = create_test_config_file(&temp_dir, config_content);
        let loader = ConfigLoader::new(config_path);

        let config = loader.load().unwrap();
        assert_eq!(config.mode, AuthMode::Local);
        assert!(config.local.is_some());
        assert_eq!(config.local.unwrap().users.len(), 1);
    }

    #[test]
    fn test_load_oidc_auth_config_with_discovery() {
        let temp_dir = TempDir::new().unwrap();
        let config_content = r#"
mode: oidc
oidc:
  client_id: test-client
  client_secret: test-secret
  redirect_uri: http://localhost:9000/auth/callback
  discovery_url: https://idp.example.com/.well-known/openid-configuration
  required_groups: []
session:
  timeout_seconds: 3600
  renewal_mode: sliding_window
  cookie_name: session_token
  secure_only: true
security:
  rate_limit_attempts: 5
  rate_limit_window_seconds: 300
  min_password_length: 8
  require_https: false
"#;
        let config_path = create_test_config_file(&temp_dir, config_content);
        let loader = ConfigLoader::new(config_path);

        let config = loader.load().unwrap();
        assert_eq!(config.mode, AuthMode::Oidc);
        assert!(config.oidc.is_some());
    }

    #[test]
    fn test_load_open_auth_config() {
        let temp_dir = TempDir::new().unwrap();
        let config_content = r#"
mode: open
session:
  timeout_seconds: 3600
  renewal_mode: sliding_window
  cookie_name: session_token
  secure_only: false
security:
  rate_limit_attempts: 5
  rate_limit_window_seconds: 300
  min_password_length: 8
  require_https: false
"#;
        let config_path = create_test_config_file(&temp_dir, config_content);
        let loader = ConfigLoader::new(config_path);

        let config = loader.load().unwrap();
        assert_eq!(config.mode, AuthMode::Open);
    }

    #[test]
    fn test_validate_local_user_empty_username() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let user = LocalUser {
            username: String::new(),
            password_hash: "$2b$12$abcdefghijklmnopqrstuv".to_string(),
            hash_algorithm: HashAlgorithm::Bcrypt,
            roles: vec!["admin".to_string()],
        };

        let result = loader.validate_local_user(&user);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Username cannot be empty"));
    }

    #[test]
    fn test_validate_local_user_invalid_bcrypt_hash() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let user = LocalUser {
            username: "admin".to_string(),
            password_hash: "invalid_hash".to_string(),
            hash_algorithm: HashAlgorithm::Bcrypt,
            roles: vec!["admin".to_string()],
        };

        let result = loader.validate_local_user(&user);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid bcrypt hash format"));
    }

    #[test]
    fn test_validate_local_user_invalid_argon2_hash() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let user = LocalUser {
            username: "admin".to_string(),
            password_hash: "invalid_hash".to_string(),
            hash_algorithm: HashAlgorithm::Argon2,
            roles: vec!["admin".to_string()],
        };

        let result = loader.validate_local_user(&user);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Invalid argon2 hash format"));
    }

    #[test]
    fn test_validate_oidc_config_missing_client_id() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let oidc = OidcConfig {
            client_id: String::new(),
            client_secret: "secret".to_string(),
            redirect_uri: "http://localhost/callback".to_string(),
            discovery_url: Some("https://idp.example.com/.well-known/openid-configuration".to_string()),
            authorization_endpoint: None,
            token_endpoint: None,
            userinfo_endpoint: None,
            jwks_uri: None,
            group_claim_key: None,
            required_groups: vec![],
        };

        let result = loader.validate_oidc_config(&oidc);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("client_id is required"));
    }

    #[test]
    fn test_validate_oidc_config_incomplete_manual_endpoints() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let oidc = OidcConfig {
            client_id: "client".to_string(),
            client_secret: "secret".to_string(),
            redirect_uri: "http://localhost/callback".to_string(),
            discovery_url: None,
            authorization_endpoint: Some("https://idp.example.com/auth".to_string()),
            token_endpoint: None, // Missing
            userinfo_endpoint: None, // Missing
            jwks_uri: None, // Missing
            group_claim_key: None,
            required_groups: vec![],
        };

        let result = loader.validate_oidc_config(&oidc);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("either discovery_url or all manual endpoints"));
    }

    #[test]
    fn test_validate_local_mode_missing_config() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let config = AuthConfig {
            mode: AuthMode::Local,
            local: None,
            oidc: None,
            session: SessionConfig {
                timeout_seconds: 3600,
                renewal_mode: RenewalMode::SlidingWindow,
                cookie_name: "session".to_string(),
                secure_only: true,
            },
            security: SecurityConfig {
                rate_limit_attempts: 5,
                rate_limit_window_seconds: 300,
                min_password_length: 8,
                require_https: false,
            },
        };

        let result = loader.validate(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("Local auth mode requires local configuration"));
    }

    #[test]
    fn test_validate_oidc_mode_missing_config() {
        let loader = ConfigLoader::new(PathBuf::from("test.yaml"));
        let config = AuthConfig {
            mode: AuthMode::Oidc,
            local: None,
            oidc: None,
            session: SessionConfig {
                timeout_seconds: 3600,
                renewal_mode: RenewalMode::SlidingWindow,
                cookie_name: "session".to_string(),
                secure_only: true,
            },
            security: SecurityConfig {
                rate_limit_attempts: 5,
                rate_limit_window_seconds: 300,
                min_password_length: 8,
                require_https: false,
            },
        };

        let result = loader.validate(&config);
        assert!(result.is_err());
        assert!(result.unwrap_err().to_string().contains("OIDC auth mode requires OIDC configuration"));
    }
}
