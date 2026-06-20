# Standard 014: Search Algorithm Testing Methodology

**Status:** Active  
**Version:** 2.0.0  
**Created:** 2026-05-18  
**Updated:** 2026-06-03  
**Author:** RS Balch II  

---

## Overview

This standard defines the methodology for testing search algorithms in Anchor Engine, ensuring comprehensive coverage from most complex to simplest queries. The goal is to identify real gaps in search capabilities by systematically exercising each algorithm with progressively easier test cases.

---

## 1. Test Order: Hardest → Easiest

Tests should be ordered from **most challenging** to **simplest** queries. This approach:

1. **Stress-tests the system first** - If complex searches fail, simple ones may still work
2. **Reveals edge cases early** - Complex queries expose boundary conditions
3. **Provides clear regression baselines** - Simple tests serve as quick health checks
4. **Enables targeted debugging** - Failures in hard tests point to specific algorithmic issues

### Test Categories (Ordered)

| Priority | Category | Example Queries | Purpose |
|----------|----------|-----------------|---------|
| **P0** | Semantic/Complex | "authentication and authorization in Node.js best practices" | Multi-concept, requires understanding relationships |
| **P1** | Tag-based Advanced | `#test #api #node` with filters | Tests tag intersection logic |
| **P2** | Byte Offset Search | "function findAnchors" with offset tracking | Verifies content boundary handling |
| **P3** | FTS Basic | "workspace" or "atom" | Standard full-text search |
| **P4** | Empty/All Results | "" (empty query) | Returns all indexed content |
| **P5** | Edge Cases | Malformed queries, special chars | Tests boundary conditions |
| **P6** | Performance | Latency benchmarks | Measures system performance |

---

## 2. Test Structure

### 2.1 Test File Format (Vitest/TypeScript)

```typescript
// tests/unit/search-algorithms.test.ts
import { describe, it, expect } from 'vitest';
import { AnchorClient } from '../../packages/api-client/src/index';

describe('Search Algorithm Tests (Hardest → Easiest)', () => {
  const client = new AnchorClient({ baseUrl: 'http://localhost:3160' });

  // P0 - HARDEST: Semantic search with complex multi-concept queries
  it('P0 semantic-search-complex', async () => {
    const results = await client.search(
      'authentication and authorization in Node.js best practices',
      {
        strategy: 'semantic',
        maxResults: 10
      }
    );
    expect(results.totalResults).toBeGreaterThan(0);
    validateSearchResults(results);
    logResults('P0 semantic-search-complex', results);
  });

  // P1 - Hard: Tag-based search with multiple filters
  it('P1 tag-search-multi-filter', async () => {
    const results = await client.search('#test #api #node', {
      mode: 'tags',
      maxResults: 10
    });
    expect(results.totalResults).toBeGreaterThan(0);
    validateSearchResults(results);
    logResults('P1 tag-search-multi-filter', results);
  });

  // P2 - Medium-Hard: Byte offset search with content boundaries
  it('P2 byte-offset-content-boundary', async () => {
    const results = await client.search('function findAnchors', {
      includeByteOffsets: true,
      maxResults: 5
    });
    expect(results.results[0]?.content).toBeDefined();
    validateSearchResults(results);
    logResults('P2 byte-offset-content-boundary', results);
  });

  // P3 - Medium: Standard FTS search
  it('P3 fts-standard-search', async () => {
    const results = await client.search('workspace', {
      limit: 10,
      mode: 'combined'
    });
    expect(results.totalResults).toBeGreaterThan(0);
    validateSearchResults(results);
    logResults('P3 fts-standard-search', results);
  });

  // P4 - Easy: Empty query (returns all)
  it('P4 empty-query-all-results', async () => {
    const results = await client.search('', {
      limit: 100,
      mode: 'combined'
    });
    expect(results.results.length).toBeLessThanOrEqual(100);
    validateSearchResults(results);
    logResults('P4 empty-query-all-results', results);
  });

  // P5 - Edge cases
  it('P5 malformed-query-handling', async () => {
    const results = await client.search('<script>alert("xss")</script>', {
      limit: 10,
      mode: 'combined'
    });
    // Should handle safely without breaking
    expect(results.status).toBeDefined();
  });

  it('P5 special-chars-query', async () => {
    const results = await client.search('test & query | with "quotes"', {
      limit: 10,
      mode: 'combined'
    });
    expect(results.totalResults).toBeGreaterThan(0);
  });

  // P6 - Performance (last)
  it.skip('P6 latency-targets', async () => {
    // Add performance benchmark tests here
  });
});

// Helper function to log results for human review
function logResults(testName: string, results: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    testName,
    totalResults: results.totalResults,
    resultsCount: results.results?.length || 0,
    query: results.query || '',
    strategy: results.strategy || 'unknown',
    latencyMs: (Date.now() - (results as any).startTime)
  };

  // Save to .anchor/logs for human review
  const fs = await import('fs');
  const path = await import('path');
  const logDir = path.join(process.env.PROJECT_ROOT || '.', '.anchor', 'logs', 'search-tests');
  const logFile = path.join(logDir, `${testName}-${timestamp.replace(/[:.]/g, '-')}.json`);

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
}

function validateSearchResults(results: any): void {
  expect(results).toHaveProperty('results');
  expect(results).toHaveProperty('totalResults');
  expect(Array.isArray(results.results)).toBe(true);
  if (Array.isArray(results.results)) {
    results.results.forEach((r: any) => {
      expect(r).toHaveProperty('id');
      expect(r).toHaveProperty('source');
      expect(r).toHaveProperty('content');
    });
  }
}
```

---

## 3. Result Logging

### 3.1 Log Directory Structure

```
.anchor/logs/search-tests/
├── P0-semantic-search-complex-2026-05-18T12-00-00.json
├── P1-tag-search-multi-filter-2026-05-18T12-00-30.json
├── P2-byte-offset-content-boundary-2026-05-18T12-01-00.json
├── P3-fts-standard-search-2026-05-18T12-01-30.json
├── P4-empty-query-all-results-2026-05-18T12-02-00.json
├── P5-malformed-query-handling-2026-05-18T12-02-30.json
└── P5-special-chars-query-2026-05-18T12-03-00.json
```

### 3.2 Log Entry Format

```json
{
  "timestamp": "2026-05-18T12:00:00.000Z",
  "testName": "P0 semantic-search-complex",
  "totalResults": 42,
  "resultsCount": 10,
  "query": "authentication and authorization in Node.js best practices",
  "strategy": "semantic",
  "latencyMs": 234,
  "results": [
    {
      "id": "mol_abc123",
      "source": "anchor-engine-node/src/auth.ts",
      "content": "...",
      "score": 0.87
    }
  ]
}
```

---

## 4. Distillation Testing

### 4.1 Unseeded vs Seeded Distillation Tests

Tests should cover both unseeded (no prior context) and seeded (with context) distillation scenarios:

#### Unseeded Distillation Test

```typescript
it('distillation-unseeded', async () => {
  const results = await client.search('authentication', {
    strategy: 'semantic',
    maxResults: 5
  });

  // Run distillation with no prior context
  const response = await fetch(`${API_BASE}/v1/memory/distill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compounds: results.results.map(r => r.id),
      seed: null // No seed - unseeded
    })
  });

  const data = await response.json();
  expect(data.stats.compounds_processed).toBe(5);
  expect(data.output.path).toBeDefined();

  logDistillationResult('distillation-unseeded', data);
});
```

#### Seeded Distillation Test

```typescript
it('distillation-seeded-context', async () => {
  // First, get some context molecules
  const contextQuery = 'Node.js authentication';
  const results = await client.search(contextQuery, {
    strategy: 'semantic',
    maxResults: 3
  });

  // Run distillation with seed context
  const response = await fetch(`${API_BASE}/v1/memory/distill`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      compounds: results.results.map(r => r.id),
      seed: results.results[0].content, // Use first result as seed
      contextWindow: 512
    })
  });

  const data = await response.json();
  expect(data.stats.compounds_processed).toBe(3);
  expect(data.output.path).toBeDefined();
  expect(data.output.context).toContain(contextQuery);

  logDistillationResult('distillation-seeded-context', data);
});

function logDistillationResult(testName: string, data: any): void {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    testName,
    stats: data.stats,
    outputPath: data.output.path,
    compressionRatio: data.stats.compression_ratio
  };

  const fs = await import('fs');
  const path = await import('path');
  const logDir = path.join(process.env.PROJECT_ROOT || '.', '.anchor', 'logs', 'distillation-tests');
  const logFile = path.join(logDir, `${testName}-${timestamp.replace(/[:.]/g, '-')}.json`);

  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
}
```

---

## 5. Search Algorithm Coverage Matrix

| Algorithm | Test Count | Pass Rate | Last Run | Notes |
|-----------|------------|-----------|----------|-------|
| Semantic (complex) | P0 | - | - | Needs implementation |
| Tag-based multi-filter | P1 | - | - | Needs implementation |
| Byte offset search | P2 | - | - | Needs implementation |
| FTS standard | P3 | - | - | Needs implementation |
| Empty query | P4 | - | - | Needs implementation |
| Edge cases | P5 | - | - | Added in v2.0.0 |
| Performance benchmarks | P6 | - | - | Added in v2.0.0 |

---

## 6. Performance Targets

| Test Type | Max Latency | Budget Usage | Results Count |
|-----------|-------------|--------------|---------------|
| P0 Semantic (complex) | <3s | ~524k chars | ≤10 |
| P1 Tag multi-filter | <1s | ~64k chars | ≤10 |
| P2 Byte offset | <500ms | ~8k chars/atom | ≤5 |
| P3 FTS standard | <200ms | ~16-32k chars | ≤10 |
| P4 Empty query | <100ms | ~16-32k chars | unlimited (limited by limit param) |

---

## 7. Phase P5: Edge Cases and Boundary Conditions

Tests should include edge cases to ensure robustness:

### P5 Test Categories

```typescript
// P5 - Empty/Edge Cases Tests

describe('P5 Edge Cases', () => {
  const client = new AnchorClient({ baseUrl: 'http://localhost:3160' });

  // Empty query
  it('empty-query-returns-all-results', async () => {
    const results = await client.search('', { limit: 100, mode: 'combined' });
    expect(results.results.length).toBeLessThanOrEqual(100);
  });

  // Very long query
  it('long-query-handling', async () => {
    const longQuery = Array(50).fill('test ').join('');
    const results = await client.search(longQuery, { limit: 10 });
    expect(results.status).toBeDefined();
  });

  // Query with special characters
  it('special-chars-query', async () => {
    const results = await client.search('test & query | with "quotes"', {
      limit: 10,
      mode: 'combined'
    });
    expect(results.totalResults).toBeGreaterThan(0);
  });

  // Query with HTML entities
  it('html-entities-query', async () => {
    const results = await client.search('<script>alert("xss")</script>', {
      limit: 10,
      mode: 'combined'
    });
    // Should handle safely without breaking
    expect(results.status).toBeDefined();
  });

  // Query with unicode characters
  it('unicode-characters-query', async () => {
    const results = await client.search('测试 query 🎯', {
      limit: 10,
      mode: 'combined'
    });
    expect(results.totalResults).toBeGreaterThanOrEqual(0);
  });

  // Query with very short length
  it('single-char-query', async () => {
    const results = await client.search('a', { limit: 10, mode: 'combined' });
    expect(results.status).toBeDefined();
  });
});
```

---

## 8. Phase P6: Performance Benchmarks

### P6 Test Categories

Tests should include performance benchmarks to validate latency targets:

```typescript
// P6 - Performance Benchmark Tests

describe('P6 Performance Benchmarks', () => {
  let startTime: number;

  beforeAll(() => {
    startTime = Date.now();
  });

  it('P6 semantic-search-latency', async () => {
    const start = Date.now();
    const results = await client.search('authentication and authorization in Node.js best practices', {
      strategy: 'semantic',
      maxResults: 10
    });
    const latency = Date.now() - start;
    
    expect(latency).toBeLessThan(3000); // <3s target for P0
    logPerformance('P6 semantic-search-latency', latency);
  });

  it('P6 tag-search-latency', async () => {
    const start = Date.now();
    const results = await client.search('#test #api #node', {
      mode: 'tags',
      maxResults: 10
    });
    const latency = Date.now() - start;
    
    expect(latency).toBeLessThan(1000); // <1s target for P1
    logPerformance('P6 tag-search-latency', latency);
  });

  it('P6 byte-offset-latency', async () => {
    const start = Date.now();
    const results = await client.search('function findAnchors', {
      includeByteOffsets: true,
      maxResults: 5
    });
    const latency = Date.now() - start;
    
    expect(latency).toBeLessThan(500); // <500ms target for P2
    logPerformance('P6 byte-offset-latency', latency);
  });

  it('P6 fts-search-latency', async () => {
    const start = Date.now();
    const results = await client.search('workspace', {
      limit: 10,
      mode: 'combined'
    });
    const latency = Date.now() - start;
    
    expect(latency).toBeLessThan(200); // <200ms target for P3
    logPerformance('P6 fts-search-latency', latency);
  });

  it('P6 empty-query-latency', async () => {
    const start = Date.now();
    const results = await client.search('', {
      limit: 100,
      mode: 'combined'
    });
    const latency = Date.now() - start;
    
    expect(latency).toBeLessThan(100); // <100ms target for P4
    logPerformance('P6 empty-query-latency', latency);
  });

  function logPerformance(testName: string, latency: number): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      testName,
      latencyMs: latency,
      targetMs: getLatencyTarget(testName)
    };

    const fs = await import('fs');
    const path = await import('path');
    const logDir = path.join(process.env.PROJECT_ROOT || '.', '.anchor', 'logs', 'performance-tests');
    const logFile = path.join(logDir, `${testName}-${timestamp.replace(/[:.]/g, '-')}.json`);

    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, JSON.stringify(logEntry, null, 2));
  }

  function getLatencyTarget(testName: string): number {
    return testName.includes('semantic') ? 3000 :
           testName.includes('tag') ? 1000 :
           testName.includes('byte') ? 500 :
           testName.includes('fts') ? 200 :
           100;
  }
});
```

---

## 9. CI/CD Integration

### GitHub Actions Example

```yaml
# .github/workflows/test.yml
name: Search Algorithm Tests
on: [push, pull_request]
jobs:
  search-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      # Start engine
      - name: Start Engine
        run: |
          pnpm start & 
          sleep 10

      # Run critical phases only (P0-P4 for fast feedback)
      - name: Search Algorithm Tests
        run: |
          node tests/live-fire-suite.mjs --phase P0,P1,P2,P3,P4

      # Or run with vitest directly
      # - name: Vitest Tests
      #   run: pnpm test search-algorithms

      # Upload logs as artifact for failure analysis
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-logs
          path: .anchor/logs/
```

### Watch Mode for Development

```bash
# Run all phases sequentially
node tests/live-fire-suite.mjs --full

# Watch mode - reruns on changes
node tests/live-fire-suite.mjs --watch

# Filter by test name pattern
node tests/live-fire-suite.mjs --grep="semantic"

# Skip engine startup (engine must be running)
node tests/live-fire-suite.mjs --full --skip-start
```

---

## 10. Troubleshooting Guide

### Tests Fail Immediately

**Symptom:** All tests fail on first run with connection errors.

**Cause:** Engine not running or wrong port.

**Fix:**
```bash
# Check if engine is running
curl http://localhost:3160/health

# Start engine manually
pnpm start

# Verify API key in test config (if needed)
grep "API_KEY" tests/*.mjs
```

### Logs Not Being Created

**Symptom:** `.anchor/logs/` directory doesn't exist or is empty.

**Cause:** Permission issues or wrong PROJECT_ROOT environment variable.

**Fix:**
```bash
# Ensure .anchor directory exists with correct permissions
mkdir -p .anchor/logs/search-tests
chmod 755 .anchor/logs

# Verify PROJECT_ROOT is set correctly
echo $PROJECT_ROOT  # Should be project root path

# Run test again
node tests/live-fire-suite.mjs --full
```

### Performance Tests Exceed Targets

**Symptom:** P0 semantic search takes >3s, P1 tag search >1s.

**Cause:** Insufficient indexed content or memory pressure.

**Fix:**
```bash
# Check database size
curl http://localhost:3160/v1/stats | jq '.databaseSize'

# Re-index corpus if needed
node scripts/reindex-corpus.mjs

# Clear cache and retry
rm -rf .anchor/cache/*
node tests/live-fire-suite.mjs --phase P0
```

### Pain Point Detection Not Working (Standard 027)

**Symptom:** Tests pass but no pain point logs created.

**Cause:** Standard 027 threshold not met (<3 commits or <2 hours).

**Fix:** Check if pain point logging is enabled in Standard 027 configuration.

---

## 11. Best Practices

1. **Run P0-P4 in CI** - These catch the most critical issues with reasonable time (<30s total)
2. **Use `--skip-start` flag** when engine is already running (faster feedback)
3. **Check logs after failures** - `.anchor/logs/` contains detailed diagnostics
4. **Monitor pain point thresholds** - If a fix takes >2 hours, log it per Standard 027
5. **Keep tests focused** - Each test should validate one specific behavior
6. **Add performance benchmarks in P6** - Validate latency targets regularly
7. **Test edge cases in P5** - Ensure robustness against malformed inputs

---

## 12. Related Standards

- **Standard 028**: Unified Test Pipeline - Test orchestration framework
- **Standard 019**: Test Environment Consistency - Test setup requirements
- **Standard 004**: Streaming Search - SSE-based search implementation
- **Standard 027**: Pain Point Logging - Operational logging for long-running issues
- **Standard 016**: MCP Integration Testing - Model Context Protocol integration tests

---

## Appendix A: Log Locations (Per doc_policy.md Section 5.3)

All runtime objects are stored in `$home/.anchor`. Test logs follow this structure:

### Orchestration Logs (Main Execution)

```
.anchor/logs/live-fire-tests/
├── run-live-fire-tests.log              # Main orchestration log
├── errors.log                           # Error stack traces
└── run-2026-05-19T14-30-00.log          # Per-run execution summaries
```

### Distillation Test Logs (Per Standard 014)

```
.anchor/logs/distillation-tests/
├── distillation-unseeded-2026-05-19T14-33-00.json
└── distillation-seeded-context-2026-05-19T14-33-30.json
```

### Pain Point Logs (Per Standard 027)

```
.anchor/logs/pain-points/
├── path-management-issue-2026-05-19.json
└── config-drift-detection-2026-05-19.json
```

### Summary Reports

```
docs/testing/live-fire-results/
├── 2026-05-19-summary.md
└── phase-reports/
    ├── P0-report.md
    ├── P1-report.md
    └── ...
```

---

**Last Updated:** 2026-06-03  
**Version:** 2.0.0  
**Maintainer:** Anchor Engine Team  