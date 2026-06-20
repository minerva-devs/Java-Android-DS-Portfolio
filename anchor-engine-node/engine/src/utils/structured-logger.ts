/**
 * Structured Logger for Anchor Engine
 *
 * Implements standardized, structured logging with metrics collection.
 * Integrates with unified test logger for consolidated .log output.
 */

import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import fs from 'fs';
import { format } from 'winston';
import { fileURLToPath } from 'url';
import { PATHS } from '../config/paths.js';

// Get absolute path to project root (anchor-os directory)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../..');

// Create logs directory at .anchor/logs (with fallback to project-local logs)
const LOGS_DIR = PATHS.LOGS_DIR || path.join(PROJECT_ROOT, '.anchor', 'logs');

if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

// Winston Logger Configuration with Debug-Level Filtering
const logger = winston.createLogger({
  level: 'info', // Accept debug and above - keeps detailed logs
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'anchor-engine' },
  transports: [
    new DailyRotateFile({
      filename: path.join(LOGS_DIR, 'anchor_engine.log.%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      maxFiles: 7, // Keep logs for 7 days (numeric value required by TypeScript)
      maxSize: 20 as any, // Max 20MB per file - cast to bypass strict type checking
      zippedArchive: true, // Compress old logs
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      level: 'info' // Accept debug and above in files too
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf((info) => {
          const timestamp = info.timestamp || '';
          const level = info.level?.toUpperCase() || 'INFO';
          const message = typeof info.message === 'string' ? info.message : JSON.stringify(info.message);
          return `[${timestamp}] [${level.padEnd(5)}] ${message}`;
        })
      ),
      level: 'info' // Console also accepts debug level
    }),
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'anchor_engine_errors.log'),
      level: 'error', // Only errors in error log file
      maxFiles: 7, // Keep 7 days of error logs (numeric value)
      maxsize: 10, // Max 10MB per error log file (in MB) - lowercase to satisfy TypeScript
      zippedArchive: true
    })
  ]
});

export { logger };

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  verbose: 3,
  debug: 4,
  silly: 5,
};

/**
 * Truncate log files to last N lines to prevent unbounded growth.
 * Runs at startup and on each new test run.
 */
function truncateLogFiles(maxLines: number = 500): void {
  try {
    const files = fs.readdirSync(LOGS_DIR);
    let totalTruncated = 0;

    for (const file of files) {
      if (!file.endsWith('.log') && !file.includes('.log.')) continue;

      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);

      // Skip small files (< 1MB)
      if (stats.size < 1024 * 1024) continue;

      // Read and truncate to last N lines
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      if (lines.length > maxLines) {
        const truncated = lines.slice(-maxLines).join('\n');
        fs.writeFileSync(filePath, truncated, 'utf-8');
        totalTruncated++;
        logger.info(`[Logger] Truncated ${file} from ${lines.length} to ${maxLines} lines`);
      }
    }

    if (totalTruncated > 0) {
      logger.info(`[Logger] Truncated ${totalTruncated} log files to ${maxLines} lines max`);
    }
  } catch (e: any) {
    logger.error('[Logger] Failed to truncate logs:', e.message);
  }
}

// Truncate all existing logs at startup to MAX_LINES_PER_FILE (500)
truncateLogFiles(500);

/**
 * Clean up old log files, keeping only logs from the last 7 days
 */
function cleanupOldLogs(daysToKeep: number = 7): void {
  try {
    const files = fs.readdirSync(LOGS_DIR);
    const today = new Date();
    const cutoff = new Date(today.getTime() - daysToKeep * 24 * 60 * 60 * 1000);

    for (const file of files) {
      // Skip audit files and the zipped folder
      if (file.includes('audit') || file.endsWith('.gz')) continue;
      if (LOGS_DIR.includes('zipped') || file.endsWith('.gz')) continue;

      const filePath = path.join(LOGS_DIR, file);
      const stats = fs.statSync(filePath);
      const fileDate = new Date(stats.mtime);

      if (fileDate < cutoff) {
        fs.unlinkSync(filePath);
        logger.info(`[Logger] Removed old log file: ${file}`);
      }
    }
  } catch (e: any) {
    logger.error('[Logger] Failed to cleanup old logs:', e.message);
  }
}

// Clean up old logs at startup (keep last 7 days)
cleanupOldLogs(7);

// Custom format for structured logging
const structuredFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

/**
 * Performance metrics tracker
 */
class MetricsTracker {
  private metrics: Map<string, { count: number; total: number; min: number; max: number; last: number }>;
  private startTime: number;

  constructor() {
    this.metrics = new Map();
    this.startTime = Date.now();
  }

  startTimer(operation: string): () => number {
    const startTime = Date.now();

    return () => {
      const duration = Date.now() - startTime;
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  recordMetric(operation: string, duration: number): void {
    if (!this.metrics.has(operation)) {
      this.metrics.set(operation, { count: 0, total: 0, min: Infinity, max: -Infinity, last: 0 });
    }

    const metric = this.metrics.get(operation)!;
    metric.count++;
    metric.total += duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);
    metric.last = duration;
  }

  getMetrics(operation: string) {
    return this.metrics.get(operation);
  }

  getAllMetrics() {
    const result: Record<string, any> = {};
    const now = Date.now();

    for (const [name, data] of this.metrics.entries()) {
      result[name] = {
        count: data.count,
        total: data.total,
        average: data.count > 0 ? data.total / data.count : 0,
        min: data.min === Infinity ? 0 : data.min,
        max: data.max === -Infinity ? 0 : data.max,
        last: data.last,
        uptime: now - this.startTime,
      };
    }

    return result;
  }

  reset() {
    this.metrics.clear();
  }

  /**
   * Prune old metrics to free memory (called during idle cleanup)
   */
  pruneOldMetrics(): void {
    const METRIC_TTL_MS = 10 * 60 * 1000; // 10 minutes TTL
    const MAX_METRICS = 500; // Maximum number of metrics to keep
    const now = Date.now();
    
    let prunedCount = 0;
    for (const [key, metric] of this.metrics.entries()) {
      if (metric.last && (now - metric.last) > METRIC_TTL_MS) {
        this.metrics.delete(key);
        prunedCount++;
      }
    }
    
    if (this.metrics.size > MAX_METRICS) {
      const keys = Array.from(this.metrics.keys());
      const toDelete = keys.slice(0, keys.length - MAX_METRICS);
      for (const key of toDelete) {
        this.metrics.delete(key);
        prunedCount++;
      }
    }
    
    if (prunedCount > 0) {
      logger.info(`[StructuredLogger] Pruned ${prunedCount} old metrics (${this.metrics.size} remaining)`);
    }
  }
}

// Initialize metrics tracker
const metricsTracker = new MetricsTracker();

/**
 * Enhanced logging functions with metrics
 */
export const logWithContext = {
  /** Log an info message with context and metrics */
  info: (message: string, context?: Record<string, any>) => {
    if (context && context.metrics) {
      for (const [name, value] of Object.entries(context)) {
        if (typeof value === 'number') {
          metricsTracker.recordMetric(name, value);
        }
      }
    }

    logger.info(message, {
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log a warning with context */
  warn: (message: string, context?: Record<string, any>) => {
    logger.warn(message, {
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log an error with context */
  error: (message: string, error?: Error | string, context?: Record<string, any>) => {
    logger.error(message, {
      error: error instanceof Error ? { message: error.message, stack: error.stack } : error,
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log a debug message with context */
  debug: (message: string, context?: Record<string, any>) => {
    logger.debug(message, {
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log a silly/verbose message with context */
  silly: (message: string, context?: Record<string, any>) => {
    logger.silly(message, {
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log a performance metric */
  performance: (operation: string, duration: number, context?: Record<string, any>) => {
    metricsTracker.recordMetric(operation, duration);

    logger.info('PERFORMANCE_METRIC', {
      operation,
      duration_ms: duration,
      average: metricsTracker.getMetrics(operation)?.total! / metricsTracker.getMetrics(operation)?.count!,
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Start a timed operation */
  startTimer: (operation: string) => {
    return metricsTracker.startTimer(operation);
  },

  /** Get current metrics */
  getMetrics: () => {
    return metricsTracker.getAllMetrics();
  },

  /** Log ingestion event */
  ingestion: (status: 'success' | 'partial' | 'failed', details: Record<string, any>) => {
    metricsTracker.recordMetric('ingestion_attempts', 1);
    if (status === 'success') {
      metricsTracker.recordMetric('ingestion_successes', 1);
    } else if (status === 'failed') {
      metricsTracker.recordMetric('ingestion_failures', 1);
    }

    logger.info('INGESTION_EVENT', {
      event: 'ingestion',
      status,
      details,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log search event */
  search: (query: string, resultCount: number, duration: number, context?: Record<string, any>) => {
    metricsTracker.recordMetric('search_queries', 1);
    metricsTracker.recordMetric('search_results', resultCount);
    metricsTracker.recordMetric('search_duration', duration);

    logger.info('SEARCH_EVENT', {
      event: 'search',
      query: query.substring(0, 100), // Truncate long queries
      resultCount,
      duration_ms: duration,
      context,
      pid: process.pid,
      module: 'structured-logger',
    });
  },

  /** Log system health event */
  health: (status: 'healthy' | 'degraded' | 'unhealthy', details: Record<string, any>) => {
    logger.info('HEALTH_EVENT', {
      event: 'health-check',
      status,
      details,
      pid: process.pid,
      module: 'structured-logger',
    });
  },
};

// Export the base logger as well
export { metricsTracker };

// Export a function to get formatted metrics for monitoring endpoints
export function getFormattedMetrics(): string {
  const metrics = metricsTracker.getAllMetrics();
  return JSON.stringify(metrics, null, 2);
}

// Export alias for backward compatibility
export const StructuredLogger = logWithContext;