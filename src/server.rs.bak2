use crate::auth::SessionManager;
use crate::cluster::Manager as ClusterManager;
use crate::config::Config;
use axum::{
    http::Method,
    middleware,
    routing::{get, post},
    Router,
};
use std::sync::Arc;
use tower_http::{
    compression::CompressionLayer,
    cors::{Any, CorsLayer},
};

/// Server structure containing application state and configuration
#[derive(Clone)]
pub struct Server {
    /// Application configuration
    pub config: Arc<Config>,
    /// Cluster manager for Elasticsearch/OpenSearch connections
    pub cluster_manager: Arc<ClusterManager>,
    /// Session manager for user sessions
    pub session_manager: Arc<SessionManager>,
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
    pub fn new(
        config: Config,
        cluster_manager: ClusterManager,
        session_manager: SessionManager,
    ) -> Self {
        Self {
            config: Arc::new(config),
            cluster_manager: Arc::new(cluster_manager),
            session_manager: Arc::new(session_manager),
        }
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
        let auth_state = crate::routes::AuthState {
            oidc_provider: None, // TODO: Initialize OIDC provider if configured
            session_manager: self.session_manager.clone(),
        };

        // Create cluster state for cluster routes
        let cluster_state = crate::routes::ClusterState {
            cluster_manager: self.cluster_manager.clone(),
        };

        // Build the router with all routes
        Router::new()
            // Health and readiness endpoints (no auth required)
            .route("/health", get(crate::routes::health::health_check))
            .route("/ready", get(crate::routes::health::readiness_check))
            // Authentication routes
            .route("/api/auth/login", post(crate::routes::auth::login))
            .route("/api/auth/logout", post(crate::routes::auth::logout))
            .route("/api/auth/oidc/login", get(crate::routes::auth::oidc_login))
            .route(
                "/api/auth/oidc/callback",
                get(crate::routes::auth::oidc_callback),
            )
            .with_state(auth_state)
            // Cluster routes
            .route("/api/clusters", get(crate::routes::clusters::list_clusters))
            .route(
                "/api/clusters/:id/*path",
                get(crate::routes::clusters::proxy_request)
                    .post(crate::routes::clusters::proxy_request)
                    .put(crate::routes::clusters::proxy_request)
                    .delete(crate::routes::clusters::proxy_request),
            )
            .with_state(cluster_state)
            // Static assets - must be last to act as fallback
            .fallback(crate::routes::serve_static)
            // Add security headers middleware (CSP, HSTS, X-Frame-Options, etc.)
            .layer(middleware::from_fn(
                crate::middleware::security::security_headers_middleware,
            ))
            // Add logging middleware (logs all requests with request IDs)
            .layer(middleware::from_fn(
                crate::middleware::logging::logging_middleware,
            ))
            // Add CORS middleware with proper configuration
            // Allow specific methods and headers for security
            .layer(
                CorsLayer::new()
                    .allow_origin(Any) // TODO: Configure allowed origins from config
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
                    ]),
            )
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
            tracing::info!(
                "Server starting on {} - For production use, deploy behind a reverse proxy with TLS enabled",
                addr
            );
        }

        tracing::info!("Server listening on {}", addr);

        let app = self.router();

        axum::serve(listener, app).await?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::SessionConfig;
    use crate::config::{AuthConfig, AuthMode, ClusterConfig, ServerConfig};

    fn create_test_config() -> Config {
        Config {
            server: ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 9000,
                tls: None,
            },
            auth: AuthConfig {
                mode: AuthMode::Open,
                session_timeout_minutes: 60,
                local_users: None,
                oidc: None,
                roles: vec![],
            },
            clusters: vec![],
        }
    }

    #[tokio::test]
    async fn test_server_creation() {
        let config = create_test_config();
        let cluster_manager = ClusterManager::new(vec![]).await;
        assert!(cluster_manager.is_err()); // Empty clusters should fail

        // Create with at least one cluster
        let cluster_config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: crate::config::TlsConfig::default(),
            client_type: crate::config::ClientType::Http,
            version_hint: None,
        };

        let cluster_manager = ClusterManager::new(vec![cluster_config]).await.unwrap();
        let session_manager = SessionManager::new(SessionConfig::new(60));

        let server = Server::new(config, cluster_manager, session_manager);

        assert_eq!(server.config.server.port, 9000);
    }

    #[test]
    fn test_router_creation() {
        let config = create_test_config();
        let cluster_config = ClusterConfig {
            id: "test".to_string(),
            name: "Test".to_string(),
            nodes: vec!["http://localhost:9200".to_string()],
            auth: None,
            tls: crate::config::TlsConfig::default(),
            client_type: crate::config::ClientType::Http,
            version_hint: None,
        };

        // Use tokio runtime for async operations
        let rt = tokio::runtime::Runtime::new().unwrap();
        let cluster_manager = rt
            .block_on(ClusterManager::new(vec![cluster_config]))
            .unwrap();
        let session_manager = SessionManager::new(SessionConfig::new(60));

        let server = Server::new(config, cluster_manager, session_manager);
        let _router = server.router();

        // Router creation should succeed
        // We can't easily test the routes without starting the server
    }
}
