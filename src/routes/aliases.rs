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
pub struct AliasInfo {
    pub alias: String,
    pub index: String,
    #[serde(default)]
    pub filter: Option<serde_json::Value>,
    #[serde(default)]
    pub routing: Option<String>,
    #[serde(default, rename = "isWriteIndex")]
    pub is_write_index: Option<bool>,
}

pub async fn list_aliases(
    ClusterClient { client, .. }: ClusterClient,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.get_aliases().await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    let mut result = Vec::new();
    if let Some(map) = response.as_object() {
        for (index, entry) in map {
            if let Some(aliases_obj) = entry.get("aliases").and_then(|v| v.as_object()) {
                for (alias_name, alias_conf) in aliases_obj {
                    let filter = alias_conf.get("filter").cloned();
                    // routing can be a string or object; prefer string
                    let routing = alias_conf
                        .get("routing")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let is_write_index = alias_conf
                        .get("is_write_index")
                        .and_then(|v| v.as_bool())
                        .or_else(|| alias_conf.get("isWriteIndex").and_then(|v| v.as_bool()));

                    result.push(AliasInfo {
                        alias: alias_name.clone(),
                        index: index.clone(),
                        filter,
                        routing,
                        is_write_index,
                    });
                }
            }
        }
    }

    Ok(Json(result))
}

pub async fn get_alias(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.get_alias(&name).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    // Reuse list parsing but only include entries where alias matches
    let mut result = Vec::new();
    if let Some(map) = response.as_object() {
        for (index, entry) in map {
            if let Some(aliases_obj) = entry.get("aliases").and_then(|v| v.as_object()) {
                if let Some(alias_conf) = aliases_obj.get(&name) {
                    let filter = alias_conf.get("filter").cloned();
                    let routing = alias_conf
                        .get("routing")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    let is_write_index = alias_conf
                        .get("is_write_index")
                        .and_then(|v| v.as_bool())
                        .or_else(|| alias_conf.get("isWriteIndex").and_then(|v| v.as_bool()));

                    result.push(AliasInfo {
                        alias: name.clone(),
                        index: index.clone(),
                        filter,
                        routing,
                        is_write_index,
                    });
                }
            }
        }
    }

    Ok(Json(result))
}

pub async fn put_alias(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
    Json(body): Json<serde_json::Value>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.put_alias(&name, body).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    Ok(Json(response))
}

pub async fn delete_alias(
    ClusterClient { client, .. }: ClusterClient,
    Path((_, name)): Path<(String, String)>,
) -> Result<impl IntoResponse, ClusterErrorResponse> {
    let response = client.delete_alias(&name).await.map_err(|e| {
        ClusterErrorResponse::simple("es_request_failed", &format!("ES request failed: {}", e))
    })?;

    Ok(Json(response))
}
