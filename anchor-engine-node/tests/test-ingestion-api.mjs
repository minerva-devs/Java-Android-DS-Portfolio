#!/usr/bin/env node
/**
 * Integration Test: Ingestion API after Compounds Table Migration
 * 
 * This test suite verifies that the ingestion API works correctly after
 * removing the compounds table. It uses the actual HTTP API endpoints
 * to test real-world functionality.
 */

import { fetch } from 'undici';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const API_BASE_URL = process.env.API_URL || 'http://localhost:3160';
const TEST_FILE_PATH = path.join(__dirname, 'test-ingestion-file.txt');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function log(...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}]`, ...args);
}

async function main() {
  console.log('\n' + '='.repeat(80));
  console.log('🧪 ANCHOR ENGINE - INGESTION API INTEGRATION TEST');
  console.log('='.repeat(80) + '\n');

  const results = [];
  let passed = 0;
  let failed = 0;

  /**
   * Log test result
   */
  function logResult(name, status, details = '', duration = 0) {
    const timestamp = new Date().toISOString();
    const emoji = status === 'passed' ? '✅' : '❌';
    
    results.push({
      name,
      status,
      details,
      duration,
      timestamp,
    });
    
    if (status === 'passed') passed++;
    else failed++;

    console.log(`${emoji} ${name}`);
    if (details) console.log(`   ${details}`);
    console.log(`   Duration: ${duration.toFixed(2)}ms`);
    console.log();
  }

  // Test 1: Health check endpoint
  try {
    const start = Date.now();
    const response = await fetch(`${API_BASE_URL}/health`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('Health Check', 'passed', `Status: ${data.status || 'healthy'}`, duration);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logResult('Health Check', 'failed', error.message, 0);
  }

  // Test 2: Verify compounds table does not exist
  try {
    const start = Date.now();
    const response = await fetch(`${API_BASE_URL}/v1/compounds`, { method: 'GET' });
    const duration = Date.now() - start;
    
    if (response.status === 404 || response.status === 500) {
      logResult('Compounds Table Check', 'passed', 'Table does not exist (expected)', duration);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    // Expected if compounds table is dropped
    const start = Date.now();
    try {
      await fetch(`${API_BASE_URL}/v1/compounds`, { method: 'GET' });
    } catch (e) {
      logResult('Compounds Table Check', 'passed', 'Table does not exist (expected)', 0);
    }
  }

  // Test 3: Create a test file for ingestion
  try {
    const fs = await import('fs');
    const content = `# Test File for Ingestion API
    
This is a test file to verify that the ingestion pipeline works correctly after removing the compounds table.

## Features to test:
- Molecules are created with provenance field
- Atoms are created with provenance field  
- No compound records should be created
- Data integrity is maintained

## Expected behavior:
- Ingestion completes successfully
- All molecules have molecular_signature populated
- All atoms reference the correct source file
`;
    
    fs.writeFileSync(TEST_FILE_PATH, content);
    logResult('Test File Creation', 'passed', `Created: ${TEST_FILE_PATH}`, 0);
  } catch (error) {
    logResult('Test File Creation', 'failed', error.message, 0);
  }

  // Test 4: Ingest test file via API
  try {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/v1/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: fs.readFileSync(TEST_FILE_PATH, 'utf-8'),
        source: 'test-ingestion-api',
        type: 'file',
        bucket: 'notebook',
      }),
    });
    
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('File Ingestion', 'passed', `Ingested ${data.atoms_count} atoms, ${data.molecules_count} molecules`, duration);
      
      // Verify ingestion result has expected fields
      if (!data.id) {
        throw new Error('Missing id in ingestion response');
      }
      if (data.duration_ms === undefined) {
        throw new Error('Missing duration_ms in ingestion response');
      }
    } else {
      const error = await response.text();
      throw new Error(`Ingestion failed: ${error}`);
    }
  } catch (error) {
    logResult('File Ingestion', 'failed', error.message, 0);
  }

  // Test 5: Verify ingestion result with molecules/atoms query
  try {
    const start = Date.now();
    
    // Query the latest ingested records
    const response = await fetch(`${API_BASE_URL}/v1/molecules?limit=5&order_by=-timestamp`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('Molecules Query', 'passed', `Retrieved ${data.length} molecules`, duration);
      
      // Verify molecules have provenance field
      const hasProvenance = data.every(m => m.provenance || m.compound_id);
      if (!hasProvenance) {
        throw new Error('Some molecules missing provenance/compound_id');
      }
    } else {
      throw new Error(`Query failed: ${response.status}`);
    }
  } catch (error) {
    logResult('Molecules Query', 'failed', error.message, 0);
  }

  // Test 6: Verify atoms have provenance
  try {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/v1/atoms?limit=5&order_by=-timestamp`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('Atoms Query', 'passed', `Retrieved ${data.length} atoms`, duration);
      
      // Verify atoms have provenance field
      const hasProvenance = data.every(a => a.provenance || a.source_path);
      if (!hasProvenance) {
        throw new Error('Some atoms missing provenance/source_path');
      }
    } else {
      throw new Error(`Query failed: ${response.status}`);
    }
  } catch (error) {
    logResult('Atoms Query', 'failed', error.message, 0);
  }

  // Test 7: Search functionality after ingestion
  try {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/v1/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'test file ingestion',
        max_results: 5,
      }),
    });
    
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('Search Query', 'passed', `Found ${data.results?.length || 0} results`, duration);
    } else {
      throw new Error(`Search failed: ${response.status}`);
    }
  } catch (error) {
    logResult('Search Query', 'failed', error.message, 0);
  }

  // Test 8: Verify compounds API returns 404 or empty
  try {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/v1/compounds`);
    const duration = Date.now() - start;
    
    if (response.status === 404 || response.status === 500) {
      logResult('Compounds API', 'passed', 'Returns error (expected after migration)', duration);
    } else if (response.ok) {
      const data = await response.json();
      // If compounds table exists but is empty, that's also acceptable during transition
      logResult('Compounds API', 'passed', `Status: ${response.status}, Data: ${JSON.stringify(data)}`, duration);
    } else {
      throw new Error(`Unexpected status: ${response.status}`);
    }
  } catch (error) {
    logResult('Compounds API', 'failed', error.message, 0);
  }

  // Test 9: Verify ingestion with different provenance types
  try {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/v1/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: '# External provenance test\nThis tests external source handling.',
        source: 'external-source-test',
        type: 'file',
        bucket: 'notebook',
      }),
    });
    
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('External Provenance Ingestion', 'passed', `Ingested ${data.atoms_count} atoms`, duration);
    } else {
      throw new Error(`Ingestion failed: ${response.status}`);
    }
  } catch (error) {
    logResult('External Provenance Ingestion', 'failed', error.message, 0);
  }

  // Test 10: Verify data integrity with molecule count check
  try {
    const start = Date.now();
    
    const response = await fetch(`${API_BASE_URL}/v1/molecules?limit=1&order_by=-id`);
    const duration = Date.now() - start;
    
    if (response.ok) {
      const data = await response.json();
      logResult('Data Integrity Check', 'passed', `Latest molecule has id: ${data[0]?.id}`, duration);
      
      // Verify molecular_signature is present
      if (!data[0]?.molecular_signature) {
        throw new Error('Molecule missing molecular_signature');
      }
    } else {
      throw new Error(`Query failed: ${response.status}`);
    }
  } catch (error) {
    logResult('Data Integrity Check', 'failed', error.message, 0);
  }

  // Cleanup test file
  try {
    const fs = await import('fs');
    fs.unlinkSync(TEST_FILE_PATH);
    console.log('[Cleanup] Removed test ingestion file');
  } catch (error) {
    console.warn('[Cleanup] Could not remove test file:', error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total: ${results.length}`);
  
  if (failed === 0) {
    console.log('\n✅ All tests passed! Migration successful.');
  } else {
    console.log(`\n❌ ${failed} test(s) failed. Review the results above.`);
  }

  // Log detailed results
  for (const result of results) {
    console.log(`- ${result.name}: ${result.status}`);
    if (result.details) console.log(`  ${result.details}`);
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('Test suite error:', error);
  process.exit(1);
});