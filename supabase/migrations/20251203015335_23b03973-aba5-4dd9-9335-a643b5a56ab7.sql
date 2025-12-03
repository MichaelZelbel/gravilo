-- Create server_channels table to store Discord channel metadata
CREATE TABLE public.server_channels (
  id text PRIMARY KEY, -- Discord channel ID
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE,
  discord_guild_id text NOT NULL,
  name text NOT NULL,
  type integer NOT NULL, -- Discord channel type (0=text, 2=voice, 4=category, etc.)
  position integer,
  parent_id text, -- Parent category channel ID
  nsfw boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.server_channels ENABLE ROW LEVEL SECURITY;

-- Users can view channels for their own servers
CREATE POLICY "Users can view channels for their own servers"
ON public.server_channels
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = server_channels.server_id
    AND servers.owner_id = auth.uid()
  )
);

-- Create index for faster lookups
CREATE INDEX idx_server_channels_server_id ON public.server_channels(server_id);
CREATE INDEX idx_server_channels_discord_guild_id ON public.server_channels(discord_guild_id);

-- Create trigger for updated_at
CREATE TRIGGER update_server_channels_updated_at
BEFORE UPDATE ON public.server_channels
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();