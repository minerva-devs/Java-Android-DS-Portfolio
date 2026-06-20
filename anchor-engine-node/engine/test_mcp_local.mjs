import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

async function testMCP() {
  const transport = new StdioClientTransport({
    command: 'node',
    args: ['C:/Users/rsbii/.qwenpaw/workspaces/P1/coding_projects/anchor-engine-node/engine/dist/mcp/server.js'],
  });

  const client = new Client(
    {
      name: 'test-client',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  console.log('Connecting to MCP server...');
  await client.connect(transport);
  console.log('Connected to MCP server successfully.');

  // Test 1: List tools
  const tools = await client.listTools();
  console.log('\n=== Available Tools ===');
  tools.tools.forEach(t => console.log(`- ${t.name}: ${t.description}`));

  // Test 2: anchor_status
  console.log('\n=== Testing anchor_status ===');
  try {
    const status = await client.callTool({
      name: 'anchor_status',
      arguments: {},
    });
    console.log('anchor_status result:', JSON.stringify(status, null, 2));
  } catch (e) {
    console.log('anchor_status error:', e.message);
  }

  // Test 3: anchor_health
  console.log('\n=== Testing anchor_health ===');
  try {
    const health = await client.callTool({
      name: 'anchor_health',
      arguments: {},
    });
    console.log('anchor_health result:', JSON.stringify(health, null, 2));
  } catch (e) {
    console.log('anchor_health error:', e.message);
  }

  // Test 4: anchor_density (prefix maps/queries)
  console.log('\n=== Testing anchor_density (full corpus) ===');
  try {
    const densityMap = await client.callTool({
      name: 'anchor_density',
      arguments: {}, // Omit term for full map
    });
    console.log('anchor_density (full corpus) result:', JSON.stringify(densityMap, null, 2));
  } catch (e) {
    console.log('anchor_density error:', e.message);
  }

  console.log('\n=== Testing anchor_density (term contract) ===');
  try {
    const densityTerm = await client.callTool({
      name: 'anchor_density',
      arguments: { term: 'contract' },
    });
    console.log('anchor_density (contract) result:', JSON.stringify(densityTerm, null, 2));
  } catch (e) {
    console.log('anchor_density error:', e.message);
  }

  // Test 5: anchor_search for distill: prefix query
  console.log('\n=== Testing anchor_search with "distill:" prefix ===');
  try {
    const searchDistill = await client.callTool({
      name: 'anchor_search',
      arguments: { query: 'distill:' },
    });
    console.log('anchor_search ("distill:") result:', JSON.stringify(searchDistill, null, 2));
  } catch (e) {
    console.log('anchor_search error:', e.message);
  }

  // Test 6: anchor_list_distills
  console.log('\n=== Testing anchor_list_distills ===');
  try {
    const listDistills = await client.callTool({
      name: 'anchor_list_distills',
      arguments: { limit: 5 },
    });
    console.log('anchor_list_distills result:', JSON.stringify(listDistills, null, 2));
  } catch (e) {
    console.log('anchor_list_distills error:', e.message);
  }

  try {
    await transport.close();
  } catch {}
  console.log('\nClosed transport successfully');
}

testMCP().catch(console.error);
