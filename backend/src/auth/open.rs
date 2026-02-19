//! Open authentication provider
//!
//! This module implements a development-only authentication mode that allows
//! all requests without requiring credentials.

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use std::sync::Arc;

use super::provider::{AuthProvider, AuthRequest, AuthResponse};
use super::session::SessionManager;

/// Open authentication provider (placeholder for task 8)
pub struct OpenAuthProvider {
    #[allow(dead_code)]
    session_manager: Arc<SessionManager>,
}

impl OpenAuthProvider {
    /// Create a new open authentication provider (placeholder)
    pub fn new(session_manager: Arc<SessionManager>) -> Self {
        Self { session_manager }
    }
}

#[async_trait]
impl AuthProvider for OpenAuthProvider {
    async fn authenticate(&self, _request: AuthRequest) -> Result<AuthResponse> {
        // Implementation will be added in task 8
        Err(anyhow!("Open authentication not yet implemented"))
    }

    fn provider_type(&self) -> &str {
        "open"
    }
}
