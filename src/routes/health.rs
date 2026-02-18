use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};

/// Health check response
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub message: String,
}

/// Health check endpoint
///
/// Returns HTTP 200 if the server is healthy
/// This endpoint does not require authentication
///
/// # Requirements
///
/// Validates: Requirements 39.1, 39.2, 39.5
pub async fn health_check() -> (StatusCode, Json<HealthResponse>) {
    tracing::debug!("Health check requested");

    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "healthy".to_string(),
            message: "Server is running".to_string(),
        }),
    )
}

/// Readiness check endpoint
///
/// Returns HTTP 200 if the server is ready to accept requests
/// This endpoint does not require authentication
///
/// # Requirements
///
/// Validates: Requirements 39.3, 39.6
pub async fn readiness_check() -> (StatusCode, Json<HealthResponse>) {
    tracing::debug!("Readiness check requested");

    // TODO: Add checks for:
    // - Cluster connectivity
    // - Session manager availability
    // For now, always return ready

    (
        StatusCode::OK,
        Json(HealthResponse {
            status: "ready".to_string(),
            message: "Server is ready to accept requests".to_string(),
        }),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_health_check() {
        let (status, response) = health_check().await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(response.status, "healthy");
        assert_eq!(response.message, "Server is running");
    }

    #[tokio::test]
    async fn test_readiness_check() {
        let (status, response) = readiness_check().await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(response.status, "ready");
        assert_eq!(response.message, "Server is ready to accept requests");
    }

    #[test]
    fn test_health_response_serialization() {
        let response = HealthResponse {
            status: "healthy".to_string(),
            message: "All systems operational".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"status\":\"healthy\""));
        assert!(json.contains("\"message\":\"All systems operational\""));
    }

    #[test]
    fn test_health_response_deserialization() {
        let json = r#"{"status":"healthy","message":"Server is running"}"#;
        let response: HealthResponse = serde_json::from_str(json).unwrap();

        assert_eq!(response.status, "healthy");
        assert_eq!(response.message, "Server is running");
    }
}
