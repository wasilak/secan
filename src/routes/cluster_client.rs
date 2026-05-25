use axum::{
    extract::{FromRequestParts, Path},
    http::request::Parts,
};
use std::sync::Arc;

use crate::cluster::Client;
use crate::routes::{ClusterErrorResponse, ClusterState};

/// Axum extractor that resolves a cluster ID from the path and returns the
/// associated Elasticsearch client. Eliminates the 5-line get_cluster +
/// client-extract boilerplate that appeared in every cluster route handler.
pub struct ClusterClient {
    pub client: Arc<Client>,
    pub cluster_id: String,
}

impl FromRequestParts<ClusterState> for ClusterClient {
    type Rejection = ClusterErrorResponse;

    async fn from_request_parts(
        parts: &mut Parts,
        state: &ClusterState,
    ) -> Result<Self, Self::Rejection> {
        let Path(cluster_id) = Path::<String>::from_request_parts(parts, state)
            .await
            .map_err(|_| {
                ClusterErrorResponse::simple("invalid_path", "Missing or invalid cluster ID")
            })?;

        let cluster = state
            .cluster_manager
            .get_cluster(&cluster_id)
            .await
            .map_err(|e| {
                ClusterErrorResponse::simple(
                    "cluster_not_found",
                    &format!("Cluster not found: {}", e),
                )
            })?;

        let client = cluster
            .client
            .clone()
            .ok_or_else(|| ClusterErrorResponse::unavailable(&cluster_id, None))?;

        Ok(ClusterClient { client, cluster_id })
    }
}
