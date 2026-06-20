/**
 * Unified Test Log Manager
 *
 * Consolidates ALL test logs (search, distillation, ingestion) into ONE .log file per test run.
 * Automatically truncates at 500 lines maximum to keep logs manageable.
 * Uses plain .log extension instead of timestamped JSON/YAML filenames.
 */

import fs from 'fs';
import path from 'path';

// Log directory for test outputs – uses project root
const PROJECT_ROOT = path.resolve(process.cwd(), '../..');
const ANCHOR_ROOT = path.join(PROJECT_ROOT, '.anchor');

// Log directory for test outputs – uses ANCHOR_ROOT/logs (~/.anchor/logs)
const LOGS_DIR = path.join(ANCHOR_ROOT, 'logs');

/** Maximum number of lines per consolidated log file. */
export const MAX_LINES_PER_FILE = 500;

// In-memory cache mapping test run ID → { path, lastWrite }
const testRunCache = new Map<string, { path: string; lastWrite: number }>();

/** Generate a deterministic hash from the current timestamp (test run ID). */
function generateTestRunId(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${(now.getUTCMonth() + 1).toString().padStart(2, '0')}-${now.getUTCDate()
    .toString().padStart(2, '0')}T${now.getUTCHours()}h${now.getUTCMinutes()}m`;
}

/** Ensure the log directory exists – idempotent. */
function ensureLogDir(): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/** Entry format for unified test logs (one JSON line per entry). */
export interface TestLogEntry {
  timestamp: string;
  unixTimestamp: number;
  runId: string;                    // identifies the test run
  category: 'search' | 'distillation' | 'ingestion';
  subType?: string;                 // e.g., 'standard', 'max-recall'
  message: string;                  // truncated to 500 chars
  metadata?: Record<string, any>;   // optional extra fields
}

/**
 * Log a test event to the consolidated log file.
 */
export function logTestEvent(
  category: 'search' | 'distillation' | 'ingestion',
  message: string,
  subType?: string,
  metadata?: Record<string, any>,
  options?: { verbose?: boolean; force?: boolean }
): void {
  const enabled = (options?.verbose ?? false) || (options?.force ?? false);
  if (!enabled && process.env.ANCHOR_TEST_LOG !== '1') return;

  ensureLogDir();
  const runId = generateTestRunId();
  // Use current second for filename - same second = same test run
  const ts = new Date().toISOString().split('.')[0].replace(/[-:]/g, '');
  const fileName = `${ts}_test.log`;
  const filePath = path.join(LOGS_DIR, fileName);

  // Format this entry as a single-line JSON object (truncated message)
  const truncatedMessage = message.substring(0, 500);
  const entryLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    unixTimestamp: Date.now(),
    runId,
    category,
    subType,
    message: truncatedMessage,
    metadata,
  });

  // Read existing lines if file exists
  let existingLines: string[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      existingLines = raw.split('\n').filter(line => line.trim() !== '');
    } catch (_) {
      // corrupted – start fresh
      existingLines = [];
    }
  }

  // Check for duplicate within current test run (same runId + category)
  const hasDuplicate = existingLines.some(line => {
    try {
      const entry = JSON.parse(line);
      return entry.runId === runId && entry.category === category && 
             (entry.subType ?? '') === (subType ?? '');
    } catch {
      return false;
    }
  });

  // If duplicate, skip writing to avoid bloat within same test run
  if (hasDuplicate) {
    return; // Already logged this event in current file
  }

  // Append new line – but truncate at MAX_LINES_PER_FILE first
  const maxLines = MAX_LINES_PER_FILE;
  
  // Remove oldest lines to make room for new entry
  while (existingLines.length >= maxLines) {
    existingLines.shift(); // remove oldest line
  }

  // Add new line
  existingLines.push(entryLine);

  // Write back to file – compact format, one JSON object per line
  fs.writeFileSync(filePath, existingLines.join('\n'), 'utf-8');
}

/** Helper used by unit tests – returns all .log filenames in the log directory. */
export function listLogFiles(): string[] {
  ensureLogDir();
  return fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.test.log'));
}

/** Clear the in-memory cache – useful for isolated test runs. */
export function clearCachedLogs(): void { testRunCache.clear(); }
