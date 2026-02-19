//! Cerebro - Elasticsearch cluster management tool
//!
//! Main entry point for the Cerebro backend server.

use anyhow::{Context, Result};
use axum::{
    middleware,
    routing::{get, post},
    Router,
};
use cerebro::{
    auth::{AuthConfig, AuthMiddleware, AuthProviderFactory, ConfigLoader, SessionManager},
    routes,
};
use std::{net::SocketAddr, path::PathBuf, sync::Arc};
use tower_http::trace::TraceLayer;

#[tokio::main]
async fn main() -> Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt::init();

    tracing::info!("Cerebro backend starting...");

    // Load authentication configuration
    let config_path = PathBuf::from("config.yaml");
    let config_loader = ConfigLoader::new(config_path);

    let auth_config = config_loader
        .load()
        .context("Failed to load authentication configuration")?;

    tracing::info!("Authentication mode: {:?}", auth_config.mode);

    // Initialize authentication components
    let session_manager = Arc::new(SessionManager::new(
        auth_config.session.clone(),
        auth_config.security.clone(),
    ));

    let auth_factory = AuthProviderFactory::new(auth_config.clone(), session_manager.clone());

    let auth_provider = auth_factory
        .create()
        .context("Failed to create authentication provider")?;

    tracing::info!(
        "Authentication provider initialized: {}",
        auth_provider.provider_type()
    );

    // Create OIDC provider if needed (for authorization URL generation)
    let oidc_provider = if matches!(auth_config.mode, cerebro::auth::AuthMode::Oidc) {
        use cerebro::auth::oidc::OidcAuthProvider;
        let oidc_config = auth_config
            .oidc
            .as_ref()
            .expect("OIDC config should exist for OIDC mode");
        Some(Arc::new(
            OidcAuthProvider::new(oidc_config.clone(), session_manager.clone())
                .context("Failed to create OIDC provider")?,
        ))
    } else {
        None
    };

    // Create authentication middleware
    let auth_middleware = AuthMiddleware::new(session_manager.clone(), auth_config.clone());

    // Build the router with authentication routes
    let auth_routes = Router::new()
        .route("/login", post(routes::auth::login))
        .route("/oidc/login", get(routes::auth::oidc_login))
        .route("/oidc/callback", get(routes::auth::oidc_callback))
        .route("/logout", post(routes::auth::logout))
        .with_state(routes::auth::AuthState {
            provider: auth_provider,
            oidc_provider,
            session_manager: session_manager.clone(),
            auth_config: auth_config.clone(),
        });

    // Build the main application router
    let app = Router::new()
        .nest("/api/auth", auth_routes)
        // Protected routes would be added here with authentication middleware
        // .route("/api/clusters", get(clusters::list))
        // .layer(middleware::from_fn(move |req, next| {
        //     auth_middleware.authenticate(req, next)
        // }))
        .layer(TraceLayer::new_for_http());

    // Start the server
    let addr = SocketAddr::from(([0, 0, 0, 0], 9000));
    tracing::info!("Server listening on {}", addr);

    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await
        .context("Server error")?;

    Ok(())
}
