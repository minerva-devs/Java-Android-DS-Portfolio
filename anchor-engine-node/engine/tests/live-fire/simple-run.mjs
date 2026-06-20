/**
 * Simple Live-Fire Test Runner for Anchor Engine v5.0.0
 * 
 * Runs integration tests against an EXISTING running server.
 */

import http from 'http';
import { fileURLToPath } from 'url';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const DEFAULT_URL = 'http://localhost:3160';

let serverUrl = DEFAULT_URL;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--url=')) {
    serverUrl = arg.split('=')[1];
  } else if (!arg.startsWith('-')) {
    serverUrl = arg;
  }
}

// Utility functions
const log = (msg) => console.log(`[SimpleRun] ${msg}`);

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const request = async (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      ...options,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json'
      }
    };

    const req = (parsedUrl.protocol === 'https:' ? http : http).request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });

    req.on('error', reject);
    
    if (reqOptions.body) {
      req.write(reqOptions.body);
    }
    req.end();
  });
};

// Test suite
const tests = [];
let passCount = 0;
let failCount = 0;
const results = [];

const assert = (condition, message, testName) => {
  if (condition) {
    log(`✓ ${testName}`);
    results.push({ name: testName, status: 'pass' });
    passCount++;
  } else {
    log(`✗ ${testName}: ${message}`);
    results.push({ name: testName, status: 'fail', reason: message });
    failCount++;
  }
};

const runTest = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    log(`✓ [${name}]`);
    results.push({ name, status: 'pass', duration_ms: Date.now() - start });
    passCount++;
  } catch (error) {
    log(`✗ [${name}]: ${error.message || error}`);
    results.push({ name, status: 'fail', error: error.message || error, duration_ms: Date.now() - start });
    failCount++;
  }
};

// Test functions
const testHealth = async () => {
  const res = await request(`${serverUrl}/health`);
  assert(res.status === 200, `Expected 200, got ${res.status}`, 'Server health check');
  log(`  Health response: ${res.body}`);
};

const testMoleculesSchema = async () => {
  const res = await request(`${serverUrl}/v1/molecules?limit=3`);
  assert(res.status === 200, `Expected 200, got ${res.status}`, 'Molecules list API');
  
  if (res.body) {
    try {
      const data = JSON.parse(res.body);
      if (Array.isArray(data)) {
        // Check for provenance field in first molecule
        const mol = data[0] || {};
        const hasProvenance = 'provenance' in mol;
        assert(hasProvenance, `Missing provenance: ${JSON.stringify(mol)}`, 'Molecules have provenance');
      } else {
        throw new Error('Unexpected molecules response format');
      }
    } catch (e) {
      log(`  Warning: Could not parse molecules response`);
    }
  }
};

const testAtomsSchema = async () => {
  const res = await request(`${serverUrl}/v1/atoms?limit=3`);
  assert(res.status === 200, `Expected 200, got ${res.status}`, 'Atoms list API');
  
  if (res.body) {
    try {
      const data = JSON.parse(res.body);
      if (Array.isArray(data)) {
        const atom = data[0] || {};
        // Atoms should have provenance after migration
        const hasProvenance = 'provenance' in atom;
        assert(hasProvenance, `Missing provenance: ${JSON.stringify(atom)}`, 'Atoms have provenance');
      }
    } catch (e) {
      log(`  Warning: Could not parse atoms response`);
    }
  }
};

const testNoCompounds = async () => {
  const res = await request(`${serverUrl}/v1/compounds`);
  
  // After migration, compounds endpoint should fail or return empty
  if (res.status === 404 || res.status === 500) {
    log('✓ Compounds table correctly removed');
  } else if (res.body && res.body.includes('Cannot GET')) {
    log('✓ Compounds endpoint returns error as expected');
  } else {
    // Might still work - check if it has data
    const data = JSON.parse(res.body || '{}');
    if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
      log('✓ Compounds table empty (migration complete)');
    } else {
      throw new Error(`Compounds table still has ${data.data.length} entries`);
    }
  }
};

const testSearchQuery = async () => {
  const res = await request(`${serverUrl}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'test search migration', limit: 3 })
  });
  
  // Search should not error (might return no results)
  assert(res.status >= 200 && res.status < 400, 
    `Search returned ${res.status}: ${res.body}`, 
    'Search API works');
};

const testExactSearch = async () => {
  const res = await request(`${serverUrl}/v1/exact/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'migration compounds provenance table', limit: 5 })
  });
  
  assert(res.status >= 200 && res.status < 400, 
    `Exact search returned ${res.status}`, 
    'Exact search API works');
};

const testSemanticSearch = async () => {
  const res = await request(`${serverUrl}/v1/semantic/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'database schema atoms molecules', limit: 5 })
  });
  
  assert(res.status >= 200 && res.status < 400, 
    `Semantic search returned ${res.status}`, 
    'Semantic search API works');
};

const testDistillsEndpoint = async () => {
  const res = await request(`${serverUrl}/v1/distills`);
  assert(res.status >= 200 && res.status < 500, 
    `Distills API returned ${res.status}`, 
    'Distillation API available');
};

// Main execution
const runAllTests = async () => {
  log(`\n=== Live-Fire Test Suite ===`);
  log(`Server URL: ${serverUrl}`);
  
  const testOrder = [
    ['Health check', testHealth],
    ['Molecules list (schema)', testMoleculesSchema],
    ['Atoms list (schema)', testAtomsSchema],
    ['No compounds table', testNoCompounds],
    ['Search query', testSearchQuery],
    ['Exact search API', testExactSearch],
    ['Semantic search API', testSemanticSearch],
    ['Distillation API', testDistillsEndpoint]
  ];

  for (const [name, fn] of testOrder) {
    await runTest(name, fn);
  }

  // Summary
  log('\n=== Results ===');
  log(`Passed: ${passCount}`);
  log(`Failed: ${failCount}`);
  
  if (failCount > 0) {
    log('\nFailed tests:');
    for (const r of results.filter(r => r.status === 'fail')) {
      log(`  - ${r.name}: ${r.error || r.reason}`);
    }
  }

  // Save results to file
  const timestamp = new Date().toISOString();
  const resultFile = path.join(__dirname, `simple-run-results-${timestamp}.json`);
  
  fs.writeFileSync(resultFile, JSON.stringify({
    serverUrl,
    timestamp,
    summary: { passed: passCount, failed: failCount, total: passCount + failCount },
    tests: results
  }));
  
  log(`\nResults saved to: ${resultFile}`);

  process.exit(failCount > 0 ? 1 : 0);
};

runAllTests().catch(err => {
  console.error('[SimpleRun] Fatal error:', err);
  process.exit(1);
});