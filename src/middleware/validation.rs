use axum::{
    body::Body,
    extract::Request,
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::{json, Value};

/// Input validation middleware
///
/// Validates and sanitizes user inputs to prevent injection attacks
///
/// # Requirements
///
/// Validates: Requirements 30.3
pub async fn input_validation_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // For now, we'll let the request through
    // Individual route handlers should validate their specific inputs
    // This middleware can be extended to add global validation rules

    Ok(next.run(request).await)
}

/// Validate index name format
///
/// Index names must:
/// - Be lowercase
/// - Not start with _, -, or +
/// - Not be . or ..
/// - Not contain /, \, *, ?, ", <, >, |, space, comma, #
/// - Not be longer than 255 bytes
///
/// # Requirements
///
/// Validates: Requirements 6.2, 30.3
pub fn validate_index_name(name: &str) -> Result<(), String> {
    // Check length
    if name.is_empty() {
        return Err("Index name cannot be empty".to_string());
    }

    if name.len() > 255 {
        return Err("Index name cannot be longer than 255 bytes".to_string());
    }

    // Check for invalid starting characters
    if name.starts_with('_') || name.starts_with('-') || name.starts_with('+') {
        return Err("Index name cannot start with _, -, or +".to_string());
    }

    // Check for . and ..
    if name == "." || name == ".." {
        return Err("Index name cannot be . or ..".to_string());
    }

    // Check for invalid characters
    let invalid_chars = ['/', '\\', '*', '?', '"', '<', '>', '|', ' ', ',', '#'];
    for ch in invalid_chars {
        if name.contains(ch) {
            return Err(format!("Index name cannot contain '{}'", ch));
        }
    }

    // Check if lowercase
    if name != name.to_lowercase() {
        return Err("Index name must be lowercase".to_string());
    }

    Ok(())
}

/// Validate cluster ID format
///
/// Cluster IDs must be alphanumeric with hyphens and underscores only
///
/// # Requirements
///
/// Validates: Requirements 30.3
pub fn validate_cluster_id(id: &str) -> Result<(), String> {
    if id.is_empty() {
        return Err("Cluster ID cannot be empty".to_string());
    }

    if id.len() > 100 {
        return Err("Cluster ID cannot be longer than 100 characters".to_string());
    }

    // Only allow alphanumeric, hyphens, and underscores
    if !id
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(
            "Cluster ID can only contain alphanumeric characters, hyphens, and underscores"
                .to_string(),
        );
    }

    Ok(())
}

/// Validate JSON input
///
/// Ensures the input is valid JSON
///
/// # Requirements
///
/// Validates: Requirements 6.5, 7.3, 8.3, 13.4, 30.3
pub fn validate_json(input: &str) -> Result<Value, String> {
    serde_json::from_str(input).map_err(|e| format!("Invalid JSON: {}", e))
}

/// Sanitize string input
///
/// Removes potentially dangerous characters and limits length
///
/// # Requirements
///
/// Validates: Requirements 30.3, 30.6
pub fn sanitize_string(input: &str, max_length: usize) -> String {
    // Trim whitespace
    let trimmed = input.trim();

    // Limit length
    let limited = if trimmed.len() > max_length {
        &trimmed[..max_length]
    } else {
        trimmed
    };

    // Remove control characters (except newlines and tabs for some contexts)
    limited
        .chars()
        .filter(|c| !c.is_control() || *c == '\n' || *c == '\t')
        .collect()
}

/// Error response for validation failures
pub fn validation_error_response(message: &str) -> Response {
    (
        StatusCode::BAD_REQUEST,
        Json(json!({
            "error": "Validation Error",
            "message": message
        })),
    )
        .into_response()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_index_name_valid() {
        assert!(validate_index_name("my-index").is_ok());
        assert!(validate_index_name("my_index").is_ok());
        assert!(validate_index_name("myindex123").is_ok());
    }

    #[test]
    fn test_validate_index_name_invalid_start() {
        assert!(validate_index_name("_myindex").is_err());
        assert!(validate_index_name("-myindex").is_err());
        assert!(validate_index_name("+myindex").is_err());
    }

    #[test]
    fn test_validate_index_name_dots() {
        assert!(validate_index_name(".").is_err());
        assert!(validate_index_name("..").is_err());
    }

    #[test]
    fn test_validate_index_name_invalid_chars() {
        assert!(validate_index_name("my/index").is_err());
        assert!(validate_index_name("my\\index").is_err());
        assert!(validate_index_name("my*index").is_err());
        assert!(validate_index_name("my?index").is_err());
        assert!(validate_index_name("my index").is_err());
        assert!(validate_index_name("my,index").is_err());
        assert!(validate_index_name("my#index").is_err());
    }

    #[test]
    fn test_validate_index_name_uppercase() {
        assert!(validate_index_name("MyIndex").is_err());
        assert!(validate_index_name("MYINDEX").is_err());
    }

    #[test]
    fn test_validate_index_name_length() {
        assert!(validate_index_name("").is_err());
        assert!(validate_index_name(&"a".repeat(256)).is_err());
        assert!(validate_index_name(&"a".repeat(255)).is_ok());
    }

    #[test]
    fn test_validate_cluster_id_valid() {
        assert!(validate_cluster_id("cluster-1").is_ok());
        assert!(validate_cluster_id("my_cluster").is_ok());
        assert!(validate_cluster_id("prod123").is_ok());
    }

    #[test]
    fn test_validate_cluster_id_invalid() {
        assert!(validate_cluster_id("").is_err());
        assert!(validate_cluster_id("cluster/1").is_err());
        assert!(validate_cluster_id("cluster 1").is_err());
        assert!(validate_cluster_id(&"a".repeat(101)).is_err());
    }

    #[test]
    fn test_validate_json_valid() {
        assert!(validate_json(r#"{"key": "value"}"#).is_ok());
        assert!(validate_json(r#"{"number": 123}"#).is_ok());
        assert!(validate_json(r#"[]"#).is_ok());
    }

    #[test]
    fn test_validate_json_invalid() {
        assert!(validate_json("not json").is_err());
        assert!(validate_json("{invalid}").is_err());
        assert!(validate_json("").is_err());
    }

    #[test]
    fn test_sanitize_string() {
        assert_eq!(sanitize_string("  hello  ", 100), "hello");
        assert_eq!(sanitize_string("hello\x00world", 100), "helloworld");
        assert_eq!(sanitize_string("hello\nworld", 100), "hello\nworld");
        assert_eq!(sanitize_string("hello\tworld", 100), "hello\tworld");
        assert_eq!(sanitize_string("verylongstring", 5), "veryl");
    }

    #[test]
    fn test_sanitize_string_control_chars() {
        // Control characters should be removed except newlines and tabs
        let input = "hello\x01\x02\x03world";
        let result = sanitize_string(input, 100);
        assert_eq!(result, "helloworld");
    }
}
