-- Create video_analyses table for Video Analyzer tool
-- Run this in Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS video_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  video_url text,
  video_duration_seconds integer,
  analysis_prompt text,
  custom_prompt text,
  analysis_result text NOT NULL,
  credits_used integer NOT NULL DEFAULT 3,
  is_favorite boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE video_analyses ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  CREATE POLICY "Users can view own analyses" ON video_analyses FOR SELECT USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own analyses" ON video_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own analyses" ON video_analyses FOR UPDATE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own analyses" ON video_analyses FOR DELETE USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_video_analyses_user ON video_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_video_analyses_created ON video_analyses(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_analyses_favorite ON video_analyses(user_id, is_favorite) WHERE is_favorite = true;
