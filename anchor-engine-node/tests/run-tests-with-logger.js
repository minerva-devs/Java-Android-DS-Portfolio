#!/usr/bin/env node
/**
 * Test Runner with Centralized Logging
 * 
 * Wraps vitest test runs and captures all output to centralized logs.
 * 
 * Usage:
 *   node tests/run-tests-with-logger.js              # Run all tests
 *   node tests/run-tests-with-logger.js --grep="search"  # Filter tests
 *   node tests/run-tests-with-logger.js --unit        # Run only unit tests
 *   node tests/run-tests-with-logger.js --integration # Run only integration tests
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

// Test categories
const TEST_CATEGORIES = {
  unit: {
    name: 'Unit Tests',
    pattern: 'tests/unit/**/*.test.ts',
    description: 'Unit tests for individual components',
  },
  integration: {
    name: 'Integration Tests',
    pattern: 'tests/integration/**/*.test.ts',
    description: 'Integration tests for component interactions',
  },
  benchmarks: {
    name: 'Benchmark Tests',
    pattern: 'tests/benchmarks/**/*.test.ts',
    description: 'Performance benchmark tests',
  },
  all: {
    name: 'All Tests',
    pattern: 'tests/**/*.test.ts',
    description: 'All test files',
  },
};

// Parse command line arguments
const args = process.argv.slice(2);
const grepIndex = args.indexOf('--grep');
const grepPattern = grepIndex >= 0 ? args[grepIndex + 1] : null;

const unitIndex = args.indexOf('--unit');
const integrationIndex = args.indexOf('--integration');
const benchmarksIndex = args.indexOf('--benchmarks');

let category = 'all';
if (unitIndex >= 0) category = 'unit';
else if (integrationIndex >= 0) category = 'integration';
else if (benchmarksIndex >= 0) category = 'benchmarks';

const testCategory = TEST_CATEGORIES[category];

// Standard 110: Use .anchor/local-data for centralized logging
const ANCHOR_ROOT = path.join(process.env.PROJECT_ROOT || ROOT, '.anchor');
const LOCAL_DATA_DIR = path.join(ANCHOR_ROOT, 'local-data');
const TEST_LOGS_DIR = path.join(LOCAL_DATA_DIR, 'logs', 'tests');

// Generate test name for logging
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
const testName = `${category}-tests-${timestamp}`;

// Ensure test logs directory exists
fs.mkdirSync(TEST_LOGS_DIR, { recursive: true });

console.log('\n' + '='.repeat(80));
console.log(`Running ${testCategory.name}`);
console.log(`Category: ${category}`);
console.log(`Pattern: ${testCategory.pattern}`);
console.log(`Timestamp: ${timestamp}`);
if (grepPattern) {
  console.log(`Grep Filter: ${grepPattern}`);
}
console.log('='.repeat(80) + '\n');

// Build vitest command - use root config file (not engine-specific)
const vitestConfigPath = path.join(ROOT, 'root-vitest-config.ts');
const cmdArgs = ['run'];

// Add config path using --config flag
cmdArgs.push('--config');
cmdArgs.push(vitestConfigPath);

// Add reporter option
cmdArgs.push('--reporter');
cmdArgs.push('verbose');

if (grepPattern) {
  // Use --test-name-pattern for filtering (vitest v4+)
  const escapedPattern = grepPattern.replace(/"/g, '\\"');
  cmdArgs.push(`--test-name-pattern="${escapedPattern}"`);
}

// Add coverage flag if present in environment
const coverage = process.env.VITEST_COVERAGE || '';
if (coverage) {
  cmdArgs.push('--coverage');
}

// Use absolute path to vitest in engine/node_modules
const vitestPath = path.join(ROOT, 'engine', 'node_modules', 'vitest', 'vitest.mjs');

const vitest = spawn('node', [vitestPath], {
  cwd: ROOT,
  stdio: 'inherit',
  shell: false,
});

let exitCode = 0;
let testResults = {
  passed: 0,
  failed: 0,
  skipped: 0,
  total: 0,
};

vitest.on('close', (code) => {
  exitCode = code || 0;

  console.log('\n' + '='.repeat(80));
  console.log('Test Run Summary');
  console.log('='.repeat(80));
  console.log(`Test Name: ${testName}`);
  console.log(`Category: ${category}`);
  console.log(`Exit Code: ${exitCode}`);
  console.log(`Results:`, testResults);
  console.log('='.repeat(80) + '\n');

  // Note: Full results will be captured in the centralized log file under .anchor/local-data
  console.log(`📁 Centralized log will be written to: .anchor/local-data/logs/tests/${testName}-*.log`);
  console.log(`📊 To view A/B comparisons, use: node scripts/compare-tests.ts <log1> <log2>\n`);

  process.exit(exitCode);
});

vitest.on('error', (err) => {
  console.error('Failed to start test runner:', err);
  process.exit(1);
});