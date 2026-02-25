use crate::config::{ClusterAuth, ClusterConfig};
use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use elasticsearch::{
    auth::Credentials,
    http::transport::{SingleNodeConnectionPool, TransportBuilder},
    Elasticsearch,
};
use reqwest::{Method, Response};
use serde_json::Value;
use std::time::Duration;
use url::Url;

#[derive(Debug, Clone)]
enum ElasticsearchAuth {
    Basic { username: String, password: String },
    ApiKey { id: String, api_key: String },
}

/// Elasticsearch client using official elasticsearch crate
#[derive(Debug, Clone)]
pub struct Client {
    client: Elasticsearch,
    es_version: u8,
    http_client: reqwest::Client,
    base_url: String,
    auth: Option<ElasticsearchAuth>,
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

    /// Get stats for a specific node
    async fn node_stats(&self, node_id: &str) -> Result<Value>;

    /// Get indices
    async fn indices_get(&self, index: &str) -> Result<Value>;

    /// Get indices stats
    async fn indices_stats(&self) -> Result<Value>;

    /// Get indices stats with shard-level details using SDK typed method
    async fn indices_stats_with_shards(&self, index: &str) -> Result<Value>;

    /// Get cluster state
    async fn cluster_state(&self) -> Result<Value>;

    /// Get shard information using _cat/shards API (memory-efficient)
    async fn cat_shards(&self) -> Result<Value>;
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

        // Store base URL for direct HTTP requests
        let base_url = format!(
            "{}://{}{}",
            url.scheme(),
            url.host_str().unwrap_or("localhost"),
            url.port().map(|p| format!(":{}", p)).unwrap_or_default()
        );

        // Create connection pool
        let conn_pool = SingleNodeConnectionPool::new(url.clone());

        // Build transport with authentication and TLS settings
        let mut transport_builder = TransportBuilder::new(conn_pool);

        // Configure timeout
        transport_builder = transport_builder.timeout(Duration::from_secs(30));

        // Store authentication info for direct HTTP requests
        let auth_info = if let Some(auth) = &config.auth {
            match auth {
                ClusterAuth::Basic { username, password } => {
                    let credentials = Credentials::Basic(username.clone(), password.clone());
                    transport_builder = transport_builder.auth(credentials);
                    Some(ElasticsearchAuth::Basic {
                        username: username.clone(),
                        password: password.clone(),
                    })
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
                    let credentials = Credentials::ApiKey(id.clone(), api_key.clone());
                    transport_builder = transport_builder.auth(credentials);
                    Some(ElasticsearchAuth::ApiKey { id, api_key })
                }
                ClusterAuth::None => None,
            }
        } else {
            None
        };

        // Configure TLS certificate verification
        let mut http_client_builder = reqwest::Client::builder().timeout(Duration::from_secs(30));

        if !config.tls.verify {
            tracing::warn!("TLS certificate verification is disabled - this is insecure!");
            transport_builder =
                transport_builder.cert_validation(elasticsearch::cert::CertificateValidation::None);
            http_client_builder = http_client_builder.danger_accept_invalid_certs(true);
        }

        // Build transport
        let transport = transport_builder
            .build()
            .context("Failed to build Elasticsearch transport")?;

        // Create clients
        let client = Elasticsearch::new(transport);
        let http_client = http_client_builder
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            client,
            es_version: config.es_version,
            http_client,
            base_url,
            auth: auth_info,
        })
    }

    /// Get the Elasticsearch version this client is configured for
    pub fn es_version(&self) -> u8 {
        self.es_version
    }
}

#[async_trait]
impl ElasticsearchClient for Client {
    async fn request(&self, method: Method, path: &str, body: Option<Value>) -> Result<Response> {
        // For arbitrary requests, we need to use reqwest directly since the ES SDK
        // doesn't provide a generic request builder for all paths
        let url = format!("{}{}", self.base_url, path);

        let mut req = match method {
            Method::GET => self.http_client.get(&url),
            Method::POST => self.http_client.post(&url),
            Method::PUT => self.http_client.put(&url),
            Method::DELETE => self.http_client.delete(&url),
            Method::HEAD => self.http_client.head(&url),
            _ => anyhow::bail!("Unsupported HTTP method: {}", method),
        };

        // Add authentication if configured
        if let Some(ref auth) = self.auth {
            match auth {
                ElasticsearchAuth::Basic { username, password } => {
                    req = req.basic_auth(username, Some(password));
                }
                ElasticsearchAuth::ApiKey { id, api_key } => {
                    let encoded = base64::engine::general_purpose::STANDARD
                        .encode(format!("{}:{}", id, api_key));
                    req = req.header("Authorization", format!("ApiKey {}", encoded));
                }
            }
        }

        // Add body if present
        if let Some(b) = body {
            req = req.json(&b);
        }

        // Send the request
        let response = req
            .send()
            .await
            .context("Failed to send request to Elasticsearch")?;

        Ok(response)
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

    /// Get stats for a specific node using SDK typed method
    async fn node_stats(&self, node_id: &str) -> Result<Value> {
        let response = self
            .client
            .nodes()
            .stats(elasticsearch::nodes::NodesStatsParts::NodeId(&[node_id]))
            .send()
            .await
            .context("Node stats request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!("Node stats failed with status: {}", response.status_code());
        }

        response
            .json()
            .await
            .context("Failed to parse node stats response")
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
        // Get stats for open indices (closed indices don't have stats)
        let stats_response = self
            .client
            .indices()
            .stats(elasticsearch::indices::IndicesStatsParts::None)
            .send()
            .await
            .context("Indices stats request failed")?;

        if !stats_response.status_code().is_success() {
            anyhow::bail!(
                "Indices stats failed with status: {}",
                stats_response.status_code()
            );
        }

        let mut stats = stats_response
            .json::<Value>()
            .await
            .context("Failed to parse indices stats response")?;

        // Get all indices including closed ones from cluster state
        let state_response = self
            .client
            .cluster()
            .state(elasticsearch::cluster::ClusterStateParts::None)
            .send()
            .await
            .context("Cluster state request failed")?;

        if state_response.status_code().is_success() {
            let state = state_response
                .json::<Value>()
                .await
                .context("Failed to parse cluster state response")?;

            // Add closed indices to stats with minimal info
            if let Some(metadata) = state["metadata"]["indices"].as_object() {
                if !stats["indices"].is_object() {
                    stats["indices"] = serde_json::json!({});
                }

                let indices = stats["indices"].as_object_mut().unwrap();
                for (index_name, index_state) in metadata {
                    // Only add if not already in stats (i.e., it's closed)
                    if !indices.contains_key(index_name) {
                        let status = if index_state["state"].as_str() == Some("close") {
                            "close"
                        } else {
                            "open"
                        };

                        indices.insert(
                            index_name.clone(),
                            serde_json::json!({
                                "status": status,
                                "health": "unknown",
                                "primaries": {
                                    "docs": {"count": 0},
                                    "shard_stats": {"total_count": 0}
                                },
                                "total": {
                                    "docs": {"count": 0},
                                    "store": {"size_in_bytes": 0}
                                },
                                "shards": {}
                            }),
                        );
                    }
                }
            }
        }

        Ok(stats)
    }

    /// Get indices stats with shard-level details using SDK typed method
    async fn indices_stats_with_shards(&self, index: &str) -> Result<Value> {
        let response = self
            .client
            .indices()
            .stats(elasticsearch::indices::IndicesStatsParts::Index(&[index]))
            .level(elasticsearch::params::Level::Shards)
            .send()
            .await
            .context("Indices stats with shards request failed")?;

        if !response.status_code().is_success() {
            anyhow::bail!(
                "Indices stats with shards failed with status: {}",
                response.status_code()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse indices stats with shards response")
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

    /// Get shard information using _cat/shards API (memory-efficient)
    /// Returns compact shard data without loading entire cluster state
    async fn cat_shards(&self) -> Result<Value> {
        // Use _cat/shards API which is more memory-efficient than _cluster/state
        // Returns JSON format with shard allocation information
        let response = self
            .request(
                reqwest::Method::GET,
                "/_cat/shards?format=json&bytes=b&h=index,shard,prirep,state,node,docs,store",
                None,
            )
            .await
            .context("Cat shards request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Cat shards failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse cat shards response")
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
            name: Some("Test".to_string()),
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
            name: Some("Test".to_string()),
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
            name: Some("Test".to_string()),
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
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            es_version: 7,
        };

        let client = Client::new(&config).await.unwrap();
        assert_eq!(client.es_version(), 7);

        let config = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            es_version: 9,
        };

        let client = Client::new(&config).await.unwrap();
        assert_eq!(client.es_version(), 9);
    }
}
