//! Authentication provider interface and factory
//!
//! This module defines the core authentication provider trait and factory
//! for creating provider instances based on configuration.

use async_trait::async_trait;
use anyhow::Result;

use super::session::UserInfo;

/// Authentication request types
#[derive(Debug, Clone)]
pub enum AuthRequest {
    LocalCredentials {
        username: String,
        password: String,
    },
    OidcCallback {
        code: String,
        state: String,
    },
    Open,
}

/// Authentication response
#[derive(Debug, Clone)]
pub struct AuthResponse {
    pub user_info: UserInfo,
    pub session_token: String,
}

/// Authentication provider trait
#[async_trait]
pub trait AuthProvider: Send + Sync {
    /// Authenticate a user based on the request type
    async fn authenticate(&self, request: AuthRequest) -> Result<AuthResponse>;
    
    /// Get the provider type identifier
    fn provider_type(&self) -> &str;
}

/// Authentication provider factory (placeholder for task 5)
pub struct AuthProviderFactory {
    // Implementation will be added in task 5
}

impl AuthProviderFactory {
    /// Create a new provider factory (placeholder)
    pub fn new() -> Self {
        Self {}
    }
}
