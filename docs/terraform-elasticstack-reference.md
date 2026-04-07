# Elastic Stack Terraform Provider — Reference for Secan Code Generation

> **Provider**: `elastic/elasticstack`  
> **Source**: `registry.terraform.io/providers/elastic/elasticstack`  
> **Recommended version constraint**: `~> 0.14`  
> **Minimum Terraform CLI**: `>= 1.0.0`  
> **Protocol**: Terraform Plugin Framework (protocol v6)

---

## 1. Provider Configuration

### Minimal provider block

```hcl
terraform {
  required_providers {
    elasticstack = {
      source  = "elastic/elasticstack"
      version = "~> 0.14"
    }
  }
}

provider "elasticstack" {
  elasticsearch {
    username  = "elastic"
    password  = var.password
    endpoints = ["https://my-cluster:9200"]
  }
}
```

### Authentication options

The `elasticsearch` block inside `provider` supports:

| Argument | Type | Description |
|---|---|---|
| `username` | string | Basic auth username |
| `password` | string | Basic auth password |
| `api_key` | string | API key (base64-encoded `id:key`) |
| `bearer_token` | string | Bearer token |
| `endpoints` | list(string) | Cluster endpoints |
| `insecure` | bool | Skip TLS verification |
| `ca_file` | string | Path to CA certificate |
| `ca_data` | string | PEM-encoded CA certificate |
| `cert_file` | string | Path to client certificate |
| `key_file` | string | Path to client key |

All credentials can also be set via environment variables:

```
ELASTICSEARCH_USERNAME
ELASTICSEARCH_PASSWORD
ELASTICSEARCH_API_KEY
ELASTICSEARCH_ENDPOINTS   (comma-separated)
```

### Per-resource connection override

Every resource supports an optional `elasticsearch_connection` block that overrides the provider-level credentials for that specific resource. This enables multi-cluster management from a single provider configuration:

```hcl
resource "elasticstack_elasticsearch_index" "my_index" {
  elasticsearch_connection {
    username  = "elastic"
    password  = var.other_cluster_password
    endpoints = ["https://other-cluster:9200"]
  }
  name = "my-index"
}
```

---

## 2. Resources — Core Secan Types

### 2.1 `elasticstack_elasticsearch_index`

Manages an Elasticsearch index.

**HCL resource type**: `elasticstack_elasticsearch_index`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | Index name |

#### Key optional arguments

| Argument | Type | Description |
|---|---|---|
| `number_of_shards` | number | Primary shard count (static — set at creation only) |
| `number_of_replicas` | number | Replica count |
| `refresh_interval` | string | Refresh interval (e.g., `"1s"`, `"-1"`) |
| `codec` | string | Compression codec, e.g. `"best_compression"` (static) |
| `number_of_routing_shards` | number | Routing shard count (static) |
| `routing_partition_size` | number | Routing partition size (static) |
| `default_pipeline` | string | Default ingest pipeline name |
| `final_pipeline` | string | Final ingest pipeline name |
| `mappings` | string | JSON string of index mappings |
| `aliases` | block | Inline alias definitions (see below) |
| `analysis` | string | JSON string of analysis settings |
| `deletion_protection` | bool | Prevents accidental `terraform destroy` (default: `true`) |

> **DEPRECATION**: The `settings` block is deprecated. Use the individual top-level fields above instead.

> **Static settings**: `number_of_shards`, `codec`, `number_of_routing_shards`, `routing_partition_size` can only be set at creation time — Terraform will error on changes after creation.

> **Import caveat**: Importing an existing index does NOT import its settings. The next `terraform plan` will show all HCL-defined settings as additions, but applying them is safe.

#### `aliases` block (inline, within index resource)

```hcl
aliases {
  name           = "my-alias"
  filter         = jsonencode({ term = { status = "active" } })
  index_routing  = "shard-1"
  search_routing = "shard-1"
  is_write_index = true
  is_hidden      = false
}
```

#### Minimal example

```hcl
resource "elasticstack_elasticsearch_index" "logs" {
  name               = "logs-app-000001"
  number_of_shards   = 2
  number_of_replicas = 1
  mappings = jsonencode({
    properties = {
      "@timestamp" = { type = "date" }
      message      = { type = "text" }
      level        = { type = "keyword" }
    }
  })
}
```

---

### 2.2 `elasticstack_elasticsearch_index_template`

Manages an index template (composable template, ES 7.8+).

**HCL resource type**: `elasticstack_elasticsearch_index_template`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | Template name |

#### Key optional arguments

| Argument | Type | Description |
|---|---|---|
| `index_patterns` | list(string) | Patterns this template matches |
| `priority` | number | Template priority (higher = preferred) |
| `composed_of` | list(string) | List of component template names |
| `version` | number | Template version |
| `data_stream` | block | Enable data stream support |
| `template` | block | Index settings, mappings, aliases (see below) |
| `_meta` | string | JSON string of arbitrary metadata |

#### `template` block

```hcl
template {
  settings = jsonencode({
    number_of_shards   = 2
    number_of_replicas = 1
  })
  mappings = jsonencode({
    properties = {
      "@timestamp" = { type = "date" }
    }
  })
  aliases {
    name = "logs-current"
  }
}
```

#### `data_stream` block

```hcl
data_stream {
  hidden            = false
  allow_custom_routing = false
}
```

#### Minimal example

```hcl
resource "elasticstack_elasticsearch_index_template" "logs" {
  name           = "logs-template"
  index_patterns = ["logs-*"]
  priority       = 100
  composed_of    = ["logs-mappings", "logs-settings"]

  template {
    settings = jsonencode({
      number_of_shards   = 2
      number_of_replicas = 1
      "index.lifecycle.name"       = "logs-ilm-policy"
      "index.lifecycle.rollover_alias" = "logs-current"
    })
  }
}
```

---

### 2.3 `elasticstack_elasticsearch_component_template`

Manages a component template (building block for composable index templates).

**HCL resource type**: `elasticstack_elasticsearch_component_template`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | Component template name |

#### Key optional arguments

| Argument | Type | Description |
|---|---|---|
| `template` | block | Settings, mappings, aliases (same structure as index template) |
| `version` | number | Component version |
| `_meta` | string | JSON string of arbitrary metadata |

#### Minimal example

```hcl
resource "elasticstack_elasticsearch_component_template" "logs_mappings" {
  name = "logs-mappings"

  template {
    mappings = jsonencode({
      properties = {
        "@timestamp" = { type = "date" }
        message      = { type = "text" }
        host         = { type = "keyword" }
      }
    })
  }
}
```

---

### 2.4 `elasticstack_elasticsearch_index_lifecycle`

Manages an ILM (Index Lifecycle Management) policy.

**HCL resource type**: `elasticstack_elasticsearch_index_lifecycle`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | Policy name |

#### Phase blocks

All phases are optional: `hot`, `warm`, `cold`, `frozen`, `delete`.

Each phase block takes a `min_age` string (e.g., `"7d"`, `"30d"`).

##### `hot` phase actions

```hcl
hot {
  min_age = "0ms"

  rollover {
    max_age               = "7d"
    max_primary_shard_size = "50gb"
    max_docs              = 1000000
  }

  set_priority {
    priority = 100
  }

  readonly {}           # mark index read-only
  shrink {
    number_of_shards = 1
  }
  forcemerge {
    max_num_segments = 1
  }
}
```

##### `warm` phase actions

```hcl
warm {
  min_age = "7d"

  allocate {
    number_of_replicas    = 1
    require               = jsonencode({ data = "warm" })
    include               = jsonencode({})
    exclude               = jsonencode({})
  }

  set_priority {
    priority = 50
  }

  shrink {
    number_of_shards = 1
  }

  forcemerge {
    max_num_segments = 1
  }

  readonly {}
}
```

##### `cold` phase actions

```hcl
cold {
  min_age = "30d"

  allocate {
    number_of_replicas = 0
    require            = jsonencode({ data = "cold" })
  }

  freeze {}   # deprecated in ES 8.x but still supported

  set_priority {
    priority = 0
  }

  readonly {}
}
```

##### `frozen` phase actions

```hcl
frozen {
  min_age = "60d"

  searchable_snapshot {
    snapshot_repository = "my-repo"
    force_merge_index   = true
  }
}
```

##### `delete` phase actions

```hcl
delete {
  min_age = "90d"

  delete {
    delete_searchable_snapshot = true
  }

  wait_for_snapshot {
    policy = "my-slm-policy"
  }
}
```

#### Full minimal example

```hcl
resource "elasticstack_elasticsearch_index_lifecycle" "logs_policy" {
  name = "logs-ilm-policy"

  hot {
    min_age = "0ms"
    rollover {
      max_age                = "7d"
      max_primary_shard_size = "50gb"
    }
    set_priority {
      priority = 100
    }
  }

  warm {
    min_age = "7d"
    set_priority {
      priority = 50
    }
    readonly {}
  }

  delete {
    min_age = "90d"
    delete {}
  }
}
```

---

### 2.5 `elasticstack_elasticsearch_snapshot_lifecycle`

Manages an SLM (Snapshot Lifecycle Management) policy.

**HCL resource type**: `elasticstack_elasticsearch_snapshot_lifecycle`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | SLM policy name |
| `snapshot_name` | string | Template for snapshot names (e.g., `"<snap-{now/d}>"`) |
| `repository` | string | Snapshot repository name |
| `schedule` | string | Cron expression for schedule |

#### Key optional arguments

| Argument | Type | Description |
|---|---|---|
| `indices` | list(string) | Indices to snapshot (default: all) |
| `include_global_state` | bool | Include cluster state |
| `ignore_unavailable` | bool | Ignore unavailable indices |
| `partial` | bool | Allow partial snapshots |
| `expire_after` | string | Snapshot retention period (e.g., `"30d"`) |
| `min_count` | number | Minimum snapshots to retain |
| `max_count` | number | Maximum snapshots to retain |
| `metadata` | string | JSON string of snapshot metadata |
| `feature_states` | list(string) | Feature states to include |

#### Minimal example

```hcl
resource "elasticstack_elasticsearch_snapshot_lifecycle" "daily_backup" {
  name          = "daily-backup"
  snapshot_name = "<snap-{now/d}>"
  repository    = elasticstack_elasticsearch_snapshot_repository.s3_repo.name
  schedule      = "0 30 1 * * ?"

  indices              = ["logs-*", "metrics-*"]
  include_global_state = false
  ignore_unavailable   = true

  expire_after = "30d"
  min_count    = 5
  max_count    = 50
}
```

---

### 2.6 `elasticstack_elasticsearch_snapshot_repository`

Manages a snapshot repository.

**HCL resource type**: `elasticstack_elasticsearch_snapshot_repository`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | Repository name |

#### Repository type blocks (exactly one required)

Only one type block may be specified per resource.

##### `fs` — Shared filesystem

```hcl
fs {
  location              = "/mnt/snapshots"
  compress              = true
  chunk_size            = "1gb"
  max_restore_rate      = "40mb"
  max_snapshot_rate     = "40mb"
  readonly              = false
}
```

##### `s3` — AWS S3

```hcl
s3 {
  bucket   = "my-es-snapshots"
  region   = "eu-west-1"
  base_path = "elasticsearch/snapshots"
  compress  = true
  # Additional: endpoint, access_key, secret_key, path_style_access, etc.
}
```

##### `gcs` — Google Cloud Storage

```hcl
gcs {
  bucket    = "my-es-snapshots"
  base_path = "elasticsearch/snapshots"
  compress  = true
}
```

##### `azure` — Azure Blob Storage

```hcl
azure {
  container = "my-es-snapshots"
  base_path = "elasticsearch/snapshots"
  compress  = true
}
```

##### `url` — Read-only URL repository

```hcl
url {
  url = "https://snapshots.example.com/repo"
}
```

##### `hdfs` — Hadoop HDFS

```hcl
hdfs {
  uri       = "hdfs://namenode:8020"
  path      = "/elasticsearch/snapshots"
  compress  = true
}
```

#### Minimal example (S3)

```hcl
resource "elasticstack_elasticsearch_snapshot_repository" "s3_repo" {
  name = "s3-backup-repo"

  s3 {
    bucket    = "my-cluster-snapshots"
    region    = "eu-west-1"
    base_path = "prod/snapshots"
    compress  = true
  }
}
```

---

### 2.7 `elasticstack_elasticsearch_index_alias`

Manages an alias as a standalone resource (separate from the index).

**HCL resource type**: `elasticstack_elasticsearch_index_alias`

#### Required arguments

| Argument | Type | Description |
|---|---|---|
| `name` | string | Alias name |
| `index` | string | Index or data stream name this alias points to |

#### Key optional arguments

| Argument | Type | Description |
|---|---|---|
| `filter` | string | JSON filter query |
| `routing` | string | Routing value |
| `index_routing` | string | Index-time routing value |
| `search_routing` | string | Search-time routing value |
| `is_write_index` | bool | Whether this is the write index for the alias |
| `is_hidden` | bool | Whether the alias is hidden |

> **Architecture note**: Unlike the inline `aliases` block inside `elasticstack_elasticsearch_index`, this standalone resource manages one alias-to-index mapping per resource block. Use the standalone resource when you need to manage aliases independently of the index lifecycle, or when managing aliases across multiple indices.

#### Minimal example

```hcl
resource "elasticstack_elasticsearch_index_alias" "logs_current" {
  name           = "logs-current"
  index          = elasticstack_elasticsearch_index.logs.name
  is_write_index = true
}
```

---

## 3. Additional Resources (Non-Core but Relevant)

### 3.1 `elasticstack_elasticsearch_data_stream`

Manages a data stream. Requires a matching index template with `data_stream {}` block.

```hcl
resource "elasticstack_elasticsearch_data_stream" "logs" {
  name = "logs-app-prod"
}
```

### 3.2 `elasticstack_elasticsearch_data_stream_lifecycle`

Manages the native data stream lifecycle (ES 8.x+) — separate from ILM.

```hcl
resource "elasticstack_elasticsearch_data_stream_lifecycle" "logs" {
  name         = "logs-app-prod"
  data_retention = "30d"
  enabled      = true
}
```

### 3.3 `elasticstack_elasticsearch_index_template_ilm_attachment`

Dedicated resource for attaching an ILM policy to an index template.

```hcl
resource "elasticstack_elasticsearch_index_template_ilm_attachment" "logs" {
  name       = "logs-template"
  policy     = elasticstack_elasticsearch_index_lifecycle.logs_policy.name
  alias_name = "logs-current"
}
```

### 3.4 `elasticstack_elasticsearch_ingest_pipeline`

Manages an ingest pipeline.

```hcl
resource "elasticstack_elasticsearch_ingest_pipeline" "logs_pipeline" {
  name        = "logs-parser"
  description = "Parse log messages"

  processors = jsonencode([
    {
      grok = {
        field   = "message"
        patterns = ["%{COMMONAPACHELOG}"]
      }
    },
    {
      date = {
        field   = "timestamp"
        formats = ["ISO8601"]
      }
    }
  ])
}
```

### 3.5 Security resources

```hcl
resource "elasticstack_elasticsearch_security_role" "read_logs" {
  name = "read-logs"

  indices {
    names      = ["logs-*"]
    privileges = ["read", "view_index_metadata"]
  }

  cluster = ["monitor"]
}
```

Also available: `elasticstack_elasticsearch_security_user`, `elasticstack_elasticsearch_security_role_mapping`, `elasticstack_elasticsearch_security_api_key`.

### 3.6 Kibana resources

`elasticstack_kibana_space`, `elasticstack_kibana_data_view`, `elasticstack_kibana_alerting_rule`, `elasticstack_kibana_action_connector`, `elasticstack_kibana_import_saved_objects`.

---

## 4. Data Sources

### Ingest processor builders (~30+ individual data sources)

These data sources generate JSON for individual ingest processors. They are composed together into a pipeline resource:

```hcl
data "elasticstack_elasticsearch_ingest_processor_set" "set_env" {
  field = "environment"
  value = "production"
}

data "elasticstack_elasticsearch_ingest_processor_grok" "parse_log" {
  field    = "message"
  patterns = ["%{COMMONAPACHELOG}"]
}

resource "elasticstack_elasticsearch_ingest_pipeline" "pipeline" {
  name = "my-pipeline"
  processors = jsonencode([
    jsondecode(data.elasticstack_elasticsearch_ingest_processor_set.set_env.json),
    jsondecode(data.elasticstack_elasticsearch_ingest_processor_grok.parse_log.json),
  ])
}
```

Available processor data sources include: `_append`, `_attachment`, ``bytes`, `_circle`, `_community_id`, `_convert`, `_csv`, `_date`, `_date_index_name`, `_dissect`, `_dot_expander`, `_drop`, `_enrich`, `_fail`, `_fingerprint`, `_foreach`, `_geoip`, `_grok`, `_gsub`, `_html_strip`, `_inference`, `_join`, `_json`, `_kv`, `_lowercase`, `_network_direction`, `_pipeline`, `_registered_domain`, `_remove`, `_rename`, `_script`, `_set`, `_set_security_user`, `_sort`, `_split`, `_trim`, `_uppercase`, `_uri_parts`, `_url_decode`, `_user_agent`.

### Other data sources

| Data source | Purpose |
|---|---|
| `elasticstack_elasticsearch_index` | Read index metadata |
| `elasticstack_elasticsearch_index_template` | Read index template |
| `elasticstack_elasticsearch_component_template` | Read component template |
| `elasticstack_elasticsearch_index_lifecycle` | Read ILM policy |
| `elasticstack_elasticsearch_snapshot_lifecycle` | Read SLM policy |
| `elasticstack_elasticsearch_snapshot_repository` | Read snapshot repo |
| `elasticstack_elasticsearch_security_role` | Read security role |
| `elasticstack_elasticsearch_security_user` | Read user |
| `elasticstack_elasticsearch_info` | Cluster version info |

---

## 5. Dependency Ordering for Secan Code Generation

When generating a complete Terraform configuration, resources must be ordered or use references so Terraform can resolve the dependency graph. Recommended order:

1. **Snapshot repository** (`elasticstack_elasticsearch_snapshot_repository`)
2. **Component templates** (`elasticstack_elasticsearch_component_template`)
3. **ILM policy** (`elasticstack_elasticsearch_index_lifecycle`)
4. **SLM policy** (`elasticstack_elasticsearch_snapshot_lifecycle`) — references snapshot repository
5. **Index template** (`elasticstack_elasticsearch_index_template`) — references component templates
6. **Ingest pipelines** (`elasticstack_elasticsearch_ingest_pipeline`)
7. **Indices / data streams** (`elasticstack_elasticsearch_index` / `elasticstack_elasticsearch_data_stream`) — reference index templates
8. **Standalone aliases** (`elasticstack_elasticsearch_index_alias`) — reference indices

Use `resource.type.name.attribute` references to encode dependencies:

```hcl
repository = elasticstack_elasticsearch_snapshot_repository.s3_repo.name
```

---

## 6. Common Caveats for Code Generation

| Concern | Detail |
|---|---|
| **Static index settings** | `number_of_shards`, `codec`, `number_of_routing_shards`, `routing_partition_size` are immutable after index creation. Terraform will error if a plan changes them. |
| **`settings` block deprecated** | Do not emit the `settings {}` block on `elasticstack_elasticsearch_index`. Use individual top-level fields. |
| **`deletion_protection`** | Defaults to `true` on index resources. Secan should expose this as an option. |
| **JSON fields** | `mappings`, `processors`, `filter`, `_meta`, `analysis`, `settings` (in template/component) are all **JSON strings** — use `jsonencode()` in HCL or emit them as `jsonencode(...)`. |
| **ILM `min_age` format** | Must be a valid Elasticsearch time unit string: `"0ms"`, `"1d"`, `"7d"`, `"30d"` etc. `"0ms"` is required for `hot` phase. |
| **SLM `schedule` format** | Uses Elasticsearch cron format (6 fields including seconds): `"0 30 1 * * ?"` |
| **Snapshot name templates** | Use `<snap-{now/d}>` format with angle brackets for date math. |
| **Alias uniqueness** | An index can have multiple aliases but each `elasticstack_elasticsearch_index_alias` resource manages one alias-to-index association. |
| **Data stream requirement** | `elasticstack_elasticsearch_data_stream` requires a matching index template with `data_stream {}` block to exist first. |
| **Provider version** | The provider repo has switched to continuous/nightly versioning (`v0.0.0-YYYYMMDD-*`). Use `~> 0.14` as the version constraint for stable pinning. |

---

## 7. Complete Example — Logs Stack

```hcl
terraform {
  required_providers {
    elasticstack = {
      source  = "elastic/elasticstack"
      version = "~> 0.14"
    }
  }
}

provider "elasticstack" {
  elasticsearch {
    username  = var.es_username
    password  = var.es_password
    endpoints = [var.es_endpoint]
  }
}

# Snapshot repository
resource "elasticstack_elasticsearch_snapshot_repository" "s3" {
  name = "s3-backup"
  s3 {
    bucket    = "my-cluster-snapshots"
    region    = "eu-west-1"
    base_path = "prod"
    compress  = true
  }
}

# ILM policy
resource "elasticstack_elasticsearch_index_lifecycle" "logs" {
  name = "logs-policy"

  hot {
    min_age = "0ms"
    rollover {
      max_age                = "7d"
      max_primary_shard_size = "50gb"
    }
    set_priority { priority = 100 }
  }

  warm {
    min_age  = "7d"
    readonly {}
    set_priority { priority = 50 }
  }

  cold {
    min_age  = "30d"
    allocate { number_of_replicas = 0 }
    set_priority { priority = 0 }
  }

  delete {
    min_age = "90d"
    delete {}
  }
}

# SLM policy
resource "elasticstack_elasticsearch_snapshot_lifecycle" "daily" {
  name          = "daily-backup"
  snapshot_name = "<snap-{now/d}>"
  repository    = elasticstack_elasticsearch_snapshot_repository.s3.name
  schedule      = "0 30 1 * * ?"

  indices              = ["logs-*"]
  include_global_state = false
  ignore_unavailable   = true
  expire_after         = "30d"
  min_count            = 5
  max_count            = 50
}

# Component template — mappings
resource "elasticstack_elasticsearch_component_template" "logs_mappings" {
  name = "logs-mappings"
  template {
    mappings = jsonencode({
      properties = {
        "@timestamp" = { type = "date" }
        message      = { type = "text" }
        level        = { type = "keyword" }
        service      = { type = "keyword" }
      }
    })
  }
}

# Component template — settings
resource "elasticstack_elasticsearch_component_template" "logs_settings" {
  name = "logs-settings"
  template {
    settings = jsonencode({
      number_of_shards   = 2
      number_of_replicas = 1
      refresh_interval   = "10s"
      "index.lifecycle.name"           = elasticstack_elasticsearch_index_lifecycle.logs.name
      "index.lifecycle.rollover_alias" = "logs-current"
    })
  }
}

# Index template
resource "elasticstack_elasticsearch_index_template" "logs" {
  name           = "logs-template"
  index_patterns = ["logs-*"]
  priority       = 100
  composed_of    = [
    elasticstack_elasticsearch_component_template.logs_mappings.name,
    elasticstack_elasticsearch_component_template.logs_settings.name,
  ]
}

# Bootstrap index
resource "elasticstack_elasticsearch_index" "logs_000001" {
  name               = "logs-app-000001"
  number_of_shards   = 2
  number_of_replicas = 1
  deletion_protection = false

  aliases {
    name           = "logs-current"
    is_write_index = true
  }
}
```

---

*Generated from `elastic/terraform-provider-elasticstack` documentation. Last reviewed: 2026-04-05.*
