# Live-Fire Test Suite for Anchor Engine v5.2.0

## Overview

This test suite performs end-to-end integration testing against a live Anchor Engine server. It validates the full API surface including the STAR search pipeline, ingestion, schema integrity, density-prefix RAG tiers, and live-corpus data.

**Canonical runner:** `live-fire.mjs` — the single source of truth.  
**Deprecated runners:** `run-tests.js` (CJS) and `live-fire-test-suite.mjs` (ESM) — retained for backward compatibility, will be removed.

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Node.js | v18.0.0 or later |
| Anchor Engine running | `pnpm start` on port 3160 |
| Live corpus (optional) | Configure `watcher.extra_paths` in `~/.anchor/user_settings.json` |

## Quick Start

```bash
# 1. Start the engine (if not running)
pnpm start

# 2. Run all live-fire tests
node engine/tests/live-fire/live-fire.mjs
```

## Test Coverage (18 tests)

### Core API (8 tests)
1. **Health check** — `GET /health` returns 200
2. **Stats endpoint** — `GET /v1/stats` returns 200
3. **Molecules list + schema** — Verifies `source_path` and `provenance` fields
4. **Atoms list** — Verifies atoms endpoint responds
5. **Compounds table removed** — Standard 051 migration: `GET /v1/compounds` returns 404
6. **Search API** — `POST /v1/memory/search` works
7. **Exact search API** — `POST /v1/exact/search` works
8. **Semantic search API** — `POST /v1/semantic/search` works

### Density Prefix (3 tests)
9. **Density: full map** — `POST /v1/memory/search {"query":"density:"}` returns atom/tag density
10. **Density: single term** — `POST /v1/memory/search {"query":"density:test"}` returns `density_tier`
11. **Density: multi-term** — `POST /v1/memory/search {"query":"density:contract,liability"}` returns per-term analysis

### Ingestion Pipeline (2 tests)
12. **Ingestion pipeline** — `POST /v1/ingest` creates a test document
13. **Search after ingestion** — Verifies newly ingested content is retrievable

### Distillation (2 tests)
14. **Distillation API** — `GET /v1/distills` returns 200
15. **Radial distillation** — `POST /v1/distillation/radial` works

### Live Corpus (3 tests)
16. **Live corpus config** — Reads `~/.anchor/user_settings.json`, enumerates `watcher.extra_paths` and data directories
17. **Live corpus stats** — Verifies `GET /v1/stats` reflects ingested data counts
18. **Live corpus density** — Runs `density:` queries against terms likely in live data

## Live Corpus Configuration

To use real data in tests, add your PKM or project paths to `watcher.extra_paths` in `~/.anchor/user_settings.json`:

```json
{
  "watcher": {
    "extra_paths": [
      "C:/Users/rsbii/Documents/PKM",
      "C:/Users/rsbii/coding_projects/myapp"
    ]
  }
}
```

The live-fire runner will:
1. Read these paths from your config
2. Count files in each directory
3. Report total live corpus size
4. Test `density:` queries against the ingested data

## Test Output

Results are written to:
- `engine/tests/live-fire/live-fire.log` — Timestamped plain-text log (LLM-parseable)
- `engine/tests/live-fire/results.json` — Structured JSON summary

### results.json format

```json
{
  "timestamp": "2026-06-11T10:24:00.000Z",
  "serverUrl": "http://localhost:3160",
  "total": 18,
  "passed": 18,
  "failed": 0,
  "duration_ms": 4521,
  "live_corpus": {
    "extra_paths": ["C:/Users/rsbii/Documents/PKM"],
    "total_files": 247
  },
  "tests": [
    {
      "name": "Health check",
      "status": "pass",
      "duration_ms": 42,
      "error": null,
      "timestamp": "2026-06-11T10:24:00.042Z"
    }
  ]
}
```

### Live-fire.log format (LLM-parseable)

```
[2026-06-11T10:24:00.000Z] ============================================================
[2026-06-11T10:24:00.000Z] ANCHOR ENGINE LIVE-FIRE TEST SUITE v5.2.0
[2026-06-11T10:24:00.000Z] Server: http://localhost:3160
[2026-06-11T10:24:00.000Z] ============================================================
[2026-06-11T10:24:00.042Z]   PASS  [Health check] (42ms)
[2026-06-11T10:24:00.125Z]   PASS  [Molecules list + schema] (83ms)
[2026-06-11T10:24:00.250Z]   FAIL  [Compounds table removed] — Expected 404, got 200
...
[2026-06-11T10:24:05.000Z] ============================================================
[2026-06-11T10:24:05.000Z] RESULTS SUMMARY
[2026-06-11T10:24:05.000Z] Total:   18
[2026-06-11T10:24:05.000Z] Passed:  17
[2026-06-11T10:24:05.000Z] Failed:  1
[2026-06-11T10:24:05.000Z] LIVE CORPUS:
[2026-06-11T10:24:05.000Z]   Extra paths:   C:/Users/rsbii/Documents/PKM
[2026-06-11T10:24:05.000Z]   Directories:    1
[2026-06-11T10:24:05.000Z]   Total files:    247
```

## Troubleshooting

### Port 3160 in use
```bash
netstat -ano | findstr :3160
taskkill /PID <PID> /F
```

### All tests fail with connection refused
Engine not running. Start with:
```bash
pnpm start
```

### Live corpus tests show 0 files
Your `watcher.extra_paths` may be empty or paths invalid. Check `~/.anchor/user_settings.json`.

### Ingestion test fails
- Database may have been wiped (ephemeral design with `wipe_on_startup: true`)
- Ensure engine has write access to `~/.anchor/`

## Migration Verification Checklist

- [ ] Compounds table endpoint returns 404
- [ ] Molecules have `source_path` and `provenance` fields
- [ ] Atoms list endpoint responds correctly
- [ ] Ingestion creates records in atoms/molecules (not compounds)
- [ ] Search queries return results without compound table joins
- [ ] Density prefix returns valid `density_tier` values
- [ ] Live corpus paths are detected from user config

## References

- Standard 051: Pointer-only database storage
- Standard 031: Search algorithms (density prefix)
- Live-fire testing in docs/workflows/llm-testing.md
