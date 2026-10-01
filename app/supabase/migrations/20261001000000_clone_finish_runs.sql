-- Clone Studio, "Finish the ad": what each finishing run cost in API calls, and what was rendered.
-- Run this in Supabase Dashboard SQL Editor.
--
-- ad_clone_projects is readable by its owner, and API cost figures must never reach a page,
-- so they are kept here. Only the server (service role) touches this table: RLS is on and
-- there are no policies. The feature works without this table (the log is skipped).

create table if not exists public.clone_finish_runs (
  id uuid primary key,
  project_id uuid not null references public.ad_clone_projects (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null,
  duration_seconds numeric,
  -- [{ step, usd, detail }]: one entry per API call of the run.
  usage jsonb,
  -- The timeline the renderer got.
  props jsonb,
  error text,
  created_at timestamptz not null default now()
);

create index if not exists clone_finish_runs_project_idx on public.clone_finish_runs (project_id, created_at desc);

alter table public.clone_finish_runs enable row level security;
