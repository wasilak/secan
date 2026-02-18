#!/bin/bash

# Bootstrap test data in Elasticsearch cluster
# Creates indices with various shard configurations to demonstrate different cluster states

set -e

ES_HOST="${ES_HOST:-http://localhost:9200}"

echo "Bootstrapping test data to Elasticsearch at $ES_HOST"
echo "=================================================="

# Wait for cluster to be ready
echo "Waiting for cluster to be ready..."
until curl -s "$ES_HOST/_cluster/health" > /dev/null; do
  echo "Waiting for Elasticsearch..."
  sleep 2
done
echo "✓ Cluster is ready"

# Create green indices (1 replica, can be allocated across 3 nodes)
echo ""
echo "Creating green indices..."

# Products index - 3 primary shards, 1 replica
curl -s -X PUT "$ES_HOST/products" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "name": { "type": "text" },
      "price": { "type": "float" },
      "category": { "type": "keyword" },
      "in_stock": { "type": "boolean" }
    }
  }
}' > /dev/null
echo "✓ Created 'products' index (3 shards, 1 replica)"

# Customers index - 2 primary shards, 1 replica
curl -s -X PUT "$ES_HOST/customers" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "name": { "type": "text" },
      "email": { "type": "keyword" },
      "created_at": { "type": "date" }
    }
  }
}' > /dev/null
echo "✓ Created 'customers' index (2 shards, 1 replica)"

# Orders index - 5 primary shards, 1 replica
curl -s -X PUT "$ES_HOST/orders" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 5,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "order_id": { "type": "keyword" },
      "customer_id": { "type": "keyword" },
      "total": { "type": "float" },
      "status": { "type": "keyword" },
      "created_at": { "type": "date" }
    }
  }
}' > /dev/null
echo "✓ Created 'orders' index (5 shards, 1 replica)"

# Create yellow indices (2+ replicas, cannot fully allocate with only 3 nodes)
echo ""
echo "Creating yellow indices..."

# Logs index - 3 primary shards, 3 replicas (will be yellow - needs 4 nodes)
curl -s -X PUT "$ES_HOST/logs-2024" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 3
  },
  "mappings": {
    "properties": {
      "timestamp": { "type": "date" },
      "level": { "type": "keyword" },
      "message": { "type": "text" },
      "service": { "type": "keyword" }
    }
  }
}' > /dev/null
echo "✓ Created 'logs-2024' index (3 shards, 3 replicas - will be YELLOW)"

# Metrics index - 4 primary shards, 3 replicas (will be yellow - needs 4 nodes)
curl -s -X PUT "$ES_HOST/metrics" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 4,
    "number_of_replicas": 3
  },
  "mappings": {
    "properties": {
      "timestamp": { "type": "date" },
      "metric_name": { "type": "keyword" },
      "value": { "type": "float" },
      "tags": { "type": "object" }
    }
  }
}' > /dev/null
echo "✓ Created 'metrics' index (4 shards, 3 replicas - will be YELLOW)"

# Add some sample documents
echo ""
echo "Adding sample documents..."

# Add products
curl -s -X POST "$ES_HOST/products/_doc" -H 'Content-Type: application/json' -d '{
  "name": "Laptop",
  "price": 999.99,
  "category": "electronics",
  "in_stock": true
}' > /dev/null

curl -s -X POST "$ES_HOST/products/_doc" -H 'Content-Type: application/json' -d '{
  "name": "Mouse",
  "price": 29.99,
  "category": "electronics",
  "in_stock": true
}' > /dev/null

curl -s -X POST "$ES_HOST/products/_doc" -H 'Content-Type: application/json' -d '{
  "name": "Keyboard",
  "price": 79.99,
  "category": "electronics",
  "in_stock": false
}' > /dev/null

echo "✓ Added 3 sample products"

# Add customers
curl -s -X POST "$ES_HOST/customers/_doc" -H 'Content-Type: application/json' -d '{
  "name": "John Doe",
  "email": "john@example.com",
  "created_at": "2024-01-15T10:30:00Z"
}' > /dev/null

curl -s -X POST "$ES_HOST/customers/_doc" -H 'Content-Type: application/json' -d '{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "created_at": "2024-02-20T14:45:00Z"
}' > /dev/null

echo "✓ Added 2 sample customers"

# Add orders
curl -s -X POST "$ES_HOST/orders/_doc" -H 'Content-Type: application/json' -d '{
  "order_id": "ORD-001",
  "customer_id": "CUST-001",
  "total": 1029.98,
  "status": "completed",
  "created_at": "2024-03-01T09:15:00Z"
}' > /dev/null

curl -s -X POST "$ES_HOST/orders/_doc" -H 'Content-Type: application/json' -d '{
  "order_id": "ORD-002",
  "customer_id": "CUST-002",
  "total": 79.99,
  "status": "pending",
  "created_at": "2024-03-05T16:20:00Z"
}' > /dev/null

echo "✓ Added 2 sample orders"

# Add logs
curl -s -X POST "$ES_HOST/logs-2024/_doc" -H 'Content-Type: application/json' -d '{
  "timestamp": "2024-03-10T12:00:00Z",
  "level": "INFO",
  "message": "Application started successfully",
  "service": "api"
}' > /dev/null

curl -s -X POST "$ES_HOST/logs-2024/_doc" -H 'Content-Type: application/json' -d '{
  "timestamp": "2024-03-10T12:05:00Z",
  "level": "ERROR",
  "message": "Database connection failed",
  "service": "api"
}' > /dev/null

echo "✓ Added 2 sample log entries"

# Add metrics
curl -s -X POST "$ES_HOST/metrics/_doc" -H 'Content-Type: application/json' -d '{
  "timestamp": "2024-03-10T12:00:00Z",
  "metric_name": "cpu_usage",
  "value": 45.2,
  "tags": { "host": "server-01" }
}' > /dev/null

curl -s -X POST "$ES_HOST/metrics/_doc" -H 'Content-Type: application/json' -d '{
  "timestamp": "2024-03-10T12:01:00Z",
  "metric_name": "memory_usage",
  "value": 78.5,
  "tags": { "host": "server-01" }
}' > /dev/null

echo "✓ Added 2 sample metrics"

# Wait a moment for indexing
sleep 2

# Show cluster health
echo ""
echo "=================================================="
echo "Cluster Health:"
curl -s "$ES_HOST/_cluster/health?pretty" | grep -E "(status|number_of_nodes|active_primary_shards|active_shards|unassigned_shards)"

echo ""
echo "=================================================="
echo "✓ Bootstrap complete!"
echo ""
echo "Created indices:"
echo "  - products (3 shards, 1 replica) - GREEN"
echo "  - customers (2 shards, 1 replica) - GREEN"
echo "  - orders (5 shards, 1 replica) - GREEN"
echo "  - logs-2024 (3 shards, 3 replicas) - YELLOW"
echo "  - metrics (4 shards, 3 replicas) - YELLOW"
echo ""
echo "Overall cluster status should be YELLOW due to unassigned replicas"
