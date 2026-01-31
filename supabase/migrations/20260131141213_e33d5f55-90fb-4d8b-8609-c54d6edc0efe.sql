-- =====================================================
-- AI Credit System Tables
-- =====================================================

-- 1. ai_credit_settings - Global configuration table
CREATE TABLE public.ai_credit_settings (
    key text PRIMARY KEY,
    value_int integer NOT NULL,
    description text
);

-- Enable RLS
ALTER TABLE public.ai_credit_settings ENABLE ROW LEVEL SECURITY;

-- Insert default settings
INSERT INTO public.ai_credit_settings (key, value_int, description) VALUES
    ('tokens_per_credit', 200, 'Number of LLM tokens per display credit'),
    ('tokens_free_per_month', 60000, 'Monthly token allowance for free tier servers (300 credits × 200)'),
    ('tokens_premium_per_month', 600000, 'Monthly token allowance for premium tier servers (3000 credits × 200)');

-- RLS Policies for ai_credit_settings
CREATE POLICY "Authenticated users can view credit settings"
ON public.ai_credit_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can update credit settings"
ON public.ai_credit_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- 2. server_token_allowances - Per-server monthly allowances
CREATE TABLE public.server_token_allowances (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL,
    tokens_granted bigint DEFAULT 0,
    tokens_used bigint DEFAULT 0,
    period_start timestamptz NOT NULL,
    period_end timestamptz NOT NULL,
    source text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT server_token_allowances_server_period_unique UNIQUE (server_id, period_start)
);

-- Enable RLS
ALTER TABLE public.server_token_allowances ENABLE ROW LEVEL SECURITY;

-- Create index for faster lookups
CREATE INDEX idx_server_token_allowances_server_id ON public.server_token_allowances(server_id);
CREATE INDEX idx_server_token_allowances_period ON public.server_token_allowances(period_start, period_end);

-- RLS Policies for server_token_allowances
CREATE POLICY "Users can view allowances for their servers via user_servers"
ON public.server_token_allowances
FOR SELECT
USING (
    server_id IN (
        SELECT us.discord_server_id
        FROM user_servers us
        JOIN users u ON u.discord_user_id = us.discord_user_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY "Server owners can view their servers allowances"
ON public.server_token_allowances
FOR SELECT
USING (
    server_id IN (
        SELECT s.discord_guild_id
        FROM servers s
        WHERE s.owner_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all allowances"
ON public.server_token_allowances
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert allowances"
ON public.server_token_allowances
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update allowances"
ON public.server_token_allowances
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Trigger to update updated_at
CREATE TRIGGER update_server_token_allowances_updated_at
BEFORE UPDATE ON public.server_token_allowances
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- 3. server_token_events - Append-only ledger
CREATE TABLE public.server_token_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    server_id text NOT NULL,
    user_id uuid,
    discord_user_id text,
    idempotency_key text NOT NULL UNIQUE,
    feature text,
    model text,
    provider text,
    prompt_tokens bigint DEFAULT 0,
    completion_tokens bigint DEFAULT 0,
    total_tokens bigint DEFAULT 0,
    credits_charged numeric DEFAULT 0,
    channel_name text,
    metadata jsonb DEFAULT '{}',
    created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.server_token_events ENABLE ROW LEVEL SECURITY;

-- Create indexes for faster lookups
CREATE INDEX idx_server_token_events_server_id ON public.server_token_events(server_id);
CREATE INDEX idx_server_token_events_created_at ON public.server_token_events(created_at);
CREATE INDEX idx_server_token_events_feature ON public.server_token_events(feature);

-- RLS Policies for server_token_events (read-only for users, service role for writes)
CREATE POLICY "Users can view events for their servers via user_servers"
ON public.server_token_events
FOR SELECT
USING (
    server_id IN (
        SELECT us.discord_server_id
        FROM user_servers us
        JOIN users u ON u.discord_user_id = us.discord_user_id
        WHERE u.id = auth.uid()
    )
);

CREATE POLICY "Server owners can view their servers events"
ON public.server_token_events
FOR SELECT
USING (
    server_id IN (
        SELECT s.discord_guild_id
        FROM servers s
        WHERE s.owner_id = auth.uid()
    )
);

CREATE POLICY "Admins can view all events"
ON public.server_token_events
FOR SELECT
USING (has_role(auth.uid(), 'admin'));