-- Add 'allowed' column to server_channels table if it doesn't exist
ALTER TABLE public.server_channels 
ADD COLUMN IF NOT EXISTS allowed boolean NOT NULL DEFAULT true;

-- Create index for efficient querying by allowed status
CREATE INDEX IF NOT EXISTS idx_server_channels_allowed ON public.server_channels(server_id, allowed);

-- Allow authenticated users to update their own server channels (for the allowed toggle)
CREATE POLICY "Users can update channels for their own servers"
ON public.server_channels
FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM servers
  WHERE servers.id = server_channels.server_id
  AND servers.owner_id = auth.uid()
));