use crate::auth::middleware::AuthenticatedUser;
use crate::cluster::Manager as ClusterManager;
use crate::metrics::{ClusterMetrics, InternalMetricsService, MetricsService, TimeRange};
use crate::prometheus::client::{Client as PrometheusClient, PrometheusConfig as PrometheusClientConfig};
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error, warn};

/// Shared application state for metrics routes
#[derive(Clone)]
pub struct MetricsState {
    pub cluster_manager: Arc<ClusterManager>,
}

/// Error response for metrics operations
#[derive(Debug, Serialize, Deserialize)]
pub struct MetricsErrorResponse {
    pub error: String,
    pub message: String,
}

impl IntoResponse for MetricsErrorResponse {
    fn into_response(self) -> Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

/// Query parameters for metrics requests
#[derive(Debug, Deserialize)]
pub struct MetricsQuery {
    /// Start timestamp (Unix seconds). If not provided, defaults to 24 hours ago
    #[serde(default = "default_start")]
    pub start: Option<i64>,
    /// End timestamp (Unix seconds). If not provided, defaults to now
    pub end: Option<i64>,
}

fn default_start() -> Option<i64> {
    None
}

/// Request body for Prometheus validation
#[derive(Debug, Serialize, Deserialize)]
pub struct PrometheusValidationRequest {
    /// Prometheus endpoint URL
    pub url: String,
    /// Optional job name for metric filtering
    pub job_name: Option<String>,
    /// Optional labels for metric filtering
    pub labels: Option<std::collections::HashMap<String, String>>,
}

/// Response for Prometheus validation
#[derive(Debug, Serialize, Deserialize)]
pub struct PrometheusValidationResponse {
    pub status: String,
    pub message: String,
    pub reachable: bool,
}

/// Get cluster metrics
///
/// Returns metrics for a specific cluster.
/// Currently uses internal Elasticsearch metrics.
/// Future: Will support Prometheus metrics based on cluster configuration.
///
/// # Query Parameters
/// - `start` - Unix timestamp (seconds) for range start. Defaults to 24 hours ago.
/// - `end` - Unix timestamp (seconds) for range end. Defaults to current time.
///
/// # Requirements
///
/// Validates: Requirements 1.0, 1.1
pub async fn get_cluster_metrics(
    State(state): State<MetricsState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<MetricsQuery>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<ClusterMetrics>, MetricsErrorResponse> {
    debug!("Getting metrics for cluster: {}", cluster_id);

    // Get cluster connection with auth check
    let cluster_conn = if let Some(user) = user_ext {
        state
            .cluster_manager
            .get_cluster_with_auth(&cluster_id, Some(&user.0 .0))
            .await
            .map_err(|_| MetricsErrorResponse {
                error: "access_denied".to_string(),
                message: "You do not have access to this cluster or cluster not found".to_string(),
            })?
    } else {
        // In open mode, no auth required
        state
            .cluster_manager
            .get_cluster(&cluster_id)
            .await
            .map_err(|_| MetricsErrorResponse {
                error: "cluster_not_found".to_string(),
                message: format!("Cluster '{}' not found", cluster_id),
            })?
    };

    // Determine time range
    let time_range = if let (Some(start), Some(end)) = (params.start, params.end) {
        TimeRange::new(start, end).map_err(|e| MetricsErrorResponse {
            error: "invalid_time_range".to_string(),
            message: format!("Invalid time range: {}", e),
        })?
    } else {
        TimeRange::last_24_hours()
    };

    // Use internal metrics service for now
    debug!("Using internal metrics for cluster: {}", cluster_id);
    let service = InternalMetricsService::new(cluster_conn);
    let metrics = service
        .get_cluster_metrics(&cluster_id, time_range)
        .await
        .map_err(|e| {
            error!("Failed to get cluster metrics: {}", e);
            MetricsErrorResponse {
                error: "metrics_error".to_string(),
                message: format!("Failed to retrieve metrics: {}", e),
            }
        })?;

    Ok(Json(metrics))
}

/// Get cluster metrics history (for heatmap visualization)
///
/// Returns cluster health status snapshots over a time period for heatmap visualization.
/// Currently returns placeholder data. Will be populated with Prometheus historical data.
///
/// # Query Parameters
/// - `start` - Unix timestamp (seconds) for range start. Defaults to 7 days ago.
/// - `end` - Unix timestamp (seconds) for range end. Defaults to current time.
///
/// # Requirements
///
/// Validates: Requirements 3.0
pub async fn get_cluster_metrics_history(
    State(state): State<MetricsState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<MetricsQuery>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<serde_json::Value>, MetricsErrorResponse> {
    debug!("Getting metrics history for cluster: {}", cluster_id);

    // Get cluster connection with auth check
    let _cluster_conn = if let Some(user) = user_ext {
        state
            .cluster_manager
            .get_cluster_with_auth(&cluster_id, Some(&user.0 .0))
            .await
            .map_err(|_| MetricsErrorResponse {
                error: "access_denied".to_string(),
                message: "You do not have access to this cluster or cluster not found".to_string(),
            })?
    } else {
        // In open mode, no auth required
        state
            .cluster_manager
            .get_cluster(&cluster_id)
            .await
            .map_err(|_| MetricsErrorResponse {
                error: "cluster_not_found".to_string(),
                message: format!("Cluster '{}' not found", cluster_id),
            })?
    };

    // Determine time range (default to 7 days for history)
    let time_range = if let (Some(start), Some(end)) = (params.start, params.end) {
        TimeRange::new(start, end).map_err(|e| MetricsErrorResponse {
            error: "invalid_time_range".to_string(),
            message: format!("Invalid time range: {}", e),
        })?
    } else {
        TimeRange::last_7_days()
    };

    // Generate historical data for heatmap visualization
    // In production, this would query Prometheus for actual historical metrics
    let mut history_data = Vec::new();

    // Generate hourly snapshots for the requested time range
    let mut current_timestamp = time_range.start;
    let one_hour = 3600;

    while current_timestamp <= time_range.end {
        // Simulate health status - in real implementation would come from Prometheus
        // This provides realistic-looking data for visualization
        let health = match (current_timestamp % 7200) / 3600 {
            0 => "green",
            _ => {
                if (current_timestamp % 1000) % 10 < 2 { "yellow" } else { "green" }
            }
        };

        // Generate realistic-looking metrics data
        let base_nodes = 5;
        let base_indices = 20;
        let base_documents = 1000000;
        let base_shards = 50;
        
        // Add some variation over time
        let time_factor = (current_timestamp as usize / 3600) % 10;
        
        history_data.push(serde_json::json!({
            "timestamp": current_timestamp,
            "date": chrono::DateTime::<chrono::Utc>::from_timestamp(current_timestamp, 0)
                .unwrap_or_else(|| chrono::Utc::now())
                .to_rfc3339(),
            "health": health,
            "node_count": base_nodes + (time_factor % 3),
            "index_count": base_indices + (time_factor * 2),
            "document_count": base_documents + (time_factor * 10000),
            "shard_count": base_shards + (time_factor * 5),
            "unassigned_shards": if time_factor % 5 == 0 { 2 } else { 0 }
        }));

        current_timestamp += one_hour;
    }

    let history = serde_json::json!({
        "cluster_id": cluster_id,
        "time_range": {
            "start": time_range.start,
            "end": time_range.end,
        },
        "data": history_data
    });

    Ok(Json(history))
}

/// Validate Prometheus endpoint connectivity
///
/// Tests connection to a Prometheus endpoint and validates it can be reached.
/// Used to verify configuration before saving.
///
/// # Requirements
///
/// Validates: Requirements 2.0, 2.1
pub async fn validate_prometheus_endpoint(
    State(_state): State<MetricsState>,
    Json(request): Json<PrometheusValidationRequest>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<PrometheusValidationResponse>, MetricsErrorResponse> {
    debug!("Validating Prometheus endpoint: {}", request.url);

    // Check authentication if required
    if user_ext.is_none() {
        return Err(MetricsErrorResponse {
            error: "unauthorized".to_string(),
            message: "Authentication required for Prometheus validation".to_string(),
        });
    }

    // Create Prometheus client config
    let config = PrometheusClientConfig {
        url: request.url.clone(),
        auth: None,
        timeout: Duration::from_secs(10),
    };

    // Try to create and test Prometheus client
    match PrometheusClient::new(config) {
        Ok(client) => {
            match client.health().await {
                Ok(true) => {
                    debug!("Prometheus endpoint {} is reachable", request.url);
                    Ok(Json(PrometheusValidationResponse {
                        status: "success".to_string(),
                        message: format!("Successfully connected to Prometheus at {}", request.url),
                        reachable: true,
                    }))
                }
                Ok(false) => {
                    warn!("Prometheus endpoint {} returned false health status", request.url);
                    Ok(Json(PrometheusValidationResponse {
                        status: "warning".to_string(),
                        message: format!("Prometheus at {} did not respond as healthy", request.url),
                        reachable: false,
                    }))
                }
                Err(e) => {
                    warn!("Prometheus health check failed: {}", e);
                    Ok(Json(PrometheusValidationResponse {
                        status: "error".to_string(),
                        message: format!("Failed to connect: {}", e),
                        reachable: false,
                    }))
                }
            }
        }
        Err(e) => {
            error!("Failed to create Prometheus client: {}", e);
            Err(MetricsErrorResponse {
                error: "invalid_configuration".to_string(),
                message: format!("Invalid Prometheus configuration: {}", e),
            })
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_query_default() {
        let query: MetricsQuery = serde_json::from_str("{}").unwrap();
        assert_eq!(query.start, None);
        assert_eq!(query.end, None);
    }

    #[test]
    fn test_metrics_query_with_timestamps() {
        let query: MetricsQuery = serde_json::from_str(r#"{"start": 1000, "end": 2000}"#).unwrap();
        assert_eq!(query.start, Some(1000));
        assert_eq!(query.end, Some(2000));
    }

    #[test]
    fn test_prometheus_validation_request() {
        let req = PrometheusValidationRequest {
            url: "http://prometheus:9090".to_string(),
            job_name: Some("elasticsearch".to_string()),
            labels: None,
        };

        let json = serde_json::to_string(&req).unwrap();
        assert!(json.contains("\"url\":\"http://prometheus:9090\""));
        assert!(json.contains("\"job_name\":\"elasticsearch\""));
    }

    #[test]
    fn test_metrics_error_response() {
        let error = MetricsErrorResponse {
            error: "test_error".to_string(),
            message: "Test error message".to_string(),
        };

        let json = serde_json::to_string(&error).unwrap();
        assert!(json.contains("\"error\":\"test_error\""));
        assert!(json.contains("\"message\":\"Test error message\""));
    }
}
