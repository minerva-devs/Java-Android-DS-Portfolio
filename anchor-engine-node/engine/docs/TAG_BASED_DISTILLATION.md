# Tag-Based Distillation

**Version:** 1.0.0  
**Date:** March 27, 2026  
**Status:** Active  

---

## Summary

Tag-based distillation is a new mode for the Anchor Engine's radial distillation system that provides comprehensive, tag-organized content extraction. Instead of processing files sequentially, it iterates through all tags in the corpus, fetches all content associated with each tag, and deduplicates overlapping results.

This approach is ideal for:
- **Knowledge extraction** - Get all content about a specific concept (tag)
- **Comprehensive search** - Retrieve everything tagged with related topics
- **Content organization** - Organize output by semantic concepts (tags)
- **Cross-file concepts** - Find all mentions of a concept across multiple files

---

## Problem Statement

The standard distillation mode processes files sequentially, which works well for document-centric workflows. However, for **concept-centric** workflows, users want to:

1. Search by semantic concepts (tags) like `#Architecture`, `#Authentication`, `#PAT`
2. Get **all content** tagged with those concepts
3. See content organized by topic, not by file
4. Avoid duplicates when the same concept appears in multiple files

The previous approach returned headings without full context, making it less useful for coding work.

---

## Solution

Tag-based distillation mode changes the pipeline:

### Standard Mode (File-Centric)
```
Compounds → Extract Blocks → Deduplicate → Decision Records
```

### Tag-Based Mode (Concept-Centric)
```
Tags → Fetch All Atoms per Tag → Extract Blocks → Dedup Across Tags → Decision Records
```

---

## API Usage

### Endpoint 1: General Distill (with tag mode)

```bash
POST /v1/memory/distill
Content-Type: application/json

{
  "mode": "tag-based",
  "seed": {
    "tags": ["#Architecture", "#Authentication", "#PAT"]
  },
  "output_format": "json"
}
```

### Endpoint 2: Dedicated Tag Distill

```bash
POST /v1/memory/distill/tags
Content-Type: application/json

{
  "tags": ["#Architecture", "#Authentication"],
  "output_format": "json"
}
```

### Get All Tags First

```bash
GET /v1/tags
```

Then distill all tags:

```bash
POST /v1/memory/distill/tags
{
  "tags": [],  // Empty = all tags
  "output_format": "json"
}
```

---

## Implementation

### Key Functions

#### `fetchAllTags(): Promise<string[]>`
Fetches all unique tags from the `tags` table.

```typescript
const allTags = await fetchAllTags();
// Returns: ["#Architecture", "#Authentication", "#PAT", ...]
```

#### `fetchAtomsByTag(tag: string): Promise<any[]>`
Fetches all atoms (with full content) for a specific tag.

```typescript
const atoms = await fetchAtomsByTag("#Architecture");
// Returns atoms with id, content, source_path, tags, bucket
```

#### `tagBasedDistill(request): Promise<{blocks, digitalObjects, compoundsProcessed}>`
Main tag-based distillation logic:
1. Fetches all tags (or uses provided subset)
2. For each tag, fetches all associated atoms
3. Tracks processed atoms to avoid duplicates across tags
4. Extracts semantic blocks from content
5. Tags blocks with the current tag
6. Returns blocks and metadata for finalization

#### `finalizeDistillation(...): Promise<RadialDistillResult>`
Common pipeline for both modes:
1. Builds session index (for chat sessions)
2. Deduplicates blocks using SimHash
3. Assembles decision records
4. Generates output (JSON/YAML)
5. Records distillation in database

---

## Deduplication Strategy

Tag-based mode uses **cross-tag deduplication**:

```typescript
const processedAtomIds = new Set<string>();

for (const tag of tagsToProcess) {
  const atoms = await fetchAtomsByTag(tag);
  
  for (const atom of atoms) {
    // Skip if already processed (dedup across tags)
    if (processedAtomIds.has(atom.id)) {
      continue;
    }
    processedAtomIds.add(atom.id);
    // ... process atom
  }
}
```

This ensures that if atom `A123` is tagged with both `#Architecture` and `#Security`, it's only processed once, even though it matches multiple tag queries.

---

## Output Format

### JSON Output

```json
{
  "metadata": {
    "source": "Anchor Engine Radial Distiller v2.0",
    "distilled_at": "2026-03-27T16:00:00.000Z",
    "decision_records": 15,
    "digital_objects_count": 42,
    "session_index_count": 5
  },
  "records": [
    {
      "id": "concept-a1b2c3d4e5f6",
      "title": "Architecture Design",
      "problem": "Need scalable architecture...",
      "solution": ["Use microservices", "Implement caching"],
      "rationale": "Improves performance and maintainability",
      "status": "active",
      "timestamp": "2026-03-25T10:00:00.000Z",
      "provenance": [
        "external-inbox/github/owner/repo/docs/architecture.md",
        "external-inbox/github/owner/repo/specs/001-architecture.md"
      ],
      "tags": ["#Architecture", "#Design"]
    }
  ],
  "digital_objects": [...],
  "session_index": [...]
}
```

---

## Performance Considerations

### Memory Usage
- Tag-based mode processes atoms incrementally
- `processedAtomIds` set prevents re-processing
- Deduplication happens at atom level (before block extraction)

### Query Optimization
- Uses `tags` table index for fast tag lookups
- Batch fetches atoms with `ANY($1)` operator
- Falls back to filesystem for content (Standard 051)

### Recommended Token Budget
For comprehensive tag-based distillation:
- **Single tag**: 65K-262K tokens
- **Multiple tags**: 262K-1M tokens
- **All tags**: Use with `max_radius` limit

---

## Use Cases

### 1. Knowledge Extraction for Coding

```bash
# Get all content about authentication
curl -X POST http://localhost:3160/v1/memory/distill/tags \
  -H "Authorization: Bearer anchor-engine-default-key" \
  -d '{"tags": ["#Authentication"], "output_format": "json"}'
```

### 2. Comprehensive Search

```bash
# Get all content about multiple related concepts
curl -X POST http://localhost:3160/v1/memory/distill/tags \
  -d '{
    "tags": ["#PAT", "#GitHub", "#Authentication", "#Tokens"],
    "output_format": "json"
  }'
```

### 3. Full Corpus Export

```bash
# Export everything organized by tag
curl -X POST http://localhost:3160/v1/memory/distill/tags \
  -d '{"tags": [], "output_format": "json"}'
```

---

## Comparison: Standard vs Tag-Based Mode

| Feature | Standard Mode | Tag-Based Mode |
|---------|--------------|----------------|
| **Input** | Files/buckets | Tags |
| **Processing Order** | File-by-file | Tag-by-tag |
| **Deduplication** | Within files | Across tags |
| **Best For** | Document-centric | Concept-centric |
| **Output Organization** | By file | By concept (tag) |
| **Cross-File Concepts** | Fragmented | Unified |

---

## Relationship to Other Standards

| Standard | Relationship |
|----------|--------------|
| **Standard 133** | Radial Distillation (base protocol) |
| **Standard 123** | Search Result Tag Sanitization (complementary) |
| **Standard 051** | Pointer-Only Storage (uses filesystem for content) |
| **Standard 086** | Dual-Strategy Search (tag-based is second strategy) |

---

## Testing

### Unit Tests
```bash
# Test fetchAllTags
npm run test:vitest -- tests/unit/distillation.test.ts

# Test fetchAtomsByTag
npm run test:vitest -- tests/unit/tag-search.test.ts
```

### Integration Test
```bash
# Full tag-based distillation
curl -X POST http://localhost:3160/v1/memory/distill/tags \
  -H "Content-Type: application/json" \
  -d '{"tags": ["#Test"], "output_format": "json"}'
```

---

## Future Enhancements

1. **Tag Synonyms** - Merge `#Auth` and `#Authentication` automatically
2. **Tag Hierarchies** - Support parent/child tag relationships
3. **Progressive Distillation** - Stream results as tags are processed
4. **Tag Co-occurrence** - Find tags that frequently appear together
5. **Smart Tag Selection** - ML-based tag relevance scoring

---

## Troubleshooting

### Issue: No results returned
**Solution:** Check if tags exist: `GET /v1/tags`

### Issue: Out of memory
**Solution:** Use smaller tag subsets or increase `max_radius`

### Issue: Slow performance
**Solution:** Ensure `tags` table has indexes (created automatically)

---

**Author:** R.S. Balch II  
**Implemented:** March 27, 2026  
**Status:** Active  
