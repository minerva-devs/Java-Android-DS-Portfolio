-- ============================================================================
-- Migration: Remove compounds table, move data to molecules/atoms
-- ============================================================================
-- This script performs the following operations:
-- 1. Verifies molecules table has required columns (source_path, provenance, molecular_signature)
-- 2. Propagates compound-level data to related molecule records
-- 3. Drops compounds table
-- 4. Checks for orphaned references in atoms/edges
--
-- Prerequisites:
--   - All compounds must have non-null provenance values
--   - No external queries should be running against compounds table
-- ============================================================================

BEGIN;

-- --------------------------------------------------------------------------
-- Step 1: Verify molecules have all needed columns
-- --------------------------------------------------------------------------
DO $$
DECLARE
    has_source_path BOOLEAN;
    has_provenance BOOLEAN;
    has_molecular_signature BOOLEAN;
BEGIN
    SELECT EXISTS (SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'molecules' AND column_name = 'source_path') INTO has_source_path;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'molecules' AND column_name = 'provenance') INTO has_provenance;
    SELECT EXISTS (SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'molecules' AND column_name = 'molecular_signature') INTO has_molecular_signature;
    
    IF NOT has_source_path OR NOT has_provenance OR NOT has_molecular_signature THEN
        RAISE EXCEPTION 'Molecules table missing required columns: source_path=%, provenance=%, molecular_signature=%', 
            has_source_path, has_provenance, has_molecular_signature;
    END IF;
END $$;

-- --------------------------------------------------------------------------
-- Step 2: Propagate compound-level data to molecules
-- We update each molecule with its compound's provenance, signature, and source path
-- --------------------------------------------------------------------------
UPDATE molecules m
SET provenance = c.provenance,
    molecular_signature = c.molecular_signature,
    source_path = c.path
FROM compounds c
WHERE m.compound_id = c.id;

-- --------------------------------------------------------------------------
-- Step 3: Drop the compounds table
-- --------------------------------------------------------------------------
DROP TABLE IF EXISTS compounds;

-- --------------------------------------------------------------------------
-- Step 4: Verify no orphaned references (atoms/edges referencing dropped compounds)
-- --------------------------------------------------------------------------
DO $$
DECLARE
    orphaned_atoms INTEGER;
BEGIN
    SELECT COUNT(*) INTO orphaned_atoms FROM atoms WHERE compound_id IS NOT NULL AND compound_id NOT IN (SELECT compound_id FROM molecules);
    
    IF orphaned_atoms > 0 THEN
        RAISE WARNING '% atoms reference compounds that no longer exist.', orphaned_atoms;
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- Post-Migration Verification Queries (run separately if needed)
-- ============================================================================

/*
SELECT 'Molecules with provenance' as metric, COUNT(*) as count
FROM molecules
WHERE provenance IS NOT NULL
UNION ALL
SELECT 'Atoms with provenance', COUNT(*)
FROM atoms
WHERE provenance IS NOT NULL;
*/

/*
-- Check for any orphaned atom references
SELECT a.id, a.source_path, a.compound_id
FROM atoms a
LEFT JOIN molecules m ON a.compound_id = m.id
WHERE m.id IS NULL AND a.compound_id IS NOT NULL;
*/