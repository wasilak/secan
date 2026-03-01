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
- Node Modal: `/cluster/:id/nodes/node-1`
- Index Modal: `/cluster/:id/indices/my-index`
- Shard Modal: `/cluster/:id/shards/my-index[0]`

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
| `/cluster/:id?tab=nodes&node=node-1` | `/cluster/:id/nodes/node-1` |
| `/cluster/:id?node=node-1` | `/cluster/:id/nodes/node-1` |
| `/cluster/:id?tab=indices&index=my-index` | `/cluster/:id/indices/my-index` |
| `/cluster/:id?index=my-index` | `/cluster/:id/indices/my-index` |
| `/cluster/:id?index=my-index&indexTab=mappings` | `/cluster/:id/indices/my-index?section=mappings` |
| `/cluster/:id?shard=my-index[0]` | `/cluster/:id/shards/my-index%5B0%5D` |

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
https://example.com/cluster/prod-cluster/indices/my-index?section=mappings
```

### 3. **Better User Experience**
- URLs reflect current view
- Browser back/forward buttons work intuitively
- Cleaner, more readable URLs
- No query parameter confusion

### 4. **SEO Friendly**
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

The `useClusterNavigation` hook provides convenient navigation functions:

```typescript
import { useClusterNavigation } from './hooks/useClusterNavigation';

function MyComponent() {
  const { navigateToSection, navigateToNode, navigateToIndex, closeModal } =
    useClusterNavigation();

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

## Support

For questions about the new routing system:
- See inline code documentation in `frontend/src/utils/urlBuilders.ts`
- Check the routing guide in `frontend/src/routes/clusterRoutes.ts`
- Review examples in `frontend/src/hooks/useClusterNavigation.ts`
