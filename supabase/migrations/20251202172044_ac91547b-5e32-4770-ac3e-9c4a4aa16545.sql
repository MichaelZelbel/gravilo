-- Create server_plans table to track per-server subscription plan
CREATE TABLE IF NOT EXISTS public.server_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  server_id uuid REFERENCES public.servers(id) ON DELETE CASCADE NOT NULL UNIQUE,
  plan text DEFAULT 'free' NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.server_plans ENABLE ROW LEVEL SECURITY;

-- RLS: Users can view plans for their own servers
CREATE POLICY "Users can view plans for their own servers"
ON public.server_plans
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = server_plans.server_id
    AND servers.owner_id = auth.uid()
  )
);

-- RLS: Users can insert plans for their own servers
CREATE POLICY "Users can insert plans for their own servers"
ON public.server_plans
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = server_plans.server_id
    AND servers.owner_id = auth.uid()
  )
);

-- RLS: Users can update plans for their own servers
CREATE POLICY "Users can update plans for their own servers"
ON public.server_plans
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM servers
    WHERE servers.id = server_plans.server_id
    AND servers.owner_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_server_plans_updated_at
BEFORE UPDATE ON public.server_plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();