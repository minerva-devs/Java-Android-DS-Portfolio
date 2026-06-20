/**
 * Live Corpus Benchmark Suite for Anchor Engine
 * Runs against the live engine on port 3160. Measures real-world performance
 * with the user's ingested corpus (224K+ atoms, 222K+ molecules).
 *
 * Usage: node tests/benchmarks/live-corpus-bench.mjs
 */

const http = await import('node:http');

const BASE = 'http://localhost:3160';
const ITERATIONS = 3;

const bench = async (name, fn) => {
  const times = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const t0 = Date.now();
    try { await fn(); } catch (e) { times.push(-1); continue; }
    times.push(Date.now() - t0);
  }
  const valid = times.filter(t => t >= 0);
  if (valid.length === 0) { console.log(`  ${name}: FAILED`); return; }
  const avg = valid.reduce((a,b) => a+b, 0) / valid.length;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  console.log(`  ${name}: avg=${avg.toFixed(0)}ms  min=${min}ms  max=${max}ms  (n=${valid.length})`);
};

const post = (path, body) => new Promise((resolve, reject) => {
  const u = new URL(BASE + path);
  const req = http.request({ hostname: u.hostname, port: u.port, path: u.pathname, method: 'POST', headers: { 'Content-Type': 'application/json' }, timeout: 60000 }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  });
  req.on('error', reject);
  req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  req.write(JSON.stringify(body));
  req.end();
});

const get = (path) => new Promise((resolve, reject) => {
  const u = new URL(BASE + path);
  http.get({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, timeout: 30000 }, res => {
    let data = '';
    res.on('data', c => data += c);
    res.on('end', () => resolve({ status: res.statusCode, body: data }));
  }).on('error', reject);
});

// ── Warmup ─────────────────────────────────────────────────────
console.log('Warming up...');
await get('/health');
console.log();

// ── Health ─────────────────────────────────────────────────────
console.log('── Health ──');
await bench('GET /health', () => get('/health'));
await bench('GET /v1/stats', () => get('/v1/stats'));
console.log();

// ── Search ─────────────────────────────────────────────────────
console.log('── Search (standard) ──');
await bench('"resume"',     () => post('/v1/memory/search?stream=false', { query: 'resume', limit: 10 }));
await bench('"contract"',   () => post('/v1/memory/search?stream=false', { query: 'contract', limit: 10 }));
await bench('"architecture"', () => post('/v1/memory/search?stream=false', { query: 'architecture', limit: 10 }));
console.log();

// ── Search (max-recall) ────────────────────────────────────────
console.log('── Search (max-recall) ──');
await bench('"code" max-recall', () => post('/v1/memory/search?stream=false', { query: 'code', strategy: 'max-recall', max_chars: 65536, limit: 50 }));
console.log();

// ── Density ────────────────────────────────────────────────────
console.log('── Density Prefix ──');
await bench('density:',         () => post('/v1/memory/search?stream=false', { query: 'density:' }));
await bench('density:contract', () => post('/v1/memory/search?stream=false', { query: 'density:contract' }));
console.log();

// ── Distillation (small) ───────────────────────────────────────
console.log('── Distillation (100 molecules) ──');
await bench('distill max=100', () => post('/v1/distillation/radial', {
  seed: { query: '' }, radius: 2000, output_format: 'decision-records',
  normalization: 'aggressive', max_molecules: 100,
}));
console.log();

// ── Endpoints ──────────────────────────────────────────────────
console.log('── Endpoints ──');
await bench('GET /v1/atoms?limit=5',      () => get('/v1/atoms?limit=5'));
await bench('GET /v1/molecules?limit=5',  () => get('/v1/molecules?limit=5'));
await bench('GET /v1/distills',           () => get('/v1/distills'));
console.log();

// ── Memory ─────────────────────────────────────────────────────
const mem = process.memoryUsage();
console.log('── Memory ──');
console.log(`  RSS: ${(mem.rss / 1024 / 1024).toFixed(0)}MB`);
console.log(`  Heap: ${(mem.heapUsed / 1024 / 1024).toFixed(0)}MB / ${(mem.heapTotal / 1024 / 1024).toFixed(0)}MB`);
console.log();

console.log('Done.');
