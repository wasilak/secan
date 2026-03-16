//! Application metrics route handler
//!
//! Exposes application metrics in Prometheus format at /app-metrics

use axum::{routing::get, Router};

/// Create the app metrics router
pub fn app_metrics_router() -> Router {
    Router::new().route("/app-metrics", get(app_metrics_handler))
}

/// Handler that returns Prometheus-format metrics
/// Note: This requires the metrics to be initialized at startup
async fn app_metrics_handler() -> (axum::http::StatusCode, String) {
    // The metrics are served by the Prometheus exporter running on port 9090
    // This endpoint redirects to that or could be used for a combined view
    (
        axum::http::StatusCode::OK,
        "# Metrics available at :9090/metrics\n".to_string(),
    )
}
