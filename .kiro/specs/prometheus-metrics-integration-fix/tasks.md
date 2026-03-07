# Implementation Plan

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Prometheus Metrics Integration Failure
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases - Prometheus configured as metrics source with elasticsearch_exporter metrics
  - Test that when Prometheus is configured as metrics source, the system fetches metrics using correct elasticsearch_exporter metric names:
    - `elasticsearch_os_cpu_percent{}` for CPU usage
    - `elasticsearch_os_load1{}`, `elasticsearch_os_load5{}`, `elasticsearch_os_load15{}` for load averages
    - `elasticsearch_os_mem_actual_free_bytes{}`, `elasticsearch_os_mem_actual_used_bytes{}`, `elasticsearch_os_mem_free_bytes{}`, `elasticsearch_os_mem_used_bytes{}` for memory stats
  - Test that nodes list view displays these metrics correctly
  - Test that cluster overview page aggregates these metrics correctly
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct - it proves the bug exists)
  - Document counterexamples found (e.g., "nodes list shows no CPU metrics", "incorrect metric names used", "queries wrong data source")
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-Prometheus Metrics Sources and Non-Metric Data
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (when Prometheus is NOT configured as metrics source)
  - Test that when Prometheus is NOT configured, the system continues to fetch metrics from existing data source (direct Elasticsearch APIs)
  - Test that nodes list view continues to display non-metric information (node name, roles, version) correctly regardless of metrics source
  - Test that cluster overview page continues to display non-metric information (cluster name, status, shard counts) correctly regardless of metrics source
  - Test that switching between clusters continues to fetch metrics from appropriate source for each cluster
  - Test that when Prometheus is unavailable or returns errors, the system handles errors gracefully without crashing
  - Write property-based tests capturing observed behavior patterns from Preservation Requirements
  - Property-based testing generates many test cases for stronger guarantees
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (this confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [ ] 3. Fix Prometheus metrics integration

  - [x] 3.1 Update metrics integration layer to use correct elasticsearch_exporter metric names
    - Update Prometheus query builder to use `elasticsearch_os_cpu_percent{}` for CPU usage
    - Update Prometheus query builder to use `elasticsearch_os_load1{}`, `elasticsearch_os_load5{}`, `elasticsearch_os_load15{}` for load averages
    - Update Prometheus query builder to use `elasticsearch_os_mem_actual_free_bytes{}`, `elasticsearch_os_mem_actual_used_bytes{}`, `elasticsearch_os_mem_free_bytes{}`, `elasticsearch_os_mem_used_bytes{}` for memory statistics
    - Ensure queries target Prometheus as the data source when configured
    - _Bug_Condition: isBugCondition(config) where config.metricsSource === "prometheus"_
    - _Expected_Behavior: System fetches metrics using correct elasticsearch_exporter metric names from Prometheus (2.1, 2.2, 2.3, 2.4)_
    - _Preservation: Non-Prometheus metrics sources continue to work (3.1), non-metric data displays correctly (3.2, 3.3), cluster switching works (3.4), error handling preserved (3.5)_
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 3.4, 3.5_

  - [-] 3.2 Update nodes list view to display Prometheus metrics
    - Integrate metrics fetching with nodes list component
    - Display CPU usage, load averages, and memory statistics from Prometheus
    - Handle cases where metrics are unavailable or incomplete
    - Ensure non-metric information (node name, roles, version) continues to display
    - _Bug_Condition: isBugCondition(config) where config.metricsSource === "prometheus" AND view === "nodesList"_
    - _Expected_Behavior: Nodes list displays correct metrics from elasticsearch_exporter (2.1)_
    - _Preservation: Non-metric information displays correctly (3.2)_
    - _Requirements: 1.1, 2.1, 3.2_

  - [~] 3.3 Update cluster overview page to aggregate and display Prometheus metrics
    - Integrate metrics fetching with cluster overview component
    - Aggregate node metrics across all nodes in the cluster
    - Display aggregated CPU, load, and memory statistics
    - Ensure non-metric information (cluster name, status, shard counts) continues to display
    - _Bug_Condition: isBugCondition(config) where config.metricsSource === "prometheus" AND view === "clusterOverview"_
    - _Expected_Behavior: Cluster overview displays aggregated metrics from elasticsearch_exporter (2.2)_
    - _Preservation: Non-metric information displays correctly (3.3)_
    - _Requirements: 1.2, 2.2, 3.3_

  - [~] 3.4 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Prometheus Metrics Integration Works
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior
    - When this test passes, it confirms the expected behavior is satisfied
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - Verify nodes list displays correct metrics from elasticsearch_exporter
    - Verify cluster overview displays aggregated metrics correctly
    - Verify correct metric names are used in Prometheus queries
    - _Requirements: 2.1, 2.2, 2.3, 2.4_

  - [~] 3.5 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-Prometheus Sources and Non-Metric Data Preserved
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm non-Prometheus metrics sources still work
    - Confirm non-metric information displays correctly
    - Confirm cluster switching works correctly
    - Confirm error handling works gracefully
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [~] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise
  - Verify nodes list view displays Prometheus metrics correctly
  - Verify cluster overview page displays aggregated Prometheus metrics correctly
  - Verify non-Prometheus metrics sources continue to work
  - Verify error handling works gracefully when Prometheus is unavailable
