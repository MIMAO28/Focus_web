-- FOCUS! 云端数据表（在 Supabase SQL Editor 里整段执行一次）
-- 作用：邮箱账号 + 跨设备同步学习项目与专注记录；每行只能被本人读写。

create extension if not exists "pgcrypto";

create table if not exists public.focus_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  color text not null default '#FF3B2F',
  created_at timestamptz not null default now()
);

create table if not exists public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  project_id uuid not null references public.focus_projects (id) on delete cascade,
  mode text not null check (mode in ('countdown', 'countup')),
  seconds integer not null check (seconds between 5 and 86400),
  started_at timestamptz not null,
  ended_at timestamptz not null default now()
);

create index if not exists focus_projects_user_idx on public.focus_projects (user_id);
create index if not exists focus_sessions_user_idx on public.focus_sessions (user_id, ended_at desc);

alter table public.focus_projects enable row level security;
alter table public.focus_sessions enable row level security;

drop policy if exists "focus_projects_owner" on public.focus_projects;
create policy "focus_projects_owner" on public.focus_projects
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "focus_sessions_owner" on public.focus_sessions;
create policy "focus_sessions_owner" on public.focus_sessions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

grant select, insert, update, delete on public.focus_projects to authenticated;
grant select, insert, update, delete on public.focus_sessions to authenticated;
