-- A free video ad requested by replying to a broadcast email with a website (POST /api/free-video/inbound,
-- fed by the n8n Gmail workflow). Its own source so the admin panel can count this campaign apart from the form.
alter table public.free_video_leads drop constraint if exists free_video_leads_source_check;
alter table public.free_video_leads
  add constraint free_video_leads_source_check
  check (source in ('landing', 'fb_lead', 'manual', 'test', 'email_reply'));
