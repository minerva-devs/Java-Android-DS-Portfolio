/**
 * Engram Service — Lexical Sidecar for Fast Entity Lookup
 *
 * Engrams are pre-computed lookup tables that map normalized keys
 * to lists of memory IDs. They provide O(1) lookup for known entities.
 *
 * Extracted from search.ts for better code organization.
 */

import { createHash } from 'crypto';
import { db } from '../../core/db.js';
import type { SearchResult } from './search-utils.js';

/**
 * Create or update an engram (lexical sidecar) for fast entity lookup
 */
export async function createEngram(key: string, memoryIds: string[]): Promise<void> {
  const normalizedKey = key.toLowerCase().trim();
  const engramId = createHash('md5').update(normalizedKey).digest('hex');

  const insertQuery = 'INSERT INTO engrams (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value';
  await db.run(insertQuery, [engramId, JSON.stringify(memoryIds)]);
}

/**
 * Lookup memories by engram key (O(1) operation)
 */
export async function lookupByEngram(key: string): Promise<string[]> {
  const normalizedKey = key.toLowerCase().trim();
  const engramId = createHash('md5').update(normalizedKey).digest('hex');

  const query = 'SELECT value FROM engrams WHERE key = $1';
  const result = await db.run(query, [engramId]);

  if (result.rows && result.rows.length > 0) {
    return JSON.parse(result.rows[0].value as string);
  }

  return [];
}

/**
 * Hydrate engram IDs into full SearchResult objects
 */
export async function hydrateEngrams(ids: string[]): Promise<SearchResult[]> {
  if (!ids || ids.length === 0) return [];

  const query = `
    SELECT id, content, source_path, timestamp, buckets, tags, provenance, compound_id, start_byte, end_byte
    FROM atoms
    WHERE id = ANY($1)
  `;

  try {
    const result = await db.run(query, [ids]);

    return result.rows.map((row: any) => ({
      id: row.id,
      content: row.content,
      source: row.source_path, // Map source_path to source
      timestamp: row.timestamp,
      buckets: row.buckets || [],
      tags: row.tags || [],
      epochs: '',
      provenance: row.provenance || 'internal',
      score: 1.0, // High score for direct engram hits
      compound_id: row.compound_id,
      start_byte: row.start_byte,
      end_byte: row.end_byte,
    }));
  } catch (e) {
    console.error('[Engram] Failed to hydrate engrams:', e);
    return [];
  }
}