use reqwest;
use std::io;
use thiserror::Error;

/// Errors returned by proxy_request_with_audit to allow callers to match
/// on concrete failure cases instead of fragile string comparisons.
#[derive(Error, Debug)]
pub enum ProxyRequestError {
    #[error("access_denied")]
    AccessDenied,
    #[error("proxy_timeout")]
    ProxyTimeout,
    #[error("request_failed: {0}")]
    RequestFailed(String),
    #[error("response_read_timeout")]
    ResponseReadTimeout,
    #[error("response_read_failed: {0}")]
    ResponseReadFailed(String),
    #[error("other: {0}")]
    Other(String),
}

// Display implementation is provided by thiserror::Error derive above.

impl From<anyhow::Error> for ProxyRequestError {
    fn from(err: anyhow::Error) -> Self {
        // Default conversion: wrap the error string in Other so callers can
        // easily convert anyhow::Error into a ProxyRequestError for mapping
        // into HTTP responses or logs.
        ProxyRequestError::Other(err.to_string())
    }
}

impl From<io::Error> for ProxyRequestError {
    fn from(err: io::Error) -> Self {
        // Map IO timeouts to a response-read timeout where reasonable,
        // otherwise keep the error string for diagnostics.
        match err.kind() {
            io::ErrorKind::TimedOut => ProxyRequestError::ResponseReadTimeout,
            _ => ProxyRequestError::Other(err.to_string()),
        }
    }
}

impl From<reqwest::Error> for ProxyRequestError {
    fn from(err: reqwest::Error) -> Self {
        // Prefer specific classifications when available
        if err.is_timeout() {
            ProxyRequestError::ProxyTimeout
        } else if err.is_body() || err.is_decode() {
            ProxyRequestError::ResponseReadFailed(err.to_string())
        } else {
            ProxyRequestError::RequestFailed(err.to_string())
        }
    }
}

impl From<tokio::time::error::Elapsed> for ProxyRequestError {
    fn from(_: tokio::time::error::Elapsed) -> Self {
        // Tokio timeout -> proxy timeout
        ProxyRequestError::ProxyTimeout
    }
}

/// Classify an anyhow::Error into a ProxyRequestError by attempting to
/// downcast into more specific error types (reqwest::Error, io::Error)
/// before falling back to the generic Anyhow->Other conversion.
pub fn classify_anyhow(err: &anyhow::Error) -> ProxyRequestError {
    // Try to view as reqwest::Error and classify without taking ownership
    if let Some(req_err) = err.downcast_ref::<reqwest::Error>() {
        if req_err.is_timeout() {
            return ProxyRequestError::ProxyTimeout;
        }
        if req_err.is_body() || req_err.is_decode() {
            return ProxyRequestError::ResponseReadFailed(req_err.to_string());
        }
        return ProxyRequestError::RequestFailed(req_err.to_string());
    }

    // Try to view as io::Error
    if let Some(io_err) = err.downcast_ref::<std::io::Error>() {
        match io_err.kind() {
            std::io::ErrorKind::TimedOut => return ProxyRequestError::ResponseReadTimeout,
            _ => return ProxyRequestError::Other(io_err.to_string()),
        }
    }

    // Fallback to generic conversion using the error string
    ProxyRequestError::Other(err.to_string())
}
#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn from_anyhow_maps_to_other() {
        let err = anyhow::anyhow!("boom");
        let pe: ProxyRequestError = err.into();
        match pe {
            ProxyRequestError::Other(s) => assert!(s.contains("boom")),
            _ => panic!("expected Other variant"),
        }
    }

    #[test]
    fn from_io_timeout_maps_to_response_read_timeout() {
        let err = std::io::Error::new(std::io::ErrorKind::TimedOut, "timed out");
        let pe: ProxyRequestError = err.into();
        assert!(matches!(pe, ProxyRequestError::ResponseReadTimeout));
    }

    #[test]
    fn from_io_other_maps_to_other() {
        let err = std::io::Error::new(std::io::ErrorKind::NotFound, "not found");
        let pe: ProxyRequestError = err.into();
        match pe {
            ProxyRequestError::Other(s) => assert!(s.contains("not found")),
            _ => panic!("expected Other variant"),
        }
    }

    #[tokio::test]
    async fn from_reqwest_connection_error_maps_to_request_failed() {
        // Attempt to connect to a likely-closed port to produce a connection error
        let client = reqwest::Client::new();
        let res = client.get("http://127.0.0.1:9").send().await;
        assert!(res.is_err());
        let err = res.err().unwrap();
        let pe: ProxyRequestError = err.into();
        match pe {
            ProxyRequestError::RequestFailed(s) => assert!(!s.is_empty()),
            other => panic!("unexpected variant: {:?}", other),
        }
    }

    #[tokio::test]
    async fn from_reqwest_timeout_maps_to_proxy_timeout() {
        use std::time::Duration;
        use wiremock::matchers::{method, path};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        // Start mock server that delays response
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/slow"))
            .respond_with(
                ResponseTemplate::new(200)
                    .set_delay(Duration::from_millis(500))
                    .set_body_string("ok"),
            )
            .mount(&mock_server)
            .await;

        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(100))
            .build()
            .expect("build client");

        let res = client
            .get(format!("{}/slow", mock_server.uri()))
            .send()
            .await;
        assert!(res.is_err(), "expected timeout error");
        let err = res.err().unwrap();
        assert!(err.is_timeout(), "reqwest error should be timeout");
        let pe: ProxyRequestError = err.into();
        assert!(matches!(pe, ProxyRequestError::ProxyTimeout));
    }

    #[tokio::test]
    async fn from_reqwest_decode_error_maps_to_response_read_failed() {
        use wiremock::matchers::{method, path};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        // Start mock server that returns invalid JSON
        let mock_server = MockServer::start().await;

        Mock::given(method("GET"))
            .and(path("/invalid-json"))
            .respond_with(ResponseTemplate::new(200).set_body_string("not-json"))
            .mount(&mock_server)
            .await;

        let client = reqwest::Client::new();
        let resp = client
            .get(format!("{}/invalid-json", mock_server.uri()))
            .send()
            .await
            .expect("send ok");

        let jres = resp.json::<serde_json::Value>().await;
        assert!(jres.is_err(), "expected decode error");
        let err = jres.err().unwrap();
        assert!(err.is_decode(), "reqwest error should be decode");
        let pe: ProxyRequestError = err.into();
        match pe {
            ProxyRequestError::ResponseReadFailed(s) => assert!(!s.is_empty()),
            other => panic!("unexpected variant: {:?}", other),
        }
    }
}
