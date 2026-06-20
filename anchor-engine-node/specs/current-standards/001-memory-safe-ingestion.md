# Standard 001: Memory‑Safe File Ingestion

**Status:** Active  
**Date:** 2026-03-13  
**Supersedes:** Embedded warnings in `scripts/read_all.js`

## Context
Anchor Engine processes files from the filesystem and builds an in‑memory graph of molecules and atoms. Very large files or files containing more than 10,000 molecules have been observed to cause out‑of‑memory (OOM) crashes due to Node.js heap limits during ingestion.

## Requirements
1. **File Size Limit:** No single file larger than 10 MB shall be ingested as a whole. Files exceeding this limit must be split into smaller logical chunks before ingestion.
2. **Molecule Count Limit:** No file that atomizes to more than 10,000 molecules shall be processed in a single ingestion pass. Such files must be split or processed in a streaming fashion.
3. **Directory Structure Preservation:** The original natural directory structure of ingested files must be preserved in the mirrored brain. Do not combine files from different directories into a single compound.

## Implementation Notes
- The GitHub ingester (`scripts/github-ingester.js`) should automatically reject or split files exceeding these limits.
- The streaming ingestion service (`/v1/ingest/streaming`) can be used for large files.
- When splitting, ensure that each chunk retains provenance metadata linking back to the original file and location.

### v5.3.0 Streaming Chunker (June 2026)

The `streaming-file-chunker.ts` module reads files from disk in configurable
1 MB windows instead of loading the entire file into memory. Each window is
split on sentence boundaries (prose) or line boundaries (code/data), atomized
through the existing pipeline, and persisted via batched INSERTs. The event
loop is yielded between every window via `setImmediate()` or a configurable
`yield_interval_ms`, keeping API requests responsive during ingestion of
files of any size.

**Key design decisions:**
- Window size: 1 MB (configurable via `streaming.window_bytes`)
- Stream threshold: 10 MB (files smaller use the legacy full-load path)
- Sentence boundary: `/[.!?]\s+(?=[A-Z0-9])/g` with 64 KB lookahead
- Structured formats (JSON, YAML) delegate to the existing `file-chunker.ts`
- GC + PGlite CHECKPOINT every 10 chunks prevents WASM heap exhaustion
- Mirror write skipped for streaming files (chunks processed from original)
- Synonym generation deferred for streaming sessions (CPU-bound on large corpora)

**Batch insert optimization:**
Atoms and edges were previously inserted one row per `db.run()` call (~400
PGlite round-trips per 1 MB chunk). Now batched in groups of 50 via multi-row
INSERT statements (~9 round-trips per chunk). This reduces the persistence
step from 400-1500ms to ~50-100ms per chunk. Molecules and tags were already
batched. Combined with event-loop yielding, the ingestion pipeline has O(1)
characteristics at every level: fixed disk I/O, fixed PGlite round-trips,
fixed memory ceiling.