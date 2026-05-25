use super::{ClusterErrorResponse, ClusterState};
use crate::auth::middleware::AuthenticatedUser;
use crate::cluster::{manager::ProxyAuditRequest, ProxyRequestError};
use crate::middleware::logging::RequestId;
use axum::{
    extract::{Path, State},
    http::Method,
    response::{IntoResponse, Response},
    Json,
};
use tracing::instrument;

/// Proxy request to Elasticsearch cluster
///
/// Forwards the request to the specified cluster and returns the response
///
/// # Requirements
///
/// Validates: Requirements 2.16, 29.3
#[utoipa::path(
    get,
    path = "/clusters/{cluster_id}/proxy/{path}",
    params(
        ("cluster_id" = String, Path, description = "Cluster ID"),
        ("path" = String, Path, description = "Elasticsearch API path")
    ),
    responses(
        (status = 200, description = "Elasticsearch response"),
        (status = 400, body = ClusterErrorResponse),
        (status = 401, body = ClusterErrorResponse),
        (status = 404, body = ClusterErrorResponse)
    ),
    tag = "Clusters"
)]
#[axum::debug_handler]
#[instrument(skip(state, query, body), fields(cluster_id = %cluster_id, http_method = %method))]
pub async fn proxy_request(
    State(state): State<ClusterState>,
    Path((cluster_id, path)): Path<(String, String)>,
    method: Method,
    axum::extract::RawQuery(query): axum::extract::RawQuery,
    user_ext: Option<axum::Extension<AuthenticatedUser>>,
    request_id_ext: Option<axum::Extension<RequestId>>,
    body: Option<Json<serde_json::Value>>,
) -> Result<Response, ClusterErrorResponse> {
    // Construct full path with query string if present
    // Ensure path starts with / for Elasticsearch API
    let normalized_path = if path.starts_with('/') {
        path.clone()
    } else {
        format!("/{}", path)
    };

    let full_path = if let Some(q) = query {
        format!("{}?{}", normalized_path, q)
    } else {
        normalized_path
    };

    tracing::debug!(
        cluster_id = %cluster_id,
        method = %method,
        path = %full_path,
        "PROXY: Starting Elasticsearch request"
    );

    // Enforce RBAC: verify the authenticated user has access to this cluster.
    // In Open mode (no user extension) all access is allowed.

    // Use centralized proxy helper which performs client selection, timeouts,
    // response body read timeout, and emits an audit entry when the request
    // is actually forwarded to Elasticsearch. The helper returns status,
    // headers and body so we can construct the Axum response here.
    let user_roles: Vec<String> = user_ext
        .as_ref()
        .map(|u| u.0 .0.roles.clone())
        .unwrap_or_default();

    let request_id = request_id_ext
        .as_ref()
        .map(|r| r.0.as_str().to_string())
        .unwrap_or_default();

    let (status, headers, body_bytes, _matched_role_label) = match state
        .cluster_manager
        .proxy_request_with_audit(ProxyAuditRequest {
            cluster_id: cluster_id.clone(),
            method: method.clone(),
            path: full_path.clone(),
            body: body.map(|j| j.0),
            user_id: user_ext.as_ref().map(|u| u.0 .0.id.clone()),
            user_roles: user_roles.clone(),
            request_id: request_id.clone(),
            audit_enabled: state.audit_log,
        })
        .await
    {
        Ok(r) => r,
        Err(e) => match e {
            ProxyRequestError::AccessDenied => {
                tracing::warn!(error = %"access_denied", cluster_id = %cluster_id, "Access denied: no matching role client");
                return Err(ClusterErrorResponse::simple(
                    "access_denied",
                    format!("Access denied to cluster: {}", cluster_id),
                ));
            }
            ProxyRequestError::ProxyTimeout => {
                tracing::error!(cluster_id = %cluster_id, "PROXY: request timed out");
                return Err(ClusterErrorResponse::simple(
                    "proxy_timeout",
                    format!(
                        "Elasticsearch request timed out: {} {} (timeout: 30s)",
                        method, full_path
                    ),
                ));
            }
            ProxyRequestError::ResponseReadTimeout => {
                tracing::error!(cluster_id = %cluster_id, "PROXY: response read timed out");
                return Err(ClusterErrorResponse::simple(
                    "response_read_timeout",
                    "Elasticsearch response read timed out (timeout: 10s)".to_string(),
                ));
            }
            ProxyRequestError::RequestFailed(reason) => {
                tracing::error!(cluster_id = %cluster_id, error = %reason, "PROXY: request failed");
                return Err(ClusterErrorResponse::simple(
                    "proxy_failed",
                    format!("Elasticsearch request failed: {}", reason),
                ));
            }
            ProxyRequestError::ResponseReadFailed(reason) => {
                tracing::error!(cluster_id = %cluster_id, error = %reason, "PROXY: response read failed");
                return Err(ClusterErrorResponse::simple(
                    "response_read_failed",
                    format!("Elasticsearch response read failed: {}", reason),
                ));
            }
            ProxyRequestError::Other(msg) => {
                tracing::error!(cluster_id = %cluster_id, error = %msg, "PROXY: unexpected error");
                return Err(ClusterErrorResponse::simple("proxy_error", msg));
            }
        },
    };

    // Build an Axum Response, forwarding the Elasticsearch status + body.
    // We deliberately forward the raw body bytes so that any Elasticsearch
    // response format (JSON, YAML, plain text) is preserved intact.
    let mut axum_response = (status, body_bytes).into_response();

    // Forward a subset of response headers that are safe/useful for the client.
    // We do NOT blindly forward all headers to avoid leaking internal details.
    let resp_headers = axum_response.headers_mut();
    for (name, value) in &headers {
        use axum::http::header;
        // Forward content-type, content-encoding, x-elastic-* headers
        if name == header::CONTENT_TYPE
            || name == header::CONTENT_ENCODING
            || name.as_str().starts_with("x-elastic-")
        {
            resp_headers.insert(name.clone(), value.clone());
        }
    }

    Ok(axum_response)
}
