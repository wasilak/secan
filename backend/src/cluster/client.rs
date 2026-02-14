use crate::config::{ClusterAuth, ClusterConfig, TlsConfig};
use anyhow::{Context, Result};
use async_trait::async_trait;
use elasticsearch::{
    auth::Credentials,
    http::{
        response::Response as EsResponse,
        transport::{SingleNodeConnectionPool, TransportBuilder},
    },
    Elasticsearch,
};
use reqwest::{header, Method, Response};
use serde_json::Value;
use std::time::Duration;
use url::Url;

/// Elasticsearch client abstraction supporting both SDK and HTTP modes
#[derive(Debug, Clone)]
pub enum Client {
    /// SDK-based client using official elasticsearch crate
    Sdk(SdkClient),
    /// Direct HTTP client for maximum flexibility (legacy)
    Http(HttpClient),
}

/// HTTP-based Elasticsearch client
#[derive(Debug, Clone)]
pub struct HttpClient {
    client: reqwest::Client,
    nodes: Vec<String>,
    auth: Option<ClusterAuth>,
    version_hint: Option<String>,
    current_node_index: std::sync::Arc<std::sync::atomic::AtomicUsize>,
}

/// SDK-based Elasticsearch client using official elasticsearch crate
#[derive(Debug, Clone)]
pub struct SdkClient {
    client: Elasticsearch,
    #[allow(dead_code)]
    version_hint: Option<String>,
}

/// Trait for Elasticsearch client operations
#[async_trait]
pub trait ElasticsearchClient: Send + Sync {
    /// Execute a request against Elasticsearch
    async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Result<Response>;

    /// Get cluster health
    async fn health(&self) -> Result<Value>;

    /// Get cluster info
    async fn info(&self) -> Result<Value>;
}

impl Client {
    /// Create a new Elasticsearch client from configuration
    pub async fn new(config: &ClusterConfig) -> Result<Self> {
        match config.client_type {
            crate::config::ClientType::Sdk => {
                let sdk_client = SdkClient::new(config).await?;
                Ok(Client::Sdk(sdk_client))
            }
            crate::config::ClientType::Http => {
                let http_client = HttpClient::new(config).await?;
                Ok(Client::Http(http_client))
            }
        }
    }
}

#[async_trait]
impl ElasticsearchClient for Client {
    async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Result<Response> {
        match self {
            Client::Sdk(client) => client.request(method, path, body).await,
            Client::Http(client) => client.request(method, path, body).await,
        }
    }

    async fn health(&self) -> Result<Value> {
        match self {
            Client::Sdk(client) => client.health().await,
            Client::Http(client) => client.health().await,
        }
    }

    async fn info(&self) -> Result<Value> {
        match self {
            Client::Sdk(client) => client.info().await,
            Client::Http(client) => client.info().await,
        }
    }
}

impl HttpClient {
    /// Create a new HTTP client
    pub async fn new(config: &ClusterConfig) -> Result<Self> {
        let client = Self::build_http_client(&config.tls)?;

        Ok(Self {
            client,
            nodes: config.nodes.clone(),
            auth: config.auth.clone(),
            version_hint: config.version_hint.clone(),
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        })
    }

    /// Build reqwest client with TLS configuration
    fn build_http_client(tls_config: &TlsConfig) -> Result<reqwest::Client> {
        let mut builder = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .pool_max_idle_per_host(10)
            .pool_idle_timeout(Duration::from_secs(90));

        // Configure TLS certificate verification
        if !tls_config.verify {
            tracing::warn!("TLS certificate verification is disabled - this is insecure!");
            builder = builder.danger_accept_invalid_certs(true);
        }

        // Add custom CA certificates if provided
        if let Some(ca_cert_file) = &tls_config.ca_cert_file {
            tracing::debug!("Loading CA certificate from file: {:?}", ca_cert_file);
            let cert_pem =
                std::fs::read(ca_cert_file).context("Failed to read CA certificate file")?;
            let cert = reqwest::Certificate::from_pem(&cert_pem)
                .context("Failed to parse CA certificate")?;
            builder = builder.add_root_certificate(cert);
        }

        // Load certificates from directory if provided
        if let Some(ca_cert_dir) = &tls_config.ca_cert_dir {
            if ca_cert_dir.exists() && ca_cert_dir.is_dir() {
                tracing::debug!("Loading CA certificates from directory: {:?}", ca_cert_dir);
                for entry in std::fs::read_dir(ca_cert_dir)
                    .context("Failed to read CA certificate directory")?
                {
                    let entry = entry?;
                    let path = entry.path();
                    if path.is_file() {
                        if let Some(ext) = path.extension() {
                            if ext == "pem" || ext == "crt" {
                                tracing::debug!("Loading certificate: {:?}", path);
                                let cert_pem = std::fs::read(&path).with_context(|| {
                                    format!("Failed to read certificate: {:?}", path)
                                })?;
                                match reqwest::Certificate::from_pem(&cert_pem) {
                                    Ok(cert) => {
                                        builder = builder.add_root_certificate(cert);
                                    }
                                    Err(e) => {
                                        tracing::warn!(
                                            "Failed to parse certificate {:?}: {}",
                                            path,
                                            e
                                        );
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                tracing::warn!(
                    "CA certificate directory does not exist or is not a directory: {:?}",
                    ca_cert_dir
                );
            }
        }

        builder.build().context("Failed to build HTTP client")
    }

    /// Get the next node URL for round-robin load balancing
    fn get_next_node(&self) -> String {
        let index = self
            .current_node_index
            .fetch_add(1, std::sync::atomic::Ordering::Relaxed);
        let node_index = index % self.nodes.len();
        self.nodes[node_index].clone()
    }

    /// Build request with authentication
    fn build_request(
        &self,
        method: Method,
        url: &str,
        body: Option<Value>,
    ) -> Result<reqwest::RequestBuilder> {
        let mut request = self.client.request(method, url);

        // Add authentication
        if let Some(auth) = &self.auth {
            request = match auth {
                ClusterAuth::Basic { username, password } => {
                    request.basic_auth(username, Some(password))
                }
                ClusterAuth::ApiKey { key } => {
                    request.header(header::AUTHORIZATION, format!("ApiKey {}", key))
                }
                ClusterAuth::None => request,
            };
        }

        // Add content-type header for requests with body
        if body.is_some() {
            request = request.header(header::CONTENT_TYPE, "application/json");
        }

        // Add body if provided
        if let Some(body) = body {
            request = request.json(&body);
        }

        Ok(request)
    }

    /// Execute request with automatic failover to other nodes
    async fn execute_with_failover(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Response> {
        let mut last_error = None;

        // Try each node once
        for _ in 0..self.nodes.len() {
            let node = self.get_next_node();
            let path_with_slash = if path.starts_with('/') {
                path.to_string()
            } else {
                format!("/{}", path)
            };
            let url = format!("{}{}", node.trim_end_matches('/'), path_with_slash);

            tracing::debug!("Executing {} {} against {}", method, path, node);

            let request = self.build_request(method.clone(), &url, body.clone())?;

            match request.send().await {
                Ok(response) => {
                    let status = response.status();
                    tracing::debug!("Response status: {}", status);

                    // Return response for all status codes (let caller handle errors)
                    return Ok(response);
                }
                Err(err) => {
                    tracing::warn!("Request to {} failed: {}", node, err);
                    tracing::debug!("Error details: {:?}", err);
                    if err.is_builder() {
                        tracing::error!("Builder error details - this usually means invalid URL or request configuration");
                    }
                    last_error = Some(err);
                    // Continue to next node
                }
            }
        }

        // All nodes failed
        Err(last_error
            .map(|e| anyhow::anyhow!("All nodes failed: {}", e))
            .unwrap_or_else(|| anyhow::anyhow!("All nodes failed with unknown error")))
    }

    /// Check if this is an OpenSearch cluster based on version hint
    fn is_opensearch(&self) -> bool {
        self.version_hint
            .as_ref()
            .map(|v| v.to_lowercase().contains("opensearch"))
            .unwrap_or(false)
    }

    /// Adjust API path for version compatibility
    fn adjust_path_for_version(&self, path: &str) -> String {
        // Handle version-specific API differences
        // For now, return path as-is, but this can be extended for specific version handling

        if self.is_opensearch() {
            // OpenSearch-specific path adjustments could go here
            tracing::debug!("Using OpenSearch-compatible API path");
        }

        path.to_string()
    }
}

#[async_trait]
impl ElasticsearchClient for HttpClient {
    async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Result<Response> {
        let adjusted_path = self.adjust_path_for_version(path);
        self.execute_with_failover(method, &adjusted_path, body)
            .await
    }

    async fn health(&self) -> Result<Value> {
        let response = self.request(Method::GET, "/_cluster/health", None).await?;

        if !response.status().is_success() {
            anyhow::bail!("Health check failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse health response")
    }

    async fn info(&self) -> Result<Value> {
        let response = self.request(Method::GET, "/", None).await?;

        if !response.status().is_success() {
            anyhow::bail!("Info request failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse info response")
    }
}

impl SdkClient {
    /// Create a new SDK client using the official elasticsearch crate
    pub async fn new(config: &ClusterConfig) -> Result<Self> {
        // Parse the first node URL
        let node_url = config
            .nodes
            .first()
            .context("At least one node URL is required")?;
        let url = Url::parse(node_url).context("Invalid node URL")?;

        // Create connection pool
        let conn_pool = SingleNodeConnectionPool::new(url);

        // Build transport with authentication and TLS settings
        let mut transport_builder = TransportBuilder::new(conn_pool);

        // Configure timeout
        transport_builder = transport_builder.timeout(Duration::from_secs(30));

        // Configure authentication
        if let Some(auth) = &config.auth {
            match auth {
                ClusterAuth::Basic { username, password } => {
                    let credentials = Credentials::Basic(username.clone(), password.clone());
                    transport_builder = transport_builder.auth(credentials);
                }
                ClusterAuth::ApiKey { key } => {
                    // ApiKey requires both id and api_key
                    // For now, we'll split the key on ':' if present, otherwise use empty id
                    let parts: Vec<&str> = key.splitn(2, ':').collect();
                    let (id, api_key) = if parts.len() == 2 {
                        (parts[0].to_string(), parts[1].to_string())
                    } else {
                        (String::new(), key.clone())
                    };
                    let credentials = Credentials::ApiKey(id, api_key);
                    transport_builder = transport_builder.auth(credentials);
                }
                ClusterAuth::None => {
                    // No credentials needed
                }
            };
        }

        // Configure TLS certificate verification
        if !config.tls.verify {
            tracing::warn!("TLS certificate verification is disabled - this is insecure!");
            transport_builder =
                transport_builder.cert_validation(elasticsearch::cert::CertificateValidation::None);
        }

        // Build transport
        let transport = transport_builder
            .build()
            .context("Failed to build Elasticsearch transport")?;

        // Create client
        let client = Elasticsearch::new(transport);

        Ok(Self {
            client,
            version_hint: config.version_hint.clone(),
        })
    }

    /// Check if this is an OpenSearch cluster based on version hint
    fn is_opensearch(&self) -> bool {
        self.version_hint
            .as_ref()
            .map(|v| v.to_lowercase().contains("opensearch"))
            .unwrap_or(false)
    }

    /// Convert Elasticsearch SDK response to reqwest Response for compatibility
    async fn convert_response(&self, es_response: EsResponse) -> Result<Response> {
        let status = es_response.status_code();
        let headers = es_response.headers().clone();
        let body_bytes = es_response
            .bytes()
            .await
            .context("Failed to read response body")?;

        // Build http response
        let mut response_builder = http::Response::builder().status(status.as_u16());

        // Copy headers
        for (key, value) in headers.iter() {
            response_builder = response_builder.header(key.as_str(), value.as_bytes());
        }

        let http_response = response_builder
            .body(body_bytes.to_vec())
            .context("Failed to build HTTP response")?;

        // Convert http::Response to reqwest::Response
        Ok(Response::from(http_response))
    }
}

#[async_trait]
impl ElasticsearchClient for SdkClient {
    async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Result<Response> {
        // Use the generic send method for arbitrary requests
        let es_method = match method {
            Method::GET => elasticsearch::http::Method::Get,
            Method::POST => elasticsearch::http::Method::Post,
            Method::PUT => elasticsearch::http::Method::Put,
            Method::DELETE => elasticsearch::http::Method::Delete,
            Method::HEAD => elasticsearch::http::Method::Head,
            _ => anyhow::bail!("Unsupported HTTP method: {}", method),
        };

        let es_response = self
            .client
            .send(
                es_method,
                path,
                elasticsearch::http::headers::HeaderMap::new(),
                body.as_ref(),
                None::<String>,
                None,
            )
            .await
            .context("Elasticsearch request failed")?;

        self.convert_response(es_response).await
    }

    async fn health(&self) -> Result<Value> {
        let response = self
            .client
            .cluster()
            .health(elasticsearch::cluster::ClusterHealthParts::None)
            .send()
            .await
            .context("Health check failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!(
                "Health check failed with status: {}",
                response.status_code()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse health response")
    }

    async fn info(&self) -> Result<Value> {
        let response = self
            .client
            .info()
            .send()
            .await
            .context("Info request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!(
                "Info request failed with status: {}",
                response.status_code()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse info response")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::ClientType;

    #[test]
    fn test_is_opensearch() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            version_hint: Some("opensearch".to_string()),
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        assert!(client.is_opensearch());

        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            version_hint: Some("8".to_string()),
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        assert!(!client.is_opensearch());
    }

    #[test]
    fn test_get_next_node_round_robin() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec![
                "http://node1:9200".to_string(),
                "http://node2:9200".to_string(),
                "http://node3:9200".to_string(),
            ],
            auth: None,
            version_hint: None,
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        assert_eq!(client.get_next_node(), "http://node1:9200");
        assert_eq!(client.get_next_node(), "http://node2:9200");
        assert_eq!(client.get_next_node(), "http://node3:9200");
        assert_eq!(client.get_next_node(), "http://node1:9200"); // Wraps around
    }

    #[tokio::test]
    async fn test_client_creation_sdk() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            client_type: ClientType::Sdk,
            version_hint: None,
        };

        let client = Client::new(&config).await;
        assert!(client.is_ok());
        assert!(matches!(client.unwrap(), Client::Sdk(_)));
    }

    #[tokio::test]
    async fn test_client_creation_http() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            client_type: ClientType::Http,
            version_hint: None,
        };

        let client = Client::new(&config).await;
        assert!(client.is_ok());
        assert!(matches!(client.unwrap(), Client::Http(_)));
    }

    #[test]
    fn test_adjust_path_for_version() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            version_hint: Some("8".to_string()),
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        let path = "/_cluster/health";
        assert_eq!(client.adjust_path_for_version(path), path);
    }

    #[test]
    fn test_build_request_with_basic_auth() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Some(ClusterAuth::Basic {
                username: "user".to_string(),
                password: "pass".to_string(),
            }),
            version_hint: None,
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        let request =
            client.build_request(Method::GET, "http://localhost:9200/_cluster/health", None);
        assert!(request.is_ok());
    }

    #[test]
    fn test_build_request_with_api_key() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Some(ClusterAuth::ApiKey {
                key: "test-key".to_string(),
            }),
            version_hint: None,
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        let request =
            client.build_request(Method::GET, "http://localhost:9200/_cluster/health", None);
        assert!(request.is_ok());
    }

    #[test]
    fn test_build_request_with_body() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            version_hint: None,
            current_node_index: std::sync::Arc::new(std::sync::atomic::AtomicUsize::new(0)),
        };

        let body = serde_json::json!({"query": {"match_all": {}}});
        let request =
            client.build_request(Method::POST, "http://localhost:9200/_search", Some(body));
        assert!(request.is_ok());
    }
}
