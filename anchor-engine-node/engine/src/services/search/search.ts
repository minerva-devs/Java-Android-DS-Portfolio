/**
 * Search Orchestrator — "The Brain"
 *
 * Core search orchestration, Tag-Walker physics engine, engram lookup,
 * and result merging. All NLP parsing lives in query-parser.ts ("The Ears"),
 * utilities in search-utils.ts ("The Tools"), and graph reasoning in
 * bright-nodes.ts ("The Illuminator").
 *
 * Standard 086 Compliant.
 * Standard 086 = "Dual-Strategy Search" (internal specification numbering).
 * See specs/standards/STANDARD_086_DUAL_STRATEGY_SEARCH.md for full spec.
 * Two modes: Standard Search (70/30 budget, temporal decay) and Max-Recall
 * (zero decay, 3-hop traversal). Mode auto-selects based on token budget.
 */

import { db } from '../../core/db.js';
import { createHash } from 'crypto';
import { config } from '../../config/index.js';
import { MAX_RECALL_CONFIG } from '../../config/max-recall-config.js';
import { SemanticCategory } from '../../types/taxonomy.js';
import { ContextInflator } from './context-inflator.js';
import { Timer } from '../../utils/timer.js';
import { systemStatus } from '../system-status.js';
import { processWithAdaptiveConcurrency } from '../../utils/adaptive-concurrency.js';

// --- Imports from extracted modules ---
import {
  nlp, isExpansionReady, semanticExpand,
  getGlobalTags, expandQuery, sanitizeFtsQuery, expandCamelCase,
  parseNaturalLanguage, extractKeyTermsFromConversation,
  extractTemporalContext, splitQueryIntoMolecules, parseQuery,
  expandConversationalQuery, getRelatedTagsForQuery,
} from './query-parser.js';

import type {
  SearchResult } from './search-utils.js';
import {
  getHammingDistance, getItems, formatResults, filterDisplayTags,
} from './search-utils.js';

import type { KnowledgeCluster, KnowledgeMolecule } from '../../types/api.js';

// --- Import from engram module ---
import { createEngram, lookupByEngram, hydrateEngrams } from './engram.js';

// Re-export everything that external consumers need
export { getGlobalTags, filterDisplayTags, parseQuery, splitQueryIntoMolecules };
export { createEngram, lookupByEngram, hydrateEngrams };
export type { SearchResult };
export type { BrightNode, BrightNodeRelationship } from './bright-nodes.js';
export { getBrightNodes, getStructuredGraph } from './bright-nodes.js';

// --- Search Cache (Standard 016) - Using LRU Cache ---
// Import the new LRU cache implementation
import { LRUCache, searchResultCache as lruSearchCache } from '../../utils/lru-cache.js';

// --- Clean Mode Artifact Patterns ---
import { DEFAULT_ARTIFACT_PATTERNS, stripArtifacts, validateCleanContent, preprocessCleanResult } from '../../types/search.js';

export interface CacheEntry {
  results: { context: string; results: SearchResult[]; attempt: number; metadata?: Record<string, unknown>; toAgentString: () => string };
  timestamp: number;
}

// Legacy Map-based cache for backward compatibility (deprecated, will be removed in v5.0)
// Now wraps the LRU cache for backward compatibility
export const searchCache = {
  get: (key: string): CacheEntry | undefined => {
    const result = lruSearchCache.get(key);
    return result ? { results: result.results, timestamp: result.results.timestamp || Date.now() } : undefined;
  },
  set: (key: string, value: CacheEntry): void => {
    lruSearchCache.set(key, value, 2048);
  },
  delete: (key: string): boolean => {
    return lruSearchCache.delete(key);
  },
  has: (key: string): boolean => {
    return lruSearchCache.has(key);
  },
  clear: (): void => {
    lruSearchCache.clear();
  },
  get size(): number {
    return lruSearchCache.getStats().size;
  },
  getSize: (): number => {
    return lruSearchCache.getStats().size;
  },
  entries: (): IterableIterator<[string, any]> => {
    return lruSearchCache.entries()[Symbol.iterator]();
  },
  keys: (): IterableIterator<string> => {
    return lruSearchCache.keys()[Symbol.iterator]();
  },
};

// Use the LRU cache instead
const CACHE_TTL_MS = config.CACHE_TTL_MS || 60000; // 1 minute TTL
const MAX_CACHE_SIZE = config.MAX_CACHE_SIZE || 100;

// Memory pressure thresholds (now handled by LRU cache internally)
const HIGH_MEMORY_THRESHOLD = 70; // Percentage
const CRITICAL_MEMORY_THRESHOLD = 85; // Percentage

// Import resource manager for memory-aware cache eviction
let resourceManager: unknown = null;
try {
  const resourceManagerModule = await import('../../utils/resource-manager.js');
  resourceManager = resourceManagerModule.resourceManager;
} catch (e) {
  console.warn('[SearchCache] Could not load resource-manager, memory-aware eviction disabled');
}

function getCacheKey(query: string, buckets: string[], maxChars: number, tags: string[], provenance: string, useMaxRecall: boolean): string {
  return createHash('md5').update(`${query}|${buckets.join(',')}|${maxChars}|${tags.join(',')}|${provenance}|${useMaxRecall}`).digest('hex');
}

/**
 * Clean expired cache entries (legacy function, now handled by LRU cache)
 * @deprecated Use lruSearchCache.removeExpired() instead
 */
function cleanExpiredCache(): void {
  // LRU cache handles expiration automatically on get()
  // This function is kept for backward compatibility
  lruSearchCache.removeExpired();
}

/**
 * Lightweight semantic scoring for two-pass search (Standard 134)
 * Scores candidates without expensive context inflation
 */
function calculateLightweightScore(
  result: SearchResult,
  queryTerms: string[],
  query: string,
): number {
  if (!result.content) return result.score || 0;

  const content = result.content.toLowerCase();
  const contentWords = new Set(content.split(/\s+/).filter(w => w.length > 2));

  // Term overlap score (0-1)
  let termMatches = 0;
  for (const term of queryTerms) {
    const termLower = term.toLowerCase();
    if (content.includes(termLower)) termMatches++;
  }
  const termScore = queryTerms.length > 0 ? termMatches / queryTerms.length : 0;

  // Exact phrase bonus
  const phraseBonus = content.includes(query.toLowerCase()) ? 0.3 : 0;

  // Tag relevance bonus
  const tagBonus = result.tags && result.tags.length > 0
    ? result.tags.filter(t => queryTerms.some(qt => t.toLowerCase().includes(qt.toLowerCase()))).length * 0.1
    : 0;

  // Recency bonus (newer = higher score, decay over 30 days)
  let recencyBonus = 0;
  if (result.timestamp) {
    const ageDays = (Date.now() - result.timestamp) / (1000 * 60 * 60 * 24);
    recencyBonus = Math.max(0, 0.2 * (1 - ageDays / 30));
  }

  // Combine scores (base score + term overlap + bonuses)
  const baseScore = result.score || 0.5;
  return Math.min(1.0, baseScore * 0.3 + termScore * 0.5 + phraseBonus + tagBonus + recencyBonus);
}

/**
 * Enrich atoms with molecule tags for better contextual associations
 * Fetches tags from parent molecules and merges them with atom tags
 * This provides richer semantic context for LLMs viewing search results
 */
async function enrichAtomsWithMoleculeTags(anchors: SearchResult[]): Promise<void> {
  try {
    // Group anchors by compound_id for efficient batch query
    const anchorsByCompound = new Map<string, SearchResult[]>();
    
    for (const anchor of anchors) {
      if (anchor.compound_id) {
        if (!anchorsByCompound.has(anchor.compound_id)) {
          anchorsByCompound.set(anchor.compound_id, []);
        }
        anchorsByCompound.get(anchor.compound_id)!.push(anchor);
      }
    }

    if (anchorsByCompound.size === 0) return;

    const compoundIds = Array.from(anchorsByCompound.keys());

    try {
      // ⚡ Bolt Optimization: Batch fetch molecules for all compounds using ANY() to prevent N+1 queries
      const molQuery = `
        SELECT compound_id, tags
        FROM molecules
        WHERE compound_id = ANY($1) AND tags IS NOT NULL
      `;

      const molResult = await db.run(molQuery, [compoundIds]);

      // Group molecule tags by compound_id
      const tagsByCompound = new Map<string, Set<string>>();

      if (molResult.rows && molResult.rows.length > 0) {
        for (const molRow of molResult.rows) {
          const cId = molRow.compound_id;
          if (!tagsByCompound.has(cId)) {
            tagsByCompound.set(cId, new Set<string>());
          }
          const compoundTags = tagsByCompound.get(cId)!;
          
          if (molRow.tags) {
            let rawTags: unknown = molRow.tags;

            if (typeof rawTags === 'string') {
              try {
                rawTags = JSON.parse(rawTags);
              } catch {
                // Malformed tags JSON for this molecule; skip this row only.
                continue;
              }
            }

            if (Array.isArray(rawTags)) {
              for (const tag of rawTags) {
                if (tag && typeof tag === 'string') {
                  compoundTags.add(tag);
                }
              }
            }
          }
        }
      }

      // Merge molecule tags with each atom's tags
      for (const [compoundId, compoundAnchors] of anchorsByCompound) {
        const moleculeTags = tagsByCompound.get(compoundId);
        if (moleculeTags && moleculeTags.size > 0) {
          for (const anchor of compoundAnchors) {
            const atomTags = anchor.tags || [];
            const mergedTags = Array.from(
              new Set([...atomTags, ...moleculeTags]),
            );

            // Sort tags for consistency (atom tags first, then molecule tags alphabetically)
            anchor.tags = mergedTags.sort();
          }
        }
      }
    } catch (molErr) {
      // Silently continue if molecule tag fetch fails, but include compoundId context for debugging
      const sampleCompoundIds = compoundIds.slice(0, 5);
      console.debug(
        '[Search] Could not fetch molecule tags for compounds (count=%d, sample=%o): %o',
        compoundIds.length,
        sampleCompoundIds,
        molErr,
      );
    }
  } catch (e) {
    console.warn('[Search] Failed to enrich atoms with molecule tags:', e);
    // Continue without enrichment - this is not a critical failure
  }
}

import { PhysicsTagWalker } from './physics-tag-walker.js';
import { assembleAndSerialize, assembleContextPackage } from './graph-context-serializer.js';
import type { UserContext } from '../../types/context.js';

// ---------------------------------------------------------------------------
// Search serialization lock — only one search runs at a time to prevent
// concurrent searches from doubling peak heap usage.
// ---------------------------------------------------------------------------
let _searchLock: Promise<void> = Promise.resolve();
function acquireSearchLock(): Promise<() => void> {
  let release!: () => void;
  const next = new Promise<void>(resolve => { release = resolve; });
  const acquired = _searchLock.then(() => release);
  _searchLock = _searchLock.then(() => next);
  return acquired;
}

// Memory thresholds - loaded from user_settings.json with defaults
// Standard 127/134/135: Configurable memory management
function getMemoryThresholds() {
  const userSettings = (config as any).MEMORY || {};
  return {
    // HEAP_PRESSURE_MB: if V8 heapUsed exceeds this, downgrade max-recall → standard
    HEAP_PRESSURE_MB: userSettings.heap_pressure_mb ?? 500,
    // Throttling thresholds for memory-aware search pacing
    THROTTLE_START_MB: userSettings.throttle_start_mb ?? 800,
    THROTTLE_MAX_MB: userSettings.throttle_max_mb ?? 1200,
    EMERGENCY_STOP_MB: userSettings.emergency_stop_mb ?? 1500,
    // Streaming results configuration
    RESULTS_BATCH_SIZE: userSettings.search_results_batch_size ?? 20,
    ENABLE_STREAMING: userSettings.enable_streaming_results ?? false,
  };
}

function heapUsedMB(): number {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

/**
 * Memory-aware throttling: slows down or blocks searches based on memory pressure
 * Returns true if search should proceed, false if it should be rejected
 * Standard 127/134/135: Configurable memory thresholds
 */
async function throttleSearchForMemory(): Promise<{ proceed: boolean; delayMs: number; reason?: string }> {
  const heapMB = heapUsedMB();
  const thresholds = getMemoryThresholds();

  // Emergency stop - reject search
  if (heapMB >= thresholds.EMERGENCY_STOP_MB) {
    console.warn(`[Throttle] EMERGENCY: Heap at ${heapMB}MB >= ${thresholds.EMERGENCY_STOP_MB}MB. Rejecting search.`);
    return { proceed: false, delayMs: 0, reason: `Memory too high (${heapMB}MB)` };
  }

  // Throttle zone - reject if too high
  if (heapMB >= thresholds.THROTTLE_MAX_MB) {
    console.warn(`[Throttle] Heap at ${heapMB}MB >= ${thresholds.THROTTLE_MAX_MB}MB. Rejecting search temporarily.`);
    return { proceed: false, delayMs: 0, reason: `Memory pressure (${heapMB}MB)` };
  }

  // Throttle zone - add delay based on memory pressure
  if (heapMB >= thresholds.THROTTLE_START_MB) {
    const pressureRatio = (heapMB - thresholds.THROTTLE_START_MB) / (thresholds.THROTTLE_MAX_MB - thresholds.THROTTLE_START_MB);
    const delayMs = Math.round(pressureRatio * 10000); // Up to 10 second delay
    console.log(`[Throttle] Heap at ${heapMB}MB. Delaying search by ${delayMs}ms (pressure: ${(pressureRatio * 100).toFixed(0)}%)`);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    return { proceed: true, delayMs, reason: `Throttled (${heapMB}MB)` };
  }

  // Normal operation - no delay
  return { proceed: true, delayMs: 0 };
}

/**
 * Safely read a slice of a file from disk asynchronously, with size limits to prevent OOM.
 */
async function readSliceFromDiskAsync(
  filePath: string,
  start?: number,
  end?: number,
  maxBytesToRead: number = 100000 // 100KB default cap
): Promise<string | null> {
  const fs = await import('fs');
  let fileHandle: any = null;
  try {
    const stats = await fs.promises.stat(filePath);
    const fileSize = stats.size;
    if (fileSize === 0) return '';

    // Determine bounds
    const startByte = start !== undefined && start !== null ? Math.max(0, start) : 0;
    let endByte = end !== undefined && end !== null ? Math.min(fileSize, end) : fileSize;

    if (startByte >= fileSize) return '';
    if (endByte > fileSize) endByte = fileSize;
    if (startByte >= endByte) return '';

    // Cap the bytes to read to prevent massive memory usage
    let lengthToRead = endByte - startByte;
    if (lengthToRead > maxBytesToRead) {
      lengthToRead = maxBytesToRead;
    }

    const buffer = Buffer.alloc(lengthToRead);
    fileHandle = await fs.promises.open(filePath, 'r');
    const { bytesRead } = await fileHandle.read(buffer, 0, lengthToRead, startByte);
    
    if (bytesRead === 0) return '';
    return buffer.toString('utf-8', 0, bytesRead);
  } catch (err) {
    return null;
  } finally {
    if (fileHandle) {
      try {
        await fileHandle.close();
      } catch (e) {
        // ignore close error
      }
    }
  }
}

/**
 * Find Anchors (Direct Hits) - Formerly part of tagWalkerSearch
 * Executes Strategy A (Atom positions) and Strategy B (Molecules FTS)
 */
export async function findAnchors(
  query: string,
  buckets: string[] = [],
  tags: string[] = [],
  _maxChars: number = config.SEARCH.max_chars_default,
  provenance: 'internal' | 'external' | 'quarantine' | 'all' = 'all',
  filters?: { type?: string; minVal?: number; maxVal?: number; },
  fuzzy: boolean = false,
): Promise<SearchResult[]> {
  try {
    const sanitizedQuery = sanitizeFtsQuery(query);
    if (!sanitizedQuery) return [];

    // 0. Dynamic Atom Scaling
    const tokenBudget = Math.floor(_maxChars / 4);
    const avgTokensPerAtom = 60; // Tuned for better density
    const targetAtomCount = Math.max(10, Math.ceil(tokenBudget / avgTokensPerAtom));

    console.log(`[Search] Dynamic Scaling: Budget=${tokenBudget}t -> Target=${targetAtomCount} atoms`);

    // Construct Query String for FTS
    // Use OR ( | ) by default so multi-word queries find documents containing
    // ANY of the terms, not ALL of them. AND ( & ) is too restrictive for
    // conversational queries like "College Music education" — it requires all
    // three words in the same molecule, which rarely matches.
    // Strip English stop words before building the tsquery — 'simple' config
    // does NOT filter them, so connector words like "and", "the", "or" would
    // match almost every molecule and corrupt ranking.
    const FTS_STOP_WORDS = new Set([
      'a','an','and','are','as','at','be','been','being','but','by',
      'can','could','did','do','does','doing','done','each','for',
      'from','had','has','have','having','he','her','him','his',
      'how','i','if','in','is','it','its','itself','just','me',
      'more','my','no','not','of','off','on','or','our','out',
      'own','same','she','should','so','some','such','than','that',
      'the','their','them','then','there','these','they','this',
      'those','to','too','very','was','we','were','what','when',
      'where','which','while','who','whom','why','will','with',
      'would','you','your','yours',
    ]);
    const queryWords = sanitizedQuery.trim().split(/\s+/).filter(t => t.length > 0);
    const contentWords = queryWords.filter(t => !FTS_STOP_WORDS.has(t));
    // Fall back to full word list if stop-word stripping removed everything
    const baseTerms = contentWords.length > 0 ? contentWords : queryWords;
    // Expand camelCase identifiers (e.g. findAnchors → [findanchors, find, anchors])
    // so FTS can match partial names and prose descriptions of the same concept.
    const tsTerms = expandCamelCase(baseTerms);
    const tsQueryString = tsTerms.join(' | ');

    let anchors: SearchResult[] = [];
    const atomResults: SearchResult[] = [];

    // A. Atom Search (Radial Inflation) via ContextInflator
    // Use stop-word-stripped terms (tsTerms) so we don't inflate around "and", "the", etc.
    const terms = tsTerms.length > 0 ? tsTerms : sanitizedQuery.split(/\s+/).filter(t => t.length > 0);

    if (terms.length > 0) {
      try {
        // [Standard 132] Use adaptive concurrency based on available memory
        const inflations = await processWithAdaptiveConcurrency(
          terms,
          async term => ContextInflator.inflateFromAtomPositions(term, 150, 20, undefined, { buckets, provenance }),
        );
        const rawAtoms = inflations.flat();

        // [Standard 134] Two-pass scoring: score candidates before expensive processing
        // This avoids inflating low-quality candidates, saving memory and time
        const scoredAtoms = rawAtoms.map(atom => ({
          ...atom,
          score: calculateLightweightScore(atom, terms, sanitizedQuery),
        }));

        // Sort by score and keep only top N (mobile: 5, desktop: 10 per term)
        const isMobile = process.platform === 'android' || (await import('os')).totalmem() < 2 * 1024 * 1024 * 1024;
        const maxResultsPerTerm = isMobile ? 5 : 10;
        const topAtoms = scoredAtoms
          .sort((a, b) => (b.score || 0) - (a.score || 0))
          .slice(0, maxResultsPerTerm * terms.length);

        atomResults.push(...topAtoms);
        console.log(`[Search] Atom search found ${rawAtoms.length} atoms, kept top ${topAtoms.length} after scoring for terms: ${terms.join(', ')}`);
      } catch (e) {
        console.error('[Search] Atom Search failed:', e);
      }
    }
    anchors = atomResults;

    // B. Molecule Search (Full-Text with BM25-style ranking)
    let moleculeQuery = `
        SELECT m.id, m.content, m.source_path as source, m.timestamp,
               '{}'::text[] as buckets, '{}'::text[] as tags, 'epoch_placeholder' as epochs, m.provenance,
               -- Use ts_rank_cd for cover-density ranking (closer to BM25)
               ts_rank_cd(to_tsvector('simple', m.content), to_tsquery('simple', $1)) * 10 as score,
               m.sequence, m.molecular_signature,
               m.start_byte, m.end_byte, m.type, m.numeric_value, m.numeric_unit, m.compound_id
        FROM molecules m
        WHERE to_tsvector('simple', m.content) @@ to_tsquery('simple', $1)
    `;

    const moleculeParams: (string | number | string[] | null)[] = [tsQueryString];

    if (buckets.length > 0) {
      moleculeQuery += ` AND EXISTS (
        SELECT 1 FROM atoms a
        WHERE a.compound_id = m.compound_id
        AND a.buckets && $${moleculeParams.length + 1}
      )`;
      moleculeParams.push(buckets);
    }

    if (provenance !== 'all' && provenance !== 'quarantine') {
      moleculeQuery += ` AND m.provenance = $${moleculeParams.length + 1}`;
      moleculeParams.push(provenance);
    } else if (provenance === 'all') {
      moleculeQuery += ' AND m.provenance != \'quarantine\'';
    }

    // Replace hardcoded LIMIT 50 with the intended dynamic token budget scalar
    // SECURITY FIX (Standard 130): Use parameterized LIMIT to prevent SQL injection
    // SQLite requires LIMIT to be a parameter, not interpolated string
    moleculeQuery += ` ORDER BY score DESC LIMIT $${moleculeParams.length + 1}`;
    moleculeParams.push(targetAtomCount);

    try {
      let molResult = await db.run(moleculeQuery, moleculeParams);

      // Strategy 1.1: If AND fails and query has multiple terms, retry with OR (Fuzzy Fallback)
      if (molResult.rows.length === 0 && tsQueryString.includes('&')) {
        console.log('[Search] Initial AND query yielded 0 results. Retrying with OR-fuzzy logic...');

        // To prevent massive Cartesian product explosions in SQL, we limit the OR fallback
        // to the top 8 longest words (which are statistically more likely to be unique/important).
        const allTerms = sanitizedQuery.split(/\s+/).filter(t => t.length > 3);
        const uniqueTerms = Array.from(new Set(allTerms));
        uniqueTerms.sort((a, b) => b.length - a.length);
        const topTerms = uniqueTerms.slice(0, 8);

        if (topTerms.length > 0) {
          const orQueryString = topTerms.join(' | ');
          console.log(`[Search] OR-fuzzy fallback using terms: ${orQueryString}`);
          const orQuery = moleculeQuery.replace(/\$1/g, '$1'); // Keep same param index
          const orParams = [orQueryString, ...moleculeParams.slice(1)];
          molResult = await db.run(orQuery, orParams);
        }
      }
      const molecules = (molResult.rows || []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        content: row.content as string,
        source: row.source as string,
        timestamp: Number(row.timestamp),
        buckets: Array.isArray(row.buckets) ? row.buckets : [],
        tags: Array.isArray(row.tags) ? row.tags : [],
        epochs: typeof row.epochs === 'string' ? row.epochs : '',
        provenance: row.provenance as string,
        score: Number(row.score ?? 0),
        sequence: Number(row.sequence ?? 0),
        molecular_signature: row.molecular_signature as string | undefined,
        start_byte: Number(row.start_byte ?? 0),
        end_byte: Number(row.end_byte ?? 0),
        type: row.type as string | undefined,
        numeric_value: row.numeric_value as number | string | undefined,
        numeric_unit: row.numeric_unit as string | undefined,
        compound_id: String(row.compound_id),
      }));

      // Merge atom and molecule results
      anchors = [...atomResults, ...molecules];

      // Deduplicate anchors using Range Merging
      // Group by compound_id to find overlaps
      const anchorsByCompound = new Map<string, SearchResult[]>();

      [...atomResults, ...molecules].forEach(a => {
        if (!a.compound_id) return;
        if (!anchorsByCompound.has(a.compound_id)) {
          anchorsByCompound.set(a.compound_id, []);
        }
        anchorsByCompound.get(a.compound_id)!.push(a);
      });

      anchors = [];

      for (const [cId, compoundAnchors] of anchorsByCompound) {
        // Sort by start byte
        compoundAnchors.sort((a, b) => (a.start_byte || 0) - (b.start_byte || 0));

        const merged: SearchResult[] = [];
        if (compoundAnchors.length === 0) continue;

        let current = compoundAnchors[0];

        for (let i = 1; i < compoundAnchors.length; i++) {
          const next = compoundAnchors[i];
          const currentEnd = (current.end_byte || 0);
          const nextStart = (next.start_byte || 0);
          const nextEnd = (next.end_byte || 0);

          // LOGGING FOR DEBUGGING
          // console.log(`[Dedup] Checking ${cId}: [${current.start_byte}-${currentEnd}] vs [${nextStart}-${nextEnd}]`);

          // Check for overlap or adjacency (within 50 bytes)
          if (nextStart <= currentEnd + 50) {
            // If identical start/end, it's a true duplicate (just skip next)
            if (Math.abs(nextStart - (current.start_byte || 0)) < 5 && Math.abs(nextEnd - currentEnd) < 5) {
              // console.log(`[Dedup] Exact/Near match found. Skipping.`);
              continue;
            }

            // If next is contained in current, skip next
            if (nextEnd <= currentEnd) {
              // console.log(`[Dedup] Next contained in Current. Skipping.`);
              continue;
            }

            // If current is contained in next, switch to next
            if ((next.start_byte || 0) <= (current.start_byte || 0) && nextEnd >= currentEnd) {
              // console.log(`[Dedup] Current contained in Next. Swapping.`);
              current = next;
              continue;
            }

            // Strict Dedup: If they overlap by more than 50% (lowered from 80%), suppress the lower scored one.
            const overlap = Math.min(currentEnd, nextEnd) - Math.max((current.start_byte || 0), nextStart);
            const len1 = currentEnd - (current.start_byte || 0);
            const len2 = nextEnd - nextStart;

            if (overlap > 0 && (overlap / len1 > 0.5 || overlap / len2 > 0.5)) {
              // console.log(`[Dedup] Heavy overlap (>50%). Picking better score.`);
              // Keep the one with higher score, or if equal, the current (first)
              if ((next.score || 0) > (current.score || 0)) {
                current = next;
              }
              continue; // Skip the 'loser'
            }

            merged.push(current);
            current = next;

          } else {
            merged.push(current);
            current = next;
          }
        }
        merged.push(current);
        anchors.push(...merged);
      }

      // Final Safety Net: Global Content Similarity Deduplication
      // OPTIMIZED: O(N log N) with content bucketing (was O(N^2))
      // Addresses:
      // 1. Cross-Compound Duplicates (different IDs/provenance, same text)
      // 2. Near-Exact Duplicates (whitespace diffs, timestamp diffs)
      // 3. Containment (one result is a subset of another)
      // 4. Overlapping Windows from same compound

      const distinctAnchors: SearchResult[] = [];
      // Sort by score desc to prioritize best matches
      anchors.sort((a, b) => (b.score || 0) - (a.score || 0));

      // Helper for normalization: lowercase + remove non-alphanumeric + unescape JSON
      const normalize = (s: string) => {
        let unescaped = s;
        try {
          unescaped = s
            .replace(/\\"/g, '"')
            .replace(/\\\\/g, '\\')
            .replace(/\\n/g, '\n')
            .replace(/\\r/g, '\r')
            .replace(/\\t/g, '\t');
        } catch (e) {
          // If unescaping fails, use original
        }
        return unescaped.toLowerCase().replace(/[^a-z0-9]/g, '');
      };

      // Helper for content fingerprinting (hash-based dedup across files)
      const crypto = await import('crypto');
      const contentFingerprints = new Map<string, SearchResult>(); // hash -> kept result

      // Track kept ranges per compound to detect sliding window duplicates
      const keptRanges = new Map<string, { start: number, end: number, content: string }[]>();

      // OPTIMIZATION: Content bucketing for O(N log N) deduplication
      // Group by content length bucket (within 20% tolerance) and fingerprint prefix
      // This reduces comparisons from O(N²) to O(N log N) by only comparing similar content
      interface ContentBucket {
        fingerprints: Map<string, SearchResult>; // fingerprint -> result
        results: SearchResult[];
      }
      
      const contentBuckets = new Map<string, ContentBucket>(); // bucket key -> bucket
      
      // Get bucket key based on content length and fingerprint prefix
      const getBucketKey = (normalizedContent: string): string => {
        const length = normalizedContent.length;
        // Bucket by log2 of length for O(log N) buckets
        // Content within 2x length ratio goes to same or adjacent buckets
        const lengthBucket = Math.floor(Math.log2(Math.max(1, length)));
        const fingerprint = normalizedContent.substring(0, 50);
        return `${lengthBucket}:${fingerprint}`;
      };
      
      // Get adjacent bucket keys for containment checks
      const getAdjacentBuckets = (length: number): number[] => {
        const currentBucket = Math.floor(Math.log2(Math.max(1, length)));
        return [currentBucket - 1, currentBucket, currentBucket + 1];
      };

      for (const candidate of anchors) {
        if (!candidate.content || candidate.content.length < 20) {
          distinctAnchors.push(candidate);
          continue;
        }

        // C. Content Fingerprint Deduplication (ACROSS different files)
        const candidateNorm = normalize(candidate.content);
        const contentHash = crypto.createHash('md5').update(candidateNorm.substring(0, 500)).digest('hex');

        if (contentFingerprints.has(contentHash)) {
          continue; // Duplicate content from another file
        }
        contentFingerprints.set(contentHash, candidate);

        // A. Geometric Deduplication (if compound_id is available)
        let isGeometricDuplicate = false;
        if (candidate.compound_id && candidate.start_byte !== undefined && candidate.end_byte !== undefined) {
          const ranges = keptRanges.get(candidate.compound_id) || [];
          for (const range of ranges) {
            const overlapStart = Math.max(candidate.start_byte, range.start);
            const overlapEnd = Math.min(candidate.end_byte, range.end);
            const overlapLen = Math.max(0, overlapEnd - overlapStart);

            const candidateLen = candidate.end_byte - candidate.start_byte;
            const rangeLen = range.end - range.start;
            const minLen = Math.min(candidateLen, rangeLen);

            if (overlapLen > 0 && (overlapLen >= minLen * 0.5)) {
              isGeometricDuplicate = true;
              break;
            }

            const gap = Math.max(0, overlapStart - overlapEnd);
            const adjacencyThreshold = Math.max(500, Math.min(candidateLen, rangeLen) * 0.2);
            if (gap >= 0 && gap < adjacencyThreshold) {
              isGeometricDuplicate = true;
              break;
            }
          }

          if (isGeometricDuplicate) continue;
        }

        // B. Content Deduplication (Fallback) - OPTIMIZED with bucketing
        const candidateFingerprint = candidateNorm.substring(0, 100);
        const bucketKey = getBucketKey(candidateNorm);
        
        // Get or create bucket for this content
        let bucket = contentBuckets.get(bucketKey);
        if (!bucket) {
          bucket = { fingerprints: new Map(), results: [] };
          contentBuckets.set(bucketKey, bucket);
        }
        
        // Check exact fingerprint match in bucket (O(1))
        if (bucket.fingerprints.has(candidateFingerprint)) {
          continue; // Exact duplicate
        }

        // Check containment and fuzzy match only in adjacent buckets (O(log N) instead of O(N))
        let isContentDuplicate = false;
        const candidateLen = candidateNorm.length;
        const adjacentBuckets = getAdjacentBuckets(candidateLen);
        
        for (const adjBucketNum of adjacentBuckets) {
          // Check all buckets with this length bucket
          for (const [key, adjBucket] of contentBuckets.entries()) {
            if (!key.startsWith(`${adjBucketNum}:`)) continue;
            
            // Check containment with bucket results
            for (const kept of adjBucket.results) {
              if (!kept.content) continue;
              const keptNorm = normalize(kept.content);
              const keptFingerprint = keptNorm.substring(0, 100);

              // 1. Exact Containment
              if (keptNorm.includes(candidateNorm) || candidateNorm.includes(keptNorm)) {
                isContentDuplicate = true;
                break;
              }

              // 2. Fuzzy Prefix Match
              const checkLen = Math.min(candidateFingerprint.length, keptFingerprint.length);
              if (checkLen > 50 && candidateFingerprint.substring(0, checkLen) === keptFingerprint.substring(0, checkLen)) {
                isContentDuplicate = true;
                break;
              }

              // 3. SimHash Distance Check
              if (candidate.molecular_signature && kept.molecular_signature) {
                const simhashDistance = getHammingDistance(candidate.molecular_signature, kept.molecular_signature);
                if (simhashDistance < 5) {
                  isContentDuplicate = true;
                  break;
                }
              }
              
              if (isContentDuplicate) break;
            }
            
            if (isContentDuplicate) break;
          }
          
          if (isContentDuplicate) break;
        }

        if (!isContentDuplicate) {
          distinctAnchors.push(candidate);
          bucket.fingerprints.set(candidateFingerprint, candidate);
          bucket.results.push(candidate);

          // Register range
          if (candidate.compound_id && candidate.start_byte !== undefined && candidate.end_byte !== undefined) {
            const ranges = keptRanges.get(candidate.compound_id) || [];
            ranges.push({ start: candidate.start_byte, end: candidate.end_byte, content: candidate.content });
            keptRanges.set(candidate.compound_id, ranges);
          }
        }
      }

      const originalCount = anchors.length;
      anchors = distinctAnchors;
      console.log(`[Search] Final Dedup: ${originalCount} -> ${anchors.length} items. Removed ${originalCount - anchors.length} duplicates.`);

      console.log(`[Search] Anchors found: ${atomResults.length} Atoms, ${molecules.length} Molecules. Final Unique: ${anchors.length}`);

    } catch (e) {
      console.error('[Search] Molecule search failed:', e);
      anchors = atomResults;
    }

    // Intercept: Read content from Mirror (if source_path exists)
    // For atoms without source files (chat history), keep DB content

    const { getMirrorPath } = await import('../mirror/mirror.js');

    // Parallelize mirror reads for performance (non-blocking I/O)
    await Promise.all(anchors.map(async anchor => {
      // Skip mirror read if no source_path (chat history atoms)
      if (!anchor.source || anchor.source.trim() === '') {
        return; // Keep DB content
      }

      try {
        // Calculate Mirror Path
        const mirrorPath = getMirrorPath(anchor.source, anchor.provenance);

        // Check if exists and read async slice to prevent OOM / Event Loop freezes
        try {
          const liveContent = await readSliceFromDiskAsync(
            mirrorPath,
            anchor.start_byte,
            anchor.end_byte,
            100000
          );
          if (liveContent && liveContent.length > 0) {
            anchor.content = liveContent;
          }
        } catch (err) {
          // Ignore ENOENT (file missing) or other read errors
        }
      } catch {
        // Fail silently -> Keep DB content
      }
    }));

    // === TAG ENRICHMENT: Merge molecule tags with atom tags ===
    // This provides richer contextual associations for LLMs by showing
    // all tags from the parent molecule(s) alongside atom tags
    await enrichAtomsWithMoleculeTags(anchors);

    return anchors;

  } catch (e) {
    console.error('[Search] findAnchors failed:', e);
    return [];
  }
}

/**
 * Execute search with Intelligent Expansion and Physics Tag-Walker Protocol (GCP)
 *
 * @param query - Search query string
 * @param buckets - Array of buckets to search
 * @param maxChars - Maximum characters to return
 * @param provenance - Provenance filter (internal/external/quarantine/all)
 * @param explicitTags - Explicit tags to filter by
 * @param filters - Additional filters
 * @param useMaxRecall - If true, uses MAX_RECALL_CONFIG for comprehensive retrieval
 * @param userContext - User context for personalization
 */
export async function executeSearch(
  query: string,
  buckets?: string[],
  maxChars: number = config.SEARCH.max_chars_default,
  provenance: 'internal' | 'external' | 'quarantine' | 'all' = 'all',
  explicitTags: string[] = [],
  filters?: { type?: string; minVal?: number; maxVal?: number; },
  useMaxRecall: boolean = false,
  userContext?: UserContext,
  mode?: string,
): Promise<{ context: string; results: SearchResult[]; toAgentString: () => string; metadata?: Record<string, unknown> }> {
  console.log(`[Search] executeSearch (Physics Engine V2) called with provenance: ${provenance}`);
  const startTime = Date.now();

  // Serialize searches — only one at a time to keep peak heap predictable.
  // Concurrent searches on a large corpus (214K+ atoms) double peak memory usage.
  const release = await acquireSearchLock();
  try {
    return await _executeSearchInternal(
      query, buckets, maxChars, provenance,
      explicitTags, filters, useMaxRecall, userContext, startTime,
    );
  } finally {
    release();
    if (typeof global.gc === 'function') global.gc();
  }
}

async function _executeSearchInternal(
  query: string,
  buckets?: string[],
  maxChars: number = config.SEARCH.max_chars_default,
  provenance: 'internal' | 'external' | 'quarantine' | 'all' = 'all',
  explicitTags: string[] = [],
  filters?: { type?: string; minVal?: number; maxVal?: number; },
  useMaxRecall: boolean = false,
  userContext?: UserContext,
  startTime: number = Date.now(),
): Promise<{ context: string; results: SearchResult[]; toAgentString: () => string; metadata?: Record<string, unknown> }> {
  // Memory-aware throttling: slow down or reject searches based on memory pressure
  const throttleResult = await throttleSearchForMemory();
  if (!throttleResult.proceed) {
    throw new Error(`Search rejected: ${throttleResult.reason}. Please wait and try again.`);
  }

  // Memory pressure check: if heap is already near the limit, downgrade max-recall
  // to standard search to avoid OOM. Trades result depth for stability.
  const heapMB = heapUsedMB();
  const thresholds = getMemoryThresholds();
  if (useMaxRecall && heapMB > thresholds.HEAP_PRESSURE_MB) {
    console.warn(`[Search] Memory pressure detected (${heapMB}MB heap). Downgrading max-recall → standard search.`);
    useMaxRecall = false;
    maxChars = Math.min(maxChars, config.SEARCH.max_chars_default);
  }

  // Search runs immediately even during ingestion — partial results are better than a frozen UI.
  // PGlite serializes all DB ops on its internal queue, so concurrent search + ingest is safe.
  if (systemStatus.getStatus().isBusy) {
    console.log(`[Search] Running search during ingestion (partial corpus expected).`);
  }

  // 1. Parse & Prepare
  const cleanQuery = query; // Simplified for now, real NLP parsing happens in findAnchors/query-parser calls if needed
  const realBuckets = new Set(buckets || []);
  if (explicitTags.length > 0) console.log(`[Search] Explicit tags: ${explicitTags.join(', ')}`);

  // 2. Find Anchors (Planets)
  // Combine Engram Lookup + FTS + Molecule Search
  const engramIds = await lookupByEngram(cleanQuery);
  const engramResults = await hydrateEngrams(engramIds);
  const primaryAnchors = await findAnchors(cleanQuery, Array.from(realBuckets), explicitTags, maxChars, provenance, filters);

  // Tag-Aware Fallback (if low precision/recall on initial anchors)
  if (primaryAnchors.length < 5) {
    console.log(`[Search] Low recall (${primaryAnchors.length} anchors). Attempting Tag-Aware Fallback.`);
    const words = cleanQuery.split(/[\s,]+/);
    // Very naive tag extraction: words > 4 chars, capitalize or check if exists in a tag format.
    // Usually, users type things like "graph nodes consciousness". We can try to use these as tags via LIKE query.
    const fallbackTags = words.filter(w => w.length > 3).map(w => w.toLowerCase());
    if (fallbackTags.length > 0) {
      // Simple programmatic fallback to explicitly look for these terms in the DB tags
      try {
        for (const fbTag of fallbackTags) {
          // PostgreSQL array search - check if tag exists in array
          const tagRes = await db.run(`
                      SELECT id, content, source_path, timestamp, buckets, tags, provenance, simhash, embedding, compound_id, start_byte, end_byte
                      FROM atoms
                      WHERE $1 = ANY(tags)
                      LIMIT 20
                  `, [fbTag]);
          if (tagRes.rows && tagRes.rows.length > 0) {
            tagRes.rows.forEach((row: Record<string, unknown>) => {
              primaryAnchors.push({
                id: String(row.id),
                content: row.content as string,
                source: row.source_path as string,
                timestamp: Number(row.timestamp ?? Date.now()),
                buckets: typeof row.buckets === 'string' ? JSON.parse(row.buckets) : (row.buckets || []),
                tags: typeof row.tags === 'string' ? JSON.parse(row.tags) : (row.tags || []),
                epochs: '',
                provenance: row.provenance as string,
                score: 0.8, // fallback constant score
                compound_id: String(row.compound_id),
                start_byte: Number(row.start_byte ?? 0),
                end_byte: Number(row.end_byte ?? 0),
                molecular_signature: String(row.simhash ?? ''),
              });
            });
          }
        }
        // Enrich fallback results with molecule tags
        if (primaryAnchors.length > 0) {
          await enrichAtomsWithMoleculeTags(primaryAnchors);
        }
      } catch {
        // Tag-aware fallback failed; continue with primary anchors only
      }
    }
  }

  const allAnchors = [...engramResults, ...primaryAnchors];

  // Enrich engram results with molecule tags (findAnchors already does this internally)
  if (engramResults.length > 0) {
    await enrichAtomsWithMoleculeTags(engramResults);
  }

  // Deduplicate
  const seenIds = new Set<string>();
  const uniqueAnchors = allAnchors.filter(r => {
    if (seenIds.has(r.id)) return false;
    seenIds.add(r.id);
    return true;
  });

  // 3. Physics Walker (Moons) - Use TypeScript PhysicsTagWalker
  let walkerResults: import('./physics-tag-walker.js').PhysicsResult[] = [];
  try {
    // Separate real DB IDs from virtual in-memory molecules created by ContextInflator.
    // Virtual IDs (any prefix starting with 'virtual') have no row in atoms/molecules tables.
    // For each virtual anchor, use its compound_id to find the nearest real molecule.
    const realIds = uniqueAnchors
      .map(a => a.id)
      .filter(id => id && id !== '' && !id.startsWith('virtual'));

    // Collect unique compound_ids from virtual anchors so we can resolve them to real mol_* IDs.
    const virtualCompoundIds = [...new Set(
      uniqueAnchors
        .filter(a => a.id && a.id.startsWith('virtual') && a.compound_id)
        .map(a => a.compound_id as string),
    )];

    let resolvedMolIds: string[] = [];
    if (virtualCompoundIds.length > 0) {
      try {
        const res = await db.run(
          'SELECT id FROM molecules WHERE compound_id = ANY($1) ORDER BY timestamp DESC LIMIT 100',
          [virtualCompoundIds],
        );
        if (res.rows) resolvedMolIds = res.rows.map((r: Record<string, unknown>) => String(r.id));
      } catch {
        // Failed to resolve virtual compound IDs; continue with real atoms only
      }
    }

    const anchorIds = [...new Set([...realIds, ...resolvedMolIds])];

    // Round-robin by compound_id so the walker sees anchors from diverse source
    // documents rather than 30 IDs all from the same file.
    const diverseAnchorIds: string[] = [];
    {
      const byCompound = new Map<string, string[]>();
      for (const a of uniqueAnchors) {
        if (!a.id || (a.id).startsWith('virtual')) continue;
        const cid = (a.compound_id as string) || '__unknown__';
        if (!byCompound.has(cid)) byCompound.set(cid, []);
        byCompound.get(cid)!.push(a.id);
      }
      // Append resolved mol IDs (from virtual compounds) under their compound bucket
      for (const molId of resolvedMolIds) {
        const cid = '__virtual__';
        if (!byCompound.has(cid)) byCompound.set(cid, []);
        byCompound.get(cid)!.push(molId);
      }
      const groups = [...byCompound.values()];
      const maxRound = Math.max(...groups.map(g => g.length));
      for (let i = 0; i < maxRound; i++) {
        for (const group of groups) {
          if (i < group.length) diverseAnchorIds.push(group[i]);
        }
      }
    }
    const dedupedAnchorIds = [...new Set(diverseAnchorIds)];
    
    if (dedupedAnchorIds.length > 0) {
      // Use TypeScript PhysicsTagWalker for radial inflation
      console.log(`[Search] 🔬 PhysicsTagWalker starting: exploring ${dedupedAnchorIds.length} anchors for associations...`);
      const walker = new PhysicsTagWalker();
      walkerResults = await walker.performRadialInflation(
        dedupedAnchorIds,
        1,                           // radius (1 hop)
        useMaxRecall ? 300 : 150,    // maxPerHop (results returned; fetches 3x candidates)
        0.2,                         // temperature
        0.001,                        // gravityThreshold (lowered from 0.005 for sparser graphs)
      );
      console.log(`[Search] PhysicsTagWalker found ${walkerResults.length} associations`);
    } else {
      console.log('[Search] No valid anchor IDs for Physics Walker');
    }
  } catch {
    // Physics Walker failed; continue with primary anchors only
    walkerResults = [];
  }

  // 4. Graph-Context Serialization (GCP)
  const finalUserContext: UserContext = {
    name: userContext?.name || 'User',
    current_state: userContext?.current_state || 'active',
  };

  const contextPackage = assembleContextPackage({
    user: finalUserContext,
    query: cleanQuery,
    keyTerms: cleanQuery.split(' '),
    scopeTags: explicitTags,
    anchors: uniqueAnchors,
    walkerResults: walkerResults,
    charBudget: maxChars,
  });

  const serializedContext = assembleAndSerialize({
    user: finalUserContext,
    query: cleanQuery,
    keyTerms: cleanQuery.split(' '),
    scopeTags: explicitTags,
    anchors: uniqueAnchors,
    walkerResults: walkerResults,
    charBudget: maxChars,
  });

  console.log(`[Search] Search completed in ${Date.now() - startTime}ms`);

  // Map back to SearchResult[] for legacy API compatibility
  // Combine Anchors + Walker Results, sorted by score desc
  const combinedResults = [
    ...uniqueAnchors,
    ...walkerResults.map(w => ({
      ...w.result,
      physics: w.physics,
    })),
  ];

  // Cap total results fed to formatResults to prevent OOM.
  // 100KB per snippet cap in inflateSnippetFromDisk bounds memory per snippet,
  // but 900+ snippets * 100KB = still huge. Limit by budget: budget / 200 chars minimum
  // gives a rough upper bound on useful snippets.
  const maxResultsForBudget = Math.min(
    combinedResults.length,
    Math.max(200, Math.ceil(maxChars / 200)),
  );
  const cappedResults = combinedResults
    .sort((a: SearchResult, b: SearchResult) => (b.score || 0) - (a.score || 0))
    .slice(0, maxResultsForBudget);

  // Apply context provenance formatting with coalescing (Standard 108)
  // Enable coalescing for high-budget queries to improve coherence
  const enableCoalescing = maxChars > 16000; // Only coalesce for budgets > 16k chars
  const proximityThreshold = maxChars > 100000 ? 800 : 500; // Larger threshold for max-recall

  console.log(`[Search] Coalescing: ${enableCoalescing ? 'enabled' : 'disabled'} (threshold: ${proximityThreshold}px)`);

  const formatted = await formatResults(cappedResults, maxChars, {
    enableCoalescing,
    proximityThreshold,
  });

  return {
    context: serializedContext,
    results: formatted.results,
    toAgentString: () => serializedContext,
    metadata: { ...contextPackage.graphStats, ...formatted.metadata },
  };
}

/**
 * Execute molecule-based search - splits query into sentence-like chunks and searches each separately
 */
export async function executeMoleculeSearch(
  query: string,
  bucket?: string,
  buckets?: string[],
  maxChars: number = config.SEARCH.max_chars_default,
  deep: boolean = false,
  provenance: 'internal' | 'external' | 'quarantine' | 'all' = 'all',
  explicitTags: string[] = [],
  userContext?: UserContext,
  mode: 'standard' | 'clean' = 'standard',
): Promise<{ context: string; results: SearchResult[]; toAgentString: () => string; metadata?: Record<string, unknown> }> {
  // Memory-aware throttling
  const throttleResult = await throttleSearchForMemory();
  if (!throttleResult.proceed) {
    throw new Error(`Search rejected: ${throttleResult.reason}. Please wait and try again.`);
  }

  // Split the query into molecules (sentence-like chunks)
  const molecules = splitQueryIntoMolecules(query);
  console.log(`[MoleculeSearch] Split query into ${molecules.length} molecules:`, molecules);

  // Search each molecule separately
  const allResults: SearchResult[] = [];
  const includedIds = new Set<string>();

  for (const [index, molecule] of molecules.entries()) {
    console.log(`[MoleculeSearch] Searching molecule ${index + 1}/${molecules.length}: "${molecule}"`);

    try {
      // Execute search for this specific molecule
      const result = await executeSearch(
        molecule,
        buckets,
        maxChars,
        provenance,
        explicitTags,
        undefined,
        false,
        userContext,
      );

      // Add unique results to our collection
      for (const item of result.results) {
        if (!includedIds.has(item.id)) {
          allResults.push(item);
          includedIds.add(item.id);
        }
      }
    } catch (error) {
      console.error('[MoleculeSearch] Error searching molecule:', molecule, error);
      // Continue with other molecules even if one fails
    }
  }

  // Sort results by score
  allResults.sort((a, b) => b.score - a.score);

  const maxResults = config.SEARCH.max_results_default || 100;
  if (allResults.length > maxResults) {
    console.log(`[MoleculeSearch] Capping ${allResults.length} combined results to ${maxResults}`);
    allResults.length = maxResults;
  }

  console.log(`[MoleculeSearch] Combined results from ${molecules.length} molecules: ${allResults.length} total results`);

  // Clean Mode Filtering
  if (mode === 'clean') {
    const cleanedResults = allResults.map(result => {
      // Strip artifacts using regex patterns
      let cleanContent = stripArtifacts(result.content);
      
      // Validate content length
      const validation = validateCleanContent(cleanContent, maxChars);
      if (!validation.valid) {
        console.log(`[Search] Cleaning: Skipping result with content length ${cleanContent.length} (max: ${maxChars})`);
        return null;
      }
      
      // Create cleaned molecule object
      const cleanMolecule = {
        ...result,
        clean_content: cleanContent,
        relevance_score: result.score,
        removed_artifacts: [], // Can be extended to track specific artifacts removed
      };
      
      return cleanMolecule;
    }).filter(m => m != null) as SearchResult[];

    console.log(`[Search] Clean mode filtering complete: ${allResults.length} -> ${cleanedResults.length} results`);
    
    // Use cleaned results if they exist, otherwise fall back to original
    const finalResults = cleanedResults.length > 0 ? cleanedResults : allResults;
    
    return formatResults(finalResults, maxChars);
  }

  return await formatResults(allResults, maxChars); // Use original maxChars to maintain token budget
}

/**
 * Traditional FTS fallback
 */
export async function runTraditionalSearch(query: string, buckets: string[]): Promise<SearchResult[]> {
  const sanitizedQuery = sanitizeFtsQuery(query);
  if (!sanitizedQuery) return [];

  let querySql = `
    SELECT a.id,
           ts_rank(to_tsvector('simple', a.content), plainto_tsquery('simple', $1)) as score,
           a.content, a.source_path as source, a.timestamp,
           a.buckets, a.tags, 'epoch_placeholder' as epochs, a.provenance,
           a.start_byte, a.end_byte
    FROM atoms a
    WHERE to_tsvector('simple', a.content) @@ plainto_tsquery('simple', $1)
  `;

  if (buckets.length > 0) {
    querySql += ` AND EXISTS (
      SELECT 1 FROM unnest(a.buckets) as bucket WHERE bucket = ANY($2)
    )`;
  }

  const maxResults = config.SEARCH.max_results_default || 100;

  querySql += ` ORDER BY score DESC LIMIT ${maxResults}`;

  try {
    const result = await db.run(querySql, buckets.length > 0 ? [sanitizedQuery, buckets] : [sanitizedQuery]);
    if (!result.rows) return [];

    const mappedResults = result.rows.map((row: Record<string, unknown>) => ({
      id: String(row.id),
      score: Number(row.score ?? 0),
      content: row.content as string,
      source: row.source as string,
      timestamp: Number(row.timestamp ?? 0),
      buckets: Array.isArray(row.buckets) ? row.buckets : [],
      tags: Array.isArray(row.tags) ? row.tags : [],
      epochs: typeof row.epochs === 'string' ? row.epochs : '',
      provenance: row.provenance as string,
      start_byte: Number(row.start_byte ?? 0),
      end_byte: Number(row.end_byte ?? 0),
    }));

    await hydrateFromMirror(mappedResults);
    return mappedResults;
  } catch (e) {
    console.error('[Search] FTS failed', e);
    return [];
  }
}

/** 
 * Helper to hydrate results from Mirror (Code Reuse)
 */
async function hydrateFromMirror(results: SearchResult[]) {
  try {
    const { getMirrorPath } = await import('../mirror/mirror.js');

    await Promise.all(results.map(async res => {
      try {
        const mirrorPath = getMirrorPath(res.source, res.provenance);
        try {
          const content = await readSliceFromDiskAsync(
            mirrorPath,
            res.start_byte,
            res.end_byte,
            100000
          );
          if (content) res.content = content;
        } catch (err) {
          // ignore file not found
        }
      } catch (e) { /* ignore */ }
    }));
  } catch (e) { /* ignore */ }
}

/**
 * Iterative Search with Back-off Strategy
 * Attempts to retrieve results by progressively simplifying the query.
 * 
 * @param useMaxRecall - If true, uses MAX_RECALL_CONFIG for comprehensive retrieval
 */
export async function iterativeSearch(
  query: string,
  buckets: string[] = [],
  maxChars: number = config.SEARCH.max_chars_default,
  tags: string[] = [],
  provenance: 'internal' | 'external' | 'quarantine' | 'all' = 'all',
  useMaxRecall: boolean = false,
  userContext?: UserContext,
  mode: 'standard' | 'clean' = 'standard',
): Promise<{ context: string; results: SearchResult[]; attempt: number; metadata?: Record<string, unknown>; toAgentString: () => string }> {
  // Memory-aware throttling
  const throttleResult = await throttleSearchForMemory();
  if (!throttleResult.proceed) {
    throw new Error(`Search rejected: ${throttleResult.reason}. Please wait and try again.`);
  }

  // Check cache first (using LRU cache - Standard 016)
  cleanExpiredCache();
  const cacheKey = getCacheKey(query, buckets, maxChars, tags, provenance, useMaxRecall);
  
  // Try to get from LRU cache
  const cached = lruSearchCache.get(cacheKey);
  if (cached) {
    console.log(`[IterativeSearch] Cache HIT for query: "${query.substring(0, 50)}..."`);
    return cached.results;
  }
  console.log(`[IterativeSearch] Cache MISS for query: "${query.substring(0, 50)}..."`);

  // 0. Extract Scope Tags (Hashtags) to preserve them across strategies
  // We want to make sure if user typed "#work", it stays even if we strip adjectives.
  const scopeTags: string[] = [...tags];
  const queryParts = query.split(/\s+/);
  queryParts.forEach(part => {
    if (part.startsWith('#')) scopeTags.push(part);
  });
  const tagsString = scopeTags.join(' ');

  // Strategy 1: Standard Expanded Search (All Nouns, Verbs, Dates + Expansion)
  console.log('[IterativeSearch] Strategy 1: Standard Execution');
  let results = await executeSearch(query, buckets, maxChars, provenance, tags, undefined, useMaxRecall, userContext, mode);
  if (results.results.length > 0) {
    lruSearchCache.set(cacheKey, { results: { ...results, attempt: 1 }, timestamp: Date.now() }, 2048);
    return { ...results, attempt: 1 };
  }

  // Strategy 2: Strict "Subjects & Time" (Strip Verbs/Adjectives, keep Nouns + Dates)
  console.log('[IterativeSearch] Strategy 2: Strict Nouns/Dates');
  const temporalContext = extractTemporalContext(query);
  const doc = nlp.readDoc(query);
  const nouns = doc.tokens().filter((t) => {
    const token = t as unknown as Record<string, string>;
    return (token.pos as string) === 'NOUN' || (token.pos as string) === 'PROPN';
  }).out(nlp.its.normal) as string[];

  const uniqueTokens = new Set([...nouns, ...temporalContext]);
  if (uniqueTokens.size > 0) {
    // Re-inject scope tags
    const strictQuery = Array.from(uniqueTokens).join(' ') + ' ' + tagsString;
    console.log(`[IterativeSearch] Fallback Query 1: "${strictQuery.trim()}"`);
    results = await executeSearch(strictQuery, buckets, maxChars, provenance, tags, undefined, false, userContext, mode);
    if (results.results.length > 0) {
      lruSearchCache.set(cacheKey, { results: { ...results, attempt: 2 }, timestamp: Date.now() }, 2048);
      return { ...results, attempt: 2 };
    }
  }

  // Strategy 3: "Just the Dates" (If query heavily implies time)
  // Sometimes "2025" is the only anchor we have if keywords fail.
  // Or maybe just "Proper Nouns" (Entities).
  const propNouns = doc.tokens().filter((t) => (t as unknown as Record<string, string>).pos === 'PROPN').out(nlp.its.normal) as string[];

  // Re-inject scope tags
  const entityQuery = [...new Set([...propNouns, ...temporalContext])].join(' ') + ' ' + tagsString;

  if (entityQuery.trim().length > 0 && entityQuery.trim() !== (Array.from(uniqueTokens).join(' ') + ' ' + tagsString).trim()) {
    console.log(`[IterativeSearch] Fallback Query 2: "${entityQuery.trim()}"`);
    results = await executeSearch(entityQuery, buckets, maxChars, provenance, tags, undefined, false, userContext, mode);
    if (results.results.length > 0) {
      lruSearchCache.set(cacheKey, { results: { ...results, attempt: 3 }, timestamp: Date.now() }, 2048);
      return { ...results, attempt: 3 };
    }
  }

  // Cache empty results too (with shorter TTL would be ideal, but keeping simple)
  lruSearchCache.set(cacheKey, { results: { ...results, attempt: 4 }, timestamp: Date.now() }, 1024);
  return { ...results, attempt: 4 }; // Return empty result if all fail
}

/**
 * Smart Chat Search (The "Markovian" Context Gatherer)
 * Logic:
 * 1. Try standard Iterative Search.
 * 2. If Recall is Low (< 10 atoms), TRIGGER SPLIT.
 * 3. Split Query into Top Entities (Alice, Bob, etc.).
 * 4. Run Parallel Searches for each entity.
 * 5. Aggregate & Deduplicate.
 * 
 * @param useMaxRecall - If true, uses MAX_RECALL_CONFIG for comprehensive retrieval
 */
// --- Special Prefix Handlers (Standard 086) ---
/**
 * Handle special query prefixes for direct lookups and density analysis.
 * "density:" (no term) → full corpus density map (top atoms + tags by frequency)
 * "density:<term>" → count occurrences of a term, return density tier (light/medium/heavy)
 * "density:<term1>,<term2>" → multi-term density analysis
 * "distill:" (no bucket) → list all distills
 * "distill:<bucket>" → query distills table and return full result
 */
async function handlePrefixQuery(query: string, buckets: string[] = [], maxChars: number = 20000, tags: string[] = []): Promise<any> {
  const prefix = query.trim().toLowerCase();
  
  if (prefix.startsWith('density:')) {
    const searchTerm = prefix.substring(8).trim(); // Remove "density:"
    
    try {
      // Parse multiple comma-separated terms
      const terms = searchTerm ? searchTerm.split(',').map(t => t.trim()).filter(Boolean) : [];
      
      if (terms.length === 0) {
        // "density:" with no term → return full corpus density map
        // Query 1: Top atoms by concept tag frequency (deduplicated by tag)
        // Query 2: Top tags by tag/bucket frequency
        // Execute sequentially — PGlite is single-connection; Promise.all on
        // multiple db.run() calls corrupts connection state (deadlocks subsequent queries).
        const topAtomTags = await db.run(
          `SELECT tag, COUNT(*) as count, COUNT(DISTINCT source_path) as source_count
           FROM atoms, unnest(tags) as tag
           WHERE tags IS NOT NULL AND array_length(tags, 1) > 0
           GROUP BY tag ORDER BY count DESC LIMIT 100`
        );
        const topTags = await db.run(
          'SELECT tag, bucket, COUNT(*) as count FROM tags GROUP BY tag, bucket ORDER BY count DESC LIMIT 50'
        );
        
        const atomTotal = (topAtomTags.rows || []).reduce((sum: number, r: Record<string, unknown>) => sum + parseInt(String(r.count) || '0'), 0);
        const tagTotal = (topTags.rows || []).reduce((sum: number, r: Record<string, unknown>) => sum + parseInt(String(r.count) || '0'), 0);
        
        const densityMap = {
          atoms: (topAtomTags.rows || []).map((r: Record<string, unknown>) => ({
            tag: String(r.tag),
            count: parseInt(String(r.count) || '0'),
            sources: parseInt(String(r.source_count) || '0'),
            density_pct: parseFloat((parseInt(String(r.count) || '0') / Math.max(atomTotal, 1) * 100).toFixed(2)),
          })),
          tags: (topTags.rows || []).map((r: Record<string, unknown>) => ({
            tag: String(r.tag),
            bucket: String(r.bucket),
            count: parseInt(String(r.count) || '0'),
            density_pct: parseFloat((parseInt(String(r.count) || '0') / Math.max(tagTotal, 1) * 100).toFixed(2)),
          })),
          totals: { unique_concepts: topAtomTags.rows?.length || 0, unique_tags: topTags.rows?.length || 0, total_occurrences: atomTotal, tag_occurrences: tagTotal },
          rag_thresholds: config.DENSITY,
        };
        
        return {
          context: `Corpus density map — ${densityMap.totals.unique_concepts} unique concepts (${atomTotal} total), ${densityMap.totals.unique_tags} unique tags (${tagTotal} total).`,
          results: (densityMap.atoms || []).map((a: { tag: string; count: number; sources: number; density_pct: number }) => ({
            id: `density_${a.tag}`,
            content: `${a.tag}: ${a.count} occurrences across ${a.sources} sources`,
            source: a.tag,
            score: a.density_pct / 100,
            tags: [a.tag],
            density: { count: a.count, sources: a.sources, pct: a.density_pct },
          })),
          strategy: 'prefix_density_map',
          metadata: { query_type: 'density_map', ...densityMap.totals, rag_thresholds: densityMap.rag_thresholds },
        };
      }
      
      // "density:<term>" or "density:<term1>,<term2>" → count occurrences per term
      // Execute sequentially — PGlite is single-connection; Promise.all on multiple
      // db.run() calls causes "cannot drop active portal" errors.
      const densityResults = [];
      for (const term of terms) {
        const atomResult = await db.run(
          'SELECT COUNT(*) as count FROM atoms WHERE source_path ILIKE $1 OR id ILIKE $1',
          [`%${term}%`]
        );
        const tagResult = await db.run(
          'SELECT COUNT(*) as count FROM tags WHERE tag ILIKE $1',
          [`%${term}%`]
        );
        const molResult = await db.run(
          `SELECT COUNT(DISTINCT m.id) as count FROM molecules m
           JOIN atoms a ON a.compound_id = m.compound_id
           WHERE a.source_path ILIKE $1 OR a.id ILIKE $1`,
          [`%${term}%`]
        );
        
        const atomCount = parseInt(atomResult.rows?.[0]?.count || '0', 10);
        const tagCount = parseInt(tagResult.rows?.[0]?.count || '0', 10);
        const molCount = parseInt(molResult.rows?.[0]?.count || '0', 10);
        
        // Use mol_count (actual documents/files) for tier — not noisy atom/tag row counts.
        // This maps directly to how many documents an external RAG pipeline should consider.
        const { LIGHT_DOC_THRESHOLD, MEDIUM_DOC_THRESHOLD, LIGHT_RAG_LIMIT, MEDIUM_RAG_LIMIT, HEAVY_RAG_LIMIT } = config.DENSITY;
        
        let tier: 'light' | 'medium' | 'heavy';
        let rag_limit: number;        // How many docs the external RAG should retrieve
        let rag_mode: string;         // Which mode the external RAG should use
        
        if (molCount >= LIGHT_DOC_THRESHOLD) {
          tier = 'light';
          rag_limit = LIGHT_RAG_LIMIT;
          rag_mode = 'fast';
        } else if (molCount >= MEDIUM_DOC_THRESHOLD) {
          tier = 'medium';
          rag_limit = MEDIUM_RAG_LIMIT;
          rag_mode = 'balanced';
        } else {
          tier = 'heavy';
          rag_limit = HEAVY_RAG_LIMIT;  // 0 = all available
          rag_mode = 'exhaustive';
        }
        
        const result = {
          term,
          atom_count: atomCount,
          tag_count: tagCount,
          molecule_count: molCount,
          total_hits: atomCount + tagCount,
          density_tier: tier,
          rag_config: {
            mode: rag_mode,
            doc_limit: rag_limit,
            recommendation: tier === 'light'
              ? `Well-known concept (${molCount} docs). External RAG: retrieve top ${rag_limit} docs in fast mode.`
              : tier === 'medium'
              ? `Moderate concept (${molCount} docs). External RAG: retrieve top ${rag_limit} docs in balanced mode.`
              : `Rare concept (${molCount} docs). External RAG: exhaustive retrieval${rag_limit > 0 ? ` (up to ${rag_limit} docs)` : ' (all available docs)'} + radial distillation.`,
          },
        };
        densityResults.push(result);
      }
      
      const summary = densityResults.map(r => 
        `${r.term}: ${r.molecule_count} docs (${r.density_tier} → ${r.rag_config.mode}, limit ${r.rag_config.doc_limit})`
      ).join(' | ');
      
      return {
        context: `Density analysis: ${summary}`,
        results: densityResults,
        strategy: 'prefix_density_query',
        metadata: {
          query_type: 'density_query',
          terms_analyzed: terms.length,
          tiers: {
            light: densityResults.filter(r => r.density_tier === 'light').length,
            medium: densityResults.filter(r => r.density_tier === 'medium').length,
            heavy: densityResults.filter(r => r.density_tier === 'heavy').length,
          },
        },
      };
    } catch {
      // Density query failed; return safe error response without leaking internals
      return {
        context: `Unable to compute density for "${searchTerm}"`,
        results: [],
        strategy: 'prefix_density_error',
        metadata: {},
      };
    }
  }

  if (prefix.startsWith('distill:')) {
    const bucketParam = prefix.substring(8).trim(); // Remove "distill:"
    
    if (!bucketParam) {
      // "distill:" with no bucket → list all distills
      try {
        const distills = await db.run(
          'SELECT id, timestamp, filename, file_path, line_count, lines_unique, compression_ratio, source_sessions, source_files, parameters FROM distills ORDER BY timestamp DESC LIMIT 50',
        );
        
        return {
          context: 'Here are the latest distills from the database:',
          results: distills.rows || [],
          strategy: 'prefix_distill_list',
          metadata: {
            query_type: 'distill_list',
            total_distills: distills.rows?.length || 0,
          },
        };
      } catch {
        // Failed to list distills; return safe error response without leaking internals
        return {
          context: 'Unable to list distills. Please try again later.',
          results: [],
          strategy: 'prefix_distill_error',
          metadata: {},
        };
      }
    } else if (bucketParam.startsWith('github:')) {
      // "distill:github:user/repo" → query distills table for this bucket
      try {
        // The distills table doesn't have a direct bucket column, but we can search by filename or parameters
        // For now, we'll list all distills and filter by the bucket name in parameters
        const distills = await db.run(
          `SELECT id, timestamp, filename, file_path, line_count, lines_unique, compression_ratio, source_sessions, source_files, parameters 
           FROM distills 
           WHERE parameters::jsonb->>'bucket' = $1 
           ORDER BY timestamp DESC 
           LIMIT 50`,
          [bucketParam],
        );
        
        const bucketDistills = distills.rows || [];
        
        if (bucketDistills.length === 0) {
          return {
            context: `No distills found for bucket "${bucketParam}".`,
            results: [],
            strategy: 'prefix_distill_empty',
            metadata: { bucket: bucketParam, found: 0 },
          };
        }
        
        // Return the first distill with full content (if available on disk)
        const firstDistill = bucketDistills[0];
        try {
          const fs = await import('fs');
          if (firstDistill.file_path && fs.existsSync(firstDistill.file_path)) {
            const fullResult = JSON.parse(fs.readFileSync(firstDistill.file_path, 'utf-8'));
            return {
              context: `Full result for distill from bucket "${bucketParam}":`,
              results: [fullResult],
              strategy: 'prefix_distill_full',
              metadata: {
                bucket: bucketParam,
                distill_id: firstDistill.id,
                timestamp: firstDistill.timestamp,
              },
            };
          }
        } catch {
          // Failed to read distill file; continue without this file
        }
        
        return {
          context: `Found ${bucketDistills.length} distill(s) for bucket "${bucketParam}". Returning metadata:`,
          results: bucketDistills,
          strategy: 'prefix_distill_metadata',
          metadata: {
            bucket: bucketParam,
            distills_found: bucketDistills.length,
          },
        };
      } catch {
        // Failed to query distills for bucket; return safe error response without leaking internals
        return {
          context: `Unable to search distills for "${bucketParam}". Please try again later.`,
          results: [],
          strategy: 'prefix_distill_error',
          metadata: { bucket: bucketParam },
        };
      }
    }
    
    // Unknown bucket format
    return {
      context: `Unknown bucket format "${bucketParam}". Use "distill:github:user/repo" format.`,
      results: [],
      strategy: 'prefix_distill_invalid_bucket',
      metadata: { bucket: bucketParam },
    };
  }

  // Not a known prefix, proceed with normal search
  return null;
}

export async function smartChatSearch(
  query: string,
  buckets: string[] = [],
  maxChars: number = 20000,
  tags: string[] = [],
  provenance: 'internal' | 'external' | 'quarantine' | 'all' = 'all',
  useMaxRecall: boolean = false,
  userContext?: UserContext,
  mode: 'standard' | 'clean' = 'standard',
): Promise<{ context: string; results: SearchResult[]; strategy: string; splitQueries?: string[]; metadata?: Record<string, unknown>; toAgentString: () => string }> {

  // Check for special prefixes first
  const prefixResult = await handlePrefixQuery(query, buckets, maxChars, tags);
  if (prefixResult) {
    return prefixResult as any;
  }


  const isLongQuery = query.length > 100;
  let initial = { results: [] as SearchResult[], context: '', toAgentString: () => '' };

  // 1. Initial Attempt (Skip if it's a massive max-recall query to force chunking)
  if (!isLongQuery || !useMaxRecall) {
    initial = await iterativeSearch(query, buckets, maxChars, tags, provenance, useMaxRecall, userContext, mode);

    // If we have enough results, returns immediately
    if (initial.results.length >= 10 && !useMaxRecall) {
      return { ...initial, strategy: 'standard' };
    }
    // Max-recall initial search already runs with full budget and 1639-atom target —
    // parallel sub-query split would just run 3 more full-budget searches simultaneously,
    // tripling memory. Return here.
    if (useMaxRecall && initial.results.length > 0) {
      return { ...initial, strategy: 'max-recall' };
    }
  }

  console.log('[SmartSearch] Triggering Multi-Query Split...');

  // 2. Extract Entities for Split Search
  let splitQueries: string[] = [];

  if (isLongQuery && useMaxRecall) {
    // Chunk the query into groups of 3-4 words for massive keyword lists
    const words = query.split(/\s+/).filter(w => w.length > 2);
    for (let i = 0; i < words.length; i += 4) {
      splitQueries.push(words.slice(i, i + 4).join(' '));
    }
    // Limit to top 5 chunks to avoid blowing up the DB
    splitQueries = splitQueries.slice(0, 5);
  } else {
    const doc = nlp.readDoc(query);
    // Get Proper Nouns (Entities) and regular Nouns
    // We prioritize PROPN (High Value)
    let entities: string[] = [];
    entities = (doc.tokens()
      .filter((t) => (t as unknown as Record<string, string>).pos === 'PROPN')
      .out(nlp.its.normal, nlp.as.freqTable)) as any;
    entities = entities.map((e: any) => e[0]).slice(0, 3); // Top 3 Entities

    // If no entities, try Nouns
    if (entities.length === 0) {
      const nouns = doc.tokens()
        .filter((t) => (t as unknown as Record<string, string>).pos === 'NOUN')
        .out(nlp.its.normal, nlp.as.freqTable);
      entities.push(...(nouns as any).map((e: any) => e[0]).slice(0, 3));
    }
    splitQueries = entities;
  }

  if (splitQueries.length === 0) {
    // No entities to split on, return what we have
    return { ...initial, strategy: 'shallow', splitQueries: [] };
  }

  console.log(`[SmartSearch] Split Entities/Chunks: ${JSON.stringify(splitQueries)}`);

  // 3. Sequential Execution
  // Run each split sub-query one at a time to prevent concurrent heap exhaustion.
  // Parallel Promise.all with max-recall budgets multiplies memory by N sub-queries.
  const budgetPerQuery = useMaxRecall ? maxChars : Math.floor(maxChars / splitQueries.length);
  const parallelResults: Awaited<ReturnType<typeof executeSearch>>[] = [];
  for (const entity of splitQueries) {
    parallelResults.push(
      await executeSearch(entity, buckets, budgetPerQuery, provenance, tags, undefined, useMaxRecall, userContext, mode),
    );
  }

  // 4. Merge & Deduplicate
  const mergedMap = new Map<string, SearchResult>();

  // Add initial results first
  initial.results.forEach(r => mergedMap.set(r.id, r));

  // Add split results
  parallelResults.forEach(res => {
    res.results.forEach(r => {
      if (!mergedMap.has(r.id)) {
        // Boost score slightly for multi-path discovery?
        // Or keep as is.
        mergedMap.set(r.id, r);
      }
    });
  });

  const mergedResults = Array.from(mergedMap.values());

  // Cap merged results to prevent WASM heap blowout on multi-query searches
  const maxMergeResults = config.SEARCH.max_results_default || 100;
  if (mergedResults.length > maxMergeResults) {
    console.log(`[SmartSearch] Capping ${mergedResults.length} merged results to ${maxMergeResults}`);
    mergedResults.length = maxMergeResults;
  }

  console.log(`[SmartSearch] Merged Total: ${mergedResults.length} atoms.`);

  // 4.5. Context Inflation — Expand each atom with surrounding context (n-1, n+1)
  // For max-recall searches, read full context from disk to fill the budget
  if (useMaxRecall && mergedResults.length > 0) {
    // Calculate per-atom budget to fill ~90% of total budget
    const budgetPerAtom = Math.floor(maxChars * 0.9 / mergedResults.length);
    console.log(`[SmartSearch] Inflating ${mergedResults.length} atoms with ${budgetPerAtom} chars each (total budget: ${maxChars})...`);

    const inflatedResults = await ContextInflator.inflate(
      mergedResults,
      maxChars,
      budgetPerAtom,  // Dynamic radius based on available budget
    );

    // Replace merged results with inflated versions
    mergedResults.length = 0;
    mergedResults.push(...inflatedResults);

    const avgChars = Math.round(inflatedResults.reduce((sum, a) => sum + a.content.length, 0) / inflatedResults.length);
    console.log(`[SmartSearch] Inflation complete: ${inflatedResults.length} atoms with avg ${avgChars} chars each`);
  }

  // 5. Re-Format using GCP (Standard 086)
  const finalUserContext: UserContext = {
    name: userContext?.name || 'User',
    current_state: userContext?.current_state || 'active',
  };

  const serializedContext = assembleAndSerialize({
    user: finalUserContext,
    query: query,
    keyTerms: splitQueries,
    scopeTags: tags,
    anchors: mergedResults, // Treat all merged results as anchors for now in this aggregate view
    walkerResults: [],
    charBudget: maxChars * 1.5,
  });

  return {
    context: serializedContext,
    results: mergedResults,
    toAgentString: () => serializedContext,
    strategy: 'split_merge',
    splitQueries: splitQueries,
    metadata: { strategy: 'split_merge' },
  };
}

/**
 * Cluster SearchResults into KnowledgeClusters for high-density JSON.
 * Groups by source file and sorts by chronological timestamp.
 */
export function clusterMolecules(results: SearchResult[]): KnowledgeCluster[] {
  const bySource = new Map<string, SearchResult[]>();
  for (const res of results) {
    const source = res.source || 'unknown';
    if (!bySource.has(source)) bySource.set(source, []);
    bySource.get(source)!.push(res);
  }

  const clusters: KnowledgeCluster[] = [];

  for (const [source, mols] of bySource) {
    // Sort chronologically
    mols.sort((a, b) => a.timestamp - b.timestamp);

    let currentGroup: SearchResult[] = [];

    for (let i = 0; i < mols.length; i++) {
      if (i === 0) {
        currentGroup.push(mols[i]);
      } else {
        const gapMs = Math.abs(mols[i].timestamp - mols[i - 1].timestamp);
        // If > 1 hour gap, split cluster
        if (gapMs > 60 * 60 * 1000) {
          clusters.push(createCluster(currentGroup, source));
          currentGroup = [mols[i]];
        } else {
          currentGroup.push(mols[i]);
        }
      }
    }

    if (currentGroup.length > 0) {
      clusters.push(createCluster(currentGroup, source));
    }
  }

  return clusters;
}

function createCluster(mols: SearchResult[], source: string): KnowledgeCluster {
  const startTs = new Date(mols[0].timestamp).toISOString();
  const endTs = new Date(mols[mols.length - 1].timestamp).toISOString();

  // Topic extraction based on tag frequency
  const tagCounts = new Map<string, number>();
  mols.forEach(m => {
    (m.tags || []).forEach(t => tagCounts.set(t, (tagCounts.get(t) || 0) + 1));
  });

  const topTags = Array.from(tagCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(e => e[0]);

  const topic = topTags.join(' ');

  // Transform SearchResult to KnowledgeMolecule
  const mappedMolecules: KnowledgeMolecule[] = mols.map(m => {
    const people: string[] = [];
    const concepts: string[] = [];
    const projects: string[] = [];

    if (m.tags) {
      m.tags.forEach(t => {
        const lower = t.toLowerCase();
        if (lower.includes('rob') || lower.includes('coda') || lower.includes('oliver')) {
          people.push(t);
        } else if (lower.includes('agent') || lower.includes('engine') || lower.includes('project') || lower.includes('anchor')) {
          projects.push(t);
        } else if (t.startsWith('#')) {
          concepts.push(t);
        }
      });
    }

    return {
      id: m.id,
      timestamp: new Date(m.timestamp).toISOString(),
      speaker: m.provenance || 'unknown',
      tags: m.tags || [],
      entities: {
        people,
        concepts,
        projects,
      },
      content: m.content || '',
      byte_range: {
        start: m.start_byte || 0,
        end: m.end_byte || 0,
        source: m.source || 'unknown',
      },
    };
  });

  const safeId = startTs.replace(/[^0-9]/g, '');
  const basename = source.split(/[/\\]/).pop() || 'unknown';
  const clusterId = `cluster_${basename}_${safeId}`;

  return {
    id: clusterId,
    start_time: startTs,
    end_time: endTs,
    topic: topic,
    molecules: mappedMolecules,
  };
}
