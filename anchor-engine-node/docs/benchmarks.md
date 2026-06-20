# Anchor Engine v5.2.0 — Live Corpus Benchmarks

**Date:** June 12, 2026
**Corpus:** 224,061 atoms | 222,842 molecules | 1,086 tags | 93 sources
**Hardware:** Windows ARM64, Node.js v23.9.0
**Engine:** PGlite (WASM), Rust WASM modules (fingerprint, atomizer, keyextract, tagwalker)

---

## Search Latency

| Query | Mode | Cold (ms) | Warm (ms) | Avg (n=3) |
|-------|------|-----------|-----------|-----------|
| `resume` | standard | 26,016 | 43 | 8,701 |
| `code` | max-recall | 27,772 | 8 | 9,263 |

Cold latency includes PGlite data loading into WASM memory. Warm cache is near-instant. Standard search uses 4,096 char budget; max-recall uses 65,536.

---

## Density Prefix (3-Tier RAG)

| Query | Avg (ms) |
|-------|----------|
| `density:` (full corpus map, top 100 concepts) | 1,348 |
| `density:contract` (single term) | 1,284 |

Density runs sequential COUNT queries on 224K atoms to prevent PGlite portal crashes. Concept extraction uses `unnest(tags)` grouped by tag with source count.

---

## Distillation (SimHash Dedup)

| Molecules | Normalization | Lines | Unique | Ratio | Time |
|-----------|---------------|-------|--------|-------|------|
| 100 | aggressive | 63 | 60 | 1.05:1 | 7ms |
| 222,842 | aggressive | 130,616 | 34,500 | 3.78:1 | 197s |

64-bit SimHash with Hamming distance ≤ 4 threshold, bucketed by top 16 bits.
Output grouped by source file with JSON unescaping and line-boundary alignment.

---

## API Endpoints

| Endpoint | Avg (ms) |
|----------|----------|
| `GET /health` | 6 |
| `GET /v1/stats` (4 sequential COUNT queries) | 182 |
| `GET /v1/atoms?limit=5` | 213 |
| `GET /v1/molecules?limit=5` | 403 |
| `GET /v1/distills` | 3 |
| `POST /v1/memory/search` (standard, warm) | ~43 |
| `POST /v1/memory/search` (max-recall, cold) | ~27,000 |
| `POST /v1/distillation/radial` (100 molecules) | 7 |

---

## Memory

| Metric | Value |
|--------|-------|
| RSS (resident set size) | 73 MB |
| Heap used | 8 MB |
| Heap total | 9 MB |
| Target ceiling | < 1,000 MB |

---

## Ingestion (from startup log)

| Files | Atoms | Molecules | Time |
|-------|-------|-----------|------|
| 93 sources | 224,061 | 222,842 | ~14s startup mirror rebuild |

Ingestion rate varies by content type. Chat sessions (YAML/JSON) atomize faster than dense markdown.

---

## Historical Comparison

| Version | Search (warm) | Density | Distill (full) | Memory |
|---------|---------------|---------|----------------|--------|
| v5.0.0 | ~80ms | — | — | ~120MB |
| v5.2.0 | ~43ms | ~1.3s | 3.78:1 @ 197s | 73MB |

---

## How to Run

```bash
# Live corpus benchmark (requires running engine on :3160)
node tests/benchmarks/live-corpus-bench.mjs

# Standard from package.json
pnpm test:bench
```

## Standard Compliance

See [Standard 002: Reproducible Benchmarking](../specs/current-standards/002-reproducible-benchmarking.md) for benchmark requirements (seeded randomness, comparison mode, JSON output).
