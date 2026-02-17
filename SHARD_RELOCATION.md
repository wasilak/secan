# Shard Relocation Guide

## Overview

Secan provides an interactive, visual interface for manually relocating Elasticsearch shards between nodes. This feature allows cluster administrators to rebalance shards with precision using a click-based workflow.

## Features

- **Visual Shard Grid**: See all shards organized by node (rows) and index (columns)
- **Color-Coded States**: Instantly identify shard health and status
- **Click-to-Relocate**: Simple 3-click workflow to move shards
- **Real-Time Progress**: Watch shard relocation progress in real-time
- **Validation**: Built-in checks prevent invalid operations
- **Keyboard Navigation**: Full keyboard support for accessibility

## Accessing Shard Relocation

1. Navigate to a cluster in Secan
2. Click on the "Topology" tab in the cluster view
3. The shard grid displays all shards across all nodes

## Understanding the Shard Grid

### Layout

The shard grid is organized as a matrix:
- **Rows**: Elasticsearch nodes with their statistics (heap, disk, CPU, load)
- **Columns**: Indices with metadata (shard count, document count, size)
- **Cells**: Individual shards at the intersection of node and index

### Shard States and Colors

Shards are color-coded by their state:

| State | Color | Description |
|-------|-------|-------------|
| **STARTED** | Green border | Healthy, active shard |
| **INITIALIZING** | Yellow border | Shard is being initialized |
| **RELOCATING** | Orange border | Shard is currently moving |
| **UNASSIGNED** | Red border | Shard has no assigned node |

### Primary vs Replica

- **Primary shards**: Display a small blue dot in the corner and show "P" badge for unassigned shards
- **Replica shards**: Show "R" badge for unassigned shards

### Shard Numbers

Each shard displays its number (0, 1, 2, etc.) inside the box.

## Relocating a Shard

### Step 1: Select a Shard

1. Click on any **STARTED** shard (green border)
2. A context menu appears with two options:
   - **Display shard stats**: View detailed shard information
   - **Select for relocation**: Enter relocation mode

### Step 2: Choose Destination

1. Click "Select for relocation"
2. The grid enters relocation mode:
   - Selected shard pulses with a thicker border
   - Valid destination nodes show dashed purple indicators
3. Click on any purple destination indicator

### Step 3: Confirm Relocation

1. A confirmation dialog appears showing:
   - Index name and shard number
   - Source node details
   - Destination node details
   - Performance impact warning
2. Click "Relocate Shard" to confirm or "Cancel" to abort

### Step 4: Monitor Progress

1. After confirmation, relocation begins immediately
2. The grid updates to show:
   - Source node: Shard in **RELOCATING** state (orange)
   - Destination node: Shard in **INITIALIZING** state (yellow)
3. The grid auto-refreshes every 2 seconds
4. When complete, the shard appears as **STARTED** (green) on the destination node

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| **Tab** | Focus next shard |
| **Shift+Tab** | Focus previous shard |
| **Enter** / **Space** | Open context menu for focused shard |
| **Arrow Keys** | Navigate context menu |
| **Escape** | Close menu or exit relocation mode |

## Viewing Shard Statistics

1. Click on any shard
2. Select "Display shard stats" from the context menu
3. A modal displays:
   - Shard number and type (primary/replica)
   - Index name
   - Node name and ID
   - Shard state
   - Document count and size
   - Segments, merges, refreshes, flushes

## Valid Destinations

When selecting a shard for relocation, Secan automatically calculates valid destination nodes. A node is valid if:

- ✅ It's not the current node hosting the shard
- ✅ It doesn't already host the same shard number for that index
- ✅ It's a data node (not master-only or coordinating-only)

Invalid destinations are not shown as options.

## Restrictions

You **cannot** relocate:

- ❌ **UNASSIGNED** shards (they need allocation, not relocation)
- ❌ **RELOCATING** shards (already moving)
- ❌ **INITIALIZING** shards (not yet ready)

Only **STARTED** shards can be relocated.

## Performance Considerations

### Impact on Cluster

Shard relocation:
- Consumes network bandwidth between nodes
- Uses disk I/O on both source and destination
- May temporarily increase cluster load
- Can affect query performance during the move

### Best Practices

1. **Relocate during low-traffic periods** when possible
2. **Relocate one shard at a time** for large shards
3. **Monitor cluster health** during relocation
4. **Check node resources** before relocating to ensure destination has capacity
5. **Avoid relocating multiple shards simultaneously** unless necessary

### Timeouts

- Relocation progress polling: 5 minutes (configurable)
- If relocation doesn't complete within timeout, check cluster logs

## Troubleshooting

### Relocation Fails Immediately

**Possible causes:**
- Destination node doesn't have enough disk space
- Cluster allocation settings prevent the move
- Shard is locked or has allocation restrictions

**Solutions:**
- Check destination node disk space
- Review cluster allocation settings
- Check index allocation settings

### Relocation Stuck in RELOCATING State

**Possible causes:**
- Network issues between nodes
- Destination node is overloaded
- Large shard taking time to copy

**Solutions:**
- Check network connectivity between nodes
- Monitor destination node resources
- Wait longer for large shards (can take minutes to hours)
- Check Elasticsearch logs for errors

### Cannot Select Shard for Relocation

**Possible causes:**
- Shard is not in STARTED state
- Shard is already relocating
- No valid destination nodes available

**Solutions:**
- Wait for shard to reach STARTED state
- Wait for current relocation to complete
- Add more data nodes to the cluster

### "Cluster not found" Error

**Possible causes:**
- Cluster configuration is incorrect
- Cluster is not running
- Network connectivity issues

**Solutions:**
- Verify cluster configuration in `config.yaml`
- Check that Elasticsearch is running
- Test connectivity: `curl http://elasticsearch:9200`

## API Reference

Secan uses the Elasticsearch Cluster Reroute API internally:

```bash
POST /_cluster/reroute
{
  "commands": [
    {
      "move": {
        "index": "my-index",
        "shard": 0,
        "from_node": "node-1",
        "to_node": "node-2"
      }
    }
  ]
}
```

## Security

### Authentication

Shard relocation requires authentication when Secan is configured with:
- Local users mode
- OIDC mode

In open mode (no authentication), all users can relocate shards.

### Authorization

When RBAC is enabled, users must have access to the cluster to relocate shards. Check your role configuration in `config.yaml`.

### Audit Logging

All shard relocation attempts are logged with:
- User ID and username
- Cluster ID
- Index name and shard number
- Source and destination nodes
- Timestamp
- Success or failure status

Check backend logs for audit trail:

```bash
grep "Shard relocation" backend.log
```

## Examples

### Example 1: Rebalancing After Node Addition

**Scenario**: You added a new node to the cluster and want to move some shards to it.

1. Navigate to Topology tab
2. Identify heavily loaded nodes (high heap/disk usage)
3. Click on a shard from a loaded node
4. Select "Select for relocation"
5. Click on the new node's destination indicator
6. Confirm relocation
7. Repeat for other shards as needed

### Example 2: Evacuating a Node for Maintenance

**Scenario**: You need to take a node offline for maintenance.

1. Navigate to Topology tab
2. Identify all shards on the target node
3. For each shard:
   - Click the shard
   - Select "Select for relocation"
   - Choose a destination node with available capacity
   - Confirm relocation
4. Wait for all relocations to complete
5. Verify no shards remain on the target node
6. Safely shut down the node

### Example 3: Fixing Unbalanced Shard Distribution

**Scenario**: Some nodes have many more shards than others.

1. Navigate to Topology tab
2. Count shards per node (visible in the grid)
3. Identify nodes with excessive shards
4. Relocate shards from overloaded to underloaded nodes
5. Aim for even distribution across data nodes

## Advanced Features

### Virtualization for Large Clusters

For clusters with >20 nodes or >20 indices, Secan automatically enables virtualization:
- Only visible rows and columns are rendered
- Smooth scrolling with minimal performance impact
- Supports clusters with hundreds of nodes and thousands of indices

### Auto-Refresh

The shard grid auto-refreshes at configurable intervals (default: 30 seconds) to show:
- New shards
- State changes
- Relocation progress
- Node additions/removals

### Responsive Design

The shard grid adapts to different screen sizes:
- **Desktop**: Full grid with all details
- **Laptop**: Optimized for 1366px+ screens
- **Tablet**: Horizontal scrolling, collapsible sections
- **Mobile**: Touch-friendly with minimum 44x44px touch targets

## Related Documentation

- [Configuration Guide](CONFIGURATION.md) - Configure Secan and clusters
- [Docker Deployment](DOCKER.md) - Deploy Secan with Docker
- [Contributing](CONTRIBUTING.md) - Contribute to Secan development

## Support

For issues or questions:
- Check Elasticsearch logs for detailed error messages
- Review Secan backend logs for API errors
- Open an issue on GitHub with reproduction steps

## Acknowledgments

The shard relocation feature is inspired by Cerebro's shard management capabilities, enhanced with modern UI patterns and improved user experience.
