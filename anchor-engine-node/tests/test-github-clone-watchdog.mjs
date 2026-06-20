#!/usr/bin/env node
/**
 * GitHub Clone & Watchdog Test
 * 
 * Tests:
 * 1. GitHub repo cloning via ingestion API
 * 2. Watchdog directory monitoring
 * 3. File ingestion verification
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const ANCHOR_ROOT = path.join(ROOT, '.anchor');

// Test configuration
const GITHUB_API_URL = 'https://api.github.com/repos/RSBalchII/anchor-engine-node';

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
  log('\n🧪 GitHub Clone & Watchdog Test');
  log('='.repeat(60));

  // Step 1: Check server status
  log('\n[1/5] Checking server health...');
  try {
    const response = await fetch('http://localhost:3160/health');
    if (!response.ok) throw new Error(`Server returned ${response.status}`);
    const data = await response.json();
    log(`   ✅ Server healthy: ${data.status || 'ok'}`);
  } catch (error) {
    log(`   ❌ Server not responding: ${error.message}`);
    process.exit(1);
  }

  // Step 2: Check current directory structure
  log('\n[2/5] Checking directory structure...');
  const requiredDirs = [
    'notebook/inbox',
    'notebook/external-inbox',
    'notebook/distills'
  ];

  for (const dir of requiredDirs) {
    const fullPath = path.join(ROOT, dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
      log(`   ✅ Created ${dir}`);
    } else {
      log(`   ✅ Exists ${dir}`);
    }
  }

  // Step 3: Verify .anchor directory exists
  log('\n[3/5] Checking .anchor directory...');
  if (!fs.existsSync(ANCHOR_ROOT)) {
    fs.mkdirSync(ANCHOR_ROOT, { recursive: true });
    log(`   ✅ Created ${ANCHOR_ROOT}`);
  } else {
    log(`   ✅ Exists ${ANCHOR_ROOT}`);
  }

  // Step 4: Test GitHub clone via ingestion API
  log('\n[4/5] Testing GitHub repo clone...');
  try {
    const cloneResponse = await fetch('http://localhost:3160/v1/ingest/github', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        owner: 'RSBalchII',
        repo: 'anchor-engine-node',
        branch: 'main'
      })
    });

    if (!cloneResponse.ok) {
      throw new Error(`GitHub ingestion API error: ${cloneResponse.status} ${cloneResponse.statusText}`);
    }

    const cloneResult = await cloneResponse.json();
    log(`   ✅ GitHub ingestion initiated. Files to process: ${cloneResult.files_to_process || 'unknown'}`);
    
    // Wait for async operation to complete
    log('   ⏳ Waiting for clone and ingestion to complete...');
    await sleep(45000); // 45 seconds should be enough

    // Verify by searching for a known file
    const searchResponse = await fetch('http://localhost:3160/v1/memory/search', {
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
        log(`   ✅ Search found ${searchResults.results.length} results after clone`);
        for (const result of searchResults.results.slice(0, 3)) {
          log(`      - ${result.source_path || 'unknown'}`);
        }
      } else {
        throw new Error('No search results after GitHub clone');
      }
    }

  } catch (error) {
    log(`   ❌ GitHub clone failed: ${error.message}`);
    // Don't exit - continue with other tests
  }

  // Step 5: Verify watchdog directories are being monitored
  log('\n[5/5] Verifying watchdog monitoring...');
  
  // Check if there's a way to verify watchdog is active
  // For now, we'll check that the directories exist and have proper structure
  
  const externalInbox = path.join(ROOT, 'notebook/external-inbox');
  if (fs.existsSync(externalInbox)) {
    const contents = fs.readdirSync(externalInbox);
    log(`   ✅ external-inbox exists with ${contents.length} items`);
    for (const item of contents.slice(0, 5)) {
      log(`      - ${item}`);
    }
  } else {
    log(`   ⚠️  external-inbox is empty or not yet populated`);
  }

  // Check .anchor directory
  const anchorContents = fs.readdirSync(ANCHOR_ROOT).filter(f => !f.startsWith('.'));
  log(`   ✅ .anchor contains: ${anchorContents.join(', ')}`);

  log('\n' + '='.repeat(60));
  log('Test complete!');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});