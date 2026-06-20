-- Fix distills table schema to store full JSON output
-- This allows instant retrieval without disk I/O after initial ingestion

DO $$
BEGIN
  -- Add content column if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'distills' AND column_name = 'content'
  ) THEN
    ALTER TABLE distills ADD COLUMN content JSONB;
    RAISE NOTICE 'Added content column to distills table';
  ELSE
    RAISE NOTICE 'Content column already exists in distills table';
  END IF;
EXCEPTION WHEN others THEN
  RAISE EXCEPTION 'Error adding content column: %', SQLERRM;
END $$;

-- Create index on provenance for faster cache lookups
CREATE INDEX IF NOT EXISTS idx_distills_provenance ON distills USING GIN (provenance);

-- Add comment to explain the purpose of the content column
COMMENT ON COLUMN distills.content IS 'Full JSON output from radial distillation - serves as cache for instant retrieval';
