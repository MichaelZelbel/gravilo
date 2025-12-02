-- Create storage bucket for knowledge base files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('kb-files', 'kb-files', false);

-- Create RLS policies for kb-files bucket
CREATE POLICY "Users can upload KB files for their servers"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'kb-files' AND
  (storage.foldername(name))[1] IN (
    SELECT us.discord_server_id 
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can view KB files for their servers"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'kb-files' AND
  (storage.foldername(name))[1] IN (
    SELECT us.discord_server_id 
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can delete KB files for their servers"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'kb-files' AND
  (storage.foldername(name))[1] IN (
    SELECT us.discord_server_id 
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

-- Create server_kb_files table for file metadata
CREATE TABLE public.server_kb_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  discord_server_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'uploaded',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.server_kb_files ENABLE ROW LEVEL SECURITY;

-- RLS policies for server_kb_files
CREATE POLICY "Users can view KB files for their servers"
ON public.server_kb_files FOR SELECT
USING (
  discord_server_id IN (
    SELECT us.discord_server_id 
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can insert KB files for their servers"
ON public.server_kb_files FOR INSERT
WITH CHECK (
  discord_server_id IN (
    SELECT us.discord_server_id 
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);

CREATE POLICY "Users can delete KB files for their servers"
ON public.server_kb_files FOR DELETE
USING (
  discord_server_id IN (
    SELECT us.discord_server_id 
    FROM user_servers us
    JOIN users u ON u.discord_user_id = us.discord_user_id
    WHERE u.id = auth.uid()
  )
);