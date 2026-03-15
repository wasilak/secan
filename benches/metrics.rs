use criterion::{black_box, criterion_group, criterion_main, Criterion};
use secan::cluster::HealthStatus;
use secan::metrics::service::{ClusterMetrics, MetricPoint};
use secan::metrics::TimeRange;

fn bench_time_range_creation(c: &mut Criterion) {
    c.bench_function("time_range_last_24h", |b| {
        b.iter(|| {
            let range = TimeRange::last_24_hours();
            black_box(range)
        });
    });

    c.bench_function("time_range_last_7_days", |b| {
        b.iter(|| {
            let range = TimeRange::last_7_days();
            black_box(range)
        });
    });
}

fn bench_metrics_serialization(c: &mut Criterion) {
    let metrics = ClusterMetrics {
        cluster_id: "test-cluster".to_string(),
        time_range: Some(TimeRange::last_24_hours()),
        jvm_memory_used_bytes: Some(vec![MetricPoint::new(1000, 1_000_000_000.0)]),
        jvm_memory_max_bytes: Some(vec![MetricPoint::new(1000, 2_000_000_000.0)]),
        gc_collection_time_ms: Some(vec![MetricPoint::new(1000, 100.0)]),
        index_rate: Some(vec![MetricPoint::new(1000, 50.0)]),
        query_rate: Some(vec![MetricPoint::new(1000, 100.0)]),
        disk_used_bytes: Some(vec![MetricPoint::new(1000, 500_000_000_000.0)]),
        cpu_usage_percent: Some(vec![MetricPoint::new(1000, 75.0)]),
        network_bytes_in: Some(vec![MetricPoint::new(1000, 1_000_000.0)]),
        network_bytes_out: Some(vec![MetricPoint::new(1000, 2_000_000.0)]),
        health_status: Some(HealthStatus::Green),
        node_count: Some(5),
        shard_count: Some(50),
        index_count: Some(20),
        document_count: Some(1_000_000),
        unassigned_shards: Some(0),
        relocating_shards: Some(0),
        initializing_shards: Some(0),
        prometheus_queries: None,
    };

    c.bench_function("metrics_serialization", |b| {
        b.iter(|| {
            let json = serde_json::to_string(&metrics).unwrap();
            black_box(json)
        });
    });
}

fn bench_metrics_aggregation(c: &mut Criterion) {
    let node_counts = vec![3, 5, 2, 4];
    let shard_counts = vec![50, 30, 20, 100];
    let doc_counts = vec![1_000_000, 2_000_000, 500_000, 3_000_000];

    c.bench_function("metrics_node_count_aggregation", |b| {
        b.iter(|| {
            let total: u32 = node_counts.iter().sum();
            black_box(total)
        });
    });

    c.bench_function("metrics_shard_count_aggregation", |b| {
        b.iter(|| {
            let total: u32 = shard_counts.iter().sum();
            black_box(total)
        });
    });

    c.bench_function("metrics_document_count_aggregation", |b| {
        b.iter(|| {
            let total: u64 = doc_counts.iter().sum();
            black_box(total)
        });
    });
}

criterion_group!(
    benches,
    bench_time_range_creation,
    bench_metrics_serialization,
    bench_metrics_aggregation
);
criterion_main!(benches);
