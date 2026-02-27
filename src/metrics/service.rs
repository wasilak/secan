use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use anyhow::Result;
use tracing::{debug, warn};

use crate::cluster::client::ElasticsearchClient;
use crate::cluster::manager::{ClusterConnection, HealthStatus};
use crate::prometheus::client::Client as PrometheusClient;
use crate::prometheus::client::PrometheusConfig;

/// Time range for metrics queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeRange {
    /// Start timestamp (Unix seconds)
    pub start: i64,
    /// End timestamp (Unix seconds)
    pub end: i64,
}

impl TimeRange {
    /// Create a new time range
    pub fn new(start: i64, end: i64) -> Result<Self> {
        anyhow::ensure!(start < end, "start must be before end");
        Ok(Self { start, end })
    }

    /// Time range for last N seconds
    pub fn last_seconds(seconds: i64) -> Self {
        let now = current_unix_timestamp();
        Self {
            start: now - seconds,
            end: now,
        }
    }

    /// Time range for last 1 hour
    pub fn last_hour() -> Self {
        Self::last_seconds(3600)
    }

    /// Time range for last 6 hours
    pub fn last_6_hours() -> Self {
        Self::last_seconds(6 * 3600)
    }

    /// Time range for last 24 hours
    pub fn last_24_hours() -> Self {
        Self::last_seconds(24 * 3600)
    }

    /// Time range for last 7 days
    pub fn last_7_days() -> Self {
        Self::last_seconds(7 * 24 * 3600)
    }

    /// Time range for last 30 days
    pub fn last_30_days() -> Self {
        Self::last_seconds(30 * 24 * 3600)
    }

    /// Duration of the time range
    pub fn duration(&self) -> i64 {
        self.end - self.start
    }

    /// Recommended step/interval for this time range
    /// Returns step in seconds (one data point per step interval)
    pub fn recommended_step(&self) -> i64 {
        let duration = self.duration();
        // Target ~1000 data points for smooth charts
        let step = duration / 1000;
        std::cmp::max(step, 10) // Minimum 10 seconds
    }
}

/// Cluster metrics aggregated from various sources
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct ClusterMetrics {
    /// Cluster identifier
    pub cluster_id: String,
    /// Time range of the metrics
    #[serde(skip_serializing_if = "Option::is_none")]
    pub time_range: Option<TimeRange>,
    /// JVM memory usage in bytes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jvm_memory_used_bytes: Option<Vec<MetricPoint>>,
    /// JVM memory max in bytes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jvm_memory_max_bytes: Option<Vec<MetricPoint>>,
    /// Garbage collection time in milliseconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gc_collection_time_ms: Option<Vec<MetricPoint>>,
    /// Index rate (docs per second)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_rate: Option<Vec<MetricPoint>>,
    /// Query rate (queries per second)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub query_rate: Option<Vec<MetricPoint>>,
    /// Disk usage in bytes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_used_bytes: Option<Vec<MetricPoint>>,
    /// CPU usage percentage
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_usage_percent: Option<Vec<MetricPoint>>,
    /// Network bytes in
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_bytes_in: Option<Vec<MetricPoint>>,
    /// Network bytes out
    #[serde(skip_serializing_if = "Option::is_none")]
    pub network_bytes_out: Option<Vec<MetricPoint>>,
    /// Health status (from internal metrics)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub health_status: Option<HealthStatus>,
    /// Number of nodes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub node_count: Option<u32>,
    /// Number of shards
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shard_count: Option<u32>,
    /// Number of indices
    #[serde(skip_serializing_if = "Option::is_none")]
    pub index_count: Option<u32>,
}

/// Single metric data point with timestamp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricPoint {
    /// Timestamp in Unix seconds
    pub timestamp: i64,
    /// Metric value
    pub value: f64,
}

impl MetricPoint {
    /// Create a new metric point
    pub fn new(timestamp: i64, value: f64) -> Self {
        Self { timestamp, value }
    }
}

/// Node metrics
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NodeMetrics {
    /// Node identifier
    pub node_id: String,
    /// Node name
    pub node_name: String,
    /// JVM memory used
    #[serde(skip_serializing_if = "Option::is_none")]
    pub jvm_memory_used_bytes: Option<f64>,
    /// CPU usage percentage
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_usage_percent: Option<f64>,
    /// Disk usage in bytes
    #[serde(skip_serializing_if = "Option::is_none")]
    pub disk_used_bytes: Option<f64>,
    /// Number of shards on this node
    #[serde(skip_serializing_if = "Option::is_none")]
    pub shard_count: Option<u32>,
}

/// Metrics service trait
/// Provides unified interface for metrics regardless of source
#[async_trait]
pub trait MetricsService: Send + Sync {
    /// Get cluster metrics for a time range
    async fn get_cluster_metrics(
        &self,
        cluster_id: &str,
        time_range: TimeRange,
    ) -> Result<ClusterMetrics>;

    /// Get node metrics for a cluster
    async fn get_node_metrics(
        &self,
        cluster_id: &str,
    ) -> Result<Vec<NodeMetrics>>;

    /// Get current cluster health (instant snapshot)
    async fn get_health(&self, cluster_id: &str) -> Result<Option<HealthStatus>>;

    /// Check if metrics source is available
    async fn health_check(&self) -> Result<bool>;
}

/// Internal metrics service using Elasticsearch live data
pub struct InternalMetricsService {
    cluster_connection: Arc<ClusterConnection>,
}

impl InternalMetricsService {
    /// Create new internal metrics service
    pub fn new(cluster_connection: Arc<ClusterConnection>) -> Self {
        Self {
            cluster_connection,
        }
    }
}

#[async_trait]
impl MetricsService for InternalMetricsService {
    async fn get_cluster_metrics(
        &self,
        _cluster_id: &str,
        _time_range: TimeRange,
    ) -> Result<ClusterMetrics> {
        // For internal metrics, we fetch current live data
        // Historical data is not available, so we return instant snapshot
        let client = &self.cluster_connection.client;

        let mut metrics = ClusterMetrics {
            cluster_id: self.cluster_connection.id.clone(),
            time_range: None,
            health_status: None,
            node_count: None,
            shard_count: None,
            index_count: None,
            ..Default::default()
        };

        // Get cluster health
        if let Ok(health) = client.health().await {
            if let Ok(health_struct) = serde_json::from_value::<crate::cluster::manager::ClusterHealth>(health) {
                metrics.node_count = Some(health_struct.number_of_nodes);
                metrics.shard_count = Some(health_struct.active_shards);
                metrics.health_status = Some(health_struct.status);
            }
        }

        // Get node count from cluster state
        if let Ok(state) = client.cluster_state().await {
            if let Some(nodes) = state.get("nodes") {
                if let Some(node_map) = nodes.as_object() {
                    metrics.node_count = Some(node_map.len() as u32);
                }
            }
        }

        // Get index count from indices stats
        if let Ok(indices) = client.indices_stats().await {
            if let Some(indices_obj) = indices.get("indices") {
                if let Some(indices_map) = indices_obj.as_object() {
                    // Subtract "_all" if present
                    let count = indices_map.len() as u32;
                    metrics.index_count = Some(if count > 0 { count - 1 } else { 0 });
                }
            }
        }

        debug!(
            "Internal metrics for cluster {}: {} nodes, {} shards, {} indices",
            self.cluster_connection.id,
            metrics.node_count.unwrap_or(0),
            metrics.shard_count.unwrap_or(0),
            metrics.index_count.unwrap_or(0)
        );

        Ok(metrics)
    }

    async fn get_node_metrics(&self, _cluster_id: &str) -> Result<Vec<NodeMetrics>> {
        let client = &self.cluster_connection.client;

        let mut node_metrics = Vec::new();

        // Get nodes info and stats
        if let Ok(nodes_info) = client.nodes_info().await {
            if let Ok(nodes_stats) = client.nodes_stats().await {
                if let Some(nodes) = nodes_info.get("nodes").and_then(|n| n.as_object()) {
                    for (node_id, node_info) in nodes {
                        let node_name = node_info
                            .get("name")
                            .and_then(|n| n.as_str())
                            .unwrap_or(node_id)
                            .to_string();

                        let mut metrics = NodeMetrics {
                            node_id: node_id.clone(),
                            node_name,
                            ..Default::default()
                        };

                        // Try to get metrics from nodes stats
                        if let Some(stats_nodes) = nodes_stats.get("nodes").and_then(|n| n.as_object()) {
                            if let Some(node_stats) = stats_nodes.get(node_id) {
                                // Extract JVM memory
                                if let Some(jvm) = node_stats.get("jvm").and_then(|j| j.get("mem")) {
                                    if let Some(used) = jvm.get("heap_used_in_bytes").and_then(|u| u.as_i64()) {
                                        metrics.jvm_memory_used_bytes = Some(used as f64);
                                    }
                                }

                                // Extract CPU
                                if let Some(cpu) = node_stats.get("os").and_then(|o| o.get("cpu")) {
                                    if let Some(percent) = cpu.get("percent").and_then(|p| p.as_i64()) {
                                        metrics.cpu_usage_percent = Some(percent as f64);
                                    }
                                }

                                // Extract disk
                                if let Some(fs) = node_stats.get("fs").and_then(|f| f.get("total")) {
                                    if let Some(used) = fs.get("bytes_used").and_then(|u| u.as_i64()) {
                                        metrics.disk_used_bytes = Some(used as f64);
                                    }
                                }
                            }
                        }

                        node_metrics.push(metrics);
                    }
                }
            }
        }

        Ok(node_metrics)
    }

    async fn get_health(&self, _cluster_id: &str) -> Result<Option<HealthStatus>> {
        let client = &self.cluster_connection.client;
        match client.health().await {
            Ok(health) => {
                if let Ok(health_struct) = serde_json::from_value::<crate::cluster::manager::ClusterHealth>(health) {
                    Ok(Some(health_struct.status))
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                warn!("Failed to get cluster health: {}", e);
                Ok(None)
            }
        }
    }

    async fn health_check(&self) -> Result<bool> {
        match self.cluster_connection.client.health().await {
            Ok(_) => Ok(true),
            Err(_) => Ok(false),
        }
    }
}

/// Prometheus metrics service
pub struct PrometheusMetricsService {
    client: PrometheusClient,
    cluster_id: String,
    job_name: Option<String>,
    labels: Option<HashMap<String, String>>,
}

impl PrometheusMetricsService {
    /// Create new Prometheus metrics service
    pub fn new(
        prometheus_url: &str,
        cluster_id: String,
        job_name: Option<String>,
        labels: Option<HashMap<String, String>>,
    ) -> Result<Self> {
        let config = PrometheusConfig {
            url: prometheus_url.to_string(),
            auth: None,
            timeout: Duration::from_secs(10),
        };

        let client = PrometheusClient::new(config)?;

        Ok(Self {
            client,
            cluster_id,
            job_name,
            labels,
        })
    }

    /// Build a query for Elasticsearch exporter metrics
    fn build_query(&self, metric_name: &str) -> String {
        PrometheusClient::build_query(metric_name, self.job_name.as_deref(), self.labels.as_ref())
    }

    /// Query a metric over a time range and extract values
    async fn query_metric_range(
        &self,
        metric_name: &str,
        time_range: &TimeRange,
    ) -> Result<Vec<MetricPoint>> {
        let query = self.build_query(metric_name);
        let step = time_range.recommended_step();

        match self
            .client
            .query_range(&query, time_range.start, time_range.end, step)
            .await
        {
            Ok(results) => {
                let mut points = Vec::new();

                for result in results {
                    if let Some(values) = result.values {
                        for value in values {
                            if let Ok(parsed_value) = PrometheusClient::parse_value(&value.1) {
                                points.push(MetricPoint::new(value.0, parsed_value));
                            }
                        }
                    }
                }

                debug!(
                    "Prometheus query {} returned {} data points",
                    metric_name,
                    points.len()
                );

                Ok(points)
            }
            Err(e) => {
                warn!("Prometheus query for {} failed: {}", metric_name, e);
                Ok(Vec::new()) // Return empty instead of failing entire request
            }
        }
    }
}

#[async_trait]
impl MetricsService for PrometheusMetricsService {
    async fn get_cluster_metrics(
        &self,
        _cluster_id: &str,
        time_range: TimeRange,
    ) -> Result<ClusterMetrics> {
        let mut metrics = ClusterMetrics {
            cluster_id: self.cluster_id.clone(),
            time_range: Some(time_range.clone()),
            ..Default::default()
        };

        // Query each metric in parallel
        metrics.jvm_memory_used_bytes =
            Some(self.query_metric_range("elasticsearch_jvm_memory_used_bytes", &time_range).await?);

        metrics.jvm_memory_max_bytes =
            Some(self.query_metric_range("elasticsearch_jvm_memory_max_bytes", &time_range).await?);

        metrics.gc_collection_time_ms =
            Some(self.query_metric_range("elasticsearch_jvm_gc_collection_time_millis", &time_range).await?);

        metrics.index_rate =
            Some(self.query_metric_range("elasticsearch_indices_indexing_index_total", &time_range).await?);

        metrics.query_rate =
            Some(self.query_metric_range("elasticsearch_indices_search_query_total", &time_range).await?);

        metrics.disk_used_bytes =
            Some(self.query_metric_range("elasticsearch_filesystem_data_size_bytes", &time_range).await?);

        metrics.cpu_usage_percent =
            Some(self.query_metric_range("elasticsearch_process_cpu_percent", &time_range).await?);

        metrics.network_bytes_in =
            Some(self.query_metric_range("elasticsearch_transport_rx_bytes", &time_range).await?);

        metrics.network_bytes_out =
            Some(self.query_metric_range("elasticsearch_transport_tx_bytes", &time_range).await?);

        debug!(
            "Prometheus metrics for cluster {}: {} time points",
            self.cluster_id,
            metrics
                .jvm_memory_used_bytes
                .as_ref()
                .map(|v| v.len())
                .unwrap_or(0)
        );

        Ok(metrics)
    }

    async fn get_node_metrics(&self, _cluster_id: &str) -> Result<Vec<NodeMetrics>> {
        // For simplicity, return empty for now
        // Could be extended to query per-node metrics
        Ok(Vec::new())
    }

    async fn get_health(&self, _cluster_id: &str) -> Result<Option<HealthStatus>> {
        // Query Prometheus for cluster status metric
        let query = self.build_query("elasticsearch_cluster_health_status");
        match self.client.query_instant(&query, None).await {
            Ok(_results) => {
                // Could parse the status value if available
                Ok(None)
            }
            Err(e) => {
                warn!("Prometheus health check failed: {}", e);
                Ok(None)
            }
        }
    }

    async fn health_check(&self) -> Result<bool> {
        self.client.health().await
    }
}

/// Get current Unix timestamp in seconds
fn current_unix_timestamp() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_time_range_construction() {
        let tr = TimeRange::new(100, 200).unwrap();
        assert_eq!(tr.start, 100);
        assert_eq!(tr.end, 200);
        assert_eq!(tr.duration(), 100);
    }

    #[test]
    fn test_time_range_invalid() {
        assert!(TimeRange::new(200, 100).is_err());
    }

    #[test]
    fn test_recommended_step() {
        let tr = TimeRange::new(0, 100000).unwrap();
        let step = tr.recommended_step();
        assert!(step > 0);
        assert!(step <= 100000 / 1000);
    }

    #[test]
    fn test_metric_point_creation() {
        let point = MetricPoint::new(1000, 42.5);
        assert_eq!(point.timestamp, 1000);
        assert_eq!(point.value, 42.5);
    }
}
