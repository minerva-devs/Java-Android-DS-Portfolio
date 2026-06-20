/**
 * Ingest Service - Memory Ingestion with Provenance Tracking
 *
 * Implements the Data Provenance feature by adding a 'provenance' column
 * to distinguish between "Sovereign" (User-Created) and "Ancillary" (External) data.
 * 
 * Standard 016: Search Cache Invalidation
 * - Invalidates search cache on content ingestion
 * - Ensures fresh results after new content is added
 */

import { db } from '../../core/db.js';
import crypto from 'crypto';
import * as path from 'path';
import { config } from '../../config/index.js';
import { PATHS } from '../../config/paths.js';
import { cleanContent, getCleaningStats } from './content-cleaner.js';
import { searchCache } from '../search/search.js';

interface IngestOptions {
  atomize?: boolean;
  skipCleaning?: boolean;
}

/**
 * Determines the provenance of content based on its source
 */
function determineProvenance(source: string, type?: string): 'internal' | 'external' | 'system' {
  // Normalize path separators and resolve to absolute path for robust comparison
  const normalizedSource = path.resolve(path.normalize(source)).replace(/\\/g, '/');
  
  // Get canonical paths for comparison
  const inboxDir = PATHS.INBOX_DIR.replace(/\\/g, '/');
  const externalInboxDir = PATHS.EXTERNAL_INBOX_DIR.replace(/\\/g, '/');
  const anchorRoot = PATHS.ANCHOR_ROOT.replace(/\\/g, '/');

  // 1. Explicit Trusted Inbox (internal provenance, 3.0x boost)
  if (normalizedSource.startsWith(inboxDir) ||
    normalizedSource.includes('/internal-inbox/') || normalizedSource.startsWith('internal-inbox/') ||
    normalizedSource.includes('/sovereign/') ||
    type === 'user') {
    return 'internal';
  }

  // 2. Explicit External Inbox (external provenance, 1.0x boost)
  if (normalizedSource.startsWith(externalInboxDir) ||
    normalizedSource.includes('web_scrape') ||
    normalizedSource.includes('news_agent') ||
    type === 'external') {
    return 'external';
  }

  // 3. Runtime objects under ANCHOR_ROOT are internal (not external)
  if (normalizedSource.startsWith(anchorRoot)) {
    // Exclude explicitly external sources within anchor root
    if (!normalizedSource.includes('web_scrape') && !normalizedSource.includes('news_agent')) {
      return 'internal';
    }
  }

  // Default to external for all other sources
  return 'external';
}

/**
 * Ingest content into the memory database with provenance tracking
 */
export async function ingestContent(
  content: string,
  source: string,
  type: string = 'text',
  buckets: string[] = ['core'],
  tags: string[] = [],
  options: IngestOptions = {},
): Promise<{ status: string; id?: string; message?: string }> {

  if (!content) {
    throw new Error('Content is required for ingestion');
  }

  // --- DATA REFINERY: Clean content ---
  let processedContent = content;
  const processedTags = [...tags];

  if (!options.skipCleaning) {
    const startTime = Date.now();
    
    // Configure cleaning based on content type
    const cleanOptions = {
      stripHtml: type === 'html' || type === 'web_page',
      decodeHtml: true,
      normalizeUnicode: true,
      removeControlChars: true,
      normalizeWhitespace: true,
      removeBoilerplate: type === 'web_page',
      normalizeLineEndings: true,
      collapseBlankLines: true,
    };

    processedContent = cleanContent(content, cleanOptions);
    const stats = getCleaningStats(content, processedContent);
    
    if (stats.charsRemoved > 0) {
      console.log(`[Ingest] 🏭 Content cleaned: -${stats.charsRemoved} chars (${stats.reductionPercent}% reduction) in ${Date.now() - startTime}ms`);
    }
  }

  // Auto-assign provenance based on source
  const provenance = determineProvenance(source, type);

  // Generate hash for content deduplication (using processed content)
  const hash = crypto.createHash('md5').update(processedContent).digest('hex');

  // Check if content with same hash already exists
  const existingQuery = 'SELECT id FROM atoms WHERE simhash = $1';
  const existingResult = await db.run(existingQuery, [BigInt(hash)]);

  if (existingResult.rows && existingResult.rows.length > 0) {
    return {
      status: 'skipped',
      id: existingResult.rows[0][0],
      message: 'Content with same hash already exists',
    };
  }

  // Generate unique ID
  const id = `mem_${Date.now()}_${crypto.randomBytes(8).toString('hex').substring(0, 16)}`;
  const timestamp = Date.now();

  // Process content into atomic structure using AtomizerService (Legacy Pipeline)
  const { AtomizerService } = await import('./atomizer-service.js');
  const { AtomicIngestService } = await import('./ingest-atomic.js');

  const atomizer = new AtomizerService();
  const atomicIngest = new AtomicIngestService();

  // Ensure provenance matches expected type for atomizer
  const atomizerProvenance = (provenance === 'system') ? 'internal' : provenance;

  const atomizeResult = await atomizer.atomize(
    processedContent,
    source,
    atomizerProvenance,
    timestamp,
  );

  // Skip ingestion if transient data was detected
  if (!atomizeResult) {
    console.log(`[Ingest] ⚠️ SKIP: ${source} - Transient data detected, skipping ingestion`);
    return {
      status: 'skipped',
      message: 'Content skipped (transient data)',
    };
  }

  const { compound, molecules, atoms } = atomizeResult;

  // Ingest result using AtomicIngestService
  await atomicIngest.ingestResult(compound, molecules, atoms, buckets);

  // Standard 016: Invalidate search cache on successful ingestion
  // This ensures fresh search results after new content is added
  searchCache.clear();
  console.log('[Ingest] ✅ Search cache invalidated after ingestion');

  // Return success (ID is compound ID)
  return {
    status: 'success',
    id: compound.id,
    message: 'Content ingested successfully with provenance tracking',
  };
}

export interface IngestAtom {
  id: string;
  content: string;
  sourceId: string;
  sourcePath: string; // Preservation of original context
  sequence: number;
  timestamp: number;
  provenance: 'internal' | 'external' | 'quarantine';
  embedding?: number[];
  hash?: string; // Explicit hash to avoid ID-based guessing
  simhash?: string;
  tags?: string[];
  payload?: any; // Crystal Atom Data (JSONB)
}

/**
 * Ingest pre-processed atoms
 */
/**
 * Ingest pre-processed atoms (Batched)
 */
export async function ingestAtoms(
  atoms: IngestAtom[],
  source: string,
  buckets: string[] = ['core'],
  tags: string[] = [], // Batch-level tags (e.g., "inbox")
  fileTimestamp?: number,
): Promise<number> {

  if (atoms.length === 0) return 0;
  const BATCH_SIZE = 50;
  let inserted = 0;

  // Process in chunks
  for (let i = 0; i < atoms.length; i += BATCH_SIZE) {
    const chunk = atoms.slice(i, i + BATCH_SIZE);

    // --- 1. Prepare Atoms Batch ---
    const atomValuePlaceholders: string[] = [];
    const atomParams: any[] = [];
    let paramIndex = 1;

    for (const atom of chunk) {
      // Standard 096: Timestamp Assignment
      let finalTimestamp = atom.timestamp;
      if (!finalTimestamp || finalTimestamp <= 0 || isNaN(finalTimestamp)) {
        finalTimestamp = (fileTimestamp != null) ? fileTimestamp : Date.now();
      }

      // Simhash to BigInt
      let simhashBigInt: bigint | null = null;
      if (atom.simhash) {
        try { simhashBigInt = BigInt(atom.simhash); } catch (e) { /* ignore */ }
      }

      // Embedding
      let embeddingArray: number[] = new Array(config.MODELS.EMBEDDING_DIM).fill(0.1);
      if (atom.embedding && atom.embedding.length === config.MODELS.EMBEDDING_DIM) {
        embeddingArray = atom.embedding;
      }

      // Payload
      const payloadJson = atom.payload ? JSON.stringify(atom.payload) : '{}';

      atomValuePlaceholders.push(`($${paramIndex}, $${paramIndex + 1}, $${paramIndex + 2}, $${paramIndex + 3}, $${paramIndex + 4}, $${paramIndex + 5}, $${paramIndex + 6}, $${paramIndex + 7})`);
      atomParams.push(
        atom.id,
        atom.content,
        atom.sourcePath,
        finalTimestamp,
        simhashBigInt || 0n,
        embeddingArray,
        atom.provenance,
        payloadJson,
      );
      paramIndex += 8;
    }

    const atomInsertQuery = `
      INSERT INTO atoms (id, content, source_path, timestamp, simhash, embedding, provenance, payload)
      VALUES ${atomValuePlaceholders.join(', ')}
      ON CONFLICT (id) DO UPDATE SET
        content = EXCLUDED.content,
        source_path = EXCLUDED.source_path,
        timestamp = EXCLUDED.timestamp,
        simhash = EXCLUDED.simhash,
        embedding = EXCLUDED.embedding,
        provenance = EXCLUDED.provenance,
        payload = EXCLUDED.payload
    `;

    try {
      await db.run(atomInsertQuery, atomParams);
    } catch (e: any) {
      console.error(`[Ingest] Batch insert failed for chunk starting at index ${i}:`, e.message);
      continue; // Skip tags if atoms fail
    }

    // --- 2. Prepare Tags Batch ---
    const tagValuePlaceholders: string[] = [];
    const tagParams: any[] = [];
    let tagParamIndex = 1;

    for (const atom of chunk) {
      const atomSpecificTags = atom.tags || [];
      const finalTags = [...new Set([...tags, ...atomSpecificTags])];

      for (const tag of finalTags) {
        tagValuePlaceholders.push(`($${tagParamIndex}, $${tagParamIndex + 1}, $${tagParamIndex + 2})`);
        tagParams.push(atom.id, tag, buckets[0]);
        tagParamIndex += 3;
      }
    }

    if (tagParams.length > 0) {
      const tagInsertQuery = `
        INSERT INTO tags (atom_id, tag, bucket)
        VALUES ${tagValuePlaceholders.join(', ')}
        ON CONFLICT (atom_id, tag, bucket) DO UPDATE SET
          bucket = EXCLUDED.bucket
      `;
      try {
        await db.run(tagInsertQuery, tagParams);
      } catch (e: any) {
        console.warn(`[Ingest] Batch tag insert failed for chunk ${i}:`, e.message);
      }
    }

    inserted += chunk.length;
  }

  return inserted;
}

/**
 * Bulk import YAML content with provenance tracking
 */
export async function importYamlContent(yamlContent: any[]): Promise<{ imported: number; skipped: number; errors: number }> {
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const record of yamlContent) {
    try {
      if (!record.content) {
        errors++;
        continue;
      }

      const result = await ingestContent(
        record.content,
        record.source || 'yaml_import',
        record.type || 'text',
        record.buckets || ['imported'],
        record.tags || [],
      );

      if (result.status === 'success') {
        imported++;
      } else if (result.status === 'skipped') {
        skipped++;
      }
    } catch (error) {
      console.error('YAML import error for record:', record, error);
      errors++;
    }
  }

  return { imported, skipped, errors };
}