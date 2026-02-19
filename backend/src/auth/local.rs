//! Local authentication provider
//!
//! This module implements authentication using locally configured users
//! with bcrypt or argon2 password hashing.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::sync::Arc;

use super::config::LocalAuthConfig;
use super::provider::{AuthProvider, AuthRequest, AuthResponse};
use super::session::SessionManager;

/// Local authentication provider (placeholder for task 6)
pub struct LocalAuthProvider {
    #[allow(dead_code)]
    config: LocalAuthConfig,
    #[allow(dead_code)]
    session_manager: Arc<SessionManager>,
}

impl LocalAuthProvider {
    /// Create a new local authentication provider (placeholder)
    pub fn new(config: LocalAuthConfig, session_manager: Arc<SessionManager>) -> Self {
        Self {
            config,
            session_manager,
        }
    }
}

#[async_trait]
impl AuthProvider for LocalAuthProvider {
    async fn authenticate(&self, _request: AuthRequest) -> Result<AuthResponse> {
        // Implementation will be added in task 6
        Err(anyhow!("Local authentication not yet implemented"))
    }

    fn provider_type(&self) -> &str {
        "local"
    }
}
