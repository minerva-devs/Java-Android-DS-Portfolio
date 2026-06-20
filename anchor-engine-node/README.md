# Anchor Engine ⚓

**Deterministic semantic memory for local‑first AI systems**

> ⚠️ **FIRST READ THIS**: The [Documentation Policy](./specs/doc_policy.md) is the **single source of truth** for all abstractions, file locations, and developer conventions. **All runtime objects are stored in `$HOME/.anchor/`** and are **never** in the project root. Read it before coding.

## 🎯 Quick Navigation

### 👨‍💻 **Developers** - Building, Testing, Debugging

**Start here:**
1. [**Documentation Policy**](./specs/doc_policy.md) - Required read (abstractions, paths, conventions)
2. [**Project Specs**](./specs/spec.md) - Architecture, API, data model, test framework
3. [**Current Standards**](./specs/current-standards/) - Active architecture standards (001-038)

**Quick reference:**
- [**Test Framework**](./specs/spec.md#test-framework-architecture) - How to test (P0, Vitest, integration, operational)
- [**Test Usability**](./README_TESTING.md) - Automated runtime verification

---

### 🧠 **Users** - Understanding, Using, Exploring

**Start here:**
1. [**Whitepaper**](./docs/whitepaper.md) - The STAR Context Protocol (conceptual, no code)
2. [**API Endpoints**](./specs/spec.md#api-endpoints) - Available API routes and usage
3. [**Architecture Overview**](./specs/spec.md#architecture-overview) - How it works (high-level)

**For deeper knowledge:**
- [**STAR Algorithm**](./specs/spec.md#star-search-algorithm) - The physics-inspired retrieval engine
- [**Data Model**](./specs/spec.md#data-model-compound-molecule-atom) - Compound → Molecule → Atom hierarchy

---

### 📚 **Documentation Structure**

| Directory | Audience | Purpose | Key Files |
|-----------|----------|---------|----------|
| **`specs/`** | 🧑‍💻 Developers | Technical architecture, implementation, API | [spec.md](specs/spec.md), [current-standards/](specs/current-standards/) |
| **`docs/`** | 🧠 Users | Conceptual understanding, whitepaper, theory | [whitepaper.md](docs/whitepaper.md) |
| **`engine/`** | 🧑‍💻 Developers | Source code, tests, API routes | [src/](engine/src/), [tests/](engine/tests/) |

---

## 🚀 Quick Start

### Installation (All Users)

```bash
# Clone and install
git clone https://github.com/RSBalchII/anchor-engine-node
cd anchor-engine-node
pnpm install

# Start the engine
pnpm start
```

### Development (Developers)

```bash
# Run tests
pnpm test

# Start with logging
pnpm start

# Run operational verification
python tests/test_us006.py
```

---

## 📖 What Anchor Engine Is

**Anchor Engine is a semantic memory layer** — not an agent framework, not a vector database, and not a cloud service.

It's a **deterministic, explainable, CPU‑only system** for storing and retrieving long-term memory for AI agents.

It replaces embeddings with a **physics‑inspired graph algorithm (STAR)** that retrieves context using structure, time, and meaning — not dense vectors.

### What Anchor Engine Provides

- ✅ **Deterministic retrieval** — same query → same result
- ✅ **Graph‑based semantics** — not probabilistic similarity
- ✅ **Temporal decay** — older memories naturally fade
- ✅ **Provenance receipts** — every retrieval comes with proof
- ✅ **CPU‑only performance** — <1GB RAM, no GPU needed
- ✅ **Local‑first architecture** — your data never leaves your machine

### Use Cases

Use it as:
- A **drop‑in replacement** for embeddings/vector DBs
- A **memory backend** for MCP‑compatible agents (Claude, Cursor, Qwen Code)
- A **personal knowledge system** for long‑term projects

### What Anchor Engine Is Not

❌ **Not an agent framework**  
❌ **Not a cloud service**  
❌ **Not a probabilistic vector search engine**  
❌ **Not a tool that stores your data anywhere except your machine**

### Why This Exists

Most AI memory systems today assume:
- GPU‑heavy vector search
- Probabilistic retrieval
- Cloud dependence
- Opaque similarity metrics

I kept running into the same problem:
> I needed a memory system that behaved like a mind, not a search engine.

Anchor Engine is built around three principles:
1. **Determinism** — same query → same result
2. **Explainability** — every retrieval comes with provenance
3. **Local sovereignty** — your data stays on your machine

This project grew out of months of building agents that needed reliable memory — and discovering that existing tools weren't designed for that job.

---

## 🎓 Citation

If you use this software in your research, please cite:

**DOI:** https://doi.org/10.5281/zenodo.19324840  
**Citation:** Balch II, R. S. (2026). STAR: Semantic Temporal Associative Retrieval - A Local-First Graph-Based Context Engine (v5.0.0). Zenodo.

**Software:** [Anchor Engine Node](https://github.com/RSBalchII/anchor-engine-node)  
**License:** AGPL-3.0

---

## ⚡ Architecture & Technology Stack

### Native Modules (Rust WASM)

Anchor Engine uses Rust-compiled WebAssembly modules for performance-critical operations. This eliminates the need for native compilation and provides universal platform support.

**Published Packages:**

| Package | Purpose | Version |
|---------|---------|----------|
| @rbalchii/anchor-fingerprint-wasm | Content fingerprinting (MD5, SHA256) | 1.0.0+ |
| @rbalchii/anchor-atomizer-wasm | Text atomization & entity extraction | 1.0.0+ |
| @rbalchii/anchor-keyextract-wasm | Key-value extraction from text | 1.0.0+ |
| @rbalchii/anchor-tagwalker-wasm | Semantic tag traversal | 1.0.0+ |

**Benefits:**
- ✅ Zero native compilation required (works on Windows ARM64, macOS, Linux)
- ✅ ~90% smaller binary size (~1.4 MB WASM vs ~12 MB C++ DLLs)
- ✅ 8x faster module loading (benchmarks: ~50ms vs ~400ms for native)
- ✅ Universal platform support

> Note: The older C++ native modules (`engine/src/native/` directory) have been deprecated and removed in favor of these Rust WASM packages. See `engine/src/README.md` for full architectural details.

### QwenPaw Agent Configuration Protection 🔒

To protect sensitive QwenPaw agent configuration files from being accidentally committed to the repository, the following files are now gitignored:

- `BOOTSTRAP.md`
- `MEMORY.md`
- `PROFILE.md`
- `SOUL.md`
- `AGENTS.md`

These files may contain private information and should never be shared. The `.gitignore` has been updated to prevent accidental commits of these sensitive configuration files.

---

## 🔗 Key Links

### For Developers
- [Documentation Policy](./specs/doc_policy.md)
- [Project Specs](./specs/spec.md)
- [Current Standards](./specs/current-standards/)
- [Test Framework](./specs/spec.md#test-framework-architecture)

### For Users
- [Whitepaper](./docs/whitepaper.md)
- [API Endpoints](./specs/spec.md#api-endpoints)
- [Architecture Overview](./specs/spec.md#architecture-overview)

### For Everyone
- [**Automated Testing**](./README_TESTING.md)
- [API Endpoints](./specs/spec.md#api-endpoints)

---

**Repository:** https://github.com/RSBalchII/anchor-engine-node  
**License:** AGPL-3.0  
**Version:** 5.3.0 | **Production:** ✅ Ready
