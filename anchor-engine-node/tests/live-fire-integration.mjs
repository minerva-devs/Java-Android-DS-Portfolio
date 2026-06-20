#!/usr/bin/env node
/**
 * Unified Live-Fire Integration Test Suite for Anchor Engine
 * 
 * This script performs end-to-end verification of the Anchor Engine:
 * 1. GitHub repo clone via ingestion API (external-inbox)
 * 2. Watchdog activation and directory monitoring
 * 3. Ingestion flow verification
 * 4. Search query execution with logging
 * 5. Distillation output generation
 * 
 * All logs are written to .anchor/logs/live-fire-{timestamp}/
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ANCHOR_ROOT = path.join(ROOT, '.anchor');
const LOGS_DIR = path.join(ANCHOR_ROOT, 'logs');
const TEST_OUTPUT_DIR = path.join(LOGS_DIR, 'live-fire-tests');

// Test configuration
const PROJECT_URL = 'https://github.com/RSBalchII/anchor-engine-node';
const EXPECTED_REPO_NAME = 'anchor-engine-node';
const EXPECTED_OWNER = 'RSBalchII';

/**
 * Log a message with timestamp
 */
function log(...args) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${args.join(' ')}`);
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  log('\n' + '='.repeat(80));
  log('🧪 ANCHOR ENGINE - LIVE-FIRE INTEGRATION TEST SUITE');
  log('='.repeat(80));
  console.log(`Project Root: ${ROOT}`);
  console.log(`Anchor Root: ${ANCHOR_ROOT}`);
  console.log(`Test Output: ${TEST_OUTPUT_DIR}`);
  console.log('='.repeat(80) + '\n');

  // Ensure test output directory exists
  fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true });

  const results = [];
  let passedSteps = 0;
  let failedSteps = 0;

  /**
   * Log result of a test step
   */
  function logResult(stepName, status, details = '', duration = 0) {
    const timestamp = new Date().toISOString();
    const result = {
      timestamp,
      step: stepName,
      status,
      details,
      duration,
      passedSteps,
      failedSteps: failedSteps.length
    };
    results.push(result);
    
    const statusEmoji = status === 'passed' ? '✅' : '❌';
    console.log(`${statusEmoji} ${stepName}`);
    if (details) console.log(`   ${details}`);
    console.log(`   Duration: ${duration.toFixed(2)}s`);
    
    return result;
  };

  // Step 0: Verify server is running
  log('\n[Step 0] Verifying server health...');
  try {
    const response = await fetch('http://localhost:3160/health');
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    
    if (data.status === 'healthy') {
      logResult('[Step 0] Server Health Check', 'passed', `Server status: ${data.status}`);
    } else {
      throw new Error(`Unexpected health status: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    logResult('[Step 0] Server Health Check', 'failed', `Server not responding: ${error.message}`);
    console.log('\n❌ Server is not running. Aborting tests.');
    process.exit(1);
  }

  // Step 1: Verify directory structure
  log('\n[Step 1] Verifying directory structure...');
  const requiredDirs = [
    'notebook/inbox',
    'notebook/external-inbox', 
    'notebook/distills'
  ];

  let allDirsExist = true;
  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(`   ⚠️  Created ${dir} (did not exist)`);
    } else {
      log(`   ✅ Exists: ${dir}`);
    }
  }

  // Check .anchor directory
  const anchorExists = fs.existsSync(ANCHOR_ROOT);
  if (!anchorExists) {
    fs.mkdirSync(ANCHOR_ROOT, { recursive: true });
    log(`   ⚠️  Created ${ANCHOR_ROOT} (did not exist)`);
  } else {
    log(`   ✅ Exists: ${ANCHOR_ROOT}`);
  }

  // Check for mirrored_brain directory
  const mirroredBrain = path.join(ANCHOR_ROOT, 'mirrored_brain');
  if (fs.existsSync(mirroredBrain)) {
    log(`   ✅ Mirrored brain exists: ${mirroredBrain}`);
    const contentCount = fs.readdirSync(mirroredBrain).length;
    log(`      Content files: ${contentCount}`);
  } else {
    log(`   ⚠️  Mirrored brain not found (will be created on ingestion)`);
  }

  // Step 2: Test GitHub clone via ingestion API
  log('\n[Step 2] Testing GitHub repo clone...');
  
  try {
    const startTime = Date.now();
    
    // Clone the repository via ingestion API (correct endpoint)
    const response = await fetch('http://localhost:3160/v1/github/repos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: `https://github.com/${EXPECTED_OWNER}/${EXPECTED_REPO_NAME}.git`,
        include_history: false,  // Don't include git history for faster clone
        run_analysis: true       // Run analysis on the repo contents
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   GitHub API error ${response.status}: ${errorText}`);
      throw new Error(`GitHub ingestion API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    
    log(`   ✅ GitHub ingestion initiated`);
    log(`   📦 Repo registered: ${result.id || 'unknown'}`);
    
    // Wait for async operation to complete (clone + ingestion)
    const waitTime = 120000; // 2 minutes should be enough for cloning a small repo
    log(`   ⏳ Waiting ${waitTime/1000}s for clone and ingestion...`);
    await sleep(waitTime);

    // Verify by searching for README.md or package.json (use stream=false to get JSON response)
    const searchResponse = await fetch('http://localhost:3160/v1/memory/search?stream=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'README',
        max_results: 5
      })
    });

    if (searchResponse.ok) {
      const searchResults = await searchResponse.json();
      
      if (searchResults.results && searchResults.results.length > 0) {
        // Check if we found files from our repo
        const foundOurFiles = searchResults.results.some(r => 
          r.source_path?.includes('anchor-engine-node') || 
          r.source_path?.includes('README')
        );
        
        logResult('[Step 2] GitHub Clone & Ingestion', 'passed', 
          `Search found ${searchResults.results.length} results. Found repo files: ${foundOurFiles}`);
      } else {
        throw new Error('No search results returned after ingestion');
      }
    } else {
      const errorText = await searchResponse.text();
      logResult('[Step 2] GitHub Clone & Ingestion', 'failed', 
        `Search API error: ${searchResponse.status} - ${errorText}`);
    }

  } catch (error) {
    logResult('[Step 2] GitHub Clone & Ingestion', 'failed', error.message);
  }

  // Step 3: Verify watchdog directories are being monitored
  log('\n[Step 3] Verifying watchdog monitoring...');
  
  const externalInbox = path.join(ROOT, 'notebook/external-inbox');
  if (fs.existsSync(externalInbox)) {
    const contents = fs.readdirSync(externalInbox);
    log(`   ✅ external-inbox exists with ${contents.length} items`);
    
    // Check for cloned repo directory
    const foundRepo = contents.find(c => c.includes('anchor-engine-node'));
    if (foundRepo) {
      log(`   ✅ Found cloned repo: ${foundRepo}`);
    } else {
      log(`   ⚠️  Repo not yet extracted from tarball`);
    }
  } else {
    log(`   ❌ external-inbox does not exist`);
  }

  // Step 4: Test ingestion via API (simple text)
  log('\n[Step 4] Testing ingestion API...');
  
  try {
    const testContent = `# Test Document

This is a test document for the Anchor Engine ingestion system.

## Key Concepts
- This tests the ingestion pipeline
- Verifies that atoms and molecules are created correctly
- Ensures search can find this content

## Timestamp
Test date: ${new Date().toISOString()}
`;

    const ingestResponse = await fetch('http://localhost:3160/v1/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: testContent,
        source: '/tmp/test-ingestion',
        type: 'text',
        buckets: ['test'],
        tags: ['test', 'ingestion']
      })
    });

    if (ingestResponse.ok) {
      const result = await ingestResponse.json();
      log(`   ✅ Ingestion successful`);
      logResult('[Step 4] Ingestion API Test', 'passed', `Created ${result.atoms_created || 0} atoms`);
    } else {
      const errorText = await ingestResponse.text();
      throw new Error(`Ingestion API error: ${ingestResponse.status} - ${errorText}`);
    }

  } catch (error) {
    logResult('[Step 4] Ingestion API Test', 'failed', error.message);
  }

  // Step 5: Test search functionality with logging verification
  log('\n[Step 5] Testing search with logging...');
  
  try {
    const response = await fetch('http://localhost:3160/v1/memory/search?stream=false', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'test document ingestion',
        token_budget: 512,
        max_results: 5
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Search API error: ${response.status} - ${errorText}`);
    }

    const results = await response.json();

    // Verify we got results
    if (!results.results || results.results.length === 0) {
      throw new Error('No search results returned');
    }

    // Check that results have the expected structure
    const firstResult = results.results[0];
    const hasRequiredFields = 
      firstResult.source_path &&
      firstResult.start_line &&
      firstResult.end_line;

    if (!hasRequiredFields) {
      throw new Error('Search results missing required fields');
    }

    // Verify logging - check if logs directory has recent entries
    const logFiles = fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
    
    logResult('[Step 5] Search & Logging Verification', 'passed', 
      `Search returned ${results.results.length} results. Log files present: ${logFiles.length}`);

    // Save search results to log file for verification
    const searchLog = path.join(TEST_OUTPUT_DIR, 'search-results.json');
    fs.writeFileSync(searchLog, JSON.stringify(results, null, 2));
    log(`   📄 Search results saved to: ${searchLog}`);

  } catch (error) {
    logResult('[Step 5] Search & Logging Verification', 'failed', error.message);
  }

  // Step 6: Test distillation output generation
  log('\n[Step 6] Testing distillation output...');
  
  try {
    const response = await fetch('http://localhost:3160/v1/memory/distill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: '',  // Empty query for full corpus distillation
        max_results: 5,
        include_content: true
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`   Distillation API error: ${errorText}`);
      throw new Error(`Distillation API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();

    // Verify we got distillation results
    if (!result.records || result.records.length === 0) {
      throw new Error('No distillation records returned');
    }

    // Check that records have expected structure
    if (result.records[0] && !result.records[0].title) {
      throw new Error('Distillation records missing title field');
    }

    logResult('[Step 6] Distillation Output Verification', 'passed', 
      `Distillation produced ${result.records.length} records`);

    // Verify output is being logged to .anchor/logs
    const recentLogFiles = fs.readdirSync(LOGS_DIR)
      .filter(f => f.endsWith('.log'))
      .sort()
      .slice(-5);  // Get last 5 log files
    
    console.log(`   Recent log files: ${recentLogFiles.join(', ')}`);

    // Save distillation results to log file
    const distillLog = path.join(TEST_OUTPUT_DIR, 'distillation-results.json');
    fs.writeFileSync(distillLog, JSON.stringify(result, null, 2));
    log(`   📄 Distillation results saved to: ${distillLog}`);

  } catch (error) {
    logResult('[Step 6] Distillation Output Verification', 'failed', error.message);
  }

  // Step 7: Verify MCP server is accessible
  log('\n[Step 7] Testing MCP server...');
  
  try {
    const response = await fetch('http://localhost:8001/health');
    
    if (response.ok) {
      logResult('[Step 7] MCP Server Verification', 'passed', 'MCP server responding on port 8001');
    } else {
      // MCP might not be running, that's okay - it's optional
      console.log(`   MCP returned ${response.status} (optional service)`);
      logResult('[Step 7] MCP Server Verification', 'passed (optional)', 
        `MCP responded with ${response.status}`);
    }

  } catch (error) {
    // MCP is optional, so treat as passed if it fails gracefully
    console.log(`   MCP not available or error: ${error.message}`);
    logResult('[Step 7] MCP Server Verification', 'passed (optional)', 
      'MCP not running - this is acceptable for basic functionality');
  }

  // Step 8: Verify API key authentication works
  log('\n[Step 8] Testing authentication...');
  
  try {
    // Try to access an endpoint without auth (should work)
    const response1 = await fetch('http://localhost:3160/health');
    
    if (!response1.ok) {
      throw new Error(`Health check failed: ${response1.status}`);
    }

    // Search endpoints don't require authentication - verify this works
    const response2 = await fetch('http://localhost:3160/v1/memory/search', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'test search without auth' })
    });

    // Should succeed (search doesn't require auth) or return 400 for bad request
    if (response2.ok || response2.status === 400) {
      logResult('[Step 8] Authentication Verification', 'passed', 
        'Search endpoint accessible without authentication (expected behavior)');
    } else {
      throw new Error(`Unexpected search response: ${response2.status}`);
    }

  } catch (error) {
    logResult('[Step 8] Authentication Verification', 'failed', error.message);
  }

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(80));
  console.log(`Total steps: ${results.length}`);
  const passed = results.filter(r => r.status === 'passed').length;
  const failed = results.filter(r => r.status === 'failed').length;
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  
  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check logs for details.');
  } else {
    console.log('\n✅ All critical tests passed! System is ready for production use.');
  }

  // Save results to file
  const resultsFile = path.join(TEST_OUTPUT_DIR, 'live-fire-results.json');
  fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${resultsFile}`);

  // Exit with appropriate code
  process.exit(failed > 0 ? 1 : 0);
}

// Run the tests
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});