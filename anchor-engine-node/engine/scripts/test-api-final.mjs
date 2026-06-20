// Final API test - validates working endpoints
import { readFileSync } from 'fs';

const settings = JSON.parse(readFileSync('../.anchor/user_settings.json', 'utf8'));
const API_KEY = settings.server.api_key;
const BASE = 'http://localhost:3160';

async function test(label, url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`, ...options.headers },
      ...options,
    });
    const body = await res.json();
    const ok = res.status >= 200 && res.status < 400;
    console.log(`${ok ? '✅' : '❌'} ${label} (${res.status})`);
    if (!ok) console.log('  ', body.error || JSON.stringify(body).slice(0, 100));
    return body;
  } catch (e) {
    console.log(`❌ ${label} (ERROR: ${e.message})`);
    return null;
  }
}

let pass = 0;
let fail = 0;

function check(label, condition, detail = '') {
  if (condition) { console.log(`  ✅ ${label}`); pass++; }
  else { console.log(`  ❌ ${label}${detail ? ': ' + detail : ''}`); fail++; }
}

console.log('=== Anchor Engine API Validation ===\n');

// 1. Health
const health = await test('Health', `${BASE}/health`);
check('Status healthy', health?.status === 'healthy');

// 2. Status
const status = await test('Status', `${BASE}/v1/system/status`);
check('System idle', status?.state === 'idle');

// 3. Ingest text
const ingest1 = await test('Ingest (text)', `${BASE}/v1/ingest`, {
  method: 'POST',
  body: JSON.stringify({ content: 'The Anchor Engine uses radial distillation and semantic block extraction.', source: 'test-1' }),
});
check('Ingest creates molecules', ingest1?.status === 'success', ingest1?.message);

// 4. Ingest code
const ingest2 = await test('Ingest (code)', `${BASE}/v1/ingest`, {
  method: 'POST',
  body: JSON.stringify({ content: 'const server = new Server({ name: "anchor-engine", capabilities: { tools: {} } });', source: 'test-code' }),
});
check('Code ingest works', ingest2?.status === 'success', ingest2?.message);

// 5. Search
const search = await test('Search', `${BASE}/v1/memory/search?stream=false`, {
  method: 'POST',
  body: JSON.stringify({ query: 'Anchor Engine radial distillation' }),
});
check('Search returns results', search?.metadata?.totalResults > 0, `found ${search?.metadata?.totalResults}`);

// 6. Distill (finds compounds, may not have disk files)
const distill = await test('Distill', `${BASE}/v1/memory/distill?stream=false`, {
  method: 'POST',
  body: JSON.stringify({
    mode: 'tag-based',
    seed: { query: 'Anchor Engine' },
    radius: 2000,
    output_format: 'json',
  }),
});
check('Distill returns output', distill?.output?.format !== undefined, distill?.output?.format);
// Note: compounds_processed may be 0 on fresh DB (compounds need disk files)
console.log(`  ℹ️  Compounds found: ${distill?.stats?.compounds_processed || 0} (requires disk files)`);

// 7. Explore
const explore = await test('Explore', `${BASE}/v1/memory/explore`, {
  method: 'POST',
  body: JSON.stringify({ seed: { query: 'Anchor Engine' }, depth: 2 }),
});
check('Explore returns nodes', explore?.stats?.nodes_count !== undefined || explore?.results?.length !== undefined);

console.log(`\n=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail > 0 ? 1 : 0);
