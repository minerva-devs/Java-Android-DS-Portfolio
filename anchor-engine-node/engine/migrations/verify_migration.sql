-- ============================================================================
-- Verification Queries for Compounds Table Migration
-- ============================================================================
-- Run these queries after migration to verify data integrity
-- ============================================================================

-- --------------------------------------------------------------------------
-- 1. Check molecules have provenance populated
-- --------------------------------------------------------------------------
SELECT 
    'molecules' as table_name,
    COUNT(*) as total_rows,
    COUNT(provenance) as with_provenance,
    COUNT(*) - COUNT(provenance) as missing_provenance
FROM molecules;

-- --------------------------------------------------------------------------
-- 2. Check atoms have provenance populated
-- --------------------------------------------------------------------------
SELECT 
    'atoms' as table_name,
    COUNT(*) as total_rows,
    COUNT(provenance) as with_provenance,
    COUNT(*) - COUNT(provenance) as missing_provenance
FROM atoms;

-- --------------------------------------------------------------------------
-- 3. Verify no orphaned molecule references (molecules without compound_id)
-- --------------------------------------------------------------------------
SELECT 
    'orphaned_molecules' as check_type,
    COUNT(*) as count
FROM molecules 
WHERE compound_id IS NULL OR compound_id = '';

-- --------------------------------------------------------------------------
-- 4. Check for atoms referencing non-existent compounds
-- After migration, this should show any atoms still pointing to dropped compound IDs
-- --------------------------------------------------------------------------
SELECT
    'orphaned_atom_references' as check_type,
    COUNT(*) as count
FROM atoms a
LEFT JOIN molecules m ON a.compound_id = m.id
WHERE m.id IS NULL AND a.compound_id IS NOT NULL;

-- --------------------------------------------------------------------------
-- 5. Verify compound table is dropped (should return no rows)
-- Uses information_schema to check if the table still exists
-- --------------------------------------------------------------------------
SELECT
    'compounds_table' as check_type,
    CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END as count
FROM information_schema.tables t
WHERE t.table_name = 'compounds';

-- --------------------------------------------------------------------------
-- 6. Sample molecules with provenance data
-- --------------------------------------------------------------------------
SELECT id, source_path, provenance, molecular_signature, sequence
FROM molecules
WHERE provenance IS NOT NULL
LIMIT 10;

-- --------------------------------------------------------------------------
-- 7. Sample atoms with provenance data
-- --------------------------------------------------------------------------
SELECT id, source_path, provenance, simhash
FROM atoms
WHERE provenance IS NOT NULL
LIMIT 10;

-- --------------------------------------------------------------------------
-- 8. Check for duplicate provenance values in molecules (per file)
-- --------------------------------------------------------------------------
SELECT 
    source_path,
    COUNT(DISTINCT provenance) as prov_count,
    COUNT(*) as molecule_count
FROM molecules
GROUP BY source_path, provenance
HAVING COUNT(DISTINCT provenance) > 1;

-- --------------------------------------------------------------------------
-- 9. Summary statistics
-- --------------------------------------------------------------------------
SELECT
    'migration_summary' as summary,
    (SELECT COUNT(*) FROM molecules WHERE provenance IS NOT NULL) as molecules_with_provenance,
    (SELECT COUNT(*) FROM atoms WHERE provenance IS NOT NULL) as atoms_with_provenance,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'compounds') 
         THEN (SELECT COUNT(*) FROM compounds) 
         ELSE 0 END as compounds_remaining;

-- --------------------------------------------------------------------------
-- 10. List all files that were ingested (from molecules)
-- --------------------------------------------------------------------------
SELECT DISTINCT source_path
FROM molecules
WHERE provenance IS NOT NULL
ORDER BY source_path;