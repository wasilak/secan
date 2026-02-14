use crate::config::{ClusterAuth, ClusterConfig};
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
use reqwest::{Method, Response};
use serde_json::Value;
use std::time::Duration;
use url::Url;

/// Elasticsearch client using official elasticsearch crate
#[derive(Debug, Clone)]
pub struct Client {
    client: Elasticsearch,
    es_version: u8,
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

    /// Get cluster stats
    async fn cluster_stats(&self) -> Result<Value>;

    /// Get nodes info
    async fn nodes_info(&self) -> Result<Value>;

    /// Get nodes stats
    async fn nodes_stats(&self) -> Result<Value>;

    /// Get indices
    async fn indices_get(&self, index: &str) -> Result<Value>;

    /// Get indices stats
    async fn indices_stats(&self) -> Result<Value>;

    /// Get cluster state
    async fn cluster_state(&self) -> Result<Value>;
}

impl Client {
    /// Create a new Elasticsearch client from configuration
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
            es_version: config.es_version,
        })
    }

    /// Get the Elasticsearch version this client is configured for
    pub fn es_version(&self) -> u8 {
        self.es_version
    }

    /// Convert Elasticsearch SDK response to reqwest Response for compatibility
    async fn convert_response(&self, es_response: EsResponse) -> Result<Response> {
        let status = es_response.status_code();
        let headers = es_response.headers().clone();
        let body_bytes = es_response
            .bytes()
            .await
            .context("Failed to read response body")?;

        // Build reqwest response using reqwest's builder
        let mut response_builder = http::Response::builder().status(status.as_u16());

        // Copy headers
        for (key, value) in headers.iter() {
            response_builder = response_builder.header(key.as_str(), value.as_bytes());
        }

        let http_response = response_builder
            .body(body_bytes.to_vec())
            .context("Failed to build HTTP response")?;

        // Convert http::Response to reqwest::Response using try_from
        reqwest::Response::try_from(http_response)
            .context("Failed to convert HTTP response to reqwest Response")
    }
}

#[async_trait]
impl ElasticsearchClient for Client {
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

    /// Get cluster stats using SDK typed method
    async fn cluster_stats(&self) -> Result<Value> {
        let response = self
            .client
            .cluster()
            .stats(elasticsearch::cluster::ClusterStatsParts::None)
            .send()
            .await
            .context("Cluster stats request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!(
                "Cluster stats failed with status: {}",
                response.status_code()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse cluster stats response")
    }

    /// Get nodes info using SDK typed method
    async fn nodes_info(&self) -> Result<Value> {
        let response = self
            .client
            .nodes()
            .info(elasticsearch::nodes::NodesInfoParts::None)
            .send()
            .await
            .context("Nodes info request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!("Nodes info failed with status: {}", response.status_code());
        }

        response
            .json()
            .await
            .context("Failed to parse nodes info response")
    }

    /// Get nodes stats using SDK typed method
    async fn nodes_stats(&self) -> Result<Value> {
        let response = self
            .client
            .nodes()
            .stats(elasticsearch::nodes::NodesStatsParts::None)
            .send()
            .await
            .context("Nodes stats request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!("Nodes stats failed with status: {}", response.status_code());
        }

        response
            .json()
            .await
            .context("Failed to parse nodes stats response")
    }

    /// Get indices using SDK typed method
    async fn indices_get(&self, index: &str) -> Result<Value> {
        let response = self
            .client
            .indices()
            .get(elasticsearch::indices::IndicesGetParts::Index(&[index]))
            .send()
            .await
            .context("Indices get request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!("Indices get failed with status: {}", response.status_code());
        }

        response
            .json()
            .await
            .context("Failed to parse indices get response")
    }

    /// Get all indices stats using SDK typed method
    async fn indices_stats(&self) -> Result<Value> {
        let response = self
            .client
            .indices()
            .stats(elasticsearch::indices::IndicesStatsParts::None)
            .send()
            .await
            .context("Indices stats request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!(
                "Indices stats failed with status: {}",
                response.status_code()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse indices stats response")
    }

    /// Get cluster state for shard information using SDK typed method
    async fn cluster_state(&self) -> Result<Value> {
        let response = self
            .client
            .cluster()
            .state(elasticsearch::cluster::ClusterStateParts::None)
            .send()
            .await
            .context("Cluster state request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!(
                "Cluster state failed with status: {}",
                response.status_code()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse cluster state response")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::TlsConfig;

    #[tokio::test]
    async fn test_client_creation() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            es_version: 8,
        };

        let client = Client::new(&config).await;
        assert!(client.is_ok());

        let client = client.unwrap();
        assert_eq!(client.es_version(), 8);
    }

    #[tokio::test]
    async fn test_client_with_basic_auth() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Some(ClusterAuth::Basic {
                username: "user".to_string(),
                password: "pass".to_string(),
            }),
            tls: TlsConfig::default(),
            es_version: 8,
        };

        let client = Client::new(&config).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_client_with_api_key() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Some(ClusterAuth::ApiKey {
                key: "id:key".to_string(),
            }),
            tls: TlsConfig::default(),
            es_version: 8,
        };

        let client = Client::new(&config).await;
        assert!(client.is_ok());
    }

    #[tokio::test]
    async fn test_client_version() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            es_version: 7,
        };

        let client = Client::new(&config).await.unwrap();
        assert_eq!(client.es_version(), 7);

        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            es_version: 9,
        };

        let client = Client::new(&config).await.unwrap();
        assert_eq!(client.es_version(), 9);
    }
}
