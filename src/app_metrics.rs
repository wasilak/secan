//! Application metrics module
//!
//! Provides application-level metrics for Prometheus scraping.
//! This module provides the infrastructure - the actual metric recording
//! should be done at the call sites.

use metrics_exporter_prometheus::PrometheusBuilder;
use std::net::SocketAddr;

/// Initialize the Prometheus metrics exporter
/// This should be called once at application startup
pub fn init_metrics() -> Result<(), Box<dyn std::error::Error>> {
    let addr: SocketAddr = "0.0.0.0:9090".parse()?;
    let builder = PrometheusBuilder::new().with_http_listener(addr);

    builder.install()?;

    Ok(())
}

/// HTTP request metrics
pub mod http {
    /// Record an HTTP request with method, path, status code, and duration
    pub fn record_request(method: &str, _path: &str, status: u16, duration_ms: f64) {
        metrics::counter!("http.requests.total", "method" => method.to_string(), "status" => status.to_string()).increment(1);
        metrics::histogram!("http.request.duration_ms", "method" => method.to_string()).record(duration_ms);
    }
}

/// Authentication metrics
pub mod auth {
    /// Record successful authentication
    pub fn record_success(method: &str) {
        metrics::counter!("auth.success.total", "method" => method.to_string()).increment(1);
    }

    /// Record failed authentication
    pub fn record_failure(method: &str, reason: &str) {
        metrics::counter!("auth.failure.total", "method" => method.to_string(), "reason" => reason.to_string()).increment(1);
    }

    /// Record logout
    pub fn record_logout() {
        metrics::counter!("auth.logout.total").increment(1);
    }
}

/// Cluster metrics
pub mod cluster {
    /// Record cluster count by health status
    pub fn set_cluster_health(health: &str, count: i64) {
        metrics::gauge!("cluster.health.count", "health" => health.to_string()).set(count as f64);
    }

    /// Record total cluster count
    pub fn set_total_clusters(count: i64) {
        metrics::gauge!("cluster.total").set(count as f64);
    }

    /// Record cluster request latency
    pub fn record_request_latency(cluster_id: &str, latency_ms: f64) {
        metrics::histogram!("cluster.request.latency_ms", "cluster_id" => cluster_id.to_string()).record(latency_ms);
    }
}

/// Cache metrics
pub mod cache {
    /// Record cache hit
    pub fn record_hit(cache_name: &str) {
        metrics::counter!("cache.hits.total", "cache" => cache_name.to_string()).increment(1);
    }

    /// Record cache miss
    pub fn record_miss(cache_name: &str) {
        metrics::counter!("cache.misses.total", "cache" => cache_name.to_string()).increment(1);
    }
}

/// Active connections gauge
pub mod connections {
    /// Set active connection count
    pub fn set_active(count: i64) {
        metrics::gauge!("connections.active").set(count as f64);
    }

    /// Increment active connections
    pub fn increment() {
        metrics::gauge!("connections.active").increment(1.0);
    }

    /// Decrement active connections
    pub fn decrement() {
        metrics::gauge!("connections.active").decrement(1.0);
    }
}

/// Runtime metrics
pub mod runtime {
    /// Update memory usage gauges
    pub fn update_memory(used_bytes: u64, max_bytes: u64) {
        metrics::gauge!("runtime.memory.used_bytes").set(used_bytes as f64);
        metrics::gauge!("runtime.memory.max_bytes").set(max_bytes as f64);
    }

    /// Update thread count
    pub fn set_threads(count: i64) {
        metrics::gauge!("runtime.threads").set(count as f64);
    }
}
