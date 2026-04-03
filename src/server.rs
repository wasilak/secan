use crate::auth::SessionManager;
use crate::cache::MetadataCache;
use crate::cluster::Manager as ClusterManager;
use crate::config::Config;
use crate::telemetry::axum_middleware::OtelTraceLayer;
use crate::telemetry::config::TelemetryConfig;
use anyhow::Context;
use axum::{
    http::Method,
    middleware,
    routing::{get, post, put},
    Router,
};
use serde_json::Value;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::{RwLock, Semaphore};
use tower_http::{compression::CompressionLayer, cors::CorsLayer};

/// Server structure containing application state and configuration
#[derive(Clone)]
pub struct Server {
    /// Application configuration
    pub config: Arc<Config>,
    /// Cluster manager for Elasticsearch/OpenSearch connections
    pub cluster_manager: Arc<ClusterManager>,
    /// Session manager for user sessions
    pub session_manager: Arc<SessionManager>,
    /// OIDC provider (initialized if OIDC mode is configured)
    pub oidc_provider: Option<Arc<crate::auth::OidcAuthProvider>>,
    /// LDAP provider (initialized if LDAP mode is configured)
    pub ldap_provider: Option<Arc<crate::auth::LdapAuthProvider>>,
}

impl Server {
    /// Create a new server instance
    ///
    /// # Arguments
    ///
    /// * `config` - Application configuration
    /// * `cluster_manager` - Cluster manager instance
    /// * `session_manager` - Session manager instance
    ///
    /// # Returns
    ///
    /// A new Server instance
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 1.2
    pub async fn new(
        config: Config,
        cluster_manager: ClusterManager,
        session_manager: SessionManager,
    ) -> anyhow::Result<Self> {
        // Initialize OIDC provider if OIDC mode is configured
        let oidc_provider = if config.auth.mode == crate::config::AuthMode::Oidc {
            if let Some(oidc_config) = &config.auth.oidc {
                let permission_resolver =
                    crate::auth::PermissionResolver::new(config.auth.permissions.clone());

                let provider = crate::auth::OidcAuthProvider::new(
                    oidc_config.clone(),
                    Arc::new(session_manager.clone()),
                    permission_resolver,
                )
                .await
                .context("Failed to initialize OIDC provider")?;

                Some(Arc::new(provider))
            } else {
                None
            }
        } else {
            None
        };

        // Initialize LDAP provider if LDAP mode is configured
        let ldap_provider = if config.auth.mode == crate::config::AuthMode::Ldap {
            let ldap_config = config
                .auth
                .ldap
                .as_ref()
                .ok_or_else(|| anyhow::anyhow!("LDAP auth mode requires LDAP configuration"))?;

            let permission_resolver =
                crate::auth::PermissionResolver::new(config.auth.permissions.clone());

            let provider = crate::auth::LdapAuthProvider::new(
                ldap_config.clone(),
                Arc::new(session_manager.clone()),
                permission_resolver,
            )
            .await
            .context("Failed to initialize LDAP provider")?;

            Some(Arc::new(provider))
        } else {
            None
        };

        Ok(Self {
            config: Arc::new(config),
            cluster_manager: Arc::new(cluster_manager),
            session_manager: Arc::new(session_manager),
            oidc_provider,
            ldap_provider,
        })
    }

    /// Create the Axum router with all API routes and middleware
    ///
    /// # Returns
    ///
    /// An Axum Router configured with all routes and middleware
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 1.2, 30.2, 30.7, 31.8
    pub fn router(&self) -> Router {
        // Create auth state for authentication routes
        let auth_routes_state = crate::routes::AuthState {
            oidc_provider: self.oidc_provider.clone(),
            ldap_provider: self.ldap_provider.clone(),
            session_manager: self.session_manager.clone(),
            config: self.config.clone(),
        };

        // Create auth state for middleware
        let auth_middleware_state = Arc::new(crate::auth::AuthState::new(
            self.session_manager.clone(),
            self.config.auth.mode.clone(),
        ));

        // Create OTLP proxy state if telemetry is enabled
        let telemetry_config = match TelemetryConfig::from_env() {
            Ok(config) => config,
            Err(_) => {
                // Telemetry disabled or misconfigured - use default disabled config
                TelemetryConfig {
                    enabled: false,
                    service_name: "secan".to_string(),
                    service_version: env!("CARGO_PKG_VERSION").to_string(),
                    otlp_endpoint: "http://localhost:4318".to_string(),
                    otlp_protocol: crate::telemetry::config::OtlpProtocol::Http,
                    otlp_headers: vec![],
                    sampler: crate::telemetry::config::SamplerConfig::default(),
                    resource_attributes: vec![],
                    batch_config: crate::telemetry::config::BatchConfig::default(),
                }
            }
        };
        let otel_proxy_state: Option<Arc<crate::routes::telemetry::OtelProxyState>> =
            if telemetry_config.enabled {
                let headers: Vec<(String, String)> = telemetry_config
                    .otlp_headers
                    .iter()
                    .map(|(k, v)| (k.clone(), v.clone()))
                    .collect();

                Some(Arc::new(crate::routes::telemetry::OtelProxyState::new(
                    telemetry_config.otlp_endpoint,
                    headers,
                )))
            } else {
                None
            };

        // Create cluster state for cluster routes
        // Initialize details cache and concurrency semaphore used by per-cluster details endpoint
        let cache_ttl = Duration::from_secs(self.config.cache.get_duration_secs());
        let details_cache = Arc::new(MetadataCache::<Value>::new(cache_ttl));

        // Create a moka-based cache for tiles with TTL and max capacity.
        let tile_max = self.config.cache.tile_max_entries.unwrap_or(10_000);
        let tile_cache = Arc::new(
            moka::future::Cache::builder()
                .time_to_live(cache_ttl)
                .max_capacity(tile_max)
                .build(),
        );
        // Default concurrency for fan-out is 6
        let details_semaphore = Arc::new(Semaphore::new(6));

        // Create a semaphore for topology generation concurrency. Default to 4 if not configured.
        let topology_limit = self.config.topology_max_concurrent_generations.unwrap_or(4);
        let topology_generation_semaphore = Arc::new(Semaphore::new(topology_limit));

        let cluster_state = crate::routes::ClusterState {
            cluster_manager: self.cluster_manager.clone(),
            details_cache: details_cache.clone(),
            details_semaphore: details_semaphore.clone(),
            tile_cache: tile_cache.clone(),
            topology_max_tiles_per_request: self
                .config
                .topology_max_tiles_per_request
                .unwrap_or(64),
            topology_generation_semaphore: topology_generation_semaphore.clone(),
            topology_generation_acquire_timeout_seconds: self
                .config
                .topology_generation_acquire_timeout_seconds
                .unwrap_or(8),
        };

        // Create metrics state for metrics routes
        let metrics_state = crate::routes::metrics::MetricsState {
            cluster_manager: self.cluster_manager.clone(),
        };

        // Build the router with all routes
        let health_state = crate::routes::health::HealthState {
            cluster_manager: self.cluster_manager.clone(),
            session_manager: self.session_manager.clone(),
        };

        // Build the router with all routes
        let mut app = Router::new()
            // Health, readiness, and version endpoints (no auth required)
            // These must come before .with_state() since they use different state
            .route("/health", get(crate::routes::health::health_check))
            .route("/ready", get(crate::routes::health::readiness_check))
            .route("/api/version", get(crate::routes::health::get_version))
            .with_state(Arc::new(RwLock::new(health_state)));

        // Add OTLP proxy endpoint only if telemetry is enabled
        if let Some(proxy_state) = otel_proxy_state {
            app = app.route(
                "/v1/traces",
                post(crate::routes::telemetry::trace_export_handler).with_state(proxy_state),
            );
        }

        app
            // Authentication routes
            .route("/api/auth/login", post(crate::routes::auth::login))
            .route("/api/auth/logout", post(crate::routes::auth::logout))
            .route("/api/auth/me", get(crate::routes::auth::get_current_user))
            .route(
                "/api/auth/status",
                get(crate::routes::auth::get_auth_status),
            )
            .route("/api/auth/oidc/login", get(crate::routes::auth::oidc_login))
            .route(
                "/api/auth/oidc/callback",
                get(crate::routes::auth::oidc_callback),
            )
            .with_state(auth_routes_state)
            // Cluster routes
            .route("/api/clusters", get(crate::routes::clusters::list_clusters))
            // Typed SDK routes for cluster data
            .route(
                "/api/clusters/{id}/stats",
                get(crate::routes::clusters::get_cluster_stats),
            )
            .route(
                "/api/clusters/{id}/details",
                get(crate::routes::clusters::get_cluster_details),
            )
            .route(
                "/api/clusters/{id}/settings",
                get(crate::routes::clusters::get_cluster_settings),
            )
            .route(
                "/api/clusters/{id}/settings",
                put(crate::routes::clusters::update_cluster_settings),
            )
            .route(
                "/api/clusters/{id}/nodes",
                get(crate::routes::clusters::get_nodes),
            )
            // Topology tile generation (per-cluster)
            .route(
                "/api/clusters/{id}/topology/tiles",
                post(crate::routes::topology::post_tiles),
            )
            // Topology Sankey diagram data (per-cluster)
            .route(
                "/api/clusters/{id}/topology/sankey",
                get(crate::routes::topology::sankey::get_sankey),
            )
            .route(
                "/api/clusters/{id}/nodes/{nodeId}/stats",
                get(crate::routes::clusters::get_node_stats),
            )
            .route(
                "/api/clusters/{id}/indices",
                get(crate::routes::clusters::get_indices),
            )
            .route(
                "/api/clusters/{id}/shards",
                get(crate::routes::clusters::get_shards),
            )
            .route(
                "/api/clusters/{id}/shards/{index}/{shard}",
                get(crate::routes::clusters::get_shard_stats),
            )
            // Node-specific shard endpoint for progressive loading
            .route(
                "/api/clusters/{id}/nodes/{node_id}/shards",
                get(crate::routes::clusters::get_node_shards),
            )
            // Lightweight per-node shard count summary
            .route(
                "/api/clusters/{id}/nodes/shard-summary",
                get(crate::routes::clusters::get_nodes_shard_summary),
            )
            // Shard relocation endpoint
            .route(
                "/api/clusters/{id}/shards/relocate",
                post(crate::routes::clusters::relocate_shard),
            )
            // Task management endpoints
            .route(
                "/api/clusters/{id}/tasks",
                get(crate::routes::clusters::tasks::fetch_cluster_tasks),
            )
            .route(
                "/api/clusters/{id}/tasks/{task_id}",
                get(crate::routes::clusters::tasks::get_task_details),
            )
            .route(
                "/api/clusters/{id}/tasks/{task_id}/_cancel",
                post(crate::routes::clusters::tasks::cancel_cluster_task),
            )
            // Metrics endpoints (must be before catch-all proxy route)
            .nest(
                "/api/clusters/{id}/metrics",
                crate::routes::metrics::metrics_router().with_state(metrics_state),
            )
            .route(
                "/api/clusters/{id}/{*path}",
                get(crate::routes::clusters::proxy_request)
                    .post(crate::routes::clusters::proxy_request)
                    .put(crate::routes::clusters::proxy_request)
                    .delete(crate::routes::clusters::proxy_request),
            )
            .with_state(cluster_state)
            // Static assets - must be last to act as fallback
            .fallback(crate::routes::serve_static)
            // Add auth middleware (handles authentication in all modes)
            .layer(middleware::from_fn_with_state(
                auth_middleware_state.clone(),
                crate::auth::auth_middleware,
            ))
            // Add security headers middleware (CSP, HSTS, X-Frame-Options, etc.)
            .layer(middleware::from_fn(
                crate::middleware::security::security_headers_middleware,
            ))
            // Add logging middleware (logs all requests with request IDs)
            .layer(middleware::from_fn(
                crate::middleware::logging::logging_middleware,
            ))
            // Add OpenTelemetry tracing layer (creates OTel spans for requests)
            .layer(OtelTraceLayer)
            // Add CORS middleware with proper configuration
            // Security: If allowed_origins is configured, restrict to those origins only
            // This prevents external API access when using embedded frontend
            .layer({
                let mut cors = CorsLayer::new()
                    .allow_methods([
                        Method::GET,
                        Method::POST,
                        Method::PUT,
                        Method::DELETE,
                        Method::HEAD,
                        Method::OPTIONS,
                    ])
                    .allow_headers([
                        axum::http::header::CONTENT_TYPE,
                        axum::http::header::AUTHORIZATION,
                        axum::http::header::ACCEPT,
                    ]);

                if self.config.server.allowed_origins.is_empty() {
                    tracing::debug!(
                        "No allowed_origins configured - CORS allows any origin (development mode)"
                    );
                    cors = cors.allow_origin(tower_http::cors::Any);
                } else {
                    tracing::debug!(
                        origins = ?self.config.server.allowed_origins,
                        "CORS restricted to configured origins (production mode)"
                    );
                    // Convert string origins to HeaderValue
                    let origins: Vec<axum::http::HeaderValue> = self
                        .config
                        .server
                        .allowed_origins
                        .iter()
                        .filter_map(|s| s.parse().ok())
                        .collect();
                    cors = cors.allow_origin(origins);
                }
                cors
            })
            // Add compression middleware
            .layer(CompressionLayer::new())
    }

    /// Start the server and listen for incoming connections
    ///
    /// # TLS/HTTPS Support
    ///
    /// For production deployments, TLS should be handled by a reverse proxy
    /// (nginx, traefik, caddy, etc.) in front of this application.
    /// This is the recommended approach for Rust web applications.
    ///
    /// The TLS configuration in the config file is reserved for future use
    /// or for advanced deployment scenarios.
    ///
    /// # Returns
    ///
    /// Result indicating success or failure
    ///
    /// # Requirements
    ///
    /// Validates: Requirements 1.2, 30.1, 30.8
    pub async fn run(self) -> anyhow::Result<()> {
        let addr = format!("{}:{}", self.config.server.host, self.config.server.port);
        let listener = tokio::net::TcpListener::bind(&addr).await?;

        // Log TLS recommendation
        if self.config.server.tls.is_some() {
            tracing::warn!(
                "TLS configuration detected but not used. For production, use a reverse proxy (nginx, traefik, caddy) to handle TLS termination."
            );
        } else {
            tracing::debug!(
                "Server starting on {} - For production use, deploy behind a reverse proxy with TLS enabled",
                addr
            );
        }

        tracing::info!(address = %addr, "Server listening");

        let app = self.router();

        // Setup graceful shutdown signal handler
        let shutdown_signal = async {
            let mut sigterm =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
                    .expect("Failed to setup SIGTERM handler");
            let mut sigint =
                tokio::signal::unix::signal(tokio::signal::unix::SignalKind::interrupt())
                    .expect("Failed to setup SIGINT handler");

            tokio::select! {
                _ = sigterm.recv() => {
                    tracing::info!("Received SIGTERM, starting graceful shutdown");
                },
                _ = sigint.recv() => {
                    tracing::info!("Received SIGINT, starting graceful shutdown");
                },
            }
        };

        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal)
            .await?;

        tracing::info!("Server shut down gracefully");

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::SessionConfig;
    use crate::config::{AuthConfig, AuthMode, ClusterConfig, ServerConfig};

    const TEST_SECRET: &str = "test-secret-key-for-server-tests-only-32chars!";

    fn create_test_config() -> Config {
        Config {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 27182,
                tls: None,
                allowed_origins: vec![],
            },
            auth: AuthConfig {
                mode: AuthMode::Open,
                session_timeout_minutes: 60,
                local_users: None,
                oidc: None,
                ldap: None,
                roles: vec![],
                permissions: vec![],
            },
            clusters: vec![],
            cache: crate::config::CacheConfig::default(),
            topology_max_tiles_per_request: None,
            topology_max_concurrent_generations: None,
            topology_generation_acquire_timeout_seconds: None,
        }
    }

    #[tokio::test]
    async fn test_server_creation() {
        let config = create_test_config();
        let cluster_manager = ClusterManager::new(vec![], std::time::Duration::from_secs(30)).await;
        assert!(cluster_manager.is_err()); // Empty clusters should fail

        // Create with at least one cluster
        let cluster_config = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: crate::config::TlsConfig::default(),

            ..Default::default()
        };

        let cluster_manager =
            ClusterManager::new(vec![cluster_config], std::time::Duration::from_secs(30))
                .await
                .expect("create cluster manager");
        let session_manager = SessionManager::new(SessionConfig::new(60, TEST_SECRET.to_string()));

        let server = Server::new(config, cluster_manager, session_manager)
            .await
            .expect("create server");

        assert_eq!(server.config.server.port, 27182);
    }

    #[tokio::test]
    async fn test_router_creation() {
        let config = create_test_config();
        let cluster_config = ClusterConfig {
            id: "test".to_string(),
            name: Some("Test".to_string()),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: crate::config::TlsConfig::default(),

            ..Default::default()
        };

        let cluster_manager =
            ClusterManager::new(vec![cluster_config], std::time::Duration::from_secs(30))
                .await
                .expect("create cluster manager");
        let session_manager = SessionManager::new(SessionConfig::new(60, TEST_SECRET.to_string()));

        let server = Server::new(config, cluster_manager, session_manager)
            .await
            .expect("create server");
        let _router = server.router();

        // Router creation should succeed
        // We can't easily test the routes without starting the server
    }
}
