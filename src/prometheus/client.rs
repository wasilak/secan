use anyhow::{anyhow, Context, Result};
use reqwest::{Client as HttpClient, Url};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, warn};

/// Configuration for Prometheus client
#[derive(Debug, Clone)]
pub struct PrometheusConfig {
    /// Prometheus endpoint URL (e.g., "http://prometheus.internal:9090")
    pub url: String,
    /// Optional basic authentication (username:password)
    pub auth: Option<(String, String)>,
    /// Request timeout duration
    pub timeout: Duration,
}

impl Default for PrometheusConfig {
    fn default() -> Self {
        Self {
            url: "http://localhost:9090".to_string(),
            auth: None,
            timeout: Duration::from_secs(10),
        }
    }
}

/// Prometheus time series value: [timestamp_unix_seconds, "value_as_string"]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RangeValue(pub i64, pub String);

/// Prometheus instant value: [timestamp_unix_seconds, "value_as_string"]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstantValue(pub i64, pub String);

/// Time series data returned from Prometheus
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimeSeriesData {
    /// Metric labels as key-value pairs
    pub metric: HashMap<String, String>,
    /// Time-stamped values for range queries
    #[serde(skip_serializing_if = "Option::is_none")]
    pub values: Option<Vec<RangeValue>>,
    /// Single instant value for instant queries
    #[serde(skip_serializing_if = "Option::is_none")]
    pub value: Option<InstantValue>,
}

/// Query result from Prometheus API
#[derive(Debug, Clone, Serialize, Deserialize)]
struct QueryResult {
    status: String,
    data: QueryData,
}

/// Query data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
enum QueryData {
    Matrix(Vec<TimeSeriesData>),
    Vector(Vec<TimeSeriesData>),
    Scalar(InstantValue),
    String(String),
}

/// Prometheus HTTP client for querying metrics
#[derive(Debug, Clone)]
pub struct Client {
    http_client: HttpClient,
    base_url: String,
    auth: Option<(String, String)>,
}

impl Client {
    /// Create a new Prometheus client
    pub fn new(config: PrometheusConfig) -> Result<Self> {
        // Validate URL
        Url::parse(&config.url).context("Invalid Prometheus URL")?;

        let http_client = HttpClient::builder()
            .timeout(config.timeout)
            .connect_timeout(Duration::from_secs(5))
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            http_client,
            base_url: config.url.trim_end_matches('/').to_string(),
            auth: config.auth,
        })
    }

    /// Execute an instant query (returns latest value for each matched metric)
    ///
    /// # Arguments
    /// * `query` - PromQL query string
    /// * `time` - Optional Unix timestamp, defaults to current time
    pub async fn query_instant(
        &self,
        query: &str,
        time: Option<i64>,
    ) -> Result<Vec<TimeSeriesData>> {
        let mut params = vec![("query", query.to_string())];
        if let Some(t) = time {
            params.push(("time", t.to_string()));
        }

        self.execute_query("/api/v1/query", params).await
    }

    /// Execute a range query (returns time series data over a time range)
    ///
    /// # Arguments
    /// * `query` - PromQL query string
    /// * `start` - Unix timestamp (seconds) for range start
    /// * `end` - Unix timestamp (seconds) for range end
    /// * `step` - Query resolution step (interval between samples, in seconds)
    pub async fn query_range(
        &self,
        query: &str,
        start: i64,
        end: i64,
        step: i64,
    ) -> Result<Vec<TimeSeriesData>> {
        anyhow::ensure!(start < end, "start time must be before end time");
        anyhow::ensure!(step > 0, "step must be positive");

        let params = vec![
            ("query", query.to_string()),
            ("start", start.to_string()),
            ("end", end.to_string()),
            ("step", step.to_string()),
        ];

        self.execute_query("/api/v1/query_range", params).await
    }

    /// Test connectivity to Prometheus endpoint
    pub async fn health(&self) -> Result<bool> {
        let url = format!("{}/api/v1/status/config", self.base_url);
        match self.http_client.get(&url).send().await {
            Ok(response) => {
                debug!("Prometheus health check: {}", response.status());
                Ok(response.status().is_success())
            }
            Err(e) => {
                warn!("Prometheus health check failed: {}", e);
                Ok(false)
            }
        }
    }

    /// Execute a query and parse the response
    async fn execute_query(
        &self,
        endpoint: &str,
        params: Vec<(&str, String)>,
    ) -> Result<Vec<TimeSeriesData>> {
        let url = format!("{}{}", self.base_url, endpoint);

        let mut request = self.http_client.get(&url);

        // Add basic auth if configured
        if let Some((username, password)) = &self.auth {
            request = request.basic_auth(username, Some(password));
        }

        // Add query parameters
        for (key, value) in params {
            request = request.query(&[(key, value)]);
        }

        debug!("Executing Prometheus query: {}", url);

        let response = request
            .send()
            .await
            .context("Failed to connect to Prometheus")?;

        let status = response.status();
        if !status.is_success() {
            let error_body = response.text().await.unwrap_or_default();
            return Err(anyhow!(
                "Prometheus query failed with status {}: {}",
                status,
                error_body
            ));
        }

        let body = response
            .json::<QueryResult>()
            .await
            .context("Failed to parse Prometheus response")?;

        if body.status != "success" {
            return Err(anyhow!("Prometheus query failed: {}", body.status));
        }

        let results = match body.data {
            QueryData::Matrix(data) => data,
            QueryData::Vector(data) => data,
            QueryData::Scalar(value) => {
                // Scalar result, convert to single metric
                vec![TimeSeriesData {
                    metric: HashMap::from([("__value__".to_string(), value.1.clone())]),
                    values: None,
                    value: Some(value),
                }]
            }
            QueryData::String(s) => {
                return Err(anyhow!("Unexpected string response from Prometheus: {}", s))
            }
        };

        debug!("Prometheus query returned {} time series", results.len());

        Ok(results)
    }

    /// Parse a time series value string to f64
    pub fn parse_value(value: &str) -> Result<f64> {
        value
            .parse::<f64>()
            .context(format!("Failed to parse metric value: {}", value))
    }

    /// Build a PromQL query for Elasticsearch exporter metrics
    ///
    /// # Arguments
    /// * `metric_name` - Base metric name (e.g., "elasticsearch_jvm_memory_used_bytes")
    /// * `job` - Prometheus job name
    /// * `labels` - Additional label matchers as HashMap
    pub fn build_query(
        metric_name: &str,
        job: Option<&str>,
        labels: Option<&HashMap<String, String>>,
    ) -> String {
        let mut query = metric_name.to_string();
        let mut label_parts = vec![];

        if let Some(j) = job {
            label_parts.push(format!(r#"job="{}""#, j));
        }

        if let Some(l) = labels {
            for (k, v) in l {
                label_parts.push(format!(r#"{}="{}""#, k, v));
            }
        }

        if !label_parts.is_empty() {
            query.push('{');
            query.push_str(&label_parts.join(","));
            query.push('}');
        }

        query
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_build_query_with_job() {
        let query = Client::build_query(
            "elasticsearch_jvm_memory_used_bytes",
            Some("elasticsearch"),
            None,
        );
        assert_eq!(
            query,
            r#"elasticsearch_jvm_memory_used_bytes{job="elasticsearch"}"#
        );
    }

    #[test]
    fn test_build_query_with_labels() {
        let mut labels = HashMap::new();
        labels.insert("cluster".to_string(), "prod".to_string());
        labels.insert("node".to_string(), "node-1".to_string());

        let query = Client::build_query(
            "elasticsearch_jvm_memory_used_bytes",
            Some("elasticsearch"),
            Some(&labels),
        );
        assert!(query.contains("job=\"elasticsearch\""));
        assert!(query.contains("cluster=\"prod\""));
        assert!(query.contains("node=\"node-1\""));
    }

    #[test]
    fn test_build_query_no_filters() {
        let query = Client::build_query("elasticsearch_jvm_memory_used_bytes", None, None);
        assert_eq!(query, "elasticsearch_jvm_memory_used_bytes");
    }

    #[test]
    fn test_parse_value() {
        assert_eq!(Client::parse_value("123.456").unwrap(), 123.456);
        assert_eq!(Client::parse_value("0").unwrap(), 0.0);
        assert!(Client::parse_value("invalid").is_err());
    }
}
