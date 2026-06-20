# Anchor Engine — Documentation Index

**Version:** 5.3.0 | **Updated:** June 13, 2026 | **Status:** ✅ Production Ready

---

## 📚 Quick Navigation

### Getting Started
- **[README.md](../README.md)** — Quick start, installation, usage guide
- **[CHANGELOG.md](../CHANGELOG.md)** — Version history (latest: v5.3.0)
- **[settings-configs.md](settings-configs.md)** — Consolidated settings and configurations

### Core Documentation (`docs/`)
| File | Purpose |
|------|---------|
| **[whitepaper.md](whitepaper.md)** | STAR Algorithm whitepaper — theoretical foundation |
| **[paper.md](paper.md)** | Academic paper (JOSS/TechArxiv submission) |
| **[settings-configs.md](settings-configs.md)** | Unified configuration reference |
| **[code-patterns.md](code-patterns.md)** | Code patterns used throughout the codebase |
| **[design-patterns.md](design-patterns.md)** | Design patterns and architectural decisions |
| **[star-algebra-reference.md](star-algebra-reference.md)** | STAR algebra reference and search algorithm details |

### User Workflows (`docs/workflows/`)
| File | Purpose |
|------|---------|
| **[in-use.md](workflows/in-use.md)** | Current manual workflow guide |
| **[ideas.md](workflows/ideas.md)** | Future workflow automation ideas |

### Integration Guides (`docs/integrations/`)
| File | Purpose |
|------|---------|
| **[CODE_OF_CONDUCT.md](integrations/CODE_OF_CONDUCT.md)** | Contributor Covenant Code of Conduct |
| **[CONTRIBUTING.md](integrations/CONTRIBUTING.md)** | Contribution guidelines |

### Architecture & Standards (`specs/`)
| File | Purpose |
|------|---------|
| **[specs/spec.md](../specs/spec.md)** | System specification with architecture diagrams |
| **[specs/plan.md](../specs/plan.md)** | Development roadmap and phased implementation |
| **[specs/tasks.md](../specs/tasks.md)** | Current implementation tasks and priorities |
| **[specs/doc_policy.md](../specs/doc_policy.md)** | Documentation policy — single source of truth for file locations |
| **[specs/DATA-MODEL.md](../specs/DATA-MODEL.md)** | Data model: Compound → Molecule → Atom → Tag hierarchy |

**Standards:** 38 active architecture standards in **[specs/current-standards/](../specs/current-standards/)** (flat directory, ordered foundational → assistive).

### Source Code (`engine/`)
- **[engine/src/README.md](../engine/src/README.md)** — Source code overview, technology stack (Rust WASM + PGlite)
- **[engine/tests/](../engine/tests/)** — Integration, live-fire, and unit test suites

---

## 🎯 Documentation by Use Case

### "I want to install and run Anchor Engine"
→ Start with **[README.md](../README.md)** — Quick Start section

### "I need API documentation"
→ The API surface is documented in **[specs/spec.md](../specs/spec.md)** and the route files in `engine/src/routes/v1/`

### "Something's not working"
→ Check **[specs/plan.md](../specs/plan.md)** for known risks and mitigations. Runtime logs live in `$HOME/.anchor/logs/`.

### "I need to understand the system architecture"
→ Study **[specs/spec.md](../specs/spec.md)** (includes architecture diagrams, web dashboard, engine core modules)

### "I'm researching the theory behind Anchor Engine"
→ Read **[whitepaper.md](whitepaper.md)** and **[paper.md](paper.md)**

### "I want to understand the search algorithm (STAR)"
→ See **[specs/spec.md](../specs/spec.md#star-search-algorithm)** and search standards in `specs/current-standards/`

### "How does distillation work?"
→ Read **[specs/current-standards/010-radial-distillation-v2.md](../specs/current-standards/010-radial-distillation-v2.md)**

### "I want to contribute code"
→ Start with **[specs/doc_policy.md](../specs/doc_policy.md)** for conventions, then **[engine/src/README.md](../engine/src/README.md)** for source structure

### "I want to explore standards"
→ Browse **[specs/current-standards/](../specs/current-standards/)** — 38 active standards with full implementation details

---

## 📊 Key Metrics (v5.3.0)

| Metric | Value | Status |
|--------|-------|--------|
| **Context Retrieval** | 618k chars | ✅ +18% vs whitepaper |
| **Memory Peak** | 510MB (idle) | ✅ -70% vs whitepaper |
| **Search Latency** | <200ms (p95, standard queries) | ✅ Optimized |
| **Ingestion Throughput** | 1,200 mol/sec | ✅ Verified |
| **Deduplication Rate** | 40–50% | ✅ With SimHash |
| **Active Standards** | 38 | ✅ Flattened, numerically ordered |
| **WASM Module Size** | ~1.4 MB (4 packages) | ✅ 90% smaller than C++ DLLs |

---

## 🗂️ Document Structure

```
anchor-engine-node/
├── README.md                          # Start here — quick start & usage
├── CHANGELOG.md                       # Version history (v5.3.0)
├── LICENSE                            # AGPL-3.0
├── user_settings.json.template        # Configuration template → $HOME/.anchor/
│
├── docs/                              # User-facing documentation
│   ├── INDEX.md                       # This file
│   ├── whitepaper.md                  # STAR algorithm whitepaper
│   ├── paper.md                       # Academic paper
│   ├── settings-configs.md            # Consolidated configuration reference
│   ├── code-patterns.md               # Code patterns guide
│   ├── design-patterns.md             # Design patterns
│   ├── star-algebra-reference.md      # STAR algebra reference
│   ├── workflows/                     # User workflow guides
│   │   ├── in-use.md
│   │   └── ideas.md
│   └── integrations/                  # Integration guides
│       ├── CODE_OF_CONDUCT.md
│       └── CONTRIBUTING.md
│
├── specs/                             # Technical specifications
│   ├── spec.md                        # System specification (incl. architecture)
│   ├── plan.md                        # Development roadmap
│   ├── tasks.md                       # Current tasks
│   ├── doc_policy.md                  # Documentation policy
│   ├── DATA-MODEL.md                  # Data model
│   ├── current-standards/             # 38 active standards (flat, numeric)
│   └── INTEGRATIONS/                  # Integration specs
│
├── engine/                            # Anchor Engine implementation
│   ├── package.json                   # WASM dependencies (@rbalchii/*-wasm)
│   ├── src/                           # TypeScript source
│   │   └── README.md                  # Source code overview
│   └── tests/                         # Test suites
│       ├── integration/               # Integration tests
│       ├── live-fire/                 # Live-fire test scripts
│       └── unit/                      # Unit tests
│
├── scripts/                           # Build and operational scripts
│   ├── build.ts                       # TypeScript compilation
│   ├── start-engine-bg.mjs            # Background engine startup
│   └── stop-engine-bg.mjs             # Background engine shutdown
│
└── test-wasm/                         # WASM tree-sitter test harness
    └── README.md
```

---

## 🔬 Recent Updates (v5.3.0)

### Documentation Drift Repair (June 2026)
- **Renumbered standards**: All 38 standards now uniquely numbered 001-038 (was 001-032 with duplicates)
- **Removed dead code**: Deleted orphaned `core/` and `services/` at root (6,597 lines duplicated from engine/src/)
- **Deprecated `packages/` removed**: References cleaned from pnpm-workspace.yaml and spec
- **Synced versions**: All files now consistently say 5.3.0

### Documentation Consolidation (June 2026)
- **Flattened standards**: All 38 active standards now live in `specs/current-standards/` as a flat directory
- **Merged ARCHITECTURE.md** into `specs/spec.md` — architecture now lives in the system specification
- **Restored docs**: Recovered `code-patterns.md`, `design-patterns.md`, `star-algebra-reference.md` from git history
- **Deleted clutter**: Removed 19 one-off fix scripts, PM2 configs, and stale runtime data from project root
- **Fixed .gitignore**: Removed embedded code, resolved contradictions with tracked files

### WASM-Native Architecture (v4.3.0+)
- All performance-critical operations use **Rust-compiled WebAssembly** (`@rbalchii/*-wasm` packages)
- **Zero native compilation** required — runs on Windows ARM64, macOS, Linux without C++ toolchains
- Old C++ N-API modules (`engine/src/native/`) fully removed

### Security Hardening
- Path Traversal Prevention (Standard 029)
- Auth Bypass Prevention (Standard 027)
- API Key Strength Validation (Standard 028)
- Zero-Copy Deduplication (Standard 030)

---

## 🔗 External Resources

- **GitHub Repository:** https://github.com/RSBalchII/anchor-engine-node
- **License:** AGPL-3.0
- **NPM Packages:** @rbalchii/* (Rust WASM modules)
- **DOI:** https://doi.org/10.5281/zenodo.18841399

---

**Last Updated:** June 13, 2026
**Version:** 5.3.0
**Status:** ✅ Production Ready
