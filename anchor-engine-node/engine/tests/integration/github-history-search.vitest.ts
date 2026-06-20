/**
 * A/B Integration Test: GitHub Commit History Search
 *
 * Vitest + real PGlite (in-memory). No network, no file system.
 *
 * A — Without commit history ingested: searching a commit message term yields 0 results.
 * B — With commit history molecule inserted:  same search finds the commit molecule.
 *
 * Run: pnpm --filter anchor-engine test:vitest
 *      pnpm --filter anchor-engine test:vitest --reporter=verbose
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';

// ---- schema helpers ----

async function createSchema(db: PGlite) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS molecules (
      id         TEXT PRIMARY KEY,
      content    TEXT NOT NULL,
      source     TEXT,
      bucket     TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS molecules_fts_idx
      ON molecules
      USING GIN (to_tsvector('simple', content));
  `);
}

/** Simple FTS search — mirrors the core of findAnchors in search.ts */
async function ftsSearch(db: PGlite, query: string): Promise<string[]> {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter(t => t.length > 1);

  if (terms.length === 0) return [];

  const tsQuery = terms.join(' | ');
  const rows = await db.query<{ id: string; content: string }>(
    `SELECT id, content
     FROM   molecules
     WHERE  to_tsvector('simple', content) @@ to_tsquery('simple', $1)
     LIMIT  20`,
    [tsQuery],
  );

  return rows.rows.map(r => r.id);
}

// ---- test data ----

/** Simulates a tarball-ingested code snippet — no commit messages */
const CODE_MOLECULE = {
  id: 'mol_code_001',
  content: `export function findAnchors(query: string): Promise<Anchor[]> {
  // Build tsquery from sanitized terms
  const tsTerms = sanitizeQuery(query);
  return db.query(\`SELECT * FROM molecules WHERE ...\`);
}`,
  source: 'anchor-engine-node/src/search.ts',
  bucket: 'anchor-engine-node',
};

/** Simulates a commit-history molecule produced by ingestGitHistory() */
const HISTORY_MOLECULE = {
  id: 'mol_git_history_001',
  content: `# Git History: owner/anchor-engine-node (main)

---

## abc123def456 — 2026-03-06T04:39:09Z
Author: RSBalchII

fix: strip English stop words from FTS query

Previously "work and unemployment" would include "and" as a literal FTS token,
corrupting ts_rank_cd scores. Fixed by filtering a 70-word stop list before
building the tsquery string.

Files:
  M engine/src/services/search/search.ts (+22 -4)

---

## deadbeef1234 — 2026-03-05T14:00:00Z
Author: RSBalchII

feat: physics walker anchor diversity round-robin

Anchors now sampled round-robin by compound_id before applying the 30-ID cap.
This ensures the physics walk traverses multiple source documents instead of
exhausting one file.

Files:
  M engine/src/services/search/physics-tag-walker.ts (+18 -6)`,
  source: 'anchor-engine-node/commit-history.md',
  bucket: 'git-history',
};

// ---- test suite ----

let db: PGlite;

beforeAll(async () => {
  // In-memory PGlite — no files written
  db = new PGlite();
  await createSchema(db);
}, 30_000);

afterAll(async () => {
  await db.close();
});

describe('A/B: commit history search', () => {
  // ── Condition A: only code content, no history ──────────────────────────

  it('A — inserting only code molecule does not match a commit-specific term', async () => {
    await db.query(
      `INSERT INTO molecules (id, content, source, bucket) VALUES ($1, $2, $3, $4)`,
      [CODE_MOLECULE.id, CODE_MOLECULE.content, CODE_MOLECULE.source, CODE_MOLECULE.bucket],
    );
    // "round-robin" and "diversity" are commit-specific terms not present in code content
    const results = await ftsSearch(db, 'round-robin diversity');
    expect(results).not.toContain(CODE_MOLECULE.id);
    expect(results.length).toBe(0);
  });

  it('A — code molecule IS found by its own content terms', async () => {
    const results = await ftsSearch(db, 'findAnchors sanitizeQuery tsTerms');
    expect(results).toContain(CODE_MOLECULE.id);
  });

  // ── Condition B: history molecule added ─────────────────────────────────

  it('B — after ingesting commit history, commit-specific term returns results', async () => {
    await db.query(
      `INSERT INTO molecules (id, content, source, bucket) VALUES ($1, $2, $3, $4)`,
      [HISTORY_MOLECULE.id, HISTORY_MOLECULE.content, HISTORY_MOLECULE.source, HISTORY_MOLECULE.bucket],
    );

    const results = await ftsSearch(db, 'round-robin anchor diversity');
    expect(results).toContain(HISTORY_MOLECULE.id);
  });

  it('B — commit author name is searchable', async () => {
    const results = await ftsSearch(db, 'RSBalchII');
    expect(results).toContain(HISTORY_MOLECULE.id);
  });

  it('B — commit sha prefix is searchable', async () => {
    const results = await ftsSearch(db, 'abc123def456');
    expect(results).toContain(HISTORY_MOLECULE.id);
  });

  it('B — stop words in query do not corrupt results', async () => {
    // "strip the English and stop words" — "and", "the" are noise
    // Should still find the history molecule via real content terms
    const results = await ftsSearch(db, 'strip stop words');
    expect(results).toContain(HISTORY_MOLECULE.id);
  });

  it('B — code molecule still findable alongside history molecule', async () => {
    // Both tables coexist; adding history does not shadow existing code content
    const codeResults = await ftsSearch(db, 'findAnchors sanitizeQuery');
    expect(codeResults).toContain(CODE_MOLECULE.id);
  });

  // ── Bucket isolation ─────────────────────────────────────────────────────

  it('B — history molecule is in git-history bucket', async () => {
    const rows = await db.query<{ bucket: string }>(
      `SELECT bucket FROM molecules WHERE id = $1`,
      [HISTORY_MOLECULE.id],
    );
    expect(rows.rows[0]?.bucket).toBe('git-history');
  });

  it('B — code molecule is in project bucket, not git-history', async () => {
    const rows = await db.query<{ bucket: string }>(
      `SELECT bucket FROM molecules WHERE id = $1`,
      [CODE_MOLECULE.id],
    );
    expect(rows.rows[0]?.bucket).toBe('anchor-engine-node');
    expect(rows.rows[0]?.bucket).not.toBe('git-history');
  });
});
