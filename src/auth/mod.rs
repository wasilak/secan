// Authentication module
pub mod ldap;
pub mod local;
pub mod middleware;
pub mod oidc;
pub mod permissions;
pub mod rate_limiter;
pub mod rbac;
pub mod session;

pub use ldap::{sanitize_ldap_input, LdapAuthProvider};
pub use local::{hash_password, verify_password, LocalAuthProvider};
pub use middleware::{auth_middleware, AuthError, AuthState, AuthenticatedUser};
pub use oidc::OidcAuthProvider;
pub use permissions::{filter_clusters, PermissionResolver};
pub use rate_limiter::{RateLimitConfig, RateLimiter};
pub use rbac::{RbacManager, Role};
pub use session::{
    build_session_cookie_header, generate_token, AuthUser, Session, SessionConfig, SessionManager,
    SessionValidation,
};
