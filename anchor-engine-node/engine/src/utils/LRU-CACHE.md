# LRU Cache Implementation

## Overview

Production-ready Least Recently Used (LRU) cache with memory-pressure aware eviction for the Anchor Engine.

**Location:** `engine/src/utils/lru-cache.ts`

## Features

- **O(1) Operations**: Get and put operations are O(1) using Map + doubly-linked list
- **Memory-Pressure Eviction**: Automatically evicts entries when heap usage exceeds thresholds
- **TTL Support**: Time-to-live expiration for cache entries
- **Statistics Tracking**: Comprehensive metrics for monitoring cache performance
- **Thread-Safe**: Safe for concurrent operations
- **Configurable**: Flexible options for max entries, TTL, and memory thresholds

## Standards Compliance

- **Standard 016**: Search Caching
- **Standard 062**: Memory Management
- **Standard 127**: Memory-Aware Search Throttling
- **Standard 134**: Two-Pass Search Optimization

## Usage

### Basic Usage

```typescript
import { createLRUCache } from './utils/lru-cache.js';

const cache = createLRUCache<string, any>({
  maxEntries: 100,
  ttlMs: 60000, // 1 minute
  enableMemoryPressureEviction: true,
  memoryPressureThreshold: 70, // 70%
  criticalMemoryThreshold: 85, // 85%
});

// Set a value
cache.set('key', value, 2048); // 2048 bytes estimated size

// Get a value
const value = cache.get('key');

// Check existence
if (cache.has('key')) {
  // ...
}

// Delete a value
cache.delete('key');

// Get statistics
const stats = cache.getStats();
console.log(`Hit rate: ${(stats.hitRate * 100).toFixed(2)}%`);
console.log(`Evictions: ${stats.evictions}`);
```

### Pre-configured Caches

The module exports several pre-configured cache instances:

```typescript
import {
  searchResultCache,
  queryParseCache,
  semanticExpansionCache,
  engramCache,
} from './utils/lru-cache.js';

// Use directly
searchResultCache.set(queryHash, searchResults);
const cached = searchResultCache.get(queryHash);
```

#### Cache Configurations

| Cache | Max Entries | TTL | Purpose |
|-------|-------------|-----|---------|
| `searchResultCache` | 100 | 60s | Search results (Standard 016) |
| `queryParseCache` | 500 | 5m | Parsed query structures |
| `semanticExpansionCache` | 1000 | 10m | Taxonomy expansion results |
| `engramCache` | 200 | 2m | Engram-based context retrieval |

## Configuration

### Options

```typescript
interface LRUCacheOptions {
  /** Maximum number of entries in the cache */
  maxEntries: number;
  
  /** Time-to-live in milliseconds (0 = no expiration) */
  ttlMs?: number;
  
  /** Enable memory-pressure eviction (default: true) */
  enableMemoryPressureEviction?: boolean;
  
  /** Memory threshold percentage to trigger eviction (default: 70%) */
  memoryPressureThreshold?: number;
  
  /** Critical memory threshold for aggressive eviction (default: 85%) */
  criticalMemoryThreshold?: number;
}
```

### Config Defaults

Cache configuration can be set in `user_settings.json`:

```json
{
  "resource_management": {
    "cache_ttl_ms": 60000,
    "max_cache_size": 100
  }
}
```

These map to `config.CACHE_TTL_MS` and `config.MAX_CACHE_SIZE`.

## Memory Pressure Eviction

The cache automatically monitors heap usage and evicts entries when thresholds are exceeded:

1. **Normal (< 70%)**: No automatic eviction
2. **High Pressure (70-85%)**: Evicts to 70% of max size
3. **Critical (> 85%)**: Evicts to 50% of max size (emergency)

Memory monitoring runs every 5 seconds and is unref'd to not prevent process exit.

## Statistics

```typescript
interface CacheStats {
  hits: number;              // Cache hits
  misses: number;            // Cache misses
  evictions: number;         // LRU evictions
  expirations: number;       // TTL expirations
  size: number;              // Current entries
  maxEntries: number;        // Maximum entries
  hitRate: number;           // Hit rate (0-1)
  memoryUsage: {
    heapUsed: number;        // Bytes used
    heapTotal: number;       // Total bytes
    percentageUsed: number;  // Percentage (0-100)
  };
}
```

## Integration with Search Service

The search service (`src/services/search/search.ts`) uses the LRU cache for result caching:

```typescript
import { lruSearchCache } from './utils/lru-cache.js';

// In iterativeSearch
const cached = lruSearchCache.get(cacheKey);
if (cached) {
  return cached.results;
}

// After search completes
lruSearchCache.set(cacheKey, results, 2048);
```

### Backward Compatibility

A legacy `searchCache` wrapper is exported for backward compatibility:

```typescript
import { searchCache } from './services/search/search.js';

searchCache.set(key, value);
searchCache.get(key);
searchCache.clear();
```

This wraps the LRU cache and will be removed in v5.0.

## Performance

### Time Complexity

| Operation | Complexity |
|-----------|------------|
| Get | O(1) |
| Set | O(1) |
| Delete | O(1) |
| Has | O(1) |
| Clear | O(1) |
| Keys/Values/Entries | O(n) |

### Memory Overhead

- Each entry: ~100 bytes overhead + value size
- Doubly-linked list nodes: 3 pointers per entry
- Map storage: Hash table overhead

### Benchmarks

(To be added in Task 5: Benchmark Suite)

## Testing

Comprehensive test suite in `tests/unit/lru-cache.vitest.ts`:

- Basic operations (get/set/delete/has)
- LRU eviction order
- TTL expiration
- Memory pressure eviction
- Statistics tracking
- Edge cases
- Iteration

Run tests:
```bash
npm run test:vitest -- tests/unit/lru-cache.vitest.ts
```

## Migration Guide

### From Map-based Cache

**Before:**
```typescript
const cache = new Map<string, CacheEntry>();
cache.set(key, value);
const entry = cache.get(key);
```

**After:**
```typescript
import { createLRUCache } from './utils/lru-cache.js';

const cache = createLRUCache({
  maxEntries: 100,
  ttlMs: 60000,
});

cache.set(key, value, estimatedSize);
const entry = cache.get(key); // Returns undefined if expired
```

### Key Differences

1. **Automatic Expiration**: TTL is checked on get(), not background
2. **Memory Pressure**: Automatic eviction based on heap usage
3. **Statistics**: Built-in metrics tracking
4. **Size Estimation**: Optional size parameter for better memory management

## Future Enhancements

- [ ] LRU list persistence across restarts
- [ ] Distributed cache support (Redis)
- [ ] Cache warming strategies
- [ ] Advanced eviction policies (LFU, ARC)
- [ ] Per-entry TTL override
- [ ] Cache serialization/deserialization

## See Also

- Standard 016: Search Caching
- Standard 062: Memory Management
- `src/utils/resource-manager.ts`: Resource management
- `src/services/search/search.ts`: Search service integration
