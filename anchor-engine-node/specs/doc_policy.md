# Documentation Policy

## 1. Core Philosophy

Documentation in Anchor Engine must be **concise**, **accurate**, and **maintainable**. We prioritize high-signal technical writing over verbose explanations.

**Guiding Principles:**
- **Single Source of Truth:** Each topic should have one authoritative location
- **Minimal Root:** The project root contains only essential files
- **Clear Separation:** `specs/` for technical specifications, `docs/` for user-facing guides
- **Actionable Content:** Documentation should drive implementation and testing

---

## 2. Document Locations

### 2.1 Root Directory (`/`)

**ALLOWED Files (Only):**
| File | Purpose |
|------|---------|
| `README.md` | Project overview, quickstart, API reference, architecture |
| `CHANGELOG.md` | Version history and release notes |
| `LICENSE` | License file (AGPL-3.0) |
| `CONTRIBUTING.md` | Contribution guidelines and development setup |
| `CODE_OF_CONDUCT.md` | Contributor Covenant Code of Conduct |
| `CITATION.cff` | Citation metadata (CFF format) |
| `.github/` | GitHub community files (CODEOWNERS, PR template) |
| `.gitignore` | Git ignore patterns |
| `package.json` | Package configuration |
| `user_settings.json.template` | Configuration template → generates `$HOME/.anchor/user_settings.json` (see Runtime Object Storage) |
| `validate-json.mjs` | Script to build user_settings.json from template (runs on `pnpm install` + `pnpm start`) |
| `pnpm-lock.yaml` | PNPM dependency lock file |
| `pnpm-workspace.yaml` | PNPM monorepo workspace configuration |
| `pnpm.cmd` | Windows PNPM launcher |
| `pnpm.ps1` | PowerShell PNPM launcher |
| `.dockerignore` | Docker build exclusions |
| `.npmignore` | NPM publish exclusions |
| `.npmrc` | NPM/PNPM runtime configuration |
| `.gitattributes` | Git line-ending and diff configuration |
| `.env` | Environment variables (gitignored, never committed) |
| `.scratch.md` | **Agent-only exception** - Session notes for AI agents during development (never committed to main) |
| `user_settings.docker.json` | Docker-specific user settings template |
| `verify-anchor-config.js` | Script to verify anchor configuration |
| `setup-user-config.mjs` | Script to setup user configuration on first run |
| `verify-schema.mjs` | Script to verify database schema |
| `vite.config.ts` | Vite build configuration |
| `vitest-root.config.ts` | Vitest root configuration |
| `playwright.config.ts` | Playwright e2e test configuration |
| `.eslintrc.cjs` | ESLint code linting configuration |
| `README_TESTING.md` | Quick reference for running tests |
| `Dockerfile` | Docker build file for containerization |
| `docker-compose.yml` | Docker Compose orchestration file |
| `scripts/start-engine.ps1` | PowerShell script to start engine |
| `scripts/stop-engine.bat` | Batch script to stop engine |
| `scripts/start-engine-bg.mjs` | Node.js background startup (Standard 015) |
| `scripts/stop-engine-bg.mjs` | Node.js background shutdown (Standard 015) |
| `scripts/sync-version.mjs` | Post-version hook — syncs version across package.json files |
| `scripts/run-engine.bat` | Windows batch launcher for engine |
| `scripts/start-engine.bat` | Windows batch startup script |
| `scripts/build.ts` | TypeScript build script |
| `scripts/engine_server.py` | Python engine server wrapper |

**PROHIBITED in Root:**
- Phase completion reports
- Implementation summaries
- Git operation logs
- Temporary documentation files
- Any other `.md` files not listed above
- `skills.md` (not allowed)

**Note:** `user_settings.json.template`, `validate-json.mjs`, `verify-anchor-config.js`, and `setup-user-config.mjs` are essential for runtime configuration generation. They are documented in the README's Configuration Guide.

**Note:** `.scratch.md` is an **agent-only exception** - these session notes should never be committed to main branch and are meant for temporary AI agent development work. The file is .gitignored when not in agent sessions.

### 2.2 Specs Directory (`/specs/`)

**Core Files:**
| File | Purpose |
|------|---------|
| `spec.md` | Main technical specification with architecture diagrams, web dashboard, engine core modules |
| `plan.md` | Development roadmap and phased implementation |
| `tasks.md` | Current implementation tasks and priorities |
| `doc_policy.md` | This documentation policy |
| `DATA-MODEL.md` | Data model: Compound → Molecule → Atom → Tag hierarchy |

**Subdirectories:**
- `current-standards/` - 38 active architecture standards (flat directory, numbered 001–038). **README.md is allowed here as a quick-reference index for the standards.**
- `INTEGRATIONS/` - Integration specifications (MCP)

**PROHIBITED in specs root:**
- Duplicate documentation already in README
- Phase reports or implementation logs
- Redundant standards documentation
- Architecture decision records (merge into relevant standards instead)

### 2.3 Docs Directory (`/docs/`)

**Core Files:**

| File | Purpose |
|------|---------|
| `INDEX.md` | Documentation index and navigation hub |
| `whitepaper.md` | STAR Algorithm whitepaper — theoretical foundation |
| `paper.md` | Academic paper (JOSS/TechArxiv submission) |
| `settings-configs.md` | Consolidated settings and configuration reference |
| `code-patterns.md` | Code patterns used throughout the codebase |
| `design-patterns.md` | Design patterns and architectural decisions |
| `star-algebra-reference.md` | STAR algebra reference and search algorithm details |
| `benchmarks.md` | Performance benchmark documentation |
| `process-pipeline-refactor.md` | Processing pipeline refactoring notes |
| `streaming-ingestion-test-plan.md` | Streaming ingestion test plan for local agents |
| `DOC_AUDIT_REPORT.md` | Latest documentation audit report (June 2026) |

**Subdirectories:**
- `workflows/` - User workflow guides (`in-use.md`, `ideas.md`, `llm-testing.md`)
- `integrations/` - Integration guides (`CODE_OF_CONDUCT.md`, `CONTRIBUTING.md`)

**PROHIBITED in docs root:**
- Temporary files
- Unfinished drafts
- Phase-specific reports

---

## 3. Documentation Standards

### 3.1 README.md Structure

```markdown
# Anchor Engine

## Quick Start (5-minute setup)
## Core Features
## Architecture Overview
## API Reference (summary)
## Configuration Guide
## Performance Benchmarks
## Security Hardening
## Contributing
## License
```

### 3.2 CHANGELOG.md Format

- Follow [Keep a Changelog](https://keepachangelog.com/) format
- Semantic versioning (MAJOR.MINOR.PATCH)
- Group changes by: Added, Changed, Deprecated, Removed, Fixed, Security
- Include date and version number
- Link to GitHub releases when applicable

### 3.3 Standards (specs/current-standards/)

- Numbered format: `XXX-title.md`
- Include: Purpose, Problem Statement, Solution, Implementation Details, Testing
- Reference related standards
- Include code examples where applicable

---

## 4. Prohibited Documentation Patterns

**DO NOT CREATE in Root:**
- ❌ Phase completion reports (PHASE_1_COMPLETE.md, etc.)
- ❌ Implementation update logs (BATCHING_UPDATE.md, etc.)
- ❌ Git operation logs (GIT_PUSH_COMPLETE.md, etc.)
- ❌ Consolidation summaries (DOCS_CONSOLIDATION_SUMMARY.md, etc.)
- ❌ Standard implementation reports (STANDARD_109_IMPLEMENTATION.md, etc.)

**Instead, update:**
- ✅ `README.md` with new features and architecture
- ✅ `CHANGELOG.md` with version changes
- ✅ `specs/current-standards/` with architecture standards
- ✅ `specs/spec.md` with architectural changes
- ✅ `docs/` with user-facing guides

---

## 5. Runtime Object Storage

**⚠️ CRITICAL: All runtime objects are stored in `$home/.anchor`**

This includes:
- **Logs:** `.anchor/logs/` (search logs, distillation logs, engine logs)
- **Database:** `.anchor/context_data/` (PGlite database)
- **Distillation outputs:** `.anchor/notebook/distills/` (YAML/JSON summaries)
- **Test outputs:** `.anchor/test-output/` (test result files)
- **Audit files:** `.anchor/logs/.<hash>-audit.json`
- **Session data:** `.anchor/sessions/`
- **Inbox files:** `.anchor/inbox/`, `.anchor/external-inbox/`
- **Mirrored brain:** `.anchor/mirrored_brain/`
- **User settings:** `.anchor/user_settings.json` (runtime configuration - NEVER in project root)

**Never assume files are in the project root or `engine/` directory.** Always check `.anchor/` first for runtime data.

---

## 6. Maintenance Guidelines

### 6.1 Before Merging PR

- [ ] Verify no prohibited `.md` files in root
- [ ] Ensure all new features documented in README or CHANGELOG
- [ ] Update relevant standards in `specs/current-standards/`
- [ ] Remove temporary documentation files after integration
- [ ] **Verify user_settings.json is NOT in project root** (should be in `.anchor/user_settings.json`)

### 6.2 Automated Checks (Future CI/CD)

- Reject PRs with prohibited `.md` files in root
- Verify `CHANGELOG.md` updated for version changes
- Check `README.md` includes new features
- Validate documentation links and cross-references

### 6.3 Content Ownership

| Domain | Owner | Primary Location |
|--------|-------|------------------|
| **Architecture** | Architecture Team | `specs/spec.md`, `specs/current-standards/` |
| **User Guides** | Documentation Team | `docs/` (whitepaper, workflows, integrations) |
| **API Reference** | Development Team | `specs/spec.md`, `engine/src/routes/v1/` |
| **Deployment** | DevOps Team | `README.md` (Quick Start), `Dockerfile` |
| **Testing** | QA Team | `engine/tests/`, `README_TESTING.md` |

---

## 7. Migration Path

### 7.1 Root-to-Docs Migration

Move root-level documentation to appropriate `docs/` subdirectories:

| Root File | Target Location | Status |
|-----------|-----------------|--------|
| `FRICTIONLESS_SPEC.md` | `docs/guides/frictionless-spec.md` | ✅ |
| `MCP_AGENT_SETUP.md` | `docs/integrations/mcp-agent.md` | ✅ |
| `RECURSIVE_SEARCH_FALLBACKS.md` | `docs/technical/recursive-search.md` | ✅ |
| `PAIN_POINTS_DOCUMENTATION.md` | `docs/guides/pain-points.md` | ✅ |
| `CLAW-CODE-INTEGRation.md` | `docs/integrations/claw-integration.md` | ✅ |

### 7.2 Specs Consolidation

**Current State:**
- `specs/` contains 5 core files: `spec.md`, `plan.md`, `tasks.md`, `doc_policy.md`, `DATA-MODEL.md`
- `specs/current-standards/` has 38 active standards in a flat directory (numbered 001–038)
- Architecture diagrams merged into `spec.md` (removed standalone `ARCHITECTURE.md`)
- Decision records merged into relevant standards (removed `decisions/` directory)

**Target State:**
- No additional `.md` files in `specs/` root
- All standards in flat `current-standards/` directory, ordered foundational → assistive
- Integration specs remain in `INTEGRATIONS/`

---

## 8. Rationale

**Why this policy?**
1. **Prevents Documentation Sprawl:** Clear boundaries prevent uncontrolled growth
2. **Ensures Single Source of Truth:** Each topic has one authoritative location
3. **Makes Finding Information Easier:** Users know where to look for specific content
4. **Reduces Maintenance Burden:** Clear ownership and structure
5. **Keeps Repository Clean and Professional:** Root remains focused on essentials

**What to do with implementation notes?**
1. Update relevant standard in `specs/current-standards/` (if architectural)
2. Add to `CHANGELOG.md` (if user-facing change)
3. Add to `README.md` (if new feature or major update)
4. Archive to `docs/` (if detailed guidance needed)
5. Delete temporary notes after integration

---

## 9. Version History

| Version | Date | Changes |
|---------|------|---------|
|| 2.6 | 2026-06-16 | Allowed README.md as quick-reference index in current-standards/. Removed agent-skills directory — consolidated skills into existing specs/standards structure. Streamlined policy by removing redundant agent skill documentation. |
| 2.4 | 2026-06-14 | Added streaming ingestion architecture (streaming-file-chunker.ts), removed stale schema-migration.sql, added streaming/worker_threads/cron to user_settings template, fixed ghost Standard 110/111→024 references, enabled empty-seed full-corpus distillation, added docs/streaming-ingestion-test-plan.md, deleted root clutter (0, build_errors.txt) |
| 2.4 | 2026-06-13 | Renumbered standards 001-038 (unique), removed dead root core/services, dropped packages/, updated docs/ inventory, synced all versions to 5.3.0 |
| 2.3 | 2026-06-10 | Flattened standards (38, no subdirectories), merged ARCHITECTURE.md into spec.md, removed archive-legacy and decisions references, updated docs/ section to match reality, added restored docs files, dropped PM2, switched to pnpm-only |
| 2.2 | 2026-06-05 | Cleaned WASM/NAPI references, fixed duplicate sections, updated standards count |
| 2.1 | 2026-05-25 | Updated version to 2.1 |
| 2.0 | 2026-04-09 | Restructured for clarity, consolidated specs and docs |
| 1.0 | 2026-02-20 | Initial documentation policy |

---

**Last Updated:** June 16, 2026
**Version:** 2.6
**Status:** ✅ Active
