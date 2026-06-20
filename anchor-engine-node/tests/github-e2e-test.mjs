#!/usr/bin/env node
/**
 * Anchor Engine — GitHub Module End-to-End Test
 * Standard 014: Operational Visibility + Search Algorithm Testing
 * 
 * Flow:
 *   1. Health check
 *   2. Ingest seed content
 *   3. Clone anchor-engine-node repo via GitHub API
 *   4. Start watchdog
 *   5. Run search queries (P0-P4 per Standard 014)
 *   6. Run distillation
 *   7. Save all results to .anchor/tests/
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://localhost:3160';
const OUTPUT_DIR = path.join(process.env.HOME || process.env.USERPROFILE, '.anchor', 'tests');
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-');
const RESULTS_FILE = path.join(OUTPUT_DIR, `github-e2e-${TIMESTAMP}.json`);

// Ensure output directory
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const results = {
  timestamp: new Date().toISOString(),
  steps: [],
  passed: 0,
  failed: 0,
};

async function step(name, fn) {
  const start = Date.now();
  try {
    const data = await fn();
    const duration = Date.now() - start;
    results.steps.push({ name, status: 'passed', duration_ms: duration, data });
    results.passed++;
    console.log(`✅ ${name} (${duration}ms)`);
    return data;
  } catch (e) {
    const duration = Date.now() - start;
    results.steps.push({ name, status: 'failed', duration_ms: duration, error: e.message });
    results.failed++;
    console.log(`❌ ${name}: ${e.message}`);
    return null;
  }
}

async function post(endpoint, body) {
  const res = await fetch(`${BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

async function get(endpoint) {
  const res = await fetch(`${BASE}${endpoint}`);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return text; }
}

// ── MAIN ──
console.log('⚓ Anchor Engine — GitHub E2E Test');
console.log(`   Output: ${RESULTS_FILE}\n`);

// Step 1: Health check
await step('Health Check', async () => {
  const r = await get('/health');
  if (r.status !== 'healthy') throw new Error(`Status: ${r.status}`);
  return r;
});

// Step 2: Ingest seed content so search has something to find
await step('Seed Ingestion', async () => {
  const r = await post('/v1/ingest', {
    content: '# Anchor Engine\n\nAnchor Engine is a deterministic semantic memory system using the STAR algorithm. It combines SimHash deduplication, temporal decay, and graph-based tag traversal for document density classification and retrieval.\n\n## Architecture\n\n- PGlite WASM database\n- Rust WASM modules for fingerprinting\n- Express.js API on port 3160\n- Pointer-only storage with mirrored_brain source of truth',
    source: 'e2e-test/seed.md',
    tags: ['#anchor', '#star', '#architecture', '#wasm', '#simhash'],
  });
  return { atoms: r.message, id: r.id };
});

// Step 3: Clone the anchor-engine-node repo
await step('GitHub Clone (anchor-engine-node)', async () => {
  const r = await post('/v1/github/repos', {
    url: 'https://github.com/RSBalchII/anchor-engine-node.git',
    include_history: false,
  });
  // Returns 202 Accepted — ingestion happens async
  return { status: r.status || 'accepted', id: r.id, message: r.message };
});

// Step 4: Wait for ingestion to settle, then check stats
await new Promise(r => setTimeout(r, 5000));
await step('Database Stats (post-clone)', async () => {
  const r = await get('/v1/stats');
  return r;
});

// Step 5: Start watchdog
await step('Watchdog Start', async () => {
  const r = await post('/v1/watchdog/start', {});
  return r;
});

// Step 6: Search queries (Standard 014 P0-P4)
const queries = [
  { name: 'P0-semantic', query: 'deterministic semantic memory retrieval architecture' },
  { name: 'P1-tag', query: '#star #simhash #wasm' },
  { name: 'P2-byte-offset', query: 'SimHash deduplication' },
  { name: 'P3-fts', query: 'anchor' },
];

for (const q of queries) {
  await step(`Search: ${q.name}`, async () => {
    const r = await post('/v1/memory/search', { query: q.query });
    // Parse SSE stream — take first data line
    const lines = r.split('\n').filter(l => l.startsWith('data: '));
    const parsed = lines.map(l => {
      try { return JSON.parse(l.slice(6)); } catch { return null; }
    }).filter(Boolean);
    const meta = parsed.find(p => p.type === 'metadata');
    return {
      query: q.query,
      totalResults: meta?.totalResults || 0,
      strategy: meta?.strategy,
      durationMs: meta?.durationMs,
    };
  });
}

// Step 7: Distillation
await step('Distillation', async () => {
  const r = await post('/v1/memory/distill', {
    radius: 3,
    max_molecules: 20,
    timeout_seconds: 60,
  });
  return {
    status: r.status,
    records: r.records?.length || r.decision_records?.length || 0,
    compression: r.compression_ratio,
    id: r.id,
  };
});

// Step 8: List GitHub repos
await step('GitHub Repos List', async () => {
  const r = await get('/v1/github/repos');
  return Array.isArray(r) ? { count: r.length, repos: r.map(x => x.owner + '/' + x.repo) } : r;
});

// ── SAVE RESULTS ──
fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
console.log(`\n📄 Results saved: ${RESULTS_FILE}`);
console.log(`   Passed: ${results.passed} | Failed: ${results.failed}`);

if (results.failed > 0) {
  console.log('\n❌ FAILURES:');
  results.steps.filter(s => s.status === 'failed').forEach(s => {
    console.log(`   - ${s.name}: ${s.error}`);
  });
  process.exit(1);
} else {
  console.log('\n✅ ALL TESTS PASSED');
  process.exit(0);
}
