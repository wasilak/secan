use axum::{http::StatusCode, Json};
use serde::{Deserialize, Serialize};
use std::process::Command;

/// Health check response
#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub message: String,
}

/// Version response
#[derive(Debug, Serialize, Deserialize)]
pub struct VersionResponse {
    pub version: String,
    pub git_info: String,
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

/// Version endpoint
///
/// Returns the current version and git information
/// This endpoint does not require authentication
pub async fn get_version() -> (StatusCode, Json<VersionResponse>) {
    tracing::debug!("Version check requested");

    let version = env!("CARGO_PKG_VERSION").to_string();
    
    // Try to get git info (tag or branch)
    let git_info = get_git_info().unwrap_or_else(|_| "unknown".to_string());

    (
        StatusCode::OK,
        Json(VersionResponse {
            version,
            git_info,
        }),
    )
}

/// Get git information from the current commit
/// Tries to get tag first, falls back to branch name
fn get_git_info() -> Result<String, Box<dyn std::error::Error>> {
    // Try to get the latest tag that matches v*.*.* pattern
    let tag_output = Command::new("git")
        .args(["describe", "--tags", "--match", "v*.*.*", "--exact-match"])
        .output();

    if let Ok(output) = tag_output {
        if output.status.success() {
            let tag = String::from_utf8(output.stdout)?.trim().to_string();
            return Ok(tag);
        }
    }

    // Fall back to branch name
    let branch_output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .output()?;

    if branch_output.status.success() {
        let branch = String::from_utf8(branch_output.stdout)?.trim().to_string();
        return Ok(branch);
    }

    Err("Could not determine git info".into())
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

    #[tokio::test]
    async fn test_get_version() {
        let (status, response) = get_version().await;

        assert_eq!(status, StatusCode::OK);
        assert_eq!(response.version, env!("CARGO_PKG_VERSION"));
        // git_info could be tag, branch, or "unknown" depending on environment
        assert!(!response.git_info.is_empty());
    }

    #[test]
    fn test_version_response_serialization() {
        let response = VersionResponse {
            version: "1.0.0".to_string(),
            git_info: "main".to_string(),
        };

        let json = serde_json::to_string(&response).unwrap();
        assert!(json.contains("\"version\":\"1.0.0\""));
        assert!(json.contains("\"git_info\":\"main\""));
    }
}
