# STAR Algorithm Quick Reference

> **S**tructured **T**emporal **A**tomic **R**etrieval — Physics-inspired scoring matrix

## Core Equation

```
Gravity = |T(q) ∩ T(a)| × γ^d × e^(-λΔt) × (1 - SimHash/64)
```

| Component | Symbol | Formula | Purpose |
|-----------|--------|---------|---------|
| **Semantic Gravity** | `|T(q) ∩ T(a)|` | Shared tags count | Content relevance |
| **Spatial Decay** | `γ^d` | `0.95^hop_distance` | Proximity bonus |
| **Temporal Decay** | `e^(-λΔt)` | `e^(-0.00001 × hours)` | Recency bonus |
| **Structural Gravity** | `1 - SimHash/64` | `1 - hamming/64` | Content uniqueness |

## Constants

| Constant | Value | Half-Life | Purpose |
|----------|-------|-----------|---------|
| `γ` (gamma) | 0.95 | — | Per-hop decay |
| `λ` (lambda) | 0.00001 h⁻¹ | ~7.9 years | Temporal decay |
| **SimHash bits** | 64 | — | Molecular fingerprint |
| **Dedup threshold** | < 5 | — | Near-duplicate Hamming distance |

## SQL Implementation (PostgreSQL)

```sql
-- STAR Score Calculation
SELECT 
  a.id,
  a.content,
  -- 1. Semantic Gravity: shared tags
  (SELECT COUNT(*) FROM atom_tags at 
   JOIN query_tags qt ON at.tag_id = qt.tag_id) AS shared_tags,
   
  -- 2. Spatial Decay: γ^d
  POW(0.95, COALESCE(hop_distance, 0)) AS spatial_decay,
  
  -- 3. Temporal Decay: e^(-λΔt)
  EXP(-0.00001 * LEAST(ABS(EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 3600), 700000)) AS temporal_decay,
  
  -- 4. Structural Gravity: 1 - SimHash/64
  (1.0 - COALESCE(
    (SELECT bit_count(a.molecular_signature # c.molecular_signature)::float / 64.0
     FROM atoms c WHERE c.id = $1), 0.0
  )) AS structural_gravity,
  
  -- Final Score
  shared_tags * 
  POW(0.95, COALESCE(hop_distance, 0)) * 
  EXP(-0.00001 * LEAST(ABS(EXTRACT(EPOCH FROM (NOW() - a.created_at)) / 3600), 700000)) * 
  (1.0 - COALESCE(
    (SELECT bit_count(a.molecular_signature # c.molecular_signature)::float / 64.0
     FROM atoms c WHERE c.id = $1), 0.0
  )) AS star_score
  
FROM atoms a
ORDER BY star_score DESC
LIMIT 100;
```

## Linear Algebra Concepts Used

### Vector Operations
```typescript
// Dot product (semantic similarity)
function dotProduct(a: number[], b: number[]): number {
  return a.reduce((sum, v, i) => sum + v * b[i], 0);
}

// Cosine similarity
function cosineSimilarity(a: number[], b: number[]): number {
  const dot = dotProduct(a, b);
  const magA = Math.sqrt(a.reduce((s, v) => s + v * v, 0));
  const magB = Math.sqrt(b.reduce((s, v) => s + v * v, 0));
  return dot / (magA * magB);
}
```

### SimHash (64-bit fingerprint)
```typescript
// Generate 64-bit SimHash from content
function simHash(content: string): bigint {
  const hash = crypto.createHash('sha256').update(content).digest();
  // Convert first 64 bits to bigint
  return BigInt('0x' + hash.toString('hex').substring(0, 16));
}

// Hamming distance between two SimHashes
function hammingDistance(a: bigint, b: bigint): number {
  let xor = a ^ b;
  let count = 0;
  while (xor > 0n) {
    count += Number(xor & 1n);
    xor >>= 1n;
  }
  return count;
}
```

### Tag Vector Math
```typescript
// Tag intersection (semantic gravity)
function tagIntersection(queryTags: string[], atomTags: string[]): number {
  const querySet = new Set(queryTags);
  return atomTags.filter(t => querySet.has(t)).length;
}

// Weighted tag scoring with IDF
function weightedTagScore(
  queryTags: string[], 
  atomTags: string[], 
  idfWeights: Map<string, number>
): number {
  const querySet = new Set(queryTags);
  return atomTags
    .filter(t => querySet.has(t))
    .reduce((sum, t) => sum + (idfWeights.get(t) || 1.0), 0);
}
```

## Search Modes

| Mode | Prefix | Behavior |
|------|--------|----------|
| **STAR** | *(none)* | Full physics scoring |
| **FTS Only** | `exact:`, `fast:` | Text search only |
| **BFS** | `illuminate:`, `explore:` | Graph traversal |
| **Max Recall** | `deep:` | No dedup, all results |

## Performance Optimizations

1. **COALESCE everywhere** — Handle NULLs gracefully
2. **LEAST(ABS(Δt), 700000)** — Prevent temporal underflow
3. **Bit count via XOR** — Fast SimHash comparison
4. **GIN index on tags** — Fast intersection
5. **Prepared statements** — Reuse query plans

## Scoring Weights (Typical)

| Component | Weight | Range |
|-----------|--------|-------|
| Semantic Gravity | 1.0 per tag | 0-∞ |
| Spatial Decay | 0.95^d | 1.0 → 0.0 |
| Temporal Decay | e^(-λΔt) | 1.0 → ~0.9 |
| Structural Gravity | 1 - h/64 | 0.0 → 1.0 |
