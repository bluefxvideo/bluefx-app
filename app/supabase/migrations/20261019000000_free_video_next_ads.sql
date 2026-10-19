-- The next 3 video ads written for a finished free video ad (lib/free-video/next-ads.ts): their ideas, first frames
-- and cost. The result page shows them as the 3 written video ads; after the buy they are made as real video ads.
alter table public.free_video_leads add column if not exists next_ads jsonb;
