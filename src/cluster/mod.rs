pub mod client;
pub mod error;
pub mod manager;

pub use client::{Client, ElasticsearchClient};
pub use error::ProxyRequestError;
pub use manager::{ClusterConnection, ClusterHealth, ClusterInfo, HealthStatus, Manager};
