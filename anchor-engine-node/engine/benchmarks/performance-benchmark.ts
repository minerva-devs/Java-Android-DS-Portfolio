/**
 * Performance Benchmark Suite for Anchor Engine
 *
 * Comprehensive benchmarks for all Sprint 4 optimizations:
 * - LRU Cache performance
 * - Deduplication optimization (O(N²) → O(N log N))
 * - Database query batching
 * - Memory efficiency
 *
 * Run with: npm run benchmark:performance
 */

import { createLRUCache, LRUCache } from '../utils/lru-cache.js';
import { memoryProfiler } from '../utils/memory-profiler.js';
import { batchFetchCompounds } from '../utils/db-batch.js';
import { db } from '../core/db.js';
import * as crypto from 'crypto';

const mb = 1024 * 1024;
const ns_to_ms = 1 / 1_000_000;

interface BenchmarkResult {
  name: string;
  iterations: number;
  totalTime: number; // ms
  avgTime: number; // ms
  minTime: number; // ms
  maxTime: number; // ms
  opsPerSecond: number;
  memoryUsed: number; // MB
  status: 'pass' | 'fail' | 'warning';
  target?: number; // Target time in ms
  baseline?: number; // Baseline time in ms (before optimization)
  improvement?: number; // Percentage improvement
}

interface BenchmarkSuite {
  name: string;
  description: string;
  results: BenchmarkResult[];
}

/**
 * Benchmark runner
 */
class BenchmarkRunner {
  private suites: BenchmarkSuite[] = [];
  private warmupIterations = 5;
  private benchmarkIterations = 100;

  /**
   * Run a benchmark
   */
  async runBenchmark(
    name: string,
    fn: () => Promise<void> | void,
    options: {
      iterations?: number;
      warmup?: number;
      targetMs?: number;
      baselineMs?: number;
    } = {},
  ): Promise<BenchmarkResult> {
    const iterations = options.iterations || this.benchmarkIterations;
    const warmup = options.warmup || this.warmupIterations;

    console.log(`\n🔬 Running benchmark: ${name}`);

    // Warmup
    console.log(`   Warming up (${warmup} iterations)...`);
    for (let i = 0; i < warmup; i++) {
      await fn();
    }

    // Force GC before benchmark
    if (global.gc) {
      global.gc();
    }

    // Start memory profiling
    memoryProfiler.startProfile(`benchmark-${name}`);

    // Benchmark
    console.log(`   Running ${iterations} iterations...`);
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) * ns_to_ms);
    }

    // End memory profiling
    const profile = memoryProfiler.endProfile(`benchmark-${name}`);
    const memoryUsed = profile
      ? (profile.endMemory.heapUsed - profile.startMemory.heapUsed) / mb
      : 0;

    // Calculate statistics
    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = 1000 / avgTime;

    // Determine status
    let status: 'pass' | 'fail' | 'warning' = 'pass';
    if (options.targetMs) {
      if (avgTime > options.targetMs * 1.5) {
        status = 'fail';
      } else if (avgTime > options.targetMs) {
        status = 'warning';
      }
    }

    // Calculate improvement
    let improvement: number | undefined;
    if (options.baselineMs) {
      improvement = ((options.baselineMs - avgTime) / options.baselineMs) * 100;
    }

    const result: BenchmarkResult = {
      name,
      iterations,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      opsPerSecond,
      memoryUsed,
      status,
      target: options.targetMs,
      baseline: options.baselineMs,
      improvement,
    };

    // Print result
    this.printResult(result);

    return result;
  }

  /**
   * Print benchmark result
   */
  private printResult(result: BenchmarkResult): void {
    const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';

    console.log(`   ${statusIcon} ${result.name}`);
    console.log(`      Avg: ${result.avgTime.toFixed(3)}ms (${result.opsPerSecond.toFixed(0)} ops/sec)`);
    console.log(`      Min: ${result.minTime.toFixed(3)}ms | Max: ${result.maxTime.toFixed(3)}ms`);
    console.log(`      Total: ${result.totalTime.toFixed(2)}ms | Memory: ${result.memoryUsed.toFixed(2)}MB`);

    if (result.target) {
      const vsTarget = ((result.avgTime - result.target) / result.target * 100);
      console.log(`      Target: ${result.target.toFixed(3)}ms (${vsTarget >= 0 ? '+' : ''}${vsTarget.toFixed(1)}% vs target)`);
    }

    if (result.improvement !== undefined) {
      console.log(`      Improvement: ${result.improvement >= 0 ? '+' : ''}${result.improvement.toFixed(1)}% vs baseline`);
    }
  }

  /**
   * Add suite
   */
  addSuite(suite: BenchmarkSuite): void {
    this.suites.push(suite);
  }

  /**
   * Print summary
   */
  printSummary(): void {
    console.log('\n' + '='.repeat(80));
    console.log('BENCHMARK SUMMARY');
    console.log('='.repeat(80));

    let totalPass = 0;
    let totalFail = 0;
    let totalWarning = 0;

    for (const suite of this.suites) {
      console.log(`\n${suite.name}: ${suite.description}`);

      for (const result of suite.results) {
        const statusIcon = result.status === 'pass' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
        console.log(`  ${statusIcon} ${result.name}: ${result.avgTime.toFixed(3)}ms`);

        if (result.status === 'pass') totalPass++;
        else if (result.status === 'warning') totalWarning++;
        else totalFail++;
      }
    }

    console.log('\n' + '-'.repeat(80));
    console.log(`Total: ${totalPass} pass, ${totalWarning} warning, ${totalFail} fail`);
    console.log('='.repeat(80));
  }
}

/**
 * LRU Cache Benchmarks
 */
async function benchmarkLRUCache(runner: BenchmarkRunner): Promise<BenchmarkSuite> {
  console.log('\n' + '='.repeat(80));
  console.log('LRU CACHE BENCHMARKS');
  console.log('='.repeat(80));

  const results: BenchmarkResult[] = [];

  // Test 1: Basic get/set performance
  const cache = createLRUCache<string, any>({
    maxEntries: 1000,
    ttlMs: 0,
    enableMemoryPressureEviction: false,
  });

  const basicResult = await runner.runBenchmark(
    'LRU Cache: Basic Get/Set',
    () => {
      cache.set('key', { data: 'value' }, 1024);
      cache.get('key');
    },
    { iterations: 10000, targetMs: 0.01 },
  );
  results.push(basicResult);

  // Test 2: LRU eviction performance
  const evictionCache = createLRUCache<number, any>({
    maxEntries: 100,
    ttlMs: 0,
    enableMemoryPressureEviction: false,
  });

  const evictionResult = await runner.runBenchmark(
    'LRU Cache: Eviction (1000 items, max 100)',
    () => {
      for (let i = 0; i < 1000; i++) {
        evictionCache.set(i, { data: i }, 1024);
      }
    },
    { iterations: 100, targetMs: 5 },
  );
  results.push(evictionResult);

  // Test 3: TTL expiration performance
  const ttlCache = createLRUCache<string, any>({
    maxEntries: 1000,
    ttlMs: 100, // 100ms TTL
    enableMemoryPressureEviction: false,
  });

  const ttlResult = await runner.runBenchmark(
    'LRU Cache: TTL Expiration',
    () => {
      ttlCache.set('key', { data: 'value' }, 1024);
      ttlCache.get('key');
    },
    { iterations: 1000, targetMs: 0.02 },
  );
  results.push(ttlResult);

  // Test 4: Memory pressure eviction
  const memPressureCache = createLRUCache<string, any>({
    maxEntries: 1000,
    ttlMs: 0,
    enableMemoryPressureEviction: true,
    memoryPressureThreshold: 70,
    criticalMemoryThreshold: 85,
  });

  const memPressureResult = await runner.runBenchmark(
    'LRU Cache: Memory Pressure Check',
    () => {
      memPressureCache.getStats(); // Triggers memory check
    },
    { iterations: 1000, targetMs: 0.1 },
  );
  results.push(memPressureResult);

  return {
    name: 'LRU Cache',
    description: 'LRU cache performance with O(1) operations',
    results,
  };
}

/**
 * Deduplication Benchmarks
 */
async function benchmarkDeduplication(runner: BenchmarkRunner): Promise<BenchmarkSuite> {
  console.log('\n' + '='.repeat(80));
  console.log('DEDUPLICATION BENCHMARKS');
  console.log('='.repeat(80));

  const results: BenchmarkResult[] = [];

  // Simulate O(N²) baseline
  const baselineDedup = (items: string[]): string[] => {
    const distinct: string[] = [];
    for (const item of items) {
      let isDuplicate = false;
      for (const kept of distinct) {
        if (item.includes(kept.substring(0, 50)) || kept.includes(item.substring(0, 50))) {
          isDuplicate = true;
          break;
        }
      }
      if (!isDuplicate) distinct.push(item);
    }
    return distinct;
  };

  // Simulate O(N log N) optimized
  const optimizedDedup = (items: string[]): string[] => {
    const buckets = new Map<string, string[]>();
    const distinct: string[] = [];

    for (const item of items) {
      const bucketKey = Math.floor(Math.log2(Math.max(1, item.length))).toString();
      let bucket = buckets.get(bucketKey);
      if (!bucket) {
        bucket = [];
        buckets.set(bucketKey, bucket);
      }

      // Check only in adjacent buckets
      let isDuplicate = false;
      const adjacent = [parseInt(bucketKey) - 1, parseInt(bucketKey), parseInt(bucketKey) + 1];
      for (const adjKey of adjacent) {
        const adjBucket = buckets.get(adjKey.toString());
        if (adjBucket) {
          for (const kept of adjBucket) {
            if (item.includes(kept.substring(0, 50)) || kept.includes(item.substring(0, 50))) {
              isDuplicate = true;
              break;
            }
          }
        }
        if (isDuplicate) break;
      }

      if (!isDuplicate) {
        distinct.push(item);
        bucket.push(item);
      }
    }
    return distinct;
  };

  // Generate test data
  const generateTestData = (count: number): string[] => {
    return Array.from({ length: count }, (_, i) => {
      return `Content item ${i} with some text to make it longer and more realistic for testing deduplication performance`;
    });
  };

  // Test with 100 items
  const data100 = generateTestData(100);
  
  const dedup100Baseline = await runner.runBenchmark(
    'Dedup: 100 items (O(N²) baseline)',
    () => baselineDedup(data100),
    { iterations: 10, baselineMs: 0.5 },
  );
  results.push(dedup100Baseline);

  const dedup100Optimized = await runner.runBenchmark(
    'Dedup: 100 items (O(N log N) optimized)',
    () => optimizedDedup(data100),
    { iterations: 10, targetMs: 0.1 },
  );
  results.push(dedup100Optimized);

  // Test with 500 items
  const data500 = generateTestData(500);
  
  const dedup500Baseline = await runner.runBenchmark(
    'Dedup: 500 items (O(N²) baseline)',
    () => baselineDedup(data500),
    { iterations: 5, baselineMs: 5 },
  );
  results.push(dedup500Baseline);

  const dedup500Optimized = await runner.runBenchmark(
    'Dedup: 500 items (O(N log N) optimized)',
    () => optimizedDedup(data500),
    { iterations: 5, targetMs: 0.5 },
  );
  results.push(dedup500Optimized);

  return {
    name: 'Deduplication',
    description: 'Content deduplication optimization (O(N²) → O(N log N))',
    results,
  };
}

/**
 * Database Batching Benchmarks
 */
async function benchmarkDatabaseBatching(runner: BenchmarkRunner): Promise<BenchmarkSuite> {
  console.log('\n' + '='.repeat(80));
  console.log('DATABASE BATCHING BENCHMARKS');
  console.log('='.repeat(80));

  const results: BenchmarkResult[] = [];

  // Initialize database
  await db.init();

  // Test batch fetch (if database has data)
  try {
    const batchFetchResult = await runner.runBenchmark(
      'DB: Batch fetch compounds (10 IDs)',
      async () => {
        // Generate some test IDs (may not exist, but tests query performance)
        const ids = Array.from({ length: 10 }, (_, i) => `test-id-${i}`);
        await batchFetchCompounds(ids);
      },
      { iterations: 100, targetMs: 5 },
    );
    results.push(batchFetchResult);
  } catch (error) {
    console.warn('   ⚠️  Batch fetch benchmark skipped (database not ready)');
  }

  return {
    name: 'Database Batching',
    description: 'Database query batching optimization',
    results,
  };
}

/**
 * Memory Efficiency Benchmarks
 */
async function benchmarkMemoryEfficiency(runner: BenchmarkRunner): Promise<BenchmarkSuite> {
  console.log('\n' + '='.repeat(80));
  console.log('MEMORY EFFICIENCY BENCHMARKS');
  console.log('='.repeat(80));

  const results: BenchmarkResult[] = [];

  // Test memory overhead of LRU cache
  const cache = createLRUCache<string, any>({
    maxEntries: 10000,
    ttlMs: 0,
    enableMemoryPressureEviction: false,
  });

  const memoryOverheadResult = await runner.runBenchmark(
    'Memory: LRU cache overhead (10K entries)',
    () => {
      for (let i = 0; i < 10000; i++) {
        cache.set(`key-${i}`, { data: `value-${i}` }, 1024);
      }
    },
    { iterations: 1, targetMs: 100 },
  );
  results.push(memoryOverheadResult);

  // Test memory profiling overhead
  const profilingOverheadResult = await runner.runBenchmark(
    'Memory: Profiling snapshot overhead',
    () => {
      memoryProfiler.takeSnapshot('test');
    },
    { iterations: 1000, targetMs: 0.1 },
  );
  results.push(profilingOverheadResult);

  return {
    name: 'Memory Efficiency',
    description: 'Memory overhead and efficiency metrics',
    results,
  };
}

/**
 * Main entry point
 */
async function main() {
  console.log('🚀 Anchor Engine Performance Benchmark Suite');
  console.log('Sprint 4: Performance Hardening');
  console.log('='.repeat(80));
  console.log(`Node version: ${process.version}`);
  console.log(`GC available: ${!!global.gc}`);
  console.log(`Platform: ${process.platform}-${process.arch}`);
  console.log('='.repeat(80));

  const runner = new BenchmarkRunner();
  const suites: BenchmarkSuite[] = [];

  try {
    // Run all benchmarks
    suites.push(await benchmarkLRUCache(runner));
    suites.push(await benchmarkDeduplication(runner));
    suites.push(await benchmarkDatabaseBatching(runner));
    suites.push(await benchmarkMemoryEfficiency(runner));

    // Print summary
    runner.printSummary();

    // Save results
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `benchmarks/performance-${timestamp}.json`;
    
    // Note: File writing would go here in production
    console.log(`\n💾 Results would be saved to: ${outputFile}`);

  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith('performance-benchmark.ts')) {
  main().catch(console.error);
}

export { BenchmarkRunner, benchmarkLRUCache, benchmarkDeduplication, benchmarkMemoryEfficiency };
