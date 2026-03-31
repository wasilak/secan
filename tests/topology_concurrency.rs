use axum::extract::{Extension as AxExtension, Path as AxPath, State as AxState};
use axum::response::IntoResponse;
use secan::auth::middleware::AuthenticatedUser;
use serde_json::json;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Semaphore;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

// Integration test for topology generation concurrency behaviour.
// This test is self-contained and does not rely on backend/test helpers.
#[tokio::test]
async fn concurrent_generation_is_limited_and_cached_paths_bypass() {
    // Spawn a tiny fake cluster HTTP server that answers the ES endpoints used
    // by the topology handler. Responses are minimal but sufficient for the
    // transform/compute_cluster_generation logic.
    let base_url = spawn_fake_cluster().await;

    // Build a ClusterManager for a single cluster pointing to the fake server.
    let cluster_cfg = secan::config::ClusterConfig::new("cluster-a".into(), vec![base_url]);
    let cluster_manager = secan::cluster::Manager::new(vec![cluster_cfg], Duration::from_secs(30))
        .await
        .expect("cluster manager");

    // Prepare caches and semaphores as in server wiring
    let cache_ttl = Duration::from_secs(30);
    let details_cache = Arc::new(secan::cache::MetadataCache::<serde_json::Value>::new(
        cache_ttl,
    ));
    let details_semaphore = Arc::new(tokio::sync::Semaphore::new(6));

    let tile_cache = Arc::new(
        moka::future::Cache::builder()
            .time_to_live(cache_ttl)
            .max_capacity(1000)
            .build(),
    );

    // Limit concurrent uncached generations to 1 for the test
    let topology_generation_semaphore = Arc::new(Semaphore::new(1));

    let cluster_state = secan::routes::ClusterState {
        cluster_manager: Arc::new(cluster_manager),
        details_cache,
        details_semaphore,
        tile_cache: tile_cache.clone(),
        topology_max_tiles_per_request: 64,
        topology_generation_semaphore: topology_generation_semaphore.clone(),
        topology_generation_acquire_timeout_seconds: 1, // short timeout for test
    };

    // We call the handler in-process; no HTTP router is required for this test.

    // Acquire the single permit to simulate the server being saturated.
    // This should cause incoming uncached generation requests to time out.
    let held_permit = topology_generation_semaphore
        .clone()
        .acquire_owned()
        .await
        .expect("acquire initial permit");

    // Build a tile request body (single tile) using the typed request struct
    let make_tbreq = || secan::routes::topology::TileBatchRequest {
        tile_requests: vec![secan::routes::topology::TileRequestEntry {
            x: 0,
            y: 0,
            lod: "L1".to_string(),
            client_version: None,
        }],
    };

    // Call the handler directly (in-process). Expect concurrency-limited error.
    let state_ex = AxState(cluster_state.clone());
    let path_ex = AxPath("cluster-a".to_string());
    let user_ext: Option<AxExtension<AuthenticatedUser>> = None;
    let json_ex = axum::Json(make_tbreq());

    let res = secan::routes::topology::post_tiles(state_ex, path_ex, user_ext, json_ex).await;
    match res {
        Err(err) => {
            // When converted to an HTTP response the error should map to 429
            let resp = err.into_response();
            assert_eq!(resp.status(), axum::http::StatusCode::TOO_MANY_REQUESTS);
            // Verify structured body contains the expected error code
            // Read up to 64 KiB of body bytes
            let body_bytes = axum::body::to_bytes(resp.into_body(), 64 * 1024)
                .await
                .expect("read response body");
            let v: serde_json::Value =
                serde_json::from_slice(&body_bytes).expect("parse error body JSON");
            assert_eq!(v["error"], "generation_concurrency_limited");
        }
        Ok((status, _)) => panic!("expected error but got success: {}", status),
    }

    // Release permit so we can generate and populate the cache
    drop(held_permit);

    // Generate tiles (populate cache)
    let state_ex = AxState(cluster_state.clone());
    let path_ex = AxPath("cluster-a".to_string());
    let json_ex = axum::Json(make_tbreq());
    let gen_res = secan::routes::topology::post_tiles(state_ex, path_ex, None, json_ex).await;
    let (status, body) = gen_res.expect("generation should succeed");
    assert_eq!(status, axum::http::StatusCode::OK);
    assert!(!body.tiles.is_empty());

    // Wait for tile cache to be populated for the generated tile
    let first = &body.tiles[0];
    // cluster_generation is prefix before "-v-"
    let cluster_generation = first
        .version
        .split("-v-")
        .next()
        .expect("extract cluster generation")
        .to_string();
    let key = format!(
        "tile:cluster-a:{}:{}:{}:{}",
        cluster_generation, first.lod, first.x, first.y
    );

    // Give the generation logic some time to finish and insert into the cache.
    // Increase polling window to avoid flakes on slower machines/CI.
    let mut found = false;
    for _ in 0..50 {
        if tile_cache.get(&key).await.is_some() {
            found = true;
            break;
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
    assert!(found, "tile cache was not populated in time");

    // Re-acquire the permit to simulate saturation again
    let held_permit2 = topology_generation_semaphore
        .clone()
        .acquire_owned()
        .await
        .expect("acquire second permit");

    // While permit held, cached request should succeed (cache populated by previous request)
    let state_ex = AxState(cluster_state.clone());
    let path_ex = AxPath("cluster-a".to_string());
    let json_ex = axum::Json(make_tbreq());
    let cached_res = secan::routes::topology::post_tiles(state_ex, path_ex, None, json_ex)
        .await
        .expect("cached request should succeed");
    assert_eq!(cached_res.0, axum::http::StatusCode::OK);

    // Release permit
    drop(held_permit2);
}

fn fake_nodes_info_value() -> serde_json::Value {
    json!({
        "nodes": {
            "n1": { "name": "n1", "roles": ["master", "data"], "attributes": {} }
        },
        "cluster_name": "test"
    })
}

fn fake_nodes_stats_value() -> serde_json::Value {
    json!({
        "nodes": {
            "n1": {
                "jvm": { "mem": { "heap_used_in_bytes": 100, "heap_max_in_bytes": 200 }, "uptime_in_millis": 1000 },
                "os": { "cpu": { "percent": 10 }, "cpu": { "load_average": { "1m": 0.5 } }, "load_average": 0.5 },
                "fs": { "total": { "total_in_bytes": 1000, "available_in_bytes": 500 } }
            }
        }
    })
}

async fn spawn_fake_cluster() -> String {
    let nodes_info = fake_nodes_info_value();
    let nodes_stats = fake_nodes_stats_value();
    let routing_nodes = json!({ "routing_nodes": { "unassigned": [], "nodes": {} } });

    let mock_server = MockServer::start().await;

    Mock::given(method("GET"))
        .and(path("/_nodes"))
        .respond_with(ResponseTemplate::new(200).set_body_json(nodes_info))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/_nodes/stats"))
        .respond_with(ResponseTemplate::new(200).set_body_json(nodes_stats))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/_cat/master"))
        .and(wiremock::matchers::query_param("format", "json"))
        .respond_with(ResponseTemplate::new(200).set_body_json(json!([{ "id": "n1" }])))
        .mount(&mock_server)
        .await;

    Mock::given(method("GET"))
        .and(path("/_cluster/state/routing_nodes"))
        .respond_with(ResponseTemplate::new(200).set_body_json(routing_nodes))
        .mount(&mock_server)
        .await;

    mock_server.uri()
}
