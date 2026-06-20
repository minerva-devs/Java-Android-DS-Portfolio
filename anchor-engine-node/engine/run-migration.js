/**
 * Migration Script: Drop compounds table, verify molecules table
 */

import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';

async function runMigration() {
  const db = new PGlite();
  
  try {
    // Initialize database
    await db.ready;
    
    console.log('=== Database Initialized ===\n');
    
    // Step 1: Create molecules table with proper schema
    const createMolecules = `
      CREATE TABLE IF NOT EXISTS molecules (
        id TEXT PRIMARY KEY,
        content TEXT,
        compound_id TEXT,
        sequence INTEGER,
        start_byte INTEGER,
        end_byte INTEGER,
        type TEXT,
        numeric_value REAL,
        numeric_unit TEXT,
        molecular_signature TEXT,
        embedding TEXT,
        timestamp REAL,
        tags JSONB,
        entities JSONB,
        source_path TEXT,
        provenance TEXT
      );
    `;
    
    await db.query(createMolecules);
    console.log('✓ Created molecules table');
    
    // Step 2: Create atoms table
    const createAtoms = `
      CREATE TABLE IF NOT EXISTS atoms (
        id TEXT PRIMARY KEY,
        source_path TEXT,
        timestamp REAL,
        simhash TEXT,
        embedding TEXT,
        vector_id BIGINT,
        provenance TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        compound_id TEXT
      );
    `;
    
    await db.query(createAtoms);
    console.log('✓ Created atoms table');
    
    // Step 3: Verify molecules have all needed columns (from migration script)
    console.log('\n=== Verifying Molecules Table Schema ===');
    
    const hasSourcePath = await db.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'molecules' AND column_name = 'source_path') as exists
    `);
    const hasProvenance = await db.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'molecules' AND column_name = 'provenance') as exists
    `);
    const hasMolecularSignature = await db.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.columns
        WHERE table_name = 'molecules' AND column_name = 'molecular_signature') as exists
    `);
    
    console.log('source_path column:', hasSourcePath.rows[0].exists ? '✓' : '✗');
    console.log('provenance column:', hasProvenance.rows[0].exists ? '✓' : '✗');
    console.log('molecular_signature column:', hasMolecularSignature.rows[0].exists ? '✓' : '✗');
    
    // Step 4: Drop compounds table if it exists (it shouldn't in fresh DB)
    const checkCompounds = await db.query(`
      SELECT EXISTS (SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'compounds') as exists
    `);
    
    if (checkCompounds.rows[0].exists) {
      console.log('\nFound compounds table, dropping it...');
      await db.query('DROP TABLE IF EXISTS compounds;');
      console.log('✓ Compounds table dropped');
    } else {
      console.log('\nNo compounds table found (expected in fresh database)');
    }
    
    // Step 5: Verify final state
    console.log('\n=== Final Verification ===');
    
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('Tables in database:');
    for (const row of tables.rows) {
      console.log(`  - ${row.table_name}`);
    }
    
    // Show molecules columns
    const cols = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'molecules'
      ORDER BY ordinal_position
    `);
    console.log('\nMolecules table has these required columns:');
    for (const col of cols.rows) {
      if (['source_path', 'provenance', 'molecular_signature'].includes(col.column_name)) {
        console.log(`  ✓ ${col.column_name}`);
      }
    }
    
    await db.close();
    console.log('\n=== Migration Complete ===');
    process.exit(0);
    
  } catch (error) {
    console.error('Migration failed:', error.message);
    await db.close();
    process.exit(1);
  }
}

runMigration().catch(console.error);