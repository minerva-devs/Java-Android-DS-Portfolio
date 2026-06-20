# Anchor Engine Code Patterns Guide

A tour of the programming patterns used throughout the codebase.

## Overview

The Anchor Engine uses a **hybrid approach** - mixing functional and imperative patterns where each makes sense:

- **~31,000 lines** of TypeScript
- **125 files** across 12 modules
- **Functional** for data transformations
- **Imperative** for performance-critical loops
- **Async/await** for I/O operations

---

## 1. Functional Patterns

### Pure Functions
Functions that don't mutate state and return predictable outputs.

**Example: `calculateLightweightScore` (search.ts)**
```typescript
function calculateLightweightScore(
  result: SearchResult,
  queryTerms: string[],
  query: string
): number {
  // Immutable operations only
  const contentWords = new Set(content.split(/\s+/).filter(w => w.length > 2));
  
  // No side effects - just calculations
  return Math.min(1.0, baseScore * 0.3 + termScore * 0.5 + ...);
}
```

**Used for:**
- Scoring algorithms
- Data transformations
- Configuration merging

### Higher-Order Functions
Functions that take or return other functions.

**Example: `processWithAdaptiveConcurrency` (adaptive-concurrency.ts)**
```typescript
export async function processWithAdaptiveConcurrency<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,  // ← Function argument
  config?: ConcurrencyConfig
): Promise<R[]> {
  // Abstracts the concurrency logic
  const results = await processor(item, index);
}
```

**Used for:**
- Abstracting processing patterns
- Middleware chains
- Batch operations

### Array Methods (Map/Filter/Reduce)
Declarative data transformations.

**Example: Result processing (search.ts)**
```typescript
const scoredAtoms = rawAtoms.map(atom => ({
  ...atom,
  score: calculateLightweightScore(atom, terms, sanitizedQuery)
}))
.sort((a, b) => (b.score || 0) - (a.score || 0))
.slice(0, maxResultsPerTerm * terms.length);
```

**Used for:**
- Data pipelines
- Result formatting
- Scoring and ranking

---

## 2. Imperative Patterns

### For Loops with Index
When you need precise control over iteration.

**Example: Range merging deduplication (search.ts)**
```typescript
for (let i = 1; i < compoundAnchors.length; i++) {
  const next = compoundAnchors[i];
  const currentEnd = (current.end_byte || 0);
  const nextStart = (next.start_byte || 0);
  
  // Complex overlap logic requires mutable state
  if (nextStart <= currentEnd + 50) {
    // Merge or skip based on conditions
    continue;
  }
}
```

**Used for:**
- Complex deduplication
- Sliding window algorithms
- Performance-critical paths

### While Loops
For unknown iteration counts.

**Example: BFS traversal (explore.ts)**
```typescript
for (let depth = 0; depth < maxDepth && frontier.length > 0; depth++) {
  const nextFrontier: string[] = [];
  
  for (const chunk of chunks) {
    // Process current frontier
    // Build nextFrontier for next iteration
  }
  
  frontier = nextFrontier;  // ← State mutation
}
```

**Used for:**
- Graph traversals
- Queue processing
- Streaming data

### Mutable State
When performance matters more than purity.

**Example: Batch processing (context-inflator.ts)**
```typescript
const results: R[] = [];

for (let i = 0; i < items.length; i += batchSize) {
  const batch = items.slice(i, i + batchSize);
  const batchResults = await Promise.all(
    batch.map((item, batchIndex) => processor(item, i + batchIndex))
  );
  results.push(...batchResults);  // ← Mutating results array
}
```

**Used for:**
- Accumulating results
- Caching
- Performance optimization

---

## 3. Async/Await Patterns

### Sequential Processing
One at a time - memory safe.

```typescript
for (const item of items) {
  const result = await processor(item);
  results.push(result);
}
```

**Used for:** Low-memory environments (mobile)

### Parallel Processing with Promise.all
Batch concurrency for speed.

```typescript
const batchPromises = batch.map((item, batchIndex) =>
  processor(item, i + batchIndex)
);
const batchResults = await Promise.all(batchPromises);
```

**Used for:** High-memory systems (desktops)

### Error Handling with Try/Catch
Graceful degradation.

```typescript
try {
  const result = await db.run(query, params);
  return result.rows;
} catch (e) {
  console.error('[Search] Query failed:', e);
  return [];  // ← Graceful fallback
}
```

**Used for:** Database queries, file I/O, external APIs

---

## 4. Object-Oriented Patterns

### Static Methods
Utility functions grouped by domain.

**Example: ContextInflator (context-inflator.ts)**
```typescript
export class ContextInflator {
  static async inflate(results: SearchResult[], ...): Promise<SearchResult[]> {
    // Implementation
  }
  
  static async inflateFromAtomPositions(...): Promise<SearchResult[]> {
    // Implementation
  }
}
```

**Used for:** Namespacing utility functions

### Interfaces for Type Safety
```typescript
export interface ConcurrencyConfig {
  forceSequential?: boolean;
  sequentialThresholdMB?: number;
  // ...
}
```

**Used for:** Configuration objects, API contracts

---

## 5. Design Patterns

### Strategy Pattern
Different algorithms based on conditions.

**Example: Adaptive concurrency**
```typescript
if (concurrency === 1) {
  // Sequential strategy
  for (let i = 0; i < items.length; i++) { ... }
} else {
  // Parallel strategy
  for (let i = 0; i < items.length; i += batchSize) { ... }
}
```

### Memoization/Caching
```typescript
let cachedSettings: any = null;
let settingsLastRead = 0;

function loadUserSettings(): any {
  if (cachedSettings && (now - settingsLastRead) < SETTINGS_CACHE_MS) {
    return cachedSettings;  // ← Return cached
  }
  // ... load fresh
}
```

### Guard Clauses
Early returns for edge cases.
```typescript
if (!result.content) return result.score || 0;
if (terms.length === 0) return [];
if (!databaseReady) throw new Error('Not ready');
```

---

## Pattern Selection Guide

| Pattern | Use When | Example |
|---------|----------|---------|
| **Pure Function** | Data transformation, scoring | `calculateLightweightScore` |
| **Higher-Order** | Abstract processing logic | `processWithAdaptiveConcurrency` |
| **For Loop** | Complex iteration logic | Range merging dedup |
| **Array Methods** | Simple transformations | Result formatting |
| **Sequential** | Memory-constrained | Mobile search |
| **Parallel** | Speed needed, memory available | Desktop search |
| **Mutable State** | Performance critical | Batch accumulation |

---

## Key Takeaways

1. **Functional for data** - Transformations, scoring, formatting
2. **Imperative for control** - Complex loops, performance, memory management
3. **Async for I/O** - Database, files, network
4. **Pure when possible** - Easier to test and reason about
5. **Mutable when necessary** - But isolate the mutation

The codebase prioritizes **pragmatism over purity** - using whatever pattern solves the problem best while keeping the code readable and maintainable.
