// Quick API test script for Anchor Engine
import { readFileSync } from 'fs';

const settings = JSON.parse(readFileSync('../user_settings.json', 'utf8'));
const API_KEY = settings.server.api_key;
const BASE = 'http://localhost:3160';

async function test(label, url, options = {}) {
  try {
    const res = await fetch(url, {
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}`, ...options.headers },
      ...options,
    });
    const body = await res.text();
    console.log(`\n=== ${label} (${res.status}) ===`);
    console.log(body);
    return body;
  } catch (e) {
    console.log(`\n=== ${label} (ERROR) ===`);
    console.log(e.message);
  }
}

// 1. Health check (no auth needed)
await test('Health Check', `${BASE}/health`);

// 2. System status (auth required)
await test('System Status', `${BASE}/v1/system/status`);

// 3. Ingest a test file
await test('Ingest Test File', `${BASE}/v1/ingest`, {
  method: 'POST',
  body: JSON.stringify({ content: 'This is test content about the Anchor Engine MCP server. It has concepts about dual-write distill flow and centralized data architecture.', source: 'test-session', type: 'test' }),
});

// 4. Search for ingested content
await test('Search Test', `${BASE}/v1/memory/search?stream=false`, {
  method: 'POST',
  body: JSON.stringify({ query: 'Anchor Engine MCP server' }),
});

// 5. List paths
await test('List Paths', `${BASE}/v1/system/paths`);

// 6. Distill
await test('Distill', `${BASE}/v1/memory/distill?stream=false`, {
  method: 'POST',
  body: JSON.stringify({
    seed: { query: 'Anchor Engine' },
    radius: 3,
    output_format: 'yaml',
  }),
});

// 7. Ingest local MCP server source code (no download needed)
await test('Ingest Local MCP Source', `${BASE}/v1/ingest`, {
  method: 'POST',
  body: JSON.stringify({
    content: 'const server = new Server({ name: "anchor-engine", version: "5.0.0" }, { capabilities: { tools: {} } });\nserver.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));\nserver.setRequestHandler(CallToolRequestSchema, async (request) => { const { name, arguments: args } = request.params; switch(name) { case "anchor_search": return { content: [{ type: "text", text: JSON.stringify(result) }] }; case "anchor_distill": return { content: [{ type: "text", text: JSON.stringify(result) }] }; } });',
    source: 'github:RSBalchII/anchor-engine-node/mcp-server/index.ts',
    type: 'code',
  }),
});

// 7b. Register GitHub repo to test Worker-based sync
console.log('\n=== Registering GitHub repo for Worker-based sync ===');
const ghRes = await fetch(`${BASE}/v1/github/repos`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({
    url: 'https://github.com/RSBalchII/anchor-engine-node.git',
    include_history: false,
    run_analysis: false,
  }),
});
const ghData = await ghRes.json();
console.log('Response:', JSON.stringify(ghData, null, 2));

// 8. Wait briefly for ingestion
await new Promise(r => setTimeout(r, 1000));
console.log('\n✅ Local ingestion complete\n');

// 9. Search for ingested content
await test('Search MCP Code', `${BASE}/v1/memory/search?stream=false`, {
  method: 'POST',
  body: JSON.stringify({ query: 'anchor-engine MCP server SetRequestHandler' }),
});

// 10. Distill the ingested code (matching UI's working format)
console.log('\n=== Distill (UI tag-based mode) ===');
const distillResult = await fetch(`${BASE}/v1/memory/distill?stream=false`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
  body: JSON.stringify({
    mode: 'tag-based',
    seed: { query: 'anchor-engine MCP server' },
    radius: 2000,
    output_format: 'json',
  }),
}).then(r => r.json());
console.log('Distill stats:', JSON.stringify(distillResult.stats, null, 2));
console.log('Output path:', distillResult.output?.path);
console.log('Inflated content count:', distillResult.inflated_content?.length || 0);
console.log('Records count:', distillResult.records?.length || 0);
console.log('Full result keys:', Object.keys(distillResult));

if (distillResult.inflated_content && distillResult.inflated_content.length > 0) {
  console.log('\nFirst 3 inflated items:');
  distillResult.inflated_content.slice(0, 3).forEach((item, i) => {
    console.log(`  [${i}] source: ${item.source}, content length: ${item.content?.length || 0}`);
    console.log(`      tags: ${item.tags?.slice(0, 5).join(', ')}`);
  });
}
