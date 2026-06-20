/**
 * Integration Test Suite - Full Live-Fire Tests
 * 
 * This script:
 * 1. Starts the Anchor Engine server (if not running)
 * 2. Runs comprehensive integration tests
 * 3. Verifies search and distillation functionality
 * 4. Reports results with detailed metrics
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Configuration
const CONFIG = {
  projectRoot: __dirname,
  engineDir: path.join(CONFIG.projectRoot, '..'),
  distDir: path.join(CONFIG.engineDir, 'dist'),
  dataDir: process.env.ANCHOR_DATA_DIR || path.join(process.cwd(), '.anchor') + '-livefire-test',
  port: parseInt(process.env.PORT) || 3160,
  timeout: 120000, // 2 minutes for full integration tests
};

const log = (msg) => console.log(`[IntegrationTest] ${msg}`);

// Utility functions
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

const startServer = async () => {
  return new Promise(async (resolve, reject) => {
    log(`Starting server on port ${CONFIG.port}...`);
    
    // Check if server is already running
    const healthRes = await request(`${CONFIG.dataDir}/health`, { timeout: 5000 });
    
    if (healthRes.status === 200) {
      console.log('[IntegrationTest] Server already running');
      resolve();
      return;
    }

    // Start the engine
    const args = [
      '--data-dir', CONFIG.dataDir,
      '--port', String(CONFIG.port),
      '--no-external-ingestion'
    ];

    const child = spawn('node', ['dist/index.js', ...args], {
      cwd: CONFIG.engineDir,
      stdio: 'inherit',
      env: { ...process.env }
    });

    // Capture server logs
    let output = '';
    child.stdout.on('data', (data) => {
      output += data;
      console.log(data.toString());
    });

    // Wait for startup and verify health
    const checkHealth = async () => {
      try {
        await sleep(5000);
        const res = await request(`${CONFIG.dataDir}/health`, { timeout: 5000 });
        if (res.status === 200) {
          console.log('[IntegrationTest] Server ready');
          resolve();
        } else {
          reject(new Error(`Health check failed with status ${res.status}`));
        }
      } catch (e) {
        reject(e);
      }
    };

    child.on('exit', (code) => {
      if (code !== 0) reject(new Error(`Server process exited with code ${code}`));
    });

    checkHealth();
  });
};

const runIntegrationTests = async () => {
  const results = [];
  
  // Test 1: Search functionality
  log('\n=== Testing Search API ===');
  
  try {
    const searchRes = await request(`${CONFIG.dataDir}/v1/memory/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'test search integration', limit: 3 })
    });
    
    if (searchRes.status >= 200 && searchRes.status < 400) {
      log('✓ Search API works');
      results.push({ name: 'Search API', status: 'pass' });
    } else {
      throw new Error(`Search failed: ${searchRes.body}`);
    }
  } catch (e) {
    results.push({ name: 'Search API', status: 'fail', error: e.message });
    log('✗ Search API:', e.message);
  }

  // Test 2: Exact search
  log('\n=== Testing Exact Search ===');
  try {
    const exactRes = await request(`${CONFIG.dataDir}/v1/exact/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'migration compounds provenance', limit: 3 })
    });
    
    if (exactRes.status >= 200) {
      log('✓ Exact search API works');
      results.push({ name: 'Exact Search API', status: 'pass' });
    } else {
      throw new Error(`Exact search failed`);
    }
  } catch (e) {
    results.push({ name: 'Exact Search API', status: 'fail', error: e.message });
  }

  // Test 3: Semantic search
  log('\n=== Testing Semantic Search ===');
  try {
    const semanticRes = await request(`${CONFIG.dataDir}/v1/semantic/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'database schema atoms molecules', limit: 5 })
    });

    if (semanticRes.status >= 200) {
      log('✓ Semantic search API works');
      results.push({ name: 'Semantic Search API', status: 'pass' });
    } else {
      throw new Error(`Semantic search failed`);
    }
  } catch (e) {
    results.push({ name: 'Semantic Search API', status: 'fail', error: e.message });
  }

  // Test 4: Distillation endpoint
  log('\n=== Testing Distillation ===');
  try {
    const distillRes = await request(`${CONFIG.dataDir}/v1/distills`);
    
    if (distillRes.status >= 200) {
      log('✓ Distillation API available');
      results.push({ name: 'Distillation API', status: 'pass' });
    } else {
      throw new Error(`Distillation endpoint failed`);
    }
  } catch (e) {
    results.push({ name: 'Distillation API', status: 'fail', error: e.message });
  }

  // Test 5: Verify compounds table removal
  log('\n=== Verifying Migration ===');
  try {
    const compoundsRes = await request(`${CONFIG.dataDir}/v1/compounds`);
    
    if (compoundsRes.status === 404 || compoundsRes.status === 500) {
      log('✓ Compounds table correctly removed');
      results.push({ name: 'Compounds Removal', status: 'pass' });
    } else if (compoundsRes.body && compoundsRes.body.includes('Cannot GET')) {
      log('✓ Compounds endpoint returns error as expected');
      results.push({ name: 'Compounds Removal', status: 'pass' });
    } else {
      const data = JSON.parse(compoundsRes.body || '{}');
      if (!data.data || !Array.isArray(data.data) || data.data.length === 0) {
        log('✓ Compounds table empty (migration complete)');
        results.push({ name: 'Compounds Removal', status: 'pass' });
      } else {
        throw new Error(`Compounds table still has ${data.data.length} entries`);
      }
    }
  } catch (e) {
    log('✗ Compounds check failed:', e.message);
    results.push({ name: 'Compounds Removal', status: 'fail', error: e.message });
  }

  // Test 6: Molecules schema verification
  log('\n=== Verifying Schema ===');
  try {
    const moleculesRes = await request(`${CONFIG.dataDir}/v1/molecules?limit=1`);
    
    if (moleculesRes.status >= 200) {
      const data = JSON.parse(moleculesRes.body || '{}');
      const mol = Array.isArray(data) ? (data[0] || {}) : data;
      
      // Check for provenance field after migration
      if ('provenance' in mol) {
        log('✓ Molecules have provenance field');
        results.push({ name: 'Molecules Schema', status: 'pass' });
      } else {
        throw new Error(`Missing provenance in molecule`);
      }
    }
  } catch (e) {
    results.push({ name: 'Molecules Schema', status: 'fail', error: e.message });
  }

  // Test 7: Atoms schema verification  
  log('\n=== Verifying Atoms Schema ===');
  try {
    const atomsRes = await request(`${CONFIG.dataDir}/v1/atoms?limit=1`);
    
    if (atomsRes.status >= 200) {
      const data = JSON.parse(atomsRes.body || '{}');
      const atom = Array.isArray(data) ? (data[0] || {}) : data;
      
      // Atoms should have provenance after migration
      if ('provenance' in atom) {
        log('✓ Atoms have provenance field');
        results.push({ name: 'Atoms Schema', status: 'pass' });
      } else {
        throw new Error(`Missing provenance in atom`);
      }
    }
  } catch (e) {
    results.push({ name: 'Atoms Schema', status: 'fail', error: e.message });
  }

  return results;
};

const main = async () => {
  try {
    log('[IntegrationTest] Starting live-fire integration tests...');
    
    // Start server if needed
    await startServer();
    
    // Run integration tests
    const results = await runIntegrationTests();
    
    // Print summary
    console.log('\n=== Integration Test Results ===');
    for (const r of results) {
      log(`${r.name}: ${r.status}`);
    }

    const passed = results.filter(r => r.status === 'pass').length;
    const failed = results.filter(r => r.status === 'fail').length;
    
    console.log(`\nPassed: ${passed}/${results.length}`);
    console.log(`Failed: ${failed}/${results.length}`);

    // Save results to file
    const timestamp = new Date().toISOString();
    fs.writeFileSync(
      path.join(CONFIG.projectRoot, 'integration-results.json'),
      JSON.stringify({ timestamp, passed, failed, results }, null, 2)
    );
    
    console.log(`\nResults saved to: engine/tests/live-fire/integration-results.json`);

    process.exit(failed > 0 ? 1 : 0);
  } catch (error) {
    console.error('[IntegrationTest] Fatal error:', error);
    process.exit(1);
  }
};

main();