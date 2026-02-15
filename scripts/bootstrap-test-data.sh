#!/bin/bash

# Bootstrap test data for Cerebro development
# Creates various indices with different states and configurations

ES_HOST="${ES_HOST:-http://localhost:9200}"

echo "Bootstrapping test data to $ES_HOST"
echo "========================================"

# Wait for Elasticsearch to be ready
echo "Waiting for Elasticsearch to be ready..."
until curl -s "$ES_HOST/_cluster/health" > /dev/null; do
    echo "Waiting for Elasticsearch..."
    sleep 2
done
echo "✓ Elasticsearch is ready"

# 1. Create a simple index with some documents (should be green)
echo ""
echo "Creating 'products' index..."
curl -s -X PUT "$ES_HOST/products" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "index.max_result_window": 50000
  },
  "mappings": {
    "properties": {
      "name": { "type": "text" },
      "price": { "type": "float" },
      "category": { "type": "keyword" },
      "description": { "type": "text" },
      "in_stock": { "type": "boolean" },
      "created_at": { "type": "date" }
    }
  }
}' | jq -r '.acknowledged // "error"'

# Add some documents
curl -s -X POST "$ES_HOST/products/_bulk" -H 'Content-Type: application/json' -d '
{"index":{}}
{"name":"Laptop","price":999.99,"category":"electronics","description":"High-performance laptop","in_stock":true,"created_at":"2026-01-15T10:00:00Z"}
{"index":{}}
{"name":"Mouse","price":29.99,"category":"electronics","description":"Wireless mouse","in_stock":true,"created_at":"2026-01-20T14:30:00Z"}
{"index":{}}
{"name":"Keyboard","price":79.99,"category":"electronics","description":"Mechanical keyboard","in_stock":false,"created_at":"2026-02-01T09:15:00Z"}
{"index":{}}
{"name":"Monitor","price":299.99,"category":"electronics","description":"27-inch 4K monitor","in_stock":true,"created_at":"2026-02-10T16:45:00Z"}
' > /dev/null
echo "✓ Created 'products' index with 4 documents"

# 2. Create a logs index with time-series data (should be green)
echo ""
echo "Creating 'logs-2026.02' index..."
curl -s -X PUT "$ES_HOST/logs-2026.02" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "index.refresh_interval": "5s"
  },
  "mappings": {
    "properties": {
      "timestamp": { "type": "date" },
      "level": { "type": "keyword" },
      "message": { "type": "text" },
      "service": { "type": "keyword" },
      "host": { "type": "keyword" }
    }
  }
}' | jq -r '.acknowledged // "error"'

curl -s -X POST "$ES_HOST/logs-2026.02/_bulk" -H 'Content-Type: application/json' -d '
{"index":{}}
{"timestamp":"2026-02-15T10:00:00Z","level":"INFO","message":"Application started","service":"api","host":"server-01"}
{"index":{}}
{"timestamp":"2026-02-15T10:05:00Z","level":"WARN","message":"High memory usage detected","service":"api","host":"server-01"}
{"index":{}}
{"timestamp":"2026-02-15T10:10:00Z","level":"ERROR","message":"Database connection failed","service":"api","host":"server-02"}
' > /dev/null
echo "✓ Created 'logs-2026.02' index with 3 documents"

# 3. Create a users index with nested objects (should be green)
echo ""
echo "Creating 'users' index..."
curl -s -X PUT "$ES_HOST/users" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "username": { "type": "keyword" },
      "email": { "type": "keyword" },
      "full_name": { "type": "text" },
      "age": { "type": "integer" },
      "address": {
        "properties": {
          "street": { "type": "text" },
          "city": { "type": "keyword" },
          "country": { "type": "keyword" },
          "postal_code": { "type": "keyword" }
        }
      },
      "tags": { "type": "keyword" },
      "registered_at": { "type": "date" }
    }
  }
}' | jq -r '.acknowledged // "error"'

curl -s -X POST "$ES_HOST/users/_bulk" -H 'Content-Type: application/json' -d '
{"index":{"_id":"1"}}
{"username":"alice","email":"alice@example.com","full_name":"Alice Smith","age":28,"address":{"street":"123 Main St","city":"New York","country":"USA","postal_code":"10001"},"tags":["admin","developer"],"registered_at":"2025-01-15T00:00:00Z"}
{"index":{"_id":"2"}}
{"username":"bob","email":"bob@example.com","full_name":"Bob Johnson","age":35,"address":{"street":"456 Oak Ave","city":"San Francisco","country":"USA","postal_code":"94102"},"tags":["developer"],"registered_at":"2025-03-20T00:00:00Z"}
' > /dev/null
echo "✓ Created 'users' index with 2 documents"

# 4. Create an index with replicas (will be yellow on single-node cluster)
echo ""
echo "Creating 'orders' index with replicas (will be yellow)..."
curl -s -X PUT "$ES_HOST/orders" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 2,
    "number_of_replicas": 1
  },
  "mappings": {
    "properties": {
      "order_id": { "type": "keyword" },
      "customer_id": { "type": "keyword" },
      "total": { "type": "float" },
      "status": { "type": "keyword" },
      "items": {
        "type": "nested",
        "properties": {
          "product_id": { "type": "keyword" },
          "quantity": { "type": "integer" },
          "price": { "type": "float" }
        }
      },
      "created_at": { "type": "date" }
    }
  }
}' | jq -r '.acknowledged // "error"'

curl -s -X POST "$ES_HOST/orders/_bulk" -H 'Content-Type: application/json' -d '
{"index":{"_id":"ORD-001"}}
{"order_id":"ORD-001","customer_id":"1","total":1099.98,"status":"completed","items":[{"product_id":"laptop-01","quantity":1,"price":999.99},{"product_id":"mouse-01","quantity":1,"price":29.99}],"created_at":"2026-02-10T14:30:00Z"}
{"index":{"_id":"ORD-002"}}
{"order_id":"ORD-002","customer_id":"2","total":379.98,"status":"pending","items":[{"product_id":"keyboard-01","quantity":1,"price":79.99},{"product_id":"monitor-01","quantity":1,"price":299.99}],"created_at":"2026-02-14T09:15:00Z"}
' > /dev/null
echo "✓ Created 'orders' index with 2 documents (yellow status due to replicas)"

# 5. Create a large index with custom analyzers
echo ""
echo "Creating 'articles' index with custom analyzers..."
curl -s -X PUT "$ES_HOST/articles" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0,
    "analysis": {
      "analyzer": {
        "custom_english": {
          "type": "custom",
          "tokenizer": "standard",
          "filter": ["lowercase", "english_stop", "english_stemmer"]
        }
      },
      "filter": {
        "english_stop": {
          "type": "stop",
          "stopwords": "_english_"
        },
        "english_stemmer": {
          "type": "stemmer",
          "language": "english"
        }
      }
    }
  },
  "mappings": {
    "properties": {
      "title": { 
        "type": "text",
        "analyzer": "custom_english"
      },
      "content": { 
        "type": "text",
        "analyzer": "custom_english"
      },
      "author": { "type": "keyword" },
      "published_at": { "type": "date" },
      "views": { "type": "integer" },
      "tags": { "type": "keyword" }
    }
  }
}' | jq -r '.acknowledged // "error"'

curl -s -X POST "$ES_HOST/articles/_bulk" -H 'Content-Type: application/json' -d '
{"index":{}}
{"title":"Getting Started with Elasticsearch","content":"Elasticsearch is a distributed search and analytics engine...","author":"alice","published_at":"2026-01-10T00:00:00Z","views":1250,"tags":["elasticsearch","tutorial"]}
{"index":{}}
{"title":"Advanced Query DSL","content":"Learn how to write complex queries using Elasticsearch Query DSL...","author":"bob","published_at":"2026-02-05T00:00:00Z","views":890,"tags":["elasticsearch","advanced"]}
' > /dev/null
echo "✓ Created 'articles' index with custom analyzers"

# 6. Create a closed index
echo ""
echo "Creating 'archive-2025' index (will be closed)..."
curl -s -X PUT "$ES_HOST/archive-2025" -H 'Content-Type: application/json' -d '{
  "settings": {
    "number_of_shards": 1,
    "number_of_replicas": 0
  },
  "mappings": {
    "properties": {
      "data": { "type": "text" },
      "archived_at": { "type": "date" }
    }
  }
}' | jq -r '.acknowledged // "error"'

curl -s -X POST "$ES_HOST/archive-2025/_doc" -H 'Content-Type: application/json' -d '{
  "data": "Old archived data",
  "archived_at": "2025-12-31T23:59:59Z"
}' > /dev/null

curl -s -X POST "$ES_HOST/archive-2025/_close" | jq -r '.acknowledged // "error"'
echo "✓ Created 'archive-2025' index (closed)"

# 7. Create an index template
echo ""
echo "Creating 'logs-*' index template..."
curl -s -X PUT "$ES_HOST/_index_template/logs-template" -H 'Content-Type: application/json' -d '{
  "index_patterns": ["logs-*"],
  "template": {
    "settings": {
      "number_of_shards": 1,
      "number_of_replicas": 0,
      "index.lifecycle.name": "logs-policy"
    },
    "mappings": {
      "properties": {
        "timestamp": { "type": "date" },
        "level": { "type": "keyword" },
        "message": { "type": "text" }
      }
    }
  },
  "priority": 100
}' | jq -r '.acknowledged // "error"'
echo "✓ Created 'logs-*' index template"

# 8. Create an alias
echo ""
echo "Creating 'current-logs' alias..."
curl -s -X POST "$ES_HOST/_aliases" -H 'Content-Type: application/json' -d '{
  "actions": [
    {
      "add": {
        "index": "logs-2026.02",
        "alias": "current-logs"
      }
    }
  ]
}' | jq -r '.acknowledged // "error"'
echo "✓ Created 'current-logs' alias pointing to 'logs-2026.02'"

# Summary
echo ""
echo "========================================"
echo "Bootstrap complete!"
echo ""
echo "Created indices:"
echo "  - products (green, 4 docs)"
echo "  - logs-2026.02 (green, 3 docs)"
echo "  - users (green, 2 docs)"
echo "  - orders (yellow, 2 docs, has replicas)"
echo "  - articles (green, 2 docs, custom analyzers)"
echo "  - archive-2025 (closed, 1 doc)"
echo ""
echo "Created templates:"
echo "  - logs-template (for logs-* pattern)"
echo ""
echo "Created aliases:"
echo "  - current-logs -> logs-2026.02"
echo ""
echo "Cluster health:"
curl -s "$ES_HOST/_cluster/health?pretty" | jq -r '"\(.status) - \(.number_of_nodes) node(s), \(.active_primary_shards) primary shards, \(.active_shards) total shards"'
