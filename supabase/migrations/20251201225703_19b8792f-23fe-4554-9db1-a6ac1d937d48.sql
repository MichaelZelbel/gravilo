-- Create users table for Discord OAuth users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  discord_user_id TEXT UNIQUE,
  email TEXT,
  stripe_customer_id TEXT,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.users
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.users
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert their own profile"
  ON public.users
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create servers table for Discord guilds
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  discord_guild_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  icon_url TEXT,
  bot_nickname TEXT DEFAULT 'Gravilo',
  message_usage_current_cycle INT DEFAULT 0 CHECK (message_usage_current_cycle >= 0),
  message_limit INT DEFAULT 3000 CHECK (message_limit > 0),
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on servers table
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Users can view their own servers
CREATE POLICY "Users can view their own servers"
  ON public.servers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Users can insert their own servers
CREATE POLICY "Users can insert their own servers"
  ON public.servers
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = owner_id);

-- Users can update their own servers
CREATE POLICY "Users can update their own servers"
  ON public.servers
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Users can delete their own servers
CREATE POLICY "Users can delete their own servers"
  ON public.servers
  FOR DELETE
  TO authenticated
  USING (auth.uid() = owner_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_servers_updated_at
  BEFORE UPDATE ON public.servers
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert some example data for testing (optional, remove in production)
-- This will fail silently if the user doesn't exist yet
DO $$
DECLARE
  test_user_id UUID;
BEGIN
  -- Try to get the first authenticated user
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NOT NULL THEN
    -- Insert user row if it doesn't exist
    INSERT INTO public.users (id, email, plan)
    VALUES (test_user_id, (SELECT email FROM auth.users WHERE id = test_user_id), 'premium')
    ON CONFLICT (id) DO NOTHING;
    
    -- Insert example servers
    INSERT INTO public.servers (owner_id, discord_guild_id, name, icon_url, message_usage_current_cycle, message_limit)
    VALUES 
      (test_user_id, '1234567890', 'Antigravity Server', 'https://cdn.discordapp.com/icons/placeholder.png', 1240, 3000),
      (test_user_id, '0987654321', 'Development Hub', 'https://cdn.discordapp.com/icons/placeholder2.png', 450, 3000)
    ON CONFLICT (discord_guild_id) DO NOTHING;
  END IF;
END $$;