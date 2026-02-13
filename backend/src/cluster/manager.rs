use crate::cluster::client::{Client, ElasticsearchClient};
use crate::config::{ClusterAuth, ClusterConfig};
use anyhow::{Context, Result};
use reqwest::{Method, Response};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;

/// Cluster connection structure maintaining client and metadata
#[derive(Debug)]
pub struct ClusterConnection {
    /// Unique cluster identifier
    pub id: String,
    /// Human-readable cluster name
    pub name: String,
    /// List of node URLs for this cluster
    pub nodes: Vec<String>,
    /// Elasticsearch client for this cluster
    pub client: Client,
    /// Authentication configuration
    pub auth: Option<ClusterAuth>,
    /// TLS configuration
    pub tls_config: crate::config::TlsConfig,
}

/// Cluster health status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum HealthStatus {
    Green,
    Yellow,
    Red,
}

/// Cluster health information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterHealth {
    pub status: HealthStatus,
    pub cluster_name: String,
    pub number_of_nodes: u32,
    pub number_of_data_nodes: u32,
    pub active_primary_shards: u32,
    pub active_shards: u32,
    pub relocating_shards: u32,
    pub initializing_shards: u32,
    pub unassigned_shards: u32,
}

/// Cluster information for API responses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClusterInfo {
    pub id: String,
    pub name: String,
    pub nodes: Vec<String>,
    pub accessible: bool,
}

impl ClusterConnection {
    /// Create a new cluster connection from configuration
    ///
    /// # Arguments
    ///
    /// * `config` - Cluster configuration
    ///
    /// # Returns
    ///
    /// A new ClusterConnection or an error if client creation fails
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.5, 2.6, 2.10, 2.11, 2.12, 2.13
    pub async fn new(config: &ClusterConfig) -> Result<Self> {
        let client = Client::new(config)
            .await
            .with_context(|| format!("Failed to create client for cluster '{}'", config.id))?;

        Ok(Self {
            id: config.id.clone(),
            name: config.name.clone(),
            nodes: config.nodes.clone(),
            client,
            auth: config.auth.clone(),
            tls_config: config.tls.clone(),
        })
    }

    /// Check cluster health
    ///
    /// # Returns
    ///
    /// ClusterHealth information or an error if the health check fails
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.10, 2.14
    pub async fn check_health(&self) -> Result<ClusterHealth> {
        let health_json = self
            .client
            .health()
            .await
            .context("Failed to fetch cluster health")?;

        // Parse the health response
        let status_str = health_json
            .get("status")
            .and_then(|v| v.as_str())
            .unwrap_or("red");

        let status = match status_str {
            "green" => HealthStatus::Green,
            "yellow" => HealthStatus::Yellow,
            _ => HealthStatus::Red,
        };

        Ok(ClusterHealth {
            status,
            cluster_name: health_json
                .get("cluster_name")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string(),
            number_of_nodes: health_json
                .get("number_of_nodes")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            number_of_data_nodes: health_json
                .get("number_of_data_nodes")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            active_primary_shards: health_json
                .get("active_primary_shards")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            active_shards: health_json
                .get("active_shards")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            relocating_shards: health_json
                .get("relocating_shards")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            initializing_shards: health_json
                .get("initializing_shards")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            unassigned_shards: health_json
                .get("unassigned_shards")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
        })
    }

    /// Execute a request against this cluster
    ///
    /// # Arguments
    ///
    /// * `method` - HTTP method
    /// * `path` - API path
    /// * `body` - Optional request body
    ///
    /// # Returns
    ///
    /// Response from Elasticsearch or an error
    pub async fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Response> {
        self.client.request(method, path, body).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{ClientType, TlsConfig};

    #[tokio::test]
    async fn test_cluster_connection_creation() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test Cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            client_type: ClientType::Http,
            version_hint: None,
        };

        let connection = ClusterConnection::new(&config).await;
        assert!(connection.is_ok());

        let conn = connection.unwrap();
        assert_eq!(conn.id, "test");
        assert_eq!(conn.name, "Test Cluster");
        assert_eq!(conn.nodes.len(), 1);
    }

    #[tokio::test]
    async fn test_cluster_connection_with_auth() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: "Test Cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Some(ClusterAuth::Basic {
                username: "user".to_string(),
                password: "pass".to_string(),
            }),
            tls: TlsConfig::default(),
            client_type: ClientType::Http,
            version_hint: None,
        };

        let connection = ClusterConnection::new(&config).await;
        assert!(connection.is_ok());

        let conn = connection.unwrap();
        assert!(conn.auth.is_some());
    }

    #[test]
    fn test_health_status_serialization() {
        let status = HealthStatus::Green;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"green\"");

        let status = HealthStatus::Yellow;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"yellow\"");

        let status = HealthStatus::Red;
        let json = serde_json::to_string(&status).unwrap();
        assert_eq!(json, "\"red\"");
    }

    #[test]
    fn test_health_status_deserialization() {
        let status: HealthStatus = serde_json::from_str("\"green\"").unwrap();
        assert_eq!(status, HealthStatus::Green);

        let status: HealthStatus = serde_json::from_str("\"yellow\"").unwrap();
        assert_eq!(status, HealthStatus::Yellow);

        let status: HealthStatus = serde_json::from_str("\"red\"").unwrap();
        assert_eq!(status, HealthStatus::Red);
    }

    #[test]
    fn test_cluster_info_serialization() {
        let info = ClusterInfo {
            id: "test".to_string(),
            name: "Test Cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            accessible: true,
        };

        let json = serde_json::to_string(&info).unwrap();
        assert!(json.contains("\"id\":\"test\""));
        assert!(json.contains("\"accessible\":true"));
    }
}

/// Cluster manager for managing multiple Elasticsearch/OpenSearch clusters
///
/// The ClusterManager maintains connections to multiple clusters and provides
/// methods for cluster operations, health checks, and request proxying.
#[derive(Debug)]
pub struct Manager {
    /// Map of cluster ID to cluster connection
    clusters: Arc<RwLock<HashMap<String, Arc<ClusterConnection>>>>,
}

impl Manager {
    /// Create a new cluster manager from configuration
    ///
    /// # Arguments
    ///
    /// * `cluster_configs` - Vector of cluster configurations
    ///
    /// # Returns
    ///
    /// A new Manager instance or an error if any cluster fails to initialize
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.1, 2.14, 2.17
    pub async fn new(cluster_configs: Vec<ClusterConfig>) -> Result<Self> {
        let mut clusters = HashMap::new();

        for config in cluster_configs {
            tracing::info!("Initializing cluster: {} ({})", config.name, config.id);

            let connection = ClusterConnection::new(&config)
                .await
                .with_context(|| format!("Failed to initialize cluster '{}'", config.id))?;

            clusters.insert(config.id.clone(), Arc::new(connection));
        }

        if clusters.is_empty() {
            anyhow::bail!("No clusters configured");
        }

        tracing::info!("Initialized {} cluster(s)", clusters.len());

        Ok(Self {
            clusters: Arc::new(RwLock::new(clusters)),
        })
    }

    /// Get a cluster connection by ID
    ///
    /// # Arguments
    ///
    /// * `cluster_id` - The cluster identifier
    ///
    /// # Returns
    ///
    /// An Arc reference to the cluster connection or an error if not found
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.15, 2.16
    pub async fn get_cluster(&self, cluster_id: &str) -> Result<Arc<ClusterConnection>> {
        let clusters = self.clusters.read().await;

        clusters
            .get(cluster_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Cluster '{}' not found", cluster_id))
    }

    /// List all configured clusters
    ///
    /// # Returns
    ///
    /// A vector of ClusterInfo for all configured clusters
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.1, 2.15
    pub async fn list_clusters(&self) -> Vec<ClusterInfo> {
        let clusters = self.clusters.read().await;

        clusters
            .values()
            .map(|conn| ClusterInfo {
                id: conn.id.clone(),
                name: conn.name.clone(),
                nodes: conn.nodes.clone(),
                accessible: true, // Will be determined by health checks
            })
            .collect()
    }

    /// Proxy a request to a specific cluster
    ///
    /// # Arguments
    ///
    /// * `cluster_id` - The cluster identifier
    /// * `method` - HTTP method
    /// * `path` - API path
    /// * `body` - Optional request body as bytes
    ///
    /// # Returns
    ///
    /// Response from Elasticsearch or an error
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.15, 2.16, 2.18
    pub async fn proxy_request(
        &self,
        cluster_id: &str,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Response> {
        let cluster = self.get_cluster(cluster_id).await?;

        tracing::debug!("Proxying {} {} to cluster '{}'", method, path, cluster_id);

        cluster
            .request(method, path, body)
            .await
            .with_context(|| format!("Failed to proxy request to cluster '{}'", cluster_id))
    }

    /// Check health of a specific cluster
    ///
    /// # Arguments
    ///
    /// * `cluster_id` - The cluster identifier
    ///
    /// # Returns
    ///
    /// ClusterHealth information or an error
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.14, 2.18
    pub async fn check_health(&self, cluster_id: &str) -> Result<ClusterHealth> {
        let cluster = self.get_cluster(cluster_id).await?;

        cluster
            .check_health()
            .await
            .with_context(|| format!("Failed to check health for cluster '{}'", cluster_id))
    }

    /// Check health of all clusters
    ///
    /// # Returns
    ///
    /// A HashMap mapping cluster IDs to their health status (or error message)
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.14, 2.18
    pub async fn check_all_health(&self) -> HashMap<String, Result<ClusterHealth>> {
        let clusters = self.clusters.read().await;
        let mut health_results = HashMap::new();

        for (id, cluster) in clusters.iter() {
            let health = cluster.check_health().await;
            health_results.insert(id.clone(), health);
        }

        health_results
    }

    /// Get the number of configured clusters
    ///
    /// # Returns
    ///
    /// The number of clusters
    pub async fn cluster_count(&self) -> usize {
        let clusters = self.clusters.read().await;
        clusters.len()
    }

    /// Check if a cluster exists
    ///
    /// # Arguments
    ///
    /// * `cluster_id` - The cluster identifier
    ///
    /// # Returns
    ///
    /// true if the cluster exists, false otherwise
    pub async fn has_cluster(&self, cluster_id: &str) -> bool {
        let clusters = self.clusters.read().await;
        clusters.contains_key(cluster_id)
    }
}

#[cfg(test)]
mod manager_tests {
    use super::*;
    use crate::config::{ClientType, TlsConfig};

    #[tokio::test]
    async fn test_manager_creation() {
        let configs = vec![
            ClusterConfig {
                id: "cluster1".to_string(),
                name: "Cluster 1".to_string(),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
            ClusterConfig {
                id: "cluster2".to_string(),
                name: "Cluster 2".to_string(),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
        ];

        let manager = Manager::new(configs).await;
        assert!(manager.is_ok());

        let mgr = manager.unwrap();
        assert_eq!(mgr.cluster_count().await, 2);
    }

    #[tokio::test]
    async fn test_manager_empty_clusters() {
        let configs = vec![];
        let manager = Manager::new(configs).await;
        assert!(manager.is_err());
        assert!(manager
            .unwrap_err()
            .to_string()
            .contains("No clusters configured"));
    }

    #[tokio::test]
    async fn test_get_cluster() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            client_type: ClientType::Http,
            version_hint: None,
        }];

        let manager = Manager::new(configs).await.unwrap();

        let cluster = manager.get_cluster("test").await;
        assert!(cluster.is_ok());

        let conn = cluster.unwrap();
        assert_eq!(conn.id, "test");
    }

    #[tokio::test]
    async fn test_get_cluster_not_found() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            client_type: ClientType::Http,
            version_hint: None,
        }];

        let manager = Manager::new(configs).await.unwrap();

        let cluster = manager.get_cluster("nonexistent").await;
        assert!(cluster.is_err());
        assert!(cluster
            .unwrap_err()
            .to_string()
            .contains("Cluster 'nonexistent' not found"));
    }

    #[tokio::test]
    async fn test_list_clusters() {
        let configs = vec![
            ClusterConfig {
                id: "cluster1".to_string(),
                name: "Cluster 1".to_string(),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
            ClusterConfig {
                id: "cluster2".to_string(),
                name: "Cluster 2".to_string(),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
        ];

        let manager = Manager::new(configs).await.unwrap();
        let clusters = manager.list_clusters().await;

        assert_eq!(clusters.len(), 2);
        assert!(clusters.iter().any(|c| c.id == "cluster1"));
        assert!(clusters.iter().any(|c| c.id == "cluster2"));
    }

    #[tokio::test]
    async fn test_has_cluster() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: TlsConfig::default(),
            client_type: ClientType::Http,
            version_hint: None,
        }];

        let manager = Manager::new(configs).await.unwrap();

        assert!(manager.has_cluster("test").await);
        assert!(!manager.has_cluster("nonexistent").await);
    }

    #[tokio::test]
    async fn test_cluster_count() {
        let configs = vec![
            ClusterConfig {
                id: "cluster1".to_string(),
                name: "Cluster 1".to_string(),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
            ClusterConfig {
                id: "cluster2".to_string(),
                name: "Cluster 2".to_string(),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
        ];

        let manager = Manager::new(configs).await.unwrap();
        assert_eq!(manager.cluster_count().await, 2);
    }

    #[tokio::test]
    async fn test_manager_with_different_auth_types() {
        let configs = vec![
            ClusterConfig {
                id: "basic".to_string(),
                name: "Basic Auth".to_string(),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: Some(ClusterAuth::Basic {
                    username: "user".to_string(),
                    password: "pass".to_string(),
                }),
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
            ClusterConfig {
                id: "apikey".to_string(),
                name: "API Key".to_string(),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: Some(ClusterAuth::ApiKey {
                    key: "key123".to_string(),
                }),
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
            ClusterConfig {
                id: "none".to_string(),
                name: "No Auth".to_string(),
                nodes: vec!["http://localhost:9202".to_string()],
                auth: None,
                tls: TlsConfig::default(),
                client_type: ClientType::Http,
                version_hint: None,
            },
        ];

        let manager = Manager::new(configs).await;
        assert!(manager.is_ok());

        let mgr = manager.unwrap();
        assert_eq!(mgr.cluster_count().await, 3);
    }
}
