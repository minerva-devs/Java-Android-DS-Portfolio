// engine/src/routes/test-ui.ts
// Test UI Routes - Comprehensive testing interface

import { Request, Response } from 'express';
import { db } from '../core/db.js';
import { config } from '../config/index.js';
import path from 'path';
import { fileURLToPath, URL } from 'url';
import fs from 'fs';

// Properly construct paths for ES modules in Node.js
const getBaseUrl = () => {
  try {
    const url = new URL('.', import.meta.url);
    return fileURLToPath(url.pathname).replace(/\\/g, '/');
  } catch (e) {
    // Fallback for environments where URL parsing fails
    return process.cwd();
  }
};

const baseUrl = getBaseUrl();
const __filename = path.join(baseUrl, 'test-ui.js').replace(/\\/g, '/');
const __dirname = baseUrl.replace(/\\/g, '/');

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'error';
  duration: number;
  message?: string;
  data?: any;
  snapshot?: string;
}

interface TestCategory {
  name: string;
  icon: string;
  tests: TestDefinition[];
}

interface TestDefinition {
  id: string;
  name: string;
  description: string;
  endpoint: string;
  method: string;
  body?: any;
  validate?: (response: any) => { pass: boolean; message?: string };
}

// Test categories and definitions - Comprehensive test suite from /tests directory
const testCategories: TestCategory[] = [
  {
    name: 'Unit Tests',
    icon: 'circle-help',
    tests: [
      {
        id: 'test-parser',
        name: 'Parser Tests',
        description: 'Test content parser functionality',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/test_parser.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-atomizer-limit',
        name: 'Atomizer Limit Tests',
        description: 'Test atomizer boundary detection',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/test_atomizer_limit.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-runtime-events',
        name: 'Runtime Events Tests',
        description: 'Test event system and listeners',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/test_runtime_events.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-token-utilization',
        name: 'Token Utilization Tests',
        description: 'Test token counting and budgeting',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/test-token-utilization.js' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'verification-search',
        name: 'Search Verification',
        description: 'Verify search algorithm correctness',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/verification_search.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'whitepaper-verification',
        name: 'Whitepaper Verification',
        description: 'Verify whitepaper implementation claims',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/whitepaper-verification.js' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Integration Tests',
    icon: 'layers',
    tests: [
      {
        id: 'test-pglite',
        name: 'PGlite Integration',
        description: 'Test PGlite database integration',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/test-pglite.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'minimal-pglite',
        name: 'Minimal PGlite Test',
        description: 'Minimal PGlite functionality test',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/minimal-pglite-test.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'minimal-framework',
        name: 'Minimal Framework Tests',
        description: 'Zero-dependency test framework',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/minimal-framework.mjs' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'streamlined-test',
        name: 'Streamlined Tests',
        description: 'Streamlined testing approach',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/streamlined-test.mjs' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'E2E Tests',
    icon: 'globe',
    tests: [
      {
        id: 'full-stack-test',
        name: 'Full Stack E2E',
        description: 'Complete end-to-end workflow tests',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/e2e/full-stack.test.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Emulation Tests',
    icon: 'monitor',
    tests: [
      {
        id: 'emulate-frontend',
        name: 'Frontend Emulation',
        description: 'Emulate frontend behavior',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/emulate-frontend.mjs' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'emulate-mcp',
        name: 'MCP Emulation',
        description: 'Emulate MCP protocol behavior',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/emulate-mcp.mjs' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Core API',
    icon: 'cpu',
    tests: [
      {
        id: 'health-check',
        name: 'Health Check',
        description: 'Verify server is running and healthy',
        endpoint: '/health',
        method: 'GET',
        validate: (res) => ({ pass: res.status === 'healthy' })
      },
      {
        id: 'get-stats',
        name: 'Get Statistics',
        description: 'Retrieve database statistics',
        endpoint: '/v1/stats',
        method: 'GET',
        validate: (res) => ({ pass: typeof res.atoms === 'number' })
      },
      {
        id: 'get-buckets',
        name: 'Get Buckets',
        description: 'List available knowledge buckets',
        endpoint: '/v1/buckets',
        method: 'GET',
        validate: (res) => ({ pass: Array.isArray(res.buckets) })
      }
    ]
  },
  {
    name: 'Memory & Search',
    icon: 'search',
    tests: [
      {
        id: 'search-empty',
        name: 'Search (Empty Query)',
        description: 'Test search with empty query',
        endpoint: '/v1/memory/search',
        method: 'POST',
        body: { query: '', max_results: 10, mode: 'combined' },
        validate: (res) => ({ pass: res.results !== undefined })
      },
      {
        id: 'search-test-tag',
        name: 'Search by Tag',
        description: 'Test search with #test tag',
        endpoint: '/v1/memory/search',
        method: 'POST',
        body: { query: '#test', max_results: 10, mode: 'tags' },
        validate: (res) => ({ pass: res.results !== undefined })
      }
    ]
  },
  {
    name: 'System Management',
    icon: 'settings',
    tests: [
      {
        id: 'list-paths',
        name: 'List Watch Paths',
        description: 'Get currently watched directories',
        endpoint: '/v1/system/paths',
        method: 'GET',
        validate: (res) => ({ pass: Array.isArray(res.watch_paths) })
      },
      {
        id: 'watchdog-status',
        name: 'Watchdog Status',
        description: 'Check watchdog service state',
        endpoint: '/v1/watchdog/status',
        method: 'GET',
        validate: (res) => ({ pass: typeof res.is_running === 'boolean' })
      }
    ]
  },
  {
    name: 'Security Tests',
    icon: 'shield',
    tests: [
      {
        id: 'test-tag-infection-v2',
        name: 'Tag Infection V2',
        description: 'Test tag-based content isolation and infection prevention',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_tag_infection_v2.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-query-builder-security',
        name: 'Query Builder Security',
        description: 'Test SQL query construction security',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_query_builder_security.js' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-infection-generator',
        name: 'Infection Generator',
        description: 'Test content infection propagation detection',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_infection_generator.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Atomizer & Parser Logic',
    icon: 'microscope',
    tests: [
      {
        id: 'test-atomizer-logic',
        name: 'Atomizer Logic Tests',
        description: 'Test semantic atomization logic and boundaries',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_atomizer_logic.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-byte-offsets',
        name: 'Byte Offset Tests',
        description: 'Test byte offset calculation and tracking',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_byte_offsets.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-atomic-ingest',
        name: 'Atomic Ingest Tests',
        description: 'Test atomic ingestion pipeline integrity',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_atomic_ingest.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Context Retrieval & Quality',
    icon: 'eye',
    tests: [
      {
        id: 'test-context-re retrieval',
        name: 'Context Retrieval Tests',
        description: 'Test context retrieval algorithms and ranking',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_context_retrieval.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-context-quality',
        name: 'Context Quality Tests',
        description: 'Test context quality improvements and scoring',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_context_quality_improvements.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Search & Query Logic',
    icon: 'magnifier',
    tests: [
      {
        id: 'test-search-walker',
        name: 'Search Walker Tests',
        description: 'Test search traversal algorithms',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_search_walker.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-query-expansion',
        name: 'Query Expansion Tests',
        description: 'Test query expansion and enrichment algorithms',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_query_expansion.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Agent & Runtime Tests',
    icon: 'bot',
    tests: [
      {
        id: 'test-agent-runtime',
        name: 'Agent Runtime Tests',
        description: 'Test agent execution and lifecycle management',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_agent_runtime.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Pipeline & Integrity',
    icon: 'task_queue',
    tests: [
      {
        id: 'test-pipeline-integrity',
        name: 'Pipeline Integrity Tests',
        description: 'Test overall pipeline data integrity checks',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_pipeline_integrity.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Token & Parameter Tests',
    icon: 'numeric_text',
    tests: [
      {
        id: 'test-token-utils',
        name: 'Token Utils Tests',
        description: 'Test token counting and budgeting utilities',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_token_utils.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-param-clamping',
        name: 'Parameter Clamping Tests',
        description: 'Test input parameter validation and clamping',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_param_clamping.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Personal Data & Mirror',
    icon: 'folder',
    tests: [
      {
        id: 'test-personal-data',
        name: 'Personal Data Tests',
        description: 'Test personal data handling and processing',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_personal_data.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Chat & Streaming',
    icon: 'chat_bubble',
    tests: [
      {
        id: 'test-chat-streaming',
        name: 'Chat Streaming Tests',
        description: 'Test chat message streaming and delivery',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_chat_streaming.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Universal Topology',
    icon: 'network',
    tests: [
      {
        id: 'test-universal-topology',
        name: 'Universal Topology Tests',
        description: 'Test universal data topology and relationships',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/test_universal_topology.d.ts' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Performance Tests',
    icon: 'speedometer',
    tests: [
      {
        id: 'test-native-bench',
        name: 'Native Module Benchmarks',
        description: 'Test native module performance metrics',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/unit/native_bench.js' },
        validate: (res) => ({ pass: res.success === true })
      },
      {
        id: 'test-memory-bench',
        name: 'Memory Performance Tests',
        description: 'Test memory usage and optimization',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: 'tests/benchmarks/memory_bench.js' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
  {
    name: 'Minimal Framework Tests',
    icon: 'cactus',
    tests: [
      {
        id: 'test-foo',
        name: 'Custom Test Runner',
        description: 'Run custom test',
        endpoint: '/v1/test/run-file',
        method: 'POST',
        body: { file: '' },
        validate: (res) => ({ pass: res.success === true })
      }
    ]
  },
];

// Run a single test
async function runTest(test: TestDefinition, apiKey: string): Promise<TestResult> {
  const startTime = Date.now();
  
  try {
    const baseUrl = `http://localhost:${config.PORT || 8080}`;
    const url = `${baseUrl}${test.endpoint}`;
    
    const options: RequestInit = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    };
    
    if (test.body && test.method !== 'GET') {
      options.body = JSON.stringify(test.body);
    }
    
    const response = await fetch(url, options);
    const data = await response.json();
    const duration = Date.now() - startTime;
    
    // Validate response
    let pass = true;
    let message = 'Test passed';
    if (test.validate) {
      const validation = test.validate(data);
      pass = validation.pass;
      message = validation.message || message;
    }
    
    return {
      name: test.name,
      status: pass ? 'pass' : 'fail',
      duration,
      message,
      data
    };
  } catch (error) {
    const duration = Date.now() - startTime;
    return {
      name: test.name,
      status: 'error',
      duration,
      message: (error as Error).message,
      data: null
    };
  }
}

// Run all tests in a category
async function runCategoryTests(categoryId: number, apiKey: string): Promise<TestResult[]> {
  const category = testCategories[categoryId];
  const results: TestResult[] = [];
  
  for (const test of category.tests) {
    const result = await runTest(test, apiKey);
    results.push(result);
  }
  
  return results;
}

// Run all tests
async function runAllTests(apiKey: string): Promise<{ [key: string]: TestResult[] }> {
  const allResults: { [key: string]: TestResult[] } = {};
  
  for (let i = 0; i < testCategories.length; i++) {
    const category = testCategories[i];
    allResults[category.name] = await runCategoryTests(i, apiKey);
  }
  
  return allResults;
}

// Save snapshot to logs directory
async function saveSnapshot(name: string, type: string, data: any): Promise<{ success: boolean; path?: string; error?: string }> {
  try {
    const logsDir = path.join(process.cwd(), 'logs');

    // Create logs directory if it doesn't exist
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const snapshotData = {
      timestamp: new Date().toISOString(),
      type,
      name,
      data
    };

    const snapshotPath = path.join(logsDir, `snapshot-${name}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(snapshotData, null, 2));

    return { success: true, path: snapshotPath };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message
    };
  }
}

// Run a test file from the /tests directory
interface TestFileResult extends TestResult {
  output?: string;
  exitCode?: number;
}

async function runFileTest(filePath: string): Promise<TestFileResult> {
  const startTime = Date.now();
  const { spawn } = await import('child_process');
  const { validatePathSafety } = await import('../utils/security.js');
  const { PROJECT_ROOT } = await import('../config/paths.js');

  return new Promise((resolve) => {
    // Security: Validate test file path is within tests directory
    // Test files must ONLY be within the project's tests/ directory
    const testsDir = path.join(PROJECT_ROOT, 'tests');
    const pathValidation = validatePathSafety(filePath, [testsDir]);
    
    if (!pathValidation.isValid) {
      resolve({
        name: path.basename(filePath),
        status: 'error',
        duration: 0,
        message: `Security error: ${pathValidation.error}`,
        output: '',
        exitCode: 1
      });
      return;
    }
    
    const fullPath = pathValidation.resolvedPath;

    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      resolve({
        name: path.basename(filePath),
        status: 'error',
        duration: 0,
        message: `Test file not found: ${fullPath}`,
        output: '',
        exitCode: 1
      });
      return;
    }

    // Determine how to run the file based on extension
    let command: string;
    let args: string[];
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.ts') {
      // TypeScript files - run with tsx or ts-node
      command = 'npx';
      args = ['tsx', fullPath];
    } else if (ext === '.mjs' || ext === '.js') {
      // ES modules or JS files - run with node
      command = 'node';
      args = [fullPath];
    } else {
      resolve({
        name: path.basename(filePath),
        status: 'error',
        duration: 0,
        message: `Unsupported file type: ${ext}`,
        output: '',
        exitCode: 1
      });
      return;
    }

    let output = '';
    let errorOutput = '';

    const proc = spawn(command, args, {
      cwd: process.cwd(),
      env: { ...process.env, FORCE_COLOR: '1' },
      shell: true
    });

    proc.stdout.on('data', (data) => {
      output += data.toString();
    });

    proc.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    proc.on('close', (code) => {
      const duration = Date.now() - startTime;
      const fullOutput = output + errorOutput;
      
      resolve({
        name: path.basename(filePath),
        status: code === 0 ? 'pass' : 'fail',
        duration,
        message: code === 0 ? 'All tests passed' : `Tests failed with code ${code}`,
        output: fullOutput.trim(),
        exitCode: code || 0,
        data: {
          stdout: output.trim(),
          stderr: errorOutput.trim()
        }
      });
    });

    proc.on('error', (err) => {
      const duration = Date.now() - startTime;
      resolve({
        name: path.basename(filePath),
        status: 'error',
        duration,
        message: err.message,
        output: '',
        exitCode: -1
      });
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      proc.kill();
      resolve({
        name: path.basename(filePath),
        status: 'error',
        duration: Date.now() - startTime,
        message: 'Test timed out (5 minute limit)',
        output: output.trim(),
        exitCode: -1
      });
    }, 300000);
  });
}

// Export route registration function
export function registerTestRoutes(app: any) {
  // Get test categories
  app.get('/v1/test/categories', (_req: Request, res: Response) => {
    res.json({ categories: testCategories });
  });

  // Run a test file from /tests directory
  app.post('/v1/test/run-file', async (req: Request, res: Response) => {
    const { file } = req.body;
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || config.API_KEY;

    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'file parameter is required'
      });
    }

    try {
      const result = await runFileTest(file);
      res.json({
        success: result.status === 'pass',
        result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  });

  // Run single test
  app.post('/v1/test/run', async (req: Request, res: Response) => {
    const { categoryId, testId } = req.body;
    const apiKey = req.headers['authorization']?.replace('Bearer ', '') || config.API_KEY;

    if (categoryId === undefined && testId === undefined) {
      // Run all tests
      const results = await runAllTests(apiKey);
      return res.json({ results });
    }

    if (testId !== undefined) {
      // Run specific test
      const category = testCategories[categoryId];
      const test = category.tests.find(t => t.id === testId);

      if (!test) {
        return res.status(404).json({ error: 'Test not found' });
      }

      const result = await runTest(test, apiKey);
      return res.json({ result });
    }

    // Run category tests
    const results = await runCategoryTests(categoryId, apiKey);
    res.json({ results });
  });
  
  // Save snapshot
  app.post('/v1/test/snapshot', async (req: Request, res: Response) => {
    const { name, type, data } = req.body;
    
    if (!name || !type) {
      return res.status(400).json({ 
        success: false, 
        error: 'name and type are required' 
      });
    }
    
    const result = await saveSnapshot(name, type, data);
    res.json(result);
  });
  
  // Get snapshot
  app.get('/v1/test/snapshot/:name', async (req: Request, res: Response) => {
    const { name } = req.params;

    // SECURITY FIX (Standard 131): Validate snapshot name to prevent path traversal
    // Only allow alphanumeric, hyphens, and underscores
    if (typeof name !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(name)) {
      return res.status(400).json({ error: 'Invalid snapshot name. Only alphanumeric, hyphens, and underscores allowed.' });
    }
    
    const snapshotPath = path.join(process.cwd(), 'logs', `snapshot-${name}.json`);

    if (!fs.existsSync(snapshotPath)) {
      return res.status(404).json({ error: 'Snapshot not found' });
    }

    const data = fs.readFileSync(snapshotPath, 'utf-8');
    res.json(JSON.parse(data));
  });
  
  // List snapshots
  app.get('/v1/test/snapshots', async (_req: Request, res: Response) => {
    const logsDir = path.join(process.cwd(), 'logs');
    
    if (!fs.existsSync(logsDir)) {
      return res.json({ snapshots: [] });
    }
    
    const files = fs.readdirSync(logsDir)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .map(f => ({
        name: f.replace('snapshot-', '').replace('.json', ''),
        file: f,
        path: path.join(logsDir, f)
      }));
    
    res.json({ snapshots: files });
  });
}

export { testCategories, runTest, runCategoryTests, runAllTests, saveSnapshot };
