use crate::auth::{AuthUser, RbacManager};
use crate::cache::MetadataCache;
use crate::cluster::client::{Client, ElasticsearchClient};
use crate::config::{
    ClusterConfig, ClusterWarning, MetricsSource, PrometheusConfig as ClusterPrometheusConfig,
};
use crate::telemetry::client::InstrumentedElasticsearchClient;
use anyhow::{Context, Result};
use indexmap::IndexMap;
use reqwest::{header::HeaderMap, Method, Response, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use std::time::Instant;
use tokio::sync::RwLock;
use tracing::instrument;
use utoipa::ToSchema;

/// Cluster connection structure maintaining client and metadata
#[derive(Debug)]
pub struct ClusterConnection {
    /// Unique cluster identifier
    pub id: String,
    /// Human-readable cluster name (optional, defaults to ID if not provided)
    pub name: Option<String>,
    /// List of node URLs for this cluster
    pub nodes: Vec<String>,
    /// Pre-created client for this cluster. `None` if the cluster is inaccessible.
    ///
    /// For backwards compatibility we keep `client` pointing to the first
    /// pre-created role-specific client (if any). New code should prefer
    /// `role_clients` and Manager::get_client_for_user for per-request selection.
    pub client: Option<Arc<Client>>,
    /// Per-role pre-created clients for this cluster. Entries are created at
    /// startup in the same order as configured RoleCredential entries.
    pub role_clients: Vec<RoleClient>,
    /// TLS configuration
    pub tls_config: crate::config::TlsConfig,
    /// Metrics source configuration
    pub metrics_source: MetricsSource,
    /// Prometheus configuration (if metrics_source is Prometheus)
    pub prometheus: Option<ClusterPrometheusConfig>,
    /// Whether this cluster is considered accessible at runtime
    pub accessible: bool,
    /// Optional human-friendly reason why cluster is inaccessible
    pub accessible_reason: Option<String>,
}

/// Pre-created client bound to a set of roles
#[derive(Debug, Clone)]
pub struct RoleClient {
    /// Roles this client applies to (may contain "*" for wildcard)
    pub roles: Vec<String>,
    /// The HTTP client configured with the matching credential
    pub client: Arc<Client>,
    /// Human-readable label for the matched role (joined roles)
    pub label: String,
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
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ClusterInfo {
    pub id: String,
    pub name: Option<String>,
    pub nodes: Vec<String>,
    pub accessible: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub accessible_reason: Option<String>,
    /// Metrics source (internal or prometheus)
    pub metrics_source: MetricsSource,
}

impl ClusterConnection {
    fn client_ref(&self) -> Result<&Client> {
        self.client
            .as_ref()
            .map(|c| c.as_ref())
            .ok_or_else(|| anyhow::anyhow!("Cluster '{}' is inaccessible", self.id))
    }

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
        let c = Client::new(config)
            .await
            .with_context(|| format!("Failed to create client for cluster '{}'", config.id))?;

        Ok(Self {
            id: config.id.clone(),
            name: config.name.clone(),
            nodes: config.nodes.clone(),
            client: Some(Arc::new(c)),
            // For now initialize role_clients empty. Manager will populate
            // per-role clients at startup in a subsequent change.
            role_clients: Vec::new(),
            tls_config: config.tls.clone(),
            metrics_source: config.metrics_source.clone(),
            prometheus: config.prometheus.clone(),
            accessible: true,
            accessible_reason: None,
        })
    }

    /// Check cluster health
    ///
    /// # Returns
    ///
    /// Cluster health status and shard information
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.10, 2.14
    #[instrument(skip(self), fields(cluster_id = %self.id))]
    pub async fn check_health(&self) -> Result<ClusterHealth> {
        let client = self.client_ref()?;
        let health_json = client
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
    #[instrument(skip(self, body), fields(cluster_id = %self.id, method = %method, path = %path))]
    pub async fn request(
        &self,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Response> {
        // Use instrumented request for tracing
        let client = self.client_ref()?;
        client
            .instrumented_request(method, path, body, &self.id)
            .await
    }

    /// Get cluster health using SDK typed method
    pub async fn health(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.health().await
    }

    /// Get cluster info (root endpoint) using SDK typed method
    pub async fn info(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.info().await
    }

    /// Get cluster settings using SDK typed method
    pub async fn cluster_settings(&self, include_defaults: bool) -> Result<Value> {
        let client = self.client_ref()?;
        client.cluster_settings(include_defaults).await
    }

    /// Get cluster stats using SDK typed method
    #[instrument(skip(self), fields(cluster_id = %self.id))]
    pub async fn cluster_stats(&self) -> Result<Value> {
        // Use instrumented request for tracing
        let client = self.client_ref()?;
        let response = client
            .instrumented_request(Method::GET, "_cluster/stats", None::<Value>, &self.id)
            .await?;
        Ok(response.json().await?)
    }

    /// Get nodes info using SDK typed method
    pub async fn nodes_info(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.nodes_info().await
    }

    /// Get nodes stats using SDK typed method
    pub async fn nodes_stats(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.nodes_stats().await
    }

    /// Get stats for a specific node using SDK typed method
    pub async fn node_stats(&self, node_id: &str) -> Result<Value> {
        let client = self.client_ref()?;
        client.node_stats(node_id).await
    }

    /// Get indices using SDK typed method
    pub async fn indices_get(&self, index: &str) -> Result<Value> {
        let client = self.client_ref()?;
        client.indices_get(index).await
    }

    /// Get indices stats using SDK typed method
    pub async fn indices_stats(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.indices_stats().await
    }

    /// Merge cluster health status into indices stats (non-critical operation)
    pub async fn merge_indices_health(&self, stats: &mut Value) -> Result<()> {
        let client = self.client_ref()?;
        client.merge_indices_health(stats).await
    }

    /// Get cluster state using SDK typed method
    pub async fn cluster_state(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.cluster_state().await
    }

    /// Get indices stats with shard-level details using SDK typed method
    pub async fn indices_stats_with_shards(&self, index: &str) -> Result<Value> {
        let client = self.client_ref()?;
        client.indices_stats_with_shards(index).await
    }

    /// Get shard information using _cat/shards API (memory-efficient)
    pub async fn cat_shards(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.cat_shards().await
    }

    /// Get indices information using _cat/indices API (lightweight)
    pub async fn cat_indices(&self) -> Result<Value> {
        let client = self.client_ref()?;
        client.cat_indices().await
    }

    /// Get shard information for a specific node (memory-efficient)
    pub async fn cat_shards_for_node(&self, node_id: &str) -> Result<Value> {
        let client = self.client_ref()?;
        client.cat_shards_for_node(node_id).await
    }

    /// Get shard information for a specific index
    /// Returns full shard details including docs and store
    pub async fn cat_shards_for_index(&self, index: &str) -> Result<Value> {
        let client = self.client_ref()?;
        client.cat_shards_for_index(index).await
    }

    /// Get cluster state with routing_nodes metric for paginated shard listing
    #[instrument(skip(self), fields(cluster_id = %self.id))]
    pub async fn cluster_state_routing_nodes(&self, indices: Option<&[String]>) -> Result<Value> {
        let client = self.client_ref()?;
        client
            .cluster_state_routing_nodes(indices)
            .await
            .context("Failed to get cluster state with routing nodes")
    }

    /// Get master node ID using _cat/master API (memory-efficient)
    #[instrument(skip(self), fields(cluster_id = %self.id))]
    pub async fn cat_master(&self) -> Result<String> {
        let client = self.client_ref()?;
        let response = client
            .cat_master()
            .await
            .context("Failed to get master node info")?;

        Ok(response)
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::config::{ClusterAuth, TlsConfig};

    #[tokio::test]
    async fn test_cluster_connection_creation() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test Cluster".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        };

        let connection = ClusterConnection::new(&config).await;
        assert!(connection.is_ok());

        let conn = connection.expect("ClusterConnection::new should succeed in test");
        assert_eq!(conn.id, "test");
        assert_eq!(conn.name, Some("Test Cluster".to_string()));
        assert_eq!(conn.nodes.len(), 1);
    }

    #[tokio::test]
    async fn test_cluster_connection_with_auth() {
        let config = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test Cluster".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: vec![crate::config::RoleCredential {
                roles: vec!["*".to_string()],
                auth: ClusterAuth::Basic {
                    username: "user".to_string(),
                    password: "pass".to_string(),
                },
            }],
            tls: TlsConfig::default(),

            ..Default::default()
        };

        let connection = ClusterConnection::new(&config).await;
        assert!(connection.is_ok());

        let conn = connection.expect("ClusterConnection::new should succeed in test");
        assert!(conn.client.is_some());
    }

    #[test]
    fn test_health_status_serialization() {
        let status = HealthStatus::Green;
        let json = serde_json::to_string(&status).expect("serialize health status to JSON");
        assert_eq!(json, "\"green\"");

        let status = HealthStatus::Yellow;
        let json = serde_json::to_string(&status).expect("serialize health status to JSON");
        assert_eq!(json, "\"yellow\"");

        let status = HealthStatus::Red;
        let json = serde_json::to_string(&status).expect("serialize health status to JSON");
        assert_eq!(json, "\"red\"");
    }

    #[test]
    fn test_health_status_deserialization() {
        let status: HealthStatus =
            serde_json::from_str("\"green\"").expect("deserialize HealthStatus from JSON");
        assert_eq!(status, HealthStatus::Green);

        let status: HealthStatus =
            serde_json::from_str("\"yellow\"").expect("deserialize HealthStatus from JSON");
        assert_eq!(status, HealthStatus::Yellow);

        let status: HealthStatus =
            serde_json::from_str("\"red\"").expect("deserialize HealthStatus from JSON");
        assert_eq!(status, HealthStatus::Red);
    }

    #[test]
    fn test_cluster_info_serialization() {
        let info = ClusterInfo {
            id: "test".to_string(),
            name: Some("Test Cluster".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            accessible: true,
            accessible_reason: None,

            metrics_source: MetricsSource::Internal,
        };

        let json = serde_json::to_string(&info).expect("serialize cluster info to JSON");
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
    /// Map of cluster ID to cluster connection (IndexMap preserves config insertion order)
    clusters: Arc<RwLock<IndexMap<String, Arc<ClusterConnection>>>>,
    /// RBAC manager for access control
    rbac: Option<Arc<RbacManager>>,
    /// Cache for cluster health metadata
    health_cache: MetadataCache<ClusterHealth>,
}

use crate::cluster::ProxyRequestError;

impl Manager {
    /// Create a new cluster manager from configuration
    ///
    /// # Arguments
    ///
    /// * `cluster_configs` - Vector of cluster configurations
    /// * `cache_duration` - Duration to cache cluster metadata
    ///
    /// # Returns
    ///
    /// A new Manager instance or an error if no clusters are configured.
    /// Individual cluster init failures are logged as warnings and skipped.
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.1, 2.14, 2.17, 31.2
    pub async fn new_with_warnings(
        cluster_configs: Vec<ClusterConfig>,
        cache_duration: Duration,
        cluster_warnings: Option<Vec<ClusterWarning>>,
    ) -> Result<Self> {
        let mut clusters = IndexMap::new();
        let total = cluster_configs.len();

        let warnings_map: std::collections::HashMap<String, String> = cluster_warnings
            .unwrap_or_default()
            .into_iter()
            .map(|w| (w.id, w.reason))
            .collect();

        for config in cluster_configs {
            let display_name = config.name.as_deref().unwrap_or(&config.id);
            tracing::debug!(cluster_id = %config.id, cluster_name = %display_name, "Initializing cluster");

            if let Some(reason) = warnings_map.get(&config.id) {
                tracing::warn!(cluster_id = %config.id, reason = %reason, "Cluster has config warning and will be marked inaccessible");
                let placeholder = ClusterConnection {
                    id: config.id.clone(),
                    name: config.name.clone(),
                    nodes: config.nodes.clone(),
                    client: None,
                    role_clients: Vec::new(),
                    tls_config: config.tls.clone(),
                    metrics_source: config.metrics_source.clone(),
                    prometheus: config.prometheus.clone(),
                    accessible: false,
                    accessible_reason: Some(reason.clone()),
                };
                clusters.insert(config.id.clone(), Arc::new(placeholder));
                continue;
            }

            // Initialize cluster connections. Pre-create one HTTP client per
            // configured RoleCredential to allow per-role credential selection
            // at runtime. If no RoleCredential entries are configured we fall
            // back to legacy behaviour and create a single client.
            if config.auth.is_empty() {
                match Client::new(&config).await {
                    Ok(c) => {
                        let connection = ClusterConnection {
                            id: config.id.clone(),
                            name: config.name.clone(),
                            nodes: config.nodes.clone(),
                            client: Some(Arc::new(c)),
                            role_clients: Vec::new(),
                            tls_config: config.tls.clone(),
                            metrics_source: config.metrics_source.clone(),
                            prometheus: config.prometheus.clone(),
                            accessible: true,
                            accessible_reason: None,
                        };
                        clusters.insert(config.id.clone(), Arc::new(connection));
                    }
                    Err(e) => {
                        tracing::warn!(
                            cluster_id = %config.id,
                            error = %e,
                            "Failed to initialise cluster — it will be marked inaccessible"
                        );
                        let placeholder = ClusterConnection {
                            id: config.id.clone(),
                            name: config.name.clone(),
                            nodes: config.nodes.clone(),
                            client: None,
                            role_clients: Vec::new(),
                            tls_config: config.tls.clone(),
                            metrics_source: config.metrics_source.clone(),
                            prometheus: config.prometheus.clone(),
                            accessible: false,
                            accessible_reason: Some(e.to_string()),
                        };
                        clusters.insert(config.id.clone(), Arc::new(placeholder));
                    }
                }
            } else {
                // Create one client per RoleCredential in configuration order
                let mut role_clients: Vec<RoleClient> = Vec::new();
                let mut init_error: Option<anyhow::Error> = None;

                for rc in &config.auth {
                    match Client::new_with_auth(&config, Some(&rc.auth)).await {
                        Ok(c) => {
                            let arc = Arc::new(c);
                            let label = rc.roles.join(",");
                            role_clients.push(RoleClient {
                                roles: rc.roles.clone(),
                                client: arc,
                                label,
                            });
                        }
                        Err(e) => {
                            init_error = Some(e);
                            break;
                        }
                    }
                }

                if init_error.is_some() {
                    tracing::warn!(
                        cluster_id = %config.id,
                        error = %init_error.as_ref().map(|e| e.to_string()).unwrap_or_default(),
                        "Failed to initialise role-specific clients — cluster will be marked inaccessible"
                    );
                    let placeholder = ClusterConnection {
                        id: config.id.clone(),
                        name: config.name.clone(),
                        nodes: config.nodes.clone(),
                        client: None,
                        role_clients: Vec::new(),
                        tls_config: config.tls.clone(),
                        metrics_source: config.metrics_source.clone(),
                        prometheus: config.prometheus.clone(),
                        accessible: false,
                        accessible_reason: init_error.as_ref().map(|e| e.to_string()),
                    };
                    clusters.insert(config.id.clone(), Arc::new(placeholder));
                    continue;
                }

                // For backwards compatibility keep `client` pointing at the first role client
                // Use `first()` to satisfy clippy::get_first
                let primary = role_clients.first().map(|rc| rc.client.clone());

                let connection = ClusterConnection {
                    id: config.id.clone(),
                    name: config.name.clone(),
                    nodes: config.nodes.clone(),
                    client: primary,
                    role_clients,
                    tls_config: config.tls.clone(),
                    metrics_source: config.metrics_source.clone(),
                    prometheus: config.prometheus.clone(),
                    accessible: true,
                    accessible_reason: None,
                };

                clusters.insert(config.id.clone(), Arc::new(connection));
            }
        }

        if total == 0 {
            anyhow::bail!("No clusters configured");
        }

        tracing::debug!(cluster_count = clusters.len(), "Clusters initialized");
        tracing::debug!(
            cache_duration_secs = cache_duration.as_secs(),
            "Cache configured"
        );

        Ok(Self {
            clusters: Arc::new(RwLock::new(clusters)),
            rbac: None,
            health_cache: MetadataCache::new(cache_duration),
        })
    }

    /// Backwards-compatible constructor that doesn't accept load-time warnings
    pub async fn new(
        cluster_configs: Vec<ClusterConfig>,
        cache_duration: Duration,
    ) -> Result<Self> {
        Self::new_with_warnings(cluster_configs, cache_duration, None).await
    }

    /// Create a new cluster manager with RBAC enabled
    ///
    /// # Arguments
    ///
    /// * `cluster_configs` - Vector of cluster configurations
    /// * `rbac_manager` - RBAC manager for access control
    /// * `cache_duration` - Duration to cache cluster metadata
    ///
    /// # Returns
    ///
    /// A new Manager instance with RBAC enabled
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.1, 2.14, 2.17, 23.1, 31.2
    pub async fn new_with_rbac(
        cluster_configs: Vec<ClusterConfig>,
        rbac_manager: RbacManager,
        cache_duration: Duration,
    ) -> Result<Self> {
        let mut manager = Self::new(cluster_configs, cache_duration).await?;
        manager.rbac = Some(Arc::new(rbac_manager));
        Ok(manager)
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
    #[instrument(skip(self), fields(cluster_id = %cluster_id))]
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
    #[instrument(skip(self))]
    pub async fn list_clusters(&self) -> Vec<ClusterInfo> {
        let clusters = self.clusters.read().await;

        clusters
            .values()
            .map(|conn| ClusterInfo {
                id: conn.id.clone(),
                name: conn.name.clone(),
                nodes: conn.nodes.clone(),
                accessible: conn.accessible, // reflect initialization result
                accessible_reason: conn.accessible_reason.clone(),
                metrics_source: conn.metrics_source.clone(),
            })
            .collect()
    }

    /// List clusters accessible to a specific user based on RBAC
    ///
    /// # Arguments
    ///
    /// * `user` - The authenticated user
    ///
    /// # Returns
    ///
    /// A vector of ClusterInfo for clusters the user can access
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 23.3, 23.5
    #[instrument(skip(self, user), fields(user = %user.username))]
    pub async fn list_accessible_clusters(&self, user: &AuthUser) -> Vec<ClusterInfo> {
        let all_clusters = self.list_clusters().await;

        // If no RBAC is configured, return all clusters
        let Some(rbac) = &self.rbac else {
            return all_clusters;
        };

        // Filter clusters based on user's roles
        let cluster_ids: Vec<String> = all_clusters.iter().map(|c| c.id.clone()).collect();
        let accessible_ids = rbac.get_accessible_clusters(user, &cluster_ids);

        all_clusters
            .into_iter()
            .filter(|c| accessible_ids.contains(&c.id))
            .collect()
    }

    /// Check if a user can access a specific cluster
    ///
    /// # Arguments
    ///
    /// * `user` - The authenticated user
    /// * `cluster_id` - The cluster identifier
    ///
    /// # Returns
    ///
    /// true if the user can access the cluster, false otherwise
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 23.3, 23.4
    pub fn can_access_cluster(&self, user: &AuthUser, cluster_id: &str) -> bool {
        // If no RBAC is configured, allow access to all clusters
        let Some(rbac) = &self.rbac else {
            return true;
        };

        rbac.can_access_cluster(user, cluster_id)
    }

    /// Get a cluster connection by ID with RBAC check
    ///
    /// # Arguments
    ///
    /// * `cluster_id` - The cluster identifier
    /// * `user` - Optional authenticated user for RBAC check
    ///
    /// # Returns
    ///
    /// An Arc reference to the cluster connection or an error if not found or unauthorized
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 2.15, 2.16, 23.3, 23.4
    pub async fn get_cluster_with_auth(
        &self,
        cluster_id: &str,
        user: Option<&AuthUser>,
    ) -> Result<Arc<ClusterConnection>> {
        // Check RBAC if user is provided and RBAC is configured
        if let Some(user) = user {
            if !self.can_access_cluster(user, cluster_id) {
                anyhow::bail!(
                    "User '{}' is not authorized to access cluster '{}'",
                    user.username,
                    cluster_id
                );
            }
        }

        self.get_cluster(cluster_id).await
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
    #[instrument(skip(self, body), fields(cluster_id = %cluster_id, http_method = %method, path = %path))]
    pub async fn proxy_request(
        &self,
        cluster_id: &str,
        method: Method,
        path: &str,
        body: Option<Value>,
    ) -> Result<Response> {
        let cluster = self.get_cluster(cluster_id).await?;

        tracing::debug!("Proxying request to cluster");

        cluster
            .request(method, path, body)
            .await
            .with_context(|| format!("Failed to proxy request to cluster '{}'", cluster_id))
    }

    /// Check health of a specific cluster
    ///
    /// Returns cached health if available and not expired, otherwise fetches fresh data.
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
    /// Validates: Requirements 2.14, 2.18, 31.2
    #[instrument(skip(self), fields(cluster_id = %cluster_id))]
    pub async fn check_health(&self, cluster_id: &str) -> Result<ClusterHealth> {
        // Try to get from cache first
        if let Some(cached_health) = self.health_cache.get(cluster_id).await {
            tracing::debug!("Returning cached health");
            return Ok(cached_health);
        }

        // Cache miss - fetch fresh data
        tracing::debug!(
            "Cache miss - fetching fresh health for cluster '{}'",
            cluster_id
        );
        let cluster = self.get_cluster(cluster_id).await?;

        let health = cluster
            .check_health()
            .await
            .with_context(|| format!("Failed to check health for cluster '{}'", cluster_id))?;

        // Cache the result
        self.health_cache
            .insert(cluster_id.to_string(), health.clone())
            .await;

        Ok(health)
    }

    /// Check health of all clusters concurrently
    ///
    /// Uses join_all to run health checks in parallel, reducing latency
    /// from O(n) to approximately O(1) (limited by slowest check).
    ///
    /// # Returns
    ///
    /// A HashMap mapping cluster IDs to their health status (or error message)
    ///
    /// # Requirements
    #[instrument(skip(self))]
    pub async fn check_all_health(&self) -> HashMap<String, Result<ClusterHealth>> {
        let clusters = self.clusters.read().await;

        // Collect all health check futures for concurrent execution
        let health_futures: Vec<_> = clusters
            .iter()
            .map(|(id, cluster)| async move {
                let health = cluster.check_health().await;
                (id.clone(), health)
            })
            .collect();

        // Execute all health checks concurrently
        let results = futures::future::join_all(health_futures).await;

        // Collect results into HashMap
        results.into_iter().collect()
    }

    /// Get the number of configured clusters
    ///
    /// # Returns
    ///
    /// The number of clusters
    #[instrument(skip(self))]
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
    #[instrument(skip(self), fields(cluster_id = %cluster_id))]
    pub async fn has_cluster(&self, cluster_id: &str) -> bool {
        let clusters = self.clusters.read().await;
        clusters.contains_key(cluster_id)
    }

    /// Select a pre-created client for a user based on their roles.
    ///
    /// Iterates configured RoleClient entries in order (first-match-wins).
    /// Returns the Arc<Client> and a matched role label on success. If the
    /// cluster has no role-specific clients (legacy/unauthenticated) the
    /// legacy `client` is returned and the matched role label is "*".
    #[instrument(skip(self), fields(cluster_id = %cluster_id))]
    pub async fn get_client_for_user(
        &self,
        cluster_id: &str,
        user_roles: &[String],
    ) -> Result<(Arc<Client>, String)> {
        let clusters = self.clusters.read().await;

        let conn = clusters
            .get(cluster_id)
            .cloned()
            .ok_or_else(|| anyhow::anyhow!("Cluster '{}' not found", cluster_id))?;

        if !conn.accessible {
            anyhow::bail!("Cluster '{}' is inaccessible", cluster_id);
        }

        // If there are no role-specific clients, fall back to legacy client
        if conn.role_clients.is_empty() {
            if let Some(c) = &conn.client {
                return Ok((c.clone(), "*".to_string()));
            } else {
                anyhow::bail!("Cluster '{}' has no available client", cluster_id);
            }
        }

        // Iterate role_clients in order and pick first that matches user roles
        for rc in &conn.role_clients {
            // Exact role match first within this RoleClient entry
            for ur in user_roles {
                if rc.roles.iter().any(|r| r == ur) {
                    // Prefer returning the specific matching role if possible
                    // Label currently contains the joined roles; extract the
                    // first matching role for clarity as the matched_role value.
                    let matched_role = rc
                        .roles
                        .iter()
                        .find(|r| *r == ur)
                        .cloned()
                        .unwrap_or_else(|| rc.label.clone());
                    return Ok((rc.client.clone(), matched_role));
                }
            }

            // wildcard match
            if rc.roles.iter().any(|r| r == "*") {
                return Ok((rc.client.clone(), "*".to_string()));
            }
        }

        anyhow::bail!(
            "No matching role credential for user roles {:?} on cluster '{}'",
            user_roles,
            cluster_id
        );
    }

    /// Proxy a request to a specific cluster while emitting a structured
    /// audit entry when the request reaches Elasticsearch and a response is
    /// received. This centralises client selection, timeouts, and audit
    /// emission so handlers can remain thin.
    #[allow(clippy::too_many_arguments)]
    #[instrument(skip(self), fields(cluster_id = %cluster_id, http_method = %method, path = %path))]
    pub async fn proxy_request_with_audit(
        &self,
        cluster_id: &str,
        method: Method,
        path: &str,
        body: Option<Value>,
        user_id: Option<String>,
        user_roles: &[String],
        request_id: &str,
        audit_enabled: bool,
    ) -> std::result::Result<(StatusCode, HeaderMap, Vec<u8>, String), ProxyRequestError> {
        // Select client for this user/cluster. If no match, return an error
        // that callers should map to a local access_denied response. Do NOT
        // emit audit for local access_denied.
        let (client, matched_role_label) =
            match self.get_client_for_user(cluster_id, user_roles).await {
                Ok(pair) => pair,
                Err(_) => return Err(ProxyRequestError::AccessDenied),
            };

        // Perform the request with a 30s timeout and 10s read timeout for
        // response body (matches existing handler behaviour).
        let start = Instant::now();
        // Perform the instrumented request with a timeout. Convert tokio::time::Elapsed
        // into ProxyRequestError::ProxyTimeout via From, and attempt to downcast
        // anyhow::Error returned by the instrumented_request into more specific
        // errors (reqwest::Error, io::Error) before falling back to Other.
        let inner_res = tokio::time::timeout(
            std::time::Duration::from_secs(30),
            client
                .as_ref()
                .instrumented_request(method.clone(), path, body, cluster_id),
        )
        .await
        .map_err(Into::<ProxyRequestError>::into)?; // Elapsed -> ProxyTimeout

        // Classify any error returned by the instrumented_request into a
        // ProxyRequestError using the helper in src/cluster/error.rs.
        let resp = inner_res.map_err(|e| crate::cluster::error::classify_anyhow(&e))?;

        let status = resp.status();
        // Clone headers before consuming the response body
        let headers = resp.headers().clone();
        let bytes =
            match tokio::time::timeout(std::time::Duration::from_secs(10), resp.bytes()).await {
                Err(_) => return Err(ProxyRequestError::ResponseReadTimeout),
                Ok(inner) => inner.map_err(ProxyRequestError::from)?,
            };

        let duration_ms = start.elapsed().as_secs_f64() * 1000.0;

        // Emit audit entry for forwarded requests (only if request reached ES)
        let entry = crate::audit::AuditEntry::now(
            request_id.to_string(),
            user_id.unwrap_or_default(),
            user_roles.to_vec(),
            cluster_id.to_string(),
            matched_role_label.clone(),
            method.to_string(),
            path.to_string(),
            status.as_u16(),
            duration_ms,
        );
        crate::audit::emit_if_enabled(audit_enabled, &entry);

        Ok((status, headers, bytes.to_vec(), matched_role_label))
    }
}

#[cfg(test)]
mod manager_tests {
    use super::*;
    use crate::config::{ClusterAuth, TlsConfig};

    #[tokio::test]
    async fn test_manager_creation() {
        let configs = vec![
            ClusterConfig {
                id: "cluster1".to_string(),
                name: Some("Cluster 1".to_string()),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "cluster2".to_string(),
                name: Some("Cluster 2".to_string()),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
        ];

        let manager = Manager::new(configs, Duration::from_secs(30)).await;
        assert!(manager.is_ok());

        let mgr = manager.expect("create manager");
        assert_eq!(mgr.cluster_count().await, 2);
    }

    #[tokio::test]
    async fn test_manager_empty_clusters() {
        let configs = vec![];
        let manager = Manager::new(configs, Duration::from_secs(30)).await;
        assert!(manager.is_err());
        let err = manager.expect_err("manager creation with empty configs should fail");
        assert!(err.to_string().contains("No clusters configured"));
    }

    #[tokio::test]
    async fn test_get_cluster() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");

        let cluster = manager.get_cluster("test").await;
        assert!(cluster.is_ok());

        let conn = cluster.expect("get_cluster should succeed");
        assert_eq!(conn.id, "test");
    }

    #[tokio::test]
    async fn test_get_cluster_not_found() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");

        let cluster = manager.get_cluster("nonexistent").await;
        assert!(cluster.is_err());
        let err = cluster.expect_err("get_cluster should return error for nonexistent");
        assert!(err.to_string().contains("Cluster 'nonexistent' not found"));
    }

    #[tokio::test]
    async fn test_proxy_request_with_audit_success() {
        use serde_json::json;
        use wiremock::matchers::{method, path_regex};
        use wiremock::{Mock, MockServer, ResponseTemplate};

        // Start a mock HTTP server to simulate Elasticsearch
        let mock_server = MockServer::start().await;

        // Respond to GET /_tasks (with optional query) with a JSON body
        Mock::given(method("GET"))
            .and(path_regex(r"^/_tasks(\?.*)?$"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(json!({ "ok": true, "tasks": [] })),
            )
            .mount(&mock_server)
            .await;

        // Create cluster config pointing to the mock server
        let cfg = crate::config::ClusterConfig {
            id: "mock-cluster".to_string(),
            nodes: vec![mock_server.uri()],
            ..Default::default()
        };

        let manager = Manager::new(vec![cfg], std::time::Duration::from_secs(30))
            .await
            .expect("create manager");

        // Call proxy_request_with_audit and assert success
        let res = manager
            .proxy_request_with_audit(
                "mock-cluster",
                Method::GET,
                "/_tasks?pretty",
                None::<serde_json::Value>,
                Some("user-1".to_string()),
                &Vec::<String>::new(),
                "req-1",
                true,
            )
            .await
            .expect("proxy should succeed");

        let (status, _headers, body_vec, matched_role_label) = res;
        assert_eq!(status.as_u16(), 200);
        let v: serde_json::Value = serde_json::from_slice(&body_vec).expect("parse JSON");
        assert_eq!(v["ok"], serde_json::Value::Bool(true));
        // Legacy client path should return matched role label of "*"
        assert_eq!(matched_role_label, "*");
    }

    #[tokio::test]
    async fn test_proxy_request_with_audit_access_denied() {
        // Create cluster config with a role-specific credential (so role_clients is non-empty)
        let cfg = crate::config::ClusterConfig {
            id: "role-cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: vec![crate::config::RoleCredential {
                roles: vec!["admin".to_string()],
                auth: crate::config::ClusterAuth::Basic {
                    username: "u".to_string(),
                    password: "p".to_string(),
                },
            }],
            ..Default::default()
        };

        let manager = Manager::new(vec![cfg], std::time::Duration::from_secs(30))
            .await
            .expect("create manager");

        // No matching user roles -> AccessDenied
        let err = manager
            .proxy_request_with_audit(
                "role-cluster",
                Method::GET,
                "/_tasks?pretty",
                None::<serde_json::Value>,
                Some("user-1".to_string()),
                &Vec::<String>::new(),
                "req-2",
                false,
            )
            .await
            .expect_err("should be access denied");

        match err {
            ProxyRequestError::AccessDenied => {}
            other => panic!("unexpected error: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_get_client_for_user_ordering_and_wildcard() {
        use crate::config::{ClusterAuth, ClusterConfig, RoleCredential, TlsConfig};

        // Create a cluster config with two RoleCredential entries in order
        let cfg = ClusterConfig {
            id: "order-cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: vec![
                RoleCredential {
                    roles: vec!["admin".to_string(), "ops".to_string()],
                    auth: ClusterAuth::Basic {
                        username: "a".to_string(),
                        password: "p".to_string(),
                    },
                },
                RoleCredential {
                    roles: vec!["*".to_string()],
                    auth: ClusterAuth::Basic {
                        username: "fallback".to_string(),
                        password: "p".to_string(),
                    },
                },
            ],
            tls: TlsConfig::default(),
            ..Default::default()
        };

        let manager = Manager::new(vec![cfg], Duration::from_secs(30))
            .await
            .expect("create manager");

        // Exact role match should pick first entry
        let (_client, matched) = manager
            .get_client_for_user("order-cluster", &["admin".to_string()])
            .await
            .expect("should find client for admin");
        assert_eq!(matched, "admin");

        // Non-matching role should fall back to wildcard
        let (_client2, matched2) = manager
            .get_client_for_user("order-cluster", &["user".to_string()])
            .await
            .expect("should fall back to wildcard");
        assert_eq!(matched2, "*");
    }

    #[tokio::test]
    async fn test_get_client_for_user_multiple_role_match() {
        use crate::config::{ClusterAuth, ClusterConfig, RoleCredential, TlsConfig};

        // Test that when user has multiple roles, first matching role is returned
        let cfg = ClusterConfig {
            id: "multi-role-cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: vec![RoleCredential {
                roles: vec!["admin".to_string(), "operator".to_string()],
                auth: ClusterAuth::Basic {
                    username: "admin".to_string(),
                    password: "p".to_string(),
                },
            }],
            tls: TlsConfig::default(),
            ..Default::default()
        };

        let manager = Manager::new(vec![cfg], Duration::from_secs(30))
            .await
            .expect("create manager");

        // When user has "operator" role, it should match and return "operator"
        let (_client, matched) = manager
            .get_client_for_user("multi-role-cluster", &["operator".to_string()])
            .await
            .expect("should find client for operator");
        assert_eq!(matched, "operator");
    }

    #[tokio::test]
    async fn test_proxy_request_with_audit_no_emit_on_access_denied() {
        // This test verifies that no audit entry is emitted for local access denied
        // by checking that the audit function is not called (we can't easily capture
        // stdout in async tests, but we verify the code path returns early)
        use crate::config::{ClusterAuth, ClusterConfig, RoleCredential, TlsConfig};

        let cfg = ClusterConfig {
            id: "deny-cluster".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: vec![RoleCredential {
                roles: vec!["admin".to_string()],
                auth: ClusterAuth::Basic {
                    username: "u".to_string(),
                    password: "p".to_string(),
                },
            }],
            ..Default::default()
        };

        let manager = Manager::new(vec![cfg], Duration::from_secs(30))
            .await
            .expect("create manager");

        // Call with user that has no matching role - should return AccessDenied
        // without making any ES request, and without emitting audit
        let err = manager
            .proxy_request_with_audit(
                "deny-cluster",
                Method::GET,
                "/_tasks",
                None::<serde_json::Value>,
                Some("user-1".to_string()),
                &["guest".to_string()], // No matching role
                "req-denied",
                true, // audit_enabled = true
            )
            .await
            .expect_err("should be access denied");

        match err {
            ProxyRequestError::AccessDenied => {}
            other => panic!("unexpected error: {:?}", other),
        }
    }

    #[tokio::test]
    async fn test_list_clusters() {
        let configs = vec![
            ClusterConfig {
                id: "cluster1".to_string(),
                name: Some("Cluster 1".to_string()),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "cluster2".to_string(),
                name: Some("Cluster 2".to_string()),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
        ];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");
        let clusters = manager.list_clusters().await;

        assert_eq!(clusters.len(), 2);
        assert!(clusters.iter().any(|c| c.id == "cluster1"));
        assert!(clusters.iter().any(|c| c.id == "cluster2"));
    }

    #[tokio::test]
    async fn test_has_cluster() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");

        assert!(manager.has_cluster("test").await);
        assert!(!manager.has_cluster("nonexistent").await);
    }

    #[tokio::test]
    async fn test_cluster_count() {
        let configs = vec![
            ClusterConfig {
                id: "cluster1".to_string(),
                name: Some("Cluster 1".to_string()),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "cluster2".to_string(),
                name: Some("Cluster 2".to_string()),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
        ];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");
        assert_eq!(manager.cluster_count().await, 2);
    }

    #[tokio::test]
    async fn test_manager_with_different_auth_types() {
        let configs = vec![
            ClusterConfig {
                id: "basic".to_string(),
                name: Some("Basic Auth".to_string()),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: vec![crate::config::RoleCredential {
                    roles: vec!["*".to_string()],
                    auth: ClusterAuth::Basic {
                        username: "user".to_string(),
                        password: "pass".to_string(),
                    },
                }],
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "apikey".to_string(),
                name: Some("API Key".to_string()),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: vec![crate::config::RoleCredential {
                    roles: vec!["*".to_string()],
                    auth: ClusterAuth::ApiKey {
                        key: "key123".to_string(),
                    },
                }],
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "none".to_string(),
                name: Some("No Auth".to_string()),
                nodes: vec!["http://localhost:9202".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
        ];

        let manager = Manager::new(configs, Duration::from_secs(30)).await;
        assert!(manager.is_ok());

        let mgr = manager.expect("create manager");
        assert_eq!(mgr.cluster_count().await, 3);
    }

    #[tokio::test]
    async fn test_manager_with_rbac() {
        use crate::auth::{AuthUser, RbacManager};
        use crate::config::RoleConfig;

        let configs = vec![
            ClusterConfig {
                id: "prod-cluster-1".to_string(),
                name: Some("Production 1".to_string()),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "dev-cluster-1".to_string(),
                name: Some("Development 1".to_string()),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
        ];

        let role_configs = vec![
            RoleConfig {
                name: "prod-admin".to_string(),
                cluster_patterns: vec!["prod-*".to_string()],
            },
            RoleConfig {
                name: "dev-admin".to_string(),
                cluster_patterns: vec!["dev-*".to_string()],
            },
        ];

        let rbac = RbacManager::new(role_configs);
        let manager = Manager::new_with_rbac(configs, rbac, Duration::from_secs(30))
            .await
            .expect("create manager with rbac");

        // Test with prod-admin user
        let prod_user = AuthUser::new(
            "prod1".to_string(),
            "prodadmin".to_string(),
            vec!["prod-admin".to_string()],
        );

        assert!(manager.can_access_cluster(&prod_user, "prod-cluster-1"));
        assert!(!manager.can_access_cluster(&prod_user, "dev-cluster-1"));

        // Test with dev-admin user
        let dev_user = AuthUser::new(
            "dev1".to_string(),
            "devadmin".to_string(),
            vec!["dev-admin".to_string()],
        );

        assert!(!manager.can_access_cluster(&dev_user, "prod-cluster-1"));
        assert!(manager.can_access_cluster(&dev_user, "dev-cluster-1"));
    }

    #[tokio::test]
    async fn test_list_accessible_clusters() {
        use crate::auth::{AuthUser, RbacManager};
        use crate::config::RoleConfig;

        let configs = vec![
            ClusterConfig {
                id: "prod-cluster-1".to_string(),
                name: Some("Production 1".to_string()),
                nodes: vec!["http://localhost:9200".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "prod-cluster-2".to_string(),
                name: Some("Production 2".to_string()),
                nodes: vec!["http://localhost:9201".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
            ClusterConfig {
                id: "dev-cluster-1".to_string(),
                name: Some("Development 1".to_string()),
                nodes: vec!["http://localhost:9202".to_string()],
                auth: Vec::new(),
                tls: TlsConfig::default(),

                ..Default::default()
            },
        ];

        let role_configs = vec![RoleConfig {
            name: "prod-viewer".to_string(),
            cluster_patterns: vec!["prod-*".to_string()],
        }];

        let rbac = RbacManager::new(role_configs);
        let manager = Manager::new_with_rbac(configs, rbac, Duration::from_secs(30))
            .await
            .expect("create manager with rbac");

        let user = AuthUser::new(
            "user1".to_string(),
            "viewer".to_string(),
            vec!["prod-viewer".to_string()],
        );

        let accessible = manager.list_accessible_clusters(&user).await;
        assert_eq!(accessible.len(), 2);
        assert!(accessible.iter().any(|c| c.id == "prod-cluster-1"));
        assert!(accessible.iter().any(|c| c.id == "prod-cluster-2"));
        assert!(!accessible.iter().any(|c| c.id == "dev-cluster-1"));
    }

    #[tokio::test]
    async fn test_get_cluster_with_auth_authorized() {
        use crate::auth::{AuthUser, RbacManager};
        use crate::config::RoleConfig;

        let configs = vec![ClusterConfig {
            id: "prod-cluster-1".to_string(),
            name: Some("Production 1".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let role_configs = vec![RoleConfig {
            name: "admin".to_string(),
            cluster_patterns: vec!["*".to_string()],
        }];

        let rbac = RbacManager::new(role_configs);
        let manager = Manager::new_with_rbac(configs, rbac, Duration::from_secs(30))
            .await
            .expect("create manager with rbac");

        let user = AuthUser::new(
            "admin1".to_string(),
            "admin".to_string(),
            vec!["admin".to_string()],
        );

        let cluster = manager
            .get_cluster_with_auth("prod-cluster-1", Some(&user))
            .await;
        assert!(cluster.is_ok());
    }

    #[tokio::test]
    async fn test_get_cluster_with_auth_unauthorized() {
        use crate::auth::{AuthUser, RbacManager};
        use crate::config::RoleConfig;

        let configs = vec![ClusterConfig {
            id: "prod-cluster-1".to_string(),
            name: Some("Production 1".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let role_configs = vec![RoleConfig {
            name: "dev-viewer".to_string(),
            cluster_patterns: vec!["dev-*".to_string()],
        }];

        let rbac = RbacManager::new(role_configs);
        let manager = Manager::new_with_rbac(configs, rbac, Duration::from_secs(30))
            .await
            .expect("create manager with rbac");

        let user = AuthUser::new(
            "user1".to_string(),
            "viewer".to_string(),
            vec!["dev-viewer".to_string()],
        );

        let cluster = manager
            .get_cluster_with_auth("prod-cluster-1", Some(&user))
            .await;
        assert!(cluster.is_err());
        let err = cluster.expect_err("get_cluster_with_auth should be unauthorized for user");
        assert!(err.to_string().contains("not authorized to access"));
    }

    #[tokio::test]
    async fn test_get_cluster_with_auth_no_user() {
        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");

        // Without user, should allow access
        let cluster = manager.get_cluster_with_auth("test", None).await;
        assert!(cluster.is_ok());
    }

    #[tokio::test]
    async fn test_manager_without_rbac_allows_all() {
        use crate::auth::AuthUser;

        let configs = vec![ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: Vec::new(),
            tls: TlsConfig::default(),

            ..Default::default()
        }];

        let manager = Manager::new(configs, Duration::from_secs(30))
            .await
            .expect("create manager");

        let user = AuthUser::new(
            "user1".to_string(),
            "user".to_string(),
            vec!["unknown-role".to_string()],
        );

        // Without RBAC, should allow access to all clusters
        assert!(manager.can_access_cluster(&user, "test"));

        let accessible = manager.list_accessible_clusters(&user).await;
        assert_eq!(accessible.len(), 1);
    }
}
