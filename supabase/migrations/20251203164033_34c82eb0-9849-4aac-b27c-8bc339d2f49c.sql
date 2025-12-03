-- Create server_activity table for tracking interactions
CREATE TABLE public.server_activity (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id text NOT NULL,
  source text NOT NULL,
  user_name text NOT NULL,
  channel_name text,
  query text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create index for efficient querying by server_id and created_at
CREATE INDEX idx_server_activity_server_created ON public.server_activity(server_id, created_at DESC);

-- Enable RLS
ALTER TABLE public.server_activity ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can view activity for servers they have access to via user_servers
CREATE POLICY "Users can view activity for their servers"
ON public.server_activity
FOR SELECT
USING (
  server_id IN (
    SELECT us.discord_server_id
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

-- RLS policy: users can insert activity for servers they have access to
CREATE POLICY "Users can insert activity for their servers"
ON public.server_activity
FOR INSERT
WITH CHECK (
  server_id IN (
    SELECT us.discord_server_id
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);