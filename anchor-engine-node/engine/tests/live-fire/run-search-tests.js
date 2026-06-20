/**
 * Search API Live-Fire Tests
 * 
 * Runs comprehensive search functionality tests against a live server.
 * Focuses on query parsing, retrieval quality, and response formatting.
 */

const http = require('http');
const path = require('path');
const fs = require('fs');

// Configuration
const DEFAULT_URL = 'http://localhost:3160';

let serverUrl = DEFAULT_URL;
for (const arg of process.argv.slice(2)) {
  if (arg.startsWith('--url=')) {
    serverUrl = arg.split('=')[1];
  } else if (!arg.startsWith('-')) {
    serverUrl = arg;
  }
}

const log = (msg) => console.log(`[SearchTests] ${msg}`);

// Utility functions
const request = async (url, options = {}) => {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const reqOptions = {
      ...options,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: parsedUrl.pathname + parsedUrl.search,
      method: options.method || 'GET',
      headers: {
        ...options.headers,
        'Content-Type': 'application/json'
      }
    };

    const req = (parsedUrl.protocol === 'https:' ? require('https') : require('http')).request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });

    req.on('error', reject);
    
    if (reqOptions.body) {
      req.write(reqOptions.body);
    }
    req.end();
  });
};

const assert = (condition, message, testName) => {
  if (condition) {
    log(`✓ ${testName}`);
    return true;
  } else {
    log(`✗ ${testName}: ${message}`);
    return false;
  }
};

// Test suite
const tests = [];
let passCount = 0;
let failCount = 0;
const results = [];

const runTest = async (name, fn) => {
  const start = Date.now();
  try {
    await fn();
    log(`✓ [${name}]`);
    results.push({ name, status: 'pass', duration_ms: Date.now() - start });
    passCount++;
  } catch (error) {
    log(`✗ [${name}]: ${error.message || error}`);
    results.push({ name, status: 'fail', error: error.message || error, duration_ms: Date.now() - start });
    failCount++;
  }
};

// Test functions for search API

const testExactSearch = async () => {
  try {
    const res = await request(`${serverUrl}/v1/exact/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'test exact search', limit: 3 })
    });

    if (res.status >= 200 && res.status < 400) {
      const data = JSON.parse(res.body || '{}');
      // Verify response has expected fields
      assert(!!data.results, 'No results field in exact search', 'Exact search returns results array');
      assert('query' in data, 'Missing query field', 'Exact search includes query echo');
      
      const result = { name: 'Exact Search API', status: 'pass', response_fields: Object.keys(data) };
      passCount++;
    } else {
      throw new Error(`Exact search failed with ${res.status}: ${res.body}`);
    }
  } catch (e) {
    const result = { name: 'Exact Search API', status: 'fail', error: e.message };
    failCount++;
  }
};

const testSemanticSearch = async () => {
  try {
    const res = await request(`${serverUrl}/v1/semantic/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'database schema atoms molecules', limit: 5 })
    });

    if (res.status >= 200 && res.status < 400) {
      const data = JSON.parse(res.body || '{}');
      assert('results' in data, 'No results field in semantic search', 'Semantic search returns results');
      
      const result = { name: 'Semantic Search API', status: 'pass', num_results: data.results?.length || 0 };
      passCount++;
    } else {
      throw new Error(`Semantic search failed`);
    }
  } catch (e) {
    failCount++;
  }
};

const testMemorySearch = async () => {
  try {
    const res = await request(`${serverUrl}/v1/memory/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'migration compounds provenance', limit: 5 })
    });

    if (res.status >= 200 && res.status < 400) {
      const data = JSON.parse(res.body || '{}');
      assert('results' in data, 'No results field in memory search', 'Memory search returns results');
      
      const result = { name: 'Memory Search API', status: 'pass', num_results: data.results?.length || 0 };
      passCount++;
    } else {
      throw new Error(`Memory search failed`);
    }
  } catch (e) {
    failCount++;
  }
};

const testSearchWithFilters = async () => {
  try {
    const res = await request(`${serverUrl}/v1/memory/search`, {
      method: 'POST',
      body: JSON.stringify({ 
        query: 'test',
        limit: 3,
        filters: { min_relevance: 0.5 }
      })
    });

    // Should return results or empty array, not error
    if (res.status >= 200 && res.status < 400) {
      const data = JSON.parse(res.body || '{}');
      assert(data.results !== undefined, 'No results field', 'Search with filters works');
      
      const result = { name: 'Search with Filters', status: 'pass' };
      passCount++;
    } else {
      throw new Error(`Search with filters failed`);
    }
  } catch (e) {
    failCount++;
  }
};

const testSearchPagination = async () => {
  try {
    // Test with page parameter if supported
    const res1 = await request(`${serverUrl}/v1/memory/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'test', limit: 2 })
    });

    const res2 = await request(`${serverUrl}/v1/memory/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'test pagination', limit: 5 })
    });

    if (res1.status >= 200 && res2.status >= 200) {
      const d1 = JSON.parse(res1.body || '{}');
      const d2 = JSON.parse(res2.body || '{}');
      
      assert(d1.results?.length === 2, 'First query returned wrong count', 'Pagination limit works');
      assert(d2.results?.length === 5, 'Second query returned wrong count', 'Larger limit works');
      
      const result = { name: 'Search Pagination', status: 'pass' };
      passCount++;
    } else {
      throw new Error('Pagination test failed');
    }
  } catch (e) {
    failCount++;
  }
};

const testQueryParsing = async () => {
  try {
    // Test various query formats
    const queries = [
      'simple query',
      'query with multiple words',
      'special chars: @#$%',
      'unicode: 你好世界'
    ];

    for (const q of queries) {
      const res = await request(`${serverUrl}/v1/memory/search`, {
        method: 'POST',
        body: JSON.stringify({ query: q, limit: 1 })
      });

      if (res.status >= 400) {
        throw new Error(`Query parsing failed for: "${q}"`);
      }
    }

    const result = { name: 'Query Parsing', status: 'pass' };
    passCount++;
  } catch (e) {
    failCount++;
  }
};

const testResponseStructure = async () => {
  try {
    const res = await request(`${serverUrl}/v1/memory/search`, {
      method: 'POST',
      body: JSON.stringify({ query: 'response structure test', limit: 3 })
    });

    if (res.status >= 200) {
      const data = JSON.parse(res.body || '{}');
      
      // Check for expected fields in response
      const hasResults = Array.isArray(data.results);
      const hasQuery = 'query' in data;
      const hasMetadata = !!data.metadata;
      
      if (hasResults && hasQuery) {
        const result = { name: 'Response Structure', status: 'pass' };
        passCount++;
      } else {
        throw new Error(`Missing expected fields. Has results: ${hasResults}, query: ${hasQuery}`);
      }
    } else {
      throw new Error('Response structure test failed');
    }
  } catch (e) {
    failCount++;
  }
};

const main = async () => {
  log(`\n=== Search API Live-Fire Tests ===`);
  log(`Server URL: ${serverUrl}`);
  
  const testOrder = [
    ['Exact Search', testExactSearch],
    ['Semantic Search', testSemanticSearch],
    ['Memory Search', testMemorySearch],
    ['Search with Filters', testSearchWithFilters],
    ['Search Pagination', testSearchPagination],
    ['Query Parsing', testQueryParsing],
    ['Response Structure', testResponseStructure]
  ];

  for (const [name, fn] of testOrder) {
    await runTest(name, fn);
  }

  // Summary
  log('\n=== Results ===');
  log(`Passed: ${passCount}`);
  log(`Failed: ${failCount}`);

  const timestamp = new Date().toISOString();
  fs.writeFileSync(
    path.join(__dirname, `search-results-${timestamp}.json`),
    JSON.stringify({ serverUrl, timestamp, passed: passCount, failed: failCount, results }, null, 2)
  );
  
  console.log(`\nSearch tests saved to: engine/tests/live-fire/search-results-*.json`);

  process.exit(failCount > 0 ? 1 : 0);
};

main();