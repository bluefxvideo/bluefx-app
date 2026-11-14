-- ClickBank affiliate funnel (owner 2026-11-14, docs/cb-affiliate-funnel.md section 8): the block switch per affiliate.
--
-- NOT APPLIED. Run in the Supabase SQL editor before the push. Paste the whole file and run it once; running it twice
-- is safe (create if not exists, the rest repeats cleanly). Until it runs, nobody is ever blocked (lib/free-video/
-- cb-affiliates.ts counts a failed read as active), but the admin panel's block switch and list need the table.
--
-- One row per ClickBank nickname (lowercased) the owner set in the admin panel; no row means active. Server-only like
-- every free_video table: RLS on, no policies, anon and authenticated revoked, only the service role reads or writes.
create table if not exists public.free_video_cb_affiliates (
  nickname text primary key check (nickname ~ '^[a-z0-9_]{1,30}$'),
  status text not null default 'active' check (status in ('active','blocked')),
  note text check (note is null or char_length(note) <= 500),
  updated_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.free_video_cb_affiliates enable row level security;
revoke all on public.free_video_cb_affiliates from anon, authenticated;
grant select, insert, update, delete on public.free_video_cb_affiliates to service_role;
