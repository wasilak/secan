// Authentication module
pub mod local;
pub mod session;

pub use local::{hash_password, verify_password, LocalAuthProvider};
pub use session::{generate_token, AuthUser, Session, SessionConfig, SessionManager, SessionStore};
