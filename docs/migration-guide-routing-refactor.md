# Cluster Routing Refactor - Migration Guide

## Overview

The cluster routing system has been refactored to use **path-based URLs** instead of query parameters. This makes URLs bookmarkable, shareable, and more intuitive while maintaining full backward compatibility with old URLs.

## Key Changes

### What Changed

**Old Format (Query Parameters)**
- Sections: `/cluster/:id?tab=statistics`
- Node Modal: `/cluster/:id?tab=nodes&node=node-1`
- Index Modal: `/cluster/:id?tab=indices&index=my-index`
- Shard Modal: `/cluster/:id?shard=my-index[0]`

**New Format (Path-Based)**
- Sections: `/cluster/:id/statistics`
- Node Modal: `/cluster/:id/nodes/node-1?bg=topology`
- Index Modal: `/cluster/:id/indices/my-index?bg=statistics`
- Shard Modal: `/cluster/:id/shards/my-index[0]?bg=topology`

### Background Section Preservation

When opening a modal from any section, the background section is preserved via the `bg` query parameter:

- From **Topology** view: `/cluster/:id/nodes/node-1?bg=topology`
- From **Statistics** view: `/cluster/:id/indices/my-index?bg=statistics`
- From **Nodes** view: `/cluster/:id/nodes/node-1` (no bg param needed)
- From **Indices** view: `/cluster/:id/indices/my-index` (no bg param needed)

This ensures modals display as overlays over the current view, and closing them returns you to the same section.

### Backward Compatibility

✅ **Old URLs still work!** The redirect middleware automatically converts old query-parameter URLs to the new path-based format. Users can continue using old bookmarks and links.

## URL Mapping Reference

### Section Navigation

| Old URL | New URL |
|---------|---------|
| `/cluster/:id?tab=overview` | `/cluster/:id/overview` |
| `/cluster/:id?tab=topology` | `/cluster/:id/topology` |
| `/cluster/:id?tab=statistics` | `/cluster/:id/statistics` |
| `/cluster/:id?tab=nodes` | `/cluster/:id/nodes` |
| `/cluster/:id?tab=indices` | `/cluster/:id/indices` |
| `/cluster/:id?tab=shards` | `/cluster/:id/shards` |
| `/cluster/:id?tab=settings` | `/cluster/:id/settings` |
| `/cluster/:id?tab=console` | `/cluster/:id/console` |
| `/cluster/:id` | `/cluster/:id/overview` |

### Modal Navigation

| Old URL | New URL |
|---------|---------|
| `/cluster/:id?tab=nodes&node=node-1` | `/cluster/:id/nodes/node-1?bg=topology` (from topology) |
| `/cluster/:id?node=node-1` | `/cluster/:id/nodes/node-1?bg=statistics` (from statistics) |
| `/cluster/:id?tab=indices&index=my-index` | `/cluster/:id/indices/my-index?bg=nodes` (from nodes) |
| `/cluster/:id?index=my-index` | `/cluster/:id/indices/my-index` (default) |
| `/cluster/:id?index=my-index&indexTab=mappings` | `/cluster/:id/indices/my-index?section=mappings&bg=topology` |
| `/cluster/:id?shard=my-index[0]` | `/cluster/:id/shards/my-index%5B0%5D?bg=statistics` |

**Note:** The `bg` (background) parameter is automatically added when opening a modal from a non-default section. It preserves the current view context so the modal displays as an overlay and closing it returns you to the same section.

### Filter and Search Parameters

Query parameters for filtering, searching, and pagination are preserved:

| Old URL | New URL |
|---------|---------|
| `/cluster/:id?tab=indices&indicesSearch=test` | `/cluster/:id/indices?indicesSearch=test` |
| `/cluster/:id?tab=indices&health=green&status=open` | `/cluster/:id/indices?health=green&status=open` |
| `/cluster/:id?tab=nodes&overviewSearch=test` | `/cluster/:id/nodes?overviewSearch=test` |

## Benefits

### 1. **Bookmarkable URLs**
Users can now bookmark specific sections and modals:
```
https://example.com/cluster/prod-cluster/statistics
https://example.com/cluster/prod-cluster/indices/logs-2024-01
```

### 2. **Shareable URLs**
Share exact views with colleagues:
```
"Check out this index with all the mappings:"
https://example.com/cluster/prod-cluster/indices/my-index?section=mappings&bg=statistics
```

### 3. **Better User Experience**
- URLs reflect current view
- Browser back/forward buttons work intuitively
- Cleaner, more readable URLs
- No query parameter confusion
- **Modals display as overlays over the current section**
- **Closing modals returns to the same section**

### 4. **Modal Overlay Behavior**
When opening a modal from any section (e.g., Topology, Statistics), the modal displays as an overlay over that section:
```
User on:     /cluster/prod-cluster/topology
Click node:  /cluster/prod-cluster/nodes/node-1?bg=topology
Result:      Node modal displays over topology view
Close modal: Returns to /cluster/prod-cluster/topology
```

### 5. **SEO Friendly**
Path-based URLs are better for search engines and web crawlers.

## Breaking Changes

⚠️ **None!** This is a non-breaking change with full backward compatibility.

However, if your application has hardcoded old URLs, you may want to update them:

### Code Examples

**Before (Old Format)**
```typescript
// Using query parameters
navigate(`/cluster/${clusterId}?tab=statistics`);
navigate(`/cluster/${clusterId}?tab=nodes&node=${nodeId}`);
navigate(`/cluster/${clusterId}?index=${indexName}`);
```

**After (New Format)**
```typescript
// Using path-based URLs
navigate(`/cluster/${clusterId}/statistics`);
navigate(`/cluster/${clusterId}/nodes/${nodeId}`);
navigate(`/cluster/${clusterId}/indices/${indexName}`);
```

### Using URL Builders

For consistent URL generation, use the provided URL builder utilities:

```typescript
import {
  buildClusterSectionUrl,
  buildNodeModalUrl,
  buildIndexModalUrl,
  buildShardModalUrl,
} from './utils/urlBuilders';

// Section navigation
const url = buildClusterSectionUrl(clusterId, 'statistics');
// Result: /cluster/my-cluster/statistics

// Node modal
const nodeUrl = buildNodeModalUrl(clusterId, nodeId);
// Result: /cluster/my-cluster/nodes/node-1

// Index modal with section
const indexUrl = buildIndexModalUrl(clusterId, indexName, 'mappings');
// Result: /cluster/my-cluster/indices/my-index?section=mappings
```

### Using Navigation Hook

The `useClusterNavigation` hook provides convenient navigation functions that automatically preserve the current section:

```typescript
import { useClusterNavigation } from './hooks/useClusterNavigation';

function MyComponent() {
  const { navigateToSection, navigateToNode, navigateToIndex, closeModal } =
    useClusterNavigation();

  // User is on /cluster/prod-cluster/topology
  navigateToNode('node-1');
  // Navigates to: /cluster/prod-cluster/nodes/node-1?bg=topology
  // Modal displays over topology view
  
  // User is on /cluster/prod-cluster/statistics
  navigateToIndex('logs-2024', 'mappings');
  // Navigates to: /cluster/prod-cluster/indices/logs-2024?section=mappings&bg=statistics
  // Modal displays over statistics view
  
  // Close modal returns to the background section
  closeModal();
  // Returns to: /cluster/prod-cluster/topology (or whatever the bg was)
  
  return (
    <>
      <button onClick={() => navigateToSection('statistics')}>
        View Statistics
      </button>
      <button onClick={() => navigateToNode('node-1')}>
        View Node Details
      </button>
      <button onClick={() => navigateToIndex('my-index', 'mappings')}>
        View Index Mappings
      </button>
      <button onClick={closeModal}>Close Modal</button>
    </>
  );
}
```

## Testing Old URLs

To test that old URLs still work with the redirect middleware:

```
# Test old format
https://example.com/cluster/my-cluster?tab=statistics
# → Automatically redirects to:
https://example.com/cluster/my-cluster/statistics

# Test old modal format
https://example.com/cluster/my-cluster?tab=nodes&node=node-1
# → Automatically redirects to:
https://example.com/cluster/my-cluster/nodes/node-1

# Test new modal overlay format
https://example.com/cluster/my-cluster/nodes/node-1?bg=topology
# → Displays node modal over topology view
# → Closing returns to topology
```

## Implementation Details

### Redirect Mechanism

The `routeRedirects` middleware in `frontend/src/middleware/routeRedirects.ts` handles the conversion:

1. **Detection**: Checks if URL uses old query-parameter format
2. **Conversion**: Builds new path-based URL preserving all parameters
3. **Navigation**: Silently redirects users (replaces history entry)
4. **Preservation**: Non-modal parameters (filters, search, pagination) are preserved

### No API Changes

This refactor is **purely frontend** - no backend API changes are required.

## FAQ

**Q: Will old bookmarks stop working?**
A: No! Old bookmarks are automatically redirected to the new format.

**Q: Do I need to update my code?**
A: Not immediately, old URLs work fine. But for new code, use the new path-based format.

**Q: What about custom integrations?**
A: If you have external links or integrations, they'll continue working due to the redirect middleware.

**Q: How do I know which URL format to use?**
A: Use the URL builder functions and navigation hook - they handle format automatically.

**Q: How do modals work with the new routing?**
A: Modals now display as overlays over the current section. When you open a modal from the Topology view, it stays on Topology. Closing the modal returns you to the same section.

**Q: What is the `bg` parameter?**
A: The `bg` (background) query parameter preserves the current section when opening modals. For example, `/cluster/:id/nodes/node-1?bg=topology` displays the node modal over the topology view.

**Q: When is the `bg` parameter added?**
A: It's automatically added when opening a modal from a non-default section (Topology, Statistics, Overview, Settings, Console). It's omitted for the default sections (Nodes, Indices, Shards) since the modal path already indicates the section.

## Support

For questions about the new routing system:
- See inline code documentation in `frontend/src/utils/urlBuilders.ts`
- Check the routing guide in `frontend/src/routes/clusterRoutes.ts`
- Review examples in `frontend/src/hooks/useClusterNavigation.ts`
