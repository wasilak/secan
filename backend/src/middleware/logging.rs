use axum::{
    extract::Request,
    middleware::Next,
    response::Response,
};
use std::time::Instant;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Request ID header name
pub const REQUEST_ID_HEADER: &str = "x-request-id";

/// Logging middleware that logs all HTTP requests with request IDs
///
/// This middleware:
/// - Generates a unique request ID for each request
/// - Logs request details (method, path, request ID)
/// - Logs response details (status code, duration)
/// - Sanitizes sensitive data from logs
///
/// # Requirements
///
/// Validates: Requirements 29.1, 29.4, 29.5, 29.8
pub async fn logging_middleware(mut request: Request, next: Next) -> Response {
    let start = Instant::now();

    // Generate or extract request ID
    let request_id = request
        .headers()
        .get(REQUEST_ID_HEADER)
        .and_then(|v| v.to_str().ok())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let method = request.method().clone();
    let uri = request.uri().clone();
    let path = uri.path().to_string();

    // Sanitize path to avoid logging sensitive data
    let sanitized_path = sanitize_path(&path);

    // Log incoming request
    info!(
        request_id = %request_id,
        method = %method,
        path = %sanitized_path,
        "Incoming request"
    );

    // Insert request ID into request extensions for downstream handlers
    request
        .extensions_mut()
        .insert(RequestId(request_id.clone()));

    // Process request
    let response = next.run(request).await;

    let status = response.status();
    let duration = start.elapsed();

    // Log response based on status code
    match status.as_u16() {
        200..=299 => {
            info!(
                request_id = %request_id,
                method = %method,
                path = %sanitized_path,
                status = status.as_u16(),
                duration_ms = duration.as_millis() as u64,
                "Request completed successfully"
            );
        }
        400..=499 => {
            warn!(
                request_id = %request_id,
                method = %method,
                path = %sanitized_path,
                status = status.as_u16(),
                duration_ms = duration.as_millis() as u64,
                "Request completed with client error"
            );
        }
        500..=599 => {
            error!(
                request_id = %request_id,
                method = %method,
                path = %sanitized_path,
                status = status.as_u16(),
                duration_ms = duration.as_millis() as u64,
                "Request completed with server error"
            );
        }
        _ => {
            info!(
                request_id = %request_id,
                method = %method,
                path = %sanitized_path,
                status = status.as_u16(),
                duration_ms = duration.as_millis() as u64,
                "Request completed"
            );
        }
    }

    // Add request ID to response headers
    let (mut parts, body) = response.into_parts();
    parts.headers.insert(
        REQUEST_ID_HEADER,
        request_id
            .parse()
            .unwrap_or_else(|_| axum::http::HeaderValue::from_static("invalid")),
    );

    Response::from_parts(parts, body)
}

/// Sanitize path to remove sensitive data from logs
///
/// This function removes or masks sensitive information from request paths:
/// - Tokens in query parameters
/// - API keys in query parameters
/// - Passwords in query parameters
///
/// # Requirements
///
/// Validates: Requirements 30.4
fn sanitize_path(path: &str) -> String {
    let mut sanitized = path.to_string();

    // List of sensitive query parameter names to sanitize
    let sensitive_params = ["token", "api_key", "apikey", "password", "secret", "auth"];

    for param in sensitive_params {
        // Match both &param= and ?param=
        let patterns = [format!("?{}=", param), format!("&{}=", param)];

        for pattern in patterns {
            if let Some(start) = sanitized.find(&pattern) {
                let value_start = start + pattern.len();
                let value_end = sanitized[value_start..]
                    .find('&')
                    .map(|i| value_start + i)
                    .unwrap_or(sanitized.len());

                // Replace value with [REDACTED]
                sanitized.replace_range(value_start..value_end, "[REDACTED]");
            }
        }
    }

    sanitized
}

/// Request ID extension type for storing request IDs in request extensions
#[derive(Clone, Debug)]
pub struct RequestId(pub String);

impl RequestId {
    /// Get the request ID as a string
    pub fn as_str(&self) -> &str {
        &self.0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_sanitize_path_with_token() {
        let path = "/api/clusters/test?token=secret123&other=value";
        let sanitized = sanitize_path(path);
        assert!(sanitized.contains("[REDACTED]"));
        assert!(!sanitized.contains("secret123"));
        assert!(sanitized.contains("other=value"));
    }

    #[test]
    fn test_sanitize_path_with_api_key() {
        let path = "/api/clusters/test?api_key=mykey&data=test";
        let sanitized = sanitize_path(path);
        assert!(sanitized.contains("[REDACTED]"));
        assert!(!sanitized.contains("mykey"));
    }

    #[test]
    fn test_sanitize_path_without_sensitive_data() {
        let path = "/api/clusters/test?query=value";
        let sanitized = sanitize_path(path);
        assert_eq!(path, sanitized);
    }

    #[test]
    fn test_sanitize_path_multiple_sensitive_params() {
        let path = "/api/test?token=abc&password=def&normal=ghi";
        let sanitized = sanitize_path(path);
        assert!(sanitized.contains("[REDACTED]"));
        assert!(!sanitized.contains("abc"));
        assert!(!sanitized.contains("def"));
        assert!(sanitized.contains("normal=ghi"));
    }
}
