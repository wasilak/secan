---
title: Cluster Tasks Management
description: >-
  Monitor and manage Elasticsearch cluster tasks with filtering, bulk
  operations, and detailed insights
---

## Cluster Tasks Management

Secan provides comprehensive task management capabilities for monitoring and controlling long-running operations in your Elasticsearch cluster.

## What are Cluster Tasks?

Cluster tasks represent ongoing operations in Elasticsearch such as:

- **Index operations**: Reindex, delete by query, update by query
- **Search operations**: Long-running searches with scroll
- **Bulk operations**: Large bulk indexing requests
- **Snapshot operations**: Backup and restore operations
- **Recovery operations**: Shard recovery and relocation

## Tasks Tab

Access task management through the **Tasks** tab in the cluster view. This provides a real-time view of all running tasks with detailed information and control options.

### Task Information Display

Each task displays the following information:

| Field | Description |
|-------|-------------|
| **Task ID** | Unique identifier for the task |
| **Action** | Type of operation (e.g., `indices:data/write/reindex`) |
| **Description** | Human-readable description of the operation |
| **Start Time** | When the task began execution |
| **Running Time** | Duration the task has been running |
| **Node** | Which node is executing the task |
| **Progress** | Current progress (if available) |
| **Status** | Current task status |

### Task Filtering

Filter tasks to find specific operations:

- **Search by ID**: Filter by task ID or partial ID
- **Filter by Action**: Show only specific action types
- **Filter by Node**: Display tasks running on specific nodes
- **Filter by Status**: Show tasks with specific status
- **Time Range**: Filter by start time

### Bulk Operations

Perform actions on multiple tasks simultaneously:

1. **Select Tasks**: Use checkboxes to select multiple tasks
2. **Choose Action**: Select from bulk operation menu
3. **Confirm**: Review and confirm the operation

#### Available Bulk Operations

- **Cancel Tasks**: Stop selected tasks gracefully
- **Export Details**: Export task information as JSON
- **Copy IDs**: Copy task IDs to clipboard

### Task Details Modal

Click on any task to view detailed information:

- **Full Task Description**: Complete task description
- **Progress Details**: Detailed progress information
- **Stats**: Task-specific statistics
- **Node Information**: Details about the executing node
- **Actions**: Available actions for the task

## Task Cancellation

Cancel long-running or problematic tasks:

### Single Task Cancellation

1. Click on the task to open details modal
2. Click **Cancel Task** button
3. Confirm the cancellation

### Bulk Task Cancellation

1. Select multiple tasks using checkboxes
2. Click **Actions** menu
3. Select **Cancel Selected**
4. Confirm bulk cancellation

## Task Monitoring Best Practices

### Regular Monitoring

- Check the Tasks tab regularly for long-running operations
- Monitor task progress for critical operations
- Watch for tasks running longer than expected

### Identifying Problematic Tasks

Look for these warning signs:

- Tasks running for extended periods (hours or days)
- Tasks with no progress indication
- Multiple tasks from the same operation type
- Tasks consuming significant node resources

### When to Cancel Tasks

Consider cancelling tasks when:

- The operation is no longer needed
- The task appears stuck (no progress for extended time)
- The task is impacting cluster performance
- The operation was started by mistake

## Task API Integration

Secan uses the Elasticsearch `_tasks` API for task management:

```bash
# List all tasks
GET /_tasks

# List tasks with specific action
GET /_tasks?actions=*reindex

# Cancel a specific task
DELETE /_tasks/<task_id>

# Cancel tasks by action
POST /_tasks/_cancel?actions=*delete_by_query
```

## Related Features

- [REST Console](/features/rest-console) - Execute custom task API calls
- [Cluster Details](/features/cluster-details) - View node information
- [Dashboard & Overview](/features/dashboard) - Monitor cluster health
