-- Create server_usage table for historical tracking
create table if not exists public.server_usage (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers(id) on delete cascade,
  discord_guild_id text not null,
  messages int default 0,
  cycle_start date not null default date_trunc('month', current_date),
  cycle_end date not null default (date_trunc('month', current_date) + interval '1 month - 1 day'),
  created_at timestamp with time zone default now(),
  unique(server_id, cycle_start)
);

-- Add usage tracking columns to servers table
alter table public.servers 
  add column if not exists cycle_start date default date_trunc('month', current_date),
  add column if not exists cycle_end date default (date_trunc('month', current_date) + interval '1 month - 1 day');

-- Enable RLS on server_usage
alter table public.server_usage enable row level security;

-- RLS policies for server_usage
create policy "Users can view usage for their own servers"
  on public.server_usage
  for select
  using (
    exists (
      select 1 from public.servers
      where servers.id = server_usage.server_id
      and servers.owner_id = auth.uid()
    )
  );

-- Index for faster lookups
create index if not exists idx_server_usage_server_cycle 
  on public.server_usage(server_id, cycle_start);