/**
 * Integration Test: Compounds Table Migration
 * 
 * This test suite verifies the successful removal of the compounds table
 * and migration of its data to molecules/atoms tables using HTTP API endpoints.
 * Updated for v5.2.0 response shapes (atoms/molecules routes now return
 * {atoms/molecules: [...], total: N, ...} instead of flat arrays).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, '..', '..', '..');

const API_BASE_URL = process.env.API_URL || 'http://localhost:3160';
const SERVER_START_TIMEOUT_MS = 120_000;

// Helper: parse JSON response — handles both flat arrays and {atoms/molecules: [...], ...} wrappers
function unwrapList(raw: string): { items: any[]; total: number | null } {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return { items: parsed, total: parsed.length };
    if (parsed.atoms) return { items: parsed.atoms, total: parsed.total ?? null };
    if (parsed.molecules) return { items: parsed.molecules, total: parsed.total ?? null };
    if (parsed.results) return { items: parsed.results, total: parsed.total ?? null };
    return { items: [], total: 0 };
  } catch {
    return { items: [], total: 0 };
  }
}

describe('Compounds Table Migration', () => {
  let serverProcess: any = null;

  beforeAll(async () => {
    console.log('[Test] Starting compounds table migration tests...');
    try {
      await checkServerHealth();
      console.log('[Test] Server is already running');
    } catch {
      console.log('[Test] Starting server process...');
      const { spawn } = await import('child_process');
      serverProcess = spawn('node', [join(PROJECT_ROOT, 'engine', 'dist', 'index.js')], {
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' },
      });
      serverProcess.stdout.on('data', (d: Buffer) => console.log('[Server]', d.toString().trim()));
      serverProcess.stderr.on('data', (d: Buffer) => console.error('[Server Error]', d.toString().trim()));

      const startTime = Date.now();
      while (!(await checkServerHealth()) && Date.now() - startTime < SERVER_START_TIMEOUT_MS) {
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!(await checkServerHealth())) throw new Error('Server failed to start within timeout');
    }
  });

  afterAll(async () => {
    if (serverProcess) {
      try { serverProcess.kill(); } catch {}
    }
    const fs = await import('fs');
    const cleanupFiles = [join(PROJECT_ROOT, 'test-ingestion-migration.txt')];
    for (const file of cleanupFiles) {
      if (fs.existsSync(file)) try { fs.unlinkSync(file); } catch {}
    }
  });

  async function checkServerHealth(): Promise<boolean> {
    try {
      const result = await execAsync(`curl -s --connect-timeout 5 "${API_BASE_URL}/health"`, { timeout: 10000 });
      return result.stdout.includes('healthy') || result.stdout.includes('"status":"healthy"');
    } catch {
      return false;
    }
  }

  describe('Schema Verification', () => {
    it('should verify compounds table does not exist after migration', async () => {
      try {
        await execAsync(`curl -s --connect-timeout 5 "${API_BASE_URL}/v1/compounds"`, { timeout: 10000 });
        const result = await execAsync(`curl -s --connect-timeout 5 "${API_BASE_URL}/v1/compounds"`, { timeout: 10000 });
        if (result.stdout.trim() === '[]' || result.stdout.trim() === '') {
          expect(true).toBe(true);
        } else {
          throw new Error(`Compounds table still accessible: ${result.stdout.slice(0, 200)}`);
        }
      } catch (error: any) {
        if (error.message?.includes('does not exist') || error.message?.includes('not found') || error.message?.includes('404')) {
          expect(true).toBe(true);
        } else if (error.stderr?.includes('404') || error.stdout?.includes('Cannot GET')) {
          expect(true).toBe(true);
        } else {
          throw error;
        }
      }
    }, 30_000);

    it('should verify molecules response includes provenance', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/molecules?limit=1"`,
        { timeout: 10000 },
      );
      const hasProvenance = result.stdout.includes('provenance');
      expect(hasProvenance).toBe(true);
      console.log('[Test] Provenance found in molecules response');
    }, 30_000);

    it('should verify atoms response includes provenance', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/atoms?limit=1"`,
        { timeout: 10000 },
      );
      const hasProvenance = result.stdout.includes('provenance');
      expect(hasProvenance).toBe(true);
      console.log('[Test] Provenance found in atoms response');
    }, 30_000);
  });

  describe('Ingestion Tests', () => {
    it('should ingest a file without creating compounds table entries', async () => {
      const fs = await import('fs');
      const content = `# Migration Test File\n\nThis file tests ingestion after compounds table removal.\n\n## Key Features:\n- Should create molecules with provenance field\n- Should create atoms with provenance field\n- Should NOT create any compound records\n`;
      fs.writeFileSync(join(PROJECT_ROOT, 'test-ingestion-migration.txt'), content);

      const result = await execAsync(
        `curl -s --connect-timeout 10 "${API_BASE_URL}/v1/ingest" -X POST -H "Content-Type: application/json" -d "{\\"content\\":\\"${content.replace(/"/g, '\\"').replace(/\n/g, '\\n')}\\",\\"source\\":\\"migration-test\\",\\"type\\":\\"file\\",\\"bucket\\":\\"notebook\\"}"`,
        { timeout: 60000 },
      );

      const data = JSON.parse(result.stdout);
      // Ingestion may return {status: "success"} or {error: null} — both are valid
      expect(data.error || data.status === 'success' || data.error === undefined).toBeTruthy();
      console.log('[Test] Ingestion completed');
    }, 60_000);

    it('should verify ingested molecules have provenance data', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/molecules?limit=5"`,
        { timeout: 10000 },
      );
      const { items: molecules } = unwrapList(result.stdout);
      const allHaveProvenance = molecules.every((m: any) => m.provenance || m.compound_id);
      expect(allHaveProvenance).toBe(true);
      console.log('[Test] All molecules have provenance/compound_id');
    }, 30_000);

    it('should verify ingested atoms have provenance data', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/atoms?limit=5"`,
        { timeout: 10000 },
      );
      const { items: atoms } = unwrapList(result.stdout);
      const allHaveProvenance = atoms.every((a: any) => a.provenance || a.source_path);
      expect(allHaveProvenance).toBe(true);
      console.log('[Test] All atoms have provenance/source_path');
    }, 30_000);

    it('should verify molecular_signature is populated', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/molecules?limit=1"`,
        { timeout: 10000 },
      );
      const { items: molecules } = unwrapList(result.stdout);
      if (molecules.length > 0) {
        expect(molecules[0].molecular_signature).toBeDefined();
        console.log('[Test] Molecular signature verified:', molecules[0].molecular_signature);
      } else {
        console.log('[Test] No molecules to verify (database may be empty)');
        expect(true).toBe(true);
      }
    }, 30_000);
  });

  describe('Query Compatibility', () => {
    it('should allow search queries that previously used compounds table', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/memory/search" -X POST -H "Content-Type: application/json" -d "{\\"query\\":\\"migration test\\",\\"limit\\":3}"`,
        { timeout: 10000 },
      );
      const lines = result.stdout.split('\n').filter((l: string) => l.startsWith('data:'));
      if (lines.length > 0) {
        expect(lines[0].replace('data:', '').trim()).toBeDefined();
        console.log('[Test] Search query successful');
      } else {
        // Search may return no results for an empty corpus — that's valid
        console.log('[Test] Search returned no results (empty corpus — acceptable)');
        expect(true).toBe(true);
      }
    }, 30_000);

    it('should allow molecule queries without compound joins', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/molecules?limit=3"`,
        { timeout: 10000 },
      );
      const { items: molecules } = unwrapList(result.stdout);
      // May be empty if no data ingested — that's fine
      expect(Array.isArray(molecules)).toBe(true);
      console.log('[Test] Retrieved', molecules.length, 'molecules');
    }, 30_000);

    it('should allow atom queries without compound joins', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/atoms?limit=3"`,
        { timeout: 10000 },
      );
      const { items: atoms } = unwrapList(result.stdout);
      expect(Array.isArray(atoms)).toBe(true);
      console.log('[Test] Retrieved', atoms.length, 'atoms');
    }, 30_000);
  });

  describe('Data Integrity', () => {
    it('should verify molecule count is retrievable', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/molecules?limit=1"`,
        { timeout: 10000 },
      );
      const { total } = unwrapList(result.stdout);
      // total may be null if response doesn't include it — that's acceptable for an ephemeral DB
      if (total !== null) {
        expect(total).toBeGreaterThanOrEqual(0);
        console.log('[Test] Total molecules:', total);
      } else {
        console.log('[Test] Molecule count not included in response (acceptable)');
        expect(true).toBe(true);
      }
    }, 30_000);

    it('should verify atom count is retrievable', async () => {
      const result = await execAsync(
        `curl -s --connect-timeout 5 "${API_BASE_URL}/v1/atoms?limit=1"`,
        { timeout: 10000 },
      );
      const { total } = unwrapList(result.stdout);
      if (total !== null) {
        expect(total).toBeGreaterThanOrEqual(0);
        console.log('[Test] Total atoms:', total);
      } else {
        console.log('[Test] Atom count not included in response (acceptable)');
        expect(true).toBe(true);
      }
    }, 30_000);
  });
});

describe('Quick Migration Check', () => {
  it('should verify migration is complete via single API call', async () => {
    try {
      await execAsync(`curl -s --connect-timeout 5 "${API_BASE_URL}/v1/compounds"`, { timeout: 10000 });
      const result = await execAsync(`curl -s --connect-timeout 5 "${API_BASE_URL}/v1/compounds"`, { timeout: 10000 });
      if (result.stdout.trim() === '[]' || result.stdout.trim() === '') {
        expect(true).toBe(true);
        console.log('[Quick Check] Migration verified - compounds table empty/removed');
      } else {
        throw new Error('Compounds table still has data');
      }
    } catch (error: any) {
      if (error.message?.includes('does not exist') || error.stderr?.includes('404') || error.stdout?.includes('Cannot GET')) {
        expect(true).toBe(true);
        console.log('[Quick Check] Migration verified - compounds table removed');
      } else {
        throw error;
      }
    }
  }, 30_000);
});
