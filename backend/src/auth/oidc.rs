//! OpenID Connect (OIDC) authentication provider
//!
//! This module implements authentication using an external OIDC identity provider
//! with support for auto-discovery and group-based access control.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::sync::Arc;

use super::config::OidcConfig;
use super::provider::{AuthProvider, AuthRequest, AuthResponse};
use super::session::SessionManager;

/// OIDC authentication provider (placeholder for task 7)
pub struct OidcAuthProvider {
    #[allow(dead_code)]
    config: OidcConfig,
    #[allow(dead_code)]
    session_manager: Arc<SessionManager>,
}

impl OidcAuthProvider {
    /// Create a new OIDC authentication provider (placeholder)
    pub fn new(config: OidcConfig, session_manager: Arc<SessionManager>) -> Result<Self> {
        Ok(Self {
            config,
            session_manager,
        })
    }
}

#[async_trait]
impl AuthProvider for OidcAuthProvider {
    async fn authenticate(&self, _request: AuthRequest) -> Result<AuthResponse> {
        // Implementation will be added in task 7
        Err(anyhow!("OIDC authentication not yet implemented"))
    }

    fn provider_type(&self) -> &str {
        "oidc"
    }
}
