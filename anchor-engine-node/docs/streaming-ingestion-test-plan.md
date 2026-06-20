# Anchor Engine — Streaming Ingestion Test Plan & Agent Prompt

**Date:** 2026-06-14
**Engine:** v5.3.0 | **Branch:** main | **Status:** Engine healthy on :3160

---

## 1. What Changed & Why

### The Problem
The engine could not ingest large files (>50 MB) without blocking the event loop.
The 237 MB `cs_ai_abstracts.txt` in `external-inbox/` caused:
- API responses to spike from ~250 ms → 3–5 seconds
- Health checks to time out
- The entire engine to appear hung

**Root cause:** `watchdog.ts:450` loaded the ENTIRE file with `fs.promises.readFile(filePath)`,
then `file-chunker.ts` split it into 48 virtual chunks — but all 48 chunks were held in memory
and processed in a single synchronous loop. Even with `setImmediate` yields every N molecules,
the main thread was saturated for minutes at a time.

### The Fix
**New module:** `engine/src/services/ingest/streaming-file-chunker.ts`

An async generator that reads files from disk in 1 MB windows instead of loading
the full content into memory. It:
1. Opens the file with `fs.openSync` (cross-platform, no external deps)
2. Reads 1 MB + 64 KB lookahead windows
3. Splits each window on sentence boundaries (`.!?` + space + capital)
4. Yields each chunk to the caller via `for await (const chunk of generator)`
5. Yields the event loop (`await setImmediate`) between every window

This means the main thread spends at most ~50 ms on any single chunk before
freeing the event loop for API requests. The engine stays responsive throughout
ingestion, regardless of file size.

**Modified file:** `engine/src/services/ingest/watchdog.ts`

The `processFile` method now branches on file size:
- **≤ 10 MB:** Existing behavior (load full file, hash, chunk, atomize)
- **> 10 MB:** Streaming path using `streamFileIntoChunks()`
  - Lightweight dedup: uses `mtime + size` fingerprint instead of full SHA-256
    (avoids a separate 237 MB read pass)
  - Keywords extracted from first 1 MB chunk only (not full file)
  - Progress reported via `systemStatus.setProgress()` with byte-level granularity
  - Mirror write still loads the file once post-ingestion (acceptable — ingestion
    is complete at that point)

### Philosophical Reason
The Anchor Engine is designed as a **local-first, CPU-only memory layer** that should
handle "multiple gigabytes of data" (per the README). The previous architecture was
fundamentally incompatible with that goal — any file larger than available RAM would
crash the process, and any file larger than ~50 MB would block the event loop.

The streaming approach aligns with the engine's core principles:
- **Deterministic:** Same file produces same chunks (sentence-boundary splitting
  is deterministic given the same window size)
- **Local sovereignty:** No cloud offload, no external services
- **CPU-only:** Pure Node.js streams, no native compilation required

### Technical Reason
Node.js's event loop is single-threaded. Any synchronous operation that takes
more than ~10 ms starves I/O callbacks. Loading a 237 MB file synchronously
takes hundreds of milliseconds just for the `readFileSync` call, plus the UTF-8
decode, plus the chunking, plus the atomization per chunk. The streaming approach
amortizes this work into 1 MB increments, each taking < 50 ms, keeping the event
loop free.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `engine/src/services/ingest/streaming-file-chunker.ts` | **NEW** — async generator for streaming file chunks |
| `engine/src/services/ingest/watchdog.ts` | **MODIFIED** — added streaming branch for files > 10 MB |
| `specs/current-standards/024-ephemeral-database.md` | Fixed header (020→024), updated ghost Standard 110 ref |
| `specs/current-standards/025-pointer-only-storage.md` | Fixed header (021→025) |
| `engine/src/index.ts` | Removed dead code (unreachable watchdog else-if), replaced ghost Standard 110/111 refs |
| `engine/src/config/paths.ts` | Replaced ghost Standard 110 refs with 024 |
| `engine/src/utils/version.ts` | Replaced ghost Standard 110 refs with 024 |
| `engine/src/core/schema-migration.sql` | **DELETED** — stale MySQL syntax, unreferenced by runtime code |
| `engine/tests/unit/paths-config.test.ts` | Rewrote to match actual $HOME/.anchor/ architecture |
| `engine/tests/unit/security.test.ts` | Fixed to use realpath'd PROJECT_ROOT for symlinked envs |
| `.gitignore` | Unquoted entries that had literal double-quote characters |
| Root: `0`, `build_errors.txt` | **DELETED** — prohibited per doc_policy |
| Root: `user_settings.json` | **MOVED** to `$HOME/.anchor/` per doc_policy §5 |

---

## 3. Current Engine State

```
Engine:  healthy on http://localhost:3160
Port:    3160 listening
DB:      PGlite (WASM), wiped and rebuilt fresh
Corpus:  Small inbox files (search-query1.json, search-test.json, test-search.json)
Heavy:   cs_ai_abstracts.txt moved to cs_ai_abstracts.txt.HEAVY (237 MB, 48 chunks)
Watchdog: Running, monitoring ~/.anchor/inbox and ~/.anchor/external-inbox
API Key: default_api_key_32chars_min (test key, 64-char hex generated by setup script)
```

---

## 4. Baseline Benchmarks (Clean Engine, No Heavy File)

| Endpoint | Avg Latency | Status |
|----------|------------|--------|
| `GET /health` | ~235 ms | 200 |
| `GET /v1/stats` | ~280 ms | 200 |
| `GET /v1/atoms?limit=5` | ~260 ms | 200 |
| `POST /v1/memory/search` (warm) | ~250 ms | 200 |
| `GET /v1/watchdog/status` | ~225 ms | 200 |
| `GET / (UI index)` | ~225 ms | 200 |
| `GET /v1/system/status` | ~250 ms | 200 |

---

## 5. Test Plan — To Be Executed by Agent

### Phase A: Verify Streaming Ingestion of Large File

```
1. Confirm engine is running: curl http://localhost:3160/health
2. Move the heavy file back into the inbox:
   move C:\Users\rsbii\.anchor\external-inbox\cs_ai_abstracts.txt.HEAVY
        C:\Users\rsbii\.anchor\external-inbox\cs_ai_abstracts.txt
3. Watch the logs for streaming ingestion:
   - Look for "[Watchdog] 🌊 Streaming ingestion: cs_ai_abstracts.txt"
   - Look for "[Watchdog] ✅ Streaming complete: N atoms in X.Xs"
   - Look for progress updates: "Streaming: XX% (N chunks)"
4. While ingestion is running, verify the engine stays responsive:
   - curl http://localhost:3160/health (should return in < 1s)
   - curl http://localhost:3160/v1/system/status (should show state: "ingesting")
   - curl -X POST -H "X-API-Key: default_api_key_32chars_min"
     -H "Content-Type: application/json"
     -d '{"query":"test"}'
     http://localhost:3160/v1/memory/search
     (should return results, not hang)
5. Wait for ingestion to complete (may take several minutes for 237 MB)
6. Verify the corpus size increased:
   curl -H "X-API-Key: default_api_key_32chars_min" http://localhost:3160/v1/stats
```

### Phase B: Benchmark After Large File Ingestion

```
Run the same endpoints as Phase A baseline and compare:
- Health, search, stats, atoms, watchdog, UI
- Search should return results from the ingested corpus
- Latency may increase slightly with a larger corpus (PGlite query overhead)
  but should stay under 2s for all endpoints
```

### Phase C: Verify Non-Streaming Path (Regression Check)

```
1. Create a small test file (< 10 MB) in the inbox:
   echo "This is a test file for non-streaming ingestion." > %USERPROFILE%\.anchor\inbox\small-test.txt
2. Check watchdog processes it:
   - Look for "[Watchdog] Processing Pipeline: inbox\small-test.txt" (no 🌊 emoji)
   - Verify it completes without errors
```

### Phase D: Run Unit Tests

```
npx vitest run --config engine/vitest.config.ts --reporter=verbose
```

Expected: 6 test files pass (paths-config, security, api-key-validation,
llm-context-formatter, search-logging-verification, safe-dns).
26 test files fail (pre-existing: ast-parser WASM lookup, integration deps,
Vitest v4 mock issues). No new failures.

### Phase E: End-to-End Search Validation

```
1. Ingest completes → corpus has data
2. Run several searches and verify results are meaningful:
   - "machine learning" → should return relevant molecules
   - "neural network" → should return relevant molecules
   - "#test" → tag-based search
3. Verify /v1/memory/explore works for graph traversal
4. Verify /v1/distills works if any distills exist
```

---

## 6. Success Criteria

- [ ] Engine starts and reaches healthy state
- [ ] 237 MB file ingests without blocking the event loop
- [ ] API stays responsive (< 2s per request) DURING ingestion
- [ ] Ingestion completes with atom/molecule counts > 0
- [ ] Streaming log messages appear ("🌊 Streaming ingestion", progress %, "✅ Streaming complete")
- [ ] Non-streaming path still works for files < 10 MB
- [ ] No new TypeScript compilation errors
- [ ] No regression in unit test pass count (6 passing files minimum)

---

## 7. Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|-------------|-----|
| Engine won't start | PGlite WAL corruption | `rmdir /s /q %USERPROFILE%\.anchor\context_data` + restart |
| Heavy file not picked up | Watchdog polling interval | Check `watcher.auto_start: true` in user_settings |
| Streaming not triggered | File < 10 MB or wrong path | Verify `STREAM_THRESHOLD_BYTES = 10 * 1024 * 1024` |
| "SimHash mining failed" in logs | Non-fatal — no synonyms in corpus | Ignore; search works without synonyms |
| AST parser test failures | tree-sitter WASM files not found | Known issue; WASM files at `engine/` root need path fix |

---

## 8. API Reference (for curl commands)

```
Base URL: http://localhost:3160
API Key Header: X-API-Key: default_api_key_32chars_min

GET  /health                              — engine health
GET  /v1/stats                            — corpus statistics
GET  /v1/system/status                    — engine state (idle/ingesting)
GET  /v1/watchdog/status                  — watcher state + monitored paths
GET  /v1/atoms?limit=5                    — list atoms
GET  /v1/molecules?limit=5                — list molecules
POST /v1/memory/search  {"query":"..."}   — semantic search
POST /v1/memory/explore {"query":"..."}   — graph exploration
GET  /v1/distills                         — list distillation outputs
GET  /                                    — UI dashboard
```
