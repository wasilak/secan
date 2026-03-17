// API routes module
pub mod app_metrics;
pub mod auth;
pub mod clusters;
pub mod health;
pub mod metrics;
pub mod openapi;
pub mod static_assets;
pub mod telemetry;

pub use auth::{AuthState, ErrorResponse, LoginRequest, LoginResponse, OidcCallbackQuery};
pub use clusters::{ClusterErrorResponse, ClusterState};
pub use health::HealthResponse;
pub use metrics::MetricsState;
pub use openapi::ApiDoc;
pub use static_assets::serve_static;
