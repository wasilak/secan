---
title: REST Console
description: Execute Elasticsearch queries directly from the UI with persistent drawer and detached modal modes
---

## REST Console

The REST Console allows you to execute Elasticsearch API calls directly from Secan's web interface. It features a persistent right-side drawer that stays open while you navigate the UI, and a detachable modal mode for focused work.

## Console Modes

### Drawer Mode (Default)

The console appears as a resizable panel on the right side of the screen:

- **Persistent**: Stays open while you navigate between different views
- **Resizable**: Drag the left border to adjust the width (minimum 400px)
- **Contextual**: Automatically associated with the current cluster
- **State Persistence**: Your console history and state are saved per cluster

### Detached Modal Mode

Click the detach button to convert the console into a floating modal:

- **Focused Work**: Dedicated window for complex queries
- **Larger Space**: More room for request/response content
- **Quick Access**: Easily switch between modal and drawer modes
- **Persistent State**: Mode preference is saved across sessions

## Using the Console

## Using the Console

### Opening the Console

The console toggle button is located in the **cluster header** next to the lock button:

1. Navigate to any cluster view (Overview, Nodes, Indices, etc.)
2. Click the **Terminal icon** in the cluster header to open the console
3. The console slides in from the right as a resizable drawer

### Execute Queries

1. The console is automatically associated with the current cluster
2. Choose the HTTP method (GET, POST, PUT, DELETE, PATCH)
3. Enter the API path (e.g., `/_search`, `/_cat/indices`, `/_cluster/health`)
4. Optional: Add request body (JSON) for POST/PUT requests
5. Click **Execute** or press `Ctrl+Enter`

### View Responses

- **Response Body**: Full JSON response from Elasticsearch with syntax highlighting
- **Response Status**: HTTP status code and message
- **Response Time**: Query execution duration
- **Request History**: Previous queries are saved and can be re-executed
- **Formatted Output**: Pretty-printed JSON for readability

### Request History

The console maintains a history of your requests:

- Access previous queries from the **History** tab
- Click any history item to reload it into the editor
- History is persisted per cluster across browser sessions
- Clear history using the trash icon

## Console Features

### Resizing the Drawer

The console drawer can be resized to fit your workflow:

1. **Drag the left border** to adjust the width
2. **Minimum width**: 400px to ensure content readability
3. **Maximum width**: 50% of the viewport
4. **Width persistence**: Your preferred width is saved per cluster

### Switching Modes

Toggle between drawer and modal modes:

- **Detach button** (↗️): Convert drawer to modal
- **Attach button** (↙️): Convert modal back to drawer
- Your mode preference is saved automatically

### Keyboard Shortcuts

- `Ctrl+Enter`: Execute the current query
- `Escape`: Close the console drawer or modal

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
\{
  "query": \{
    "match_all": \{\}
  \}
\}
```

### Get Cluster Settings

```
GET /_cluster/settings
```

### Update Cluster Setting

```
PUT /_cluster/settings
\{
  "transient": \{
    "cluster.max_shards_per_node": 1000
  \}
\}
```

## Authentication

The console automatically uses the authentication configured for your cluster. If the cluster requires credentials, they're applied automatically based on your Secan configuration.

## Safety Notes

- The REST Console can execute any Elasticsearch API call
- Use caution with DELETE and destructive operations
- Always test queries in a dev/test cluster first
- Monitor your Elasticsearch logs when experimenting

## Related Features

- [Cluster Details](../features/cluster-details) - View cluster overview
- [Index Management](../features/index-management) - Manage indices with UI
- [Shard Management](../features/shard-management) - Manage shard allocation
