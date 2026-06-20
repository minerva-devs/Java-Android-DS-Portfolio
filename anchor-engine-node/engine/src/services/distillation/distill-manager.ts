import { db } from '../../core/db.js';

// Distill metadata interface for type safety
export interface DistillMetadata {
  id: string;
  timestamp: string;
  filename: string;
  file_path: string;
  line_count: number;
  lines_unique: number;
  compression_ratio: string;
  source_sessions: string[];
  source_files: string[];
  parameters: Record<string, unknown>;
  start_byte: number;
  end_byte: number;
  file_size: number;
}

// Track processed molecules to prevent duplicate processing
const processedMolecules = new Set<string>();

// In-memory cache of recently completed distills (quick lookup for UI polling)
const distillCache = new Map<string, DistillMetadata>();
const MAX_CACHE_SIZE = 100;

function pruneCache() {
  const keys = Array.from(distillCache.keys());
  if (keys.length > MAX_CACHE_SIZE) {
    const oldest = keys.slice(0, keys.length - MAX_CACHE_SIZE);
    oldest.forEach(k => distillCache.delete(k));
  }
}

/** List distills from the distills table (PGlite) — returns metadata only */
export async function getAllDistills(limit = 50) {
  try {
    const result = await db.run(
      'SELECT id, timestamp, filename, file_path, line_count, lines_unique, compression_ratio, source_sessions, source_files, parameters, start_byte, end_byte, file_size FROM distills ORDER BY timestamp DESC LIMIT $1',
      [limit]
    );
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      timestamp: row.timestamp as string,
      filename: row.filename as string,
      file_path: row.file_path as string,
      line_count: Number(row.line_count),
      lines_unique: Number(row.lines_unique),
      compression_ratio: String(row.compression_ratio),
      source_sessions: Array.isArray(row.source_sessions) ? row.source_sessions as string[] : [],
      source_files: Array.isArray(row.source_files) ? row.source_files as string[] : [],
      parameters: (row.parameters as Record<string, unknown>) || {},
      start_byte: Number((row.start_byte ?? 0) as number),
      end_byte: Number((row.end_byte ?? 0) as number),
      file_size: Number((row.file_size ?? 0) as number),
    }));
  } catch {
    // Fall back to in-memory cache if DB unavailable
    return Object.values(distillCache).slice(0, limit);
  }
}

/** Get a single distill by ID — checks cache first, then DB */
export async function getDistill(id: string) {
  // Check cache first (for recently completed distills)
  const cached = distillCache.get(id);
  if (cached) return cached;

  try {
    const result = await db.run('SELECT * FROM distills WHERE id = $1', [id]);
    if (result.rows?.length) {
      const row = result.rows[0];
      return {
        id: row.id,
        timestamp: row.timestamp,
        filename: row.filename,
        file_path: row.file_path,
        line_count: row.line_count,
        lines_unique: row.lines_unique,
        compression_ratio: row.compression_ratio,
        source_sessions: row.source_sessions,
        source_files: row.source_files,
        parameters: row.parameters,
        start_byte: row.start_byte !== undefined && row.start_byte !== null ? row.start_byte : 0,
        end_byte: row.end_byte !== undefined && row.end_byte !== null ? row.end_byte : 0,
        file_size: row.file_size !== undefined && row.file_size !== null ? row.file_size : 0,
      };
    }
  } catch { /* fall through */ }

  return null;
}

/** Get distills by session from the distills table */
export async function getDistillsBySession(session: string) {
  try {
    const result = await db.run(
      "SELECT * FROM distills WHERE source_sessions ? $1 ORDER BY timestamp DESC",
      [session]
    );
    return (result.rows || []).map((row: Record<string, unknown>) => ({
      id: row.id as string,
      timestamp: row.timestamp as string,
      filename: row.filename as string,
      file_path: row.file_path as string,
      line_count: Number(row.line_count),
      lines_unique: Number(row.lines_unique),
      compression_ratio: String(row.compression_ratio),
      source_sessions: Array.isArray(row.source_sessions) ? row.source_sessions as string[] : [],
      source_files: Array.isArray(row.source_files) ? row.source_files as string[] : [],
      parameters: (row.parameters as Record<string, unknown>) || {},
      start_byte: Number((row.start_byte ?? 0) as number),
      end_byte: Number((row.end_byte ?? 0) as number),
      file_size: Number((row.file_size ?? 0) as number),
    }));
  } catch {
    return Object.values(distillCache).filter((d: DistillMetadata) => {
      // Check if session matches any of the stored source_sessions
      const sessions = Array.isArray(d.source_sessions) ? d.source_sessions : [];
      return sessions.includes(session);
    });
  }
}

/** Delete a distill from DB */
export async function deleteDistill(id: string) {
  const cached = distillCache.get(id);
  if (cached) distillCache.delete(id);
  try {
    const result = await db.run('DELETE FROM distills WHERE id = $1 RETURNING id', [id]);
    return (result.rows?.length || 0) > 0;
  } catch {
    return false;
  }
}

/** Record a completed distill — writes metadata to DB and cache */
export async function recordDistill(distill: DistillMetadata) {
  // Always update cache for quick UI polling
  distillCache.set(distill.id, distill);
  pruneCache();

  // Write metadata to distills table (pointers only, not full content)
  const d = distill as DistillMetadata & { status?: string; progress?: number };
  if (d.status === 'complete' || d.progress === 100) {
    try {
      await db.run(
        `INSERT INTO distills (id, timestamp, filename, file_path, line_count, lines_unique, compression_ratio, source_sessions, source_files, parameters, start_byte, end_byte, file_size)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           line_count = EXCLUDED.line_count,
           lines_unique = EXCLUDED.lines_unique,
           compression_ratio = EXCLUDED.compression_ratio,
           source_files = EXCLUDED.source_files,
           start_byte = EXCLUDED.start_byte,
           end_byte = EXCLUDED.end_byte,
           file_size = EXCLUDED.file_size`,
        [
          distill.id,
          distill.timestamp || new Date().toISOString(),
          distill.filename || `distill-${distill.id}.md`,
          distill.file_path || '',
          distill.line_count || 0,
          distill.lines_unique || 0,
          distill.compression_ratio || '0',
          JSON.stringify(distill.source_sessions),
          JSON.stringify(distill.source_files),
          JSON.stringify(distill.parameters),
          distill.start_byte ?? 0,
          distill.end_byte ?? 0,
          distill.file_size ?? 0,
        ]
      );
      console.log('[distill-manager] Distill recorded to DB:', distill.id);
    } catch (err) {
      console.error('[distill-manager] Failed to write distill to DB:', err);
    }
  }
}

// Check if a molecule has already been processed
export function isMoleculeProcessed(moleculeId: string): boolean {
  return processedMolecules.has(moleculeId);
}

// Mark a molecule as processed
export function markMoleculeProcessed(moleculeId: string) {
  processedMolecules.add(moleculeId);
}

// Reset processed molecules (call after each full distillation run)
export function resetProcessedMolecules() {
  processedMolecules.clear();
}

export function triggerFullDistillation() {
  console.log('[distill-manager] triggerFullDistillation called');
  resetProcessedMolecules();
}

export function triggerFullDistill() {
  return triggerFullDistillation();
}

export default {
  getAllDistills,
  getDistill,
  getDistillsBySession,
  deleteDistill,
  recordDistill,
  isMoleculeProcessed,
  markMoleculeProcessed,
  resetProcessedMolecules,
  triggerFullDistillation,
  triggerFullDistill,
};
