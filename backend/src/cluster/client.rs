use crate::config::{ClusterAuth, ClusterConfig, TlsConfig};
use anyhow::{Context, Result};
use async_trait::async_trait;
use reqwest::{header, Method, Response};
use serde_json::Value;
use std::time::Duration;

/// Elasticsearch client abstraction supporting both SDK and HTTP modes
#[derive(Debug)]
pub enum Client {
    /// Direct HTTP client for maximum flexibility
    Http(HttpClient),
    /// SDK-based client (placeholder for future elasticsearch-rs integration)
    Sdk(SdkClient),
}

/// HTTP-based Elasticsearch client
#[derive(Debug)]
pub struct HttpClient {
    client: reqwest::Client,
    nodes: Vec<String>,
    auth: Option<ClusterAuth>,
    version_hint: Option<String>,
    current_node_index: std::sync::atomic::AtomicUsize,
}

/// SDK-based Elasticsearch client (placeholder)
#[derive(Debug)]
pub struct SdkClient {
    // Placeholder for future elasticsearch-rs integration
    _marker: std::marker::PhantomData<()>,
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
            crate::config::ClientType::Http => {
                let http_client = HttpClient::new(config).await?;
                Ok(Client::Http(http_client))
            }
            crate::config::ClientType::Sdk => {
                let sdk_client = SdkClient::new(config).await?;
                Ok(Client::Sdk(sdk_client))
            }
        }
    }
}

#[async_trait]
impl ElasticsearchClient for Client {
    async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Result<Response> {
        match self {
            Client::Http(client) => client.request(method, path, body).await,
            Client::Sdk(client) => client.request(method, path, body).await,
        }
    }

    async fn health(&self) -> Result<Value> {
        match self {
            Client::Http(client) => client.health().await,
            Client::Sdk(client) => client.health().await,
        }
    }

    async fn info(&self) -> Result<Value> {
        match self {
            Client::Http(client) => client.info().await,
            Client::Sdk(client) => client.info().await,
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
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
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
    /// Create a new SDK client (placeholder)
    pub async fn new(_config: &ClusterConfig) -> Result<Self> {
        // Placeholder for future elasticsearch-rs integration
        // For now, this is not implemented
        anyhow::bail!("SDK client is not yet implemented. Please use HTTP client type instead.");
    }
}

#[async_trait]
impl ElasticsearchClient for SdkClient {
    async fn request(
        &self,
        _method: Method,
        _path: &str,
        _body: Option<Value>,
    ) -> Result<Response> {
        anyhow::bail!("SDK client is not yet implemented")
    }

    async fn health(&self) -> Result<Value> {
        anyhow::bail!("SDK client is not yet implemented")
    }

    async fn info(&self) -> Result<Value> {
        anyhow::bail!("SDK client is not yet implemented")
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
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
        };

        assert!(client.is_opensearch());

        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            version_hint: Some("8".to_string()),
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
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
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
        };

        assert_eq!(client.get_next_node(), "http://node1:9200");
        assert_eq!(client.get_next_node(), "http://node2:9200");
        assert_eq!(client.get_next_node(), "http://node3:9200");
        assert_eq!(client.get_next_node(), "http://node1:9200"); // Wraps around
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

    #[tokio::test]
    async fn test_client_creation_sdk_fails() {
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
        assert!(client.is_err());
        assert!(client
            .unwrap_err()
            .to_string()
            .contains("not yet implemented"));
    }

    #[test]
    fn test_adjust_path_for_version() {
        let client = HttpClient {
            client: reqwest::Client::new(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            version_hint: Some("8".to_string()),
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
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
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
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
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
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
            current_node_index: std::sync::atomic::AtomicUsize::new(0),
        };

        let body = serde_json::json!({"query": {"match_all": {}}});
        let request =
            client.build_request(Method::POST, "http://localhost:9200/_search", Some(body));
        assert!(request.is_ok());
    }
}
