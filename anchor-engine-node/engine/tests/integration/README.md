# Integration Tests

Integration tests for Anchor Engine that verify the system works end-to-end.

## Test Files

### Smoke Tests (P0)

| File | Purpose | Timeout |
|------|---------|---------|
| `search-pipeline.test.ts` | Circuit breaker + search pipeline | 5 min |
| `radial-distiller.test.ts` | Circuit breaker + distiller | 5 min |
| `memory-pressure.test.ts` | Circuit breaker + memory monitoring | 5 min |
| `mcp-server.test.ts` | Circuit breaker + MCP tools | 5 min |

**Run:**
```bash
pnpm test:vitest run integration --reporter=verbose
```

### Live Fire Tests (E2E)

| File | Purpose | Timeout |
|------|---------|---------|
| `live-fire.test.ts` | Full system workflow (server spawn, git clone, ingestion) | 5 min |
| `live-fire-results.test.ts` | Live fire with result logging | 5 min |
| `github-clone.test.ts` | GitHub repository cloning | 2 min |
| `search-results.test.ts` | Search API with real results | 1 min |
| `distillation-results.test.ts` | Distillation API with real outputs | 1 min |

**Run:**
```bash
pnpm test:vitest run integration/live-fire --reporter=verbose
```

### A/B Testing

| File | Purpose |
|------|---------|
| `github-history-search.vitest.ts` | FTS with commit history molecules |

**Run:**
```bash
pnpm test:vitest run integration/github-history-search --reporter=verbose
```

## Result Logging

All live fire tests log results to `.anchor/results/`:

```
.anchor/results/
├── search/
│   ├── engine-search-*.json
│   ├── typescript-search-*.json
│   └── ...
├── distillation/
│   ├── simple-distillation-*.json
│   └── ...
├── github-clone-*.json
├── ingestion-*.json
└── live-fire-*.json
```

## Test Structure

### P0 Tests
- Fast, targeted tests (<5 min)
- Circuit breaker integration
- Unit-style integration tests
- No server spawn

### Live Fire Tests
- Full end-to-end workflow
- Server spawn and cleanup
- Real API calls
- Result logging

### A/B Tests
- In-memory PGlite
- No network/file system
- FTS algorithm validation

## Requirements

- Node.js 22+
- Git (for live fire tests)
- Engine built (`pnpm build`)

## Environment Variables

| Variable | Description |
|----------|-------------|
| `ANCHOR_API_KEY` | API key for authenticated tests |
| `GITHUB_TOKEN` | GitHub token for cloning |
| `NODE_EXE` | Node executable path |

## Notes

- Live fire tests require a running engine or will spawn one
- Results are logged with timestamps for analysis
- Circuit breaker tests verify resilience patterns
- Memory pressure tests verify LRU eviction
