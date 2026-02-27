# Metrics Integration Validation Guide

This guide provides manual validation steps for the enhanced metrics UI/UX implementation using curl commands. After starting the Docker containers, follow these steps to verify the complete metrics workflow.

## Prerequisites

1. Docker Compose services running:
   - Secan backend (port 27182)
   - Elasticsearch (port 9200)
   - Prometheus (port 9090)
   - Elasticsearch Exporter (port 9114)

Start services:
```bash
docker-compose up -d
```

## Validation Steps

### 1. Verify Elasticsearch Cluster Health

Test direct connectivity to Elasticsearch:

```bash
curl -s http://localhost:9200/_cluster/health | jq .
```

Expected response:
```json
{
  "cluster_name": "secan-cluster",
  "status": "green",
  "timed_out": false,
  "number_of_nodes": 3,
  ...
}
```

### 2. Verify Elasticsearch Exporter Metrics

Check that the exporter is collecting metrics from Elasticsearch:

```bash
curl -s http://localhost:9114/metrics | head -20
```

Expected: Lines starting with `# HELP`, `# TYPE`, and Elasticsearch metrics like `elasticsearch_node_info`, `elasticsearch_indices_docs_*`, etc.

### 3. Verify Prometheus Configuration

Confirm Prometheus is scraping the Elasticsearch exporter:

```bash
curl -s http://localhost:9090/api/v1/query?query=elasticsearch_node_info | jq .
```

Expected response:
```json
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [...]
  }
}
```

### 4. Test Secan Backend - Cluster Metrics Endpoint

Fetch metrics for a cluster with default time range (last 24 hours):

```bash
curl -s "http://localhost:27182/api/clusters/prod/metrics" | jq .
```

Expected response structure:
```json
[
  {
    "cluster_id": "prod",
    "timestamp": 1708918234,
    "health": "green",
    "node_count": 3,
    "index_count": 5,
    "document_count": 1000000,
    "shard_count": 15,
    "unassigned_shards": 0,
    "memory_usage_percent": 65.5,
    "disk_usage_percent": 45.0,
    "cpu_usage_percent": 30.2
  },
  ...
]
```

### 5. Test Custom Time Range Query

Fetch metrics for a specific time range:

```bash
# Last 7 days (604800 seconds)
START=$(date -d '7 days ago' +%s)
END=$(date +%s)

curl -s "http://localhost:27182/api/clusters/prod/metrics?start=${START}&end=${END}" | jq '.[] | {timestamp, health, node_count}'
```

### 6. Test Metrics History Endpoint

Fetch historical data for heatmap visualization:

```bash
curl -s "http://localhost:27182/api/clusters/prod/metrics/history" | jq '.data[] | {date, health, node_count}'
```

Expected: Array of objects with date, health status, and node count.

### 7. Test Prometheus Validation Endpoint

Validate Prometheus endpoint connectivity:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"url": "http://prometheus:9090", "job_name": "elasticsearch"}' \
  http://localhost:27182/api/prometheus/validate | jq .
```

Expected response:
```json
{
  "status": "success",
  "message": "Successfully connected to Prometheus at http://prometheus:9090",
  "reachable": true
}
```

### 8. Test Invalid Prometheus Endpoint

Verify error handling for unreachable endpoint:

```bash
curl -X POST -H "Content-Type: application/json" \
  -d '{"url": "http://invalid:9090"}' \
  http://localhost:27182/api/prometheus/validate | jq .
```

Expected: `"reachable": false` with appropriate error message.

### 9. Verify Metrics Aggregation

Fetch cluster list and verify totals calculation:

```bash
curl -s "http://localhost:27182/api/clusters" | jq '.[] | {id, name}'
```

Then verify the dashboard displays aggregated statistics correctly.

### 10. Verify Prometheus Scrape Targets

Check that Prometheus is actively scraping metrics:

```bash
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | {labels: .labels, lastScrapeTime}'
```

Expected: Elasticsearch exporter should be listed with recent scrape times.

## Integration Test Scenarios

### Scenario 1: Metrics Flow (Prometheus → Exporter → Secan)

1. Generate load on Elasticsearch:
   ```bash
   # Create test index
   curl -X PUT http://localhost:9200/test-index
   
   # Add documents
   for i in {1..1000}; do
     curl -X POST "http://localhost:9200/test-index/_doc" \
       -H 'Content-Type: application/json' \
       -d '{"field": "value'$i'"}'
   done
   ```

2. Wait 30 seconds for Prometheus scrape interval

3. Query metrics:
   ```bash
   curl -s "http://localhost:27182/api/clusters/prod/metrics" | jq '.[0] | {node_count, index_count, document_count}'
   ```

4. Verify increased counts

### Scenario 2: Tab Persistence Validation

1. Open Secan UI in browser at http://localhost:27182
2. Navigate to a cluster view on the "Statistics" tab
3. Click to another cluster
4. Verify the "Statistics" tab is still active
5. Return to first cluster
6. Verify "Statistics" tab remains active

### Scenario 3: Copy Button Validation

1. Navigate to a cluster view
2. Go to "Indices" or "Shards" tab
3. Click copy button on a field (index name, shard ID, etc.)
4. Verify toast notification "Copied!" appears
5. Paste clipboard content and verify correctness

### Scenario 4: Sorting Validation

1. In Indices tab, click "Name" header
2. Verify list sorts alphabetically
3. Click again to reverse sort (Z to A)
4. Click a third time to remove sort
5. Repeat for other sortable columns (Health, Documents, Size)

### Scenario 5: Cluster Totals Calculation

1. View Dashboard page
2. Verify "TOTAL" row at bottom of cluster table
3. Manually sum node counts and verify total matches
4. Repeat for shards, indices, and documents

### Scenario 6: Caching and Refresh

1. View Dashboard
2. Note a metric value
3. Wait 30 seconds without interaction
4. Reload page in same browser tab
5. Verify cached data appears immediately
6. Wait for background refresh
7. Verify metrics update if changed

### Scenario 7: Error Handling

1. Stop Prometheus container:
   ```bash
   docker-compose stop prometheus
   ```

2. Try fetching metrics:
   ```bash
   curl -s "http://localhost:27182/api/clusters/prod/metrics"
   ```

3. Verify appropriate error response
4. Restart Prometheus:
   ```bash
   docker-compose start prometheus
   ```

### Scenario 8: Health Indicator Updates

1. View drawer navigation
2. Observe cluster health indicators (colored dots)
3. Check health status in cluster stats:
   ```bash
   curl -s http://localhost:9200/_cluster/health | jq '.status'
   ```
4. Verify indicator color matches health status (green/yellow/red)

## Performance Validation

### Metrics Query Performance

Measure response time for metrics endpoint:

```bash
time curl -s "http://localhost:27182/api/clusters/prod/metrics" > /dev/null
```

Expected: < 500ms for local Elasticsearch

### Bulk History Query

Fetch a large historical dataset:

```bash
START=$(date -d '30 days ago' +%s)
END=$(date +%s)

time curl -s "http://localhost:27182/api/clusters/prod/metrics/history?start=${START}&end=${END}" | jq '.data | length'
```

Expected: < 1s response time, handles 720+ data points (hourly for 30 days)

### Concurrent Requests

Simulate multiple metrics queries:

```bash
for i in {1..10}; do
  curl -s "http://localhost:27182/api/clusters/prod/metrics" > /dev/null &
done
wait
```

Expected: All requests complete successfully without errors

## Cleanup

After validation, stop Docker services:

```bash
docker-compose down
```

To remove volumes and start fresh:

```bash
docker-compose down -v
```

## Troubleshooting

### Prometheus Connection Issues

Check Prometheus logs:
```bash
docker-compose logs prometheus
```

Verify network connectivity:
```bash
docker-compose exec secan curl -v http://prometheus:9090/_/healthy
```

### Elasticsearch Exporter Not Scraping

Check exporter logs:
```bash
docker-compose logs elasticsearch-exporter
```

Verify Elasticsearch is healthy:
```bash
docker-compose exec elasticsearch-exporter curl -s http://es01:9200/_cluster/health
```

### No Metrics Data

1. Verify Prometheus has data:
   ```bash
   curl -s 'http://localhost:9090/api/v1/query?query=elasticsearch_node_info' | jq '.data.result | length'
   ```

2. Check that scrape interval has passed (default 15 seconds)

3. Verify time range in request is within Prometheus retention (default 15 days)

## Test Fixtures and Mock Data

For testing without live Elasticsearch/Prometheus, use mock responses as defined in:
- `frontend/src/modules/statistics/__tests__/metrics-integration.test.tsx`
- `frontend/src/api/__tests__/metrics-api.test.ts`
- `tests/metrics_integration_test.rs`
