# Memory Profiling

## Overview

Comprehensive memory profiling tools for identifying leaks and optimization opportunities in Anchor Engine.

**Location:** `engine/src/utils/memory-profiler.ts`

## Features

- **Memory Snapshots**: Point-in-time memory usage capture
- **Operation Profiling**: Profile memory usage of specific operations
- **Leak Detection**: Automatic identification of memory leak patterns
- **Continuous Monitoring**: Real-time memory monitoring with thresholds
- **GC Integration**: Force garbage collection for accurate measurements
- **Reporting**: Human-readable reports and JSON export

## Usage

### Basic Profiling

```typescript
import { memoryProfiler } from './utils/memory-profiler.js';

// Start profiling
memoryProfiler.startProfile('search-operation');

// ... perform operation ...

// End profiling and get report
const profile = memoryProfiler.endProfile('search-operation');
memoryProfiler.printProfileReport('search-operation');
```

### Continuous Monitoring

```typescript
// Start monitoring (logs warnings at thresholds)
memoryProfiler.startMonitoring(5000); // Check every 5 seconds

// ... perform operations ...

// Stop monitoring
memoryProfiler.stopMonitoring();
```

### Manual Snapshots

```typescript
// Take snapshot at any time
const snapshot = memoryProfiler.takeSnapshot('before-search');

// Access snapshot data
console.log(`Heap: ${(snapshot.heapUsed / 1024 / 1024).toFixed(2)}MB`);
console.log(`Usage: ${snapshot.heapUsedPercent.toFixed(1)}%`);
```

## Command-Line Profiling

### Profile Search Operations

```bash
npm run profile:memory -- search
```

### Profile Ingestion Operations

```bash
npm run profile:memory -- ingestion
```

### Profile Both

```bash
npm run profile:memory -- both
```

### Output Example

```
🚀 Anchor Engine Memory Profiler
============================================================
Mode: search
Node version: v18.x.x
GC available: true
============================================================

🔍 Profiling Search Operations...

📝 Testing: Simple single-term search
   Query: "simple"
   ✅ Found 15 results in 45ms
   📊 Memory: 125.3MB (45.2%)

...

============================================================
Memory Profile: search-operations
============================================================
Duration: 2.35s

Memory Usage:
  Start: 120.5MB
  End: 125.8MB
  Peak: 145.2MB
  Growth: 5.3MB

💡 Recommendations:
  • Peak memory usage was 52.1% - within safe limits
  • Consider calling memoryProfiler.forceGC() before memory-intensive operations
============================================================
```

## Memory Leak Detection

### Leak Patterns

The profiler automatically detects these leak patterns:

| Pattern | Detection | Confidence |
|---------|-----------|------------|
| **Heap Growth** | > 10MB growth during operation | Medium/High |
| **External Memory** | > 5MB external memory growth | Medium/High |
| **Native Leak** | RSS grows more than heap | Medium |
| **Continuous Growth** | Monotonic increase across snapshots | High |

### Leak Suspect Report

```typescript
const profile = memoryProfiler.endProfile('operation');

for (const suspect of profile.leakSuspects) {
  console.log(`[${suspect.confidence}] ${suspect.type}`);
  console.log(`  ${suspect.description}`);
  console.log(`  → ${suspect.recommendation}`);
}
```

### Example Leak Detection

```
⚠️  Potential Memory Leaks (2):
  [HIGH] continuous_growth: Memory shows continuous growth pattern without plateaus
    → Likely memory leak - check for accumulating data structures
  [MEDIUM] heap_growth: Heap grew by 25.5MB during operation
    → Check for unclosed resources, large cached objects, or circular references
```

## Memory Thresholds

### Default Thresholds

| Level | Percentage | Action |
|-------|------------|--------|
| **Warning** | 70% | Log warning, monitor closely |
| **Critical** | 85% | Log critical, consider reducing load |
| **Emergency** | 95% | Log emergency, immediate action required |

### Custom Thresholds

```typescript
memoryProfiler.setThresholds({
  warning: 60,
  critical: 80,
  emergency: 90,
});
```

## Integration Points

### Search Service

The search service already integrates memory-aware throttling:

```typescript
// In search.ts
const throttleResult = await throttleSearchForMemory();
if (!throttleResult.proceed) {
  throw new Error(`Search rejected: ${throttleResult.reason}`);
}
```

### Context Inflator

Batch operations use memory profiling:

```typescript
// Pre-fetch compounds to reduce memory pressure
const compoundCache = await batchFetchCompounds(compoundIds);
```

### LRU Cache

Automatic memory-pressure eviction:

```typescript
// In lru-cache.ts
private checkMemoryPressure(): void {
  const percentageUsed = (heapUsed / heapTotal) * 100;
  
  if (percentageUsed >= 85) {
    // Critical: Evict 50% of cache
    this.resize(Math.floor(this.maxEntries * 0.5));
  }
}
```

## Best Practices

### 1. Profile Before Optimizing

```typescript
// Always profile first to identify real bottlenecks
memoryProfiler.startProfile('baseline');
// ... run operation ...
memoryProfiler.endProfile('baseline');
```

### 2. Force GC Before Measurements

```typescript
// Get accurate "before" measurement
memoryProfiler.forceGC();
const before = memoryProfiler.takeSnapshot('before');
```

### 3. Monitor Long-Running Operations

```typescript
memoryProfiler.startMonitoring(2000);
await longRunningOperation();
memoryProfiler.stopMonitoring();
```

### 4. Export Profiles for Analysis

```typescript
const json = memoryProfiler.exportProfile('operation');
fs.writeFileSync('profile.json', json);
```

### 5. Compare Before/After Optimizations

```typescript
// Before optimization
memoryProfiler.startProfile('before');
await operation();
memoryProfiler.endProfile('before');

// Apply optimization...

// After optimization
memoryProfiler.startProfile('after');
await operation();
memoryProfiler.endProfile('after');

// Compare profiles
```

## Memory Metrics

### Heap Memory

- **heapUsed**: Actual memory used from the heap
- **heapTotal**: Total size of the heap
- **heapUsedPercent**: Percentage of heap used

### External Memory

- **external**: Memory used by C++ objects bound to JS objects
- **arrayBuffers**: Memory allocated for ArrayBuffer objects

### Resident Set Size (RSS)

- **rss**: Total memory allocated for the process
- Includes heap, stack, native objects, shared libraries

### Heap Spaces

Detailed breakdown by space:
- **new_space**: Young generation (short-lived objects)
- **old_space**: Old generation (long-lived objects)
- **code_space**: Executable code
- **map_space**: Hidden class metadata
- **large_object_space**: Objects larger than 256KB

## Troubleshooting

### High Memory Usage

1. **Check for large caches**: Review LRU cache sizes
2. **Review batch sizes**: Reduce batch sizes for large operations
3. **Enable streaming**: Use streaming for large result sets
4. **Force GC**: Call `memoryProfiler.forceGC()` periodically

### Memory Leaks

1. **Identify pattern**: Check leak suspects in profile report
2. **Review allocations**: Look for objects created but not released
3. **Check event listeners**: Ensure listeners are removed
4. **Review closures**: Check for captured variables in closures

### GC Issues

1. **Enable GC**: Run with `--expose-gc` flag
2. **Monitor GC frequency**: Too frequent = memory pressure
3. **Check heap growth**: Steady growth indicates leaks

## Performance Impact

### Overhead

- **Snapshot**: ~0.1ms per snapshot
- **Monitoring**: ~1ms per check (configurable interval)
- **Profiling**: ~0.5ms per operation

### Recommendations

- Use continuous monitoring in development
- Sample snapshots in production (every 10-30 seconds)
- Export profiles for offline analysis

## Future Enhancements

- [ ] **Heap Dump Analysis**: Integrate with heap dump tools
- [ ] **Allocation Tracking**: Track object allocations over time
- [ ] **Leak Fix Suggestions**: Automated fix recommendations
- [ ] **Trend Analysis**: Long-term memory trend tracking
- [ ] **Distributed Profiling**: Profile across multiple instances

## Standards Compliance

- **Standard 062**: Memory Management
- **Standard 127**: Memory-Aware Search Throttling
- **Standard 132**: Adaptive Concurrency

## See Also

- `src/utils/memory-profiler.ts`: Memory profiler implementation
- `src/profiling/memory-profile.ts`: Command-line profiling script
- `src/utils/lru-cache.ts`: LRU cache with memory-pressure eviction
- `src/utils/resource-manager.ts`: Resource management

## Changelog

### Sprint 4 (March 25, 2026)

- ✅ Created `memory-profiler.ts` with comprehensive profiling
- ✅ Added leak detection algorithms
- ✅ Created command-line profiling script
- ✅ Integrated with search and ingestion operations
- ✅ Added continuous monitoring with thresholds
- ✅ Added JSON export for offline analysis
