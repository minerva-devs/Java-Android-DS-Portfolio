#!/usr/bin/env node
/**
 * Streamlined Test Pipeline for Anchor Engine
 * 
 * Runs tests in order of criticality:
 *   1. P0 (Critical) - Paths, Search utils, Smoke tests
 *   2. P1 (Important) - Integration tests (if engine running)
 *   3. P2 (Nice to have) - Full E2E (if --full flag)
 * 
 * Usage:
 *   node tests/streamlined-test.mjs        # Run P0 tests only (~1s)
 *   node tests/streamlined-test.mjs --p1   # Run P0 + P1 (~5s)
 *   node tests/streamlined-test.mjs --full # Run all tests (~30s)
 *   node tests/streamlined-test.mjs --watch # Watch mode
 */

import { spawn } from 'child_process';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = process.cwd();

// Test levels
const TEST_LEVELS = {
  p0: {
    name: 'P0 - Critical',
    description: 'Paths, search utils, basic smoke tests',
    cmd: 'node tests/minimal-framework.mjs',
    timeout: 10000,
    required: true
  },
  p1: {
    name: 'P1 - Integration',
    description: 'MCP integration, API client tests',
    cmd: 'node mcp-server/test-integration.js',
    timeout: 30000,
    required: false
  },
  p2: {
    name: 'P2 - E2E',
    description: 'Full stack end-to-end tests',
    cmd: 'pnpm vitest run tests/e2e/full-stack.test.ts',
    timeout: 120000,
    required: false
  }
};

// Colors
const G = '\x1b[32m', R = '\x1b[31m', Y = '\x1b[33m', C = '\x1b[36m', NC = '\x1b[0m';

function log(level, msg) {
  const colors = { info: C, success: G, error: R, warn: Y };
  console.log(`${colors[level] || ''}${msg}${NC}`);
}

async function runCommand(cmd, timeout) {
  return new Promise((resolve) => {
    const [command, ...args] = cmd.split(' ');
    const proc = spawn(command, args, { 
      cwd: ROOT, 
      stdio: 'pipe',
      shell: true 
    });
    
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => stdout += d);
    proc.stderr.on('data', d => stderr += d);
    
    const timer = setTimeout(() => {
      proc.kill();
      resolve({ code: 1, stdout, stderr: 'TIMEOUT' });
    }, timeout);
    
    proc.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

async function checkEngineRunning() {
  try {
    const settings = JSON.parse(readFileSync(join(ROOT, 'user_settings.json'), 'utf8'));
    const port = settings.server?.port || 3160;
    const res = await fetch(`http://localhost:${port}/v1/stats`, {
      headers: { 'Authorization': `Bearer ${settings.server?.api_key || ''}` }
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const runP1 = args.includes('--p1') || args.includes('--full');
  const runP2 = args.includes('--full');
  const watch = args.includes('--watch');
  
  if (watch) {
    log('info', '👁️  Watch mode - press Ctrl+C to stop\n');
    // Simple watch loop
    while (true) {
      await runTests({ p0: true, p1: false, p2: false });
      log('info', '\n⏳ Waiting 5s before next run...\n');
      await new Promise(r => setTimeout(r, 5000));
    }
  }
  
  const engineRunning = await checkEngineRunning();
  if (!engineRunning && (runP1 || runP2)) {
    log('warn', '⚠️  Engine not running - skipping integration tests');
    log('info', '   Start with: pnpm start\n');
  }
  
  const results = await runTests({
    p0: true,
    p1: runP1 && engineRunning,
    p2: runP2 && engineRunning
  });
  
  // Summary
  console.log('\n' + '='.repeat(60));
  log('info', 'TEST SUMMARY');
  console.log('='.repeat(60));
  
  for (const [level, result] of Object.entries(results)) {
    const status = result.skipped ? Y + 'SKIPPED' : result.code === 0 ? G + 'PASS' : R + 'FAIL';
    log(result.code === 0 ? 'success' : 'error', `  ${TEST_LEVELS[level].name}: ${status}${NC}`);
  }
  
  const allPassed = Object.values(results).every(r => r.code === 0 || r.skipped);
  console.log('='.repeat(60));
  
  if (allPassed) {
    log('success', '✅ All tests passed!');
    process.exit(0);
  } else {
    log('error', '❌ Some tests failed');
    process.exit(1);
  }
}

async function runTests(levels) {
  const results = {};
  
  for (const [level, shouldRun] of Object.entries(levels)) {
    const config = TEST_LEVELS[level];
    
    if (!shouldRun) {
      results[level] = { code: 0, skipped: true };
      continue;
    }
    
    log('info', `\n🧪 Running ${config.name}`);
    log('info', `   ${config.description}`);
    console.log('-'.repeat(60));
    
    const start = Date.now();
    const { code, stdout, stderr } = await runCommand(config.cmd, config.timeout);
    const duration = Date.now() - start;
    
    // Show output (last 20 lines)
    const lines = stdout.split('\n').slice(-20);
    console.log(lines.join('\n'));
    
    if (code !== 0) {
      log('error', `\n   Failed in ${duration}ms`);
      if (stderr) console.log(stderr.slice(-500));
    } else {
      log('success', `\n   Completed in ${duration}ms`);
    }
    
    results[level] = { code, duration };
  }
  
  return results;
}

main().catch(err => {
  log('error', `Fatal error: ${err.message}`);
  process.exit(1);
});
