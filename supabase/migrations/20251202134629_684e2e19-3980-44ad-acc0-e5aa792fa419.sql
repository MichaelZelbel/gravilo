-- Add behavior flag columns to server_settings table
alter table server_settings
  add column if not exists behavior_mode text default 'quiet',
  add column if not exists use_knowledge_base boolean default true,
  add column if not exists allow_proactive_replies boolean default false,
  add column if not exists allow_fun_replies boolean default true;