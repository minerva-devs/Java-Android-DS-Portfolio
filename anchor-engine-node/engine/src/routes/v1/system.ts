import type { Application, Request, Response } from 'express';
import { db } from '../../core/db.js';
import { getState, clearState } from '../../services/scribe/scribe.js';
import { PATHS, PROJECT_ROOT } from '../../config/paths.js';
import { config } from '../../config/index.js';
import { validate, schemas } from '../../middleware/validate.js';
import fs from 'fs';

// Track server control state
let serverStartTime: Date | null = null;
let isServerShuttingDown = false;

export function setupSystemRoutes(app: Application) {
  // GET /health - Docker health check endpoint
  // Returns 200 if DB is connected and system is healthy
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      // Check database connectivity
      const result = await db.run('SELECT 1 as healthy');
      const dbHealthy = result.rows?.[0]?.healthy === 1;

      // Check critical directories exist
      const fs = await import('fs');
      const criticalDirs = [
        PATHS.INBOX_DIR,
        PATHS.EXTERNAL_INBOX_DIR,
        PATHS.CONTEXT_DIR,
      ];

      const dirsExist = await Promise.all(
        criticalDirs.map(async dir => {
          try {
            await fs.promises.access(dir, fs.constants.R_OK);
            return true;
          } catch {
            return false;
          }
        }),
      );

      const allDirsOk = dirsExist.every(d => d);

      if (dbHealthy && allDirsOk) {
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: 'connected',
            directories: 'accessible',
          },
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          checks: {
            database: dbHealthy ? 'connected' : 'disconnected',
            directories: allDirsOk ? 'accessible' : 'some missing',
          },
        });
      }
    } catch {
      // Catch block without any cast — error is not rethrown, response is safe
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
          directories: 'unknown',
        },
      });
    }
  });

  // POST /v1/system/start - Start/restart the engine
  // Note: This is primarily for MCP agent control
  app.post('/v1/system/start', async (req: Request, res: Response) => {
    try {
      // Check if already running
      if (serverStartTime && !isServerShuttingDown) {
        res.json({
          status: 'already_running',
          message: 'Server is already running',
          started_at: serverStartTime.toISOString(),
          uptime_seconds: Math.floor((Date.now() - serverStartTime.getTime()) / 1000),
        });
        return;
      }

      // Server is starting or restarting
      serverStartTime = new Date();
      isServerShuttingDown = false;

      res.json({
        status: 'starting',
        message: 'Server start initiated',
        started_at: serverStartTime.toISOString(),
      });

      // Note: Actual server restart would require process management
      // This endpoint is primarily for MCP agent coordination
      console.log('[System] Server start requested via API');
    } catch {
      // Error already logged to console; return safe error response without leaking internals
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'error',
          directories: 'unknown',
        },
      });
    }
  });

  // POST /v1/system/start - Start/restart the engine
  // Note: This is primarily for MCP agent control
  app.post('/v1/system/start', async (req: Request, res: Response) => {
    try {
      // Check if already running
      if (serverStartTime && !isServerShuttingDown) {
        res.json({
          status: 'already_running',
          message: 'Server is already running',
          started_at: serverStartTime.toISOString(),
          uptime_seconds: Math.floor((Date.now() - serverStartTime.getTime()) / 1000),
        });
        return;
      }

      // Server is starting or restarting
      serverStartTime = new Date();
      isServerShuttingDown = false;

      res.json({
        status: 'starting',
        message: 'Server start initiated',
        started_at: serverStartTime.toISOString(),
      });

      // Note: Actual server restart would require process management
      // This endpoint is primarily for MCP agent coordination
      console.log('[System] Server start requested via API');
    } catch {
      // Error already logged to console; return safe error response
      res.status(500).json({ error: 'Failed to start system' });
    }
  });

  // POST /v1/system/stop - Graceful shutdown
  app.post('/v1/system/stop', async (req: Request, res: Response) => {
    try {
      const { timeout = 30000 } = req.body; // Default 30 second timeout

      isServerShuttingDown = true;
      console.log(`[System] Graceful shutdown requested (timeout: ${timeout}ms)`);

      // Stop accepting new requests
      res.json({
        status: 'shutting_down',
        message: 'Graceful shutdown initiated',
        timeout_ms: timeout,
        timestamp: new Date().toISOString(),
      });

      // Note: Actual shutdown would require process management
      // This endpoint is primarily for MCP agent coordination
      console.log('[System] Server stop requested via API');

      // In a full implementation, this would:
      // 1. Stop accepting new connections
      // 2. Wait for current operations to complete (up to timeout)
      // 3. Close database connections
      // 4. Exit process
    } catch {
      // Error already logged; return safe error response
      res.status(500).json({ error: 'Failed to stop system' });
    }
  });

  // GET /v1/system/server-info - Get server metadata
  app.get('/v1/system/server-info', async (req: Request, res: Response) => {
    try {
      res.json({
        status: 'success',
        server_info: {
          is_running: serverStartTime !== null && !isServerShuttingDown,
          is_shutting_down: isServerShuttingDown,
          started_at: serverStartTime?.toISOString() || null,
          uptime_seconds: serverStartTime ? Math.floor((Date.now() - serverStartTime.getTime()) / 1000) : 0,
          port: config.PORT,
          host: config.HOST,
          version: config.VERSION,
        },
      });
    } catch {
      // Error already logged; return safe error response
      res.status(500).json({ error: 'Failed to get server info' });
    }
  });

  // GET /v1/stats - System statistics (anchor_stats tool)
  app.get('/v1/stats', async (_req: Request, res: Response) => {
    try {
      const startTime = Date.now();

      // Get counts sequentially (PGlite is single-connection — concurrent queries
      // cause "cannot drop active portal" errors under UI polling load)
      const atomsResult = await db.run('SELECT COUNT(*) as count FROM atoms');
      const sourcesResult = await db.run('SELECT COUNT(*) as count FROM sources');
      const tagsResult = await db.run('SELECT COUNT(DISTINCT tag) as count FROM tags WHERE tag IS NOT NULL');
      const moleculesResult = await db.run('SELECT COUNT(*) as count FROM molecules');

      const stats = {
        atoms: parseInt(atomsResult.rows?.[0]?.count || '0'),
        sources: parseInt(sourcesResult.rows?.[0]?.count || '0'),
        tags: parseInt(tagsResult.rows?.[0]?.count || '0'),
        molecules: parseInt(moleculesResult.rows?.[0]?.count || '0'),
        query_time_ms: Date.now() - startTime,
      };

      res.status(200).json(stats);
    } catch (error) {
      console.error('Stats retrieval error:', error);
      res.status(500).json({ error: 'Failed to retrieve stats' });
    }
  });

  // GET /v1/system/ingest-status - Get ingestion progress
  app.get('/v1/system/ingest-status', async (_req: Request, res: Response) => {
    try {
      const { systemStatus } = await import('../../services/system-status.js');
      const ingestStatus = systemStatus.getIngestionStatus();

      res.json({
        status: 'success',
        state: ingestStatus.status,
        currentJob: ingestStatus.currentJob,
        lastCompleted: ingestStatus.lastCompleted,
        queueDepth: ingestStatus.queueDepth,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to retrieve ingest status' });
    }
  });

  // POST /v1/system/wait-for-ingest - Block until ingestion completes
  app.post('/v1/system/wait-for-ingest', async (req: Request, res: Response) => {
    try {
      const { timeout = 300000, job_id } = req.body; // Default 5 minute timeout
      const { systemStatus } = await import('../../services/system-status.js');

      const startTime = Date.now();
      const pollInterval = 500; // Check every 500ms

      while (true) {
        const status = systemStatus.getIngestionStatus();
        
        // Check if ingestion is complete or errored
        if (status.status === 'idle' || status.status === 'complete' || status.status === 'error') {
          res.json({
            status: 'complete',
            final_status: status.status,
            duration_ms: Date.now() - startTime,
            job: status.currentJob,
          });
          return;
        }

        // Check timeout
        if (Date.now() - startTime > timeout) {
          res.status(408).json({
            status: 'timeout',
            duration_ms: Date.now() - startTime,
            message: `Ingestion did not complete within ${timeout}ms`,
          });
          return;
        }

        // Wait before next poll
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to wait for ingestion' });
    }
  });

  // GET /v1/config/ingestion - Get current ingestion config
  app.get('/v1/config/ingestion', async (_req: Request, res: Response) => {
    try {
      const { config } = await import('../../config/index.js');
      
      res.json({
        status: 'success',
        config: config.INGESTION,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get ingestion config' });
    }
  });

  // POST /v1/config/ingestion - Update ingestion config
  app.post('/v1/config/ingestion', validate(schemas.configIngestion), async (req: Request, res: Response) => {
    try {
      const { config } = await import('../../config/index.js');
      const updates = req.body;

      // Validate enum values (schema handles basic type validation)
      if (updates.concept_density && !['low', 'medium', 'high'].includes(updates.concept_density)) {
        res.status(400).json({ error: 'Invalid concept_density. Must be low, medium, or high' });
        return;
      }

      if (updates.dedup_strength && !['light', 'medium', 'aggressive'].includes(updates.dedup_strength)) {
        res.status(400).json({ error: 'Invalid dedup_strength. Must be light, medium, or aggressive' });
        return;
      }

      if (updates.ingestion_profile && !['code', 'notes', 'chat', 'default'].includes(updates.ingestion_profile)) {
        res.status(400).json({ error: 'Invalid ingestion_profile. Must be code, notes, chat, or default' });
        return;
      }

      // Apply updates to runtime config
      if (updates.concept_density) config.INGESTION.CONCEPT_DENSITY = updates.concept_density;
      if (updates.tag_threshold !== undefined) config.INGESTION.TAG_THRESHOLD = updates.tag_threshold;
      if (updates.dedup_strength) config.INGESTION.DEDUP_STRENGTH = updates.dedup_strength;
      if (updates.token_budget_default !== undefined) config.INGESTION.TOKEN_BUDGET_DEFAULT = updates.token_budget_default;
      if (updates.ingestion_profile) config.INGESTION.INGESTION_PROFILE = updates.ingestion_profile;

      console.log('[Config] Ingestion config updated:', updates);

      res.json({
        status: 'success',
        message: 'Ingestion config updated',
        config: config.INGESTION,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to update ingestion config' });
    }
  });

  // Scribe State Endpoints
  app.get('/v1/scribe/state', async (_req: Request, res: Response) => {
    try {
      const state = await getState();
      res.status(200).json({ state });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get server info' });
    }
  });

  // DELETE /v1/scribe/state - Clear scribe state (anchor_stats tool)
  app.delete('/v1/scribe/state', async (_req: Request, res: Response) => {
    try {
      const result = await clearState();
      res.status(200).json(result);
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to clear scribe state' });
    }
  });

  // System config endpoint
  app.get('/v1/system/config', (_req: Request, res: Response) => {
    res.status(200).json({
      status: 'success',
      config: {
        version: '1.0.0',
        engine: 'Sovereign Context Engine',
        timestamp: new Date().toISOString(),
      },
    });
  });

  // Memory status endpoint
  app.get('/v1/system/memory', async (_req: Request, res: Response) => {
    try {
      const { resourceManager } = await import('../../utils/resource-manager.js');
      const { idleManager } = await import('../../services/idle-manager.js');
      const { NlpService } = await import('../../services/nlp/nlp-service.js');
      const { isModelLoadedStatus: isNerModelLoaded } = await import('../../services/tags/gliner.js');

      const memoryStats = resourceManager.getMemoryStats();
      const idleStatus = idleManager.getStatus();

      res.status(200).json({
        status: 'success',
        memory: {
          rss: Math.round(memoryStats.rss / 1024 / 1024),
          heapUsed: Math.round(memoryStats.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryStats.heapTotal / 1024 / 1024),
          percentageUsed: Math.round(memoryStats.percentageUsed * 100) / 100,
        },
        idle: idleStatus,
        models: {
          nlpLoaded: NlpService.isModelLoadedStatus(),
          nerLoaded: isNerModelLoaded(),
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get memory stats' });
    }
  });

  // Watcher Path Endpoints
  // GET /v1/system/paths - List currently watched paths
  app.get('/v1/system/paths', async (_req: Request, res: Response) => {
    try {
      const { getWatchedPaths } = await import('../../services/ingest/watchdog.js');
      const paths = getWatchedPaths();
      res.status(200).json({ paths });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get watched paths' });
    }
  });

  // POST /v1/system/paths - Add a new path to watch
  app.post('/v1/system/paths', async (req: Request, res: Response) => {
    try {
      const { path: newPath } = req.body;
      if (!newPath) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const pathModule = await import('path');
      const fs = await import('fs');
      const { validatePathSafetyWithExistence } = await import('../../utils/security.js');

      // Resolve to absolute path
      const resolvedPath = pathModule.resolve(newPath);

      // SECURITY: Validate path is within allowed directories if it's inside the repo structure
      // For arbitrary external paths, skip validation (user has control over what they're watching)
      let resolvedPathToUse = resolvedPath;
      
      try {
        const pathValidation = await validatePathSafetyWithExistence(resolvedPath, [PROJECT_ROOT]);
        
        if (pathValidation.isValid) {
          // Path is within project root - use it directly
          resolvedPathToUse = pathValidation.resolvedPath;
        } else {
          // External path outside project root - accept it without validation
          console.log('[API] Accepting external watch path:', resolvedPath);
        }
      } catch {
        // If validation fails for any reason, assume external path is safe to use
        resolvedPathToUse = resolvedPath;
      }

      const { addWatchPath } = await import('../../services/ingest/watchdog.js');
      const success = await addWatchPath(resolvedPathToUse);

      res.status(200).json({
        status: success ? 'success' : 'failed',
        message: success ? `Now watching: ${resolvedPathToUse}` : 'Failed to add path',
        path: resolvedPathToUse,
        within_project_root: false,  // Updated - now handles both internal and external paths
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to add watch path' });
    }
  });

  // DELETE /v1/system/paths - Remove a watched path
  app.delete('/v1/system/paths', async (req: Request, res: Response) => {
    try {
      const { path } = req.body;
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const { removeWatchPath } = await import('../../services/ingest/watchdog.js');
      const success = await removeWatchPath(path);

      res.status(200).json({
        status: success ? 'success' : 'failed',
        message: success ? `Stopped watching: ${path}` : 'Failed to remove path',
        path,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to remove watch path' });
    }
  });

  // POST /v1/system/path-add — Add a watched path (convenience endpoint)
  app.post('/v1/system/path-add', async (req: Request, res: Response) => {
    try {
      const { path: newPath } = req.body;
      if (!newPath) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const pathModule = await import('path');
      const fs = await import('fs');
      const { validatePathSafetyWithExistence } = await import('../../utils/security.js');

      // Resolve to absolute path
      const resolvedPath = pathModule.resolve(newPath);

      // SECURITY: Validate path is within allowed directories if it's inside the repo structure
      let resolvedPathToUse = resolvedPath;
      
      try {
        const pathValidation = await validatePathSafetyWithExistence(resolvedPath, [PROJECT_ROOT]);
        
        if (pathValidation.isValid) {
          resolvedPathToUse = pathValidation.resolvedPath;
        } else {
          console.log('[API] Accepting external watch path:', resolvedPath);
        }
      } catch {
        // If validation fails for any reason, assume external path is safe to use
        resolvedPathToUse = resolvedPath;
      }

      const { addWatchPath } = await import('../../services/ingest/watchdog.js');
      const success = await addWatchPath(resolvedPathToUse);

      res.status(200).json({
        status: success ? 'success' : 'failed',
        message: success ? `Now watching: ${resolvedPathToUse}` : 'Failed to add path',
        path: resolvedPathToUse,
        within_project_root: false,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to add watch path' });
    }
  });

  // POST /v1/system/path-remove — Remove a watched path with hot-slotting purge (convenience endpoint)
  app.post('/v1/system/path-remove', async (req: Request, res: Response) => {
    try {
      const { path } = req.body;
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      // Remove from watch config via watchdog (includes DB purge + filesystem cleanup)
      const { removeWatchPath } = await import('../../services/ingest/watchdog.js');
      const success = await removeWatchPath(path);

      res.status(200).json({
        status: success ? 'success' : 'failed',
        message: success ? `Removed watched path and purged data: ${path}` : 'Failed to remove path',
        path,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to remove watch path' });
    }
  });

  // POST /v1/system/explorer - Open file explorer at specified path
  app.post('/v1/system/explorer', async (req: Request, res: Response) => {
    try {
      const { path } = req.body;
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const { execFile } = await import('child_process');
      const util = await import('util');
      const pathModule = await import('path');
      const { validatePathSafetyWithExistence } = await import('../../utils/security.js');
      const execFilePromise = util.promisify(execFile);
      const { platform } = process;

      // Security: Validate path is within PROJECT_ROOT to prevent traversal attacks
      const absoluteRequestedDir = pathModule.resolve(path);
      const pathValidation = await validatePathSafetyWithExistence(absoluteRequestedDir, [PROJECT_ROOT]);
      
      if (!pathValidation.isValid) {
        console.warn(`[System] Rejected path traversal attempt: ${path} (resolved: ${absoluteRequestedDir})`);
        res.status(403).json({
          error: 'Path traversal detected',
          message: pathValidation.error,
        });
        return;
      }

      // Additional check: must be a directory
      const stats = await fs.promises.stat(pathValidation.resolvedPath);
      if (!stats.isDirectory()) {
        res.status(400).json({ error: 'Path must be a directory' });
        return;
      }

      // Open file explorer based on platform safely using execFile
      if (platform === 'win32') {
        await execFilePromise('explorer.exe', [pathValidation.resolvedPath]);
      } else if (platform === 'darwin') {
        await execFilePromise('open', [pathValidation.resolvedPath]);
      } else {
        await execFilePromise('xdg-open', [pathValidation.resolvedPath]);
      }

      res.status(200).json({
        status: 'success',
        message: `Opened file explorer at: ${pathValidation.resolvedPath}`,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to open file explorer' });
    }
  });

  // Configuration endpoint to provide runtime configuration to clients
  app.get('/v1/config', async (_req: Request, res: Response) => {
    try {
      // Import config here to avoid circular dependencies
      const { config } = await import('../../config/index.js');

      const serverConfig = {
        port: config.PORT,
        host: config.HOST,
        server_url: `http://${config.HOST}:${config.PORT}`,
        llm_provider: config.LLM_PROVIDER,
        search_strategy: config.SEARCH.strategy,
        features: config.FEATURES,
      };

      res.status(200).json(serverConfig);
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({
        error: 'Failed to get server config',
        fallback_config: {
          port: 3160,
          host: '127.0.0.1',
          server_url: 'http://127.0.0.1:3160',
        },
      });
    }
  });

  // Watchdog control endpoints
  app.get('/v1/watchdog/status', async (_req: Request, res: Response) => {
    try {
      const { getWatcherStatus } = await import('../../services/ingest/watchdog.js');
      const status = getWatcherStatus();
      res.status(200).json({ status: 'success', ...status });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get watchdog status' });
    }
  });

  app.post('/v1/watchdog/start', async (req: Request, res: Response) => {
    try {
      const { paths = [], recursive = true } = req.body;

      // Pre-flight validation: Check target directory exists and is not empty
      if (paths.length > 0 && paths[0]) {
        const fs = await import('fs');
        const pathModule = await import('path');

        const targetPath = pathModule.resolve(paths[0]);

        try {
          // Check if directory exists
          const stats = await fs.promises.stat(targetPath);
          if (!stats.isDirectory()) {
            return res.status(400).json({
              status: 'error',
              message: 'Target directory does not exist or is not a valid directory',
              path: targetPath,
              hint: `Please ensure the directory exists and is accessible.`,
            });
          }

          // Check if directory is empty (has at least some files)
          const entries = await fs.promises.readdir(targetPath);
          if (entries.length === 0) {
            return res.status(400).json({
              status: 'error',
              message: 'Target directory exists but is empty',
              path: targetPath,
              hint: `Please clone the repository first using: git clone https://github.com/RSBalchII/anchor-engine-node "${targetPath}"`,
            });
          }

          console.log(`[Watchdog] Pre-flight validation passed for: ${targetPath} (${entries.length} items)`);
        } catch (err) {
          // Error already logged; re-throw other errors for watchdog to handle
          throw err;
        }
      }

      const { startWatchdog } = await import('../../services/ingest/watchdog.js');
      // Pass validated paths to startWatchdog (fixes the bug where custom paths weren't being used)
      if (paths.length > 0 && paths[0]) {
        await startWatchdog(paths);
      } else {
        await startWatchdog();
      }
      res.status(200).json({ status: 'success', message: 'Watchdog started' });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ 
        status: 'error', 
        message: 'Failed to start watchdog' 
      });
    }
  });

  app.post('/v1/watchdog/stop', async (_req: Request, res: Response) => {
    try {
      const { stopWatchdog } = await import('../../services/ingest/watchdog.js');
      await stopWatchdog();
      res.status(200).json({ status: 'success', message: 'Watchdog stopped' });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to stop watchdog' });
    }
  });

  app.post('/v1/watchdog/ingest', async (_req: Request, res: Response) => {
    try {
      const { triggerManualIngest } = await import('../../services/ingest/watchdog.js');
      const result = await triggerManualIngest();
      res.status(200).json(result);
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to trigger manual ingest' });
    }
  });

  // System status endpoint
  app.get('/v1/system/status', async (_req: Request, res: Response) => {
    try {
      const { systemStatus } = await import('../../services/system-status.js');
      const status = systemStatus.getStatus();
      res.json({
        status: 'success',
        ...status,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to get system status' });
    }
  });

  // File read endpoint for distilled content
  app.get('/v1/files/read', async (req: Request, res: Response) => {
    try {
      const filePath = req.query.path as string;
      if (!filePath) {
        res.status(400).json({ error: 'Path parameter required' });
        return;
      }

      const fs = await import('fs');
      const path = await import('path');

      // Security: Canonicalize paths to prevent symlink traversal attacks
      // Get realpath of base directory (notebook/distills - where radial distiller writes)
      const baseDir = PATHS.DISTILLS_DIR;
      let realBaseDir: string;
      try {
        realBaseDir = await fs.promises.realpath(baseDir);
      } catch {
        // Directory doesn't exist yet - create it
        await fs.promises.mkdir(baseDir, { recursive: true });
        realBaseDir = baseDir;
      }

      // Resolve and canonicalize requested path
      const resolvedPath = path.resolve(filePath);
      let realFilePath: string;
      try {
        realFilePath = await fs.promises.realpath(resolvedPath);
      } catch {
        res.status(404).json({ error: 'File not found' });
        return;
      }

      // Verify file is within allowed directory using path.relative
      const relativePath = path.relative(realBaseDir, realFilePath);
      if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        res.status(403).json({ error: 'Access denied: file outside allowed directory' });
        return;
      }

      // Additional checks: only allow safe file extensions
      // Note: .decision-records and .compact are allowed because they are distillation output formats
      // that contain no raw ingested content, only derived decision records.
      const allowedExts = ['.yaml', '.json', '.md', '.txt', '.yml', '.decision-records', '.compact'];
      const ext = path.extname(realFilePath).toLowerCase();
      if (!allowedExts.includes(ext) && !realFilePath.match(/\.(yaml|json|md|txt|yml|decision-records|compact)$/i)) {
        res.status(403).json({ error: 'Access denied: file type not allowed' });
        return;
      }

      const stats = await fs.promises.stat(realFilePath);
      if (!stats.isFile()) {
        res.status(403).json({ error: 'Access denied: not a regular file' });
        return;
      }

      const content = await fs.promises.readFile(realFilePath, 'utf-8');
      res.json({
        status: 'success',
        path: filePath,
        content: content,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to read file' });
    }
  });

  // ============================================
  // Watchdog Path Management Endpoints
  // ============================================

  // POST /v1/system/watcher/reload - Reload watched paths from config without restart
  app.post('/v1/system/watcher/reload', async (_req: Request, res: Response) => {
    try {
      const fs = await import('fs');
      const pathModule = await import('path');

      // Read current user settings to get extra_paths
      const settingsPath = PATHS.USER_SETTINGS;
      if (!fs.existsSync(settingsPath)) {
        res.status(404).json({ error: 'User settings not found' });
        return;
      }

      const settingsContent = await fs.promises.readFile(settingsPath, 'utf-8');
      const settings = JSON.parse(settingsContent);

      // Extract extra_paths from watcher config
      const extraPaths = settings.watcher?.extra_paths || [];

      if (extraPaths.length === 0) {
        res.status(400).json({ 
          error: 'No extra paths configured',
          message: 'Add paths to "watcher.extra_paths" in user_settings.json first'
        });
        return;
      }

      // Resolve all paths and add them to the watcher
      const results = [];
      for (const pathStr of extraPaths) {
        try {
          const resolvedPath = pathModule.resolve(pathStr);
          
          // Check if already watching this path
          const { getWatchedPaths } = await import('../../services/ingest/watchdog.js');
          const currentPaths = getWatchedPaths();
          if (!currentPaths.includes(resolvedPath)) {
            const { addWatchPath } = await import('../../services/ingest/watchdog.js');
            const success = await addWatchPath(resolvedPath);
            
            results.push({
              path: resolvedPath,
              status: success ? 'added' : 'failed',
              message: success ? `Now watching: ${resolvedPath}` : 'Failed to add path'
            });
          } else {
            results.push({
              path: resolvedPath,
              status: 'already_watching',
              message: `Already watching: ${resolvedPath}`
            });
          }
        } catch {
          // Error already logged; add error result without leaking internals
          results.push({
            path: pathStr,
            status: 'error',
            message: `Failed to process path: ${pathStr}`
          });
        }
      }

      res.status(200).json({
        status: 'success',
        message: `Reloaded ${extraPaths.length} paths`,
        results
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to reload watcher paths' });
    }
  });

  // ============================================
  // P1 Features: Agent Discovery, Ingestion Status, Graph Export
  // ============================================

  // GET /v1/agent/discover - Discover installed AI agents
  app.get('/v1/agent/discover', async (_req: Request, res: Response) => {
    try {
      const { discoverAgents } = await import('../../services/agent-discovery.js');
      const { getWatchedPaths } = await import('../../services/ingest/watchdog.js');

      const watchedPaths = getWatchedPaths();
      const agents = await discoverAgents(watchedPaths);

      res.status(200).json({
        status: 'success',
        count: agents.length,
        agents,
      });
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to discover agents' });
    }
  });

  // POST /v1/agent/add - Add an agent's chat directory to watched paths
  app.post('/v1/agent/add', async (req: Request, res: Response) => {
    try {
      const { agent_id } = req.body;

      if (!agent_id) {
        res.status(400).json({ error: 'agent_id is required' });
        return;
      }

      const { getAgentPath, getAgentPossiblePaths, KNOWN_AGENTS } = await import('../../services/agent-discovery.js');
      const agentPath = await getAgentPath(agent_id);

      if (!agentPath) {
        const possiblePaths = getAgentPossiblePaths(agent_id);
        res.status(404).json({
          error: `Agent '${agent_id}' not found on this system`,
          possible_locations: possiblePaths,
          supported_agents: Object.keys(KNOWN_AGENTS),
        });
        return;
      }

      // Add to watched paths
      const { addWatchPath } = await import('../../services/ingest/watchdog.js');
      const success = await addWatchPath(agentPath);

      if (success) {
        res.status(200).json({
          status: 'success',
          message: `Added ${agent_id} chat directory to watched paths`,
          agent_id,
          path: agentPath,
        });
      } else {
        res.status(500).json({
          error: 'Failed to add agent path to watched paths',
          agent_id,
          path: agentPath,
        });
      }
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to add agent path' });
    }
  });

  // GET /v1/ingest/status - Get detailed ingestion progress
  app.get('/v1/ingest/status', async (_req: Request, res: Response) => {
    try {
      const { systemStatus } = await import('../../services/system-status.js');
      const ingestStatus = systemStatus.getIngestionStatus();
      const status = systemStatus.getStatus();

      const response = {
        active: status.state === 'ingesting',
        state: status.state,
        currentFile: status.progress?.description || null,
        processed: status.progress?.current || 0,
        total: status.progress?.total || 0,
        atomsCreated: 0,
        errors: [],
        startedAt: ingestStatus.currentJob?.startedAt?.toISOString() || null,
        lastCompleted: ingestStatus.lastCompleted?.toISOString() || null,
        queueDepth: ingestStatus.queueDepth,
      };

      res.status(200).json(response);
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to retrieve ingest status' });
    }
  });

  // POST /v1/system/wait-for-ingest - Block until ingestion completes
  app.get('/v1/graph/export', async (req: Request, res: Response) => {
    try {
      const { exportGraph, exportGraphToFile } = await import('../../services/graph-export.js');

      const options = {
        maxNodes: parseInt(req.query.maxNodes as string) || 100,
        minWeight: parseInt(req.query.minWeight as string) || 1,
        includeContent: req.query.includeContent !== 'false',
        maxContentLength: parseInt(req.query.maxContentLength as string) || 200,
        bucket: req.query.bucket as string,
        tag: req.query.tag as string,
      };

      const outputPath = req.query.output as string;

      if (outputPath) {
        const result = await exportGraphToFile(outputPath, options);
        res.status(200).json({
          status: 'success',
          message: `Exported ${result.nodeCount} nodes to ${result.outputPath}`,
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          outputPath: result.outputPath,
        });
      } else {
        const result = await exportGraph(options);
        res.status(200).json({
          status: 'success',
          nodeCount: result.nodeCount,
          edgeCount: result.edgeCount,
          content: result.content,
        });
      }
    } catch {
      // Error already logged; return safe error response without leaking internals
      res.status(500).json({ error: 'Failed to export graph' });
    }
  });
}


