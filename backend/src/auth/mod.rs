//! Authentication module for Cerebro
//!
//! This module provides authentication and session management functionality,
//! supporting multiple authentication modes: local users, OpenID Connect (OIDC),
//! and open mode for development.

pub mod config;
pub mod local;
pub mod middleware;
pub mod oidc;
pub mod open;
pub mod provider;
pub mod session;

// Re-export commonly used types
pub use config::{AuthConfig, AuthMode, LocalAuthConfig, OidcConfig, SessionConfig};
pub use middleware::AuthMiddleware;
pub use provider::{AuthProvider, AuthProviderFactory, AuthRequest, AuthResponse};
pub use session::{SessionManager, UserInfo};
