/**
 * PGlite Database Tests - Vitest version (Fixed for TEXT[] tags)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Database } from '../../src/core/db.js';
import fs from 'fs';
import path from 'path';
import { PATHS } from '../../src/config/paths.js';

describe('PGlite Database', () => {
  let db: Database;
  let testDbPath: string;

  beforeAll(async () => {
    testDbPath = path.join(PATHS.TEST_DBS_DIR, 'pglite-test-db-' + Date.now());

    console.log(`[DB Test] Using DB path: ${testDbPath}`);
    if (!fs.existsSync(testDbPath)) {
      fs.mkdirSync(testDbPath, { recursive: true });
    }

    db = new Database();

    // Retry initialization up to 3 times for WASM stability on Windows
    let lastError: unknown;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await db.init({ dbPath: testDbPath });
        break;
      } catch (err) {
        lastError = err;
        console.log(`[DB Test] Init attempt ${attempt} failed: ${err instanceof Error ? err.message : err}`);
        if (attempt === 3) throw err;
        // Clean up partial state before retry
        try {
          if (fs.existsSync(testDbPath)) {
            fs.rmSync(testDbPath, { recursive: true, force: true });
            fs.mkdirSync(testDbPath, { recursive: true });
          }
        } catch {}
        await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }
  }, 60_000);

  afterAll(async () => {
    try {
      if (fs.existsSync(testDbPath)) {
        fs.rmSync(testDbPath, { recursive: true, force: true });
        console.log(`[DB Test] Cleaned up test directory`);
      }
    } catch (e) {
      console.warn('[DB Test] Cleanup error:', e.message);
    }
  });

  describe('initialization', () => {
    it('should initialize successfully', async () => {
      expect(db).toBeDefined();
      expect(db.isInitialized).toBe(true);
    });

    it('should have required tables after setup', async () => {
      const result = await db.run(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);

      const tables = result.rows.map((r: any) => r.table_name);
      expect(tables).toContain('atoms');
      expect(tables).toContain('molecules');
      // compounds table has been removed - molecules now serves that purpose
      expect(tables).not.toContain('compounds');
      expect(tables).toContain('tags');
    });
  });

  describe('basic operations', () => {
    it('should insert and query atoms with single tag (TEXT[] array)', async () => {
      // Tags column is TEXT[] - pass as proper PostgreSQL ARRAY syntax
      await db.run(`INSERT INTO atoms (id, content, source_path, timestamp, tags) VALUES ($1, $2, $3, $4, ARRAY[$5])`,
        ['atom-unique', 'Test content', '/tmp/test.txt', Date.now(), '#test']);

      const result = await db.run('SELECT id, content FROM atoms WHERE id = $1', ['atom-unique']);

      expect(result.rows).toHaveLength(1);
      expect(result.rows[0].id).toBe('atom-unique');
      expect(result.rows[0].content).toBe('Test content');
    });

    it('should handle batch inserts with null tags', async () => {
      const atoms = [
        ['batch-1', 'Content 1', '/tmp/test.txt', Date.now()],
        ['batch-2', 'Content 2', '/tmp/test.txt', Date.now()],
        ['batch-3', 'Content 3', '/tmp/test.txt', Date.now()],
      ];

      for (const [id, content, p, ts] of atoms) {
        await db.run(
          'INSERT INTO atoms (id, content, source_path, timestamp, tags) VALUES ($1, $2, $3, $4, NULL)',
          [id, content, p, ts]
        );
      }

      const result = await db.run('SELECT COUNT(*) as count FROM atoms WHERE id LIKE $1', ['batch-%']);
      expect(parseInt((result.rows[0] as any).count)).toBe(3);
    });

    it('should handle multiple tags per atom', async () => {
      // Insert with multiple tags (TEXT[] array format)
      await db.run(`INSERT INTO atoms (id, content, source_path, timestamp, tags) VALUES ($1, $2, $3, $4, ARRAY[$5, $6, $7])`,
        ['multi-tag-test', 'Multi tag test', '/tmp/test.txt', Date.now(), '#tag1', '#tag2', '#tag3']);

      const result = await db.run('SELECT tags FROM atoms WHERE id = $1', ['multi-tag-test']);
      // Tags are stored as TEXT[] array, convert to string for comparison
      const tags: string | null = result.rows[0].tags;
      expect(tags).toContain('#tag1');
    });

    it('should handle null tags gracefully', async () => {
      await db.run(`INSERT INTO atoms (id, content, source_path, timestamp, tags) VALUES ($1, $2, $3, $4, NULL)`,
        ['empty-tags-test', 'Empty tags test', '/tmp/test.txt', Date.now()]);

      const result = await db.run('SELECT tags FROM atoms WHERE id = $1', ['empty-tags-test']);
      expect(result.rows[0].tags).toBeNull();
    });
  });

  describe('cleanup', () => {
    it('should wipe data when truncated', async () => {
      // Insert a test atom - use simple syntax without parameters
      await db.run(`INSERT INTO atoms (id, content, source_path, timestamp) VALUES ('clean-test-' || now(), 'Wipe test', '/tmp/test.txt', $1)`, [Date.now()]);

      const beforeWipe = await db.run('SELECT id FROM atoms WHERE id LIKE $1', ['clean-test-%']);
      expect(beforeWipe.rows.length).toBe(1);

      // Wipe the database
      await db.run('TRUNCATE atoms');

      const afterWipe = await db.run('SELECT id FROM atoms WHERE id LIKE $1', ['clean-test-%']);
      expect(afterWipe.rows.length).toBe(0);
    });
  });
});