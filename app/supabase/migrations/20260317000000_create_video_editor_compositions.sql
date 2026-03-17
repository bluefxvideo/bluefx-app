-- Fix video_editor_compositions table:
-- 1. Drop FK constraint on video_id (we store listing IDs, storyboard IDs, not just script_to_video_history UUIDs)
-- 2. Change video_id from UUID to TEXT to support non-UUID identifiers

ALTER TABLE public.video_editor_compositions
  DROP CONSTRAINT IF EXISTS video_editor_compositions_video_id_fkey;

ALTER TABLE public.video_editor_compositions
  ALTER COLUMN video_id TYPE TEXT USING video_id::text;
