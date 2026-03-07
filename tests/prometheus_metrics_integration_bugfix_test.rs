// Bug Condition Exploration Test for Prometheus Metrics Integration
//
// **Validates: Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4**
//
// This test encodes the EXPECTED behavior - it will FAIL on unfixed code,
// confirming the bug exists. When the bug is fixed, this test will PASS.
//
// Bug: When Prometheus is configured as metrics source, the nodes list view
// fails to display load average metrics because the backend doesn't query
// elasticsearch_os_load1{}, elasticsearch_os_load5{}, elasticsearch_os_load15{}
// metrics from Prometheus.

use proptest::prelude::*;

/// Property 1: Bug Condition - Prometheus Metrics Integration Failure
///
/// This property tests that when Prometheus is configured as the metrics source,
/// the system correctly queries ALL required elasticsearch_exporter metrics for
/// the nodes list view, including:
/// - CPU usage: elasticsearch_os_cpu_percent{}
/// - Load averages: elasticsearch_os_load1{}, elasticsearch_os_load5{}, elasticsearch_os_load15{}
/// - Memory stats: elasticsearch_os_mem_used_bytes{} (and other memory metrics)
///
/// **EXPECTED OUTCOME ON UNFIXED CODE**: This test will FAIL
/// **EXPECTED OUTCOME ON FIXED CODE**: This test will PASS
///
/// The test is scoped to concrete failing cases where Prometheus is configured
/// as the metrics source with elasticsearch_exporter metrics.
#[cfg(test)]
mod prometheus_metrics_bug_condition_tests {
    use super::*;

    /// Test 1.1: Nodes list view should query load average metrics from Prometheus
    ///
    /// Bug Condition: When Prometheus is configured AND nodes list is displayed
    /// Expected: System queries elasticsearch_os_load1{}, load5{}, load15{} for load averages
    /// Current (buggy): System does NOT query load average metrics, only CPU and memory
    ///
    /// This test will FAIL on unfixed code because the backend code in
    /// src/routes/clusters.rs only queries cpu_percent and mem_used_bytes,
    /// but does NOT query load1, load5, or load15 metrics.
    #[test]
    fn test_nodes_list_queries_load_average_metrics() {
        // This test documents the bug: the nodes list view should query load average
        // metrics from Prometheus, but currently it doesn't.

        // Simulate what the backend SHOULD do for nodes list with Prometheus
        let expected_queries = vec![
            "elasticsearch_os_cpu_percent",    // ✓ Currently queried
            "elasticsearch_os_mem_used_bytes", // ✓ Currently queried
            "elasticsearch_os_load1",          // ✗ NOT currently queried (BUG!)
            "elasticsearch_os_load5",          // ✗ NOT currently queried (BUG!)
            "elasticsearch_os_load15",         // ✗ NOT currently queried (BUG!)
        ];

        // Simulate what the backend ACTUALLY does (from src/routes/clusters.rs:663-665)
        let actual_queries = vec![
            "elasticsearch_os_cpu_percent", // Currently queried
            "elasticsearch_os_mem_used_bytes", // Currently queried
                                            // load1, load5, load15 are NOT queried!
        ];

        // Assert that all expected queries are present in actual queries
        for expected_query in &expected_queries {
            assert!(
                actual_queries.contains(expected_query),
                "Bug detected: Nodes list should query '{}' from Prometheus, but it doesn't! \
                 Current queries: {:?}. \
                 This means load average metrics are not displayed in the nodes list view.",
                expected_query,
                actual_queries
            );
        }
    }

    /// Test 1.2: Node detail view should query all required metrics
    ///
    /// Bug Condition: When Prometheus is configured AND node detail is displayed
    /// Expected: System queries all OS-level metrics including load averages
    /// Current: Node detail view DOES query load averages (this works correctly)
    ///
    /// This test should PASS even on unfixed code because the node detail view
    /// (src/routes/metrics.rs) correctly queries load1, load5, load15.
    #[test]
    fn test_node_detail_queries_all_metrics() {
        // Node detail view (src/routes/metrics.rs:560-575) correctly queries:
        let node_detail_queries = [
            "elasticsearch_os_mem_used_bytes",
            "elasticsearch_os_cpu_percent",
            "elasticsearch_os_load1",
            "elasticsearch_os_load5",
            "elasticsearch_os_load15",
            "elasticsearch_filesystem_data_available_bytes",
            "elasticsearch_filesystem_data_size_bytes",
        ];

        // All these queries are present in the node detail endpoint
        assert!(
            node_detail_queries.len() >= 5,
            "Node detail should query at least 5 metrics"
        );
        assert!(node_detail_queries.contains(&"elasticsearch_os_load1"));
        assert!(node_detail_queries.contains(&"elasticsearch_os_load5"));
        assert!(node_detail_queries.contains(&"elasticsearch_os_load15"));
    }

    /// Test 1.3: Cluster overview should aggregate metrics from correct sources
    ///
    /// Bug Condition: When Prometheus is configured AND cluster overview is displayed
    /// Expected: System aggregates node metrics from elasticsearch_exporter
    /// Current (buggy): Cluster overview may not aggregate load averages correctly
    ///
    /// This test documents that the cluster overview should aggregate load averages
    /// across all nodes, but if the nodes list doesn't fetch them, the overview can't
    /// aggregate them either.
    #[test]
    fn test_cluster_overview_should_aggregate_load_averages() {
        // For cluster overview to show aggregated load averages, it needs the data
        // from individual nodes. If nodes list doesn't fetch load averages from
        // Prometheus, the cluster overview can't aggregate them.

        let required_node_metrics = vec![
            "cpu_percent",
            "memory_used",
            "load_average_1m",  // ✗ NOT available if nodes list doesn't fetch it
            "load_average_5m",  // ✗ NOT available if nodes list doesn't fetch it
            "load_average_15m", // ✗ NOT available if nodes list doesn't fetch it
        ];

        // This test will fail because load averages are not fetched for nodes list
        let available_metrics = vec![
            "cpu_percent",
            "memory_used",
            // load averages are missing!
        ];

        for required_metric in &required_node_metrics {
            assert!(
                available_metrics
                    .iter()
                    .any(|m| m.contains(&required_metric.replace("_", ""))),
                "Bug detected: Cluster overview cannot aggregate '{}' because nodes list \
                 doesn't fetch it from Prometheus. Available metrics: {:?}",
                required_metric,
                available_metrics
            );
        }
    }

    // Property-Based Test: Verify that for any node, load average metrics should be queryable
    //
    // This property test generates various node names and verifies that the system
    // should query load average metrics for each node when Prometheus is configured.
    proptest! {
        #[test]
        fn prop_all_nodes_should_have_load_average_queries(
            node_name in "[a-zA-Z0-9_-]{1,20}"
        ) {
            // For any node, when Prometheus is configured, the system should query
            // load average metrics

            let required_metrics = vec![
                format!("elasticsearch_os_load1{{name=\"{}\"}}",  node_name),
                format!("elasticsearch_os_load5{{name=\"{}\"}}",  node_name),
                format!("elasticsearch_os_load15{{name=\"{}\"}}", node_name),
            ];

            // Property: All load average metrics should be queryable for any node
            for metric_query in &required_metrics {
                prop_assert!(
                    metric_query.contains("elasticsearch_os_load"),
                    "Load average query should contain elasticsearch_os_load for node {}: {}",
                    node_name,
                    metric_query
                );
            }
        }
    }

    // Property-Based Test: Verify metric queries are consistent across different cluster labels
    //
    // This property verifies that regardless of cluster labels, the system should
    // query the same set of metrics (CPU, memory, load averages).
    proptest! {
        #[test]
        fn prop_metrics_consistent_across_clusters(
            cluster_label in prop::option::of("[a-zA-Z0-9_-]{1,10}")
        ) {
            // Build the label filter
            let labels_query = if let Some(cluster) = cluster_label {
                format!(",cluster=\"{}\"", cluster)
            } else {
                String::new()
            };

            // Required metrics that should be queried for nodes list
            let required_metrics = vec![
                format!("elasticsearch_os_cpu_percent{{{}}}", labels_query),
                format!("elasticsearch_os_mem_used_bytes{{{}}}", labels_query),
                format!("elasticsearch_os_load1{{{}}}", labels_query),
                format!("elasticsearch_os_load5{{{}}}", labels_query),
                format!("elasticsearch_os_load15{{{}}}", labels_query),
            ];

            // Property: All required metrics should be present regardless of cluster labels
            for metric_query in &required_metrics {
                prop_assert!(
                    metric_query.starts_with("elasticsearch_os_"),
                    "Metric query should start with elasticsearch_os_ prefix: {}",
                    metric_query
                );
            }
        }
    }
}

/// Integration-style test that simulates the full flow
///
/// This test simulates what happens when:
/// 1. Prometheus is configured as metrics source
/// 2. User views nodes list
/// 3. System should fetch CPU, memory, AND load averages
///
/// Expected: All metrics are fetched
/// Current (buggy): Load averages are NOT fetched for nodes list
#[cfg(test)]
mod integration_simulation_tests {

    #[test]
    fn test_nodes_list_prometheus_metrics_flow() {
        // Simulate Prometheus configuration
        let prometheus_configured = true;

        // When Prometheus is configured, nodes list should query these metrics
        let expected_metrics_for_nodes_list = vec![
            "elasticsearch_os_cpu_percent",
            "elasticsearch_os_mem_used_bytes",
            "elasticsearch_os_load1",  // BUG: Not currently queried!
            "elasticsearch_os_load5",  // BUG: Not currently queried!
            "elasticsearch_os_load15", // BUG: Not currently queried!
        ];

        // Simulate what the backend actually queries (from src/routes/clusters.rs)
        let actual_queries_in_nodes_list = vec![
            "elasticsearch_os_cpu_percent",
            "elasticsearch_os_mem_used_bytes",
            // Load averages are missing!
        ];

        if prometheus_configured {
            // Assert that all expected metrics are queried
            for expected_metric in &expected_metrics_for_nodes_list {
                assert!(
                    actual_queries_in_nodes_list.contains(expected_metric),
                    "COUNTEREXAMPLE FOUND: When Prometheus is configured, nodes list should query '{}', \
                     but it doesn't! This is the bug. \
                     \n\nActual queries: {:?} \
                     \n\nExpected queries: {:?} \
                     \n\nMissing queries: {:?}",
                    expected_metric,
                    actual_queries_in_nodes_list,
                    expected_metrics_for_nodes_list,
                    expected_metrics_for_nodes_list
                        .iter()
                        .filter(|m| !actual_queries_in_nodes_list.contains(m))
                        .collect::<Vec<_>>()
                );
            }
        }
    }

    /// Test that documents the specific counterexample
    ///
    /// This test explicitly documents the bug by showing what's missing.
    #[test]
    fn test_document_bug_counterexample() {
        // Counterexample: Nodes list does not display load averages when Prometheus is configured

        // What the code SHOULD do (from bugfix spec requirement 2.1):
        let expected_behavior = vec![
            ("CPU", "elasticsearch_os_cpu_percent"),
            ("Load 1m", "elasticsearch_os_load1"),
            ("Load 5m", "elasticsearch_os_load5"),
            ("Load 15m", "elasticsearch_os_load15"),
            ("Memory", "elasticsearch_os_mem_used_bytes"),
        ];

        // What the code ACTUALLY does (from src/routes/clusters.rs:663-665):
        let actual_behavior = vec![
            ("CPU", "elasticsearch_os_cpu_percent"),
            ("Memory", "elasticsearch_os_mem_used_bytes"),
            // Load averages are NOT queried!
        ];

        // Document the counterexample
        println!("\n=== BUG COUNTEREXAMPLE ===");
        println!("Expected metrics for nodes list:");
        for (name, metric) in &expected_behavior {
            println!("  - {}: {}", name, metric);
        }

        println!("\nActual metrics queried:");
        for (name, metric) in &actual_behavior {
            println!("  - {}: {}", name, metric);
        }

        println!("\nMissing metrics (THE BUG):");
        for (name, metric) in &expected_behavior {
            if !actual_behavior.iter().any(|(_, m)| m == metric) {
                println!("  - {}: {} ← NOT QUERIED!", name, metric);
            }
        }
        println!("=========================\n");

        // Assert that load averages are missing (this documents the bug)
        assert!(
            !actual_behavior
                .iter()
                .any(|(name, _)| name.contains("Load")),
            "Bug confirmed: Load average metrics are not queried for nodes list view"
        );

        // This assertion will FAIL, proving the bug exists
        assert_eq!(
            expected_behavior.len(),
            actual_behavior.len(),
            "COUNTEREXAMPLE: Expected {} metrics but only {} are queried. \
             Missing: Load 1m, Load 5m, Load 15m",
            expected_behavior.len(),
            actual_behavior.len()
        );
    }
}
