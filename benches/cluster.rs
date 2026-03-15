use criterion::{black_box, criterion_group, criterion_main, BenchmarkId, Criterion};
use secan::cluster::{ClusterHealth, HealthStatus};
use secan::config::{ClusterConfig, TlsConfig};

fn bench_cluster_health_parsing(c: &mut Criterion) {
    let json_data = r#"{
        "cluster_name": "test-cluster",
        "status": "green",
        "number_of_nodes": 5,
        "number_of_data_nodes": 3,
        "active_primary_shards": 100,
        "active_shards": 250,
        "relocating_shards": 0,
        "initializing_shards": 0,
        "unassigned_shards": 0
    }"#;

    let parsed: serde_json::Value = serde_json::from_str(json_data).unwrap();

    c.bench_function("cluster_health_parsing", |b| {
        b.iter(|| {
            let status_str = parsed
                .get("status")
                .and_then(|v| v.as_str())
                .unwrap_or("red");

            let status = match status_str {
                "green" => HealthStatus::Green,
                "yellow" => HealthStatus::Yellow,
                _ => HealthStatus::Red,
            };

            black_box(status)
        });
    });
}

fn bench_cluster_config_creation(c: &mut Criterion) {
    let mut group = c.benchmark_group("cluster_config_creation");

    for i in [1, 3, 5, 10] {
        group.bench_with_input(BenchmarkId::from_parameter(i), &i, |b, &i| {
            b.iter(|| {
                let nodes: Vec<String> = (0..i).map(|j| format!("http://es{}:9200", j)).collect();

                let config = ClusterConfig {
                    id: "test".to_string(),
                    name: Some("Test".to_string()),
                    nodes,
                    auth: None,
                    tls: TlsConfig::default(),
                    ..Default::default()
                };

                black_box(config)
            });
        });
    }

    group.finish();
}

fn bench_cluster_health_serialization(c: &mut Criterion) {
    let health = ClusterHealth {
        status: HealthStatus::Green,
        cluster_name: "test-cluster".to_string(),
        number_of_nodes: 5,
        number_of_data_nodes: 3,
        active_primary_shards: 100,
        active_shards: 250,
        relocating_shards: 0,
        initializing_shards: 0,
        unassigned_shards: 0,
    };

    c.bench_function("cluster_health_serialization", |b| {
        b.iter(|| {
            let json = serde_json::to_string(&health).unwrap();
            black_box(json)
        });
    });
}

criterion_group!(
    benches,
    bench_cluster_health_parsing,
    bench_cluster_config_creation,
    bench_cluster_health_serialization
);
criterion_main!(benches);
