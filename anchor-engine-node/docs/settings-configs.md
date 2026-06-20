# Anchor Engine Settings Reference

**Date:** 2026-05-20  
**Purpose:** Consolidated reference for all `user_settings.json` configuration options

---

## Summary Table

| Setting Path | Default Value | Type | Category |
|--------------|---------------|------|----------|
| **Server** | | | |
| `server.host` | `"0.0.0.0"` | string | Server |
| `server.port` | `3160` | number | Server |
| `server.api_key` | `""` (empty) | string | Server |
| **GitHub** | | | |
| `github.token` | `"ghp_..."` (placeholder) | string | GitHub |
| `github.default_branch` | `"main"` | string | GitHub |
| **Paths** | | | |
| `paths.anchor_root` | `<ANCHOR_ROOT>` (placeholder) | string | Paths |
| *(derived)* | Auto-generated from root | - | Paths |
| **Encryption** | | | |
| `encryption.enabled` | `false` | boolean | Encryption |
| `encryption.auto_encrypt_on_ingest` | `true` | boolean | Encryption |
| `encryption.detect_nsfw` | `false` | boolean | Encryption |
| **Search** | | | |
| `search.strategy` | `"hybrid"` | string ('hybrid' \| 'semantic' \| 'exact') | Search |
| `search.max_chars_default` | `5000` | number | Search |
| `search.fts_window_size` | `1500` | number | Search |
| **Resource Management** | | | |
| `resource_management.gc_cooldown_ms` | `30000` (30s) | number | Resource Mgmt |
| `resource_management.max_atoms_in_memory` | `2000` | number | Resource Mgmt |
| `resource_management.monitoring_interval_ms` | `30000` (30s) | number | Resource Mgmt |
| **Memory Management** | | | |
| `memory.heap_pressure_mb` | `500` (env: ANCHOR_HEAP_PRESSURE_MB) | number | Memory |
| `memory.throttle_start_mb` | `800` (env: ANCHOR_THROTTLE_START_MB) | number | Memory |
| `memory.throttle_max_mb` | `1200` (env: ANCHOR_THROTTLE_MAX_MB) | number | Memory |
| `memory.emergency_stop_mb` | `1500` (env: ANCHOR_EMERGENCY_STOP_MB) | number | Memory |
| `memory.enable_streaming_results` | `true` | boolean | Memory |
| **Watcher** | | | |
| `watcher.debounce_ms` | `2000` (unused/legacy) | number | Watcher |
| `watcher.stability_threshold_ms` | `2000` (2s) | number | Watcher |
| `watcher.extra_paths` | `[]` (empty array) | string[] | Watcher |
| `watcher.auto_start` | `false` | boolean | Watcher |
| **Context & Inference** | | | |
| `context.relevance_weight` | `0.7` | number | Context |
| `context.recency_weight` | `0.3` | number | Context |
| **Limits** | | | |
| `limits.max_file_size_bytes` | `104857600` (~100MB) | number | Limits |
| `limits.max_content_length_chars` | `5000` | number | Limits |
| **Database** | | | |
| `database.wipe_on_startup` | `true` | boolean | Database |
| `database.shared_buffers_mb` | `256` | number | Database |
| `database.effective_cache_size_mb` | `512` | number | Database |
| `database.work_mem_mb` | `32` (code) / `16` (template) | number | Database |
| `database.maintenance_work_mem_mb` | `32` | number | Database |
| **Low Resource Mode** | | | |
| `low_resource.enabled` | `false` | boolean | Low Resource |
| **Ingestion** | | | |
| `ingestion.concept_density` | `"medium"` (env: ANCHOR_CONCEPT_DENSITY) | string ('low' \| 'medium' \| 'high') | Ingestion |
| `ingestion.tag_threshold` | `0.7` (env: ANCHOR_TAG_THRESHOLD) | number (0-1) | Ingestion |
| `ingestion.dedup_strength` | `"medium"` (env: ANCHOR_DEDUP_STRENGTH) | string ('light' \| 'medium' \| 'aggressive') | Ingestion |
| `ingestion.token_budget_default` | `2000` (env: ANCHOR_TOKEN_BUDGET_DEFAULT) | number | Ingestion |
| **MCP** | | | |
| `mcp.enabled` | `true` | boolean | MCP |
| `mcp.require_api_key` | `false` | boolean | MCP |
| **Agent Memory** | | | |
| `agent_memory.auto_distill` | `true` | boolean | Agent Memory |
| `agent_memory.checkpoint_interval_messages` | `50` | number | Agent Memory |
| **Logging** | | | |
| `logging.level` | `"info"` | string ('debug' \| 'info' \| 'warn' \| 'error') | Logging |
| `logging.structured` | `true` | boolean | Logging |

---

## Server Configuration

Network and server binding settings.

### `server.host`
- **Default:** `"0.0.0.0"`
- **Description:** Network interface the server binds to
- **When to change:** Use `"127.0.0.1"` for local-only development; use `"0.0.0.0"` for production with proper firewall rules

### `server.port`
- **Default:** `3160`
- **Description:** Port number the server listens on
- **Why this default:** Uncommon port reduces collision risk, in typical API range (80-9000)

### `server.api_key`
- **Default:** `""` (empty - optional)
- **Description:** Optional API key for authentication
- **Security implication:** Empty = no auth required. Enable for production with sensitive data

---

## GitHub Authentication

Settings for cloning and interacting with GitHub repositories.

### `github.token`
- **Default:** `"ghp_YOUR_PERSONAL_ACCESS_TOKEN_HERE"` (placeholder)
- **Description:** GitHub Personal Access Token for cloning private repos and higher rate limits
- **Security implication:** **NEVER commit to git!** Store in `user_settings.json` (gitignored) or use environment variable
- **Required scopes:** `'repo'` for private repos, `'public_repo'` for public-only access

### `github.default_branch`
- **Default:** `"main"`
- **Description:** Default branch to checkout when cloning repos
- **Why this default:** "main" is modern standard (replaced "master")

---

## Path Configuration

All paths are relative to `anchor_root` unless specified as absolute.

### `paths.anchor_root`
- **Default:** `<ANCHOR_ROOT>` (placeholder)
- **Description:** Base directory for all Anchor Engine data
- **Recommendation:** Use a dedicated directory like `~/anchored_data` or `~/.anchor`

### Derived Paths
The following paths are automatically derived from `anchor_root`:
- `paths.notebook`, `paths.inbox`, `paths.external_inbox`, and others

---

## Encryption Settings

End-to-end encryption configuration for sensitive content.

### `encryption.enabled`
- **Default:** `false`
- **Description:** Enable end-to-end encryption for sensitive content
- **Security implication:** When enabled, all content is encrypted at rest and in transit

### `encryption.auto_encrypt_on_ingest`
- **Default:** `true`
- **Description:** Automatically encrypt content during ingestion
- **Why this default:** Security-first approach - encrypt by default

### `encryption.detect_nsfw`
- **Default:** `false`
- **Description:** Enable NSFW (Not Safe For Work) content detection
- **Security implication:** Disabled to avoid false positives and privacy concerns

---

## Search Configuration

Search algorithm and query processing settings.

### `search.strategy`
- **Default:** `"hybrid"`
- **Type:** string (`'hybrid' | 'semantic' | 'exact'`)
- **Description:** Selects search algorithm strategy to use
- **Options:**
  - `"hybrid"`: Uses both semantic and exact matching (default)
  - `"semantic"`: Vector-based search only
  - `"exact"`: FTS-only precise lookups

### `search.max_chars_default`
- **Default:** `5000` (~1.25k tokens)
- **Description:** Maximum characters to process per search query by default
- **Why this default:** Mobile-friendly design - lower limit for bandwidth-constrained users

### `search.fts_window_size`
- **Default:** `1500` tokens (~375 words)
- **Description:** Window size for full-text search token overlap analysis
- **Impact:** Larger windows = more context but slower search

---

## Resource Management

Garbage collection and memory pressure monitoring settings.

### `resource_management.gc_cooldown_ms`
- **Default:** `30000` (30 seconds)
- **Description:** Cooldown period between forced garbage collection cycles
- **Impact:** Prevents excessive GC that could slow down operations

### `resource_management.max_atoms_in_memory`
- **Default:** `2000`
- **Description:** Maximum atoms to keep in memory at once before eviction
- **Tradeoff:** Higher values = more memory usage but better search performance

### `resource_management.monitoring_interval_ms`
- **Default:** `30000` (30 seconds)
- **Description:** Interval for resource monitoring checks
- **Impact:** Balances responsiveness with CPU overhead

---

## Memory Management

Heap pressure thresholds and streaming settings. Many can be overridden via environment variables.

### `memory.heap_pressure_mb`
- **Default:** `500` (env: `ANCHOR_HEAP_PRESSURE_MB`)
- **Description:** Heap memory level that triggers "high pressure" state
- **Impact:** Triggers aggressive memory management when heap usage exceeds this threshold

### `memory.throttle_start_mb`
- **Default:** `800` (env: `ANCHOR_THROTTLE_START_MB`)
- **Description:** Heap memory level that triggers throttling of non-critical operations
- **Behavior:** Below this = normal operation; above = start limiting features

### `memory.throttle_max_mb`
- **Default:** `1200` (env: `ANCHOR_THROTTLE_MAX_MB`)
- **Description:** Maximum heap memory before aggressive throttling kicks in
- **Behavior:** Between throttle_start and throttle_max = moderate throttling; above = aggressive

### `memory.emergency_stop_mb`
- **Default:** `1500` (env: `ANCHOR_EMERGENCY_STOP_MB`)
- **Description:** Critical heap memory level that triggers emergency stop measures
- **Impact:** Last line of defense before OOM errors - stops all non-critical operations

### `memory.enable_streaming_results`
- **Default:** `true`
- **Description:** Enable streaming search results instead of loading all at once
- **Benefit:** Reduces memory usage for large result sets

---

## Watcher (File Watching)

Automated file change detection and ingestion settings.

### `watcher.debounce_ms`
- **Default:** `2000` ms (from template, unused/legacy in code)
- **Description:** Debounce delay for file change detection
- **Note:** Not directly used - actual debouncing uses separate constant `INGESTION_DEBOUNCE_MS = 30000`

### `watcher.stability_threshold_ms`
- **Default:** `2000` ms (2 seconds)
- **Description:** Chokidar's `awaitWriteFinish.stabilityThreshold` - waits this many ms after file write completes before triggering ingestion event
- **Tradeoff:** Lower = faster response but risk of incomplete files; Higher = more reliable but slower

### `watcher.extra_paths`
- **Default:** `[]` (empty array)
- **Description:** Additional directories to watch beyond default inbox/external-inbox
- **Usage:** Set in `user_settings.json`: `"watcher": { "extra_paths": ["./my-custom-dir"] }`
- **Endpoints:** Dynamically managed via `/v1/watchdog/add-path` and `/v1/watchdog/remove-path`

### `watcher.auto_start`
- **Default:** `false`
- **Description:** Controls whether watchdog starts automatically on server startup
- **Security consideration:** User wants this OFF by default for safety - prevents automatic ingestion when server starts with potentially bad/empty paths
- **Enable via:** Environment variable `AUTO_START_WATCHDOG=true` OR settings file

---

## Context & Inference

Relevance scoring weights for context selection.

### `context.relevance_weight`
- **Default:** `0.7`
- **Description:** Weight given to relevance signals in context scoring

### `context.recency_weight`
- **Default:** `0.3`
- **Description:** Weight given to recency signals in context scoring
- **Tradeoff:** Lower weight means older but relevant content still considered valuable

---

## Limits & Thresholds

Input validation and resource limits.

### `limits.max_file_size_bytes`
- **Default:** `104857600` (~100MB)
- **Description:** Maximum file size accepted during ingestion
- **Purpose:** Prevents extremely large files from consuming excessive resources

### `limits.max_content_length_chars`
- **Default:** `5000`
- **Description:** Maximum content length for API requests
- **Purpose:** Reasonable limit to prevent abuse and resource exhaustion

---

## Database Configuration

PostgreSQL performance tuning settings. Note: Comments in code incorrectly reference SQLite - these are PostgreSQL configs.

### `database.wipe_on_startup`
- **Default:** `true`
- **Description:** Controls whether database is wiped and rebuilt on server startup
- **Security consideration:** `true` means fresh database each start - prevents data persistence across restarts
- **Note:** Setting to `false` retains existing database but index may become stale if schema changed

### `database.shared_buffers_mb`
- **Default:** `256` MB
- **Description:** PostgreSQL shared buffer cache size - memory for database caching
- **Performance tuning:** Higher values improve query performance but use more RAM
- **Fallback:** Falls back to 64MB if not configured

### `database.effective_cache_size_mb`
- **Default:** `512` MB
- **Description:** PostgreSQL effective cache size hint - helps query planner optimize queries
- **Recommendation:** Should be set to ~50% of available RAM for best results
- **Note:** This is a hint only - doesn't actually allocate memory

### `database.work_mem_mb`
- **Default:** `32` MB (code) / `16` MB (template mismatch)
- **Description:** PostgreSQL work memory for sorts and hashes - larger = faster complex queries
- **Tradeoff:** Larger values speed up sorts/hashes but use more memory per operation
- **Risk:** OOM errors if set too high for available RAM

### `database.maintenance_work_mem_mb` (BONUS DISCOVERY)
- **Default:** `32` MB
- **Description:** PostgreSQL maintenance operations memory (VACUUM, CREATE INDEX)
- **Note:** Not in original template - added for completeness

---

## Low Resource Mode

Optimized settings for systems with limited resources.

### `low_resource.enabled`
- **Default:** `false`
- **Description:** Enable optimized mode for systems with limited resources
- **When enabled:**
  - Lower recall thresholds (5-20 results instead of higher)
  - Reduced concurrency (1 worker)
  - Smaller batch sizes for ingestion and search

---

## Ingestion Settings

Content processing and concept extraction settings. Many can be overridden via environment variables.

### `ingestion.concept_density`
- **Default:** `"medium"` (env: `ANCHOR_CONCEPT_DENSITY`)
- **Type:** string (`'low' | 'medium' | 'high'`)
- **Description:** Controls how densely concepts are extracted from content
- **Options:**
  - `"high"`: More concepts extracted (better recall, higher token usage)
  - `"low"`: Fewer concepts (faster ingestion, lower recall)

### `ingestion.tag_threshold`
- **Default:** `0.7` (env: `ANCHOR_TAG_THRESHOLD`)
- **Type:** number (0-1)
- **Description:** Minimum similarity score for a token to be considered a meaningful concept
- **Impact:** Higher threshold = fewer, more precise tags; Lower = more tags but potentially noisy

### `ingestion.dedup_strength`
- **Default:** `"medium"` (env: `ANCHOR_DEDUP_STRENGTH`)
- **Type:** string (`'light' | 'medium' | 'aggressive'`)
- **Description:** Controls aggressiveness of duplicate content detection during ingestion
- **Options:**
  - `"aggressive"`: More duplicates removed (cleaner index, slower ingestion)
  - `"light"`: Fewer duplicates removed (faster ingestion, potentially redundant content)

### `ingestion.token_budget_default`
- **Default:** `2000` (env: `ANCHOR_TOKEN_BUDGET_DEFAULT`)
- **Description:** Default token budget for content processing during ingestion
- **Impact:** Higher budget = more content per request but higher cost/latency

---

## MCP (Model Context Protocol)

Settings for the Model Context Protocol server.

### `mcp.enabled`
- **Default:** `true`
- **Description:** Enable Model Context Protocol server for AI agent memory
- **When to disable:** If not using advanced AI agent features

### `mcp.require_api_key`
- **Default:** `false`
- **Description:** Require API key to access MCP endpoints
- **Security implication:** False = open access; enable for production security

---

## Agent Memory

Conversation distillation and memory management settings.

### `agent_memory.auto_distill`
- **Default:** `true`
- **Description:** Automatically distill agent conversations periodically
- **Benefit:** Maintains conversation history without manual intervention

### `agent_memory.checkpoint_interval_messages`
- **Default:** `50` messages
- **Description:** Number of messages between distillation checkpoints
- **Tradeoff:** Balances memory usage with conversation fidelity

---

## Logging Configuration

Log level and format settings.

### `logging.level`
- **Default:** `"info"`
- **Type:** string (`'debug' | 'info' | 'warn' | 'error'`)
- **Description:** Log level for output verbosity

### `logging.structured`
- **Default:** `true`
- **Description:** Enable structured JSON logging format
- **Benefit:** Structured logs are easier to parse and analyze programmatically

---

## Related Documentation

- [01-watcher-settings.md](./01-watcher-settings.md) - Detailed watcher configuration exploration
- [02-database-settings.md](./02-database-settings.md) - Database performance tuning details
- [03-resource-memory-settings.md](./03-resource-memory-settings.md) - Resource limits and memory management
- [04-search-ingestion-settings.md](./04-search-ingestion-settings.md) - Search algorithms and ingestion quality
- [05-user-settings-map.md](./05-user-settings-map.md) - Complete settings map with reasoning

---

## Security Recommendations

### Critical Settings to Configure for Production

1. **`github.token`** - Never commit to git, use environment variable or local settings file
2. **`server.api_key`** - Enable for production with sensitive data
3. **`mcp.require_api_key`** - Enable for MCP endpoints in production
4. **`encryption.enabled`** - Consider enabling for sensitive content

### Common Pitfalls to Avoid

- Don't set `database.wipe_on_startup=false` without understanding implications (index may become stale)
- Don't enable `encryption.enabled` without proper password management
- Don't commit `user_settings.json` to git - it's in `.gitignore`
- Be cautious with `watcher.auto_start=true` - prevents automatic ingestion when server starts with bad paths

---

## Environment Variable Overrides

Many settings can be overridden via environment variables for deployment flexibility:

| Setting | Env Var | Description |
|---------|---------|-------------|
| `memory.heap_pressure_mb` | `ANCHOR_HEAP_PRESSURE_MB` | Heap pressure threshold |
| `memory.throttle_start_mb` | `ANCHOR_THROTTLE_START_MB` | Throttling start point |
| `memory.throttle_max_mb` | `ANCHOR_THROTTLE_MAX_MB` | Aggressive throttling point |
| `memory.emergency_stop_mb` | `ANCHOR_EMERGENCY_STOP_MB` | Emergency stop threshold |
| `search.strategy` | N/A | Search algorithm selection |
| `ingestion.concept_density` | `ANCHOR_CONCEPT_DENSITY` | Concept extraction density |
| `ingestion.tag_threshold` | `ANCHOR_TAG_THRESHOLD` | Tag similarity threshold |
| `ingestion.dedup_strength` | `ANCHOR_DEDUP_STRENGTH` | Duplicate detection strength |
| `ingestion.token_budget_default` | `ANCHOR_TOKEN_BUDGET_DEFAULT` | Token budget for ingestion |
| `watcher.auto_start` | `AUTO_START_WATCHDOG` | Auto-start watchdog service |

---

*Generated from consolidated settings exploration reports. Last updated: 2026-05-20*
