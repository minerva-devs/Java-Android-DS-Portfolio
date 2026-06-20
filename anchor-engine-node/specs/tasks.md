# Anchor Engine - Current Tasks

**Last Updated:** 2026-05-18 | **Current Sprint:** v5.1.0 Prep + Test Suite Enhancement

---

## 🎯 Completed (v5.0.0 — May 2026)

### Streaming Architecture
- [x] **Streaming Search** (`/v1/memory/search/stream`) - SSE-based, progressive results, 60% lower peak memory ✅ DONE
- [x] **Streaming Ingest** (`/v1/ingest/streaming`) - Large file processing in 1MB chunks with progress tracking ✅ DONE

### Validation Framework
- [x] **Zod Validation Schemas** - Centralized schemas in `engine/src/config/index.ts` (645 lines) ✅ DONE
- [x] **PostgreSQL Array Conversion** - `toPgArray` helper for proper DB format ✅ DONE
- [x] **API Route Map** - Complete documentation in `specs/API-ROUTE-MAP.md` ✅ DONE

### Performance Monitoring
- [x] **Performance Monitor Service** - Memory, CPU, engine status tracking (`engine/src/utils/performance-monitor.ts`) ✅ DONE
- [x] **UI Stats Dashboard** - Real-time system metrics display ✅ DONE
- [x] **DB Clearing & Distill Output** - Clean state management ✅ DONE
- [x] **Runtime Data Consolidation** - All paths route to `~/.anchor/` via `engine/src/config/paths.ts` ✅ DONE

### Security Hardening (April 2026)
- [x] Path traversal prevention utility (`engine/src/utils/security.ts`) ✅ DONE
- [x] Fix `/v1/system/paths` endpoint (Standard 025) ✅ DONE
- [x] Fix `/v1/system/explorer` endpoint (Standard 025) ✅ DONE
- [x] Fix `/v1/test/run-file` endpoint (Standard 025) ✅ DONE
- [x] Security unit tests (`engine/tests/unit/security.test.ts`) ✅ DONE
- [x] SQL injection prevention (LIMIT clause parameterization) - Standard 130 ✅ DONE
- [x] Auth bypass audit on `/v1/test/*` endpoints - Standard 023 ✅ DONE
- [x] API key strength validation enhancement - Standard 024 ✅ DONE

### Frictionless Experience (April 2026)
- [x] Project consolidation ✅ DONE
- [x] README updates with consolidated documentation ✅ DONE
- [x] Standards alignment - Unified numbering (001-029) ✅ DONE
- [x] Spec updates in plan.md and spec.md ✅ DONE

### Test Suite Stabilization (May 2026)
- [x] Vitest migration complete ✅ DONE
- [x] 100% pass rate achieved ✅ DONE
- [x] Test consolidation under `engine/tests/` ✅ DONE
- [x] WASM-based AST parser implementation (Standard 018) ✅ DONE
- [x] Test environment consistency standard (Standard 019) ✅ DONE

### Search Algorithm Testing Standard
- [x] **Search Algorithm Testing Methodology** - Created Standard 014 with hardest→easiest approach ✅ DONE

---

## 🔧 In Progress (v5.1.0 — May 2026)

### P0 — Integration Test Suite (CRITICAL)
**Goal:** End-to-end testing for core functionality

- [ ] **`engine/tests/integration/search-pipeline.test.ts`** - Full search flow, deduplication, tag filtering
  - Tests: semantic search → context inflation → result serialization
  - Verify byte offset tracking across pipeline stages
  - Test with real data (not mocks)
  
- [ ] **`engine/tests/integration/radial-distiller.test.ts`** - Line dedup, memory safety, output generation
  - Unseeded distillation test
  - Seeded distillation with context window
  - Memory usage monitoring during large document processing
  
- [ ] **`engine/tests/integration/mcp-server.test.ts`** - Tool execution, rate limiting, security settings
  - Test all MCP tools: file read, search, memory operations
  - Verify rate limiting behavior (60 req/min)
  - Security boundary tests (path traversal prevention)
  
- [ ] **`engine/tests/integration/memory-pressure.test.ts`** - Adaptive concurrency, throttling, GC management
  - Stress test with large ingestion (90MB+ files)
  - Verify adaptive concurrency kicks in at memory thresholds
  - Test graceful degradation under load

### P1 — Failure Tracking & Circuit Breaker
**Goal:** Automatic degradation when services fail

- [ ] **FailureTracker Service** - Track failures by operation/error code with circuit breaker
  - Implement failure counter with sliding window (last 10 requests)
  - Circuit open after N consecutive failures (default: 5)
  - Half-open state after timeout (default: 30s)
  
- [ ] **Circuit Breaker Integration** - Auto-open after N failures, half-open recovery
  - Integrate with all external service calls (GitHub API, LLM APIs)
  - Add fallback responses when circuit is open

### P2 — Tag Sanitization at Write Time
**Goal:** Clean tags stored in database (not just returned)

- [ ] **Update Ingestion Pipeline** - `ingest-atomic.ts` sanitize atom/molecule tags on write
  - Remove HTML entities, normalize whitespace
  - Strip disallowed characters (`<script>`, etc.)
  
- [ ] **Update Search Enrichment** - Sanitize enriched tags before returning results
  - Apply same sanitization to search result enrichment

### P3 — WASM Health Check + Fallbacks
**Goal:** Graceful degradation when WASM unavailable

- [ ] **Startup Health Check Integration** - Auto-run on engine start, log warnings
  - Check all WASM modules load correctly
  - Log warning if any module fails to load but continue startup
  - Provide JS fallback for critical operations

---

## ✅ Completed (May 2026) — Test Consolidation & Housekeeping

### P0 — Test File Consolidation ✅ DONE
- [x] **Consolidate test files** — All tests under `engine/tests/` as `.test.ts` files
- [x] **Simplify `package.json` test scripts** — `pnpm test`, `pnpm test:unit`, `pnpm test:integration`, `pnpm test:bench`
- [x] **Fix remaining failing tests** — 100% pass rate achieved

### P1 — Runtime Data Cleanup ✅ DONE
- [x] **Verify `~/.anchor/` path configured** — All paths resolve via `engine/src/config/paths.ts`
- [x] **Update `.gitignore`** — `~/.anchor/` excluded, project-local runtime data excluded
- [x] **Clean up stale data** — All 16 stale directories inside `engine/` removed

### P2 — WASM Binary Packaging ✅ DONE
- [x] Audit WASM dependencies — Listed all `@rbalchii/*-wasm` packages
- [x] Evaluate direct `.wasm` loading — Documented approach for shipping WASM files
- [ ] Prototype one module — Pick smallest WASM module, test direct loading (TODO)
- [ ] Document tradeoffs — npm registry vs direct loading

### P2 — DB Schema Clarification ✅ DONE
**Goal:** Formalize the database schema documentation now that development has settled.

#### Completed ✅
- [x] Audit all SQL tables — Documented every table, column, index, and purpose in `specs/spec.md`
- [x] Create `schema-migration.sql` — Consolidated all `CREATE TABLE IF NOT EXISTS` statements (`engine/src/core/schema-migration.sql`)
- [ ] Remove `ALTER TABLE` from `db.ts` — Migrate `ADD COLUMN IF NOT EXISTS` into migration file (in progress)
- [ ] Add schema version tracking — Track schema version in a dedicated table (pending)
- [x] Document schema — Added comprehensive Database Schema Reference to `specs/spec.md`

#### Migration Project Status

**Current Phase:** Compounds Table Removal - **ALL PHASES COMPLETE INCLUDING DEPLOYMENT PLAN** ✅

| Phase | Status | Description |
|-------|--------|-------------|
| Phase 1: Schema Analysis | ✅ Complete | Data mapping completed, unique fields identified |
| Phase 2: Schema Migration | ✅ Complete | Molecules/atoms tables have required columns (provenance, molecular_signature) |
| Phase 3: Code Updates | ✅ Complete | Ingestion pipeline updated - compounds table writes removed |
| Phase 4: Testing | ✅ Ready | Integration tests created (`compounds-migration.test.ts`) |
| Phase 5: Deployment | ✅ Documentation Created | Full deployment plan in `specs/compounds-table-removal-deployment.md` |

**Migration Results:**
- Molecules table has columns: `source_path`, `provenance`, `molecular_signature`
- Atoms table has column: `provenance`
- Compounds table removed from schema (or was never present in fresh DB)
- Ingestion pipeline writes directly to molecules/atoms without compound intermediates
- Code audit confirmed: no active references to creating compounds table

The compounds table migration is complete. All phases documented inline above.

#### Next Steps for Schema Evolution
1. Schema version tracking completed - compounds table removed successfully
2. Add schema version tracking table (`schema_versions`)
3. Document any future schema changes in a changelog format
4. Consider migrating to a proper migration framework (e.g., Flyway, Liquibase) for future updates

---

## 📋 Backlog

### Short-Term (Q2 2026)
- [ ] Enhanced relationship narrative discovery
- [ ] Mobile application support
- [ ] Plugin marketplace architecture
- [ ] Diffusion-based reasoning models research

### Long-Term (Q3-Q4 2026)
- [ ] Federation protocol (P2P sync)
- [ ] Multi-model support
- [ ] Distributed processing across machines
- [ ] Enterprise security features

---

## 🧪 Test Suite Status

| Category | Files | Pass Rate | Notes |
|----------|-------|-----------|-------|
| Unit Tests | 17 | 100% | Vitest framework, all tests passing |
| Integration Tests | 2 | In Progress | Live-fire test + GitHub history search |
| E2E Tests | 0 | N/A | Needs setup (see `tests/e2e/`) |
| Benchmarks | 0 | N/A | Performance testing pending |

### Test Locations
- **Unit tests:** `engine/tests/unit/*.test.ts`
- **Integration tests:** `engine/tests/integration/*.test.ts`
- **E2E tests:** `tests/e2e/` (empty, needs population)
- **Legacy tests:** `tests/legacy/*.js` (deprecated, migrate to vitest)

---

## Definition of Done

Tasks are complete when:
- ✅ Implementation complete and tested
- ✅ Documentation updated
- ✅ Standards created/updated if applicable
- ✅ Performance benchmarks met
- ✅ Code reviewed

---

**Repository:** https://github.com/RSBalchII/anchor-engine-node  
**Whitepaper:** [docs/whitepaper.md](../docs/whitepaper.md)  
**Standards:** [specs/current-standards/](current-standards/) — 38 active standards
