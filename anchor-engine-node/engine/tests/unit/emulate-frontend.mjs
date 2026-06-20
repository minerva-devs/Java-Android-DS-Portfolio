#!/usr/bin/env node
/**
 * Frontend Activity Emulator
 * 
 * Simulates common frontend UI interactions:
 *   - Search with filters
 *   - Text ingestion
 *   - File upload simulation
 *   - Pagination
 *   - Result viewing
 * 
 * Usage:
 *   node tests/emulate-frontend.mjs           # Run all scenarios
 *   node tests/emulate-frontend.mjs --search  # Search only
 *   node tests/emulate-frontend.mjs --ingest  # Ingest only
 *   node tests/emulate-frontend.mjs --stress  # Stress test
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SETTINGS_PATH = join(process.cwd(), 'user_settings.json');
const COLORS = {
  G: '\x1b[32m', R: '\x1b[31m', Y: '\x1b[33m', C: '\x1b[36m', NC: '\x1b[0m'
};

function log(msg, color = 'C') {
  console.log(`${COLORS[color] || ''}${msg}${COLORS.NC}`);
}

class FrontendEmulator {
  constructor() {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    this.baseUrl = `http://localhost:${settings.server?.port || 3160}`;
    this.apiKey = settings.server?.api_key || '';
    this.stats = { requests: 0, errors: 0, totalLatency: 0 };
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    const start = Date.now();
    
    try {
      const res = await fetch(url, {
        ...options,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
      
      const latency = Date.now() - start;
      this.stats.requests++;
      this.stats.totalLatency += latency;
      
      const data = res.ok ? await res.json() : null;
      return { ok: res.ok, status: res.status, data, latency };
    } catch (err) {
      this.stats.errors++;
      return { ok: false, error: err.message, latency: Date.now() - start };
    }
  }

  // Scenario: User searches for content
  async scenarioSearch(query, options = {}) {
    log(`\n🔍 Search: "${query}"`, 'Y');
    
    const { maxResults = 10, buckets = [] } = options;
    const res = await this.request('/v1/search', {
      method: 'POST',
      body: JSON.stringify({ query, max_results: maxResults, buckets })
    });
    
    if (res.ok) {
      log(`  ✅ Found ${res.data.results?.length || 0} results (${res.latency}ms)`, 'G');
      return res.data.results;
    } else {
      log(`  ❌ Failed: ${res.status || res.error}`, 'R');
      return [];
    }
  }

  // Scenario: User ingests text
  async scenarioIngestText(content, options = {}) {
    const preview = content.slice(0, 50).replace(/\n/g, ' ');
    log(`\n📝 Ingest: "${preview}..."`, 'Y');
    
    const { bucket = 'external-inbox', metadata = {} } = options;
    const res = await this.request('/v1/ingest/text', {
      method: 'POST',
      body: JSON.stringify({ content, bucket, metadata })
    });
    
    if (res.ok) {
      log(`  ✅ Ingested as ${res.data.compound_id} (${res.latency}ms)`, 'G');
      return res.data.compound_id;
    } else {
      log(`  ❌ Failed: ${res.status || res.error}`, 'R');
      return null;
    }
  }

  // Scenario: User views file with pagination
  async scenarioViewFile(path, startLine = 1, endLine = 50) {
    log(`\n📄 View: ${path} (lines ${startLine}-${endLine})`, 'Y');
    
    const res = await this.request('/v1/file', {
      method: 'POST',
      body: JSON.stringify({ path, start_line: startLine, end_line: endLine })
    });
    
    if (res.ok) {
      const lines = res.data.content?.split('\n').length || 0;
      log(`  ✅ Loaded ${lines} lines (${res.latency}ms)`, 'G');
      return res.data;
    } else {
      log(`  ❌ Failed: ${res.status || res.error}`, 'R');
      return null;
    }
  }

  // Scenario: User runs graph illumination
  async scenarioIlluminate(seed, depth = 2) {
    log(`\n💡 Illuminate: "${seed}" (depth=${depth})`, 'Y');
    
    const res = await this.request('/v1/illuminate', {
      method: 'POST',
      body: JSON.stringify({ seed, depth, max_nodes: 50 })
    });
    
    if (res.ok) {
      const nodes = res.data.nodes?.length || 0;
      const edges = res.data.edges?.length || 0;
      log(`  ✅ Found ${nodes} nodes, ${edges} edges (${res.latency}ms)`, 'G');
      return res.data;
    } else {
      log(`  ❌ Failed: ${res.status || res.error}`, 'R');
      return null;
    }
  }

  // Scenario: User checks stats
  async scenarioStats() {
    log(`\n📊 Stats`, 'Y');
    
    const res = await this.request('/v1/stats');
    
    if (res.ok) {
      const { atoms, molecules, compounds } = res.data;
      log(`  ✅ Atoms: ${atoms?.toLocaleString()}, Molecules: ${molecules?.toLocaleString()}, Compounds: ${compounds?.toLocaleString()}`, 'G');
      return res.data;
    } else {
      log(`  ❌ Failed: ${res.status || res.error}`, 'R');
      return null;
    }
  }

  // Full user workflow
  async runFullWorkflow() {
    log('\n' + '='.repeat(60), 'C');
    log('FRONTEND WORKFLOW EMULATION', 'C');
    log('='.repeat(60), 'C');
    
    // 1. Check stats
    await this.scenarioStats();
    
    // 2. Search for something
    const results = await this.scenarioSearch('anchor engine memory', { maxResults: 5 });
    
    // 3. If no results, ingest some content
    if (results.length === 0) {
      log('\n  (No results found, ingesting test content...)', 'Y');
      await this.scenarioIngestText(`
Anchor Engine is a deterministic semantic memory system for LLMs.
It uses graph traversal instead of vector search for explainable results.
The STAR algorithm walks the knowledge graph to find related concepts.
Memory is organized into compounds, molecules, and atoms.
Atoms contain tags that represent semantic concepts.
      `.trim(), { metadata: { source: 'frontend-emulator' } });
      
      // Wait for indexing
      log('  Waiting 2s for indexing...', 'Y');
      await new Promise(r => setTimeout(r, 2000));
      
      // Search again
      await this.scenarioSearch('graph traversal', { maxResults: 5 });
    }
    
    // 4. View a file if available
    if (results.length > 0 && results[0].path) {
      await this.scenarioViewFile(results[0].path, 1, 30);
    }
    
    // 5. Run illumination
    await this.scenarioIlluminate('memory', 2);
    
    this.printStats();
  }

  // Stress test
  async runStressTest(concurrent = 10) {
    log('\n' + '='.repeat(60), 'C');
    log(`STRESS TEST: ${concurrent} concurrent searches`, 'C');
    log('='.repeat(60), 'C');
    
    const queries = Array(concurrent).fill(0).map((_, i) => `stress test query ${i}`);
    const start = Date.now();
    
    const results = await Promise.all(
      queries.map(q => this.scenarioSearch(q, { maxResults: 5 }))
    );
    
    const totalTime = Date.now() - start;
    const avgTime = totalTime / concurrent;
    
    log(`\n✅ All ${concurrent} requests completed`, 'G');
    log(`   Total: ${totalTime}ms, Avg: ${avgTime.toFixed(1)}ms`, 'G');
    
    this.printStats();
  }

  printStats() {
    const avgLatency = this.stats.requests > 0 
      ? (this.stats.totalLatency / this.stats.requests).toFixed(1) 
      : 0;
    
    log('\n' + '='.repeat(60), 'C');
    log('SESSION STATS', 'C');
    log('='.repeat(60), 'C');
    log(`  Requests: ${this.stats.requests}`, 'C');
    log(`  Errors: ${this.stats.errors}`, this.stats.errors > 0 ? 'R' : 'G');
    log(`  Avg Latency: ${avgLatency}ms`, 'C');
    log('='.repeat(60), 'C');
  }
}

// Main
const emulator = new FrontendEmulator();
const args = process.argv.slice(2);

if (args.includes('--stress')) {
  const concurrent = parseInt(args.find(a => a.startsWith('--concurrent='))?.split('=')[1]) || 10;
  emulator.runStressTest(concurrent);
} else if (args.includes('--search')) {
  const query = args.find(a => !a.startsWith('--')) || 'test query';
  emulator.scenarioSearch(query).then(() => emulator.printStats());
} else if (args.includes('--ingest')) {
  emulator.scenarioIngestText('Test content from emulator', { metadata: { test: true } })
    .then(() => emulator.printStats());
} else {
  emulator.runFullWorkflow();
}
