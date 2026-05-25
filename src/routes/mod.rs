// API routes module
pub mod app_metrics;
pub mod auth;
pub mod cluster_client;
pub mod clusters;
pub mod component_templates;
pub mod health;
pub mod metrics;
pub mod openapi;
pub mod static_assets;
pub mod telemetry;
pub mod templates;
pub mod topology;
pub mod aliases;

pub use auth::{AuthState, ErrorResponse, LoginRequest, LoginResponse, OidcCallbackQuery};
pub use clusters::{ClusterErrorResponse, ClusterState};
pub use health::HealthResponse;
pub use metrics::MetricsState;
pub use openapi::ApiDoc;
pub use static_assets::serve_static;
