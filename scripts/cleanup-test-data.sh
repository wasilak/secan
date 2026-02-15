#!/bin/bash

# Cleanup test data created by bootstrap-test-data.sh

ES_HOST="${ES_HOST:-http://localhost:9200}"

echo "Cleaning up test data from $ES_HOST"
echo "========================================"

# Delete all test indices
echo "Deleting test indices..."
curl -s -X DELETE "$ES_HOST/products" > /dev/null 2>&1
curl -s -X DELETE "$ES_HOST/logs-2026.02" > /dev/null 2>&1
curl -s -X DELETE "$ES_HOST/users" > /dev/null 2>&1
curl -s -X DELETE "$ES_HOST/orders" > /dev/null 2>&1
curl -s -X DELETE "$ES_HOST/articles" > /dev/null 2>&1
curl -s -X DELETE "$ES_HOST/archive-2025" > /dev/null 2>&1
echo "✓ Deleted test indices"

# Delete index template
echo "Deleting index template..."
curl -s -X DELETE "$ES_HOST/_index_template/logs-template" > /dev/null 2>&1
echo "✓ Deleted index template"

echo ""
echo "Cleanup complete!"
