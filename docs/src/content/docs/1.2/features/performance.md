---
title: Performance & Optimization
description: Memory optimization and performance features for large clusters
slug: 1.2/features/performance
---

## Performance Optimization

Secan is optimized for managing large Elasticsearch clusters with minimal memory overhead. This page describes the key performance features and optimizations.

## Memory Optimization for Large Clusters

### Pagination System

Secan implements server-side pagination to handle clusters with thousands of nodes, indices, or shards:

* **Automatic Pagination**: Large datasets are automatically paginated (50 items per page by default)
* **Memory Efficient**: Only the requested page is loaded into memory, reducing heap usage by 10-20x
* **Responsive Navigation**: Page controls in Nodes, Indices, and Shards tabs
* **Total Count**: Always shows total count across all pages for capacity planning

### Lightweight API Usage

Secan minimizes memory footprint by using efficient Elasticsearch APIs:

* **_cat/shards**: Compact shard allocation data (5-10MB for large clusters vs 50-200MB with cluster state)
* **_cat/master**: Lightweight master node detection (1KB vs 500MB with cluster state)
* **_cat/nodes**: Efficient node listing with filtered fields
* **Node-specific Queries**: Avoids loading full cluster state for individual node details

### Performance Impact

For a cluster with 3,661 shards across 30 nodes:

| Operation | Without Optimization | With Optimization | Reduction |
|-----------|---------------------|-------------------|-----------|
| Shard Loading | 50-200MB | 5-10MB | ~90% |
| Node Details | 500MB+ | <1MB | ~99% |
| Master Detection | 500MB+ | 1KB | ~99.99% |
| Total Page Load | 1GB+ | 50-100MB | ~90% |

## Auto-Refresh Configuration

The dashboard and cluster view support configurable auto-refresh intervals:

* **Adjustable Intervals**: Set refresh rates in settings (5s, 10s, 30s, 1m, 5m)
* **Performance Control**: Longer intervals reduce server load for large deployments
* **Selective Updates**: Only active tabs are refreshed, reducing unnecessary API calls

## Large Cluster Handling

### Tested with Large Deployments

Secan has been tested and optimized for:

* **30+ node clusters**: Handles master detection and node listing without memory issues
* **1000+ shards**: Shard allocation displays efficiently without OOM errors
* **10,000+ indices**: Index listings are paginated for smooth navigation
* **100M+ documents**: Document counts aggregated without loading full indices

### Recommendations for Very Large Clusters

* **Set longer refresh intervals** (30s or more) for clusters with 1000+ nodes
* **Use pagination** to navigate large datasets (50 items per page is optimal)
* **Monitor memory**: Deploy with sufficient heap for Secan (2GB recommended for 5000+ shards)
* **Scale horizontally**: Run multiple Secan instances for high availability

## Network Optimization

### Efficient Data Transfer

* **Compact JSON Responses**: Pagination reduces payload size by 90% for large datasets
* **Selective Fields**: API responses only include necessary fields
* **Gzip Compression**: HTTP compression enabled by default
* **Connection Reuse**: Persistent connections to Elasticsearch clusters

## Frontend Optimization

### Performance Features

* **Lazy Loading**: Components load data on-demand
* **Virtual Scrolling**: Can be enabled for tables with thousands of rows (future enhancement)
* **React Query Caching**: Automatic caching and cache invalidation
* **Code Splitting**: Frontend assets optimized for fast initial load
* **Dark Mode**: UI optimized for both light and dark color schemes

## Database-Free Design

Secan requires no external databases or caches:

* **Zero Runtime Dependencies**: Lightweight standalone deployment
* **No Session Storage**: Stateless design enables horizontal scaling
* **Direct ES Access**: All data fetched directly from Elasticsearch
* **No Warm-up Required**: Starts immediately without initialization

## Monitoring Performance

### Available Metrics

* **API Response Times**: Monitor cluster API call latencies
* **Memory Usage**: Track Secan process memory consumption
* **Request Counts**: Monitor API request patterns
* **Elasticsearch Connection**: Health and latency monitoring

See the [Configuration](/1.2/configuration/logging/) guide for monitoring setup instructions.

## Best Practices

1. **Use Pagination**: Always navigate large datasets with pagination controls
2. **Adjust Refresh Rates**: Longer intervals for clusters with 1000+ nodes
3. **Monitor Memory**: Deploy with sufficient resources (2GB+ for large clusters)
4. **Keep Elasticsearch Updated**: Optimize Elasticsearch performance first
5. **Network Optimization**: Ensure fast, stable connection to Elasticsearch

## Future Enhancements

* Virtual scrolling for tables (100x+ memory improvement for very large datasets)
* Advanced filtering and search (reduce results before pagination)
* Query result caching (reduce Elasticsearch load)
* WebSocket support for real-time updates
