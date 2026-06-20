/**
 * Verification Queries for Migration
 */

import { PGlite } from '@electric-sql/pglite';

async function verifyMigration() {
  const db = new PGlite();
  await db.ready;
  
  console.log('=== Migration Verification ===\n');
  
  // 1. Check molecules have provenance populated
  const moleculesCheck = await db.query(`
    SELECT 
      'molecules' as table_name,
      COUNT(*) as total_rows,
      COUNT(provenance) as with_provenance,
      COUNT(*) - COUNT(provenance) as missing_provenance
    FROM molecules;
  `);
  console.log('Molecules table:');
  console.log(`  Total rows: ${moleculesCheck.rows[0].total_rows}`);
  console.log(`  With provenance: ${moleculesCheck.rows[0].with_provenance}`);
  console.log(`  Missing provenance: ${moleculesCheck.rows[0].missing_provenance}`);
  
  // 2. Check atoms have provenance populated
  const atomsCheck = await db.query(`
    SELECT 
      'atoms' as table_name,
      COUNT(*) as total_rows,
      COUNT(provenance) as with_provenance,
      COUNT(*) - COUNT(provenance) as missing_provenance
    FROM atoms;
  `);
  console.log('\nAtoms table:');
  console.log(`  Total rows: ${atomsCheck.rows[0].total_rows}`);
  console.log(`  With provenance: ${atomsCheck.rows[0].with_provenance}`);
  console.log(`  Missing provenance: ${atomsCheck.rows[0].missing_provenance}`);
  
  // 3. Verify no orphaned molecule references
  const orphanedMolecules = await db.query(`
    SELECT 'orphaned_molecules' as check_type, COUNT(*) as count
    FROM molecules
    WHERE compound_id IS NULL OR compound_id = '';
  `);
  console.log(`\nOrphaned molecules (no compound_id): ${orphanedMolecules.rows[0].count}`);
  
  // 4. Check for orphaned atom references to dropped compounds
  const orphanedAtoms = await db.query(`
    SELECT 'orphaned_atom_references' as check_type, COUNT(*) as count
    FROM atoms a
    LEFT JOIN molecules m ON a.compound_id = m.id
    WHERE m.id IS NULL AND a.compound_id IS NOT NULL;
  `);
  console.log(`Orphaned atom references: ${orphanedAtoms.rows[0].count}`);
  
  // 5. Verify compounds table is dropped
  const compoundsCheck = await db.query(`
    SELECT 'compounds_table' as check_type, 
      CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END as count
    FROM information_schema.tables t
    WHERE t.table_name = 'compounds';
  `);
  console.log(`\nCompounds table exists: ${compoundsCheck.rows[0].count === 1 ? 'NO ✓' : 'YES ✗'}`);
  
  // 6. Sample molecules with provenance data
  const sampleMolecules = await db.query(`
    SELECT id, source_path, provenance, molecular_signature 
    FROM molecules 
    WHERE provenance IS NOT NULL
    LIMIT 5;
  `);
  console.log('\nSample molecules (with provenance):');
  for (const m of sampleMolecules.rows) {
    console.log(`  - ${m.id}: source=${m.source_path}, prov=${m.provenance}`);
  }
  
  // 7. Summary statistics
  const summary = await db.query(`
    SELECT
      'migration_summary' as summary,
      (SELECT COUNT(*) FROM molecules WHERE provenance IS NOT NULL) as molecules_with_provenance,
      (SELECT COUNT(*) FROM atoms WHERE provenance IS NOT NULL) as atoms_with_provenance,
      CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compounds')
           THEN (SELECT COUNT(*) FROM compounds)
           ELSE 0 END as compounds_remaining;
  `);
  console.log('\n=== Summary ===');
  console.log(`Molecules with provenance: ${summary.rows[0].molecules_with_provenance}`);
  console.log(`Atoms with provenance: ${summary.rows[0].atoms_with_provenance}`);
  console.log(`Compounds remaining: ${summary.rows[0].compounds_remaining}`);
  
  await db.close();
}

verifyMigration().catch(console.error);