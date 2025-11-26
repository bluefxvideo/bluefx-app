-- Migration: 20251126_scheduled_posts.sql
-- Content Multiplier 2.0 - Scheduled Posts System
-- Enables scheduling and tracking social media posts across platforms

-- Create scheduled_posts table
CREATE TABLE IF NOT EXISTS public.scheduled_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Video/Media data
  video_url TEXT NOT NULL,
  video_thumbnail_url TEXT,
  video_duration_seconds NUMERIC,

  -- Original content input
  original_description TEXT NOT NULL,
  original_transcript TEXT,

  -- Target platform
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'youtube', 'twitter', 'linkedin', 'facebook')),

  -- AI-generated platform-specific content
  generated_content JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- Structure: {
  --   caption: string,
  --   hashtags: string[],
  --   title?: string (YouTube),
  --   description?: string (YouTube),
  --   tags?: string[] (YouTube),
  -- }

  -- Scheduling
  scheduled_for TIMESTAMPTZ, -- NULL = draft, set = scheduled
  post_immediately BOOLEAN DEFAULT false,
  use_best_time BOOLEAN DEFAULT false,
  best_time_suggested TIMESTAMPTZ, -- AI-suggested optimal time

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'posting', 'posted', 'failed', 'cancelled')),

  -- Post result
  platform_post_id TEXT, -- ID returned by platform after posting
  platform_post_url TEXT, -- Direct link to the post

  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TIMESTAMPTZ,

  -- Grouping (for posts created together from same video)
  batch_id UUID, -- Group posts from same upload session

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  posted_at TIMESTAMPTZ
);

-- Create drafts table for auto-save functionality
CREATE TABLE IF NOT EXISTS public.content_multiplier_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Draft content
  video_url TEXT,
  video_thumbnail_url TEXT,
  original_description TEXT,
  original_transcript TEXT,

  -- Selected platforms
  selected_platforms TEXT[] DEFAULT '{}',

  -- Generated content for each platform (before scheduling)
  platform_content JSONB DEFAULT '{}'::jsonb,
  -- Structure: {
  --   tiktok: { caption, hashtags, approved: boolean },
  --   instagram: { caption, hashtags, approved: boolean },
  --   ...
  -- }

  -- Current step in wizard
  current_step INTEGER DEFAULT 1, -- 1=Upload, 2=Review, 3=Schedule

  -- Auto-save metadata
  last_auto_save TIMESTAMPTZ DEFAULT NOW(),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for scheduled_posts
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_id ON public.scheduled_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_status ON public.scheduled_posts(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_scheduled_for ON public.scheduled_posts(scheduled_for);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_platform ON public.scheduled_posts(platform);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_batch_id ON public.scheduled_posts(batch_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_created_at ON public.scheduled_posts(created_at DESC);

-- Add indexes for drafts
CREATE INDEX IF NOT EXISTS idx_cm_drafts_user_id ON public.content_multiplier_drafts(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_drafts_updated_at ON public.content_multiplier_drafts(updated_at DESC);

-- Enable Row Level Security
ALTER TABLE public.scheduled_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_multiplier_drafts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for scheduled_posts
CREATE POLICY "Users can view own scheduled posts" ON public.scheduled_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scheduled posts" ON public.scheduled_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scheduled posts" ON public.scheduled_posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scheduled posts" ON public.scheduled_posts
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policy for background jobs
CREATE POLICY "Service role full access on scheduled_posts" ON public.scheduled_posts
  FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for drafts
CREATE POLICY "Users can view own drafts" ON public.content_multiplier_drafts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own drafts" ON public.content_multiplier_drafts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own drafts" ON public.content_multiplier_drafts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own drafts" ON public.content_multiplier_drafts
  FOR DELETE USING (auth.uid() = user_id);

-- Trigger for auto-updating updated_at timestamp
CREATE TRIGGER update_scheduled_posts_updated_at
  BEFORE UPDATE ON public.scheduled_posts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_cm_drafts_updated_at
  BEFORE UPDATE ON public.content_multiplier_drafts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.scheduled_posts IS 'Stores scheduled and posted social media content for Content Multiplier 2.0';
COMMENT ON TABLE public.content_multiplier_drafts IS 'Auto-saved drafts for Content Multiplier wizard workflow';

COMMENT ON COLUMN public.scheduled_posts.generated_content IS 'Platform-specific AI-generated content (caption, hashtags, etc.)';
COMMENT ON COLUMN public.scheduled_posts.batch_id IS 'Groups posts created together from the same video upload';
COMMENT ON COLUMN public.scheduled_posts.best_time_suggested IS 'AI-suggested optimal posting time for this platform';
