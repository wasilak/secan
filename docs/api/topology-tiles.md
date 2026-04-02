# Topology Tiles API

Endpoint: POST /api/clusters/{id}/topology/tiles

Overview
- This endpoint returns one tile payload per requested tile. Tiles are used by the frontend topology view to lazily load node metadata and (optionally) shard details.
- To reduce payload size we separate lightweight node metadata from heavy per-node shard arrays. This makes it possible to return summary counts for L1 tiles and full shard arrays only for L2 tiles.

Request body
```
{
  "tileRequests": [
    { "x": 0, "y": 0, "lod": "L1", "clientVersion": "v-..." }
  ]
}
```

Tile payload (response)

- Each tile in the response has the following fields (camelCase):

- x, y: tile coordinates
- lod: requested LOD (L0, L1, L2)
- version: server-generated version string that clients can send back as clientVersion
- unchanged: boolean indicating whether clientVersion matched version
- nodesMeta: Optional array of minimal node metadata objects present when unchanged=false. Each node object contains positioning and node fields (id, name, x, y, width, height, metrics, summaryCounts when provided).
- edges: Optional edges array (currently empty for generator)
- shards: Optional object mapping nodeId (or nodeName) -> array of shard objects. Present only for L2 tiles (heavy payload).

Example L1 (summary only)
```
{
  "x": 0,
  "y": 0,
  "lod": "L1",
  "version": "g-...-v-...",
  "unchanged": false,
  "nodesMeta": [
    { "id": "node-1", "x": 64, "y": 64, "width": 48, "height": 32, "name": "node-1", "metrics": { "heapPercent": 42 }, "summaryCounts": { "primary": 10, "replica": 20, "total": 30 } }
  ],
  "edges": []
}
```

Example L2 (full shards map)
```
{
  "x": 0,
  "y": 0,
  "lod": "L2",
  "version": "g-...-v-...",
  "unchanged": false,
  "nodesMeta": [
    { "id": "node-1", "x": 64, "y": 64, "width": 48, "height": 32, "name": "node-1", "metrics": { "heapPercent": 42 }, "summaryCounts": { "primary": 10, "replica": 20, "total": 30 } }
  ],
  "shards": {
    "node-1": [ { "index": "logs-2024", "shard": 0, "primary": true, "state": "STARTED" }, { "index": "logs-2024", "shard": 1, "primary": false, "state": "RELOCATING" } ]
  },
  "edges": []
}
```

Notes for clients
- Clients should treat nodesMeta as the authoritative tile-provided node metadata and must NOT overwrite base node metadata with empty fields when nodesMeta is absent.
- Clients should look for shards in the tile-level shards map first (tile.shards[nodeId] or tile.shards[nodeName]) and only fall back to node-level embedded shards if present.
- When tile.unchanged is true (or nodesMeta is null), clients must retain existing cached tile data and avoid replacing it with empty arrays.

OpenAPI integration

I added an OpenAPI component fragment at `openapi_extensions/topology_tiles_schema.json` that contains the TilePayload and TileBatchResponse schemas. This repository's main `openapi.json` appears to be generated separately; to include these definitions in the canonical OpenAPI document you can merge the `components.schemas` object from the fragment into your generated `openapi.json` (tooling like `jq` or your OpenAPI generator/protocol can perform the merge).

Example jq merge (local edit):
```
jq '.components.schemas += (fromjson | .components.schemas)' openapi.json openapi_extensions/topology_tiles_schema.json > openapi.merged.json
```
Replace your deployed/openapi.json with the merged output or update your OpenAPI generator to include the tile schemas.
