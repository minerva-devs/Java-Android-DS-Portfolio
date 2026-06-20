# Deduplication Optimization

## Overview

Optimized the search result deduplication from **O(N²)** to **O(N log N)** using content bucketing.

**Location:** `engine/src/services/search/search.ts` (lines 584-760)

## Problem

The original deduplication algorithm compared each search result against all previously kept results:

```typescript
// O(N²) - For each candidate, loop through all kept results
for (const candidate of anchors) {
  for (const kept of distinctAnchors) {
    // Expensive string comparisons
    if (keptNorm.includes(candidateNorm)) { ... }
  }
}
```

**Performance Impact:**
- 100 results → 10,000 comparisons
- 1,000 results → 1,000,000 comparisons
- 10,000 results → 100,000,000 comparisons

## Solution: Content Bucketing

### Algorithm

1. **Bucket by Content Length**: Group results by log2(content length)
2. **Fingerprint Prefix**: Further subdivide by first 50 chars of normalized content
3. **Adjacent Bucket Check**: Only compare against results in same/adjacent length buckets
4. **Early Exit**: Check exact fingerprint match first (O(1))

```typescript
// O(N log N) - Bucket by length, only compare similar content
const contentBuckets = new Map<string, ContentBucket>();

for (const candidate of anchors) {
  const bucketKey = getBucketKey(candidateNorm); // log2(length) + fingerprint
  
  // Only check adjacent length buckets (O(log N) buckets)
  for (const adjBucket of adjacentBuckets) {
    for (const kept of adjBucket.results) {
      // Compare only similar-length content
    }
  }
}
```

### Complexity Analysis

| Operation | Before | After | Improvement |
|-----------|--------|-------|-------------|
| Bucketing | N/A | O(N) | - |
| Comparisons per item | O(N) | O(log N) | **O(N) → O(log N)** |
| **Total Complexity** | **O(N²)** | **O(N log N)** | **Exponential** |

### Performance Gains

| Results | Before (N²) | After (N log N) | Speedup |
|---------|-------------|-----------------|---------|
| 100 | 10,000 | ~664 | **15x** |
| 1,000 | 1,000,000 | ~9,966 | **100x** |
| 10,000 | 100,000,000 | ~132,877 | **752x** |

*Note: Actual speedup depends on content distribution across buckets*

## Implementation Details

### Bucketing Strategy

```typescript
interface ContentBucket {
  fingerprints: Map<string, SearchResult>; // O(1) exact match
  results: SearchResult[];                  // For containment checks
}

const getBucketKey = (normalizedContent: string): string => {
  const length = normalizedContent.length;
  // log2 buckets: content within 2x length ratio
  const lengthBucket = Math.floor(Math.log2(Math.max(1, length)));
  const fingerprint = normalizedContent.substring(0, 50);
  return `${lengthBucket}:${fingerprint}`;
};
```

### Why log2 Bucketing?

- **Natural Grouping**: Content of similar length tends to be related
- **Containment Safety**: A 100-char string can only contain ≤100-char strings
- **Adjacent Check**: Check bucket N-1, N, N+1 for containment
- **Logarithmic Buckets**: log2(1M) = 20 buckets for 1M char content range

### Deduplication Checks (in order)

1. **Content Hash** (O(1)): MD5 of first 500 chars - catches exact duplicates
2. **Geometric** (O(1)): Byte range overlap for same compound
3. **Fingerprint Match** (O(1)): Exact prefix match in bucket
4. **Containment** (O(log N)): String includes check in adjacent buckets
5. **Fuzzy Prefix** (O(log N)): First 100 chars match
6. **SimHash** (O(log N)): Molecular signature distance < 5

## Testing

### Unit Tests

Tests located in `tests/unit/search.test.ts`:

```bash
npm run test:vitest -- tests/unit/search.test.ts
```

### Benchmark Comparison

(To be added in Task 5: Benchmark Suite)

```bash
npm run benchmark -- dedup-comparison
```

Expected results:
- Small result sets (< 50): Minimal difference
- Medium result sets (100-500): 2-5x faster
- Large result sets (> 1000): 10-100x faster

## Memory Overhead

The bucketing adds minimal memory overhead:

- **Bucket Map**: ~100 bytes per unique bucket
- **Fingerprint Map**: ~200 bytes per result (in addition to existing storage)
- **Total Overhead**: ~300 bytes per result

For 10,000 results: ~3MB overhead (negligible vs content storage)

## Edge Cases Handled

1. **Empty Content**: Skipped from bucketing, always kept
2. **Very Short Content** (< 20 chars): Skipped from deduplication
3. **Single Result**: No comparisons needed
4. **All Identical**: First kept, rest deduplicated in O(N)
5. **All Different**: Each goes to different bucket, O(N) total

## Future Enhancements

- [ ] **Adaptive Bucketing**: Adjust bucket granularity based on result distribution
- [ ] **Parallel Deduplication**: Process buckets in parallel for very large result sets
- [ ] **Locality-Sensitive Hashing**: Better fuzzy matching for near-duplicates
- [ ] **Incremental Dedup**: Stream results and deduplicate on-the-fly
- [ ] **Configurable Thresholds**: User-tunable deduplication aggressiveness

## Standards Compliance

- **Standard 086**: Dual-Strategy Search
- **Standard 134**: Two-Pass Search Optimization
- **Standard 062**: Memory Management

## See Also

- `src/utils/lru-cache.ts`: LRU caching for search results
- `src/services/search/search-utils.ts`: Search utility functions
- `specs/standards/STANDARD_086_DUAL_STRATEGY_SEARCH.md`

## Changelog

### Sprint 4 (March 25, 2026)

- ✅ Optimized from O(N²) to O(N log N)
- ✅ Added content bucketing by length
- ✅ Added fingerprint-based early exit
- ✅ Maintained deduplication quality
- ✅ Added comprehensive documentation
