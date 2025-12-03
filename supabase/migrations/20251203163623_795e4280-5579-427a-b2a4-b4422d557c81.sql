-- Create server_personality table
CREATE TABLE public.server_personality (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  server_id text NOT NULL UNIQUE,
  preset text NOT NULL DEFAULT 'helpful_assistant',
  custom_prompt text,
  updated_at timestamptz DEFAULT now()
);

-- Create index on server_id for fast lookups
CREATE INDEX idx_server_personality_server_id ON public.server_personality(server_id);

-- Enable RLS
ALTER TABLE public.server_personality ENABLE ROW LEVEL SECURITY;

-- RLS policy: users can view personality for servers they have access to via user_servers
CREATE POLICY "Users can view personality for their servers"
ON public.server_personality
FOR SELECT
USING (
  server_id IN (
    SELECT us.discord_server_id
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

-- RLS policy: users can insert personality for servers they have access to
CREATE POLICY "Users can insert personality for their servers"
ON public.server_personality
FOR INSERT
WITH CHECK (
  server_id IN (
    SELECT us.discord_server_id
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

-- RLS policy: users can update personality for servers they have access to
CREATE POLICY "Users can update personality for their servers"
ON public.server_personality
FOR UPDATE
USING (
  server_id IN (
    SELECT us.discord_server_id
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);