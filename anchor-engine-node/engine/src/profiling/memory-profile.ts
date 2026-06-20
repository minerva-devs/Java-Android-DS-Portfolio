/**
 * Memory Profiling Script for Anchor Engine
 *
 * Profiles memory usage during large ingestion and search operations.
 * Run with: node --expose-gc dist/profiling/memory-profile.js
 *
 * Usage:
 *   npm run profile:memory -- search          # Profile search operations
 *   npm run profile:memory -- ingestion       # Profile ingestion operations
 *   npm run profile:memory -- both            # Profile both
 */

import { memoryProfiler, MemoryProfiler } from '../utils/memory-profiler.js';
import { db } from '../core/db.js';
import { iterativeSearch } from '../services/search/search.js';
import { ingestContent } from '../services/ingest/ingest.js';
import { config } from '../config/index.js';
import * as path from 'path';
import * as fs from 'fs';

const mb = 1024 * 1024;

/**
 * Profile search operations
 */
async function profileSearch() {
  console.log('\n🔍 Profiling Search Operations...\n');

  // Initialize database
  await db.init();

  // Test queries of varying complexity
  const testQueries = [
    { query: 'simple', description: 'Simple single-term search' },
    { query: 'performance optimization caching', description: 'Multi-term search' },
    { query: '#work meeting notes 2025', description: 'Tagged search with temporal context' },
    { query: 'machine learning neural network deep learning AI', description: 'Complex multi-concept search' },
  ];

  memoryProfiler.startProfile('search-operations');
  memoryProfiler.startMonitoring(2000);

  try {
    for (const test of testQueries) {
      console.log(`\n📝 Testing: ${test.description}`);
      console.log(`   Query: "${test.query}"`);

      const searchStart = Date.now();
      const result = await iterativeSearch(
        test.query,
        [], // buckets
        10000, // maxChars
        [], // tags
        'all', // provenance
        false // useMaxRecall
      );

      const searchDuration = Date.now() - searchStart;
      const snapshot = memoryProfiler.takeSnapshot(`search-${test.query.substring(0, 20)}`);

      console.log(`   ✅ Found ${result.results.length} results in ${searchDuration}ms`);
      console.log(`   📊 Memory: ${(snapshot.heapUsed / mb).toFixed(2)}MB (${snapshot.heapUsedPercent.toFixed(1)}%)`);

      // Small delay between searches
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Test max-recall search (memory intensive)
    console.log('\n📝 Testing: Max-recall search (memory intensive)');
    const maxRecallStart = Date.now();
    const maxRecallResult = await iterativeSearch(
      'performance',
      [],
      20000,
      [],
      'all',
      true // useMaxRecall
    );
    const maxRecallDuration = Date.now() - maxRecallStart;
    const maxRecallSnapshot = memoryProfiler.takeSnapshot('search-max-recall');

    console.log(`   ✅ Found ${maxRecallResult.results.length} results in ${maxRecallDuration}ms`);
    console.log(`   📊 Memory: ${(maxRecallSnapshot.heapUsed / mb).toFixed(2)}MB`);

  } catch (error) {
    console.error('❌ Search profiling failed:', error);
  } finally {
    const profile = memoryProfiler.endProfile('search-operations');
    memoryProfiler.stopMonitoring();
    memoryProfiler.printProfileReport('search-operations');

    if (profile) {
      // Save profile to file
      const outputFile = path.join(process.cwd(), 'logs', `search-profile-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, memoryProfiler.exportProfile('search-operations')!);
      console.log(`\n💾 Profile saved to: ${outputFile}`);
    }
  }
}

/**
 * Profile ingestion operations
 */
async function profileIngestion() {
  console.log('\n📥 Profiling Ingestion Operations...\n');

  // Initialize database
  await db.init();

  // Create test files of varying sizes
  const testFiles = [
    { size: 'small', chars: 1000, description: 'Small file (1K chars)' },
    { size: 'medium', chars: 10000, description: 'Medium file (10K chars)' },
    { size: 'large', chars: 100000, description: 'Large file (100K chars)' },
  ];

  memoryProfiler.startProfile('ingestion-operations');
  memoryProfiler.startMonitoring(2000);

  const tempDir = path.join(process.cwd(), 'temp-profiling');
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    for (const test of testFiles) {
      console.log(`\n📝 Testing: ${test.description}`);

      // Create test file
      const testFile = path.join(tempDir, `test-${test.size}.txt`);
      const content = generateTestContent(test.chars);
      fs.writeFileSync(testFile, content);

      const ingestStart = Date.now();
      const result = await ingestContent(
        content,
        testFile,
        'text',
        ['core'],
        [],
        {
          atomize: true,
          skipCleaning: false,
        }
      );
      const ingestDuration = Date.now() - ingestStart;

      const snapshot = memoryProfiler.takeSnapshot(`ingest-${test.size}`);

      console.log(`   ✅ Ingested: ${result.id} in ${ingestDuration}ms`);
      console.log(`   📊 Memory: ${(snapshot.heapUsed / mb).toFixed(2)}MB`);

      // Small delay between ingestions
      await new Promise(resolve => setTimeout(resolve, 500));
    }

  } catch (error) {
    console.error('❌ Ingestion profiling failed:', error);
  } finally {
    const profile = memoryProfiler.endProfile('ingestion-operations');
    memoryProfiler.stopMonitoring();
    memoryProfiler.printProfileReport('ingestion-operations');

    // Cleanup
    fs.rmSync(tempDir, { recursive: true, force: true });

    if (profile) {
      const outputFile = path.join(process.cwd(), 'logs', `ingestion-profile-${Date.now()}.json`);
      fs.mkdirSync(path.dirname(outputFile), { recursive: true });
      fs.writeFileSync(outputFile, memoryProfiler.exportProfile('ingestion-operations')!);
      console.log(`\n💾 Profile saved to: ${outputFile}`);
    }
  }
}

/**
 * Generate test content
 */
function generateTestContent(chars: number): string {
  const words = [
    'performance', 'optimization', 'memory', 'cache', 'database',
    'search', 'index', 'query', 'algorithm', 'efficiency',
    'benchmark', 'profiling', 'analysis', 'metrics', 'throughput',
  ];

  let content = '';
  while (content.length < chars) {
    const word = words[Math.floor(Math.random() * words.length)];
    content += word + ' ';

    // Add some sentence structure
    if (content.length % 100 < words.length) {
      content += '. ';
    }
  }

  return content.substring(0, chars);
}

/**
 * Main entry point
 */
async function main() {
  const mode = process.argv[2] || 'both';

  console.log('🚀 Anchor Engine Memory Profiler');
  console.log('='.repeat(60));
  console.log(`Mode: ${mode}`);
  console.log(`Node version: ${process.version}`);
  console.log(`GC available: ${!!global.gc}`);
  console.log('='.repeat(60));

  if (!global.gc && mode !== 'help') {
    console.warn('\n⚠️  Warning: GC not exposed. Run with --expose-gc for accurate profiling.');
  }

  try {
    switch (mode) {
      case 'search':
        await profileSearch();
        break;
      case 'ingestion':
        await profileIngestion();
        break;
      case 'both':
        await profileSearch();
        await new Promise(resolve => setTimeout(resolve, 2000));
        await profileIngestion();
        break;
      case 'help':
      default:
        console.log('\nUsage: npm run profile:memory -- [search|ingestion|both]');
        console.log('\nExamples:');
        console.log('  npm run profile:memory -- search      # Profile search only');
        console.log('  npm run profile:memory -- ingestion   # Profile ingestion only');
        console.log('  npm run profile:memory -- both        # Profile both');
        break;
    }

    console.log('\n✅ Profiling complete!');
    console.log(memoryProfiler.getMemoryStats());

  } catch (error) {
    console.error('\n❌ Profiling failed:', error);
    process.exit(1);
  } finally {
    // Cleanup
    memoryProfiler.clearProfiles();
  }
}

// Run if executed directly
if (process.argv[1]?.endsWith('memory-profile.js')) {
  main().catch(console.error);
}

export { profileSearch, profileIngestion };
