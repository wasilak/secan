use axum::{
    body::Body,
    http::{header, HeaderName, Request, StatusCode},
    middleware::Next,
    response::Response,
};

/// Security headers middleware
///
/// Adds security headers to all responses:
/// - Content-Security-Policy (CSP)
/// - Strict-Transport-Security (HSTS)
/// - X-Frame-Options
/// - X-Content-Type-Options
/// - X-XSS-Protection
///
/// # Requirements
///
/// Validates: Requirements 30.1, 30.2
pub async fn security_headers_middleware(
    request: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Process the request
    let mut response = next.run(request).await;

    // Get headers map
    let headers = response.headers_mut();

    // Content-Security-Policy: Restrict resource loading
    // Allow self for scripts, styles, images, fonts
    // Allow inline styles for Mantine UI
    // Allow data: URIs for images (used by some components)
    // Allow blob: for Monaco Editor web workers
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; worker-src 'self' blob:"
            .parse()
            .unwrap(),
    );

    // Strict-Transport-Security: Force HTTPS for 1 year
    // includeSubDomains: Apply to all subdomains
    // preload: Allow inclusion in browser HSTS preload lists
    headers.insert(
        header::STRICT_TRANSPORT_SECURITY,
        "max-age=31536000; includeSubDomains; preload"
            .parse()
            .unwrap(),
    );

    // X-Frame-Options: Prevent clickjacking
    headers.insert(header::X_FRAME_OPTIONS, "DENY".parse().unwrap());

    // X-Content-Type-Options: Prevent MIME sniffing
    headers.insert(header::X_CONTENT_TYPE_OPTIONS, "nosniff".parse().unwrap());

    // X-XSS-Protection: Enable browser XSS protection
    headers.insert(
        HeaderName::from_static("x-xss-protection"),
        "1; mode=block".parse().unwrap(),
    );

    // Referrer-Policy: Control referrer information
    headers.insert(
        header::REFERRER_POLICY,
        "strict-origin-when-cross-origin".parse().unwrap(),
    );

    // Permissions-Policy: Disable unnecessary browser features
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        "geolocation=(), microphone=(), camera=()".parse().unwrap(),
    );

    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request, routing::get, Router};
    use tower::ServiceExt;

    #[tokio::test]
    async fn test_security_headers_added() {
        // Create a simple test route
        let app = Router::new()
            .route("/test", get(|| async { "test response" }))
            .layer(axum::middleware::from_fn(security_headers_middleware));

        // Make a request
        let response = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();

        // Verify security headers are present
        let headers = response.headers();

        assert!(headers.contains_key(header::CONTENT_SECURITY_POLICY));
        assert!(headers.contains_key(header::STRICT_TRANSPORT_SECURITY));
        assert!(headers.contains_key(header::X_FRAME_OPTIONS));
        assert!(headers.contains_key(header::X_CONTENT_TYPE_OPTIONS));
        assert!(headers.contains_key("x-xss-protection"));
        assert!(headers.contains_key(header::REFERRER_POLICY));
        assert!(headers.contains_key("permissions-policy"));

        // Verify header values
        assert_eq!(headers.get(header::X_FRAME_OPTIONS).unwrap(), "DENY");
        assert_eq!(
            headers.get(header::X_CONTENT_TYPE_OPTIONS).unwrap(),
            "nosniff"
        );
        assert_eq!(headers.get("x-xss-protection").unwrap(), "1; mode=block");
    }

    #[tokio::test]
    async fn test_csp_header_content() {
        let app = Router::new()
            .route("/test", get(|| async { "test" }))
            .layer(axum::middleware::from_fn(security_headers_middleware));

        let response = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let csp = response
            .headers()
            .get(header::CONTENT_SECURITY_POLICY)
            .unwrap()
            .to_str()
            .unwrap();

        // Verify CSP contains expected directives
        assert!(csp.contains("default-src 'self'"));
        assert!(csp.contains("script-src 'self'"));
        assert!(csp.contains("style-src 'self' 'unsafe-inline'"));
        assert!(csp.contains("frame-ancestors 'none'"));
        assert!(csp.contains("worker-src 'self' blob:"));
    }

    #[tokio::test]
    async fn test_hsts_header_content() {
        let app = Router::new()
            .route("/test", get(|| async { "test" }))
            .layer(axum::middleware::from_fn(security_headers_middleware));

        let response = app
            .oneshot(Request::builder().uri("/test").body(Body::empty()).unwrap())
            .await
            .unwrap();

        let hsts = response
            .headers()
            .get(header::STRICT_TRANSPORT_SECURITY)
            .unwrap()
            .to_str()
            .unwrap();

        // Verify HSTS contains expected directives
        assert!(hsts.contains("max-age=31536000"));
        assert!(hsts.contains("includeSubDomains"));
        assert!(hsts.contains("preload"));
    }
}
