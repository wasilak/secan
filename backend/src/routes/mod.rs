// API routes module
pub mod auth;

pub use auth::{AuthState, ErrorResponse, LoginRequest, LoginResponse, OidcCallbackQuery};
