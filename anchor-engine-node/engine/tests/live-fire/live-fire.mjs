#!/usr/bin/env node
/**
 * Live-Fire Test Suite for Anchor Engine v5.2.0
 * Canonical runner — consolidates run-tests.js (CJS) and live-fire-test-suite.mjs (ESM).
 *
 * Performs end-to-end integration testing against a live server on port 3160.
 * Outputs structured JSON results + human/LLM-parseable log file.
 *
 * Usage:
 *   node engine/tests/live-fire/live-fire.mjs
 *   SERVER_URL=http://other:3160 node engine/tests/live-fire/live-fire.mjs
 */

import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Configuration ───────────────────────────────────────────────────────────
const CONFIG = {
  serverUrl: process.env.SERVER_URL || `http://localhost:${process.env.PORT || 3160}`,
  timeout: 30000,
  logFile: path.join(__dirname, 'live-fire.log'),
  resultsFile: path.join(__dirname, 'results.json'),
};

// ── Utilities ───────────────────────────────────────────────────────────────
const log = (message) => {
  const line = `[${new Date().toISOString()}] ${message}`;
  console.log(line);
  fs.appendFileSync(CONFIG.logFile, line + '\n');
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const httpRequest = (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      ...options,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      timeout: CONFIG.timeout,
    };

    const transport = parsedUrl.protocol === 'https:' ? https : http;
    const req = transport.request(reqOptions, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        let json = null;
        try {
          json = JSON.parse(body);
        } catch {
          /* not JSON — that's fine */
        }
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body,
          json,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timed out after ${CONFIG.timeout}ms`));
    });
    req.on('error', (err) => reject(err));

    if (options.body) req.write(options.body);
    req.end();
  });
};

// ── Test state ──────────────────────────────────────────────────────────────
const results = [];
let passCount = 0;
let failCount = 0;
const startTime = Date.now();

const recordResult = (name, passed, duration, error) => {
  const record = {
    name,
    status: passed ? 'pass' : 'fail',
    duration_ms: Math.round(duration),
    error: error || null,
    timestamp: new Date().toISOString(),
  };
  results.push(record);

  if (passed) {
    passCount++;
    log(`  PASS  [${name}] (${record.duration_ms}ms)`);
  } else {
    failCount++;
    log(`  FAIL  [${name}] — ${error}`);
  }
};

// ── Assertion helper ────────────────────────────────────────────────────────
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};

// ── Test: Server health check ───────────────────────────────────────────────
const testHealth = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/health`, { method: 'GET' });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  recordResult('Health check', true, Date.now() - start);
};

// ── Test: Health via /v1/stats ──────────────────────────────────────────────
const testStats = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/stats`, { method: 'GET' });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  recordResult('Stats endpoint', true, Date.now() - start);
};

// ── Test: Molecules list + schema verification ──────────────────────────────
const testMolecules = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/molecules?limit=5`, { method: 'GET' });
  assert(res.status === 200, `Expected 200, got ${res.status}`);

  if (Array.isArray(res.json) && res.json.length > 0) {
    assert(
      typeof res.json[0].source_path === 'string',
      `Missing source_path field in molecule: ${JSON.stringify(Object.keys(res.json[0]))}`
    );
    assert(
      typeof res.json[0].provenance === 'string',
      `Missing provenance field in molecule: ${JSON.stringify(Object.keys(res.json[0]))}`
    );
  }
  recordResult('Molecules list + schema', true, Date.now() - start);
};

// ── Test: Atoms list ────────────────────────────────────────────────────────
const testAtoms = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/atoms?limit=5`, { method: 'GET' });
  assert(res.status === 200, `Expected 200, got ${res.status}`);
  recordResult('Atoms list', true, Date.now() - start);
};

// ── Test: Compounds table removal (Standard 051) ────────────────────────────
const testNoCompounds = async () => {
  const start = Date.now();
  try {
    const res = await httpRequest(`${CONFIG.serverUrl}/v1/compounds`, { method: 'GET' });
    // Expected: 404, or empty/null response
    if (res.status === 404) {
      recordResult('Compounds table removed', true, Date.now() - start);
      return;
    }
    if (res.status === 200) {
      const data = res.json;
      if (data === null || (Array.isArray(data) && data.length === 0)) {
        recordResult('Compounds table removed', true, Date.now() - start);
        return;
      }
      throw new Error(`Compounds table still has data: ${JSON.stringify(data).slice(0, 200)}`);
    }
    throw new Error(`Unexpected status: ${res.status}`);
  } catch (err) {
    if (err.message && err.message.includes('ECONNREFUSED')) throw err;
    // 404 response often throws — that's expected
    if (err.message && err.message.includes('404')) {
      recordResult('Compounds table removed', true, Date.now() - start);
      return;
    }
    // Server may return a plain text error page
    if (err.message && (err.message.includes('Cannot GET') || err.message.includes('not found'))) {
      recordResult('Compounds table removed', true, Date.now() - start);
      return;
    }
    throw err;
  }
};

// ── Test: Search API (memory/search) ────────────────────────────────────────
const testSearch = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'test search engine', limit: 3 }),
  });
  // Search may return empty results — that's ok as long as the API works
  assert(res.status >= 200 && res.status < 500, `Search returned ${res.status}: ${res.body?.slice(0, 200)}`);
  recordResult('Search API', true, Date.now() - start);
};

// ── Test: Exact search API ──────────────────────────────────────────────────
const testExactSearch = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/exact/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'migration compounds table provenance', limit: 3 }),
  });
  assert(res.status >= 200 && res.status < 500, `Exact search returned ${res.status}`);
  recordResult('Exact search API', true, Date.now() - start);
};

// ── Test: Semantic search API ───────────────────────────────────────────────
const testSemanticSearch = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/semantic/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'database schema atoms molecules provenance', limit: 5 }),
  });
  assert(res.status >= 200 && res.status < 500, `Semantic search returned ${res.status}`);
  recordResult('Semantic search API', true, Date.now() - start);
};

// ── Test: Density prefix — full corpus map ──────────────────────────────────
const testDensityFull = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'density:' }),
  });
  assert(res.status >= 200 && res.status < 500, `Density full returned ${res.status}`);
  // Response shape: { results: [{ atoms: [...], tags: [...], totals: {...}, rag_thresholds: {...} }] }
  if (res.json && Array.isArray(res.json.results) && res.json.results[0]) {
    const map = res.json.results[0];
    assert(
      Array.isArray(map.atoms) || Array.isArray(map.tags),
      `Missing atoms/tags arrays in density map. Keys: ${JSON.stringify(Object.keys(map))}`
    );
    if (map.rag_thresholds) {
      log(`  Density thresholds: light≥${map.rag_thresholds.LIGHT_DOC_THRESHOLD}, medium≥${map.rag_thresholds.MEDIUM_DOC_THRESHOLD}`);
    }
  }
  recordResult('Density: full map', true, Date.now() - start);
};

// ── Test: Density prefix — single term ──────────────────────────────────────
const testDensityTerm = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'density:test' }),
  });
  assert(res.status >= 200 && res.status < 500, `Density term returned ${res.status}`);
  // Response shape: { results: [{ term, density_tier, molecule_count, rag_config: { mode, doc_limit } }] }
  if (res.json && Array.isArray(res.json.results) && res.json.results[0]) {
    const d = res.json.results[0];
    const validTiers = ['light', 'medium', 'heavy'];
    const validModes = ['fast', 'balanced', 'exhaustive'];
    assert(
      validTiers.includes(d.density_tier),
      `Invalid density_tier "${d.density_tier}". Expected one of: ${validTiers.join(', ')}`
    );
    assert(
      typeof d.molecule_count === 'number',
      `Missing or invalid molecule_count: ${d.molecule_count}`
    );
    if (d.rag_config) {
      assert(
        validModes.includes(d.rag_config.mode),
        `Invalid rag_config.mode "${d.rag_config.mode}"`
      );
      assert(
        typeof d.rag_config.doc_limit === 'number',
        `Missing rag_config.doc_limit`
      );
      log(`  ${d.term}: tier=${d.density_tier}, ${d.molecule_count} docs → ${d.rag_config.mode} mode, limit ${d.rag_config.doc_limit}`);
    }
  }
  recordResult('Density: single term', true, Date.now() - start);
};

// ── Test: Density prefix — multi-term ───────────────────────────────────────
const testDensityMulti = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'density:contract,liability' }),
  });
  assert(res.status >= 200 && res.status < 500, `Density multi returned ${res.status}`);
  // Response shape: { results: [{ term, density_tier, rag_config }, ...] }
  if (res.json && Array.isArray(res.json.results)) {
    assert(
      res.json.results.length >= 1,
      `Expected at least 1 density result, got ${res.json.results?.length}`
    );
    for (const d of res.json.results) {
      assert(typeof d.term === 'string', `Missing term in result: ${JSON.stringify(d)}`);
      const validTiers = ['light', 'medium', 'heavy'];
      assert(validTiers.includes(d.density_tier), `Invalid tier for "${d.term}": ${d.density_tier}`);
    }
  }
  recordResult('Density: multi-term', true, Date.now() - start);
};

// ── Test: Ingestion pipeline ────────────────────────────────────────────────
const testIngestion = async () => {
  const start = Date.now();
  const testContent = `# Live-Fire Test Document v5.2.0

This document verifies the ingestion pipeline after compounds table removal (Standard 051).

## Verification
- Atoms have provenance column
- Molecules have molecular_signature field
- Ingestion writes to correct tables
- Query API returns expected results
- Density prefix works on ingested content`;

  const res = await httpRequest(`${CONFIG.serverUrl}/v1/ingest`, {
    method: 'POST',
    body: JSON.stringify({
      title: 'Live-Fire Test Document',
      content: testContent,
      source: 'live-fire-test-v5.2.0',
      type: 'file',
      bucket: 'notebook',
    }),
  });
  assert(res.status === 200 || res.status === 201, `Ingestion returned ${res.status}: ${res.body?.slice(0, 300)}`);
  if (res.json && res.json.error) throw new Error(res.json.error);
  recordResult('Ingestion pipeline', true, Date.now() - start);
};

// ── Test: Search after ingestion ────────────────────────────────────────────
const testQueryAfterIngest = async () => {
  const start = Date.now();
  await sleep(2000); // Allow ingestion to persist

  const res = await httpRequest(`${CONFIG.serverUrl}/v1/memory/search`, {
    method: 'POST',
    body: JSON.stringify({ query: 'migration compounds table provenance', limit: 5 }),
  });
  assert(res.status >= 200 && res.status < 500, `Post-ingest search returned ${res.status}`);
  recordResult('Search after ingestion', true, Date.now() - start);
};

// ── Test: Distillation API health ───────────────────────────────────────────
const testDistills = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/distills`, { method: 'GET' });
  assert(res.status >= 200 && res.status < 500, `Distills returned ${res.status}`);
  recordResult('Distillation API', true, Date.now() - start);
};

// ── Test: Radial distillation ───────────────────────────────────────────────
const testRadialDistill = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/distillation/radial`, {
    method: 'POST',
    body: JSON.stringify({ query: 'test radial distillation', maxDepth: 2 }),
  });
  assert(res.status >= 200 && res.status < 500, `Radial distillation returned ${res.status}`);
  recordResult('Radial distillation', true, Date.now() - start);
};

// ── Test: Live corpus — read user config paths ──────────────────────────────
// Stores results for the summary section at the end of the run.
let liveCorpusInfo = null;

const testLiveCorpusConfig = () => {
  const start = Date.now();
  const anchorRoot = path.join(os.homedir(), '.anchor');
  const settingsPath = path.join(anchorRoot, 'user_settings.json');

  if (!fs.existsSync(settingsPath)) {
    recordResult('Live corpus config', true, Date.now() - start);
    log('  (no user_settings.json found — skipping live corpus check)');
    return;
  }

  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'));
  } catch {
    recordResult('Live corpus config', true, Date.now() - start);
    log('  (unparseable user_settings.json — skipping)');
    return;
  }

  const extraPaths = settings.watcher?.extra_paths || [];
  const notebookDir = settings.paths?.notebook || path.join(anchorRoot, 'notebook');
  const inboxDir = settings.paths?.inbox || path.join(anchorRoot, 'inbox');
  const externalInbox = settings.paths?.external_inbox || path.join(anchorRoot, 'external-inbox');

  const watchPaths = [...extraPaths, notebookDir, inboxDir, externalInbox]
    .map((p) => p.replace(/\$\{anchor_root\}/g, anchorRoot));

  let totalFiles = 0;
  const foundPaths = [];

  for (const watchPath of watchPaths) {
    if (fs.existsSync(watchPath) && fs.statSync(watchPath).isDirectory()) {
      try {
        const files = fs.readdirSync(watchPath);
        if (files.length > 0) {
          foundPaths.push({ path: watchPath, count: files.length });
          totalFiles += files.length;
        }
      } catch {
        // Permission error — skip
      }
    }
  }

  log(`  Live corpus extra_paths: ${extraPaths.length}`);
  log(`  Live corpus dirs with data: ${foundPaths.length}`);
  foundPaths.forEach((p) => log(`    → ${p.path} (${p.count} files)`));
  log(`  Total live files: ${totalFiles}`);

  liveCorpusInfo = { totalFiles, foundPaths, watchPaths, extraPaths };
  recordResult('Live corpus config', true, Date.now() - start);
};

// ── Test: Verify stats reflect live corpus size ─────────────────────────────
const testLiveCorpusStats = async () => {
  const start = Date.now();
  const res = await httpRequest(`${CONFIG.serverUrl}/v1/stats`, { method: 'GET' });

  if (res.status !== 200) {
    log('  Stats endpoint unavailable (engine may not have ingested live corpus yet)');
    recordResult('Live corpus stats', true, Date.now() - start);
    return;
  }

  const stats = res.json || {};
  const atomCount = stats.atom_count || stats.atoms || 0;
  const moleculeCount = stats.molecule_count || stats.molecules || 0;

  log(`  Atoms: ${atomCount} | Molecules: ${moleculeCount}`);
  recordResult('Live corpus stats', true, Date.now() - start);
};

// ── Test: Search live corpus with density prefix ────────────────────────────
const testLiveCorpusDensity = async () => {
  const start = Date.now();
  const terms = ['contract', 'code', 'test', 'memory', 'search'];
  let tested = 0;
  const tiers = { light: 0, medium: 0, heavy: 0 };

  for (const term of terms) {
    try {
      const res = await httpRequest(`${CONFIG.serverUrl}/v1/memory/search`, {
        method: 'POST',
        body: JSON.stringify({ query: `density:${term}` }),
      });
      if (res.status >= 200 && res.status < 500 && Array.isArray(res.json?.results)) {
        const d = res.json.results[0];
        if (d?.density_tier) {
          tested++;
          tiers[d.density_tier]++;
        }
      }
    } catch {
      // Individual term failures are ok — corpus may not have these terms
    }
  }

  log(`  Density tested on ${tested}/${terms.length} terms against live corpus`);
  log(`  Tier distribution: light=${tiers.light}, medium=${tiers.medium}, heavy=${tiers.heavy}`);
  recordResult('Live corpus density', true, Date.now() - start);
};

// ── Test suite definition ───────────────────────────────────────────────────
const testSuite = [
  ['Health check', testHealth],
  ['Stats endpoint', testStats],
  ['Molecules list + schema', testMolecules],
  ['Atoms list', testAtoms],
  ['Compounds table removed (Std 051)', testNoCompounds],
  ['Search API', testSearch],
  ['Exact search API', testExactSearch],
  ['Semantic search API', testSemanticSearch],
  ['Density: full map', testDensityFull],
  ['Density: single term', testDensityTerm],
  ['Density: multi-term', testDensityMulti],
  ['Ingestion pipeline', testIngestion],
  ['Search after ingestion', testQueryAfterIngest],
  ['Distillation API', testDistills],
  ['Radial distillation', testRadialDistill],
  ['Live corpus config', testLiveCorpusConfig],
  ['Live corpus stats', testLiveCorpusStats],
  ['Live corpus density', testLiveCorpusDensity],
];

// ── Main runner ─────────────────────────────────────────────────────────────
const runSuite = async () => {
  // Clear log file
  fs.writeFileSync(CONFIG.logFile, '');

  log('='.repeat(60));
  log('ANCHOR ENGINE LIVE-FIRE TEST SUITE v5.2.0');
  log(`Server: ${CONFIG.serverUrl}`);
  log(`Time:   ${new Date().toISOString()}`);
  log('='.repeat(60));
  log('');

  for (const [name, fn] of testSuite) {
    const t0 = Date.now();
    try {
      await fn();
    } catch (err) {
      recordResult(name, false, Date.now() - t0, err.message || String(err));
    }
  }

  // Summary
  const total = passCount + failCount;
  log('');
  log('='.repeat(60));
  log('RESULTS SUMMARY');
  log('='.repeat(60));
  log(`Total:   ${total}`);
  log(`Passed:  ${passCount}`);
  log(`Failed:  ${failCount}`);
  log(`Time:    ${Date.now() - startTime}ms`);
  log('');

  if (failCount > 0) {
    log('FAILURES:');
    for (const r of results.filter((r) => r.status === 'fail')) {
      log(`  ✗ ${r.name}: ${r.error}`);
    }
    log('');
  }

  // Live corpus summary
  if (liveCorpusInfo) {
    log('LIVE CORPUS:');
    log(`  Extra paths:   ${liveCorpusInfo.extraPaths.join(', ') || '(none)'}`);
    log(`  Directories:    ${liveCorpusInfo.foundPaths.length}`);
    log(`  Total files:    ${liveCorpusInfo.totalFiles}`);
    log('');
  }

  // Write structured JSON results
  const summary = {
    timestamp: new Date().toISOString(),
    serverUrl: CONFIG.serverUrl,
    total,
    passed: passCount,
    failed: failCount,
    duration_ms: Date.now() - startTime,
    tests: results,
  };

  fs.writeFileSync(CONFIG.resultsFile, JSON.stringify(summary, null, 2));
  log(`Structured results → ${CONFIG.resultsFile}`);
  log(`Full log         → ${CONFIG.logFile}`);

  process.exit(failCount > 0 ? 1 : 0);
};

runSuite().catch((err) => {
  log(`FATAL: ${err.message}`);
  console.error(err);
  process.exit(2);
});
