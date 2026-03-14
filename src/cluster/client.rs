use crate::config::{ClusterAuth, ClusterConfig};
use anyhow::{Context, Result};
use async_trait::async_trait;
use base64::Engine;
use reqwest::{Method, Response};
use serde_json::Value;
use std::time::Duration;
use url::Url;

#[derive(Debug, Clone)]
enum ElasticsearchAuth {
    Basic { username: String, password: String },
    ApiKey { id: String, api_key: String },
}

/// Elasticsearch client using HTTP
#[derive(Debug, Clone)]
pub struct Client {
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

    /// Merge cluster health status into indices stats (non-critical operation)
    async fn merge_indices_health(&self, stats: &mut Value) -> Result<()>;

    /// Get cluster settings
    async fn cluster_settings(&self, include_defaults: bool) -> Result<Value>;

    /// Get shard information using _cat/shards API (memory-efficient)
    async fn cat_shards(&self) -> Result<Value>;

    /// Get indices information using _cat/indices API (lightweight)
    async fn cat_indices(&self) -> Result<Value>;

    /// Get shard information for a specific node using _cat/shards API (memory-efficient)
    async fn cat_shards_for_node(&self, node_id: &str) -> Result<Value>;

    /// Get master node ID using _cat/master API (memory-efficient)
    async fn cat_master(&self) -> Result<String>;
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

        // Store base URL for HTTP requests
        let base_url = format!(
            "{}://{}{}",
            url.scheme(),
            url.host_str().unwrap_or("localhost"),
            url.port().map(|p| format!(":{}", p)).unwrap_or_default()
        );

        // Build HTTP client with TLS settings
        let mut http_client_builder = reqwest::Client::builder().timeout(Duration::from_secs(30));

        if !config.tls.verify {
            tracing::warn!("TLS certificate verification is disabled - this is insecure!");
            http_client_builder = http_client_builder.danger_accept_invalid_certs(true);
        }

        // Store authentication info
        let auth_info = if let Some(auth) = &config.auth {
            match auth {
                ClusterAuth::Basic { username, password } => Some(ElasticsearchAuth::Basic {
                    username: username.clone(),
                    password: password.clone(),
                }),
                ClusterAuth::ApiKey { key } => {
                    // ApiKey requires both id and api_key
                    let parts: Vec<&str> = key.splitn(2, ':').collect();
                    let (id, api_key) = if parts.len() == 2 {
                        (parts[0].to_string(), parts[1].to_string())
                    } else {
                        (String::new(), key.clone())
                    };
                    Some(ElasticsearchAuth::ApiKey { id, api_key })
                }
                ClusterAuth::None => None,
            }
        } else {
            None
        };

        let http_client = http_client_builder
            .build()
            .context("Failed to build HTTP client")?;

        Ok(Self {
            http_client,
            base_url,
            auth: auth_info,
        })
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

        tracing::trace!(
            "HTTP request to ES completed: {} {} -> status={}",
            method,
            path,
            response.status()
        );

        Ok(response)
    }

    async fn health(&self) -> Result<Value> {
        let url = format!("{}/_cluster/health?level=indices", self.base_url);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Health check request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Health check failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse health response")
    }

    async fn info(&self) -> Result<Value> {
        let url = format!("{}/_cluster/info", self.base_url);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Info request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Info request failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse info response")
    }

    /// Get cluster stats
    async fn cluster_stats(&self) -> Result<Value> {
        let url = format!("{}/_cluster/stats", self.base_url);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Cluster stats request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Cluster stats failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse cluster stats response")
    }

    /// Get nodes info
    async fn nodes_info(&self) -> Result<Value> {
        let url = format!("{}/_nodes", self.base_url);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Nodes info request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Nodes info failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse nodes info response")
    }

    /// Get nodes stats
    async fn nodes_stats(&self) -> Result<Value> {
        let url = format!("{}/_nodes/stats", self.base_url);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Nodes stats request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Nodes stats failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse nodes stats response")
    }

    /// Get stats for a specific node
    async fn node_stats(&self, node_id: &str) -> Result<Value> {
        let url = format!("{}/_nodes/{}/stats", self.base_url, node_id);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Node stats request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Node stats failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse node stats response")
    }

    /// Get indices
    async fn indices_get(&self, index: &str) -> Result<Value> {
        let url = format!("{}/{}", self.base_url, index);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Indices get request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Indices get failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse indices get response")
    }

    /// Get all indices stats
    async fn indices_stats(&self) -> Result<Value> {
        // Get stats for open indices (closed indices don't have stats)
        let stats_url = format!("{}/_stats", self.base_url);
        let mut stats_req = self.http_client.get(&stats_url);

        // Add authentication if configured
        if let Some(ref auth) = self.auth {
            match auth {
                ElasticsearchAuth::Basic { username, password } => {
                    stats_req = stats_req.basic_auth(username, Some(password));
                }
                ElasticsearchAuth::ApiKey { id, api_key } => {
                    let encoded = base64::engine::general_purpose::STANDARD
                        .encode(format!("{}:{}", id, api_key));
                    stats_req = stats_req.header("Authorization", format!("ApiKey {}", encoded));
                }
            }
        }

        let stats_response = stats_req
            .send()
            .await
            .context("Indices stats request failed")?;

        if !stats_response.status().is_success() {
            anyhow::bail!(
                "Indices stats failed with status: {}",
                stats_response.status()
            );
        }

        let mut stats = stats_response
            .json::<Value>()
            .await
            .context("Failed to parse indices stats response")?;

        // Debug logging for troubleshooting
        tracing::debug!(
            "Indices stats response keys: {:?}",
            stats.as_object().map(|o| o.keys().collect::<Vec<_>>())
        );
        if let Some(indices) = stats["indices"].as_object() {
            tracing::debug!("Indices found: {} indices", indices.len());
            // Log first few index names for debugging
            let sample: Vec<_> = indices.keys().take(5).collect();
            tracing::debug!("Sample indices: {:?}", sample);
        } else {
            tracing::warn!(
                "No indices found in stats response. Full response: {:?}",
                stats
            );
        }

        // Get all indices including closed ones from cluster state
        let state_url = format!("{}/_cluster/state", self.base_url);
        let mut state_req = self.http_client.get(&state_url);

        // Add authentication if configured
        if let Some(ref auth) = self.auth {
            match auth {
                ElasticsearchAuth::Basic { username, password } => {
                    state_req = state_req.basic_auth(username, Some(password));
                }
                ElasticsearchAuth::ApiKey { id, api_key } => {
                    let encoded = base64::engine::general_purpose::STANDARD
                        .encode(format!("{}:{}", id, api_key));
                    state_req = state_req.header("Authorization", format!("ApiKey {}", encoded));
                }
            }
        }

        let state_response = state_req
            .send()
            .await
            .context("Cluster state request failed")?;

        if state_response.status().is_success() {
            let state = state_response
                .json::<Value>()
                .await
                .context("Failed to parse cluster state response")?;

            // Add closed indices to stats with minimal info
            if let Some(metadata) = state["metadata"]["indices"].as_object() {
                tracing::debug!("Cluster state has {} indices in metadata", metadata.len());
                if !stats["indices"].is_object() {
                    stats["indices"] = serde_json::json!({});
                }

                let indices = stats["indices"].as_object_mut().unwrap();
                let indices_before = indices.len();
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
                tracing::debug!(
                    "Added {} closed indices, total now: {}",
                    indices.len() - indices_before,
                    indices.len()
                );
            } else {
                tracing::warn!(
                    "No metadata.indices found in cluster state. State keys: {:?}",
                    state.as_object().map(|o| o.keys().collect::<Vec<_>>())
                );
            }
        }

        Ok(stats)
    }

    /// Merge cluster health status into indices stats
    /// This is called separately to avoid breaking stats retrieval if health API fails
    async fn merge_indices_health(&self, stats: &mut Value) -> Result<()> {
        // Get actual health status from cluster health API
        match self.health().await {
            Ok(health) => {
                if let Some(indices_health) = health["indices"].as_object() {
                    if let Some(indices) = stats["indices"].as_object_mut() {
                        for (index_name, index_health) in indices_health {
                            if let Some(index_stats) = indices.get_mut(index_name) {
                                // Merge health status into stats
                                if let Some(health_status) = index_health["status"].as_str() {
                                    index_stats["health"] = serde_json::json!(health_status);
                                }
                            }
                        }
                    }
                }
                Ok(())
            }
            Err(e) => {
                // Log but don't fail - health data is helpful but not critical
                tracing::warn!(
                    "Failed to fetch cluster health for index status merge: {}",
                    e
                );
                Ok(())
            }
        }
    }

    /// Get indices stats with shard-level details
    async fn indices_stats_with_shards(&self, index: &str) -> Result<Value> {
        let url = format!("{}/{}/_stats?level=shards", self.base_url, index);
        let mut req = self.http_client.get(&url);

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

        let response = req
            .send()
            .await
            .context("Indices stats with shards request failed")?;

        if !response.status().is_success() {
            anyhow::bail!(
                "Indices stats with shards failed with status: {}",
                response.status()
            );
        }

        response
            .json()
            .await
            .context("Failed to parse indices stats with shards response")
    }

    /// Get cluster state
    async fn cluster_state(&self) -> Result<Value> {
        let url = format!("{}/_cluster/state", self.base_url);
        let mut req = self.http_client.get(&url);

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

        let response = req.send().await.context("Cluster state request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Cluster state failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse cluster state response")
    }

    async fn cluster_settings(&self, include_defaults: bool) -> Result<Value> {
        let path = if include_defaults {
            "/_cluster/settings?include_defaults=true"
        } else {
            "/_cluster/settings"
        };

        let response = self
            .request(reqwest::Method::GET, path, None)
            .await
            .context("Cluster settings request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Cluster settings failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse cluster settings response")
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

    /// Get indices information using _cat/indices API (lightweight)
    /// Returns compact index data - MUCH faster than _stats API
    async fn cat_indices(&self) -> Result<Value> {
        // Use _cat/indices API which returns basic index info
        // Includes: health, status, docs count, store size
        let response = self
            .request(
                reqwest::Method::GET,
                "/_cat/indices?format=json&bytes=b&h=health,status,index,pri,rep,docs.count,store.size",
                None,
            )
            .await
            .context("Cat indices request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Cat indices failed with status: {}", response.status());
        }

        response
            .json()
            .await
            .context("Failed to parse cat indices response")
    }

    /// Get shard information for a specific node
    /// Note: This endpoint is deprecated - use get_shards() and filter client-side
    /// Kept for backward compatibility
    async fn cat_shards_for_node(&self, node_id: &str) -> Result<Value> {
        // Fetch all shards and filter by node
        let all_shards = self
            .cat_shards()
            .await
            .context("Failed to fetch all shards")?;

        // Filter by node name or ID
        if let Some(shards_array) = all_shards.as_array() {
            tracing::debug!(
                total_shards = shards_array.len(),
                node_filter = %node_id,
                "Filtering shards for node"
            );
            let filtered: Vec<serde_json::Value> = shards_array
                .iter()
                .filter(|shard| {
                    let shard_node = shard.get("node").and_then(|v| v.as_str());
                    let matches = shard_node == Some(node_id);
                    if !matches {
                        tracing::trace!(
                            shard_node = ?shard_node,
                            filter = %node_id,
                            "Shard node doesn't match filter"
                        );
                    }
                    matches
                })
                .cloned()
                .collect();
            tracing::debug!(
                filtered_count = filtered.len(),
                node_filter = %node_id,
                "Finished filtering shards for node"
            );

            Ok(serde_json::json!(filtered))
        } else {
            Ok(serde_json::json!([]))
        }
    }

    /// Get master node ID using _cat/master API (memory-efficient)
    /// Much lighter than loading full cluster state just for the master node ID
    async fn cat_master(&self) -> Result<String> {
        let response = self
            .request(reqwest::Method::GET, "/_cat/master?format=json", None)
            .await
            .context("Cat master request failed")?;

        if !response.status().is_success() {
            anyhow::bail!("Cat master failed with status: {}", response.status());
        }

        let master_data = response
            .json::<Vec<serde_json::Value>>()
            .await
            .context("Failed to parse cat master response")?;

        // _cat/master returns an array with one object containing 'id' field
        let master_id = master_data
            .first()
            .and_then(|m| m["id"].as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow::anyhow!("No master node found in response"))?;

        Ok(master_id)
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
            ..Default::default()
        };

        let client = Client::new(&config).await;
        assert!(client.is_ok());

        let client = client.unwrap();
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
            ..Default::default()
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
            ..Default::default()
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

            ..Default::default()
        };

        let client = Client::new(&config).await.unwrap();

        let config = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),

            ..Default::default()
        };

        let client = Client::new(&config).await.unwrap();
    }
}
