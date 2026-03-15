use crate::assets::Assets;
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
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "text/html")
            .body(Body::from(index.data))
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
