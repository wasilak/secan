// Authentication module
pub mod local;
pub mod middleware;
pub mod oidc;
pub mod rate_limiter;
pub mod rbac;
pub mod session;

pub use local::{hash_password, verify_password, LocalAuthProvider};
pub use middleware::{auth_middleware, AuthError, AuthState, AuthenticatedUser};
pub use oidc::{IdTokenClaims, Jwk, Jwks, OidcAuthProvider, OidcProviderMetadata, TokenResponse};
pub use rate_limiter::{RateLimitConfig, RateLimiter};
pub use rbac::{RbacManager, Role};
pub use session::{generate_token, AuthUser, Session, SessionConfig, SessionManager, SessionStore};
