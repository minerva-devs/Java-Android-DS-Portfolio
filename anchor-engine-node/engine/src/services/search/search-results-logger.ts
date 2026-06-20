/**
 * Search Results Logger – lightweight helper used by unit tests.
 *
 * Writes search results to a single consolidated .log file per test run.
 * Truncates at 500 lines maximum for manageable log sizes.
 * Uses plain .log extension instead of .json.
 *
 * Implementation strategy:
 *   1. All logs live under `~/.anchor/logs` – the helper guarantees the
 *      directory exists.
 *   2. When `logSearchResults()` is called, we append to a single persistent
 *      log file named `{timestamp}_search.log` (not multiple JSON files).
 *   3. Each entry gets its own line for easy parsing and verification.
 *   4. File automatically truncates at 500 lines maximum.
 *
 * The helper is intentionally simple – no async I/O, no external
 * libraries, and all paths are built with Node's `path` module to avoid OS
 * specific surprises.
 */

import fs from 'fs';
import path from 'path';
import { PATHS } from '../../config/paths.js';

// Log directory for search results – uses PATHS.LOGS_DIR (~/.anchor/logs)
const LOGS_DIR = PATHS.LOGS_DIR;

/** Maximum lines to keep in any single log file. */
const MAX_LINES_PER_FILE = 500;
/** Maximum entries per query hash before deduplication kicks in. */
const MAX_ENTRIES_PER_HASH = 20;

// In‑memory cache mapping a query hash → { path, lastWrite }
const logFileCache = new Map<string, { path: string; lastWrite: number }>();

/** Ensure the log directory exists – idempotent. */
function ensureLogDir(): void {
  if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });
}

/** Check if search logging is enabled via environment variable. */
export function isSearchLoggingEnabled(): boolean {
  const val = process.env.ANCHOR_SEARCH_LOG ?? '';
  return val === '1' || val.toLowerCase() === 'true';
}

/** Generate a deterministic hex‑string hash from the query text. */
export function generateQueryHash(query: string): string {
  const normalized = query.toLowerCase().trim();
  let h = 0;
  for (let i = 0; i < normalized.length; i++) {
    h = ((h << 5) - h + normalized.charCodeAt(i)) | 0; // eslint-disable-line no-bitwise
  }
  return Math.abs(h).toString(16);
}

/** Entry format written into the JSON file (one per invocation). */
export interface SearchLogEntry {
  timestamp: string;          // ISO‑8601 UTC
  unixTimestamp: number;      // epoch ms – handy for debugging/logging
  queryHash: string;
  originalQuery: string;     // full query trimmed to 200 chars
  results: Array<{
    id: string;
    content: string;   // truncated to 500 chars for storage efficiency
    source: string;      // file path or other identifier
    timestamp?: number; // optional – may come from the underlying source
    score?: number;
    tags?: string[];
    buckets?: string[];
    provenance?: string;
  }>;
  metadata: {
    strategy: string;
    totalResults: number;
    durationMs?: number;
    splitQueries?: string[];
    buckets?: string[];
    tags?: string[];
    engineVersion?: string;      // added by current feature
  };
}

/**
 * Persist a single search invocation.
 * The helper appends to a single consolidated .log file per test run.
 * Truncates at MAX_LINES_PER_FILE (500 lines) maximum.
 * Each entry is written as a single JSON line for easy parsing.
 */
export function logSearchResults(
  query: string,
  results: Array<any>,
  metadata: Partial<SearchLogEntry["metadata"]> = {},
  options?: { verbose?: boolean; force?: boolean }
): void {
  const enabled = (options?.verbose ?? false) || (options?.force ?? false);
  if (!enabled && !process.env.ANCHOR_SEARCH_LOG) return;

  ensureLogDir();
  const queryHash = generateQueryHash(query);
  // Use current second for filename - same second = same test run
  const ts = new Date().toISOString().split('.')[0].replace(/[-:]/g, '');
  const fileName = `${ts}_search.log`;
  const filePath = path.join(LOGS_DIR, fileName);

  const entry: SearchLogEntry = {
    timestamp: new Date().toISOString(),
    unixTimestamp: Date.now(),
    queryHash,
    originalQuery: query.substring(0, 200),
    results: results.map(r => ({
      id: r.id ?? '',
      content: typeof r.content === 'string' ? r.content.substring(0, 500) : '',
      source: r.source_path ?? r.source ?? '',
      timestamp: r.timestamp,
      score: r.score,
      tags: r.tags || [],
      buckets: r.buckets || [],
      provenance: r.provenance,
    })),
    metadata: {
      strategy: metadata.strategy ?? 'unknown',
      totalResults: metadata.totalResults ?? results.length,
      durationMs: metadata.durationMs,
      splitQueries: metadata.splitQueries,
      buckets: metadata.buckets,
      tags: metadata.tags,
      engineVersion: process.env.ENGINE_VERSION ?? 'unknown',
    },
  };

  // Read existing lines if file exists
  let existingLines: string[] = [];
  if (fs.existsSync(filePath)) {
    try {
      const raw = fs.readFileSync(filePath, 'utf-8');
      // Each line is a single JSON entry – split by newlines
      existingLines = raw.split('\n').filter(line => line.trim() !== '');
    } catch (_) {
      // corrupted – start fresh
      existingLines = [];
    }
  }

  // Format this entry as a single-line JSON object
  const entryLine = JSON.stringify({
    timestamp: new Date().toISOString(),
    unixTimestamp: Date.now(),
    queryHash,
    originalQuery: query.substring(0, 200),
    results: results.map(r => ({
      id: r.id ?? '',
      content: typeof r.content === 'string' ? r.content.substring(0, 500) : '',
      source: r.source_path ?? r.source ?? '',
      timestamp: r.timestamp,
      score: r.score,
      tags: r.tags || [],
      buckets: r.buckets || [],
      provenance: r.provenance,
    })),
    metadata: {
      strategy: metadata.strategy ?? 'unknown',
      totalResults: metadata.totalResults ?? results.length,
      durationMs: metadata.durationMs,
      splitQueries: metadata.splitQueries,
      buckets: metadata.buckets,
      tags: metadata.tags,
      engineVersion: process.env.ENGINE_VERSION ?? 'unknown',
    },
  });

  // Check if we have deduplicated this query hash already in current file
  const hasDuplicate = existingLines.some(line => {
    try {
      const entry = JSON.parse(line);
      return entry.queryHash === queryHash;
    } catch {
      return false;
    }
  });

  // If duplicate, skip writing to avoid bloat within same test run
  if (hasDuplicate) {
    return; // Already logged this hash in current file
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

  // Update cache so subsequent lookups for the same hash reuse the path.
  logFileCache.set(queryHash, { path: filePath, lastWrite: Date.now() });
}

/** Helper used by unit tests – returns all .log filenames in the log directory. */
export function listLogFiles(): string[] {
  ensureLogDir();
  return fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log'));
}

/** Retrieve the most recent {@link SearchLogEntry} for a given query hash.
 * The function walks the log directory, finds files with _search_ in their name
 */
export function getLatestEntryForHash(hash: string): SearchLogEntry | null {
  ensureLogDir();
  const allFiles = fs.readdirSync(LOGS_DIR);
  
  // Get all .log files and sort by modification time (newest first)
  const logFiles = allFiles
    .filter(f => f.endsWith('.log'))
    .map(f => {
      const stat = fs.statSync(path.join(LOGS_DIR, f));
      return { name: f, mtime: stat.mtime, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs); // newest first
  
  if (logFiles.length === 0) {
    return null;
  }

  // Use the most recent file
  const latestFile = logFiles[0].name;

  try {
    const content = fs.readFileSync(path.join(LOGS_DIR, latestFile), 'utf-8');
    const lines = content.split('\n').filter(line => line.trim() !== '');

    // Find the entry matching our hash (if any)
    for (const line of lines) {
      try {
        const entry: SearchLogEntry = JSON.parse(line);
        if (entry.queryHash === hash) {
          return entry;
        }
      } catch {
        // Skip malformed lines
      }
    }

    // If not found, return null
    return null;
  } catch (e) {
    console.error('[SearchLogger] Failed to read log file:', e);
    return null;
  }
}

/** Clear the in‑memory cache – useful for isolated test runs. */
export function clearCachedLogs(): void { logFileCache.clear(); }

/** Alias kept for backward compatibility with older test code. */
export function clearAllLogsCache(): void { clearCachedLogs(); }
