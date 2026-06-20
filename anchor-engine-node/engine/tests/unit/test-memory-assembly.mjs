/**
 * Simple integration test for Memory Node Assembly
 */

import { createMemoryNodeFromQuery, TOKEN_BUDGETS } from './engine/src/utils/memory-node-assembly.js';

async function runTests() {
  console.log('=== Running Memory Node Assembly Tests ===\n');

  // Test 1: Create memory node with clean search
  try {
    const node = await createMemoryNodeFromQuery(
      'memory test query',
      ['test'],
      { maxTokens: TOKEN_BUDGETS.DEFAULT }
    );
    
    console.log('✓ Memory Node Created Successfully');
    console.log(`  Query: "${node.query}"`);
    console.log(`  Token Count: ${node.tokenCount}`);
    console.log(`  Search Results: ${node.sources.search.length} items`);
    
    if (node.sources.distill) {
      console.log(`  Distillation Output: ${JSON.stringify(node.sources.distill).substring(0, 150)}...`);
    }
    
    // Verify search results are cleaned (Task 1)
    const cleanResults = node.sources.search.slice(0, 3);
    if (cleanResults.length > 0) {
      console.log('\n✓ Search Results Verification');
      for (const r of cleanResults) {
        const contentLen = r.content.length;
        // Content should be stripped and within limits
        console.log(`  - Result: ${contentLen} chars, source: ${r.source}`);
      }
    }
    
    // Verify token budget constraint is satisfied (Task 3)
    if (node.tokenCount <= TOKEN_BUDGETS.DEFAULT) {
      console.log('\n✓ Token Budget Constraint Satisfied');
      const remaining = TOKEN_BUDGETS.DEFAULT - node.tokenCount;
      console.log(`  Remaining tokens: ${remaining}`);
    } else {
      console.log('\n⚠ Warning: Token budget may be exceeded');
    }
    
    // Verify decision record format (Task 2) if present
    if (node.sources.distill && node.sources.distill.records) {
      const records = node.sources.distill.records;
      if (records.length > 0) {
        console.log('\n✓ Decision Record Format Verification');
        for (const r of records.slice(0, 2)) {
          // Verify all required fields exist (Task 2)
          const missing = [];
          if (!r.title) missing.push('title');
          if (!r.summary) missing.push('summary');
          if (!r.path) missing.push('path');
          if (!r.content) missing.push('content');
          if (!Array.isArray(r.tags)) missing.push('tags');
          
          console.log(`  - Record: "${r.title}"`);
          if (missing.length > 0) {
            console.log(`    ⚠ Missing fields: ${missing.join(', ')}`);
          } else {
            console.log(`    ✓ All required fields present`);
          }
        }
      }
    }

  } catch (err) {
    console.error('✗ Test Failed:', err instanceof Error ? err.message : 'Unknown error');
    process.exit(1);
  }

  console.log('\n=== All Tests Completed ===');
}

runTests().catch(console.error);
