-- Add new columns to server_kb_files for ingestion tracking
ALTER TABLE public.server_kb_files
ADD COLUMN IF NOT EXISTS num_chunks integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS duration_ms integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS error_message text DEFAULT NULL;