# LLM Developer Testing Workflow

**Target audience:** LLM agents (local or hosted) that need to autonomously test the Anchor Engine project end-to-end.
**Minimum model:** 27B parameter (tested on Qwen 3.6 27B).
**Last updated:** June 11, 2026

---

## Copy-Paste Prompt Template

Use this prompt to direct a local 27B LLM agent through testing. Copy the entire block below.

```
You are a testing agent for Anchor Engine — a deterministic semantic memory
engine for local-first AI systems. It runs on Node.js, uses PGlite, exposes an
HTTP API on port 3160, and stores all runtime data under ~/.anchor/.

PROJECT PATH: C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 1 — START THE ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. cd to the project path
2. If engine/dist/index.js does not exist, run: pnpm build
3. Start the engine in a new terminal (keeps it running while you work):
     start "AnchorEngine" cmd /c "node --expose-gc engine/dist/index.js"
4. Wait up to 30 seconds, then verify:
     curl http://localhost:3160/health
   Should return {"status":"ok"} or similar 200 response.
5. If it fails, check for port conflicts:
     netstat -ano | findstr :3160
     taskkill /PID <PID> /F
   Then retry step 3.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 2 — RUN VITEST (UNIT + INTEGRATION)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run: npx vitest run --config engine/vitest.config.ts --reporter=verbose

Capture the output. Look for these summary lines at the end:
  Test Files  N passed (N)
       Tests  N passed (N)

Record: total test files, total tests, passed, failed.
If anything failed, record the test file path and error message.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 3 — RUN LIVE-FIRE TESTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run: node engine/tests/live-fire/live-fire.mjs

This tests every API endpoint against the live server. Exit code 0 = all pass.
The runner writes results to:
  engine/tests/live-fire/live-fire.log     (plain text log)
  engine/tests/live-fire/results.json      (structured JSON)

After it finishes, read BOTH files and record:
- Total, passed, failed counts
- Any FAIL lines with error messages
- Live corpus info (extra paths, total files found)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 4 — DENSITY PREFIX TESTS (3-TIER RAG DISPATCH)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Run these curl commands and parse the JSON responses:

A. Full corpus map + thresholds:
curl -s -X POST http://localhost:3160/v1/memory/search ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"density:\"}"

Look for: results[0].rag_thresholds — these are the configured tier cutoffs.
Record: LIGHT_DOC_THRESHOLD, MEDIUM_DOC_THRESHOLD, and the RAG limits.

B. Single term:
curl -s -X POST http://localhost:3160/v1/memory/search ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"density:contract\"}"

Look for: results[0].density_tier, results[0].molecule_count,
         results[0].rag_config.mode, results[0].rag_config.doc_limit.

C. Multi-term:
curl -s -X POST http://localhost:3160/v1/memory/search ^
  -H "Content-Type: application/json" ^
  -d "{\"query\":\"density:contract,liability,damages\"}"

Look for: results[0..N].term, results[0..N].density_tier,
         results[0..N].rag_config for each term.

Record for each query: tier, molecule_count, rag_mode, doc_limit.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 5 — ENGINE RUNTIME LOG ANALYSIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. Find the most recent log:
     dir /b /od %USERPROFILE%\.anchor\logs\

2. Read it:
     type %USERPROFILE%\.anchor\logs\anchor_engine.log

3. Analyze and report these 10 items:
   a. Total lines in the log
   b. ERROR count — every line containing "ERROR" or "error"
   c. WARN count — every line containing "WARN" or "warn"
   d. Distinct error types — group similar errors, count occurrences of each
   e. Top 3 most frequent error/warning patterns
   f. Any crash or OOM indicators (heap exhausted, WASM memory, process.exit)
   g. Startup duration — time from first log line to "listening" or "server started"
   h. Ingestion activity — lines mentioning "ingest", "watchdog", "atomize"
   i. Search activity — lines mentioning "Search", "findAnchors", "PhysicsTagWalker"
   j. Overall health verdict: HEALTHY | DEGRADED | UNHEALTHY

4. Cross-reference with live-fire log:
     type engine\tests\live-fire\live-fire.log

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PHASE 6 — FINAL REPORT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Produce this exact format:

============================================================
ANCHOR ENGINE TEST REPORT
Date: <ISO timestamp>
Server: http://localhost:3160
============================================================

PHASE 2 — Vitest
  Test Files: <N> | Passed: <N> | Failed: <N>
  Failures: <list or "none">

PHASE 3 — Live-Fire
  Total: <N> | Passed: <N> | Failed: <N>
  Failures: <list or "none">
  Live Corpus: <N> extra paths, <N> directories, <N> total files

PHASE 4 — Density Prefix
  Thresholds: light≥<N> docs, medium≥<N> docs
  density:: <PASS/FAIL>
  density:contract: tier=<tier>, <N> docs, rag_mode=<mode>, limit=<N>
  density:contract,liability,damages: <N> terms analyzed, tier summary

PHASE 5 — Engine Runtime Log
  Log file: <path>
  Lines: <N> | ERRORs: <N> | WARNs: <N>
  Distinct error types: <N>
  Top errors:
    1. <pattern> (<N> occurrences)
    2. <pattern> (<N> occurrences)
    3. <pattern> (<N> occurrences)
  Startup: <N>ms
  Ingestion: <N> lines
  Search: <N> lines
  Health: HEALTHY | DEGRADED | UNHEALTHY

OVERALL VERDICT
  [ALL PASS | PARTIAL FAIL | CRITICAL FAIL]
  Recommendations:
    - <actionable item>
    - <actionable item>

============================================================
```

---

## How the Test Suite Works (for LLM agents)

### Engine Architecture

| Component | Port | Protocol | Purpose |
|-----------|------|----------|---------|
| Anchor Engine HTTP API | 3160 | HTTP REST | Search, ingest, distill, stats |
| MCP Server | 3161 (if enabled) | stdio/HTTP | Model Context Protocol tools |
| PGlite Database | in-process | WASM | Ephemeral SQL storage in `~/.anchor/` |
| Mirror Brain | filesystem | `~/.anchor/mirrored_brain/` | Pointer-only file cache |

### Test Tiers

| Tier | Framework | Command | What It Covers |
|------|-----------|---------|----------------|
| **Unit + Integration** | Vitest | `npx vitest run --config engine/vitest.config.ts` | Core logic, search algorithms, WASM modules, config validation |
| **Live-Fire** | Node.js (ESM) | `node engine/tests/live-fire/live-fire.mjs` | Real HTTP: health, molecules, atoms, search, ingestion, density prefix, live corpus, compounds migration (18 tests) |
| **Density Prefix** | curl/HTTP | `POST /v1/memory/search {"query":"density:..."}` | 3-tier RAG thresholds, per-term document counts, actionable rag_config dispatch |
| **E2E UI** | Playwright | `npx playwright test` | Browser UI verification |

### Key API Endpoints for Testing

```
GET  /health                        → Server health check
GET  /v1/stats                      → Database stats (atom/molecule counts)
GET  /v1/molecules?limit=<N>        → List molecules with provenance
GET  /v1/atoms?limit=<N>            → List atoms with provenance
GET  /v1/compounds                  → Should return 404 (Standard 051 migration)
POST /v1/memory/search              → STAR search (accepts density:, deep:, distill: prefixes)
POST /v1/ingest                     → File ingestion pipeline
GET  /v1/distills                   → List distillation results
POST /v1/distillation/radial        → Radial distillation query
```

### Log File Locations

| Log | Path | Format |
|-----|------|--------|
| Live-fire test results | `engine/tests/live-fire/live-fire.log` | Timestamped plain text |
| Live-fire structured | `engine/tests/live-fire/results.json` | JSON summary |
| Engine runtime logs | `%USERPROFILE%\.anchor\logs\anchor_engine.log` | Winston daily rotate |
| Vitest output | STDOUT (no file) | Vitest reporter |

---

## Common Failure Patterns (LLM agent should check)

### 1. Engine Won't Start
- **Port 3160 in use** → Kill existing process with `netstat -ano | findstr :3160` then `taskkill /PID <PID> /F`
- **No build** → Run `pnpm build` first
- **Node version** → Requires Node 18+

### 2. All Tests Fail
- Engine didn't start → Check `http://localhost:3160/health` manually
- Wrong directory → Confirm `engine/dist/index.js` exists

### 3. Ingestion Tests Fail
- Database was wiped (ephemeral design) → Re-ingest data
- Missing `~/.anchor/` directory permissions

### 4. Density Tests Return Empty
- No data ingested → Run ingestion pipeline first (watchdog or manual ingest)
- Empty database → Check `GET /v1/stats` for atom/molecule counts

### 5. Provenance/Schema Tests Fail
- Pre-migration database → May need full rebuild
- Standard 051 migration not applied

---

## Expected Output Formats (for parsing)

### Vitest Summary (Phase 2)
```
 Test Files  15 passed (15)
      Tests  127 passed (127)
   Start at  10:23:45
   Duration  4.21s
```

### Live-Fire Log (Phase 3)
```
[2026-06-11T10:24:01.000Z] === Live-Fire Test Suite ===
[2026-06-11T10:24:01.000Z] Running: Server health check...
[2026-06-11T10:24:01.042Z] ✓ [Server health check]
[2026-06-11T10:24:02.000Z] Running: Molecules list API...
[2026-06-11T10:24:02.125Z] ✗ [Molecules list API]: Missing provenance
```

### Density Response (Phase 4)
```json
{
  "term": "contract",
  "atom_count": 312,
  "tag_count": 47,
  "molecule_count": 89,
  "total_hits": 359,
  "density_tier": "light",
  "rag_config": {
    "mode": "fast",
    "doc_limit": 10,
    "recommendation": "Well-known concept (89 docs). External RAG: retrieve top 10 docs in fast mode."
  }
}
```

**Tier thresholds (configurable in user_settings.json → density):**
| Tier | Condition | RAG mode | Doc limit | Meaning |
|------|-----------|----------|-----------|---------|
| light | molecule_count ≥ 50 | fast | 10 | Concept is well-covered; light retrieval sufficient |
| medium | molecule_count ≥ 5 | balanced | 25 | Moderate coverage; balanced retrieval |
| heavy | molecule_count < 5 | exhaustive | 0 (all) | Rare concept; deep search + radial distillation |

The `rag_config.doc_limit` is the concrete number the external RAG pipeline should use as its document retrieval limit. 0 means retrieve all available documents.

---

## Testing Data (for LLM agents that need to ingest)

If the database is empty and you need test data to exercise the pipeline, ingest these sample documents:

**Sample 1: Legal Contract (for density:contract testing)**
```
POST /v1/ingest
Content-Type: application/json

{
  "title": "Master Services Agreement",
  "content": "This Master Services Agreement governs the relationship between Contractor and Client. The Contractor agrees to provide services as specified in the Statement of Work. All deliverables shall be subject to review and acceptance by Client. Either party may terminate this Agreement with 30 days written notice. The Contractor warrants that all work shall be performed in a professional manner.",
  "source": "contracts/msa-2026.md",
  "bucket": "notebook"
}
```

**Sample 2: Technical Documentation (for search testing)**
```
POST /v1/ingest
Content-Type: application/json

{
  "title": "Anchor Engine Architecture",
  "content": "The STAR algorithm uses temporal decay and graph traversal for semantic retrieval. Unlike vector embeddings, STAR produces deterministic results by following explicit graph edges. The PGlite database stores atoms and molecules with provenance tracking. Compression is achieved through content-based deduplication using MD5 fingerprinting.",
  "source": "docs/architecture.md",
  "bucket": "notebook"
}
```

---

## Quick Reference Commands

```bash
# Essential startup sequence (the LLM agent MUST follow this order)
cd C:\Users\rsbii\.qwenpaw\workspaces\P1\coding_projects\anchor-engine-node
pnpm install
pnpm build
# Windows: start a new terminal or use:
node scripts/start-engine-bg.mjs

# Wait for engine, then test
curl http://localhost:3160/health
npx vitest run --config engine/vitest.config.ts --reporter=verbose
node engine/tests/live-fire/live-fire.mjs

# Density prefix tests
curl -X POST http://localhost:3160/v1/memory/search -H "Content-Type: application/json" -d "{\"query\":\"density:\"}"
curl -X POST http://localhost:3160/v1/memory/search -H "Content-Type: application/json" -d "{\"query\":\"density:contract\"}"

# Check logs
type %USERPROFILE%\.anchor\logs\anchor_engine.log | findstr /i "error warn"
type engine\tests\live-fire\live-fire.log
```
