# Standard 014: Operational Visibility

**Status:** Active
**Date:** 2026-03-22
**Supersedes:** N/A

## Context
Anchor Engine runs as a background service. Operators need visibility into startup status, health, and ongoing operations for debugging and monitoring.

## Pain Points Fixed
- Commit `dc072f9`: No startup confirmation made it unclear if engine started
- Commit `7ef1bd1`: No health endpoint for Docker health checks
- Commit `bbc7d04`: No ingestion progress tracking
- Commit `bbc7d04`: No agent discovery for multi-agent setups

## Requirements

### OPS-001: Startup Banner
Every service must print a startup banner showing:
- Version
- Database status (atom count)
- Watchdog status (paths being watched)
- API key status
- Health endpoint URL
- Startup time

```
⚓ Anchor Engine v4.9.0
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Database: 30,922 atoms
✅ Watchdog: active, watching 3 paths
✅ API key: set
✅ Health: http://localhost:3161/health
⏱️  Startup complete in 7.4s
```

### OPS-002: Health Endpoint
1. `GET /health` must return 200 healthy or 503 unhealthy
2. Verify database connectivity
3. Check critical directories exist
4. Docker health check compatible

```json
// Response
{
  "status": "healthy",
  "timestamp": "2026-03-22T05:32:31.839Z",
  "message": "Anchor Context Engine is running and database is responsive"
}
```

### OPS-003: Progress Tracking
1. Long operations must report progress
2. `GET /v1/ingest/status` returns current operation
3. Include files processed/total
4. Include estimated time remaining for large operations

```json
// Response
{
  "active": true,
  "state": "ingesting",
  "currentFile": "large-file.jsonl",
  "processed": 45,
  "total": 100,
  "atomsCreated": 1234,
  "startedAt": "2026-03-22T05:30:00.000Z",
  "queueDepth": 5
}
```

### OPS-004: Agent Discovery
1. `GET /v1/agent/discover` returns detected AI agents
2. Auto-detect common agent chat directories
3. Show watch status for each agent
4. Enable easy multi-agent setup

```json
// Response
{
  "status": "success",
  "count": 2,
  "agents": [
    {
      "id": "qwen",
      "name": "Qwen Code",
      "path": "/home/user/.qwen/chats",
      "sessionCount": 18,
      "isWatched": true
    },
    {
      "id": "claude",
      "name": "Claude",
      "path": "/home/user/.claude/chats",
      "sessionCount": 5,
      "isWatched": false
    }
  ]
}
```

### OPS-005: Background Startup Scripts (v5.2.0+)

**Purpose**: Agent-friendly background startup and shutdown for reliable Windows 11 execution.

**Scripts** (choose platform-native approach):

#### PowerShell Scripts (Windows, Recommended)

1. **`start-engine-bg.ps1`** - Background startup
   - Starts engine via `pnpm start`, captures output to `engine-start.log`
   - Detects port 3160 conflicts before starting
   - Polls `GET /health` until ready (~10s)
   - Exits immediately after confirming health check passes

2. **`stop-engine-bg.ps1`** - Graceful shutdown
   - Finds engine by port (netstat)
   - Sends SIGTERM first, force kills after 15s if unresponsive

**PowerShell Usage** (Windows):
```powershell
# Start the engine (agent continues immediately)
.\start-engine-bg.ps1

# Output:
# Starting Anchor Engine in background...
# Log file: C:\...\anchor-engine-node\engine-start.log
# Waiting for engine to become healthy (max 30s)...
# Engine is healthy on http://localhost:3160/ (took 9.7s)
# Log file: C:\...\anchor-engine-node\engine-start.log
# To stop: .\stop-engine-bg.ps1

# Stop the engine (agent continues immediately)
.\stop-engine-bg.ps1
```

**Benefits for Agents**:
- No blocking console output
- Windows-native process management
- Automatic build verification
- Port conflict resolution
- Persistent logging to `engine-start.log`

#### Node.js Scripts (Cross-platform)

1. **`scripts/start-engine-bg.mjs`** - Agent-friendly background startup
   - Verifies `engine/dist/index.js` exists before starting
   - Detects port 3160 conflicts, finds available port automatically
   - Logs all output to `.anchor/logs/start-{timestamp}.log`
   - Exits immediately after server is ready (agents can continue)
   - Waits for health check before confirming success

2. **`scripts/stop-engine-bg.mjs`** - Graceful shutdown by process
   - Finds engine by listening to port 3160 (cross-platform PID detection)
   - Graceful SIGTERM shutdown first, force kill if needed
   - Logs all operations to `.anchor/logs/stop-{timestamp}.log`

**Node.js Usage** (Cross-platform):
```bash
# Start the engine (agent continues immediately)
node scripts/start-engine-bg.mjs

// Output:
// ========================================
// [2026-06-03T...] Checking build status...
// ✅ Engine already built
// [2026-06-03T...] Checking port availability...
// ✅ Port 3160 is available
// [2026-06-03T...] Starting engine process...
// [2026-06-03T...] Waiting for server to be ready...
// ========================================
// ✅ Anchor Engine started successfully!
// Server: http://localhost:3160
// Health: http://localhost:3160/health
// Logs: .anchor/logs/
// ========================================
// 👋 Exiting - engine running in background

# Stop the engine (agent continues immediately)
node scripts/stop-engine-bg.mjs
```

## Implementation Notes
- Startup banner in `engine/src/utils/startup-banner.ts`
- Health endpoint in `engine/src/routes/health.ts`
- Ingestion status in `engine/src/routes/v1/ingest.ts`
- Agent discovery in `engine/src/routes/v1/agent.ts`
- PowerShell background scripts: `start-engine-bg.ps1`, `stop-engine-bg.ps1`
- Node.js background scripts: `scripts/start-engine-bg.mjs`, `scripts/stop-engine-bg.mjs`### 3.3 Modified File: Enhanced Watchdog Status API

**Path:** `engine/src/services/ingest/watchdog.ts` - Add to existing functions

```typescript
/**
 * Enhanced status tracking for watchdog operations
 */

interface IngestionProgress {
  state: 'idle' | 'scanning' | 'processing' | 'completed' | 'error';
  currentFile?: string;
  filesScanned: number;
  filesProcessed: number;
  filesSuccessful: number;
  filesFailed: number;
  errors: IngestionError[];
  startTime?: Date;
  completedTime?: Date;
}

interface IngestionError {
  filePath: string;
  error: string;
  category: 'network' | 'disk' | 'parse' | 'timeout' | 'config' | 'unknown';
  retryable: boolean;
}

// Add to existing imports
import { 
  validateIngestionPrerequisites, 
  formatUserFriendlyError,
  createIngestionSummary,
  IngestionProgress,
  IngestionError 
} from './validation.js';
import { categorizeError } from './error-handler.js';

/**
 * Enhanced watchdog status with detailed progress tracking
 */
export function getEnhancedWatcherStatus(): {
  isRunning: boolean;
  watchedPaths: string[];
  ingestionProgress?: IngestionProgress;
} {
  if (!watcher) {
    return {
      isRunning: false,
      watchedPaths: [PATHS.INBOX_DIR, PATHS.EXTERNAL_INBOX_DIR, ...(config.WATCHER_EXTRA_PATHS || [])],
    };
  }

  // Check if currently processing a file
  const status = systemStatus.getStatus();
  
  let progress: IngestionProgress | undefined;
  
  if (status.state === 'ingesting' && status.currentIngestion) {
    progress = {
      state: 'processing',
      currentFile: status.activeTask,
      filesScanned: status.currentIngestion?.filesProcessed || 0,
      filesProcessed: status.currentIngestion?.filesProcessed || 0,
      filesSuccessful: 0, // Would need to track separately
      filesFailed: 0,
      errors: [],
      startTime: status.currentIngestion?.startedAt,
    };
  } else if (status.state === 'idle' && status.lastIngestion) {
    progress = {
      state: 'completed',
      filesScanned: 0,
      filesProcessed: 0,
      filesSuccessful: 0,
      filesFailed: 0,
      errors: [],
      completedTime: status.lastIngestion,
    };
  }

  return {
    isRunning: watcher !== null,
    watchedPaths: [PATHS.INBOX_DIR, PATHS.EXTERNAL_INBOX_DIR, ...(config.WATCHER_EXTRA_PATHS || [])],
    ingestionProgress: progress,
  };
}

/**
 * Enhanced manual ingest with detailed error reporting and retry logic
 */
export async function triggerManualIngestWithValidation(
  targetPath?: string
): Promise<{ 
  status: 'success' | 'partial_success' | 'error';
  message: string;
  details?: IngestionProgress;
}> {
  console.log('\n🔍 [Watchdog] Starting manual ingestion with validation...\n');

  // Step 1: Pre-flight validation
  const validationResult = validateIngestionPrerequisites(targetPath);
  
  if (!validationResult.valid) {
    console.error('❌ [Watchdog] Pre-flight validation failed:\n');
    
    // Print each error with remediation
    validationResult.errors.forEach(err => {
      console.error(`   ${err.code}: ${err.message}`);
      if (err.suggestedFix) {
        console.error(`      → ${err.suggestedFix}`);
      }
    });

    return {
      status: 'error',
      message: `Validation failed with ${validationResult.errors.length} error(s). See details above.`,
      details: undefined,
    };
  }

  if (validationResult.warnings.length > 0) {
    console.warn('⚠️ [Watchdog] Warnings:\n');
    validationResult.warnings.forEach(w => console.warn(`   • ${w}`));
  }

  console.log('✅ [Watchdog] Pre-flight validation passed\n');

  // Step 2: Scan and process files with retry logic
  const result = await scanAndProcessFiles(targetPath);

  if (result.status === 'error') {
    return {
      status: 'error',
      message: `Ingestion failed: ${result.message}`,
      details: result.details,
    };
  }

  // Step 3: Generate summary
  const summary = createIngestionSummary({
    totalFiles: result.filesProcessed,
    processedFiles: result.filesProcessed,
    successfulFiles: result.filesSuccessful,
    failedFiles: result.filesFailed,
    errors: result.errors,
  });

  console.log('\n' + summary);

  if (result.filesFailed > 0) {
    return {
      status: 'partial_success',
      message: `Ingestion completed with ${result.filesFailed} failure(s). See details above.`,
      details: result.details,
    };
  }

  return {
    status: 'success',
    message: `Successfully ingested ${result.filesSuccessful} file(s)`,
    details: result.details,
  };
}

/**
 * Scan directory and process files with enhanced error handling
 */
async function scanAndProcessFiles(targetPath?: string): Promise<{
  status: 'success' | 'partial_success' | 'error';
  filesProcessed: number;
  filesSuccessful: number;
  filesFailed: number;
  errors: IngestionError[];
  details?: IngestionProgress;
}> {
  const errors: IngestionError[] = [];
  let filesProcessed = 0;
  let filesSuccessful = 0;
  let filesFailed = 0;

  // Determine paths to scan
  const pathsToScan: string[] = [];
  
  if (targetPath && fs.existsSync(targetPath)) {
    pathsToScan.push(targetPath);
  } else {
    pathsToScan.push(PATHS.INBOX_DIR, PATHS.EXTERNAL_INBOX_DIR);
  }

  // Add extra watched paths
  const extraPaths = config.WATCHER_EXTRA_PATHS || [];
  for (const p of extraPaths) {
    if (fs.existsSync(p)) {
      pathsToScan.push(p);
    }
  }

  console.log(`📂 [Watchdog] Scanning ${pathsToScan.length} path(s)...`);

  // Process each path
  for (const scanPath of pathsToScan) {
    if (!fs.existsSync(scanPath)) {
      console.log(`   ⚠️ Skipping non-existent path: ${scanPath}`);
      continue;
    }

    const files = fs.readdirSync(scanPath, { recursive: true }) as string[];
    
    for (const file of files) {
      const filePath = path.join(scanPath, file);

      // Skip directories and ignored patterns
      if (fs.statSync(filePath).isDirectory()) continue;
      if (IGNORE_PATTERNS.test(file)) continue;

      filesProcessed++;
      
      try {
        const result = await processFileWithRetry(filePath, 'manual');
        
        if (result.ingested) {
          filesSuccessful++;
          console.log(`   ✅ ${filePath}`);
        } else {
          // Track skipped files but don't count as failures
          console.log(`   ⏭️ Skipped: ${filePath} - ${result.reason}`);
        }

      } catch (error: any) {
        const enhancedError = categorizeError(error);
        
        errors.push({
          filePath,
          error: formatUserFriendlyError(enhancedError),
          category: enhancedError.category,
          retryable: isRetryableError(error, ['network', 'timeout']),
        });

        filesFailed++;
        console.error(`   ❌ ${filePath}`);
        console.error(`      ${formatUserFriendlyError(enhancedError)}`);
        
        // Log but continue processing other files
      }
    }
  }

  const status = errors.length === 0 ? 'success' : 
                  filesSuccessful > 0 ? 'partial_success' : 'error';

  return {
    status,
    filesProcessed,
    filesSuccessful,
    filesFailed: errors.length,
    errors,
    details: {
      state: 'completed',
      filesScanned: filesProcessed,
      filesProcessed,
      filesSuccessful,
      filesFailed: errors.length,
      errors,
    },
  };
}

/**
 * Process single file with retry logic for transient errors
 */
async function processFileWithRetry(
  filePath: string, 
  event: string,
  maxRetries = 2
): Promise<{ ingested: boolean; reason?: string }> {
  
  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const result = await processFile(filePath, event);
      
      if (result.ingested) {
        return result;
      } else {
        // File was skipped intentionally - not an error
        return result;
      }

    } catch (error: any) {
      // Check if this is a retryable error
      const enhancedError = categorizeError(error);
      
      if (!isRetryableError(error, ['network', 'timeout'])) {
        // Non-retryable error - rethrow immediately
        throw error;
      }

      console.log(`   ⏳ Retry ${attempt}/${maxRetries + 1} for: ${filePath}`);
      
      if (attempt < maxRetries + 1) {
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }

  // If we get here, all retries failed - throw the last error
  throw new Error(`Failed to process ${filePath} after ${maxRetries + 1} attempts`);
}

/**
 * Export original triggerManualIngest for backward compatibility
 */
export async function triggerManualIngest(): Promise<{ status: string; message: string; filesProcessed?: number; filesIngested?: number }> {
  // Call the new enhanced version and map result to old format
  const result = await triggerManualIngestWithValidation();
  
  return {
    status: result.status === 'success' ? 'success' : 
             result.status === 'partial_success' ? 'warning' : 'error',
    message: result.message,
    filesProcessed: result.details?.filesProcessed,
    filesIngested: result.details?.filesSuccessful,
  };
}
```

### 3.4 Modified File: Enhanced Live-Fire Test

**Path:** `engine/tests/integration/live-fire.test.ts` - Key modifications

```typescript
/**
 * Enhanced test with better error handling and user feedback
 */

// Add new helper functions at top of file

/**
 * Run a step with timeout and detailed error reporting
 */
async function runStepWithTimeout(
  label: string, 
  operation: () => Promise<void>, 
  timeoutMs: number,
  cleanup?: () => void
): Promise<void> {
  console.log(`\n📍 [Test] Step: ${label}`);
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    await operation();
    clearTimeout(timeoutId);
    console.log(`✅ [Test] Completed: ${label}`);
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    // Provide context-aware error message
    let errorMessage = error.message;
    
    if (error.name === 'AbortError') {
      errorMessage = `Step timed out after ${timeoutMs}ms: ${label}`;
      
      // Add specific hints based on step type
      if (label.includes('clone')) {
        errorMessage += '\n   Hint: Check internet connection and GitHub API rate limits';
      } else if (label.includes('ingestion') || label.includes('watchdog')) {
        errorMessage += '\n   Hint: Server may be under load. Try reducing dataset size.';
      }
    }

    console.error(`❌ [Test] FAILED: ${errorMessage}`);
    
    // Run cleanup if provided
    if (cleanup) {
      try {
        await cleanup();
      } catch (cleanupError) {
        console.warn('   Cleanup also failed:', cleanupError.message);
      }
    }

    throw error;
  }
}

/**
 * Enhanced clone operation with validation and retry
 */
async function cloneRepositoryWithValidation(): Promise<void> {
  const GITHUB_REPO = 'RSBalchII/anchor-engine-node';
  const CLONE_DIR = join(PROJECT_ROOT, '.anchor', 'notebook', 'external-inbox', 'anchor-engine-node');

  console.log(`\n📦 [Live Fire] Cloning ${GITHUB_REPO}...`);

  // Remove existing clone if any
  if (existsSync(CLONE_DIR)) {
    console.log('🗑️  Removing existing clone...');
    rmSync(CLONE_DIR, { recursive: true, force: true });
  }

  try {
    await runStepWithTimeout(
      'git clone',
      async () => {
        const { execAsync } = await import('child_process');
        const cloneCommand = `git clone --depth 1 https://github.com/${GITHUB_REPO}.git "${CLONE_DIR}"`;
        
        // Use exec with timeout and error handling
        const { stdout, stderr } = await execAsync(cloneCommand, {
          timeout: CLONE_TIMEOUT_MS,
          cwd: PROJECT_ROOT,
        });

        console.log(`✅ Clone complete`);
      },
      CLONE_TIMEOUT_MS,
      () => {
        // Cleanup on failure - remove partial clone
        if (existsSync(CLONE_DIR)) {
          rmSync(CLONE_DIR, { recursive: true, force: true });
        }
      }
    );

  } catch (error: any) {
    console.error(`\n❌ Clone failed:`);
    console.error(`   Error: ${error.message}`);
    
    // Provide helpful remediation
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.error('   💡 Remediation:');
      console.error('   • Check internet connection');
      console.error('   • Try again later for rate limit issues');
      console.error('   • Use a smaller depth (--depth 1) if already attempted');
    }

    throw error;
  }
}

/**
 * Enhanced ingestion monitoring with progress display
 */
async function monitorIngestionWithProgress(): Promise<void> {
  const CLONE_DIR = join(PROJECT_ROOT, '.anchor', 'notebook', 'external-inbox', 'anchor-engine-node');
  
  console.log('\n🔄 [Live Fire] Monitoring watchdog ingestion...');

  let totalFiles = 0;
  let processedFiles = 0;
  let errors = 0;
  let lastProgressLog = Date.now();

  await runStepWithTimeout(
    'watchdog ingestion',
    async () => {
      const INGESTION_TIMEOUT_MS = 600_000; // 10 minutes
      
      while (Date.now() - startWait < INGESTION_TIMEOUT_MS) {
        try {
          const status = await getIngestionStatus();
          
          if (status?.state === 'idle' || status?.state === 'completed') {
            break;
          }

          // Get progress from system-status endpoint
          const progress = await getIngestionProgress();
          
          totalFiles = progress?.totalFiles || 0;
          processedFiles = progress?.processedFiles || 0;
          errors = progress?.errors?.length || 0;

          // Log progress every 5 seconds or when significant change occurs
          if (Date.now() - lastProgressLog >= 5_000) {
            const pct = totalFiles > 0 ? Math.round((processedFiles / totalFiles) * 100) : 0;
            
            // Use emoji for visual progress bar
            const barWidth = 20;
            const filled = Math.floor((pct / 100) * barWidth);
            const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
            
            console.log(`   [${bar}] ${processedFiles}/${totalFiles} files (${pct}%) | Errors: ${errors}`);
            lastProgressLog = Date.now();
          }

        } catch (error: any) {
          // Log but continue polling on transient errors
          if (!error.message.includes('timeout')) {
            console.warn(`   ⚠️ Status check failed: ${error.message}`);
          }
        }

        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
      }

    },
    INGESTION_TIMEOUT_MS,
    undefined // No cleanup needed for ingestion monitoring
  );

  console.log(`✅ Ingestion completed in ${(Date.now() - startWait)/1000}s`);
}

// Update test functions to use enhanced helpers

it('should clone the anchor-engine-node repository', async () => {
  await runStepWithTimeout(
    'clone repository',
    cloneRepositoryWithValidation,
    CLONE_TIMEOUT_MS,
    () => {
      // Cleanup on failure
      if (existsSync(CLONE_DIR)) {
        rmSync(CLONE_DIR, { recursive: true, force: true });
      }
    }
  );

  expect(existsSync(CLONE_DIR)).toBe(true);
  expect(existsSync(join(CLONE_DIR, 'package.json'))).toBe(true);
}, CLONE_TIMEOUT_MS);

it('should complete ingestion within timeout', async () => {
  await runStepWithTimeout(
    'watchdog ingestion',
    monitorIngestionWithProgress,
    INGESTION_TIMEOUT_MS
  );

  // Verify final state
  const status = await getIngestionStatus();
  expect(status?.state).toBe('idle' || 'completed');
  
  const progress = await getIngestionProgress();
  expect(progress?.processedFiles).toBeGreaterThan(0);
}, INGESTION_TIMEOUT_MS);

// Add similar enhancements to other test functions...
```

### 3.5 New File: API Route Enhancements

**Path:** `engine/src/routes/v1/system.ts` - Add enhanced endpoints

```typescript
/**
 * Enhanced watchdog status endpoint with detailed progress
 */
app.get('/v1/watchdog/status', async (_req: Request, res: Response) => {
  try {
    const { getEnhancedWatcherStatus } = await import('../../services/ingest/watchdog.js');
    const status = getEnhancedWatcherStatus();
    
    // Format for API response
    const formattedStatus = {
      isRunning: status.isRunning,
      watchedPaths: status.watchedPaths,
      ingestionProgress: status.ingestionProgress ? {
        state: status.ingestionProgress.state,
        currentFile: status.ingestionProgress.currentFile,
        filesScanned: status.ingestionProgress.filesScanned,
        filesProcessed: status.ingestionProgress.filesProcessed,
        filesSuccessful: status.ingestionProgress.filesSuccessful,
        filesFailed: status.ingestionProgress.filesFailed,
        errors: status.ingestionProgress.errors.map(e => ({
          filePath: e.filePath,
          error: e.error,
          category: e.category,
          retryable: e.retryable,
        })),
      } : undefined,
    };

    res.status(200).json({ 
      status: 'success', 
      ...formattedStatus 
    });
  } catch (error: any) {
    // Return structured error with remediation hints
    const enhancedError = categorizeError(error);
    
    res.status(500).json({
      error: formatUserFriendlyError(enhancedError),
      details: {
        code: enhancedError.code,
        category: enhancedError.category,
      },
    });
  }
});

/**
 * Pre-flight validation endpoint for watchdog operations
 */
app.post('/v1/watchdog/validate', async (_req: Request, res: Response) => {
  try {
    const { targetPath } = req.body;
    
    const { validateIngestionPrerequisites } = await import('../../services/ingest/validation.js');
    const validationResult = validateIngestionPrerequisites(targetPath);

    res.status(200).json({
      status: 'success',
      valid: validationResult.valid,
      errors: validationResult.errors.map(e => ({
        code: e.code,
        message: e.message,
        suggestedFix: e.suggestedFix,
      })),
      warnings: validationResult.warnings,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Enhanced manual ingest endpoint with validation and detailed output
 */
app.post('/v1/watchdog/ingest', async (_req: Request, res: Response) => {
  try {
    const { targetPath } = req.body;
    
    console.log('[Watchdog API] Starting ingestion...');

    const { triggerManualIngestWithValidation } = await import('../../services/ingest/watchdog.js');
    const result = await triggerManualIngestWithValidation(targetPath);

    res.status(200).json(result);
  } catch (error: any) {
    // Return structured error with remediation hints
    const enhancedError = categorizeError(error);
    
    console.error('[Watchdog API] Ingestion failed:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: formatUserFriendlyError(enhancedError),
      details: {
        code: enhancedError.code,
        category: enhancedError.category,
        retryable: isRetryableError(error),
      },
    });
  }
});

/**
 * Clone repository endpoint with validation and progress tracking
 */
app.post('/v1/github/clone', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Repository URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ 
        error: 'Invalid repository URL',
        message: 'URL must be a valid GitHub repository address',
      });
    }

    console.log('[GitHub API] Starting clone operation...');

    // This would implement actual git clone with progress tracking
    // For now, return validation success
    res.status(202).json({
      status: 'accepted',
      message: `Clone operation started for ${url}`,
      estimatedTimeSeconds: 60, // Rough estimate
    });

  } catch (error: any) {
    console.error('[GitHub API] Clone failed:', error.message);
    
    res.status(500).json({
      status: 'error',
      message: `Failed to start clone operation: ${error.message}`,
    });
  }
});
```

---

## 4. Test Scenarios to Verify Fixes

### 4.1 Pre-Flight Validation Tests

#### Scenario A: Missing Target Directory
**Setup:** Remove `.anchor/notebook/external-inbox/anchor-engine-node`  
**Expected Behavior:**
- API returns `400 Bad Request` with clear error message
- Message includes clone instructions
- No ingestion attempt is made

```bash
# Test via API
curl -X POST http://localhost:3160/v1/watchdog/validate \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d '{"targetPath": "/nonexistent/path"}'

# Expected response:
{
  "status": "success",
  "valid": false,
  "errors": [
    {
      "code": "DIRECTORY_NOT_FOUND",
      "message": "Target directory does not exist: /nonexistent/path",
      "suggestedFix": "To create this directory, run:\n\ngit clone --depth 1 https://github.com/RSBalchII/anchor-engine-node.git \"/nonexistent/path\"\n\nOr use the engine's GitHub ingestion API endpoint."
    }
  ]
}
```

#### Scenario B: Empty Directory
**Setup:** Create empty directory  
**Expected Behavior:**
- Warning shown about empty directory
- Ingestion proceeds but reports 0 files processed

### 4.2 Watchdog Status Monitoring Tests

#### Scenario C: Idle State Display
**Expected Behavior:**
- API returns `state: 'idle'` with no active task
- UI shows "Ready for ingestion" message
- No progress bar shown (or empty)

#### Scenario D: Processing State Display  
**Expected Behavior:**
- API returns `state: 'processing'` with current file name
- Progress bar updates every 5 seconds
- Error count displayed if failures occur

```json
{
  "isRunning": true,
  "watchedPaths": ["/path/to/inbox", "/path/to/external-inbox"],
  "ingestionProgress": {
    "state": "processing",
    "currentFile": "engine/src/services/ingest/watchdog.ts",
    "filesScanned": 150,
    "filesProcessed": 42,
    "filesSuccessful": 40,
    "filesFailed": 2,
    "errors": [
      {
        "filePath": "/path/to/file.json",
        "error": "❌ JSON parse error: Unexpected token\n💡 Suggested fixes:\n   • The file content could not be parsed\n   • Check that the file format is valid",
        "category": "parse",
        "retryable": false
      }
    ]
  }
}
```

#### Scenario E: Timeout Detection
**Setup:** Simulate slow ingestion (15+ minutes)  
**Expected Behavior:**
- Test receives timeout error after configured limit
- Error message includes specific hints about what might have gone wrong
- Cleanup of partial state performed

### 4.3 Error Handling Tests

#### Scenario F: Network Timeout During Ingestion
**Setup:** Disconnect network during ingestion  
**Expected Behavior:**
- Retry logic kicks in (up to 3 attempts)
- After retries exhausted, user-friendly error shown
- Other files continue processing if possible

```json
{
  "status": "partial_success",
  "message": "Ingestion completed with 5 failure(s). See details above.",
  "details": {
    "filesProcessed": 100,
    "filesSuccessful": 95,
    "filesFailed": 5,
    "errors": [
      {
        "filePath": "/path/to/file.md",
        "error": "❌ Network timeout: Connection timed out\n💡 Suggested fixes:\n   • The operation took too long to complete\n   • Check if the server is under heavy load\n   • Try reducing the content size or complexity",
        "category": "timeout",
        "retryable": true
      }
    ]
  }
}
```

#### Scenario G: Parse Error Recovery
**Setup:** Include malformed JSON file in inbox  
**Expected Behavior:**
- File is skipped with clear error message
- Other files continue processing normally
- Summary shows parse errors count

### 4.4 Live-Fire Test Integration Tests

#### Scenario H: Full End-to-End Success Path
**Steps:**
1. Server starts successfully
2. Repo clone completes
3. Watchdog ingests all files
4. Search queries return results

**Expected:** All tests pass, timing within limits

#### Scenario I: Partial Failure with Graceful Degradation
**Setup:** Simulate network issue during clone  
**Expected Behavior:**
- Clone step fails with clear error message
- Test reports failure but doesn't crash entire suite
- Other independent tests can still run (if test isolation configured)

#### Scenario J: Timeout Handling
**Setup:** Slow ingestion (>10 minutes)  
**Expected Behavior:**
- Test times out gracefully after limit
- Error message includes context ("Ingestion step timed out")
- Cleanup removes partial state
- Test suite continues with remaining tests

---

## 5. Implementation Effort Estimates

### 5.1 Effort Breakdown

| Component | Files Changed/Added | Complexity | Estimated Hours |
|-----------|---------------------|------------|-----------------|
| **Pre-Flight Validation** | 1 new file | Medium | 3-4 |
| **Error Handler Module** | 1 new file | Medium | 2-3 |
| **Enhanced Watchdog Status** | Modify existing | High | 4-5 |
| **Live-Fire Test Improvements** | Modify existing | Medium | 3-4 |
| **API Route Enhancements** | Modify existing | Medium | 2-3 |
| **Documentation Updates** | Update docs/ | Low | 1-2 |
| **Testing & QA** | Add tests | High | 6-8 |
| **Total** | - | - | **21-29 hours** |

### 5.2 Priority Phasing

#### Phase 1: Critical Fixes (4-6 hours)
- Pre-flight validation module
- Basic error categorization
- Enhanced watchdog status endpoint

#### Phase 2: User Experience Improvements (8-10 hours)
- Retry logic for transient errors
- Progress tracking with visual indicators
- Live-fire test enhancements

#### Phase 3: Advanced Features (9-13 hours)
- Detailed API responses with remediation hints
- Clone repository endpoint
- Comprehensive documentation
- Full test suite

---

## 6. Success Criteria

### 6.1 Functional Requirements

✅ Pre-flight validation catches missing directories before ingestion starts  
✅ Error messages are user-friendly and include actionable fixes  
✅ Retry logic handles transient network/disk errors gracefully  
✅ Progress indicators show what's happening at each step  
✅ Live-fire tests provide clear feedback on failures  

### 6.2 Non-Functional Requirements

✅ No silent failures - all errors produce visible output  
✅ Timeout handling includes context-aware messages  
✅ Partial ingestion reports successes and failures separately  
✅ API responses are structured for programmatic consumption  
✅ Code changes maintain backward compatibility  

---

## 7. Rollback Plan

If issues arise during deployment:

1. **Revert specific files:**
   - `engine/src/services/ingest/validation.ts` (new)
   - `engine/src/services/ingest/error-handler.ts` (new)
   - `engine/src/services/ingest/watchdog.ts` (modified)
   - `engine/tests/integration/live-fire.test.ts` (modified)

2. **Database migrations:** None required (no schema changes)

3. **Configuration changes:** None required (uses existing config structure)

---

## 8. Related Documentation

- [Standard 051: Pointer-Only Storage](specs/current-standards/database-memory/021-pointer-only-storage.md)
- [Standard 019: Test Environment Consistency](specs/current-standards/testing/019-test-environment-consistency.md)
- [Operations Logging Standard 027](specs/current-standards/operations-logging/027-pain-point-logging.md)

---

**Document Version:** 1.0  
**Last Updated:** 2026-05-19  
**Next Review:** After implementation completion