-- Create server_settings table
create table if not exists public.server_settings (
  id uuid primary key default gen_random_uuid(),
  server_id uuid references public.servers(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  custom_personality_prompt text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create unique index on server_id
create unique index if not exists server_settings_server_id_key
  on public.server_settings(server_id);

-- Enable RLS
alter table public.server_settings enable row level security;

-- Policy: Users can view settings for their own servers
create policy "Users can view settings for their own servers"
  on public.server_settings
  for select
  using (
    exists (
      select 1 from public.servers
      where servers.id = server_settings.server_id
      and servers.owner_id = auth.uid()
    )
  );

-- Policy: Users can insert settings for their own servers
create policy "Users can insert settings for their own servers"
  on public.server_settings
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.servers
      where servers.id = server_settings.server_id
      and servers.owner_id = auth.uid()
    )
  );

-- Policy: Users can update settings for their own servers
create policy "Users can update settings for their own servers"
  on public.server_settings
  for update
  using (
    exists (
      select 1 from public.servers
      where servers.id = server_settings.server_id
      and servers.owner_id = auth.uid()
    )
  );

-- Trigger to update updated_at
create trigger update_server_settings_updated_at
  before update on public.server_settings
  for each row
  execute function public.update_updated_at_column();