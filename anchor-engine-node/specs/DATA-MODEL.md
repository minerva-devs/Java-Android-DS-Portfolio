# Anchor-Engine Taxonomy

This document describes the actual data model used by the Anchor-Engine. The hierarchy flows top-down from source documents to extracted semantic units.

## Pointer-Only Database Architecture

**Important:** This engine uses a **pointer-only database architecture**. The PostgreSQL database stores only metadata pointers (IDs, timestamps, tags, byte offsets), while actual file content lives on disk in the `mirrored_brain/` filesystem.

### Storage Flow
1. **Ingestion**: Raw file content is written to `mirrored_brain/@inbox/{timestamp}_{hash}.md`
2. **Database**: Only stores pointers (compound ID, molecule IDs, atom IDs, byte offsets)
3. **Retrieval**: Search/distillation reads content from the filesystem, not from database columns

This architecture ensures:
- Database can be wiped and rebuilt from filesystem source of truth
- Distillation/retrieval reads from `mirrored_brain/`, not from DB storage
- Content is never duplicated in database columns

## Hierarchy

```
Compounds (source documents)
  └── Molecules  (text chunks within a document, IDs: mol_*)
        └── Atoms        (extracted entity/keyword labels with byte positions)
              └── Tags           (semantic fingerprints per atom — the "nervous system")

Edges   (weighted graph connections between any two nodes)
Atom Positions  (inverted index: keyword → byte offsets within a compound)
```

## Core Concepts

### Compounds
- **What they are**: The raw source documents ingested into the engine (markdown files, JSON exports, notes, etc.)
- **Content**: Full file body stored in `compound_body` column; path points to mirror location (`mirrored_brain/@inbox/...`)
- **Role**: The ground truth. All other nodes reference a `compound_id` back to their parent compound.
- **Database Table**: `compounds` — columns: `id`, `compound_body`, `path` (pointer to mirror), `timestamp`, `provenance`, `molecular_signature`, `atoms`, `molecules`, `embedding`

### Molecules
- **What they are**: Text chunks (sentences or semantic segments) sliced from a compound during ingestion
- **Content**: The raw text snippet (`content`), its byte range in the source file (`start_byte`, `end_byte`), sequence position, extracted `tags` and `entities` (JSONB), and a `molecular_signature` (simhash fingerprint)
- **IDs**: Prefixed `mol_*` (e.g. `mol_a86584e9372e`)
- **Role**: The primary unit of retrieval — search results and physics walker anchors are molecule IDs. Molecules are what the LLM receives as context.
- **Database Table**: `molecules` — columns: `id`, `content`, `compound_id`, `sequence`, `start_byte`, `end_byte`, `type`, `tags`, `entities`, `molecular_signature`, `embedding`, `timestamp`

### Atoms
- **What they are**: Individual entity or keyword label occurrences extracted from molecules
- **Content**: A label string (person name, concept, hashtag), source path, byte range, simhash, and optional embedding
- **Role**: The nodes that tags hang off of. The physics walker traverses atom→tag→atom connections to discover related molecules.
- **Database Table**: `atoms` — columns: `id`, `content`, `source_path`, `compound_id`, `start_byte`, `end_byte`, `simhash`, `tags`, `entities`, `type`, `sequence`, `embedding`, `timestamp`

### Tags
- **What they are**: Semantic labels assigned to atoms (e.g. `#rob`, `#coding`, `#emotional`) organized into named buckets
- **Content**: A `tag` string and a `bucket` (category namespace), linked to an `atom_id`
- **Role**: The "nervous system" — tags are the connective tissue used by the PhysicsTagWalker to propagate relevance from anchor atoms outward through the graph
- **Database Table**: `tags` — columns: `atom_id`, `tag`, `bucket`; indexed on `tag`, `bucket`, and `atom_id`

### Edges
- **What they are**: Weighted, directed connections between any two nodes (atoms, molecules, or compounds)
- **Content**: `source_id`, `target_id`, `relation` (type of connection), `weight` (0–1 float)
- **Role**: Explicit graph structure used by traversal algorithms alongside the implicit tag-based connections
- **Database Table**: `edges` — columns: `source_id`, `target_id`, `relation`, `weight`

### Atom Positions
- **What they are**: An inverted byte-offset index — records every position where an atom label (keyword) appears in a compound
- **Content**: `compound_id`, `atom_label`, `byte_offset`
- **Role**: Enables radial inflation — given a keyword, find its byte offset in a source file and expand outward ±N bytes to create a context window without loading the full document
- **Database Table**: `atom_positions` — columns: `compound_id`, `atom_label`, `byte_offset`; indexed on `atom_label`

### Engrams
- **What they are**: A key-value sidecar store for arbitrary lexical metadata
- **Role**: Lightweight persistent store for derived data (synonym rings, summary metadata, etc.) that doesn't fit the molecule/atom structure
- **Database Table**: `engrams` — columns: `key`, `value`

### Mirrored Brain Filesystem
- **What it is**: The primary storage location for actual file content
- **Location**: `.anchor/mirrored_brain/@{provenance}/...` (e.g., `@inbox/`, `@external-inbox/`)
- **Purpose**: Stores raw file content as markdown files with timestamp-based naming (`{timestamp}_{hash}.md`)
- **Access**: Distillation and retrieval read content from here, not from database columns

## How the Search Pipeline Uses This Taxonomy

1. **Atom search**: Query terms are matched against `atoms.content` and `tags.tag` to find initial anchor molecule IDs (`mol_*`)
2. **Physics Walker**: Starting from anchor molecules, the walker traverses the `tags` table — finding atoms that share tags with the anchors — and computes a gravity score (shared tag weight × hop damping × time decay × simhash similarity) to surface related molecules
3. **Radial inflation**: For each result molecule, the engine reads `atom_positions` to locate the molecule in the source file and inflates a byte window from `compound_body` for the final context snippet
4. **Deduplication**: Results are deduplicated by word-overlap (Jaccard similarity ≥ 60%) before delivery

## How Ingestion Produces This Taxonomy

1. A source file becomes a **Compound** (`compounds` row) — path points to mirror location
2. The file is chunked into **Molecules** (`molecules` rows, `mol_*` IDs, each with `start_byte`/`end_byte`)
3. NLP extracts entities and keywords from each molecule → **Atoms** (`atoms` rows)
4. Each atom's labels are stored as **Tags** (`tags` rows) and their byte positions as **Atom Positions** (`atom_positions` rows)
5. Co-occurrence and similarity relationships are written as **Edges** (`edges` rows)
6. Raw file content is written to `mirrored_brain/@inbox/{timestamp}_{hash}.md` (pointer-only architecture)

## Database vs Filesystem Storage Summary

| Component | Database Storage | Filesystem Storage |
|-----------|------------------|-------------------|
| **Compound** | ID, timestamp, provenance, molecular_signature | Full content in `mirrored_brain/` |
| **Molecule** | Content text, byte offsets, tags, entities | — (derived from compound) |
| **Atom** | Label, byte range, simhash, embedding | — (derived from molecules) |
| **Tag** | Tag name, bucket, atom_id | — (metadata only) |
| **Edge** | Source ID, target ID, relation, weight | — (graph structure only) |

The database is disposable and can be rebuilt from the filesystem source of truth. This ensures data integrity and prevents corruption from database-only storage.