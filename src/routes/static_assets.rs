use crate::assets::Assets;
use crate::telemetry::config::TelemetryConfig;
use axum::{
    body::Body,
    http::{header, StatusCode, Uri},
    response::Response,
};
use mime_guess;

/// Error type for static asset serving
#[derive(Debug)]
enum StaticAssetError {
    ResponseBuildError,
}

impl std::fmt::Display for StaticAssetError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            StaticAssetError::ResponseBuildError => write!(f, "Failed to build response"),
        }
    }
}

impl std::error::Error for StaticAssetError {}

/// Serve embedded static assets
///
/// This handler serves embedded frontend assets from the binary.
/// It handles:
/// - Serving static files (JS, CSS, images, etc.)
/// - SPA routing fallback (serving index.html for unknown paths)
/// - Correct MIME type detection
///
/// # Requirements
///
/// Validates: Requirements 1.2
pub async fn serve_static(uri: Uri) -> Response {
    let path = uri.path().trim_start_matches('/');

    // Try to get the requested file
    if let Some(content) = Assets::get(path) {
        let mime_type = mime_guess::from_path(path).first_or_octet_stream();

        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, mime_type.as_ref())
            .body(Body::from(content.data))
            .map_err(|_| StaticAssetError::ResponseBuildError)
            .unwrap_or_else(|_| {
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from("Internal Server Error"))
                    .unwrap_or_else(|_| panic!("Failed to build error response"))
            });
    }

    // SPA fallback: serve index.html for unknown paths
    // This allows React Router to handle client-side routing
    if let Some(index) = Assets::get("index.html") {
        let html = String::from_utf8_lossy(&index.data);

        // Inject OTEL configuration if telemetry is enabled
        let html_with_otel = inject_otel_config(&html);

        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html")
            .body(Body::from(html_with_otel))
            .map_err(|_| StaticAssetError::ResponseBuildError)
            .unwrap_or_else(|_| {
                Response::builder()
                    .status(StatusCode::INTERNAL_SERVER_ERROR)
                    .body(Body::from("Internal Server Error"))
                    .unwrap_or_else(|_| panic!("Failed to build error response"))
            });
    }

    // If even index.html is not found, return 404
    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Not Found"))
        .unwrap_or_else(|_| {
            // Last resort - if we can't even build a 404, return a minimal response
            Response::new(Body::from("Not Found"))
        })
}

/// Inject OpenTelemetry configuration into HTML
///
/// Adds meta tags or a config script with OTEL_* settings
/// so the frontend can initialize telemetry correctly.
fn inject_otel_config(html: &str) -> String {
    let telemetry_config = TelemetryConfig::from_env().unwrap_or_else(|_| TelemetryConfig {
        enabled: false,
        service_name: "secan-frontend".to_string(),
        service_version: env!("CARGO_PKG_VERSION").to_string(),
        otlp_endpoint: "/v1/traces".to_string(),
        otlp_protocol: crate::telemetry::config::OtlpProtocol::Http,
        otlp_headers: vec![],
        sampler: crate::telemetry::config::SamplerConfig::default(),
        resource_attributes: vec![],
        batch_config: crate::telemetry::config::BatchConfig::default(),
    });

    // Build the config injection
    let config_injection = format!(
        r#"<meta name="otel-sdk-disabled" content="{}">
<meta name="otel-service-name" content="{}">
<meta name="otel-service-version" content="{}">
<meta name="otel-exporter-otlp-endpoint" content="{}">"#,
        if telemetry_config.enabled {
            "false"
        } else {
            "true"
        },
        telemetry_config.service_name,
        telemetry_config.service_version,
        telemetry_config.otlp_endpoint
    );

    // Inject before </head>
    if let Some(head_pos) = html.find("</head>") {
        let mut result = html[..head_pos].to_string();
        result.push_str(&config_injection);
        result.push_str(&html[head_pos..]);
        result
    } else {
        // Fallback: return original HTML if no </head> found
        html.to_string()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::Uri;

    #[tokio::test]
    async fn test_serve_index_html() {
        // SAFETY: Static path literals always parse successfully
        #[allow(clippy::unwrap_used)]
        let uri: Uri = "/".parse().unwrap();
        let response = serve_static(uri).await;

        assert_eq!(response.status(), StatusCode::OK);

        // Check content type
        // SAFETY: Response header always present after successful serve_static
        #[allow(clippy::unwrap_used)]
        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert_eq!(content_type, "text/html");
    }

    #[tokio::test]
    async fn test_serve_static_file() {
        // SAFETY: Static path literals always parse successfully
        #[allow(clippy::unwrap_used)]
        let uri: Uri = "/index.html".parse().unwrap();
        let response = serve_static(uri).await;

        assert_eq!(response.status(), StatusCode::OK);

        // SAFETY: Response header always present after successful serve_static
        #[allow(clippy::unwrap_used)]
        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert_eq!(content_type, "text/html");
    }

    #[tokio::test]
    async fn test_spa_fallback() {
        // Request a path that doesn't exist as a file
        // Should return index.html for SPA routing
        // SAFETY: Static path literals always parse successfully
        #[allow(clippy::unwrap_used)]
        let uri: Uri = "/cluster/test-cluster".parse().unwrap();
        let response = serve_static(uri).await;

        assert_eq!(response.status(), StatusCode::OK);

        // SAFETY: Response header always present after successful serve_static
        #[allow(clippy::unwrap_used)]
        let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
        assert_eq!(content_type, "text/html");
    }

    #[tokio::test]
    async fn test_mime_type_detection() {
        // Test that MIME types are correctly detected
        // Note: This test assumes assets/assets/ directory has JS files
        let test_cases = vec![
            ("index.html", "text/html"),
            // Add more test cases when we have actual built assets
        ];

        for (path, expected_mime) in test_cases {
            // SAFETY: Static path literals always parse successfully
            #[allow(clippy::unwrap_used)]
            let uri: Uri = format!("/{}", path).parse().unwrap();
            let response = serve_static(uri).await;

            if response.status() == StatusCode::OK {
                let content_type = response.headers().get(header::CONTENT_TYPE).unwrap();
                assert_eq!(content_type, expected_mime);
            }
        }
    }
}
