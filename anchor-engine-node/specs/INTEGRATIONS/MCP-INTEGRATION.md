# MCP Integration Guide

**Version:** 4.9.5 | **Last Updated:** 2026-03-25

Complete guide for integrating Anchor Engine with MCP-compatible AI agents.

---

## Table of Contents

- [What is MCP?](#what-is-mcp)
- [Quick Start](#quick-start)
- [Installation](#installation)
- [Configuration](#configuration)
- [Available Tools](#available-tools)
- [Client Setup](#client-setup)
- [Security](#security)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## What is MCP?

**MCP (Model Context Protocol)** is a standard protocol for AI agents to interact with external tools and services. Anchor Engine implements an MCP server that provides:

- **Persistent Memory** - Your knowledge graph accessible to any MCP client
- **Semantic Search** - Query your memory with natural language
- **Knowledge Distillation** - Compress conversations into source-of-truth files
- **Graph Exploration** - Discover connected concepts via BFS traversal
- **File Operations** - Read files efficiently with line ranges

### Supported Clients

| Client | Configuration | Status |
|--------|---------------|--------|
| **Claude Desktop** | `claude_desktop_config.json` | ✅ Supported |
| **Cursor** | `.cursor/mcp.json` | ✅ Supported |
| **Qwen Code** | `.qwen/settings.json` | ✅ Supported |
| **Cline** | Custom MCP config | ✅ Supported |
| **Windsurf** | MCP settings | ✅ Supported |

---

## Quick Start

### 1. Install Anchor Engine

```bash
# Clone repository
git clone https://github.com/RSBalchII/anchor-engine-node.git
cd anchor-engine-node

# Install dependencies
pnpm install

# Build all packages
pnpm build:all
```

### 2. Start the Engine

```bash
# Start the main engine (required for MCP)
pnpm start
```

Keep this running in the background.

### 3. Configure Your AI Client

**For Claude Desktop:**

Add to `~/.config/claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "anchor": {
      "command": "node",
      "args": ["/path/to/anchor-engine-node/mcp-server/dist/index.js"],
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160"
      }
    }
  }
}
```

### 4. Test the Connection

In your AI client, try:

```
/anchor_get_stats
```

You should see your knowledge graph statistics.

---

## Installation

### Option 1: From Source (Recommended)

```bash
# Clone repository
git clone https://github.com/RSBalchII/anchor-engine-node.git
cd anchor-engine-node

# Install dependencies
pnpm install

# Build
pnpm build:all

# Verify installation
node mcp-server/dist/index.js --version
```

### Option 2: Global NPM Install

```bash
# Install globally
npm install -g @rbalchii/anchor-engine

# Verify
anchor-mcp --version
```

### Option 3: Use npx (No Install)

```bash
# Run directly with npx
npx @rbalchii/anchor-engine mcp
```

**Note:** npx adds startup latency. For best performance, install locally.

---

## Configuration

### Engine Configuration

Create `user_settings.json` in the project root:

```json
{
  "server": {
    "port": 3160,
    "api_key": "your-secret-key-here"
  },
  "mcp": {
    "enabled": true,
    "allow_write_operations": false,
    "default_bucket_for_writes": "external-inbox",
    "rate_limit_requests_per_minute": 60,
    "max_query_results": 50,
    "restrict_to_localhost": true
  }
}
```

### Configuration Options

#### Server Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `server.port` | integer | 3160 | Engine HTTP port |
| `server.api_key` | string | `null` | API key for authentication |

#### MCP Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `mcp.enabled` | boolean | `true` | Enable/disable MCP server |
| `mcp.allow_write_operations` | boolean | `false` | Allow write operations (ingest) |
| `mcp.default_bucket_for_writes` | string | `"external-inbox"` | Default bucket for writes |
| `mcp.rate_limit_requests_per_minute` | integer | 60 | Rate limit for MCP requests |
| `mcp.max_query_results` | integer | 50 | Maximum results per query |
| `mcp.restrict_to_localhost` | boolean | `true` | Only accept local connections |

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ANCHOR_API_URL` | `http://localhost:3160` | Engine API endpoint |
| `ANCHOR_API_KEY` | `null` | API key for authentication |
| `NODE_ENV` | `production` | Environment mode |

---

## Available Tools

### Read Operations (Always Available)

#### `anchor_query`

Search your knowledge graph with natural language.

**Parameters:**
- `query` (string, required): Search query
- `max_results` (integer, optional): Maximum results (default: 10)
- `strategy` (string, optional): `"standard"`, `"max-recall"`, `"exact"`

**Example:**
```json
{
  "query": "OAuth authentication setup",
  "max_results": 10,
  "strategy": "standard"
}
```

**Search Prefixes:**

| Prefix | Description |
|--------|-------------|
| `distill:` | Lossless semantic compression |
| `illuminate:` | BFS graph traversal |
| `explore:` | Alias for illuminate |
| `deep:` | Max-recall multi-hop search |
| `exact:` | FTS only, no physics scoring |

**Example with prefix:**
```json
{
  "query": "distill: machine learning patterns",
  "max_results": 20
}
```

---

#### `anchor_distill`

Create compressed knowledge summaries.

**Parameters:**
- `seed` (object, required): Seed query configuration
  - `query` (string): Search query
- `radius` (integer, optional): Graph radius (default: 3)
- `max_nodes` (integer, optional): Maximum nodes (default: 500)
- `output_format` (string, optional): `"yaml"`, `"md"`, `"json"`

**Example:**
```json
{
  "seed": {
    "query": "career planning"
  },
  "radius": 3,
  "max_nodes": 500,
  "output_format": "yaml"
}
```

---

#### `anchor_illuminate`

Explore connected concepts via BFS traversal.

**Parameters:**
- `seed` (object, required): Seed configuration
  - `query` (string): Seed query
  - `limit_seeds` (integer): Number of seed atoms
- `depth` (integer, optional): Maximum depth (default: 3)
- `max_nodes` (integer, optional): Maximum nodes (default: 50)

**Example:**
```json
{
  "seed": {
    "query": "agent frameworks",
    "limit_seeds": 8
  },
  "depth": 3,
  "max_nodes": 50
}
```

---

#### `anchor_read_file`

Read files efficiently with line ranges.

**Parameters:**
- `path` (string, required): File path
- `start_line` (integer, optional): Start line (default: 0)
- `end_line` (integer, optional): End line (exclusive)

**Example:**
```json
{
  "path": "inbox/distilled/distilled_2026-03-25.yaml",
  "start_line": 0,
  "end_line": 100
}
```

---

#### `anchor_list_compounds`

List available source files.

**Parameters:**
- `filter` (string, optional): Filter by filename pattern
- `limit` (integer, optional): Maximum results (default: 50)

**Example:**
```json
{
  "filter": "meeting",
  "limit": 20
}
```

---

#### `anchor_get_stats`

Get system statistics.

**Parameters:** None

**Example:**
```json
{}
```

---

### Write Operations (Opt-In)

**Note:** Write operations must be explicitly enabled in `user_settings.json`.

#### `anchor_ingest_text`

Ingest raw text content.

**Parameters:**
- `content` (string, required): Raw text content
- `filename` (string, required): Filename for provenance
- `bucket` (string, optional): `"inbox"` or `"external-inbox"` (default: `"external-inbox"`)
- `tags` (array, optional): Manual tags

**Example:**
```json
{
  "content": "Meeting notes from today...\n\nAction items:\n1. Review PR #123",
  "filename": "meeting-2026-03-25.md",
  "bucket": "inbox",
  "tags": ["meetings", "action-items"]
}
```

**Bucket Selection:**

| Bucket | Use Case | Retrieval Boost |
|--------|----------|-----------------|
| `inbox` | Content you created (sovereign) | 3.0x |
| `external-inbox` | External content (imported) | 1.0x |

---

#### `anchor_ingest_file`

Ingest files from filesystem.

**Parameters:**
- `path` (string, required): Absolute or relative file path
- `bucket` (string, optional): `"inbox"` or `"external-inbox"` (default: `"external-inbox"`)
- `delete_original` (boolean, optional): Delete after ingestion (default: `false`)

**Example:**
```json
{
  "path": "/home/user/notes/meeting.md",
  "bucket": "inbox"
}
```

---

#### `anchor_github_ingest` (v4.9.0+)

Ingest GitHub repositories with optional code analysis.

**Parameters:**
- `url` (string, required): GitHub repository URL
- `branch` (string, optional): Branch to ingest (default: `main`)
- `bucket` (string, optional): Bucket for content (default: `code`)
- `run_analysis` (boolean, optional): Run code analysis (default: `false`)
- `include_history` (boolean, optional): Include commit history (default: `true`)

**Example:**
```json
{
  "url": "https://github.com/user/repo",
  "branch": "main",
  "run_analysis": true,
  "include_history": true
}
```

**Code Analysis Features:**
- ESLint (JS/TS)
- ts-prune (unused exports)
- dependency-cruiser (module dependencies)
- jscpd (duplicate code detection)

---

## Client Setup

### Claude Desktop

**Configuration File:** `~/.config/claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "anchor": {
      "command": "node",
      "args": ["/path/to/anchor-engine-node/mcp-server/dist/index.js"],
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160",
        "ANCHOR_API_KEY": "your-api-key"
      }
    }
  }
}
```

**For global install:**
```json
{
  "mcpServers": {
    "anchor": {
      "command": "anchor-mcp",
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160"
      }
    }
  }
}
```

**Restart Claude Desktop** after configuration changes.

---

### Cursor

**Configuration File:** `~/.cursor/mcp.json` (or project-level `.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "anchor": {
      "command": "node",
      "args": ["/path/to/anchor-engine-node/mcp-server/dist/index.js"],
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160"
      }
    }
  }
}
```

**Reload Cursor** after configuration changes.

---

### Qwen Code

**Configuration File:** `~/.qwen/settings.json` or project-level `.qwen/settings.json`

```json
{
  "mcp": {
    "servers": [
      {
        "name": "anchor",
        "command": "node",
        "args": ["/path/to/anchor-engine-node/mcp-server/dist/index.js"],
        "env": {
          "ANCHOR_API_URL": "http://localhost:3160"
        }
      }
    ]
  }
}
```

**Usage in chat:**
```
/anchor_query query="What did we decide about authentication?"
```

---

### Cline

**Configuration:** Cline MCP settings (via UI or config file)

```json
{
  "mcpServers": {
    "anchor": {
      "command": "node",
      "args": ["/path/to/anchor-engine-node/mcp-server/dist/index.js"],
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160"
      }
    }
  }
}
```

---

### Windsurf

**Configuration:** Windsurf MCP settings

```json
{
  "mcpServers": {
    "anchor": {
      "command": "anchor-mcp",
      "env": {
        "ANCHOR_API_URL": "http://localhost:3160"
      }
    }
  }
}
```

---

## Security

### Security Features

| Feature | Description | Default |
|---------|-------------|---------|
| **Write Operations Toggle** | Enable/disable ingest operations | Disabled |
| **Rate Limiting** | Requests per minute | 60/min |
| **API Key Auth** | Optional authentication | Optional |
| **Localhost Restriction** | Only local connections | Enabled |
| **Bucket Safety** | Default to external-inbox | Enabled |

### Recommended Security Setup

For production or shared environments:

```json
{
  "mcp": {
    "enabled": true,
    "require_api_key": true,
    "api_key": "<generate-random-key>",
    "rate_limit_requests_per_minute": 30,
    "max_query_results": 20,
    "restrict_to_localhost": true,
    "allow_write_operations": false,
    "allowed_operations": ["query", "get_stats", "read_file"],
    "blocked_operations": ["distill", "illuminate", "ingest_text", "ingest_file"]
  }
}
```

### Enable Write Operations Safely

Only enable write operations for trusted agents:

```json
{
  "mcp": {
    "allow_write_operations": true,
    "default_bucket_for_writes": "external-inbox",
    "rate_limit_requests_per_minute": 20
  }
}
```

**Best Practices:**
1. Start with write operations **disabled**
2. Use `external-inbox` bucket for untrusted content
3. Review ingested content before moving to `inbox`
4. Set rate limits to prevent abuse
5. Use API keys in multi-user environments

---

## Best Practices

### Token-Efficient Workflow

1. **Distill First:**
   ```
   /anchor_distill seed={"query": "machine learning"} radius=3
   ```

2. **Read in Chunks:**
   ```
   /anchor_read_file path="distills/distilled_2026-03-25.yaml" start_line=0 end_line=100
   ```

3. **Search Within Results:**
   ```
   /anchor_query query="neural networks in distilled file"
   ```

This approach saves massive token budgets compared to retrieving full context.

---

### Query Optimization

**Good Queries:**
- ✅ "OAuth setup for GitHub integration"
- ✅ "Career planning discussion from last week"
- ✅ "Architecture decisions about PGlite"

**Bad Queries:**
- ❌ "stuff"
- ❌ "that thing we talked about"
- ❌ "everything about databases"

---

### Bucket Strategy

| Use Case | Bucket | Rationale |
|----------|--------|-----------|
| Personal notes | `inbox` | Sovereign content, 3.0x boost |
| Meeting notes you wrote | `inbox` | Your content |
| Downloaded articles | `external-inbox` | External content |
| Web scrapes | `external-inbox` | External content |
| Code from projects | `inbox` | Your code |
| Third-party code | `external-inbox` | External code |

---

### Session Management

For long conversations, periodically distill:

```
Every 20-30 messages:
/anchor_distill seed={"query": "current session topic"} radius=2
```

This creates checkpoints you can reference later.

---

## Troubleshooting

### "Not Connected" Error

**Symptoms:** Tools return "Not connected" but engine is running

**Solution:** Check port mismatch

```bash
# Verify engine port
curl http://localhost:3160/health

# Check MCP config
grep ANCHOR_API_URL ~/.qwen/mcp.json
```

Ensure ports match.

---

### Write Operations Disabled

**Error:** "Write operations are disabled"

**Solution:** Enable in `user_settings.json`:

```json
{
  "mcp": {
    "allow_write_operations": true
  }
}
```

---

### MCP Server Won't Start

**Symptoms:** MCP server fails to start

**Solutions:**

1. **Check engine is running:**
   ```bash
   curl http://localhost:3160/health
   ```

2. **Rebuild MCP server:**
   ```bash
   cd mcp-server
   pnpm build
   ```

3. **Check logs:**
   ```bash
   tail -f mcp-server/logs/*.log
   ```

---

### Tools Not Showing

**Symptoms:** MCP connects but tools don't appear

**Solutions:**

1. **Restart MCP server**
2. **Restart AI client**
3. **Check MCP protocol version compatibility**

---

### Rate Limit Exceeded

**Error:** "Rate limit exceeded"

**Solutions:**

1. **Increase limit:**
   ```json
   {
     "mcp": {
       "rate_limit_requests_per_minute": 100
     }
   }
   ```

2. **Add delays between requests**
3. **Batch operations when possible**

---

## Examples

### Quick Demo (2 Minutes)

```bash
# 1. Start engine
pnpm start &

# 2. Ingest via API (for demo)
curl -X POST http://localhost:3160/v1/research/upload-raw \
  -H "Content-Type: application/json" \
  -d '{
    "content": "The STAR algorithm uses physics-based scoring with temporal decay.",
    "filename": "star-notes.md",
    "bucket": "inbox"
  }'

# 3. In your AI client:
/anchor_query query="STAR algorithm physics"
```

### Production Workflow

```
# Morning standup notes
/anchor_ingest_text 
  content="Standup 2026-03-25: Working on MCP integration..."
  filename="standup-2026-03-25.md"
  bucket="inbox"

# Research session
/anchor_query query="MCP protocol specification"

# Distill key findings
/anchor_distill 
  seed={"query": "MCP integration patterns"}
  radius=3
  output_format="md"

# Read distilled summary
/anchor_read_file 
  path="distills/distilled_2026-03-25.md"
  start_line=0
  end_line=50
```

---

## Related Documentation

- [API Endpoints Reference](../api/endpoints.md) - Complete HTTP API reference
- [Common Issues](../troubleshooting/common-issues.md) - Troubleshooting guide
- [MCP Server README](../../mcp-server/README.md) - Detailed MCP documentation
- [Configuration Guide](../CONFIGURATION_SINGLE_SOURCE_OF_TRUTH.md) - Settings reference

---

## Changelog

### 2026-03-25 (v4.9.5)
- Added GitHub ingestion with code analysis
- Updated client configuration examples
- Added security best practices

### 2026-03-18 (v4.8.0)
- Added write operations (ingest_text, ingest_file)
- Added bucket selection guide
- Updated security configuration
