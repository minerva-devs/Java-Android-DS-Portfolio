# Context Engine Architecture

## Overview

The Anchor Context Engine is a deterministic, physics-inspired knowledge retrieval system
that operates without neural embeddings. It uses full-text search (FTS5), SimHash-based
locality-sensitive hashing, and a PageRank-style graph walker to find and rank relevant
context from an ever-growing personal knowledge base.

## Core Components

### Atomizer
The Atomizer breaks incoming documents into molecules (individual lines or paragraphs)
and atoms (topic-coherent clusters of molecules). Each atom receives:
- A content hash (MD5) for deduplication
- A SimHash fingerprint for similarity detection
- Extracted tags, entities, and temporal metadata
- Byte-range markers for context inflation

### Physics Walker
The Physics Walker traverses the knowledge graph using a damped random walk algorithm
inspired by PageRank. Starting from anchor nodes (search hits), it explores neighboring
atoms weighted by edge strength, temporal proximity, and tag co-occurrence.

Key parameters:
- **Damping factor** (0.85): Probability of following an edge vs. teleporting
- **Temperature** (0.2): Controls exploration vs. exploitation
- **Walk radius** (1-3 hops): How far from anchors to explore
- **Gravity threshold** (0.01): Minimum relevance to include

### Context Inflation
After finding anchor atoms, the Context Inflator expands each result by reading
surrounding bytes from the original source file. This "radial inflation" provides
narrative continuity — the user sees not just the matching line, but the full
paragraph or conversation turn that contains it.

### SimHash Deduplication
SimHash provides near-duplicate detection across the entire corpus. Two atoms with
a Hamming distance ≤ 3 are considered duplicates and merged during search, preventing
redundant results from appearing in the context window.

## Data Flow

1. **Ingestion**: Files dropped in `inbox/` → Atomizer → PGlite + SQLite FTS5
2. **Search**: Query → FTS5 term matching → Physics Walker → Context Inflation → Results
3. **Feedback**: Quarantine/cure atoms → Graph weight adjustment → Better future results

## Performance

On a 200K molecule corpus (92MB source file):
- Ingestion: ~60 seconds (with C++ FTS backend)
- Search: ~1.3 seconds (35 FTS hits + molecule fallback)
- Memory: ~680MB RSS at steady state

## Design Principles

1. **No neural dependencies**: Works without GPUs, cloud APIs, or embedding models
2. **Deterministic**: Same query always returns same results (no stochastic layers)
3. **Incremental**: New data is ingested without rebuilding the entire index
4. **Portable**: Runs in Docker, native Node.js, or Electron
5. **Privacy-first**: All data stays local, no external calls required
