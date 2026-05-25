use axum::{
    extract::Path,
    response::IntoResponse,
    routing::{get, post},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::cluster::client::ElasticsearchClient;
use crate::routes::cluster_client::ClusterClient;
use crate::routes::clusters::ClusterErrorResponse;
use crate::routes::ClusterState;

pub fn router(state: ClusterState) -> axum::Router {
    axum::Router::new()
        .route(
            "/api/clusters/:cluster_id/index-templates",
            get(list_templates),
        )
        .route(
            "/api/clusters/:cluster_id/index-templates/:name",
            get(get_template).put(put_template).delete(delete_template),
        )
        .route(
            "/api/clusters/:cluster_id/index-templates/_simulate",
            post(simulate_template),
        )
        .with_state(state)
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexTemplateResponse {
    pub index_templates: Vec<IndexTemplateSummary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexTemplateSummary {
    pub name: String,
    #[serde(default)]
    pub index_patterns: Option<Vec<String>>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub version: Option<i32>,
    #[serde(default)]
    pub composed_of: Option<Vec<String>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct IndexTemplateDetail {
    pub name: String,
    #[serde(default)]
    pub index_patterns: Option<Vec<String>>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub version: Option<i32>,
    #[serde(default)]
    pub composed_of: Option<Vec<String>>,
    #[serde(default)]
    pub template: Option<serde_json::Value>,
    #[serde(default)]
    pub _meta: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct PutIndexTemplateRequest {
    #[serde(default)]
    pub index_patterns: Option<Vec<String>>,
    #[serde(default)]
    pub priority: Option<i32>,
    #[serde(default)]
    pub version: Option<i32>,
    #[serde(default)]
    pub composed_of: Option<Vec<String>>,
    #[serde(default)]
    pub template: Option<serde_json::Value>,
    #[serde(default)]
    pub _meta: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct SimulateRequest {
    #[serde(default)]
    pub index_patterns: Option<Vec<String>>,
    #[serde(default)]
    pub template: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
pub struct SimulateResponse {
    pub template: serde_json::Value,
    #[serde(default)]
    pub overlapping: Option<Vec<OverlappingTemplate>>,
}

#[derive(Debug, Serialize)]
pub struct OverlappingTemplate {
    pub name: String,
    pub index_patterns: Vec<String>,
}

pub async fn list_templates(
    ClusterClient { client, .. }: ClusterClient,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.get_index_templates().await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    let mut templates = Vec::new();
    if let Some(index_templates) = response.get("index_templates").and_then(|v| v.as_array()) {
        for tmpl in index_templates {
            let name = tmpl
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let index_patterns = tmpl
                .get("index_patterns")
                .and_then(|v| serde_json::from_value(v.clone()).ok());
            let priority = tmpl
                .get("priority")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);
            let version = tmpl
                .get("version")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);
            let composed_of = tmpl
                .get("composed_of")
                .and_then(|v| serde_json::from_value(v.clone()).ok());

            templates.push(IndexTemplateSummary {
                name,
                index_patterns,
                priority,
                version,
                composed_of,
            });
        }
    }

    Ok(Json(IndexTemplateResponse {
        index_templates: templates,
    }))
}

pub async fn get_template(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.get_index_template(&name).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    let detail = serde_json::from_value::<IndexTemplateDetail>(response).map_err(|e| {
        ClusterErrorResponse::simple(
            "parse_error",
            &format!("Failed to parse template response: {}", e),
        )
    })?;

    Ok(Json(detail))
}

pub async fn put_template(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
    Json(body): Json<PutIndexTemplateRequest>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let mut request_body = serde_json::Map::new();
    if let Some(patterns) = body.index_patterns {
        request_body.insert("index_patterns".to_string(), serde_json::json!(patterns));
    }
    if let Some(priority) = body.priority {
        request_body.insert("priority".to_string(), serde_json::json!(priority));
    }
    if let Some(version) = body.version {
        request_body.insert("version".to_string(), serde_json::json!(version));
    }
    if let Some(composed) = body.composed_of {
        request_body.insert("composed_of".to_string(), serde_json::json!(composed));
    }
    if let Some(template) = body.template {
        request_body.insert("template".to_string(), template);
    }
    if let Some(meta) = body._meta {
        request_body.insert("_meta".to_string(), meta);
    }

    let response = client
        .put_index_template(&name, serde_json::Value::Object(request_body))
        .await
        .map_err(|e| {
            ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
        })?;

    let detail = serde_json::from_value::<IndexTemplateDetail>(response).map_err(|e| {
        ClusterErrorResponse::simple("parse_error", &format!("Failed to parse response: {}", e))
    })?;

    Ok(Json(detail))
}

pub async fn delete_template(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.delete_index_template(&name).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    Ok(Json(response))
}

pub async fn simulate_template(
    ClusterClient { client, .. }: ClusterClient,
    Json(body): Json<SimulateRequest>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let mut request_body = serde_json::Map::new();
    if let Some(patterns) = body.index_patterns {
        request_body.insert("index_patterns".to_string(), serde_json::json!(patterns));
    }
    if let Some(template) = body.template {
        request_body.insert("template".to_string(), template);
    }

    let response = client
        .simulate_index_template(serde_json::Value::Object(request_body))
        .await
        .map_err(|e| {
            ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
        })?;

    let template = response
        .get("template")
        .cloned()
        .unwrap_or(serde_json::json!({}));

    let overlapping =
        if let Some(overlap_arr) = response.get("overlapping").and_then(|v| v.as_array()) {
            let mut overlap_templates = Vec::new();
            for item in overlap_arr {
                let name = item
                    .get("name")
                    .and_then(|v| v.as_str())
                    .unwrap_or_default()
                    .to_string();
                let patterns = item
                    .get("index_patterns")
                    .and_then(|v| serde_json::from_value(v.clone()).ok())
                    .unwrap_or_default();
                overlap_templates.push(OverlappingTemplate {
                    name,
                    index_patterns: patterns,
                });
            }
            Some(overlap_templates)
        } else {
            None
        };

    Ok(Json(SimulateResponse {
        template,
        overlapping,
    }))
}
