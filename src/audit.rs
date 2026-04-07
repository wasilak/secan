use chrono::Utc;
use serde::Serialize;
use tracing::error;

/// Structured audit entry for proxied Elasticsearch calls
#[derive(Debug, Serialize)]
pub struct AuditEntry {
    /// Fixed kind to identify audit lines
    pub kind: &'static str,
    pub timestamp: String,
    pub request_id: String,
    pub user_id: String,
    pub user_roles: Vec<String>,
    pub cluster_id: String,
    pub matched_role: String,
    pub es_method: String,
    pub es_path: String,
    pub status_code: u16,
    pub duration_ms: f64,
}

/// Emit an audit entry to stdout if enabled. Serialization errors are logged
/// to tracing but do not interrupt normal request handling.
pub fn emit_if_enabled(enabled: bool, entry: &AuditEntry) {
    if !enabled {
        return;
    }

    match serde_json::to_string(entry) {
        Ok(s) => {
            // One-line JSON to stdout
            println!("{}", s);
        }
        Err(e) => {
            error!(error = %e, "Failed to serialize audit entry");
        }
    }
}

impl AuditEntry {
    // Allow more arguments for this constructor since audit entries are explicit
    // structured records and the lint is noisy for small data carriers.
    #[allow(clippy::too_many_arguments)]
    pub fn now<S1, S2>(
        request_id: S1,
        user_id: S2,
        user_roles: Vec<String>,
        cluster_id: String,
        matched_role: String,
        es_method: String,
        es_path: String,
        status_code: u16,
        duration_ms: f64,
    ) -> Self
    where
        S1: Into<String>,
        S2: Into<String>,
    {
        AuditEntry {
            kind: "audit",
            timestamp: Utc::now().to_rfc3339(),
            request_id: request_id.into(),
            user_id: user_id.into(),
            user_roles,
            cluster_id,
            matched_role,
            es_method,
            es_path,
            status_code,
            duration_ms,
        }
    }
}
