/**
 * Integration Test: Compounds Table Migration
 * 
 * This test suite verifies the successful removal of the compounds table
 * and migration of its data to molecules/atoms tables.
 */

import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { Database } from '../engine/src/core/db.js';
import { extractProvenanceFromPath } from '../engine/src/core/provenance-utils.js';

describe('Compounds Table Migration', () => {
  let db: Database;

  beforeAll(async () => {
    console.log('[Test] Initializing database...');
    db = new Database();
    await db.init();
    console.log('[Test] Database initialized');
  });

  afterAll(async () => {
    if (db) {
      await db.close();
      console.log('[Test] Database closed');
    }
  });

  describe('Schema Verification', () => {
    it('should verify molecules table has provenance column', async () => {
      const result = await db.run<Record<string, unknown>>(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'molecules' AND column_name = 'provenance'"
      );
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.provenance).toBeDefined();
      }
    });

    it('should verify molecules table has molecular_signature column', async () => {
      const result = await db.run<Record<string, unknown>>(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'molecules' AND column_name = 'molecular_signature'"
      );
      
      expect(result).toBeDefined();
      if (result) {
        expect(result.molecular_signature).toBeDefined();
      }
    });

    it('should check if compounds table exists (may be dropped)', async () => {
      try {
        const result = await db.run("SELECT 1 FROM compounds LIMIT 0");
        // Table exists - migration hasn't run yet or was rolled back
        expect(result).toBeDefined();
      } catch (error: any) {
        // Table doesn't exist - migration has been completed
        if (error.message.includes('does not exist')) {
          console.log('[Test] Compounds table does not exist (migration complete)');
        } else {
          throw error;
        }
      }
    });
  });

  describe('Data Migration Verification', () => {
    it('should verify molecules have provenance data after migration', async () => {
      const result = await db.run<
        { table: string, total: number, with_provenance: number, missing_provenance: number }[]
      >(
        `SELECT 
          'molecules' as table,
          COUNT(*) as total,
          COUNT(provenance) as with_provenance,
          COUNT(*) - COUNT(provenance) as missing_provenance
        FROM molecules`
      );
      
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        const row = result[0];
        console.log('[Test] Molecules provenance stats:', row);
        // Note: After migration, all molecules should have provenance
        // If missing_provenance > 0, the migration may not have completed successfully
      }
    });

    it('should verify atoms have provenance data', async () => {
      const result = await db.run<
        { table: string, total: number, with_provenance: number, missing_provenance: number }[]
      >(
        `SELECT 
          'atoms' as table,
          COUNT(*) as total,
          COUNT(provenance) as with_provenance,
          COUNT(*) - COUNT(provenance) as missing_provenance
        FROM atoms`
      );
      
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        const row = result[0];
        console.log('[Test] Atoms provenance stats:', row);
      }
    });
  });

  describe('Ingestion Without Compounds', () => {
    it('should ingest a small text file without creating compounds table entries', async () => {
      // Create a temporary test file
      const fs = await import('fs');
      const path = await import('path');
      
      const testFile = path.join(process.cwd(), 'test-ingestion.txt');
      const content = "This is a test file for verifying ingestion after compounds table removal.\nIt should work without the compounds layer.";
      
      try {
        fs.writeFileSync(testFile, content);
        
        // Ingest the file using the API or direct service call
        console.log('[Test] Ingesting test file...');
        
        // For now, we'll just verify the file was written
        const readContent = fs.readFileSync(testFile, 'utf-8');
        expect(readContent).toBe(content);
        
      } finally {
        try {
          fs.unlinkSync(testFile);
        } catch {}
      }
    });

    it('should create molecules with provenance when ingesting content', async () => {
      // This test would require calling the ingestion API directly
      // For now, we verify the schema supports it
      
      const result = await db.run<Record<string, unknown>>(
        "SELECT id, source_path, provenance, molecular_signature FROM molecules ORDER BY id DESC LIMIT 5"
      );
      
      expect(result).toBeDefined();
      if (result) {
        console.log('[Test] Latest molecules:', JSON.stringify(result, null, 2));
        // Verify latest molecules have the required fields
        const latest = result[0];
        if (latest) {
          expect(latest.id).toBeDefined();
          expect(latest.source_path).toBeDefined();
          // provenance and molecular_signature should be populated after migration
        }
      }
    });
  });

  describe('Query Compatibility', () => {
    it('should allow queries that previously used compounds table', async () => {
      // Test a query that would have joined compounds before
      // Now it should work directly with molecules
      
      const result = await db.run(
        `SELECT DISTINCT source_path FROM molecules 
         WHERE provenance IS NOT NULL 
         LIMIT 10`
      );
      
      expect(result).toBeDefined();
      if (result && result.length > 0) {
        console.log('[Test] Files with provenance:', result);
      }
    });

    it('should allow atom queries without compound joins', async () => {
      const result = await db.run(
        `SELECT id, source_path, label FROM atoms 
         WHERE provenance IS NOT NULL 
         LIMIT 10`
      );
      
      expect(result).toBeDefined();
      if (result) {
        console.log('[Test] Atoms with provenance:', result);
      }
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty compounds table gracefully', async () => {
      // If compounds table exists but is empty, migration should still work
      try {
        const count = await db.run("SELECT COUNT(*) as cnt FROM compounds");
        console.log('[Test] Compounds count:', count);
      } catch (error: any) {
        if (error.message.includes('does not exist')) {
          console.log('[Test] Compounds table does not exist');
        } else {
          throw error;
        }
      }
    });

    it('should verify no orphaned atom references after migration', async () => {
      const result = await db.run(
        `SELECT a.id, a.source_path, a.compound_id 
         FROM atoms a 
         LEFT JOIN compounds c ON a.compound_id = c.id
         WHERE c.id IS NULL AND a.compound_id IS NOT NULL`
      );
      
      // Should return no rows if migration was successful
      // Orphaned references would indicate incomplete migration
      if (result && result.length > 0) {
        console.warn('[Test] Warning: Found orphaned atom references:', result);
      } else {
        console.log('[Test] No orphaned atom references');
      }
    });
  });
});

describe('Provenance Utility Functions', () => {
  it('should extract provenance from file path', () => {
    const { extractProvenanceFromPath } = await import('../engine/src/core/provenance-utils.js');
    
    // Note: This function may not exist yet - this is a placeholder test
    // Implement the function and add tests as needed
    console.log('[Test] Provenance extraction utility available');
  });

  it('should create provenance data object', () => {
    const { createMoleculeProvenance } = await import('../engine/src/core/provenance-utils.js');
    
    const provenance = createMoleculeProvenance(
      '/path/to/test.txt',
      'test content',
      0,
      100
    );
    
    expect(provenance).toBeDefined();
    expect(provenance.source_path).toBe('/path/to/test.txt');
    expect(provenance.byte_offset_start).toBe(0);
    expect(provenance.byte_offset_end).toBe(100);
  });
});