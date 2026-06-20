# Changelog

All notable changes to Anchor Engine will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [5.3.0] - 2026-06-19 (Path Management API & Hot-Slotting Purge)

### Added
- **HTTP Endpoints for Path Management** (`Standard 039`)
  - `POST /v1/system/path-add` — Add watched path via watchdog integration
  - `POST /v1/system/path-remove` — Remove watched path + trigger hot-slotting purge
  
- **MCP Tools with Direct DB Operations**
  - `anchor_set_path(path)` — Adds path to watch list (direct DB insert + HTTP fallback)
  - `anchor_remove_path(path)` — Full cleanup: atoms, molecules, edges, tags, sources + mirrored files

### Changed
- **Hot-Slotting Purge Enhancement**
  - Complete database purge when removing watched paths (was only removing path entry)
  - Removes all associated data: atoms, molecules, edges, tags, sources from PGlite
  - Cleans mirrored brain files and metadata notebooks
  
- **MCP Tool Architecture**
  - Tools now use direct database operations as primary method with HTTP fallback
  - More reliable than pure HTTP approach (doesn't require running server)

### Fixed
- **Endpoint Registration** — Previously `/v1/system/path-add` returned 404; now properly registered via `setupSystemRoutes()` in system.ts
- **Data Accumulation Bug** — Watched path removal no longer leaves orphaned database entries and mirrored files

---

## [5.3.0] - 2026-06-10 (Documentation Drift Repair & Standards Consolidation)

### Documentation Policy (v2.3):
- Updated `doc_policy.md` to match reality: 38 standards, flat directory, current docs/ structure
- Removed stale `archive-legacy/` references and `decisions/` directory (merged into relevant standards)

**Standards Flattened:**
- Flattened `specs/current-standards/` from 14 category subdirectories into single flat directory
- 38 active standards numbered 001–032, ordered foundational → assistive
- Duplicate-numbered standards (014, 018, 019, 027, 028, 029) preserved with distinct names

**Architecture Consolidated:**
- Merged `ARCHITECTURE.md` into `spec.md` — architecture diagrams, web dashboard, engine core modules now in system spec
- Removed `ux-ui-recursion-workflow.md` (no longer needed)

**Docs Restored from Git History:**
- Restored: `code-patterns.md`, `design-patterns.md`, `star-algebra-reference.md`
- Restored: `integrations/CODE_OF_CONDUCT.md`, `integrations/CONTRIBUTING.md`
- Renamed: `-settings-configs.md` → `settings-configs.md`

**Root Cleanup:**
- Deleted 19 one-off fix scripts cluttering project root
- Removed PM2 configs, `.babelrc`, `config/` directory
- Dropped `package-lock.json` (pnpm only)
- Cleaned `.gitignore`: removed embedded JavaScript code, fixed contradictions with tracked files
- Restored missing root `package.json` + `pnpm-workspace.yaml`
- Re-added `CITATION.cff` to tracking

### Distillation Pipeline Fixes

**API Routes:**
- Added `POST /v1/distills` route to trigger distillation
- Removed `compounds.ts` route (always returned 404, table removed per Standard 051)
- Fixed `/v1/files/read` to allow `.md`/`.txt`/`.yml` extensions (was blocking distill output reads)
- `stats.ts`: replaced hardcoded placeholder with real implementation (uptime, memory, DB row counts, search counter)

**MCP Tools:**
- Fixed `anchor_distill`: was calling non-existent `POST /v1/distills` → now calls `POST /v1/memory/distill`
- Fixed `anchor_distill` body format: maps `{source_url, source_text}` → proper `RadialDistillRequest`
- Added `anchor_list_distills` and `anchor_get_distill` tools
- `callAnchorAPI()` now supports GET requests

**Distill Manager:**
- Rewritten to query PGlite `distills` table instead of in-memory-only store
- `recordDistill()` writes metadata pointers to DB on completion
- In-memory cache retained for fast UI polling

**UI:**
- Fixed `output_format` from unsupported `'source-grouped'` to `'decision-records'`
- Added decision-records format handler (`parsedContent.records`)

---

## [5.2.0] - 2026-06-03 (Testing Documentation Cleanup & Consolidation)

### Merged duplicate documentation:
- Consolidated `docs/testing/LIVE-FIRE-TEST-SUITE.md` (571 lines) into `specs/current-standards/search-retrieval/014-search-algorithm-testing.md`
- Added P5 edge cases section with 10+ test examples
- Added P6 performance benchmarks section with latency validation tests
- Added CI/CD integration examples for GitHub Actions workflow
- Added troubleshooting guide covering common issues and fixes
- Added best practices section with 7 key recommendations
- Standard 014 expanded from 301 to 541 lines (80% increase)

### Removed legacy test files:
- Deleted 15 deprecated testing patterns from `tests/legacy/` directory:
  - comprehensive-test.js, full-sequence-test.js, config-test.js, db-close-test.js
  - db-test.js, distillation-test.js, fixed-startup-test.js, individual-import-test.js
  - minimal-db-test.js, minimal-test.js, route-setup-test.js, test-tool-executor.js
  - test-fixed-engine.js, test-native-module.js, test-server.js, accurate-test.js

### Removed duplicate documentation:
- Consolidated `docs/testing/API-SURFACE.md` references into standard specs
- Deleted `docs/testing/LIVE-FIRE-TEST-SUITE.md` (merged into Standard 014)
- Removed now-empty `docs/testing/` directory

### Background Startup Scripts (Standard 014 OPS-005)

**Implemented agent-friendly background startup/shutdown scripts:**
- `scripts/start-engine-bg.mjs` - Node.js background startup with:
  - Build verification (`engine/dist/index.js`)
  - Port conflict detection (auto-finds available port)
  - File logging to `.anchor/logs/start-{timestamp}.log`
  - Immediate exit after health check (non-blocking for agents)
  - Health check retries before success confirmation

- `scripts/stop-engine-bg.mjs` - Node.js background shutdown with:
  - Port-based PID detection (cross-platform, Windows 11 compatible)
  - Graceful SIGTERM shutdown first
  - Force kill if graceful shutdown fails
  - File logging to `.anchor/logs/stop-{timestamp}.log`

**Benefits:**
- No blocking console output during startup/shutdown
- Automatic port conflict resolution
- Persistent logging for debugging
- Cross-platform compatibility (Windows 11, Linux, macOS)

### Testing Framework Updates

**New P5 Edge Cases Tests:**
- Empty query handling
- Very long query validation  
- Special characters: `&`, `|`, `"`, `'`
- HTML entity/XSS prevention
- Unicode character support
- Single character queries
- Malformed input handling

**New P6 Performance Benchmarks:**
- Semantic search latency (<3s target)
- Tag-based search latency (<1s target)
- Byte offset search latency (<500ms target)
- FTS search latency (<200ms target)
- Empty query latency (<100ms target)
- Performance validation with 50% margin tolerance

**CI/CD Integration Examples:**
- GitHub Actions workflow for automated testing
- Watch mode for development iterations
- Phase-specific execution (P0-P4 for CI, P5-P6 for full suites)

**Troubleshooting Guide:**
- Tests failing immediately (engine not running)
- Logs not being created (permissions/PROJECT_ROOT issues)
- Performance tests exceeding targets (insufficient corpus)
- Pain point detection not working (Standard 027 configuration)

### Documentation Updates

- Updated `docs/INDEX.md` with recent cleanup notes
- Added version bump: Standard 014 v1.0.0 → v2.0.0
- Updated CHANGELOG.md with testing cleanup history

---

## [5.1.0] - 2026-05-28 (Testing Infrastructure & QwenPaw Integration)

### Added
- **Testing Infrastructure**
  - Playwright-based e2e UI verification tests (`test_suite/anchor_engine_ux_test_suite.py`)
  - Comprehensive API documentation with OpenAPI specs and curl examples
  - System metrics endpoint `/v1/stats` (uptime, memory, request counters)
  - Reliable engine startup/shutdown scripts

- **QwenPaw Environment Integration**
  - PowerShell environment fix script (`Fix-QwenPawEnv.ps1`) for PATH ordering and UTF-8 support
  - Git Bash `.bashrc` with Windows→Linux compatibility aliases
  - PowerShell 7 profile auto-loader (`.powershell_profile.ps1`)

- **Project Structure**
  - Moved to `coding_projects/anchor-engine-node` workspace
  - New infrastructure: `agents/`, `specs/decisions/`, `specs/INTEGRATIONS/`
  - Database initialization scripts (`create-db.js`, `init-db.js`)

### Changed
- **Major Cleanup (v5.1.0 preparation)**
  - Removed orphaned route: `engine/src/routes/v1/ingest-updated.ts`
  - Removed orphaned service: `engine/src/services/ingest/ingest-atomic-updated.ts`
  - Deprecated bright-nodes reference in documentation
  - Cleaned all test artifacts, JSON build outputs, and temporary files (20+ files)
  - Consolidated inbox: old inbox → internal-inbox

- **Documentation**
  - Added Testing section to README.md with e2e test instructions
  - Created API surface documentation covering all 15 route files + 4 additional endpoints
  - Updated UX/UI recursion workflow docs (require live engine for testing)

### Fixed
- Search route implementation restored from previous working commit
- Removed circular imports and missing dependencies in route architecture
- Cleaned stale TODO/FIXME comments from codebase

---

## [5.1.1] - 2026-06-03 (Distillation Endpoint Optimization)

### Fixed
- **Distillation Endpoint Optimization**
  - Added `max_molecules` parameter to limit corpus-mode queries and prevent timeouts
  - Restored `timeout_seconds` support with user-configurable timeout (default: 60s) instead of hardcoded 120s
  - Fixed streaming mode to respect `max_molecules` and use proper default values

- **Build Infrastructure**
  - Restored build script (`scripts/build.ts`) that compiles TypeScript → JavaScript for production deployment
  - Added missing devDependencies: `@types/node`, `rimraf`, `typescript`

- **GitHub Ingestion Service**
  - Fixed import extensions from `.ts` to `.js` (NodeNext module resolution requirement)
  - Corrected corrupted method calls: `.tson()` → `.json()`, `.tsON.parse()` → `JSON.parse()`
  - Removed duplicate entries in file extension mapping

---

## [5.0.0] - 2026-05-28 (Radial Distillation v2 & Memory Typing)

### Added
- New radial distillation v2 with semantic aggregation across sources
- Memory typing system for better context management
- Temporal cascade for improved search relevance
- New output formats for distillation summaries

### Changed
- Updated path configuration to `.anchor` structure
- Simplified version loading mechanism
- Worker-based GitHub sync for better concurrency

### Fixed
- OOM hardening with better memory management
- Critical bug fixes in search pipeline
- Performance improvements in tag discovery

### Security
- Added API key strength validation (Standard 132)
- Fixed auth bypass vulnerability in `/v1/test/*` endpoints (Standard 131)
- SQL injection fix via parameterized LIMIT clauses (Standard 130)
- Path traversal prevention (Standard 129)

---

## [4.9.5] - 2026-05-24 (Streaming Distillation & Watchdog)

### Added
- Streaming distillation with real-time output
- UI improvements for search results
- Watchdog process for memory management

