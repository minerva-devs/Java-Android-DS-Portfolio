#!/usr/bin/env node
/**
 * MCP Server Activity Emulator
 * 
 * Simulates MCP (Model Context Protocol) client interactions:
 *   - Tool discovery
 *   - Tool invocation (search, ingest, illuminate, distill)
 *   - Resource access
 *   - Error handling
 * 
 * Usage:
 *   node tests/emulate-mcp.mjs              # Run all MCP scenarios
 *   node tests/emulate-mcp.mjs --tools      # List available tools
 *   node tests/emulate-mcp.mjs --search     # Test search tool
 *   node tests/emulate-mcp.mjs --ingest     # Test ingest tool
 *   node tests/emulate-mcp.mjs --workflow   # Full agent workflow
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const SETTINGS_PATH = join(process.cwd(), 'user_settings.json');
const COLORS = {
  G: '\x1b[32m', R: '\x1b[31m', Y: '\x1b[33m', C: '\x1b[36m', M: '\x1b[35m', NC: '\x1b[0m'
};

function log(msg, color = 'C') {
  console.log(`${COLORS[color] || ''}${msg}${COLORS.NC}`);
}

class MCPEmulator {
  constructor() {
    const settings = JSON.parse(readFileSync(SETTINGS_PATH, 'utf8'));
    this.baseUrl = `http://localhost:${settings.server?.port || 3160}`;
    this.apiKey = settings.server?.api_key || '';
    this.stats = { calls: 0, errors: 0, totalLatency: 0 };
    
    // MCP Tool definitions (mirrors mcp-server/index.ts)
    this.tools = {
      search: {
        name: 'anchor_search',
        description: 'Search the Anchor Engine knowledge graph',
        parameters: {
          query: 'string (required)',
          max_results: 'number (optional, default: 10)',
          buckets: 'string[] (optional)',
          strategy: 'string (optional: standard|max-recall)'
        }
      },
      ingest_text: {
        name: 'anchor_ingest_text',
        description: 'Ingest text content into Anchor Engine',
        parameters: {
          content: 'string (required)',
          bucket: 'string (optional: inbox|external-inbox)',
          metadata: 'object (optional)'
        }
      },
      illuminate: {
        name: 'anchor_illuminate',
        description: 'Explore graph connections from a seed concept',
        parameters: {
          seed: 'string (required)',
          depth: 'number (optional, default: 2)',
          max_nodes: 'number (optional, default: 50)'
        }
      },
      distill: {
        name: 'anchor_distill',
        description: 'Create a distilled knowledge summary',
        parameters: {
          seed: 'string (required)',
          radius: 'number (optional, default: 2)',
          output_format: 'string (optional: yaml|json)'
        }
      },
      read_file: {
        name: 'anchor_read_file',
        description: 'Read a file with line range support',
        parameters: {
          path: 'string (required)',
          start_line: 'number (optional)',
          end_line: 'number (optional)'
        }
      },
      get_stats: {
        name: 'anchor_get_stats',
        description: 'Get engine statistics',
        parameters: {}
      }
    };
  }

  async callTool(toolName, params) {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Unknown tool: ${toolName}`);
    }
    
    log(`\n🔧 MCP Tool: ${tool.name}`, 'M');
    log(`   Params: ${JSON.stringify(params).slice(0, 100)}...`, 'C');
    
    const start = Date.now();
    this.stats.calls++;
    
    try {
      // Map tool to API endpoint
      const endpoint = this.mapToolToEndpoint(toolName);
      const body = this.mapParamsToBody(toolName, params);
      
      const res = await fetch(`${this.baseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
      
      const latency = Date.now() - start;
      this.stats.totalLatency += latency;
      
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`HTTP ${res.status}: ${error}`);
      }
      
      const data = await res.json();
      log(`   ✅ Success (${latency}ms)`, 'G');
      return { success: true, data, latency };
      
    } catch (err) {
      this.stats.errors++;
      log(`   ❌ Error: ${err.message}`, 'R');
      return { success: false, error: err.message };
    }
  }

  mapToolToEndpoint(toolName) {
    const mapping = {
      search: '/v1/search',
      ingest_text: '/v1/ingest/text',
      illuminate: '/v1/illuminate',
      distill: '/v1/distill',
      read_file: '/v1/file',
      get_stats: '/v1/stats'
    };
    return mapping[toolName] || `/v1/${toolName}`;
  }

  mapParamsToBody(toolName, params) {
    // Parameter name mapping (MCP -> API)
    const mappings = {
      search: { max_results: 'maxResults' },
      ingest_text: {},
      read_file: { start_line: 'startLine', end_line: 'endLine' }
    };
    
    const mapping = mappings[toolName] || {};
    const body = {};
    
    for (const [key, value] of Object.entries(params)) {
      body[mapping[key] || key] = value;
    }
    
    return body;
  }

  // Scenario: Agent discovers available tools
  async scenarioToolDiscovery() {
    log('\n' + '='.repeat(60), 'M');
    log('MCP TOOL DISCOVERY', 'M');
    log('='.repeat(60), 'M');
    
    for (const [key, tool] of Object.entries(this.tools)) {
      log(`\n📋 ${tool.name}`, 'Y');
      log(`   ${tool.description}`, 'C');
      log(`   Parameters:`, 'C');
      for (const [param, type] of Object.entries(tool.parameters)) {
        log(`     - ${param}: ${type}`, 'C');
      }
    }
  }

  // Scenario: Agent searches for context
  async scenarioAgentSearch(query) {
    log('\n🤖 Agent: "I need to search for context..."', 'Y');
    
    const result = await this.callTool('search', {
      query,
      max_results: 10,
      strategy: 'standard'
    });
    
    if (result.success) {
      const results = result.data.results || [];
      log(`   Found ${results.length} relevant documents`, 'G');
      
      // Simulate agent reading top results
      for (let i = 0; i < Math.min(3, results.length); i++) {
        const doc = results[i];
        log(`   [${i + 1}] ${doc.path || 'unknown'} (score: ${doc.score?.toFixed(3)})`, 'C');
      }
    }
    
    return result;
  }

  // Scenario: Agent ingests new information
  async scenarioAgentIngest(content, metadata = {}) {
    log('\n🤖 Agent: "I should save this information..."', 'Y');
    
    const result = await this.callTool('ingest_text', {
      content,
      bucket: 'external-inbox',
      metadata: { ...metadata, source: 'mcp-agent' }
    });
    
    if (result.success) {
      log(`   Saved as compound: ${result.data.compound_id}`, 'G');
    }
    
    return result;
  }

  // Scenario: Agent explores graph connections
  async scenarioAgentExplore(seed) {
    log(`\n🤖 Agent: "Let me explore connections to '${seed}'..."`, 'Y');
    
    const result = await this.callTool('illuminate', {
      seed,
      depth: 2,
      max_nodes: 30
    });
    
    if (result.success) {
      const { nodes, edges } = result.data;
      log(`   Discovered ${nodes?.length || 0} connected concepts`, 'G');
      
      // Show top connected nodes
      const topNodes = (nodes || []).slice(0, 5);
      for (const node of topNodes) {
        log(`   - ${node.label} (${node.type})`, 'C');
      }
    }
    
    return result;
  }

  // Scenario: Agent creates knowledge summary
  async scenarioAgentDistill(seed) {
    log(`\n🤖 Agent: "Let me distill knowledge about '${seed}'..."`, 'Y');
    
    const result = await this.callTool('distill', {
      seed,
      radius: 2,
      output_format: 'yaml'
    });
    
    if (result.success) {
      log(`   Distilled to: ${result.data.output_path}`, 'G');
      log(`   Compression: ${result.data.stats?.compression_ratio?.toFixed(1)}x`, 'G');
    }
    
    return result;
  }

  // Full agent workflow
  async runAgentWorkflow() {
    log('\n' + '='.repeat(60), 'M');
    log('MCP AGENT WORKFLOW EMULATION', 'M');
    log('='.repeat(60), 'M');
    
    // 1. Get stats
    await this.callTool('get_stats', {});
    
    // 2. Search for existing knowledge
    const searchResult = await this.scenarioAgentSearch('semantic memory graph');
    
    // 3. If limited results, ingest new knowledge
    if (!searchResult.success || (searchResult.data.results?.length || 0) < 3) {
      await this.scenarioAgentIngest(`
Semantic memory systems store knowledge in a graph structure.
Nodes represent concepts, edges represent relationships.
Graph traversal algorithms can find relevant context efficiently.
Deterministic search provides explainable results.
      `.trim(), { topic: 'knowledge-graphs' });
      
      // Wait for indexing
      log('   Waiting for indexing...', 'Y');
      await new Promise(r => setTimeout(r, 2000));
    }
    
    // 4. Explore connections
    await this.scenarioAgentExplore('graph');
    
    // 5. Create summary
    await this.scenarioAgentDistill('semantic memory');
    
    this.printStats();
  }

  // Error scenario testing
  async runErrorScenarios() {
    log('\n' + '='.repeat(60), 'M');
    log('ERROR HANDLING TESTS', 'M');
    log('='.repeat(60), 'M');
    
    // Test 1: Invalid tool parameters
    log('\n🧪 Test: Missing required parameter', 'Y');
    const r1 = await this.callTool('search', {}); // Missing query
    log(`   Expected: Error | Got: ${r1.success ? 'Success' : 'Error'}`, r1.success ? 'R' : 'G');
    
    // Test 2: Invalid bucket
    log('\n🧪 Test: Invalid bucket name', 'Y');
    const r2 = await this.callTool('ingest_text', {
      content: 'test',
      bucket: 'invalid-bucket'
    });
    log(`   Result: ${r2.success ? 'Accepted' : 'Rejected'}`, r2.success ? 'Y' : 'G');
    
    // Test 3: Empty query
    log('\n🧪 Test: Empty search query', 'Y');
    const r3 = await this.callTool('search', { query: '' });
    log(`   Result: ${r3.success ? 'Accepted' : 'Rejected'}`, r3.success ? 'Y' : 'G');
  }

  printStats() {
    const avgLatency = this.stats.calls > 0 
      ? (this.stats.totalLatency / this.stats.calls).toFixed(1) 
      : 0;
    
    log('\n' + '='.repeat(60), 'M');
    log('MCP SESSION STATS', 'M');
    log('='.repeat(60), 'M');
    log(`  Tool Calls: ${this.stats.calls}`, 'C');
    log(`  Errors: ${this.stats.errors}`, this.stats.errors > 0 ? 'R' : 'G');
    log(`  Avg Latency: ${avgLatency}ms`, 'C');
    log('='.repeat(60), 'M');
  }
}

// Main
const emulator = new MCPEmulator();
const args = process.argv.slice(2);

if (args.includes('--tools')) {
  emulator.scenarioToolDiscovery();
} else if (args.includes('--search')) {
  const query = args.find(a => !a.startsWith('--')) || 'test query';
  emulator.scenarioAgentSearch(query).then(() => emulator.printStats());
} else if (args.includes('--ingest')) {
  emulator.scenarioAgentIngest('Test content from MCP emulator', { test: true })
    .then(() => emulator.printStats());
} else if (args.includes('--errors')) {
  emulator.runErrorScenarios().then(() => emulator.printStats());
} else {
  emulator.runAgentWorkflow();
}
