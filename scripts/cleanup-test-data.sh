#!/bin/bash

# Clean up test data from Elasticsearch cluster
# Deletes all test indices created by bootstrap-test-data.sh

set -e

ES_HOST="${ES_HOST:-http://localhost:9200}"

echo "Cleaning up test data from Elasticsearch at $ES_HOST"
echo "=================================================="

# List of test indices to delete
INDICES=(
  "products"
  "customers"
  "orders"
  "logs-2024"
  "metrics"
)

# Delete each index
for index in "${INDICES[@]}"; do
  if curl -s -f "$ES_HOST/$index" > /dev/null 2>&1; then
    curl -s -X DELETE "$ES_HOST/$index" > /dev/null
    echo "✓ Deleted '$index' index"
  else
    echo "⊘ Index '$index' does not exist (skipping)"
  fi
done

echo ""
echo "=================================================="
echo "✓ Cleanup complete!"
echo ""
echo "Cluster should now be empty (status: GREEN)"
