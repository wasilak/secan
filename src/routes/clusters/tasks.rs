use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

use super::ClusterState;
use crate::auth::middleware::AuthenticatedUser;
use crate::cluster::client::ElasticsearchClient;

/// Task information from Elasticsearch Tasks API
///
/// Represents a single active task in the cluster
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskInfo {
    /// Node ID where the task is running
    pub node: String,
    /// Unique task ID within the node
    pub id: i64,
    /// Task type (e.g., "transport", "management", "search")
    #[serde(rename = "type")]
    pub task_type: String,
    /// Task action (e.g., "cluster:monitor/tasks/lists", "indices:data/read/search")
    pub action: String,
    /// Start time in milliseconds since epoch
    pub start_time_in_millis: i64,
    /// Whether the task can be cancelled
    pub cancellable: bool,
    /// Whether the task is already cancelled
    pub cancelled: bool,
    /// Parent task ID if this is a subtask
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_task_id: Option<String>,
    /// Running time in milliseconds (calculated client-side if needed)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub running_time_millis: Option<i64>,
}

/// Detailed task information from Elasticsearch Tasks Get API
///
/// Includes full task details and raw JSON response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskDetails {
    #[serde(flatten)]
    pub info: TaskInfo,
    /// Raw Elasticsearch response for full details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw: Option<Value>,
}

/// Response from list tasks endpoint
#[derive(Debug, Serialize)]
pub struct TasksListResponse {
    pub tasks: Vec<TaskInfo>,
    pub unique_types: Vec<String>,
    pub unique_actions: Vec<String>,
    pub timestamp: i64,
}

/// Response from get task details endpoint
#[derive(Debug, Serialize)]
pub struct TaskDetailsResponse {
    pub task: TaskDetails,
}

/// Response from cancel task endpoint
#[derive(Debug, Serialize)]
pub struct CancelTaskResponse {
    pub success: bool,
    pub message: String,
}

/// Error response for task operations
#[derive(Debug, Serialize)]
pub struct TaskErrorResponse {
    pub error: String,
    pub message: String,
}

impl IntoResponse for TaskErrorResponse {
    fn into_response(self) -> axum::response::Response {
        (StatusCode::BAD_REQUEST, Json(self)).into_response()
    }
}

/// Query parameters for listing tasks
#[derive(Debug, Deserialize)]
pub struct TasksQueryParams {
    /// Comma-separated list of task types to filter
    #[serde(default)]
    pub type_filter: Option<String>,
    /// Comma-separated list of task actions to filter
    #[serde(default)]
    pub action_filter: Option<String>,
}

/// Transform raw Elasticsearch tasks response to TaskInfo
fn transform_tasks_response(tasks_value: &Value) -> Vec<TaskInfo> {
    let mut tasks = Vec::new();

    // Handle nested structure: nodes.{node_id}.tasks.{task_id}
    if let Some(nodes) = tasks_value.get("nodes").and_then(|v| v.as_object()) {
        for (node_id, node_data) in nodes {
            if let Some(node_obj) = node_data.as_object() {
                if let Some(node_tasks) = node_obj.get("tasks").and_then(|v| v.as_object()) {
                    for (_task_key, task_data) in node_tasks {
                        // Ensure required fields are present before deserializing
                        let mut task_with_node = task_data.clone();
                        if let Some(obj) = task_with_node.as_object_mut() {
                            // Inject node field if missing
                            if obj.get("node").is_none() {
                                obj.insert("node".to_string(), Value::String(node_id.clone()));
                            }
                            // Inject start_time_in_millis if missing (default to current time)
                            if obj.get("start_time_in_millis").is_none() {
                                let now = std::time::SystemTime::now()
                                    .duration_since(std::time::UNIX_EPOCH)
                                    .unwrap_or_default()
                                    .as_millis() as i64;
                                obj.insert("start_time_in_millis".to_string(), Value::Number(now.into()));
                            }
                        }

                        if let Ok(task_info) = serde_json::from_value::<TaskInfo>(task_with_node) {
                            tasks.push(task_info);
                        }
                    }
                }
            }
        }
    }

    tasks
}

/// Derive unique task types and actions from task list
fn derive_unique_filters(tasks: &[TaskInfo]) -> (Vec<String>, Vec<String>) {
    let mut types = HashSet::new();
    let mut actions = HashSet::new();

    for task in tasks {
        types.insert(task.task_type.clone());
        actions.insert(task.action.clone());
    }

    let mut types_vec: Vec<String> = types.into_iter().collect();
    let mut actions_vec: Vec<String> = actions.into_iter().collect();

    types_vec.sort();
    actions_vec.sort();

    (types_vec, actions_vec)
}

/// Apply filters to tasks based on query parameters
fn apply_filters(
    tasks: Vec<TaskInfo>,
    type_filter: Option<&str>,
    action_filter: Option<&str>,
) -> Vec<TaskInfo> {
    let allowed_types: Option<HashSet<&str>> = type_filter.map(|f| f.split(',').collect());
    let allowed_actions: Option<HashSet<&str>> = action_filter.map(|f| f.split(',').collect());

    tasks
        .into_iter()
        .filter(|task| {
            let type_matches = allowed_types
                .as_ref()
                .map(|types| types.contains(task.task_type.as_str()))
                .unwrap_or(true);

            let action_matches = allowed_actions
                .as_ref()
                .map(|actions| actions.contains(task.action.as_str()))
                .unwrap_or(true);

            type_matches && action_matches
        })
        .collect()
}

/// List all active tasks in a cluster
///
/// # Requirements
///
/// Validates: Requirement 1, 2, 3 (Task display with filtering)
pub async fn fetch_cluster_tasks(
    State(state): State<ClusterState>,
    Path(cluster_id): Path<String>,
    Query(params): Query<TasksQueryParams>,
    _user: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<TasksListResponse>, TaskErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        type_filter = ?params.type_filter,
        action_filter = ?params.action_filter,
        "Listing cluster tasks"
    );

    // Get cluster connection
    let cluster = state
        .cluster_manager
        .get_cluster(&cluster_id)
        .await
        .map_err(|e| TaskErrorResponse {
            error: "cluster_not_found".to_string(),
            message: format!("Failed to get cluster: {}", e),
        })?;

    // Fetch tasks from Elasticsearch via the client's request method
    let tasks_response = cluster
        .client
        .request(reqwest::Method::GET, "/_tasks?pretty", None)
        .await
        .map_err(|e| {
            tracing::warn!(error = %e, "Failed to fetch tasks");
            TaskErrorResponse {
                error: "fetch_failed".to_string(),
                message: format!("Failed to fetch tasks: {}", e),
            }
        })?;

    let text = tasks_response.text().await.map_err(|e| TaskErrorResponse {
        error: "parse_error".to_string(),
        message: format!("Failed to parse response: {}", e),
    })?;

    let tasks_json: Value = serde_json::from_str(&text).map_err(|e| TaskErrorResponse {
        error: "json_error".to_string(),
        message: format!("Failed to parse JSON: {}", e),
    })?;

    // Transform response
    let tasks = transform_tasks_response(&tasks_json);

    // Derive unique filters before applying
    let (unique_types, unique_actions) = derive_unique_filters(&tasks);

    // Apply filters
    let filtered_tasks = apply_filters(
        tasks,
        params.type_filter.as_deref(),
        params.action_filter.as_deref(),
    );

    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    Ok(Json(TasksListResponse {
        tasks: filtered_tasks,
        unique_types,
        unique_actions,
        timestamp,
    }))
}

/// Get detailed information about a specific task
///
/// # Requirements
///
/// Validates: Requirement 4 (Task details modal)
pub async fn get_task_details(
    State(state): State<ClusterState>,
    Path((cluster_id, task_id)): Path<(String, String)>,
    _user: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<TaskDetailsResponse>, TaskErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        task_id = %task_id,
        "Fetching task details"
    );

    // Get cluster connection
    let cluster = state
        .cluster_manager
        .get_cluster(&cluster_id)
        .await
        .map_err(|e| TaskErrorResponse {
            error: "cluster_not_found".to_string(),
            message: format!("Failed to get cluster: {}", e),
        })?;

    // Fetch task details from Elasticsearch via the client's request method
    let task_response = cluster
        .client
        .request(
            reqwest::Method::GET,
            &format!("/_tasks/{}?pretty", task_id),
            None,
        )
        .await
        .map_err(|e| {
            tracing::warn!(error = %e, "Failed to fetch task details");
            TaskErrorResponse {
                error: "fetch_failed".to_string(),
                message: format!("Failed to fetch task details: {}", e),
            }
        })?;

    let text = task_response.text().await.map_err(|e| TaskErrorResponse {
        error: "parse_error".to_string(),
        message: format!("Failed to parse response: {}", e),
    })?;

    let task_json: Value = serde_json::from_str(&text).map_err(|e| TaskErrorResponse {
        error: "json_error".to_string(),
        message: format!("Failed to parse JSON: {}", e),
    })?;

    // Extract task info and create TaskDetails
    let mut task_value = task_json.get("task").cloned().unwrap_or(task_json.clone());

    // Ensure node, id, type, and action fields are present before deserializing
    // task_id format: "node_id:task_number"
    if let Some(colon_pos) = task_id.find(':') {
        let node_id = &task_id[..colon_pos];
        let task_id_str = &task_id[colon_pos + 1..];

        if let Some(obj) = task_value.as_object_mut() {
            // Add node field if missing
            if !obj.contains_key("node") {
                obj.insert("node".to_string(), Value::String(node_id.to_string()));
            }

            // Add id field if missing
            if !obj.contains_key("id") {
                // Try to parse as integer
                if let Ok(id_num) = task_id_str.parse::<i64>() {
                    obj.insert("id".to_string(), Value::Number(id_num.into()));
                }
            }

            // Add type field if missing (default to "unknown")
            if !obj.contains_key("type") {
                obj.insert("type".to_string(), Value::String("unknown".to_string()));
            }

            // Add action field if missing (default to "unknown")
            if !obj.contains_key("action") {
                obj.insert("action".to_string(), Value::String("unknown".to_string()));
            }
        }
    }

    let task_info = serde_json::from_value::<TaskInfo>(task_value.clone()).map_err(|e| {
        tracing::warn!(error = %e, "Failed to deserialize task");
        TaskErrorResponse {
            error: "deserialize_error".to_string(),
            message: format!("Failed to deserialize task: {}", e),
        }
    })?;

    let task_details = TaskDetails {
        info: task_info,
        raw: Some(task_value),
    };

    Ok(Json(TaskDetailsResponse { task: task_details }))
}

/// Cancel a specific task
///
/// # Requirements
///
/// Validates: Requirement 5 (Cancel task action)
pub async fn cancel_cluster_task(
    State(state): State<ClusterState>,
    Path((cluster_id, task_id)): Path<(String, String)>,
    _user: Option<axum::Extension<AuthenticatedUser>>,
) -> Result<Json<CancelTaskResponse>, TaskErrorResponse> {
    tracing::debug!(
        cluster_id = %cluster_id,
        task_id = %task_id,
        "Cancelling task"
    );

    // Get cluster connection
    let cluster = state
        .cluster_manager
        .get_cluster(&cluster_id)
        .await
        .map_err(|e| TaskErrorResponse {
            error: "cluster_not_found".to_string(),
            message: format!("Failed to get cluster: {}", e),
        })?;

    // Cancel task via Elasticsearch API using client's request method
    let response = cluster
        .client
        .request(
            reqwest::Method::POST,
            &format!("/_tasks/{}/_cancel", task_id),
            None,
        )
        .await
        .map_err(|e| {
            tracing::warn!(error = %e, "Failed to cancel task");
            TaskErrorResponse {
                error: "cancel_failed".to_string(),
                message: format!("Failed to cancel task: {}", e),
            }
        })?;

    let status = response.status();
    let text = response.text().await.map_err(|e| TaskErrorResponse {
        error: "parse_error".to_string(),
        message: format!("Failed to parse response: {}", e),
    })?;

    if status.is_success() {
        tracing::info!(task_id = %task_id, "Task cancelled successfully");
        Ok(Json(CancelTaskResponse {
            success: true,
            message: format!("Task {} cancelled successfully", task_id),
        }))
    } else {
        let error_msg = if let Ok(json) = serde_json::from_str::<Value>(&text) {
            json.get("error")
                .and_then(|e| e.get("reason"))
                .and_then(|r| r.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown error".to_string())
        } else {
            text.clone()
        };

        tracing::warn!(
            task_id = %task_id,
            status = %status,
            error = %error_msg,
            "Failed to cancel task"
        );

        Err(TaskErrorResponse {
            error: "cancel_error".to_string(),
            message: format!("Failed to cancel task: {}", error_msg),
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_unique_filters() {
        let tasks = vec![
            TaskInfo {
                node: "node1".to_string(),
                id: 1,
                task_type: "transport".to_string(),
                action: "cluster:monitor/tasks/lists".to_string(),
                start_time_in_millis: 1000,
                cancellable: false,
                cancelled: false,
                parent_task_id: None,
                running_time_millis: Some(100),
            },
            TaskInfo {
                node: "node2".to_string(),
                id: 2,
                task_type: "search".to_string(),
                action: "indices:data/read/search".to_string(),
                start_time_in_millis: 2000,
                cancellable: true,
                cancelled: false,
                parent_task_id: None,
                running_time_millis: Some(200),
            },
            TaskInfo {
                node: "node1".to_string(),
                id: 3,
                task_type: "transport".to_string(),
                action: "cluster:monitor/tasks/lists".to_string(),
                start_time_in_millis: 3000,
                cancellable: false,
                cancelled: false,
                parent_task_id: None,
                running_time_millis: Some(300),
            },
        ];

        let (types, actions) = derive_unique_filters(&tasks);

        assert_eq!(types.len(), 2);
        assert!(types.contains(&"transport".to_string()));
        assert!(types.contains(&"search".to_string()));

        assert_eq!(actions.len(), 2);
        assert!(actions.contains(&"cluster:monitor/tasks/lists".to_string()));
        assert!(actions.contains(&"indices:data/read/search".to_string()));
    }

    #[test]
    fn test_transform_nested_tasks() {
        let json_str = r#"{
            "nodes": {
                "nodeA": {
                    "name": "es01",
                    "tasks": {
                        "nodeA:1": {
                            "node": "nodeA",
                            "id": 1,
                            "type": "transport",
                            "action": "cluster:monitor/tasks/lists",
                            "start_time_in_millis": 1000,
                            "cancellable": true,
                            "cancelled": false
                        }
                    }
                },
                "nodeB": {
                    "name": "es02",
                    "tasks": {
                        "nodeB:2": {
                            "node": "nodeB",
                            "id": 2,
                            "type": "search",
                            "action": "indices:data/read/search",
                            "start_time_in_millis": 2000,
                            "cancellable": true,
                            "cancelled": false
                        }
                    }
                }
            }
        }"#;

        let tasks_json: Value = serde_json::from_str(json_str).unwrap();
        let tasks = transform_tasks_response(&tasks_json);

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].id, 1);
        assert_eq!(tasks[0].node, "nodeA");
        assert_eq!(tasks[1].id, 2);
        assert_eq!(tasks[1].node, "nodeB");
    }

    #[test]
    fn test_transform_tasks_without_node_field() {
        let json_str = r#"{
            "nodes": {
                "nodeA": {
                    "name": "es01",
                    "tasks": {
                        "nodeA:1": {
                            "id": 1,
                            "type": "transport",
                            "action": "cluster:monitor/tasks/lists",
                            "start_time_in_millis": 1000,
                            "cancellable": true,
                            "cancelled": false
                        }
                    }
                },
                "nodeB": {
                    "name": "es02",
                    "tasks": {
                        "nodeB:2": {
                            "id": 2,
                            "type": "search",
                            "action": "indices:data/read/search",
                            "start_time_in_millis": 2000,
                            "cancellable": true,
                            "cancelled": false
                        }
                    }
                }
            }
        }"#;

        let tasks_json: Value = serde_json::from_str(json_str).unwrap();
        let tasks = transform_tasks_response(&tasks_json);

        assert_eq!(tasks.len(), 2);
        assert_eq!(tasks[0].id, 1);
        assert_eq!(tasks[0].node, "nodeA");
        assert_eq!(tasks[1].id, 2);
        assert_eq!(tasks[1].node, "nodeB");
    }

    #[test]
    fn test_get_task_details_missing_fields() {
        // Simulates extracting node, id, type, and action from task_id when not in response
        let task_id = "nodeA:123456";
        let json_str = r#"{
            "cancellable": true,
            "cancelled": false,
            "start_time_in_millis": 1000
        }"#;

        let mut task_value: Value = serde_json::from_str(json_str).unwrap();

        // Simulate the field injection logic
        if let Some(colon_pos) = task_id.find(':') {
            let node_id = &task_id[..colon_pos];
            let task_id_str = &task_id[colon_pos + 1..];

            if let Some(obj) = task_value.as_object_mut() {
                if !obj.contains_key("node") {
                    obj.insert("node".to_string(), Value::String(node_id.to_string()));
                }
                if !obj.contains_key("id") {
                    if let Ok(id_num) = task_id_str.parse::<i64>() {
                        obj.insert("id".to_string(), Value::Number(id_num.into()));
                    }
                }
                if !obj.contains_key("type") {
                    obj.insert("type".to_string(), Value::String("unknown".to_string()));
                }
                if !obj.contains_key("action") {
                    obj.insert("action".to_string(), Value::String("unknown".to_string()));
                }
            }
        }

        // Should now deserialize successfully
        let task_info: TaskInfo = serde_json::from_value(task_value).unwrap();
        assert_eq!(task_info.node, "nodeA");
        assert_eq!(task_info.id, 123456);
        assert_eq!(task_info.action, "unknown");
        assert_eq!(task_info.task_type, "unknown");
    }

    #[test]
    fn test_transform_tasks_without_start_time() {
        let json_str = r#"{
            "nodes": {
                "nodeA": {
                    "name": "es01",
                    "tasks": {
                        "nodeA:1": {
                            "id": 1,
                            "type": "transport",
                            "action": "cluster:monitor/tasks/lists",
                            "cancellable": true,
                            "cancelled": false
                        }
                    }
                }
            }
        }"#;

        let tasks_json: Value = serde_json::from_str(json_str).unwrap();
        let tasks = transform_tasks_response(&tasks_json);

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].id, 1);
        assert_eq!(tasks[0].node, "nodeA");
        // start_time_in_millis should be injected with current time
        assert!(tasks[0].start_time_in_millis > 0);
    }

    #[test]
    fn test_apply_filters() {
        let tasks = vec![
            TaskInfo {
                node: "node1".to_string(),
                id: 1,
                task_type: "transport".to_string(),
                action: "cluster:monitor/tasks/lists".to_string(),
                start_time_in_millis: 1000,
                cancellable: false,
                cancelled: false,
                parent_task_id: None,
                running_time_millis: Some(100),
            },
            TaskInfo {
                node: "node2".to_string(),
                id: 2,
                task_type: "search".to_string(),
                action: "indices:data/read/search".to_string(),
                start_time_in_millis: 2000,
                cancellable: true,
                cancelled: false,
                parent_task_id: None,
                running_time_millis: Some(200),
            },
        ];

        // Test type filter only
        let filtered = apply_filters(tasks.clone(), Some("transport"), None);
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, 1);

        // Test action filter only
        let filtered = apply_filters(tasks.clone(), None, Some("indices:data/read/search"));
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, 2);

        // Test both filters
        let filtered = apply_filters(
            tasks.clone(),
            Some("transport"),
            Some("cluster:monitor/tasks/lists"),
        );
        assert_eq!(filtered.len(), 1);
        assert_eq!(filtered[0].id, 1);

        // Test no match
        let filtered = apply_filters(tasks, Some("nonexistent"), None);
        assert_eq!(filtered.len(), 0);
    }
}
