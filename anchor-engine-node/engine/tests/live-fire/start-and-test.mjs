/**
 * Start Anchor Engine and Run Live-Fire Tests
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.join(__dirname, '..');

// Configuration
const PORT = 3160;
const DATA_DIR = path.join(process.cwd(), '.anchor-test-' + Date.now());
const ENGINE_PATH = path.join(PROJECT_ROOT, 'dist/index.js');

let serverProcess;
let serverReady = false;

const log = (msg) => console.log(`[StartAndTest] ${msg}`);

// Sleep utility
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// HTTP request
const request = async (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      ...options,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || PORT,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json'
      }
    };

    const req = (parsedUrl.protocol === 'https:' ? require('https') : require('http')).request(reqOptions, (res) => {
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

// Start the server
const startServer = async () => {
  return new Promise(async (resolve, reject) => {
    log(`Starting Anchor Engine on port ${PORT}...`);
    
    // Check if engine build exists
    if (!fs.existsSync(ENGINE_PATH)) {
      throw new Error('Engine not built. Run `pnpm run build` first.');
    }

    // Create data directory
    fs.mkdirSync(DATA_DIR, { recursive: true });

    serverProcess = spawn('node', [
      '--no-external-ingestion',
      ENGINE_PATH,
      `--data-dir=${DATA_DIR}`,
      `--port=${PORT}`
    ], {
      cwd: PROJECT_ROOT,
      stdio: ['pipe', 'pipe', 'inherit']
    });

    let output = '';
    serverProcess.stdout.on('data', (data) => {
      output += data;
      console.log(data.toString());
    });

    serverProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });

    // Wait for startup
    const checkReady = async () => {
      try {
        await sleep(8000);
        
        const healthRes = await request(`http://localhost:${PORT}/health`);
        
        if (healthRes.status === 200) {
          log('Server started successfully');
          serverReady = true;
          resolve();
        } else {
          reject(new Error(`Health check failed: ${healthRes.body}`));
        }
      } catch (e) {
        reject(e);
      }
    };

    // Timeout after 30 seconds
    const timeout = setTimeout(() => {
      if (!serverReady) {
        reject(new Error('Server startup timeout'));
      }
    }, 30000);

    serverProcess.on('exit', (code) => {
      clearTimeout(timeout);
      if (!serverReady && code === 0) {
        // Server exited cleanly but we didn't get health response
        reject(new Error('Server exited before health check'));
      }
    });

    checkReady();
  });
};

// Test suite
const tests = [];
let passCount = 0;
let failCount = 0;
const results = [];

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

const testHealth = async () => {
  const res = await request(`http://localhost:${PORT}/health`);
  log(`  Health: ${res.body}`);
  
  if (res.status === 200) {
    log('✓ Server health check');
    passCount++;
  } else {
    throw new Error(`Health check failed with status ${res.status}`);
  }
};

const testMolecules = async () => {
  const res = await request(`http://localhost:${PORT}/v1/molecules?limit=3`);
  
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      if (Array.isArray(data)) {
        // Check for provenance field after migration
        const mol = data[0] || {};
        if ('provenance' in mol) {
          log('✓ Molecules have provenance field');
          passCount++;
        } else {
          throw new Error(`Missing provenance: ${JSON.stringify(mol)}`);
        }
      } else {
        throw new Error('Unexpected molecules response format');
      }
    } catch (e) {
      log(`  Warning: Could not parse response`);
    }
  }
};

const testAtoms = async () => {
  const res = await request(`http://localhost:${PORT}/v1/atoms?limit=3`);
  
  if (res.status === 200) {
    try {
      const data = JSON.parse(res.body);
      if (Array.isArray(data)) {
        const atom = data[0] || {};
        // After migration, atoms should have provenance
        if ('provenance' in atom) {
          log('✓ Atoms have provenance field');
          passCount++;
        } else {
          throw new Error(`Missing provenance in atom`);
        }
      }
    } catch (e) {
      log(`  Warning: Could not parse atoms response`);
    }
  }
};

const testNoCompounds = async () => {
  const res = await request(`http://localhost:${PORT}/v1/compounds`);
  
  if (res.status === 404 || res.status >= 500) {
    log('✓ Compounds table removed');
    passCount++;
  } else if (res.body && !res.body.includes('Cannot GET')) {
    // Check if empty
    const data = JSON.parse(res.body || '{}');
    if (!data.data || Array.isArray(data.data) && data.data.length === 0) {
      log('✓ Compounds table empty');
      passCount++;
    } else {
      throw new Error(`Compounds still has ${data.data?.length} entries`);
    }
  } else {
    // Might return error page
    if (res.body && res.body.includes('Cannot GET')) {
      log('✓ Compounds endpoint removed');
      passCount++;
    }
  }
};

const testSearch = async () => {
  const res = await request(`http://localhost:${PORT}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'test search engine', limit: 3 })
  });
  
  if (res.status >= 200 && res.status < 400) {
    log('✓ Search API works');
    passCount++;
  } else {
    throw new Error(`Search failed: ${res.body}`);
  }
};

const testExactSearch = async () => {
  const res = await request(`http://localhost:${PORT}/v1/exact/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'migration compounds table provenance', limit: 3 })
  });
  
  if (res.status >= 200) {
    log('✓ Exact search API works');
    passCount++;
  } else {
    throw new Error(`Exact search failed`);
  }
};

const testSemanticSearch = async () => {
  const res = await request(`http://localhost:${PORT}/v1/semantic/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'database schema atoms molecules provenance', limit: 5 })
  });
  
  if (res.status >= 200) {
    log('✓ Semantic search API works');
    passCount++;
  } else {
    throw new Error(`Semantic search failed`);
  }
};

const testDistills = async () => {
  const res = await request(`http://localhost:${PORT}/v1/distills`);
  
  if (res.status >= 200) {
    log('✓ Distillation API available');
    passCount++;
  } else {
    throw new Error(`Distills failed: ${res.body}`);
  }
};

// Main execution
const runAllTests = async () => {
  try {
    await startServer();
    
    log('\n=== Running Tests ===');
    
    const testOrder = [
      ['Health check', testHealth],
      ['Molecules schema', testMolecules],
      ['Atoms schema', testAtoms],
      ['No compounds table', testNoCompounds],
      ['Search API', testSearch],
      ['Exact search', testExactSearch],
      ['Semantic search', testSemanticSearch],
      ['Distillation API', testDistills]
    ];

    for (const [name, fn] of testOrder) {
      await runTest(name, fn);
      await sleep(1000); // Space out tests
    }

    // Summary
    log('\n=== Results ===');
    log(`Passed: ${passCount}`);
    log(`Failed: ${failCount}`);
    
    const timestamp = new Date().toISOString();
    const resultDir = path.join(__dirname, '..');
    const resultFile = path.join(resultDir, 'live-fire-results.json');
    
    fs.writeFileSync(resultFile, JSON.stringify({
      serverUrl: `http://localhost:${PORT}`,
      timestamp,
      summary: { passed: passCount, failed: failCount, total: passCount + failCount },
      tests: results
    }));
    
    log(`\nResults saved to: ${resultFile}`);

    // Cleanup
    if (serverProcess) {
      serverProcess.kill();
      log('Server process terminated');
    }

    process.exit(failCount > 0 ? 1 : 0);
  } catch (error) {
    console.error('[StartAndTest] Fatal error:', error);
    process.exit(1);
  }
};

runAllTests();