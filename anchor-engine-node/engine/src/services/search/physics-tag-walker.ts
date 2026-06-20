/**
 * Physics-Based Tag Walker for ECE
 * 
 * Implements mathematical approach to graph traversal using SQL matrix operations
 * leveraging the relational nature of PGlite for efficient sparse matrix processing.
 * 
 * Architecture: Treats the database as a Knowledge Graph.
 * - Atoms (memories) and Tags (concepts) form a bipartite graph.
 * - JOIN operations simulate sparse matrix multiplication (M × M^T).
 * - The Unified Field Equation weights every connection deterministically.
 * 
 * The "Planets and Moons" Model:
 * - Planets: Direct search hits (FTS/SimHash) — heavy, explicit anchors.
 * - Moons:   Physics-discovered associations — orbit via shared tags, time, simhash.
 * - Serendipity: Weighted reservoir sampling occasionally surfaces faint but relevant signals.
 */

import { db } from '../../core/db.js';
import type { SearchResult } from './search.js';
import type {
  SearchConfig,
  ConnectionType,
  PhysicsMetadata,
  // MemoryNode // Unused
} from '../../types/context-protocol.js';

/** Maximum time (ms) any single physics walker SQL query is allowed to run */
const QUERY_TIMEOUT_MS = 2000;  // Reduced from 10s to 2s for better UX
/** Maximum number of anchor IDs to feed into a single SQL query */
const MAX_ANCHOR_IDS = 30; // Reduced from 50 to prevent SQL bloat

/**
 * Run a DB query with a timeout. If the query takes longer than `timeoutMs`,
 * the promise rejects with an error (PGlite has no native cancel, but this
 * prevents the physics walker from blocking the search pipeline forever).
 */
async function sqlWithTimeout<T>(query: string, params: any[], timeoutMs: number = QUERY_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    db.run(query, params) as Promise<T>,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`[PhysicsWalker] SQL query timed out after ${timeoutMs}ms`)), timeoutMs),
    ),
  ]);
}

export interface WalkerNode {
  atomId: string;
  sharedTags: number;
  timestamp: number;    // Unix epoch
  simhash: bigint;      // 64-bit simhash
  content?: string;     // Populated when fetching full atom details
  source?: string;
  tags?: string[];
  provenance?: string;
  type?: string;
  frequency?: number;
  /** Compound document ID for context inflation */
  compoundId?: string;
  /** Start byte offset in compound body */
  startByte?: number;
  /** End byte offset in compound body */
  endByte?: number;

  // Physics Metadata (Calculated in SQL)
  gravityScore: number;
  bestAnchorId?: string;
  /** Graph hop distance from query (0 = direct, 1 = 1-hop, etc.) */
  hopDistance?: number;
}

/** Result from the physics walk with full metadata */
export interface PhysicsResult {
  /** The search result with all standard fields */
  result: SearchResult;
  /** Physics metadata for the Graph-Context Protocol */
  physics: PhysicsMetadata;
}

export class PhysicsTagWalker {
  // Hyperparameters (The "Laws of Physics" for your mind)
  // Now configurable via constructor for max-recall mode
  private DAMPING_FACTOR: number;
  private TIME_DECAY_LAMBDA: number;
  private MAX_PER_HOP: number;
  private WALK_RADIUS: number;
  private GRAVITY_THRESHOLD: number;
  private TEMPERATURE: number;

  constructor(config?: {
    damping?: number;
    temporalDecay?: number;
    maxPerHop?: number;
    walkRadius?: number;
    gravityThreshold?: number;
    temperature?: number;
  }) {
    // Default values (balanced production config)
    // λ = 0.00001 h⁻¹ gives ~7.9 year half-life, appropriate for personal knowledge bases
    // where old memories retain value. See paper.md line 69.
    this.DAMPING_FACTOR = config?.damping ?? 0.85;
    this.TIME_DECAY_LAMBDA = config?.temporalDecay ?? 0.00001;  // h⁻¹ (per hour)
    this.MAX_PER_HOP = config?.maxPerHop ?? 50;
    this.WALK_RADIUS = config?.walkRadius ?? 1;
    this.GRAVITY_THRESHOLD = config?.gravityThreshold ?? 0.01;
    this.TEMPERATURE = config?.temperature ?? 0.2;
  }

  /**
   * Safely parse a simhash string into a BigInt (hex with or without 0x).
   */
  private safeParseHex(hash?: string | null): bigint {
    if (!hash || hash === '0') return 0n;
    const clean = hash.startsWith('0x') ? hash : `0x${hash}`;
    try {
      return BigInt(clean);
    } catch (e) {
      console.warn(`[PhysicsWalker] Invalid simhash format: ${hash}`);
      return 0n;
    }
  }

  /**
   * Performs radial inflation using SQL matrix operations.
   * This executes the equivalent of: r = (M * M^T) * q
   *
   * Now includes the Unified Field Equation directly in the SQL query:
   * Weight = (SharedTags) * Exp(-Lambda * DeltaT) * (1 - SimHashDist/64)
   * 
   * Uses instance configuration from constructor for max-recall support.
   */
  async performRadialInflation(
    anchorIds: string[],
    radius?: number,        // Uses instance WALK_RADIUS if not provided
    maxPerHop?: number,     // Uses instance MAX_PER_HOP if not provided
    temperature?: number,   // Uses instance TEMPERATURE if not provided
    gravityThreshold?: number, // Uses instance GRAVITY_THRESHOLD if not provided
  ): Promise<PhysicsResult[]> {
    // Use instance defaults if not overridden
    const hopRadius = radius ?? this.WALK_RADIUS;
    const hopMaxPerHop = maxPerHop ?? this.MAX_PER_HOP;
    const hopTemperature = temperature ?? this.TEMPERATURE;
    const hopGravityThreshold = gravityThreshold ?? this.GRAVITY_THRESHOLD;
    
    const currentAnchors = anchorIds;
    const allPhysicsResults: PhysicsResult[] = [];
    const seenIds = new Set<string>(anchorIds); // Prevent revisiting anchors

    // We only support radius=1 fully optimized in SQL for now.
    // Iteration for radius > 1 would require feeding results back in.
    // Given the efficiency, radius=1 is usually sufficient if the first hop is high quality.

    // Get connected nodes via shared tags with SQL weighting
    // BUGFIX 2026-03-03: Reduced from hopMaxPerHop * 3 to hopMaxPerHop * 1.5
    // to prevent memory overflow on large datasets (207K molecules)
    // The SQL LIMIT already filters by gravity_score, no need to over-fetch
    const connectedNodes = await this.getConnectedNodesWeighted(
      currentAnchors,
      Math.min(hopMaxPerHop, 100), // Cap at 100 total to bound WASM heap (50 standard, 100 max-recall)
      hopGravityThreshold,
    );

    for (const node of connectedNodes) {
      if (seenIds.has(node.atomId)) continue;
      seenIds.add(node.atomId);

      // Determine connection type based on physics
      // Note: We don't have the *exact* partial scores from SQL separate easily
      // without more complex queries, so we infer reason from properties.

      let connectionType: ConnectionType = 'tag_walk_neighbor';
      const hopInfo = node.hopDistance !== undefined ? ` (${node.hopDistance}-hop)` : '';
      let linkReason = `via ${node.sharedTags} shared tag(s)${hopInfo}`;

      // Re-calculate some factors for explanation text (cheap in JS)
      // We don't need exact anchor match here, just general properties

      if (node.gravityScore > 0.8 && node.sharedTags > 2) {
        connectionType = 'tag_walk_neighbor'; // Strong bond is just a high-quality tag walk
        linkReason = `strong bond via ${node.sharedTags} shared tag(s)${hopInfo}`;
      }

      // Calculate simhash distance to *best anchor* if we had it, but SQL aggregation
      // hides the specific anchor relation. 
      // Ideally SQL returns "best_anchor_id". It does!

      const timeDeltaMs = 0; // SQL handled time decay, we don't need exact delta for now unless we query it.
      // (Actually we can't easily get the specific edge delta from the aggregate)

      const isRecurring = (node.frequency || 0) > 1 || node.sharedTags >= 3;

      const result: SearchResult = {
        id: node.atomId,
        content: node.content || '',
        source: node.source || '',
        timestamp: node.timestamp,
        buckets: [],
        tags: node.tags || [],
        epochs: '',
        provenance: node.provenance || 'internal',
        score: node.gravityScore,
        molecular_signature: node.simhash.toString(16),
        frequency: node.frequency || 1,
        type: node.type || 'thought',
        compound_id: node.compoundId,
        start_byte: node.startByte,
        end_byte: node.endByte,
        temporal_state: {
          first_seen: node.timestamp,
          last_seen: node.timestamp,
          occurrence_count: node.frequency || 1,
          timestamps: [node.timestamp],
        },
      };

      const physics: PhysicsMetadata = {
        gravity_score: node.gravityScore,
        time_drift: 'calculated_in_flux', // Placeholder as we aggregate
        is_recurring: isRecurring,
        frequency: node.frequency || 1,
        connection_type: connectionType,
        source_anchor_id: node.bestAnchorId || '',
        link_reason: linkReason,
        hop_distance: node.hopDistance,
      };

      allPhysicsResults.push({ result, physics });
    }

    // Sort by gravity score
    allPhysicsResults.sort((a, b) => b.physics.gravity_score - a.physics.gravity_score);

    // Weighted Reservoir Sampling / Serendipity could be applied here if needed
    // But SQL ranking is "Unified Field" based.
    // If temperature is high, we might want to shuffle the top K?
    // For now, returning the physics-sorted list.

    return allPhysicsResults.slice(0, maxPerHop);
  }

  /**
   * Gets connected nodes via shared tags using SQL matrix operations w/ Physics equations.
   * 
   * The SQL performs:
   * 1. Collect Anchor Stats (ID, Timestamp, SimHash)
   * 2. Find Shared Tags (Sparse Matrix Multiply)
   * 3. Calculate Weight: 
   *    W = (SharedTags) * Exp(-lambda * delta_t) * (1 - Hamming/64)
   * 4. Aggregate: Take the MAX weight overlapping with any anchor.
   */
  private async getConnectedNodesWeighted(
    anchorIds: string[],
    limit: number = 50,
    threshold: number = 0.1,
  ): Promise<WalkerNode[]> {
    if (anchorIds.length === 0) return [];

    // BUGFIX 2026-03-03: Guard against excessive limit values that cause heap overflow
    // Ensure limit is always a positive integer (guards against float args causing
    // "invalid input syntax for type bigint" in the LIMIT $3 SQL parameter)
    // Also cap at 300 to prevent memory exhaustion on large datasets
    const safeLimit = Math.max(1, Math.min(Math.floor(limit), 300));

    // Cap anchors
    const cappedIds = anchorIds.length > MAX_ANCHOR_IDS
      ? anchorIds.slice(0, MAX_ANCHOR_IDS)
      : anchorIds;

    const startTime = Date.now();

    // 1. Prepare Anchor Params
    // We pass the anchor IDs as a single array as the first parameter.
    // Physics constants and query params follow
    // $1 = anchorIds array
    // $2 = threshold
    // $3 = safeLimit
    // $4 = WALK_RADIUS
    // $5 = DAMPING_FACTOR
    // $6 = TIME_DECAY_LAMBDA

    // Big-O summary for this query (N = total molecules, A = atoms, T = tags):
    // resolved_atoms:    O(|anchors|)          — subquery fence ensures PK lookup, not full-table cross join
    // anchor_stats:      O(A) → LIMIT 10       — scan atoms WHERE id IN small set
    // anchor_tag_set:    O(10 × avg_tags)      — materialized once, replaces correlated subquery
    // hop_traversal:     O(anchor_count × avg_tag_neighbors)  — recursive, bounded by WALK_RADIUS
    // atom_hop_distance: O(hop_traversal rows) — GROUP BY
    // candidates:        O(atom_hop_distance × avg_tags_per_atom)  — no correlated subquery
    // candidates_limited/physical: O(LIMIT 50) each
    // weighted_ids CROSS JOIN: O(100 candidates × 10 anchors) = O(1000) — manageable
    // Final JOIN atoms:  O(safeLimit × row_size) — only materialized content

    const refinedQuery = `
      WITH RECURSIVE
      -- Resolve both Atoms and Molecules to a unified set of Atom IDs.
      -- CRITICAL: The molecule branch uses a subquery fence to materialize anchor molecules
      -- (small set, O(|anchors|) via PK) BEFORE joining to atoms.
      -- Without this, "atoms JOIN molecules ON compound_id" produces an O(A×N) cross product
      -- when all molecules share a single compound_id (e.g. one large file = 207K molecules).
      resolved_atoms AS (
        SELECT id as atom_id FROM atoms WHERE id = ANY($1::text[])
        UNION ALL
        SELECT a.id as atom_id
        FROM (
          SELECT id, compound_id, start_byte, end_byte
          FROM molecules
          WHERE id = ANY($1::text[])
          LIMIT 50
        ) anc_mol
        JOIN atoms a ON a.compound_id = anc_mol.compound_id
          AND a.start_byte >= (anc_mol.start_byte - 500::int)
          AND a.end_byte <= (anc_mol.end_byte + 500::int)
        LIMIT 100
      ),
      anchor_stats AS (
        SELECT
          id as anchor_id,
          timestamp as anchor_ts,
          simhash as anchor_sh,
          0::int as hop_distance
        FROM atoms
        WHERE id IN (SELECT atom_id FROM resolved_atoms)
        ORDER BY timestamp DESC
        LIMIT 10
      ),
      -- Materialized anchor tag set: replaces the correlated subquery
      -- "t.tag IN (SELECT tag FROM tags WHERE atom_id = ast.anchor_id)"
      -- that previously ran once per (candidate_atom × anchor) pair.
      anchor_tag_set AS (
        SELECT DISTINCT tag
        FROM tags
        WHERE atom_id IN (SELECT anchor_id FROM anchor_stats)
      ),
      -- HOP TRACKING: Recursive CTE for multi-hop traversal with hop distance
      hop_traversal AS (
        SELECT
          anchor_id as atom_id,
          anchor_ts,
          anchor_sh,
          hop_distance,
          CAST(ARRAY[anchor_id] as TEXT[]) as path
        FROM anchor_stats

        UNION ALL

        SELECT DISTINCT
          t2.atom_id,
          a2.timestamp as anchor_ts,
          a2.simhash as anchor_sh,
          ht.hop_distance + 1,
          ht.path || t2.atom_id
        FROM hop_traversal ht
        JOIN atoms a1 ON ht.atom_id = a1.id
        JOIN tags t1 ON a1.id = t1.atom_id
        JOIN tags t2 ON t1.tag = t2.tag AND t1.atom_id != t2.atom_id
        JOIN atoms a2 ON t2.atom_id = a2.id
        WHERE ht.hop_distance < $4
          AND NOT t2.atom_id = ANY(ht.path)
          AND a2.id NOT IN (SELECT anchor_id FROM anchor_stats)
      ),
      atom_hop_distance AS (
        SELECT
          atom_id,
          anchor_ts,
          anchor_sh,
          MIN(hop_distance) as hop_distance
        FROM hop_traversal
        WHERE hop_distance > 0
        GROUP BY atom_id, anchor_ts, anchor_sh
      ),
      -- Candidate Generation: uses anchor_tag_set (hash join) instead of correlated subquery
      candidates AS (
         SELECT
           h.atom_id,
           a.timestamp,
           a.simhash,
           COUNT(DISTINCT t.tag) as shared_tags,
           0.0 as physical_bonus,
           MIN(h.hop_distance) as hop_distance
         FROM atom_hop_distance h
         JOIN atoms a ON h.atom_id = a.id
         JOIN tags t ON a.id = t.atom_id AND t.tag IN (SELECT tag FROM anchor_tag_set)
         GROUP BY h.atom_id, a.timestamp, a.simhash
      ),
      candidates_limited AS (
        SELECT * FROM candidates
        ORDER BY shared_tags DESC
        LIMIT 50
      ),
      candidates_physical AS (
         -- Part B: Physical proximity
         SELECT
           a.id as atom_id,
           a.timestamp,
           a.simhash,
           0::bigint as shared_tags,
           1.0 as physical_bonus,
           1::int as hop_distance  -- Physical proximity treated as hop 1
         FROM atoms a
         JOIN anchor_stats ast ON a.compound_id = (SELECT compound_id FROM atoms WHERE id = ast.anchor_id)
         WHERE a.id NOT IN (SELECT anchor_id FROM anchor_stats)
         AND a.start_byte >= ((SELECT start_byte FROM atoms WHERE id = ast.anchor_id) - 1000::int)
         AND a.end_byte <= ((SELECT end_byte FROM atoms WHERE id = ast.anchor_id) + 1000::int)
         LIMIT 50
      ),
      candidates_combined AS (
        SELECT * FROM candidates_limited
        UNION ALL
        SELECT * FROM candidates_physical
      ),
      -- 2. Aggregate candidate scores
      scored_candidates AS (
        SELECT
           c.atom_id,
           c.timestamp,
           c.simhash,
           SUM(c.shared_tags) as total_shared_tags,
           MAX(c.physical_bonus) as physical_bonus,
           MIN(c.hop_distance) as hop_distance  -- Use minimum hop distance
        FROM candidates_combined c
        GROUP BY c.atom_id, c.timestamp, c.simhash
      ),
      -- 3. Physics Weighting (Unified Field Equation with hop distance)
      -- Implements: |T(q) ∩ T(a)| · γ^(d(q,a)) × e^(-λΔt) × (1 - H(h_q,h_a)/64)
      -- Note: LEAST(GREATEST(..., 0), 3) clamps hop_distance to prevent POWER underflow
      -- Note: LEAST(..., 700000) clamps time diff to ~7 days BEFORE EXP to prevent underflow
      -- EXP(-0.00001 * 700000) = EXP(-7) ≈ 0.0009 which PGlite can handle
      -- Note: timestamps are in milliseconds, λ is in hours⁻¹, so divide by 3600000 to convert ms→hours
      weighted_ids AS (
        SELECT
           sc.atom_id,
           MAX(
              GREATEST(0.0, LEAST(1.0,
                 ( ((COALESCE(sc.total_shared_tags, 0::bigint)::float8 / 10.0) * POWER($5::float8, LEAST(GREATEST(COALESCE(sc.hop_distance, 1::int)::float8, 0.0), 3.0))) + (COALESCE(sc.physical_bonus, 0.0) * 0.1) ) *
                 EXP((-$6::float8) * LEAST(ABS(COALESCE(sc.timestamp::float8 - ast.anchor_ts::float8, 0.0)) / 3600000.0, 700000.0)) *
                 (1.0 - (bit_count(('x' || LPAD(COALESCE(sc.simhash, '0'), 16, '0'))::bit(64) # ('x' || LPAD(COALESCE(ast.anchor_sh, '0'), 16, '0'))::bit(64)) / 64.0))
              ))
           ) as gravity_score,
           MAX(ast.anchor_id) as best_anchor_id,
           MAX(sc.total_shared_tags) as shared_tags,
           MIN(sc.hop_distance) as hop_distance
        FROM scored_candidates sc
        CROSS JOIN anchor_stats ast
        GROUP BY sc.atom_id
        HAVING MAX(
              GREATEST(0.0, LEAST(1.0,
                 ( ((COALESCE(sc.total_shared_tags, 0::bigint)::float8 / 10.0) * POWER($5::float8, LEAST(GREATEST(COALESCE(sc.hop_distance, 1::int)::float8, 0.0), 3.0))) + (COALESCE(sc.physical_bonus, 0.0) * 0.1) ) *
                 EXP((-$6::float8) * LEAST(ABS(COALESCE(sc.timestamp::float8 - ast.anchor_ts::float8, 0.0)) / 3600000.0, 700000.0)) *
                 (1.0 - (bit_count(('x' || LPAD(COALESCE(sc.simhash, '0'), 16, '0'))::bit(64) # ('x' || LPAD(COALESCE(ast.anchor_sh, '0'), 16, '0'))::bit(64)) / 64.0))
              ))
           ) > $2::float8
        ORDER BY gravity_score DESC
        LIMIT $3
      )
      -- 4. Final projection with hop distance
      SELECT 
         w.atom_id,
         w.shared_tags,
         w.hop_distance,
         a.timestamp,
         a.simhash,
         a.content,
         a.source_path,
         a.tags,
         a.provenance,
         a.type,
         a.compound_id,
         a.start_byte,
         a.end_byte,
         w.gravity_score,
         w.best_anchor_id
      FROM weighted_ids w
      JOIN atoms a ON w.atom_id = a.id
    `;

    const params = [
      cappedIds,              // $1
      threshold,              // $2
      safeLimit,              // $3
      this.WALK_RADIUS,       // $4
      this.DAMPING_FACTOR,    // $5
      this.TIME_DECAY_LAMBDA,  // $6
    ];

    try {
      // Cap PostgreSQL sort/hash memory per query node to prevent WASM heap spikes
      await db.run("SET work_mem = '32MB'");

      // Debug logging for high-budget queries
      if (anchorIds.length > 10 || safeLimit > 100) {
        console.log(`[PhysicsWalker] SQL params: anchorIds=${cappedIds.length}, threshold=${threshold}, limit=${safeLimit}`);
        console.log(`[PhysicsWalker] Anchor IDs: ${cappedIds.slice(0, 5).join(', ')}...`);
      }

      const result = await sqlWithTimeout<any>(refinedQuery, params, QUERY_TIMEOUT_MS);
      const elapsed = Date.now() - startTime;

      if (elapsed > 5000) {
        console.warn(`[PhysicsWalker] SQL Weighting took ${elapsed}ms for ${anchorIds.length} anchors`);
      } else {
        console.log(`[PhysicsWalker] SQL Weighting: ${result.rows?.length || 0} results in ${elapsed} ms`);
      }

      // Debug: Log why we might have 0 results
      if (!result.rows || result.rows.length === 0) {
        console.warn('[PhysicsWalker] Zero results - checking potential causes:');
        console.warn(`[PhysicsWalker]  - Anchor count: ${anchorIds.length}`);
        console.warn(`[PhysicsWalker]  - Threshold: ${threshold}`);
        console.warn(`[PhysicsWalker]  - Limit: ${safeLimit}`);
        console.warn(`[PhysicsWalker]  - Damping: ${this.DAMPING_FACTOR}, Decay: ${this.TIME_DECAY_LAMBDA}`);
      }

      if (!result.rows) return [];

      return result.rows.map((row: any) => ({
        atomId: row.atom_id,
        sharedTags: parseInt(row.shared_tags),
        timestamp: parseFloat(row.timestamp),
        simhash: this.safeParseHex(row.simhash),
        content: row.content || '',
        source: row.source_path || '',
        tags: row.tags || [],
        provenance: row.provenance || 'internal',
        type: row.type || 'thought',
        compoundId: row.compound_id || undefined,
        startByte: (row.start_byte !== null && row.start_byte !== undefined) ? row.start_byte : undefined,
        endByte: (row.end_byte !== null && row.end_byte !== undefined) ? row.end_byte : undefined,
        gravityScore: parseFloat(row.gravity_score),
        bestAnchorId: row.best_anchor_id,
        hopDistance: (row.hop_distance !== null && row.hop_distance !== undefined) ? parseInt(row.hop_distance) : undefined,
      }));
    } catch (e) {
      console.error(`[PhysicsWalker] SQL Weighting failed after ${Date.now() - startTime} ms: `, e);
      return [];
    }
  }

  // --- Tag-Based Variant (for Virtual/Mol Anchors) ---

  /**
   * Applies physics weighting seeded from tags directly.
   */
  async applyPhysicsWeightingFromTags(
    anchorResults: SearchResult[],
    threshold: number = 0.1,
    config?: Partial<SearchConfig>,
  ): Promise<PhysicsResult[]> {
    // 1. Extract Tags
    const anchorTags = Array.from(
      new Set(anchorResults.flatMap(r => (r.tags || []).filter(Boolean))),
    );
    if (anchorTags.length === 0) return [];

    const temperature = config?.temperature ?? 0.2;
    const maxPerHop = config?.max_per_hop ?? 50;

    // 2. Run simplified SQL query 
    // (Simulating an anchor at "Now" with null hash for distance? or just shared tag count?)
    // For pure tag walk, we often lack a specific SimHash or Timestamp anchor.
    // We'll use the "Mean Timestamp" of the anchor results if available.

    // Simplification: Reuse the main walker but treat the resulting nodes
    // as having a gravity score purely based on Shared Tags count for now,
    // or reimplement a specific Tag-SQL query.

    // Let's implement a specific customized query for Tag-Walking that
    // incorporates the "Concept Gravity".

    // For now, to keep this refactor focused and safe, we will use the OLD logic for Tag-Walking
    // but optimized to not loop heavily.
    // Actually, let's just fetch candidates by tags and score in JS for this edge case
    // OR create a "Virtual Anchor" in the CTE.

    // Fallback to simpler implementation for tags-only start:
    const nodes = await this.getConnectedNodesFromTags(anchorTags, maxPerHop * 2);

    // Map to PhysicsResult manually
    return nodes.map(node => ({
      result: {
        id: node.atomId,
        content: node.content || '',
        source: node.source || '',
        timestamp: node.timestamp,
        buckets: [],
        tags: node.tags || [],
        epochs: '',
        provenance: node.provenance || 'internal',
        score: node.sharedTags * 0.1, // Crude score
        molecular_signature: node.simhash.toString(16),
        frequency: node.frequency || 1,
        type: node.type || 'thought',
        compound_id: node.compoundId,
        start_byte: node.startByte,
        end_byte: node.endByte,
        temporal_state: {
          first_seen: node.timestamp,
          last_seen: node.timestamp,
          occurrence_count: node.frequency || 1,
          timestamps: [node.timestamp],
        },
      },
      physics: {
        gravity_score: node.sharedTags * 0.1,
        time_drift: 'tag_walk',
        is_recurring: false,
        frequency: 1,
        connection_type: 'tag_walk_neighbor' as ConnectionType,
        source_anchor_id: 'virtual_tag_cloud',
        link_reason: `via ${node.sharedTags} shared tag(s)`,
      },
    })).sort((a, b) => b.physics.gravity_score - a.physics.gravity_score).slice(0, maxPerHop);
  }

  // Helper for tag-only retrieval (Legacy/Virtual)
  private async getConnectedNodesFromTags(anchorTags: string[], limit: number = 50): Promise<WalkerNode[]> {
    // ... (Keep existing optimized CTE implementation for tags) ...
    // Re-copying the implementation for completeness of the replacement
    if (anchorTags.length === 0) return [];

    const startTime = Date.now();
    const query = `
      WITH anchor_tags AS(
      SELECT DISTINCT unnest($1:: text[]) AS tag
    )
    SELECT
    t.atom_id,
      COUNT(DISTINCT t.tag) AS shared_tag_count,
        a.timestamp,
        a.simhash,
        a.content,
        a.source_path,
        a.tags,
        a.provenance,
        a.type,
        a.compound_id,
        a.start_byte,
        a.end_byte
      FROM tags t
      JOIN anchor_tags at ON t.tag = at.tag
      JOIN atoms a ON t.atom_id = a.id
      GROUP BY
    t.atom_id, a.timestamp, a.simhash,
      a.content, a.source_path, a.tags,
      a.provenance, a.type,
      a.compound_id, a.start_byte, a.end_byte
      ORDER BY shared_tag_count DESC
      LIMIT $2
      `;

    try {
      const result = await sqlWithTimeout<any>(query, [anchorTags, limit], QUERY_TIMEOUT_MS);
      const rows = result.rows?.slice(0, limit) || [];
      return rows.map((row: any) => ({
        atomId: row.atom_id,
        sharedTags: parseInt(row.shared_tag_count),
        timestamp: parseFloat(row.timestamp),
        simhash: this.safeParseHex(row.simhash),
        content: row.content || '',
        source: row.source_path || '',
        tags: row.tags || [],
        provenance: row.provenance || 'internal',
        type: row.type || 'thought',
        compoundId: row.compound_id || undefined,
        startByte: row.start_byte,
        endByte: row.end_byte,
        gravityScore: 0, // Placeholder
      }));
    } catch (e) {
      console.error('[PhysicsWalker] getConnectedNodesFromTags failed: ', e);
      return [];
    }
  }

  /**
   * Format time drift helper
   */
  private formatTimeDrift(deltaMs: number): string {
    const hours = deltaMs / (1000 * 60 * 60);
    if (hours < 1) return `${Math.round(deltaMs / (1000 * 60))} minutes ago`;
    if (hours < 24) return `${Math.round(hours)} hours ago`;
    const days = hours / 24;
    return `${Math.round(days)} days ago`;
  }

  /**
   * Main Entry Point
   * Applies physics weighting to search results.
   *
   * @param anchorResults - Search results to apply physics weighting to
   * @param threshold - Gravity threshold (default 0.1, lower for high-budget)
   * @param config - Search configuration
   * @param maxChars - Optional budget hint for auto-tuning parameters
   */
  async applyPhysicsWeighting(
    anchorResults: SearchResult[],
    threshold: number = 0.1,
    config?: Partial<SearchConfig>,
    maxChars?: number,  // NEW: Budget hint for auto-tuning
  ): Promise<PhysicsResult[]> {
    if (anchorResults.length === 0) return [];

    // Auto-tune parameters based on budget for high-recall queries
    let tunedThreshold = threshold;
    const tunedConfig = { ...config };

    if (maxChars && maxChars > 50000) {
      // High-budget query: lower threshold, more candidates
      tunedThreshold = 0.05;  // Lower threshold to catch more associations
      tunedConfig.max_per_hop = Math.max(tunedConfig.max_per_hop || 50, 150);
      tunedConfig.walk_radius = Math.max(tunedConfig.walk_radius || 1, 2);
      console.log(`[PhysicsWalker] High-budget mode (${maxChars} chars): threshold=${tunedThreshold}, max_per_hop=${tunedConfig.max_per_hop}`);
    }

    // Pass everything to the SQL engine
    return this.performRadialInflation(
      anchorResults.map(r => r.id),
      tunedConfig.walk_radius || 1,
      tunedConfig.max_per_hop || 50,
      tunedConfig.temperature || 0.2,
      tunedThreshold,
    );
  }

  /**
   * Legacy wrapper
   */
  async applyPhysicsWeightingLegacy(
    anchorResults: SearchResult[],
    threshold: number = 0.1,
  ): Promise<SearchResult[]> {
    const results = await this.applyPhysicsWeighting(anchorResults, threshold);
    return results.map(r => r.result);
  }
}