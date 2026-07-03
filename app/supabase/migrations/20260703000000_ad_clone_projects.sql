-- Clone Studio (Beta): scene-level ad cloning projects
-- Run this in Supabase Dashboard SQL Editor
--
-- One row per cloned ad. The whole scene board lives in `scenes` jsonb:
-- [{ n, start, end, keyframe_url,
--    analysis { action_arc { start_state, action, end_state, invariants[] },
--               dialog, camera, on_screen_text, swap_targets[] },
--    user_instruction, user_ref_urls[], edited_image_url, image_versions[],
--    anim { request_id, video_url, status }, credits_spent }]

CREATE TABLE IF NOT EXISTS ad_clone_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text,
  source_url text,
  source_platform text,
  source_video_url text,
  video_duration_seconds numeric,
  video_width integer,
  video_height integer,
  aspect_ratio text,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  scenes jsonb NOT NULL DEFAULT '[]'::jsonb,
  analysis_summary jsonb,
  credits_spent integer NOT NULL DEFAULT 0,
  final_video_url text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE ad_clone_projects ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users can view own clone projects" ON ad_clone_projects FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own clone projects" ON ad_clone_projects FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own clone projects" ON ad_clone_projects FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own clone projects" ON ad_clone_projects FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ad_clone_projects_user ON ad_clone_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_clone_projects_created ON ad_clone_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_clone_projects_status ON ad_clone_projects(status);
-- The fal-ai webhook matches animation callbacks with scenes @> containment;
-- jsonb_path_ops keeps that lookup indexed as projects accumulate
CREATE INDEX IF NOT EXISTS idx_ad_clone_projects_scenes ON ad_clone_projects USING gin (scenes jsonb_path_ops);
