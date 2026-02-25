-- ============================================================
-- Migration: Add PDF binary storage to vademecums table
-- ============================================================
-- This migration adds a BYTEA column to store the actual PDF file data
-- in addition to the extracted text that's already stored.

BEGIN;

-- Add file_data column to store PDF binary data
ALTER TABLE vademecums 
ADD COLUMN IF NOT EXISTS file_data BYTEA;

-- Add file_size column to track PDF size (optional, but useful)
ALTER TABLE vademecums 
ADD COLUMN IF NOT EXISTS file_size INTEGER;

-- Add mime_type column to track file type (optional, but useful)
ALTER TABLE vademecums 
ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100) DEFAULT 'application/pdf';

-- Add comment for documentation
COMMENT ON COLUMN vademecums.file_data IS 'Binary PDF file data stored in database';
COMMENT ON COLUMN vademecums.file_size IS 'Size of PDF file in bytes';
COMMENT ON COLUMN vademecums.mime_type IS 'MIME type of the file (usually application/pdf)';

COMMIT;
