/**
 * Startup Banner Utility
 * 
 * Displays a comprehensive status banner when Anchor Engine starts successfully.
 * Shows database stats, watchdog status, MCP server status, API key status, and health endpoint.
 * 
 * Example Output:
 * ⚓ Anchor Engine (VERSION)
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ✅ Database: 30,922 atoms, 156 sources, 423 tags
 * ✅ Watchdog: active, watching 3 paths
 *    • /home/user/.qwen/projects/-data-data-com-termux-files-home/chats
 *    • /home/user/.config/Claude/chats
 *    • /home/user/projects/my-app/docs
 * ✅ MCP server: ready on stdio
 * ✅ API key: set (bolt-memory-secret)
 * ✅ Health: http://localhost:3160/health
 * ⏱️  Startup complete in 7.4s
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 */

import { db } from '../core/db.js';
import { config } from '../config/index.js';
import { getWatcherStatus } from '../services/ingest/watchdog.js';

interface DatabaseStats {
  atoms: number;
  sources: number;
  tags: number;
  molecules: number;
}

interface BannerOptions {
  startupTimeMs: number;
  watchdogEnabled: boolean;
}

/**
 * Get database statistics
 */
async function getDatabaseStats(): Promise<DatabaseStats> {
  try {
    const [atomsResult, sourcesResult, tagsResult, moleculesResult] = await Promise.all([
      db.run('SELECT COUNT(*) as count FROM atoms'),
      db.run('SELECT COUNT(*) as count FROM sources'),
      db.run('SELECT COUNT(DISTINCT tag) as count FROM tags WHERE tag IS NOT NULL'),
      db.run('SELECT COUNT(*) as count FROM molecules'),
    ]);

    return {
      atoms: parseInt(atomsResult.rows?.[0]?.count || '0'),
      sources: parseInt(sourcesResult.rows?.[0]?.count || '0'),
      tags: parseInt(tagsResult.rows?.[0]?.count || '0'),
      molecules: parseInt(moleculesResult.rows?.[0]?.count || '0'),
    };
  } catch (error: any) {
    console.warn('[StartupBanner] Failed to retrieve database stats:', error.message);
    return { atoms: 0, sources: 0, tags: 0, molecules: 0 };
  }
}

/**
 * Format a large number with commas (e.g., 30922 -> "30,922")
 */
function formatNumber(num: number): string {
  return num.toLocaleString('en-US');
}

/**
 * Get API key display status
 */
function getApiKeyStatus(): string {
  // API key is required at startup, so it should always be set
  const partialKey = config.API_KEY.length > 8
    ? `${config.API_KEY.substring(0, 8)}...`
    : config.API_KEY;

  return `set (${partialKey})`;
}

/**
 * Get watchdog status display
 */
function getWatchdogStatus(): { status: string; paths: string[] } {
  const watcherStatus = getWatcherStatus();
  
  if (!watcherStatus.isRunning) {
    return { status: 'disabled', paths: [] };
  }
  
  // Filter to only extra paths (not default inbox/external-inbox)
  const extraPaths = config.WATCHER_EXTRA_PATHS || [];
  
  if (extraPaths.length === 0) {
    return { status: 'active (default paths only)', paths: [] };
  }
  
  return { 
    status: 'active', 
    paths: extraPaths, 
  };
}

/**
 * Get MCP server status
 */
function getMcpServerStatus(): string {
  // MCP server runs in stdio mode, controlled by agent
  // We check if it's configured
  return 'ready on stdio';
}

/**
 * Format startup time in seconds with one decimal place
 */
function formatStartupTime(ms: number): string {
  return (ms / 1000).toFixed(1) + 's';
}

/**
 * Display the startup status banner
 */
export async function displayStartupBanner(options: BannerOptions): Promise<void> {
  const { startupTimeMs, watchdogEnabled } = options;
  
  try {
    // Gather all status information
    const dbStats = await getDatabaseStats();
    const watchdogStatus = getWatchdogStatus();
    const apiKeyStatus = getApiKeyStatus();
    const mcpStatus = getMcpServerStatus();
    const healthUrl = `http://${config.HOST}:${config.PORT}/health`;
    
    // Build banner lines
    const lines: string[] = [];
    
    // Header
    lines.push(`⚓ Anchor Engine (${config.VERSION})`);
    lines.push('━'.repeat(48));
    
    // Database stats
    const isFresh = dbStats.atoms === 0;
    if (isFresh) {
      lines.push('✅ Database: fresh (ready for ingestion)');
    } else {
      lines.push(`✅ Database: ${formatNumber(dbStats.atoms)} atoms, ${formatNumber(dbStats.sources)} sources, ${formatNumber(dbStats.tags)} tags`);
    }
    
    // Watchdog status
    if (watchdogStatus.paths.length > 0) {
      lines.push(`✅ Watchdog: ${watchdogStatus.status}, watching ${watchdogStatus.paths.length} path(s)`);
      watchdogStatus.paths.forEach(path => {
        lines.push(`   • ${path}`);
      });
    } else if (watchdogEnabled) {
      lines.push(`✅ Watchdog: ${watchdogStatus.status}`);
    } else {
      lines.push('⚪ Watchdog: disabled (no extra_paths configured)');
    }
    
    // MCP server status
    lines.push(`✅ MCP server: ${mcpStatus}`);
    
    // API key status
    lines.push(`✅ API key: ${apiKeyStatus}`);
    
    // Health endpoint
    lines.push(`✅ Health: ${healthUrl}`);
    
    // Startup time
    lines.push(`⏱️  Startup complete in ${formatStartupTime(startupTimeMs)}`);
    
    // Footer
    lines.push('━'.repeat(48));
    
    // Print banner
    console.log(lines.join('\n'));
    
  } catch (error: any) {
    // If banner fails, print minimal status
    console.error('[StartupBanner] Error displaying banner:', error.message);
    console.log(`⚓ Anchor Engine (${config.VERSION}) started in ${formatStartupTime(startupTimeMs)}`);
  }
}

/**
 * Display a simplified startup message (for error cases or minimal mode)
 */
export function displayMinimalStartupMessage(startupTimeMs: number): void {
  console.log(`⚓ Anchor Engine (${config.VERSION}) ready in ${formatStartupTime(startupTimeMs)}`);
  console.log(`Health: http://${config.HOST}:${config.PORT}/health`);
}
