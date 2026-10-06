-- Free video ad funnel (app.bluefx.net/free-video-ad): leads, the one-row settings table
-- (caps and kill switch), owner alerts, page events, the claim function and the funnel view.
-- Run this in Supabase Dashboard SQL Editor BEFORE the push. Paste the whole file and run it once.
-- Safe to run twice: every create is "if not exists" or "or replace", and the settings row is
-- inserted only when missing (a second run never resets caps the owner has changed).
--
-- Server-only like smart_video_jobs: RLS is on, there are no policies, and anon/authenticated
-- are revoked explicitly. Only the server (service role) reads or writes these tables.
-- Leaves the funnel inert: starting = false until the launch step.
--
-- Runbook (separate queries, not part of this paste):
--   Launch:            update free_video_settings set starting = true, updated_at = now() where id = 1;
--   Pause new starts:  update free_video_settings set starting = false, updated_at = now() where id = 1;
--   Close the form:    update free_video_settings set accepting = false, updated_at = now() where id = 1;
--   Retire test rows (frees their keys, nothing is deleted, their fake spend leaves the 24 h caps):
--     update free_video_leads set status = 'rejected', reason = 'test', est_cost_usd = 0, reserved_usd = 0, updated_at = now()
--       where source = 'test' and status <> 'rejected';

create table if not exists public.free_video_settings (
  id smallint primary key default 1 check (id = 1),
  accepting boolean not null default true,            -- false: the form says "come back tomorrow"
  starting boolean not null default false,            -- false: nothing new starts, running jobs finish (kill switch)
  review_mode boolean not null default false,         -- true: every passing video ad waits for the owner's release
  max_running smallint not null default 1 check (max_running between 0 and 4),
  daily_starts integer not null default 150 check (daily_starts >= 0),        -- starts per rolling 24 h
  daily_usd numeric(8,2) not null default 150 check (daily_usd >= 0),         -- API spend per rolling 24 h, failed attempts included
  daily_leads integer not null default 400 check (daily_leads >= 0),          -- accepted signups per rolling 24 h
  per_ip_daily smallint not null default 3 check (per_ip_daily >= 0),
  paid_busy_limit smallint not null default 3 check (paid_busy_limit >= 0),   -- no free start while this many paying Phantom jobs work; 0 = off
  est_usd numeric(6,2) not null default 1.30 check (est_usd > 0),             -- reserved per running attempt until its real cost is known
  system_user_id uuid references auth.users(id) on delete set null,           -- owns every free job; null = nothing starts
  last_sweep_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.free_video_settings (id) values (1) on conflict (id) do nothing;
alter table public.free_video_settings enable row level security;
revoke all on public.free_video_settings from anon, authenticated;
grant select, insert, update, delete on public.free_video_settings to service_role;

create table if not exists public.free_video_leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  source text not null default 'landing' check (source in ('landing','fb_lead','manual','test')),
  ref text check (ref is null or char_length(ref) <= 60),
  first_name text not null check (char_length(first_name) between 1 and 60),
  email text not null check (char_length(email) between 3 and 254),        -- lowercased, trimmed
  email_key text not null,                                                  -- dedupe key: +tag cut, gmail dots removed
  website_url text not null check (char_length(website_url) <= 600),
  website_domain text not null check (char_length(website_domain) <= 253), -- hostname without www.
  view_token text not null,
  status text not null default 'queued' check (status in ('queued','running','held','done','failed','rejected')),
  reason text,
  attempts smallint not null default 0,
  not_before timestamptz,
  job_id uuid,                                                              -- current or last smart_video_jobs id (made by the claim)
  job_ids uuid[] not null default '{}',
  claimed_at timestamptz,
  finished_at timestamptz,
  video_url text,
  duration_seconds numeric(6,1),
  look text,
  gate jsonb,
  photos jsonb,
  live jsonb,                                                               -- what the running job made so far (the live status page)
  est_cost_usd numeric(8,3) not null default 0,                             -- API spend of every attempt, failed ones included
  reserved_usd numeric(8,3) not null default 0,
  email_status text not null default 'pending' check (email_status in ('pending','sending','sent','inactive','failed','skipped')),
  email_claimed_at timestamptz,
  email_attempts smallint not null default 0,
  emailed_at timestamptz,
  ml_status text,
  first_viewed_at timestamptz,
  played_at timestamptz,
  clicked_at timestamptz,
  bought_at timestamptz,
  sale_ref text,
  is_customer boolean not null default false,
  ip text,
  user_agent text,
  consent_at timestamptz,
  -- Offer 1, the $29 unlock (FastSpring product video-ad-unlock): the clean video ad without the watermark
  unlock_status text not null default 'none' check (unlock_status in ('none','paid','rendering','ready','failed','refunded')),
  unlock_order_id text,                                                    -- FastSpring order id; unique, so a repeated webhook unlocks once
  unlock_amount numeric(8,2),
  unlock_currency text,
  unlocked_at timestamptz,                                                 -- when the payment arrived
  clean_video_url text,                                                    -- unguessable clean-<random>.mp4 in the job's folder
  clean_attempts smallint not null default 0,
  clean_claimed_at timestamptz,
  clean_ready_at timestamptz,
  unlock_emailed_at timestamptz
);
-- One video ad per person and per business. A rejected lead (website not readable, or a retired test row) frees both.
create unique index if not exists free_video_leads_email_key_uniq on public.free_video_leads (email_key) where status <> 'rejected';
create unique index if not exists free_video_leads_domain_uniq on public.free_video_leads (website_domain) where status <> 'rejected';
create unique index if not exists free_video_leads_token_uniq on public.free_video_leads (view_token);
create index if not exists free_video_leads_status_idx on public.free_video_leads (status, created_at);
create index if not exists free_video_leads_ip_idx on public.free_video_leads (ip, created_at);
create index if not exists free_video_leads_claimed_idx on public.free_video_leads (claimed_at);
create index if not exists free_video_leads_job_idx on public.free_video_leads (job_id);
create index if not exists free_video_leads_email_idx on public.free_video_leads (email);
create unique index if not exists free_video_leads_unlock_order_uniq on public.free_video_leads (unlock_order_id) where unlock_order_id is not null;
create index if not exists free_video_leads_unlock_idx on public.free_video_leads (unlock_status, clean_claimed_at) where unlock_status in ('paid','rendering');
alter table public.free_video_leads add column if not exists live jsonb;
-- When the sweep deleted the lead's working files (cleanup.ts): 31 days after the video ad, unless the clean
-- version was bought. Added 2026-10-07; without it the hourly cleanup only logs that it cannot read the leads.
alter table public.free_video_leads add column if not exists files_cleaned_at timestamptz;
alter table public.free_video_leads enable row level security;
revoke all on public.free_video_leads from anon, authenticated;
grant select, insert, update, delete on public.free_video_leads to service_role;

create table if not exists public.free_video_alerts (
  key text primary key,                 -- dedupe: one alert per lead / event / hour
  created_at timestamptz not null default now(),
  subject text not null,
  body text,
  sent boolean not null default false,
  error text
);
create index if not exists free_video_alerts_created_idx on public.free_video_alerts (created_at);
alter table public.free_video_alerts enable row level security;
revoke all on public.free_video_alerts from anon, authenticated;
grant select, insert, update, delete on public.free_video_alerts to service_role;

-- P1 measurement (created now so no second migration is needed)
create table if not exists public.free_video_events (
  id bigserial primary key,
  at timestamptz not null default now(),
  event text not null check (char_length(event) <= 30),
  lead_id uuid references public.free_video_leads(id) on delete cascade,
  visitor_id text,
  placement text,
  ref text,
  meta jsonb
);
create index if not exists free_video_events_event_idx on public.free_video_events (event, at desc);
create index if not exists free_video_events_lead_idx on public.free_video_events (lead_id, at desc);
alter table public.free_video_events enable row level security;
revoke all on public.free_video_events from anon, authenticated;
revoke all on sequence public.free_video_events_id_seq from anon, authenticated;
grant select, insert, update, delete on public.free_video_events to service_role;
grant usage, select on sequence public.free_video_events_id_seq to service_role;

-- Keeps the claim's heartbeat and paying-users-busy counts fast as smart_video_jobs grows (additive).
create index if not exists smart_video_jobs_status_updated_idx on public.smart_video_jobs (status, updated_at);

-- The ONLY way a free video ad starts. Caps, budget, kill switch and the claim are one serialized decision.
-- p_test: local dev servers claim only source='test' leads; production never claims them. Every count below is
-- of the caller's own kind of lead, so local tests never use up (or wait for) production's caps.
create or replace function public.claim_free_video_lead(p_test boolean default false, p_stale_minutes integer default 12)
returns setof public.free_video_leads
language plpgsql
set search_path = public
as $$
declare
  s public.free_video_settings%rowtype;
  v_running integer;
  v_paid_busy integer;
  v_clone_busy integer;
  v_started integer;
  v_spent numeric;
  v_id uuid;
  v_job uuid := gen_random_uuid();
begin
  perform pg_advisory_xact_lock(hashtext('claim_free_video_lead'));

  select * into s from public.free_video_settings where id = 1;
  if not found or not s.starting or s.system_user_id is null or s.max_running < 1 then
    return;
  end if;

  -- Running = claimed recently (a first save can be slow), or its job still has a fresh heartbeat.
  -- A deploy-killed job stops counting once its heartbeat is stale.
  select count(*) into v_running
  from public.free_video_leads l
  left join public.smart_video_jobs j on j.id = l.job_id
  where l.status = 'running'
    and (case when p_test then l.source = 'test' else l.source <> 'test' end)
    and (l.claimed_at > now() - make_interval(mins => greatest(3, p_stale_minutes))
         or (j.status not in ('done','failed') and j.updated_at > now() - make_interval(mins => p_stale_minutes)));
  if v_running >= s.max_running then
    return;
  end if;

  -- Paying users first: the render server has no queue. Phantom jobs of real users, plus Clone Studio
  -- runs that are directing or finishing (both end in a render on the same server).
  if s.paid_busy_limit > 0 and not p_test then
    select count(*) into v_paid_busy
    from public.smart_video_jobs
    where user_id <> s.system_user_id
      and status not in ('done','failed')
      and updated_at > now() - make_interval(mins => p_stale_minutes)
      and created_at > now() - interval '2 hours';
    begin
      select count(*) into v_clone_busy
      from public.ad_clone_projects
      where status in ('directing','finishing')
        and updated_at > now() - make_interval(mins => p_stale_minutes);
    exception when undefined_table or undefined_column then
      v_clone_busy := 0;
    end;
    if v_paid_busy + v_clone_busy >= s.paid_busy_limit then
      return;
    end if;
  end if;

  -- Rolling 24 h: every attempt (a retry is a new start) and real spend plus what running attempts have reserved.
  select coalesce(sum(greatest(attempts, 1)), 0), coalesce(sum(est_cost_usd + reserved_usd), 0) into v_started, v_spent
  from public.free_video_leads
  where claimed_at > now() - interval '24 hours'
    and (case when p_test then source = 'test' else source <> 'test' end);
  if v_started >= s.daily_starts or v_spent + s.est_usd > s.daily_usd then
    return;
  end if;

  select q.id into v_id
  from public.free_video_leads q
  where q.status = 'queued'
    and (q.not_before is null or q.not_before <= now())
    and (case when p_test then q.source = 'test' else q.source <> 'test' end)
  order by q.created_at
  limit 1
  for update skip locked;
  if v_id is null then
    return;
  end if;

  return query
  with claimed as (
    update public.free_video_leads l
       set status = 'running', claimed_at = now(), updated_at = now(), attempts = l.attempts + 1,
           job_id = v_job, job_ids = array_append(l.job_ids, v_job), reserved_usd = s.est_usd,
           not_before = null, reason = null
     where l.id = v_id
    returning l.*
  )
  select * from claimed;
end;
$$;
revoke all on function public.claim_free_video_lead(boolean, integer) from public, anon, authenticated;
grant execute on function public.claim_free_video_lead(boolean, integer) to service_role;

-- The ONLY way a lead is stored. The per-IP, per-address and daily caps are counted and the row is inserted
-- under one lock, so parallel submits cannot all pass the counts. Returns {"outcome": ..., "lead": <row>}:
-- ok, paused (no settings), closed (accepting off or daily_leads reached), tooMany (per IP or per address),
-- duplicateEmail, duplicateSite (the partial unique indexes), duplicate (any other unique key).
-- p_lead: source, ref, first_name, email, email_key, website_url, website_domain, view_token, status
-- ('queued', or 'rejected' to keep the email of a website that cannot be used), reason, ip, user_agent, is_customer.
create or replace function public.create_free_video_lead(p_lead jsonb, p_ip_rows integer default 10, p_email_rows integer default 5)
returns jsonb
language plpgsql
set search_path = public
as $$
declare
  s public.free_video_settings%rowtype;
  v_ip text := nullif(p_lead->>'ip', '');
  v_source text := coalesce(nullif(p_lead->>'source', ''), 'landing');
  v_status text := coalesce(nullif(p_lead->>'status', ''), 'queued');
  v_live integer := 0;
  v_all integer := 0;
  v_email integer := 0;
  v_daily integer := 0;
  v_row public.free_video_leads%rowtype;
  v_constraint text;
begin
  perform pg_advisory_xact_lock(hashtext('create_free_video_lead'));

  select * into s from public.free_video_settings where id = 1;
  if not found then
    return jsonb_build_object('outcome', 'paused');
  end if;
  if not s.accepting then
    return jsonb_build_object('outcome', 'closed');
  end if;

  if v_ip is not null then
    select count(*) filter (where status <> 'rejected'), count(*) into v_live, v_all
    from public.free_video_leads
    where ip = v_ip and created_at > now() - interval '24 hours';
    if v_all >= p_ip_rows or (v_status <> 'rejected' and v_live >= s.per_ip_daily) then
      return jsonb_build_object('outcome', 'tooMany');
    end if;
  end if;

  select count(*) into v_email
  from public.free_video_leads
  where email_key = p_lead->>'email_key' and created_at > now() - interval '24 hours';
  if v_email >= p_email_rows then
    return jsonb_build_object('outcome', 'tooMany');
  end if;

  if v_status <> 'rejected' and v_source <> 'test' then
    select count(*) into v_daily
    from public.free_video_leads
    where source <> 'test' and status <> 'rejected' and created_at > now() - interval '24 hours';
    if v_daily >= s.daily_leads then
      return jsonb_build_object('outcome', 'closed');
    end if;
  end if;

  begin
    insert into public.free_video_leads (source, ref, first_name, email, email_key, website_url, website_domain, view_token,
                                         status, reason, ip, user_agent, is_customer, consent_at)
    values (v_source, nullif(p_lead->>'ref', ''), p_lead->>'first_name', p_lead->>'email', p_lead->>'email_key',
            p_lead->>'website_url', p_lead->>'website_domain', p_lead->>'view_token', v_status, nullif(p_lead->>'reason', ''),
            v_ip, nullif(p_lead->>'user_agent', ''), coalesce((p_lead->>'is_customer')::boolean, false), now())
    returning * into v_row;
  exception when unique_violation then
    get stacked diagnostics v_constraint = constraint_name;
    return jsonb_build_object('outcome', case v_constraint
      when 'free_video_leads_email_key_uniq' then 'duplicateEmail'
      when 'free_video_leads_domain_uniq' then 'duplicateSite'
      else 'duplicate' end);
  end;
  return jsonb_build_object('outcome', 'ok', 'lead', to_jsonb(v_row));
end;
$$;
revoke all on function public.create_free_video_lead(jsonb, integer, integer) from public, anon, authenticated;
grant execute on function public.create_free_video_lead(jsonb, integer, integer) to service_role;

-- One row per day / ref / source: the list test at a glance (security_invoker: never exposed to anon).
create or replace view public.free_video_funnel with (security_invoker = true) as
select (created_at at time zone 'UTC')::date as day,
  coalesce(ref, '') as ref,
  source,
  count(*) as leads,
  count(*) filter (where status = 'rejected') as unreadable,
  count(*) filter (where attempts > 0) as started,
  count(*) filter (where status = 'done') as done,
  count(*) filter (where status = 'held') as held,
  count(*) filter (where status = 'failed') as failed,
  count(*) filter (where emailed_at is not null) as emailed,
  count(*) filter (where email_status = 'inactive') as page_only,
  count(*) filter (where first_viewed_at is not null) as viewed,
  count(*) filter (where played_at is not null) as played,
  count(*) filter (where clicked_at is not null) as clicked,
  count(*) filter (where bought_at is not null) as bought,
  count(*) filter (where unlock_status in ('paid','rendering','ready','failed')) as unlocks,
  coalesce(round(sum(unlock_amount) filter (where unlock_status in ('paid','rendering','ready','failed')), 2), 0) as unlock_revenue,
  count(*) filter (where is_customer) as customers,
  round(sum(est_cost_usd), 2) as api_usd,
  round((percentile_cont(0.5) within group (order by extract(epoch from finished_at - created_at) / 60))::numeric, 1) as p50_min,
  round((percentile_cont(0.9) within group (order by extract(epoch from finished_at - created_at) / 60))::numeric, 1) as p90_min
from public.free_video_leads
where source <> 'test' and coalesce(ref, '') <> 'smoke'
group by 1, 2, 3
order by 1 desc, 2;
revoke all on public.free_video_funnel from anon, authenticated;
grant select on public.free_video_funnel to service_role;

-- The system user that owns every free job (free-video@bluefx.net, created by the owner in Authentication > Add user).
-- Found by its email: while that user does not exist yet this sets null and nothing starts; run this statement
-- again after creating the user.
update public.free_video_settings
   set system_user_id = (select id from auth.users where lower(email) = 'free-video@bluefx.net'), updated_at = now()
 where id = 1;
