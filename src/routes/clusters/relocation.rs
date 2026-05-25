use super::{ClusterErrorResponse, ClusterState};
use crate::auth::middleware::AuthenticatedUser;
use crate::cluster::{manager::ProxyAuditRequest, ProxyRequestError};
use crate::middleware::logging::RequestId;
use axum::{
    extract::{Path, State},
    http::Method,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::instrument;
use utoipa::ToSchema;

/// Request body for shard relocation
///
/// # Requirements
///
/// Validates: Requirements 6.1, 6.2
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct RelocateShardRequest {
    /// Index name
    #[schema(example = "my-index")]
    pub index: String,
    /// Shard number
    #[schema(example = 0)]
    pub shard: u32,
    /// Source node ID
    #[schema(example = "node-1")]
    pub from_node: String,
    /// Destination node ID
    #[schema(example = "node-2")]
    pub to_node: String,
}

/// Relocate a shard from one node to another
///
/// Executes the Elasticsearch cluster reroute API to move a shard
///
/// # Requirements
///
/// Validates: Requirements 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11, 8.1, 8.2, 8.3, 8.4
#[utoipa::path(
    post,
    path = "/clusters/{cluster_id}/relocate",
    params(("cluster_id" = String, Path, description = "Cluster ID")),
    request_body = RelocateShardRequest,
    responses(
        (status = 200, description = "Shard relocation initiated"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[instrument(skip(state, user_ext, req), fields(cluster_id = %cluster_id, index = %req.index, shard = req.shard))]
pub async fn relocate_shard(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
    request_id_ext: Option<axum::Extension<RequestId>>,
    Json(req): Json<RelocateShardRequest>,
) -> Result<Json<Value>, ClusterErrorResponse> {
    tracing::info!(
        cluster_id = %cluster_id,
        index = %req.index,
        shard = req.shard,
        from_node = %req.from_node,
        to_node = %req.to_node,
        "Shard relocation requested"
    );

    // Check cluster access

    // Extract authenticated user (if authentication is enabled)
    // In Open mode, the middleware provides a default user
    let user = user_ext.map(|ext| ext.0 .0).ok_or_else(|| {
        tracing::error!("Authentication required but user not found in request");
        ClusterErrorResponse::simple(
            "authentication_required",
            "Authentication is required for this operation",
        )
    })?;

    tracing::debug!(
        user_id = %user.id,
        username = %user.username,
        roles = ?user.roles,
        "User authenticated for shard relocation"
    );

    // Validate request parameters
    validate_relocation_request(&req)?;

    // Get the cluster (ensure it exists)
    let _cluster = state
        .cluster_manager
        .get_cluster(&cluster_id)
        .await
        .map_err(|e| {
            tracing::error!(
                cluster_id = %cluster_id,
                error = %e,
                "Cluster not found"
            );
            ClusterErrorResponse::simple(
                "cluster_not_found",
                format!("Cluster '{}' not found. Please verify the cluster ID and ensure the cluster is configured.", cluster_id),
            )
        })?;

    // Build the reroute command
    let reroute_command = serde_json::json!({
        "commands": [{
            "move": {
                "index": req.index,
                "shard": req.shard,
                "from_node": req.from_node,
                "to_node": req.to_node
            }
        }]
    });

    tracing::debug!(
        cluster_id = %cluster_id,
        command = ?reroute_command,
        "Executing cluster reroute"
    );

    // Determine RequestId string for audit (use empty string if missing)
    let request_id = request_id_ext
        .as_ref()
        .map(|r| r.0.as_str().to_string())
        .unwrap_or_default();

    // Use centralized proxy helper which performs client selection, timeouts,
    // response read timeout, and emits an audit entry when the request
    // actually reaches Elasticsearch.
    let (status, _headers, body_vec, _matched_role) = match state
        .cluster_manager
        .proxy_request_with_audit(ProxyAuditRequest {
            cluster_id: cluster_id.clone(),
            method: Method::POST,
            path: "/_cluster/reroute".to_string(),
            body: Some(reroute_command.clone()),
            user_id: Some(user.id.clone()),
            user_roles: user.roles.clone(),
            request_id: request_id.clone(),
            audit_enabled: state.audit_log,
        })
        .await
    {
        Ok(r) => r,
        Err(e) => {
            match e {
                ProxyRequestError::AccessDenied => {
                    tracing::warn!(error = %"access_denied", cluster_id = %cluster_id, "Access denied: no matching role client");
                    return Err(ClusterErrorResponse::simple(
                        "access_denied",
                        "You do not have permissions to perform this operation on the requested cluster",
                    ));
                }
                ProxyRequestError::ProxyTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "RELOCATE: request timed out");
                    return Err(ClusterErrorResponse::simple(
                        "proxy_timeout",
                        "Elasticsearch request timed out: POST /_cluster/reroute (timeout: 30s)"
                            .to_string(),
                    ));
                }
                ProxyRequestError::RequestFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "RELOCATE: request failed");
                    let message = if reason.contains("timeout") || reason.contains("timed out") {
                        "Shard relocation request timed out. The cluster may be slow or unreachable. Please check cluster health and try again.".to_string()
                    } else if reason.contains("connection") || reason.contains("connect") {
                        "Cannot connect to cluster. Please verify the cluster is running and accessible.".to_string()
                    } else if reason.contains("unauthorized") || reason.contains("401") {
                        "Authentication failed. Please check your cluster credentials.".to_string()
                    } else if reason.contains("forbidden") || reason.contains("403") {
                        "Permission denied. You may not have the required permissions to relocate shards.".to_string()
                    } else {
                        format!("Failed to relocate shard: {}. Please check cluster logs for more details.", reason)
                    };
                    return Err(ClusterErrorResponse::simple("relocation_failed", message));
                }
                ProxyRequestError::ResponseReadTimeout => {
                    tracing::error!(cluster_id = %cluster_id, "Timeout reading reroute response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_timeout",
                        "Timeout reading Elasticsearch response body",
                    ));
                }
                ProxyRequestError::ResponseReadFailed(reason) => {
                    tracing::error!(cluster_id = %cluster_id, error = %reason, "Failed to read reroute response body");
                    return Err(ClusterErrorResponse::simple(
                        "response_read_failed",
                        format!("Failed to read response: {}", reason),
                    ));
                }
                ProxyRequestError::Other(reason) => {
                    tracing::warn!(error = %reason, "RELOCATE: Unexpected error");
                    return Err(ClusterErrorResponse::simple(
                        "relocation_failed",
                        format!("Failed to relocate shard: {}", reason),
                    ));
                }
            }
        }
    };

    // Parse response body
    let body: Value = serde_json::from_slice(&body_vec).map_err(|e| {
        tracing::error!(
            cluster_id = %cluster_id,
            error = %e,
            "Failed to parse reroute response"
        );
        ClusterErrorResponse::simple(
            "response_parse_failed",
            format!("Failed to parse response: {}", e),
        )
    })?;

    // Check if the request was successful
    if !status.is_success() {
        let error_msg = body
            .get("error")
            .and_then(|e| e.get("reason"))
            .and_then(|r| r.as_str())
            .unwrap_or("Unknown error");

        tracing::error!(
            cluster_id = %cluster_id,
            index = %req.index,
            shard = req.shard,
            status = status.as_u16(),
            error = %error_msg,
            "Elasticsearch rejected shard relocation"
        );

        let user_message = if error_msg.contains("no such shard")
            || error_msg.contains("shard not found")
        {
            format!("Shard {} of index '{}' not found. The shard may have been deleted or the index may not exist.", req.shard, req.index)
        } else if error_msg.contains("node not found") || error_msg.contains("unknown node") {
            format!(
                "Node '{}' or '{}' not found. One of the nodes may have left the cluster.",
                req.from_node, req.to_node
            )
        } else if error_msg.contains("already relocating") {
            format!("Shard {} of index '{}' is already being relocated. Please wait for the current relocation to complete.", req.shard, req.index)
        } else if error_msg.contains("same node") {
            "Cannot relocate shard to the same node. Please select a different destination node."
                .to_string()
        } else if error_msg.contains("allocation") {
            format!(
                "Shard allocation failed: {}. Check cluster allocation settings and node capacity.",
                error_msg
            )
        } else {
            format!(
                "Elasticsearch rejected the relocation: {}. Check cluster logs for more details.",
                error_msg
            )
        };

        return Err(ClusterErrorResponse::simple(
            "elasticsearch_error",
            user_message,
        ));
    }

    tracing::info!(
        cluster_id = %cluster_id,
        index = %req.index,
        shard = req.shard,
        from_node = %req.from_node,
        to_node = %req.to_node,
        user_id = %user.id,
        username = %user.username,
        "Shard relocation initiated successfully"
    );

    Ok(Json(body))
}

/// Validate shard relocation request parameters
///
/// # Requirements
///
/// Validates: Requirements 6.3, 6.4, 8.1, 8.2, 8.3, 8.4
fn validate_relocation_request(req: &RelocateShardRequest) -> Result<(), ClusterErrorResponse> {
    if req.index.is_empty() {
        tracing::warn!("Validation failed: index name is empty");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Index name is required. Please provide a valid index name.",
        ));
    }

    if req.index.chars().any(|c| c.is_uppercase()) {
        tracing::warn!(index = %req.index, "Validation failed: index name contains uppercase characters");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            format!(
                "Index name '{}' contains uppercase characters. Elasticsearch index names must be lowercase.",
                req.index
            ),
        ));
    }

    let invalid_chars = ['\\', '/', '*', '?', '"', '<', '>', '|', ' ', ',', '#'];
    if let Some(invalid_char) = req.index.chars().find(|c| invalid_chars.contains(c)) {
        tracing::warn!(index = %req.index, "Validation failed: index name contains invalid characters");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            format!(
                "Index name '{}' contains invalid character '{}'. Index names cannot contain: \\ / * ? \" < > | space , #",
                req.index, invalid_char
            ),
        ));
    }

    if req.from_node.is_empty() {
        tracing::warn!("Validation failed: from_node is empty");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Source node ID is required. Please select a source node.",
        ));
    }

    if req.to_node.is_empty() {
        tracing::warn!("Validation failed: to_node is empty");
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            "Destination node ID is required. Please select a destination node.",
        ));
    }

    if req.from_node == req.to_node {
        tracing::warn!(
            from_node = %req.from_node,
            to_node = %req.to_node,
            "Validation failed: source and destination nodes are the same"
        );
        return Err(ClusterErrorResponse::simple(
            "validation_failed",
            format!(
                "Source and destination nodes must be different (both are {}). Please select a different destination node.",
                req.from_node
            ),
        ));
    }

    tracing::debug!(
        index = %req.index,
        shard = req.shard,
        from_node = %req.from_node,
        to_node = %req.to_node,
        "Request validation passed"
    );

    Ok(())
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;

    #[test]
    fn test_relocate_shard_request_serialization() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };

        let json = serde_json::to_string(&req).expect("serialize RelocateShardRequest to JSON");
        assert!(json.contains("\"index\":\"test-index\""));
        assert!(json.contains("\"shard\":0"));
        assert!(json.contains("\"from_node\":\"node-1\""));
        assert!(json.contains("\"to_node\":\"node-2\""));
    }

    #[test]
    fn test_relocate_shard_request_deserialization() {
        let json = r#"{"index":"logs-2024","shard":1,"from_node":"node-a","to_node":"node-b"}"#;
        let req: RelocateShardRequest =
            serde_json::from_str(json).expect("deserialize RelocateShardRequest from JSON");

        assert_eq!(req.index, "logs-2024");
        assert_eq!(req.shard, 1);
        assert_eq!(req.from_node, "node-a");
        assert_eq!(req.to_node, "node-b");
    }

    #[test]
    fn test_validate_relocation_request_valid() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };
        assert!(validate_relocation_request(&req).is_ok());
    }

    #[test]
    fn test_validate_relocation_request_empty_index() {
        let req = RelocateShardRequest {
            index: "".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };
        let err = validate_relocation_request(&req)
            .expect_err("relocation request validation should fail for empty index");
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("Index name is required"));
    }

    #[test]
    fn test_validate_relocation_request_uppercase_index() {
        let req = RelocateShardRequest {
            index: "Test-Index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-2".to_string(),
        };
        let err = validate_relocation_request(&req)
            .expect_err("relocation request validation should fail for uppercase index");
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("lowercase"));
    }

    #[test]
    fn test_validate_relocation_request_invalid_chars() {
        let invalid_indices = vec![
            "test index",  // space
            "test/index",  // slash
            "test\\index", // backslash
            "test*index",  // asterisk
            "test?index",  // question mark
            "test\"index", // quote
            "test<index",  // less than
            "test>index",  // greater than
            "test|index",  // pipe
            "test,index",  // comma
            "test#index",  // hash
        ];

        for index in invalid_indices {
            let req = RelocateShardRequest {
                index: index.to_string(),
                shard: 0,
                from_node: "node-1".to_string(),
                to_node: "node-2".to_string(),
            };
            assert!(
                validate_relocation_request(&req).is_err(),
                "Expected validation to fail for index: {}",
                index
            );
        }
    }

    #[test]
    fn test_validate_relocation_request_empty_from_node() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "".to_string(),
            to_node: "node-2".to_string(),
        };
        let err = validate_relocation_request(&req)
            .expect_err("relocation request validation should fail for empty from_node");
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("Source node ID is required"));
    }

    #[test]
    fn test_validate_relocation_request_empty_to_node() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "".to_string(),
        };
        let err = validate_relocation_request(&req)
            .expect_err("relocation request validation should fail for empty to_node");
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("Destination node ID is required"));
    }

    #[test]
    fn test_validate_relocation_request_same_nodes() {
        let req = RelocateShardRequest {
            index: "test-index".to_string(),
            shard: 0,
            from_node: "node-1".to_string(),
            to_node: "node-1".to_string(),
        };
        let err = validate_relocation_request(&req).expect_err(
            "relocation request validation should fail when from/to nodes are the same",
        );
        assert_eq!(err.error, "validation_failed");
        assert!(err.message.contains("must be different"));
    }

    #[test]
    fn test_validate_relocation_request_valid_index_names() {
        let valid_indices = vec![
            "test-index",
            "logs-2024.01.01",
            "my_index",
            "index123",
            "a",
            "test.index.name",
        ];

        for index in valid_indices {
            let req = RelocateShardRequest {
                index: index.to_string(),
                shard: 0,
                from_node: "node-1".to_string(),
                to_node: "node-2".to_string(),
            };
            assert!(
                validate_relocation_request(&req).is_ok(),
                "Expected validation to pass for index: {}",
                index
            );
        }
    }
}
