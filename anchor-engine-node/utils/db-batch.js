/**
 * Database Query Batching Utilities
 *
 * Optimizes database access by batching individual queries into bulk operations.
 * Reduces round-trips and improves throughput for bulk operations.
 *
 * @see Standard 132: Adaptive Concurrency
 * @see Standard 062: Memory Management
 */
import { db } from '../core/db.js';
/**
 * Batch fetch compounds by IDs
 *
 * Instead of: SELECT ... WHERE id = ? (N times)
 * Use:        SELECT ... WHERE id = ANY(?) (1 time)
 *
 * @param compoundIds - Array of compound IDs to fetch
 * @returns Map of compound_id -> compound data (path and provenance only)
 */
export async function batchFetchCompounds(compoundIds) {
    if (!compoundIds || compoundIds.length === 0) {
        return new Map();
    }
    // Remove duplicates
    const uniqueIds = Array.from(new Set(compoundIds));
    // Phase 2A: Query molecules directly — no longer JOINs compounds table.
    // Molecules table has source_path and provenance columns (added in Phase 1B-1).
    const result = await db.run(`SELECT compound_id AS id, source_path AS path, provenance
     FROM molecules
     WHERE compound_id = ANY($1)`, [uniqueIds]);
    const compoundMap = new Map();
    if (result.rows && result.rows.length > 0) {
        for (const row of result.rows) {
            compoundMap.set(row.id, {
                path: row.path,
                provenance: row.provenance,
            });
        }
    }
    return compoundMap;
}
