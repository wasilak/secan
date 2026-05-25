use axum::{
    extract::Path,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::cluster::client::ElasticsearchClient;
use crate::routes::cluster_client::ClusterClient;
use crate::routes::clusters::ClusterErrorResponse;

#[derive(Debug, Serialize, Deserialize)]
pub struct ComponentTemplatesResponse {
    pub component_templates: Vec<ComponentTemplateSummary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComponentTemplateSummary {
    pub name: String,
    #[serde(default)]
    pub version: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ComponentTemplateDetail {
    pub name: String,
    #[serde(default)]
    pub template: Option<serde_json::Value>,
    #[serde(default)]
    pub version: Option<i32>,
    #[serde(default)]
    pub _meta: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct PutComponentTemplateRequest {
    #[serde(default)]
    pub template: Option<serde_json::Value>,
    #[serde(default)]
    pub version: Option<i32>,
    #[serde(default)]
    pub _meta: Option<serde_json::Value>,
}

pub async fn list_component_templates(
    ClusterClient { client, .. }: ClusterClient,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.get_component_templates().await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", format!("ES request failed: {}", e))
    })?;

    let mut templates = Vec::new();
    if let Some(components) = response
        .get("component_templates")
        .and_then(|v| v.as_array())
    {
        for comp in components {
            let name = comp
                .get("name")
                .and_then(|v| v.as_str())
                .unwrap_or_default()
                .to_string();
            let version = comp
                .get("version")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);

            templates.push(ComponentTemplateSummary { name, version });
        }
    }

    Ok(Json(ComponentTemplatesResponse {
        component_templates: templates,
    }))
}

pub async fn get_component_template(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.get_component_template(&name).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", format!("ES request failed: {}", e))
    })?;

    let detail = serde_json::from_value::<ComponentTemplateDetail>(response).map_err(|e| {
        ClusterErrorResponse::simple(
            "parse_error",
            format!("Failed to parse component template response: {}", e),
        )
    })?;

    Ok(Json(detail))
}

pub async fn put_component_template(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
    Json(body): Json<PutComponentTemplateRequest>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let mut request_body = serde_json::Map::new();
    if let Some(template) = body.template {
        request_body.insert("template".to_string(), template);
    }
    if let Some(version) = body.version {
        request_body.insert("version".to_string(), serde_json::json!(version));
    }
    if let Some(meta) = body._meta {
        request_body.insert("_meta".to_string(), meta);
    }

    let response = client
        .put_component_template(&name, serde_json::Value::Object(request_body))
        .await
        .map_err(|e| {
            ClusterErrorResponse::simple("es_request_failed", format!("ES request failed: {}", e))
        })?;

    let detail = serde_json::from_value::<ComponentTemplateDetail>(response).map_err(|e| {
        ClusterErrorResponse::simple("parse_error", format!("Failed to parse response: {}", e))
    })?;

    Ok(Json(detail))
}

pub async fn delete_component_template(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.delete_component_template(&name).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", format!("ES request failed: {}", e))
    })?;

    Ok(Json(response))
}
