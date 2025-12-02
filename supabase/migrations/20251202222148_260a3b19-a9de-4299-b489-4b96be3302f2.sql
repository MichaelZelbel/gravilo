-- Add owner_discord_id column to servers table
ALTER TABLE public.servers
ADD COLUMN IF NOT EXISTS owner_discord_id text;

-- Create user_servers table for linking users to servers
CREATE TABLE IF NOT EXISTS public.user_servers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_user_id text NOT NULL,
  discord_server_id text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(discord_user_id, discord_server_id)
);

-- Enable RLS on user_servers
ALTER TABLE public.user_servers ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own server mappings
CREATE POLICY "Users can view their own server mappings"
ON public.user_servers
FOR SELECT
USING (
  discord_user_id IN (
    SELECT discord_user_id FROM public.users WHERE id = auth.uid()
  )
);

-- Policy: Allow inserts from service role (used by edge functions)
CREATE POLICY "Service role can insert user_servers"
ON public.user_servers
FOR INSERT
WITH CHECK (true);

-- Policy: Allow authenticated users to insert their own mappings
CREATE POLICY "Users can insert their own server mappings"
ON public.user_servers
FOR INSERT
WITH CHECK (
  discord_user_id IN (
    SELECT discord_user_id FROM public.users WHERE id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_servers_discord_user_id ON public.user_servers(discord_user_id);
CREATE INDEX IF NOT EXISTS idx_user_servers_discord_server_id ON public.user_servers(discord_server_id);
CREATE INDEX IF NOT EXISTS idx_servers_owner_discord_id ON public.servers(owner_discord_id);