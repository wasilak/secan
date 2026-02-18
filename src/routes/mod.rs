// API routes module
pub mod auth;
pub mod clusters;
pub mod health;
pub mod static_assets;

pub use auth::{AuthState, ErrorResponse, LoginRequest, LoginResponse, OidcCallbackQuery};
pub use clusters::{ClusterErrorResponse, ClusterState};
pub use health::HealthResponse;
pub use static_assets::serve_static;
