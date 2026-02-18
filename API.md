# Secan API Reference

## Overview

Secan provides a RESTful API for managing Elasticsearch clusters. All API endpoints are prefixed with `/api`.

## Authentication

API authentication depends on the configured authentication mode:

- **Open Mode**: No authentication required
- **Local Users Mode**: Session-based authentication with cookies
- **OIDC Mode**: Session-based authentication with OIDC tokens

### Session Management

After successful authentication, a session cookie is set:
- Cookie name: `secan_session`
- HttpOnly: Yes
- Secure: Yes (in production)
- SameSite: Lax

## Base URL

```
http://localhost:8080/api
```

## Response Format

All API responses use JSON format.

### Success Response

```json
{
  "data": { ... }
}
```

### Error Response

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

## Endpoints

### Clusters

#### List Clusters

Get a list of all configured clusters.

**Endpoint:** `GET /api/clusters`

**Authentication:** Required (except in open mode)

**Response:**

```json
[
  {
    "id": "local",
    "name": "Local Development",
    "nodes": ["http://localhost:9200"]
  }
]
```

**Status Codes:**
- `200 OK`: Success
- `401 Unauthorized`: Authentication required
- `500 Internal Server Error`: Server error

---

#### Get Cluster Statistics

Get cluster health and statistics.

**Endpoint:** `GET /api/clusters/:cluster_id/stats`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier

**Response:**

```json
{
  "health": "green",
  "cluster_name": "my-cluster",
  "number_of_nodes": 3,
  "number_of_data_nodes": 3,
  "active_primary_shards": 10,
  "active_shards": 20,
  "relocating_shards": 0,
  "initializing_shards": 0,
  "unassigned_shards": 0,
  "number_of_pending_tasks": 0,
  "number_of_in_flight_fetch": 0,
  "task_max_waiting_in_queue_millis": 0,
  "active_shards_percent_as_number": 100.0
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid cluster ID
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Cluster not found
- `500 Internal Server Error`: Server error

---

#### Get Nodes

Get information about all nodes in the cluster.

**Endpoint:** `GET /api/clusters/:cluster_id/nodes`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier

**Response:**

```json
[
  {
    "id": "node-1-id",
    "name": "node-1",
    "ip": "10.0.0.1",
    "master": true,
    "roles": ["master", "data", "ingest"],
    "heap": {
      "used_percent": 45,
      "used_bytes": 1073741824,
      "max_bytes": 2147483648
    },
    "disk": {
      "used_percent": 60,
      "used_bytes": 107374182400,
      "total_bytes": 178956970240
    },
    "cpu_percent": 15,
    "load_average": [1.5, 1.2, 1.0]
  }
]
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid cluster ID
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Cluster not found
- `500 Internal Server Error`: Server error

---

#### Get Node Details

Get detailed statistics for a specific node.

**Endpoint:** `GET /api/clusters/:cluster_id/nodes/:node_id`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier
- `node_id` (string): Node identifier

**Response:**

```json
{
  "id": "node-1-id",
  "name": "node-1",
  "ip": "10.0.0.1",
  "master": true,
  "roles": ["master", "data", "ingest"],
  "heap": {
    "used_percent": 45,
    "used_bytes": 1073741824,
    "max_bytes": 2147483648
  },
  "disk": {
    "used_percent": 60,
    "used_bytes": 107374182400,
    "total_bytes": 178956970240
  },
  "cpu_percent": 15,
  "load_average": [1.5, 1.2, 1.0],
  "thread_pools": {
    "search": {
      "active": 5,
      "queue": 0,
      "rejected": 0
    },
    "write": {
      "active": 2,
      "queue": 0,
      "rejected": 0
    }
  },
  "shards": [
    {
      "index": "logs-2024",
      "shard": 0,
      "primary": true,
      "state": "STARTED",
      "docs": 1000000,
      "size_bytes": 1073741824
    }
  ]
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid cluster or node ID
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Cluster or node not found
- `500 Internal Server Error`: Server error

---

#### Get Indices

Get information about all indices in the cluster.

**Endpoint:** `GET /api/clusters/:cluster_id/indices`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier

**Response:**

```json
[
  {
    "name": "logs-2024",
    "health": "green",
    "status": "open",
    "primary_shards": 5,
    "replica_shards": 1,
    "docs_count": 1000000,
    "size_bytes": 5368709120
  }
]
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid cluster ID
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Cluster not found
- `500 Internal Server Error`: Server error

---

#### Get Shards

Get information about all shards in the cluster.

**Endpoint:** `GET /api/clusters/:cluster_id/shards`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier

**Response:**

```json
[
  {
    "index": "logs-2024",
    "shard": 0,
    "primary": true,
    "state": "STARTED",
    "node": "node-1-id",
    "node_name": "node-1",
    "docs": 200000,
    "size_bytes": 1073741824
  },
  {
    "index": "logs-2024",
    "shard": 0,
    "primary": false,
    "state": "STARTED",
    "node": "node-2-id",
    "node_name": "node-2",
    "docs": 200000,
    "size_bytes": 1073741824
  }
]
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid cluster ID
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Cluster not found
- `500 Internal Server Error`: Server error

---

#### Get Shard Statistics

Get detailed statistics for a specific shard.

**Endpoint:** `GET /api/clusters/:cluster_id/indices/:index_name/shards/:shard_num`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier
- `index_name` (string): Index name
- `shard_num` (string): Shard number

**Response:**

```json
{
  "routing": {
    "state": "STARTED",
    "primary": true,
    "node": "node-1-id"
  },
  "docs": {
    "count": 200000,
    "deleted": 100
  },
  "store": {
    "size_in_bytes": 1073741824
  },
  "segments": {
    "count": 50,
    "memory_in_bytes": 10485760
  },
  "merges": {
    "current": 0,
    "total": 100
  },
  "refresh": {
    "total": 500
  },
  "flush": {
    "total": 50
  }
}
```

**Status Codes:**
- `200 OK`: Success
- `400 Bad Request`: Invalid parameters
- `401 Unauthorized`: Authentication required
- `404 Not Found`: Cluster, index, or shard not found
- `500 Internal Server Error`: Server error

---

#### Relocate Shard

Move a shard from one node to another.

**Endpoint:** `POST /api/clusters/:cluster_id/shards/relocate`

**Authentication:** Required

**Path Parameters:**
- `cluster_id` (string): Cluster identifier

**Request Body:**

```json
{
  "index": "logs-2024",
  "shard": 0,
  "from_node": "node-1-id",
  "to_node": "node-2-id"
}
```

**Request Fields:**
- `index` (string, required): Index name
- `shard` (number, required): Shard number
- `from_node` (string, required): Source node ID
- `to_node` (string, required): Destination node ID

**Response:**

```json
{
  "acknowledged": true,
  "state": {
    "cluster_name": "my-cluster",
    "version": 123,
    "state_uuid": "abc123"
  }
}
```

**Status Codes:**
- `200 OK`: Relocation initiated successfully
- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Cluster not found
- `500 Internal Server Error`: Server error

**Error Codes:**

| Error Code | Description |
|------------|-------------|
| `validation_failed` | Request validation failed (see message for details) |
| `cluster_not_found` | Specified cluster does not exist |
| `relocation_failed` | Elasticsearch rejected the relocation |
| `elasticsearch_error` | Elasticsearch returned an error |

**Validation Rules:**

1. **Index name**: Must not be empty, must be lowercase, cannot contain: `\ / * ? " < > | space , #`
2. **Source node**: Must not be empty
3. **Destination node**: Must not be empty
4. **Different nodes**: Source and destination must be different

**Example Error Responses:**

Empty index name:
```json
{
  "error": "validation_failed",
  "message": "Index name is required. Please provide a valid index name."
}
```

Same source and destination:
```json
{
  "error": "validation_failed",
  "message": "Source and destination nodes must be different (both are node-1). Please select a different destination node."
}
```

Shard not found:
```json
{
  "error": "elasticsearch_error",
  "message": "Shard 0 of index 'logs-2024' not found. The shard may have been deleted or the index may not exist."
}
```

Node not found:
```json
{
  "error": "elasticsearch_error",
  "message": "Node 'node-3' not found. The node may have left the cluster."
}
```

Already relocating:
```json
{
  "error": "elasticsearch_error",
  "message": "Shard 0 of index 'logs-2024' is already being relocated. Please wait for the current relocation to complete."
}
```

---

#### Proxy Request

Forward a request to the Elasticsearch cluster.

**Endpoint:** `ANY /api/clusters/:cluster_id/proxy/*path`

**Authentication:** Required (except in open mode)

**Path Parameters:**
- `cluster_id` (string): Cluster identifier
- `path` (string): Elasticsearch API path (e.g., `_cat/indices`, `my-index/_search`)

**Query Parameters:** Forwarded to Elasticsearch

**Request Body:** Forwarded to Elasticsearch (for POST, PUT, DELETE)

**Response:** Elasticsearch response (status code, headers, and body are forwarded)

**Example:**

```bash
# Get cluster health
GET /api/clusters/local/proxy/_cluster/health

# Search an index
POST /api/clusters/local/proxy/logs-2024/_search
{
  "query": {
    "match_all": {}
  }
}

# Create an index
PUT /api/clusters/local/proxy/my-new-index
{
  "settings": {
    "number_of_shards": 3,
    "number_of_replicas": 1
  }
}
```

**Status Codes:** Forwarded from Elasticsearch

---

## Rate Limiting

Secan implements rate limiting for authentication endpoints to prevent brute-force attacks:

- **Login attempts**: 5 per minute per IP address
- **OIDC callback**: 10 per minute per IP address

Rate limit exceeded response:
```json
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later."
}
```

## CORS

CORS is enabled for development mode. In production, configure allowed origins in `config.yaml` (copy from `config.example.yaml` if needed):

```yaml
server:
  cors:
    allowed_origins:
      - "https://secan.example.com"
```

## Logging

All API requests are logged with:
- Request method and path
- Response status code
- Response time
- User ID (if authenticated)
- Cluster ID (for cluster operations)

Shard relocation operations are logged with full audit trail:
- User ID and username
- Cluster ID
- Index name and shard number
- Source and destination nodes
- Timestamp
- Success or failure status

## Error Handling

### Client Errors (4xx)

- `400 Bad Request`: Invalid request parameters
- `401 Unauthorized`: Authentication required
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `429 Too Many Requests`: Rate limit exceeded

### Server Errors (5xx)

- `500 Internal Server Error`: Unexpected server error
- `502 Bad Gateway`: Elasticsearch connection error
- `503 Service Unavailable`: Service temporarily unavailable
- `504 Gateway Timeout`: Elasticsearch request timeout

## Best Practices

### Authentication

1. Always use HTTPS in production
2. Store session cookies securely
3. Implement proper logout to clear sessions
4. Use short session timeouts for sensitive operations

### Cluster Operations

1. Check cluster health before operations
2. Validate parameters before sending requests
3. Handle Elasticsearch errors gracefully
4. Implement retry logic for transient failures
5. Log all cluster modifications for audit

### Shard Relocation

1. Relocate during low-traffic periods
2. Monitor cluster health during relocation
3. Check node resources before relocating
4. Relocate one shard at a time for large shards
5. Wait for relocation to complete before starting another

### Performance

1. Use pagination for large result sets
2. Cache cluster state data when appropriate
3. Implement request timeouts
4. Use connection pooling for Elasticsearch
5. Monitor API response times

## Examples

### cURL Examples

List clusters:
```bash
curl -X GET http://localhost:8080/api/clusters \
  -H "Cookie: secan_session=your-session-token"
```

Get cluster stats:
```bash
curl -X GET http://localhost:8080/api/clusters/local/stats \
  -H "Cookie: secan_session=your-session-token"
```

Relocate shard:
```bash
curl -X POST http://localhost:8080/api/clusters/local/shards/relocate \
  -H "Content-Type: application/json" \
  -H "Cookie: secan_session=your-session-token" \
  -d '{
    "index": "logs-2024",
    "shard": 0,
    "from_node": "node-1",
    "to_node": "node-2"
  }'
```

### JavaScript/TypeScript Examples

Using fetch:
```typescript
// List clusters
const clusters = await fetch('/api/clusters', {
  credentials: 'include'
}).then(r => r.json());

// Relocate shard
const result = await fetch('/api/clusters/local/shards/relocate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  credentials: 'include',
  body: JSON.stringify({
    index: 'logs-2024',
    shard: 0,
    from_node: 'node-1',
    to_node: 'node-2'
  })
}).then(r => r.json());
```

### Python Examples

Using requests:
```python
import requests

# List clusters
response = requests.get(
    'http://localhost:8080/api/clusters',
    cookies={'secan_session': 'your-session-token'}
)
clusters = response.json()

# Relocate shard
response = requests.post(
    'http://localhost:8080/api/clusters/local/shards/relocate',
    json={
        'index': 'logs-2024',
        'shard': 0,
        'from_node': 'node-1',
        'to_node': 'node-2'
    },
    cookies={'secan_session': 'your-session-token'}
)
result = response.json()
```

## Changelog

### Version 1.0.0

- Initial API release
- Cluster management endpoints
- Node and index information endpoints
- Shard relocation endpoint
- Proxy endpoint for Elasticsearch API
- Session-based authentication
- Rate limiting for auth endpoints

## Support

For API issues or questions:
- Check backend logs for detailed error messages
- Review Elasticsearch logs for cluster operation errors
- Open an issue on GitHub with API request/response details
