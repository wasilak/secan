//! Metrics abstraction layer supporting multiple data sources
//!
//! Provides unified interface for metrics regardless of source (internal Elasticsearch or Prometheus).
//! Metrics services implement the MetricsService trait and handle aggregation and normalization.

pub mod service;

pub use service::{
    ClusterMetrics, InternalMetricsService, MetricsService, NodeMetrics, PrometheusMetricsService,
    TimeRange,
};
