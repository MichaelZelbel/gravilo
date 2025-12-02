-- Add new columns to server_settings table
ALTER TABLE public.server_settings
ADD COLUMN IF NOT EXISTS personality_preset text DEFAULT 'helpful',
ADD COLUMN IF NOT EXISTS enable_moderation boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS model_name text DEFAULT 'gpt-4o-mini',
ADD COLUMN IF NOT EXISTS max_reply_tokens integer DEFAULT 500,
ADD COLUMN IF NOT EXISTS discord_server_id text;

-- Rename use_knowledge_base to enable_kb_ingestion for consistency (or keep both)
-- We'll keep both for backwards compatibility
ALTER TABLE public.server_settings
ADD COLUMN IF NOT EXISTS enable_kb_ingestion boolean DEFAULT true;

-- Create index for discord_server_id lookups (for API)
CREATE INDEX IF NOT EXISTS idx_server_settings_discord_server_id ON public.server_settings(discord_server_id);

-- Create a policy for bot API access (via service role)
-- The existing RLS policies use server_id uuid, we need discord_server_id for the API