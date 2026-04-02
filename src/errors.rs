//! Central error type definitions for Secan
//!
//! This module provides a comprehensive error hierarchy for the application:
//! - [`AppError`] - Main application error enum using thiserror
//! - Error types for specific domains (Cluster, Auth, Config)
//! - Integration with anyhow for application-level error handling
//!
//! # Usage
//!
//! ```rust
//! use secan::errors::AppError;
//!
//! fn handle_error(err: AppError) {
//!     match err {
//!         AppError::Cluster(e) => println!("Cluster error: {}", e),
//!         AppError::Auth(e) => println!("Auth error: {}", e),
//!         AppError::Config(e) => println!("Config error: {}", e),
//!         AppError::Validation(msg) => println!("Validation error: {}", msg),
//!         AppError::Internal(msg) => println!("Internal error: {}", msg),
//!     }
//! }
//! ```

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Serialize;

/// Main application error enum
///
/// This is the primary error type for the application, combining
/// domain-specific errors with thiserror for nice Display implementations.
#[derive(thiserror::Error, Debug)]
pub enum AppError {
    /// Cluster-related errors
    #[error("Cluster error: {0}")]
    Cluster(#[from] ClusterError),

    /// Authentication/Authorization errors
    #[error("Auth error: {0}")]
    Auth(#[from] AuthError),

    /// Configuration errors
    #[error("Config error: {0}")]
    Config(#[from] ConfigError),

    /// Request/Input validation errors
    #[error("Validation error: {0}")]
    Validation(String),

    /// Internal server errors
    #[error("Internal error: {0}")]
    Internal(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_code, message) = match self {
            AppError::Cluster(e) => (StatusCode::BAD_GATEWAY, "cluster_error", e.to_string()),
            AppError::Auth(e) => {
                let status = match e {
                    AuthError::Unauthorized => StatusCode::UNAUTHORIZED,
                    AuthError::Forbidden => StatusCode::FORBIDDEN,
                    _ => StatusCode::INTERNAL_SERVER_ERROR,
                };
                (status, "auth_error", e.to_string())
            }
            AppError::Config(e) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                "config_error",
                e.to_string(),
            ),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, "validation_error", msg),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, "internal_error", msg),
        };

        #[derive(Serialize)]
        struct ErrorResponse {
            error: String,
            message: String,
        }

        (
            status,
            Json(ErrorResponse {
                error: error_code.to_string(),
                message,
            }),
        )
            .into_response()
    }
}

impl From<anyhow::Error> for AppError {
    fn from(err: anyhow::Error) -> Self {
        AppError::Internal(err.to_string())
    }
}

/// Cluster-related errors
#[derive(thiserror::Error, Debug)]
pub enum ClusterError {
    /// Failed to connect to cluster
    #[error("Failed to connect to cluster '{cluster_id}': {message}")]
    Connection { cluster_id: String, message: String },

    /// Cluster not found
    #[error("Cluster '{0}' not found")]
    NotFound(String),

    /// Request to cluster failed
    #[error("Request to cluster '{cluster_id}' failed: {message}")]
    RequestFailed { cluster_id: String, message: String },

    /// Timeout waiting for cluster
    #[error("Timeout waiting for cluster '{0}'")]
    Timeout(String),

    /// Invalid cluster configuration
    #[error("Invalid cluster configuration: {0}")]
    InvalidConfig(String),
}

/// Authentication/Authorization errors
#[derive(thiserror::Error, Debug)]
pub enum AuthError {
    /// User is not authenticated
    #[error("Unauthorized")]
    Unauthorized,

    /// User is authenticated but lacks permission
    #[error("Forbidden")]
    Forbidden,

    /// Invalid credentials
    #[error("Invalid credentials: {0}")]
    InvalidCredentials(String),

    /// Session expired or invalid
    #[error("Session expired or invalid")]
    SessionExpired,

    /// Rate limit exceeded
    #[error("Rate limit exceeded: {0}")]
    RateLimited(String),

    /// Configuration error in auth module
    #[error("Auth configuration error: {0}")]
    ConfigError(String),
}

/// Configuration errors
#[derive(thiserror::Error, Debug)]
pub enum ConfigError {
    /// Required configuration field is missing
    #[error("Missing required configuration: {0}")]
    MissingField(String),

    /// Invalid configuration value
    #[error("Invalid configuration value for '{field}': {message}")]
    InvalidValue { field: String, message: String },

    /// Failed to parse configuration file
    #[error("Failed to parse configuration: {0}")]
    ParseError(String),

    /// Configuration file not found
    #[error("Configuration file not found: {0}")]
    FileNotFound(String),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_app_error_display() {
        let cluster_err = ClusterError::NotFound("test-cluster".to_string());
        let app_err = AppError::Cluster(cluster_err);
        assert!(app_err.to_string().contains("test-cluster"));

        let auth_err = AuthError::SessionExpired;
        let app_err = AppError::Auth(auth_err);
        assert!(app_err.to_string().contains("Session expired"));
    }

    #[test]
    fn test_error_conversion() {
        let cluster_err = ClusterError::NotFound("prod-es".to_string());
        let app_err: AppError = cluster_err.into();
        assert!(matches!(app_err, AppError::Cluster(_)));

        let anyhow_err = anyhow::anyhow!("test error");
        let app_err: AppError = anyhow_err.into();
        assert!(matches!(app_err, AppError::Internal(_)));
    }

    #[test]
    fn test_cluster_error_variants() {
        let err = ClusterError::Connection {
            cluster_id: "test".to_string(),
            message: "connection refused".to_string(),
        };
        assert!(err.to_string().contains("test"));
        assert!(err.to_string().contains("connection refused"));

        let err = ClusterError::Timeout("es-prod".to_string());
        assert!(err.to_string().contains("es-prod"));
        assert!(err.to_string().contains("Timeout"));
    }

    #[test]
    fn test_auth_error_variants() {
        let err = AuthError::InvalidCredentials("user not found".to_string());
        assert!(err.to_string().contains("Invalid credentials"));
        assert!(err.to_string().contains("user not found"));

        let err = AuthError::RateLimited("too many requests".to_string());
        assert!(err.to_string().contains("Rate limit"));
    }

    #[test]
    fn test_config_error_variants() {
        let err = ConfigError::MissingField("api_key".to_string());
        assert!(err.to_string().contains("Missing"));
        assert!(err.to_string().contains("api_key"));

        let err = ConfigError::InvalidValue {
            field: "port".to_string(),
            message: "must be between 1 and 65535".to_string(),
        };
        assert!(err.to_string().contains("port"));
        assert!(err.to_string().contains("Invalid"));
    }

    #[test]
    fn test_app_error_into_response() {
        let auth_err = AuthError::Unauthorized;
        let app_err: AppError = auth_err.into();
        let response = app_err.into_response();
        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);

        let cluster_err = ClusterError::NotFound("missing".to_string());
        let app_err: AppError = cluster_err.into();
        let response = app_err.into_response();
        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
    }
}
