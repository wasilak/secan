//! OpenAPI specification generator
//!
//! This module generates the OpenAPI 3.0 specification from utoipa annotations.

use utoipa::OpenApi;

#[derive(OpenApi)]
#[openapi(
    // Paths/tags
    paths(
        // Health routes
        crate::routes::health::health_check,
        crate::routes::health::readiness_check,
        crate::routes::health::get_version,
        // Auth routes
        crate::routes::auth::oidc_login,
        crate::routes::auth::oidc_callback,
        crate::routes::auth::login,
        crate::routes::auth::get_current_user,
        crate::routes::auth::logout,
        crate::routes::auth::get_auth_status,
        // Cluster routes
        crate::routes::clusters::list_clusters,
        crate::routes::clusters::get_cluster_stats,
        // Topology tiles
        crate::routes::topology::post_tiles,
        crate::routes::clusters::get_cluster_settings,
        crate::routes::clusters::update_cluster_settings,
        crate::routes::clusters::get_nodes,
        crate::routes::clusters::get_node_stats,
        crate::routes::clusters::get_indices,
        crate::routes::clusters::get_shard_stats,
        crate::routes::clusters::get_shards,
        crate::routes::clusters::get_node_shards,
        crate::routes::clusters::proxy_request,
        crate::routes::clusters::relocate_shard,
        // Task routes
        crate::routes::clusters::tasks::fetch_cluster_tasks,
        crate::routes::clusters::tasks::get_task_details,
        crate::routes::clusters::tasks::cancel_cluster_task,
        // Metrics routes
        crate::routes::metrics::get_cluster_metrics,
        crate::routes::metrics::get_node_metrics,
        crate::routes::metrics::get_cluster_metrics_history,
        crate::routes::metrics::validate_prometheus_endpoint,
    ),
    // Components/schemas
    components(
        schemas(
            // Auth types
            crate::routes::auth::LoginRequest,
            crate::routes::auth::LoginResponse,
            crate::routes::auth::ErrorResponse,
            crate::routes::auth::UserInfoResponse,
            crate::routes::auth::OidcCallbackQuery,
            crate::routes::auth::OidcLoginQuery,
            crate::routes::auth::AuthStatusResponse,
            // Cluster types
            crate::routes::clusters::ClustersQueryParams,
            crate::routes::clusters::ClusterSettingsUpdateRequest,
            crate::routes::clusters::NodesQueryParams,
            crate::routes::clusters::IndicesQueryParams,
            crate::routes::clusters::ShardsQueryParams,
            crate::routes::clusters::transform::ClusterStatsResponse,
            crate::routes::clusters::transform::NodeInfoResponse,
            crate::routes::clusters::transform::IndexInfoResponse,
            crate::routes::clusters::transform::ShardInfoResponse,
            crate::routes::clusters::transform::NodeDetailStatsResponse,
            // Topology tile types
            crate::routes::topology::generator::TilePayload,
            crate::routes::topology::generator::TileNodeMeta,
            crate::routes::topology::TileBatchResponse,
            crate::routes::topology::TileBatchRequest,
            crate::routes::topology::TileRequestEntry,
            // Task types
            crate::routes::clusters::tasks::TaskInfo,
            crate::routes::clusters::tasks::TasksListResponse,
            crate::routes::clusters::tasks::TaskDetailsResponse,
            crate::routes::clusters::tasks::CancelTaskResponse,
            crate::routes::clusters::tasks::TaskErrorResponse,
            crate::routes::clusters::tasks::TasksQueryParams,
            // Metrics types
            crate::routes::metrics::MetricsQuery,
            crate::routes::metrics::ClusterMetricsHistoryResponse,
            crate::routes::metrics::MetricsErrorResponse,
            crate::routes::metrics::PrometheusValidationRequest,
            crate::routes::metrics::PrometheusValidationResponse,
            // Health types
            crate::routes::health::HealthResponse,
            crate::routes::health::ReadinessResponse,
            crate::routes::health::VersionResponse,
        )
    ),
    // Tags
    tags(
        (name = "Health", description = "Health check and readiness endpoints"),
        (name = "Authentication", description = "Authentication and session management"),
        (name = "Clusters", description = "Elasticsearch cluster management"),
        (name = "Tasks", description = "Cluster task management"),
        (name = "Metrics", description = "Cluster metrics and monitoring"),
    )
)]
pub struct ApiDoc;

pub fn generate_openapi_json() -> Result<String, serde_json::Error> {
    ApiDoc::openapi().to_json()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_openapi_spec_generates() {
        let json = ApiDoc::openapi().to_json().expect("generate openapi json");
        assert!(json.contains("\"openapi\":\"3.1.0\""));
        assert!(json.contains("\"/health\""));
        assert!(json.contains("\"/clusters\""));

        // Write to file for easy access
        std::fs::write("openapi.json", &json).expect("write openapi.json");
        println!(
            "OpenAPI spec written to openapi.json ({} bytes)",
            json.len()
        );
    }
}
