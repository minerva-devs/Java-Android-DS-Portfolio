-- Migration: Add byte offset tracking columns to distills table
-- Standard: Pointer-Based File Reading for Distills (v5.3.0)

ALTER TABLE distills 
ADD COLUMN IF NOT EXISTS start_byte INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS end_byte INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT 0;

-- Create index for faster pointer lookups
CREATE INDEX IF NOT EXISTS idx_distills_start_byte ON distills (start_byte);
CREATE INDEX IF NOT EXISTS idx_distills_end_byte ON distills (end_byte);

COMMENT ON COLUMN distills.start_byte IS 'Byte offset where file content starts';
COMMENT ON COLUMN distills.end_byte IS 'Byte offset where file content ends';
COMMENT ON COLUMN distills.file_size IS 'Total file size for metadata';

-- Cleanup: Delete all molecules with no actual content (length < 3 chars)
-- This removes "ghost" blocks created from blank lines during migration
DELETE FROM molecules 
WHERE LENGTH(TRIM(content)) <= 2 OR content IS NULL;