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
    // SAFETY: Static CSP header string is always valid
    headers.insert(
        header::CONTENT_SECURITY_POLICY,
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; worker-src 'self' blob:"
            .parse()
            .expect("parse static CSP header value"),
    );

    // Strict-Transport-Security: Force HTTPS for 1 year
    // includeSubDomains: Apply to all subdomains
    // preload: Allow inclusion in browser HSTS preload lists
    // SAFETY: Static HSTS header string is always valid
    headers.insert(
        header::STRICT_TRANSPORT_SECURITY,
        "max-age=31536000; includeSubDomains; preload"
            .parse()
            .expect("parse static HSTS header value"),
    );

    // X-Frame-Options: Prevent clickjacking
    // SAFETY: Static header value "DENY" is always valid
    headers.insert(
        header::X_FRAME_OPTIONS,
        "DENY".parse().expect("parse X-Frame-Options header value"),
    );

    // X-Content-Type-Options: Prevent MIME sniffing
    // SAFETY: Static header value "nosniff" is always valid
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        "nosniff"
            .parse()
            .expect("parse X-Content-Type-Options header value"),
    );

    // X-XSS-Protection: Enable browser XSS protection
    // SAFETY: Static header value is always valid
    headers.insert(
        HeaderName::from_static("x-xss-protection"),
        "1; mode=block"
            .parse()
            .expect("parse x-xss-protection header value"),
    );

    // Referrer-Policy: Control referrer information
    // SAFETY: Static header value is always valid
    headers.insert(
        header::REFERRER_POLICY,
        "strict-origin-when-cross-origin"
            .parse()
            .expect("parse Referrer-Policy header value"),
    );

    // Permissions-Policy: Disable unnecessary browser features
    // SAFETY: Static header value is always valid
    headers.insert(
        HeaderName::from_static("permissions-policy"),
        "geolocation=(), microphone=(), camera=()"
            .parse()
            .expect("parse Permissions-Policy header value"),
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
            .oneshot(
                Request::builder()
                    .uri("/test")
                    .body(Body::empty())
                    .expect("build request body"),
            )
            .await
            .expect("send request to app");

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
        assert_eq!(
            headers
                .get(header::X_FRAME_OPTIONS)
                .expect("X-Frame-Options header present"),
            "DENY"
        );
        assert_eq!(
            headers
                .get(header::X_CONTENT_TYPE_OPTIONS)
                .expect("X-Content-Type-Options header present"),
            "nosniff"
        );
        assert_eq!(
            headers
                .get("x-xss-protection")
                .expect("x-xss-protection header present"),
            "1; mode=block"
        );
    }

    #[tokio::test]
    async fn test_csp_header_content() {
        let app = Router::new()
            .route("/test", get(|| async { "test" }))
            .layer(axum::middleware::from_fn(security_headers_middleware));

        let response = app
            .oneshot(
                Request::builder()
                    .uri("/test")
                    .body(Body::empty())
                    .expect("build request body"),
            )
            .await
            .expect("send request to app");

        let csp = response
            .headers()
            .get(header::CONTENT_SECURITY_POLICY)
            .expect("CSP header present")
            .to_str()
            .expect("CSP header valid str");

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
            .oneshot(
                Request::builder()
                    .uri("/test")
                    .body(Body::empty())
                    .expect("build request body"),
            )
            .await
            .expect("send request to app");

        let hsts = response
            .headers()
            .get(header::STRICT_TRANSPORT_SECURITY)
            .expect("HSTS header present")
            .to_str()
            .expect("HSTS header valid str");

        // Verify HSTS contains expected directives
        assert!(hsts.contains("max-age=31536000"));
        assert!(hsts.contains("includeSubDomains"));
        assert!(hsts.contains("preload"));
    }
}
