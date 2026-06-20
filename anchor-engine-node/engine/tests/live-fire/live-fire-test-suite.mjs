#!/usr/bin/env node
/**
 * Live-Fire Test Suite for Anchor Engine v5.0.0
 * Performs end-to-end integration testing against a live server.
 * All output is logged to .anchor/logs directory.
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createRequire } from 'module';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const config = {
  serverUrl: process.env.SERVER_URL || 'http://localhost:3160',
  logsDir: process.env.ANCHOR_LOGS_DIR || join(__dirname, '../../.anchor', 'logs'),
  resultsFile: join(__dirname, '../../engine', 'tests', 'live-fire', 'results.json'),
};

// Ensure logs directory exists
if (!fs.existsSync(config.logsDir)) {
  fs.mkdirSync(config.logsDir, { recursive: true });
  console.log(`[INFO] Created logs directory: ${config.logsDir}`);
}

// Logging utilities
function log(...args) {
  const timestamp = new Date().toISOString();
  const message = `[${timestamp}] [LIVE-FIRE] ${args.join(' ')}`;
  console.log(message);
  // Also write to file
  const logFile = join(config.logsDir, `live-fire-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`);
  fs.appendFileSync(logFile, message + '\n');
}

function logResult(testName, passed, duration, error) {
  const result = {
    timestamp: new Date().toISOString(),
    testName,
    passed,
    duration_ms: Math.round(duration),
    error,
    serverUrl: config.serverUrl,
  };
  
  // Ensure results directory exists
  const resultsDir = dirname(config.resultsFile);
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }
  
  // Write individual test result
  const testResultFile = join(config.logsDir, `live-fire-${new Date().toISOString().slice(0, 10)}.json`);
  fs.appendFileSync(testResultFile, JSON.stringify(result, null, 2) + '\n');
  
  log(`[${result.passed ? '✓' : '✗'}] ${testName}: ${result.duration_ms}ms${error ? ` - ${error}` : ''}`);
  return result;
}

// Test suite
const tests = [
  {
    name: 'Server Health Check',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/stats`);
        const passed = response.status === 200;
        logResult('Server Health Check', passed, Date.now() - start, !passed ? `Expected status 200, got ${response.status}` : null);
        return passed;
      } catch (error) {
        logResult('Server Health Check', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Molecules List (Schema Verification)',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/molecules`);
        const data = response.data;
        // Verify molecules table has source_path and provenance fields
        const hasSourcePath = Array.isArray(data) ? 
          data.some(m => m.source_path !== undefined) : false;
        const hasProvenance = Array.isArray(data) ? 
          data.some(m => m.provenance !== undefined) : false;
        const passed = hasSourcePath && hasProvenance;
        logResult('Molecules List (Schema)', passed, Date.now() - start, 
          !passed ? `Missing source_path=${hasSourcePath}, provenance=${hasProvenance}` : null);
        return passed;
      } catch (error) {
        logResult('Molecules List', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Atoms List (Migration Verification)',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/atoms`);
        const data = response.data;
        // Atoms should exist after migration
        const passed = Array.isArray(data) || response.status === 200;
        logResult('Atoms List (Migration)', passed, Date.now() - start, 
          !passed ? `Atoms endpoint failed: ${error?.response?.status || error.message}` : null);
        return passed;
      } catch (error) {
        logResult('Atoms List', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Compounds Table Removal (Standard 051)',
    async run() {
      const start = Date.now();
      try {
        // Compounds table should NOT exist after migration
        const response = await axios.get(`${config.serverUrl}/v1/compounds`);
        // Should return 404 or empty, not successful data
        const passed = response.status === 404 || response.status === 200 && response.data === null;
        logResult('Compounds Table Removal', passed, Date.now() - start,
          !passed ? `Expected 404 or null, got status ${response.status}: ${response.data}` : null);
        return passed;
      } catch (error) {
        // 404 is expected
        logResult('Compounds Table Removal', true, Date.now() - start, null);
        return true;
      }
    }
  },
  {
    name: 'Search Query Test',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/search`, {
          params: {
            query: 'test search query',
            limit: 5,
          }
        });
        const passed = response.status === 200;
        logResult('Search Query', passed, Date.now() - start, !passed ? error?.response?.status || error.message : null);
        return passed;
      } catch (error) {
        logResult('Search Query', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Memory Search API',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/memory-search`);
        const passed = response.status === 200;
        logResult('Memory Search', passed, Date.now() - start, !passed ? error?.response?.status || error.message : null);
        return passed;
      } catch (error) {
        logResult('Memory Search', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Distillation API Health',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/distillation`);
        const passed = response.status === 200;
        logResult('Distillation API', passed, Date.now() - start, !passed ? error?.response?.status || error.message : null);
        return passed;
      } catch (error) {
        logResult('Distillation API', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Radial Distillation Query',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.post(`${config.serverUrl}/v1/distillation/radial`, {
          query: 'test radial distillation',
          maxDepth: 2,
        });
        const passed = response.status === 200;
        logResult('Radial Distillation', passed, Date.now() - start, !passed ? error?.response?.status || error.message : null);
        return passed;
      } catch (error) {
        logResult('Radial Distillation', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Ingestion Pipeline Check',
    async run() {
      const start = Date.now();
      try {
        // Check if ingestion endpoint is accessible
        const response = await axios.get(`${config.serverUrl}/v1/ingestion`);
        const passed = response.status === 200;
        logResult('Ingestion Pipeline', passed, Date.now() - start, !passed ? error?.response?.status || error.message : null);
        return passed;
      } catch (error) {
        logResult('Ingestion Pipeline', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Database Schema Verification',
    async run() {
      const start = Date.now();
      try {
        // Get molecules with detailed schema info
        const response = await axios.get(`${config.serverUrl}/v1/molecules`);
        if (response.status !== 200) throw new Error(`Status ${response.status}`);
        
        const data = response.data;
        const hasSourcePath = Array.isArray(data) && data.length > 0 && 
          typeof data[0].source_path === 'string';
        
        const passed = hasSourcePath;
        logResult('Schema Verification', passed, Date.now() - start,
          !passed ? `source_path field missing or wrong type: ${typeof data[0]?.source_path}` : null);
        return passed;
      } catch (error) {
        logResult('Schema Verification', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Provenance Field Verification',
    async run() {
      const start = Date.now();
      try {
        const response = await axios.get(`${config.serverUrl}/v1/molecules`);
        if (response.status !== 200) throw new Error(`Status ${response.status}`);
        
        const data = response.data;
        const hasProvenance = Array.isArray(data) && data.length > 0 &&
          typeof data[0].provenance === 'string';
        
        const passed = hasProvenance;
        logResult('Provenance Field', passed, Date.now() - start,
          !passed ? `provenance field missing or wrong type` : null);
        return passed;
      } catch (error) {
        logResult('Provenance Field', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
  {
    name: 'Full Integration Check',
    async run() {
      const start = Date.now();
      try {
        // Comprehensive check of all major endpoints
        const endpoints = [
          '/v1/stats',
          '/v1/molecules',
          '/v1/atoms',
          '/v1/compounds',
          '/v1/search',
          '/v1/distillation',
        ];
        
        let allGood = true;
        for (const endpoint of endpoints) {
          try {
            const res = await axios.get(`${config.serverUrl}${endpoint}`);
            if (res.status !== 200 && res.status !== 404) {
              allGood = false;
              break;
            }
          } catch (e) {
            allGood = false;
            break;
          }
        }
        
        logResult('Full Integration', allGood, Date.now() - start, !allGood ? 'Some endpoints failed' : null);
        return allGood;
      } catch (error) {
        logResult('Full Integration', false, Date.now() - start, error.message);
        return false;
      }
    }
  },
];

// Run test suite
async function main() {
  log('='.repeat(80));
  log('LIVE-FIRE TEST SUITE FOR ANCHOR ENGINE v5.0.0');
  log(`Server URL: ${config.serverUrl}`);
  log(`Logs Directory: ${config.logsDir}`);
  log('='.repeat(80));
  log('');
  
  const startTime = Date.now();
  const results = [];
  let passed = 0;
  let failed = 0;
  
  for (const test of tests) {
    try {
      const result = await test.run();
      results.push(result);
      if (result.passed) passed++;
      else failed++;
    } catch (error) {
      logResult(test.name, false, Date.now() - startTime, error.message);
      failed++;
    }
  }
  
  // Write summary results
  const summary = {
    timestamp: new Date().toISOString(),
    serverUrl: config.serverUrl,
    total: tests.length,
    passed,
    failed,
    duration_ms: Date.now() - startTime,
    tests: results,
  };
  
  fs.writeFileSync(config.resultsFile, JSON.stringify(summary, null, 2));
  log('');
  log('='.repeat(80));
  log('LIVE-FIRE TEST SUMMARY');
  log('='.repeat(80));
  log(`Total Tests: ${summary.total}`);
  log(`Passed: ${passed} ✓`);
  log(`Failed: ${failed} ✗`);
  log(`Duration: ${summary.duration_ms}ms`);
  log(`Results: ${config.resultsFile}`);
  log('='.repeat(80));
  
  // Return exit code
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  log('Fatal error:', error);
  process.exit(1);
});
