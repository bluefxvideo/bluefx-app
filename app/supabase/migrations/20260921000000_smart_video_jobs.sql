-- The Phantom (Smart Video): job state moves out of job.json / plan.json files in the
-- public script-videos bucket into a private table. Briefs, scripts and API cost
-- figures must not be readable by anyone who holds a storage link.
--
-- Only the server (service role) touches this table: RLS is on and there are no policies.

create table if not exists public.smart_video_jobs (
  id uuid primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  parent_id uuid,
  status text not null,
  -- The whole job as the page and the runner know it (SmartVideoJob), API usage included.
  job jsonb not null,
  -- What a later edit starts from: { plan, props, media, brief }.
  plan jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists smart_video_jobs_user_created_idx on public.smart_video_jobs (user_id, created_at desc);

alter table public.smart_video_jobs enable row level security;
