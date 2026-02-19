//! Configuration structures for authentication
//!
//! This module defines the configuration data structures for all authentication modes,
//! including local users, OIDC, session management, and security settings.

use serde::{Deserialize, Serialize};

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
