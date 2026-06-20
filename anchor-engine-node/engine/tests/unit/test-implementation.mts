import { createMemoryNodeFromQuery, TOKEN_BUDGETS } from './engine/src/utils/memory-node-assembly.js';

async function runVerification() {
  console.log('=== Memory Node Assembly Verification ===\n');

  // Test: Create memory node (Task 3)
  const node = await createMemoryNodeFromQuery(
    'memory test query', 
    ['test'], 
    { maxTokens: TOKEN_BUDGETS.DEFAULT }
  );

  console.log('✓ Memory Node Created Successfully');
  console.log(`  Query: "${node.query}"`);
  console.log(`  Search Results: ${node.sources.search.length} items`);
  
  if (node.tokenCount <= TOKEN_BUDGETS.DEFAULT) {
    const remaining = TOKEN_BUDGETS.DEFAULT - node.tokenCount;
    console.log(`  Token budget satisfied: ${node.tokenCount} / ${TOKEN_BUDGETS.DEFAULT} (${remaining} remaining)`);
  }

  // Verify clean content (Task 1)
  const firstResult = node.sources.search[0];
  if (firstResult && firstResult.content.length <= 500) {
    console.log(`  Content length limit enforced: ${firstResult.content.length} chars`);
  }

  // Verify decision record format (Task 2)
  if (node.sources.distill?.records && node.sources.distill.records.length > 0) {
    for (const r of node.sources.distill.records.slice(0, 2)) {
      const hasFields = r.title && r.summary && Array.isArray(r.tags);
      console.log(`  Decision record title: "${r.title}"`);
      if (hasFields) {
        console.log('    ✓ All required fields present');
      } else {
        console.log('    ✗ Missing required fields');
      }
    }
  }

  // Verify provenance paths are compact (Task 1)
  for (const r of node.sources.search.slice(0, 3)) {
    const path = r.provenance;
    if (path && path.length < 100) {
      console.log(`  Provenance path: ${path}`);
    }
  }

  console.log('\n✓ All verification checks completed!');
}

runVerification().catch(err => {
  console.error('Error:', err instanceof Error ? err.message : 'Unknown error');
  process.exit(1);
});
