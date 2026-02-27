//! Prometheus metrics client and integration
//!
//! Provides functionality to query Prometheus instances for time-series metrics data.
//! Used as an alternative metrics source for cluster monitoring alongside internal Elasticsearch metrics.

pub mod client;

pub use client::{Client as PrometheusClient, InstantValue, RangeValue, TimeSeriesData};
