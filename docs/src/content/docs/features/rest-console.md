---
title: REST Console
description: Execute Elasticsearch queries directly from the UI
---

## REST Console

The REST Console allows you to execute Elasticsearch API calls directly from Secan's web interface, providing a convenient way to run queries, check cluster state, and perform administrative operations.

## Using the Console

### Execute Queries

1. Select your cluster from the dropdown
2. Choose the HTTP method (GET, POST, PUT, DELETE, PATCH)
3. Enter the API path (e.g., `/_search`, `/_cat/indices`, `/_cluster/health`)
4. Optional: Add request body (JSON) for POST/PUT requests
5. Click Execute

### View Responses

- **Response Body**: Full JSON response from Elasticsearch
- **Response Status**: HTTP status code and message
- **Response Time**: Query execution duration
- **Formatted Output**: Pretty-printed JSON for readability

## Common Queries

### Cluster Health

```
GET /_cluster/health
```

### List Indices

```
GET /_cat/indices?v
```

### Search

```
POST /index-name/_search
{
  "query": {
    "match_all": {}
  }
}
```

### Get Cluster Settings

```
GET /_cluster/settings
```

### Update Cluster Setting

```
PUT /_cluster/settings
{
  "transient": {
    "cluster.max_shards_per_node": 1000
  }
}
```

## Authentication

The console automatically uses the authentication configured for your cluster. If the cluster requires credentials, they're applied automatically based on your Secan configuration.

## Safety Notes

- The REST Console can execute any Elasticsearch API call
- Use caution with DELETE and destructive operations
- Always test queries in a dev/test cluster first
- Monitor your Elasticsearch logs when experimenting

## Related Features

- [Cluster Details](/features/cluster-details/) - View cluster overview
- [Index Management](/features/index-management/) - Manage indices with UI
- [Shard Management](/features/shard-management/) - Manage shard allocation
