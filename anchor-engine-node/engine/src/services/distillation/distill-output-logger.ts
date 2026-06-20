/**
 * Distillation Output Logger
 *
 * Writes distillation results to a single consolidated .log file per test run.
 * Truncates at 500 lines maximum.
 * Uses plain .log extension instead of YAML/JSON in filenames.
 */

import fs from 'fs';
import path from 'path';

// Log directory for distillation outputs – uses project root
const PROJECT_ROOT = path.resolve(process.cwd(), '../..');
const ANCHOR_ROOT = path.join(PROJECT_ROOT, '.anchor');

// Log directory for distillation outputs – uses ANCHOR_ROOT/logs (~/.anchor/logs)
const LOGS_DIR = path.join(ANCHOR_ROOT, 'logs');

/** Maximum number of lines we keep per unique output hash. */
const MAX_LINES_PER_FILE = 500;
/** Optional: maximum file size (MiB) before we start trimming aggressively. */
const MAX_LOG_FILE_SIZE_MB = 10;

// In‑memory cache mapping a query hash → { path, lastWrite }
const logFileCache = new Map<string, { path: string; lastWrite: number }>();

/** Ensure the log directory exists – idempotent. */
function ensureLogDir(): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/** Check if distillation logging is enabled via environment variable. */
export function isDistillationLoggingEnabled(): boolean {
  const val = process.env.ANCHOR_DISTILL_LOG ?? '';
  return val === '1' || val.toLowerCase() === 'true';
}

/** Generate a deterministic hex‑string hash from the output path. */
export function generateOutputHash(outputPath: string): string {
  let h = 0;
  for (let i = 0; i < outputPath.length; i++) {
    h = ((h << 5) - h + outputPath.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(16);
}

/** Entry format written into the JSON file (one per invocation). */
export interface DistillLogEntry {
  timestamp: string;          // ISO‑8601 UTC
  unixTimestamp: number;      // epoch ms – handy for debugging/logging
  outputHash: string;
  outputPath: string;         // full path to the YAML/JSON file
  outputFormat: 'yaml' | 'json-full' | 'decision-records';
  entrySize: number;          // bytes written
  decisionRecords: number;
  compressionRatio?: string;
  durationMs?: number;
}

/**
 * Persist a single distillation invocation.
 * The helper will append to a new consolidated .log file per test run.
 */
export function logDistillOutput(
  outputPath: string,
  outputFormat: 'yaml' | 'json-full' | 'decision-records',
  entrySize: number,
  metadata?: Partial<DistillLogEntry>,
  options?: { verbose?: boolean; force?: boolean }
): void {
  const enabled = (options?.verbose ?? false) || (options?.force ?? false);
  if (!enabled && !process.env.ANCHOR_DISTILL_LOG) return;

  ensureLogDir();
  const outputHash = generateOutputHash(outputPath);
  
  // Use current second for filename - same second = same test run
  const ts = new Date().toISOString().split('.')[0].replace(/[-:]/g, '');
  const fileName = `${ts}_distill.log`;
  const filePath = path.join(LOGS_DIR, fileName);

  // Format this entry as a single-line JSON object
  const entryLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    unixTimestamp: Date.now(),
    outputHash,
    outputPath,
    outputFormat,
    entrySize,
    decisionRecords: metadata?.decisionRecords ?? 0,
    compressionRatio: metadata?.compressionRatio,
    durationMs: metadata?.durationMs,
  });

  // Batched logging - only log every BATCH_LOG_INTERVAL outputs (or on error)
  const batchNumber = Math.floor(Date.now() / 1000); // Use seconds as batch identifier
  let batchFile = path.join(LOGS_DIR, `${ts}_distill_batch.log`);
  
  // Read existing batch and add this entry
  let currentBatchLines: string[] = [];
  if (fs.existsSync(batchFile)) {
    try { currentBatchLines = fs.readFileSync(batchFile, 'utf-8').split('\n'); }
    catch {} 
  }

  // Write entry to the batch file
  currentBatchLines.push(entryLine);
  fs.writeFileSync(batchFile, currentBatchLines.join('\n'), 'utf-8');

  // Also append to the main log file
  const logEntry = JSON.stringify({
    timestamp: new Date().toISOString(),
    unixTimestamp: Date.now(),
    outputHash,
    outputPath,
    outputFormat,
    entrySize,
    decisionRecords: metadata?.decisionRecords ?? 0,
  });

  let existingLines: string[] = [];
  if (fs.existsSync(filePath)) {
    try {
      existingLines = fs.readFileSync(filePath, 'utf-8').split('\n').filter(l => l.trim());
    } catch (e) {
      existingLines = [];
    }
  }

  // Check if we have deduplicated this output hash already in current file
  const hasDuplicate = existingLines.some(line => {
    try {
      const entry = JSON.parse(line);
      return entry.outputHash === outputHash && entry.outputPath === outputPath;
    } catch {
      return false;
    }
  });

  if (!hasDuplicate) {
    if (existingLines.length >= MAX_LINES_PER_FILE) existingLines.shift();
    existingLines.push(logEntry);
    fs.writeFileSync(filePath, existingLines.join('\n'), 'utf-8');
  }
}

/** Helper used by unit tests – returns all .log filenames in the log directory. */
export function listLogFiles(): string[] {
  ensureLogDir();
  return fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
}

/** Clear the in‑memory cache – useful for isolated test runs. */
export function clearCachedLogs(): void { logFileCache.clear(); }
