-- Migration: 20251126_video_swap_jobs.sql
-- Video Swap App - Wan 2.2 Animate Replace
-- App #13 in BlueFX collection

-- Create video_swap_jobs table
CREATE TABLE IF NOT EXISTS public.video_swap_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input data
  source_video_url TEXT NOT NULL,
  character_image_url TEXT NOT NULL,

  -- Processing settings
  resolution TEXT DEFAULT '720' CHECK (resolution IN ('480', '720')),
  frames_per_second INTEGER DEFAULT 24 CHECK (frames_per_second >= 5 AND frames_per_second <= 60),
  merge_audio BOOLEAN DEFAULT true,
  go_fast BOOLEAN DEFAULT true,
  refert_num INTEGER DEFAULT 1 CHECK (refert_num IN (1, 5)),
  seed INTEGER,

  -- Status tracking
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'uploading', 'processing', 'completed', 'failed')),
  progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),

  -- Output data
  result_video_url TEXT,
  thumbnail_url TEXT,
  duration_seconds NUMERIC,

  -- External tracking
  external_job_id TEXT,
  processing_provider TEXT DEFAULT 'replicate',

  -- Error handling
  error_message TEXT,

  -- Credits
  credits_used INTEGER DEFAULT 0,

  -- Metadata
  metadata JSONB DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_video_swap_jobs_user_id ON public.video_swap_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_swap_jobs_status ON public.video_swap_jobs(status);
CREATE INDEX IF NOT EXISTS idx_video_swap_jobs_created_at ON public.video_swap_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_video_swap_jobs_external_job_id ON public.video_swap_jobs(external_job_id);

-- Enable Row Level Security
ALTER TABLE public.video_swap_jobs ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own video swap jobs
CREATE POLICY "Users can view own video swap jobs" ON public.video_swap_jobs
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own video swap jobs" ON public.video_swap_jobs
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own video swap jobs" ON public.video_swap_jobs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own video swap jobs" ON public.video_swap_jobs
  FOR DELETE USING (auth.uid() = user_id);

-- Service role policy for webhooks (service role bypasses RLS by default, but explicit policy for clarity)
CREATE POLICY "Service role full access on video_swap_jobs" ON public.video_swap_jobs
  FOR ALL USING (auth.role() = 'service_role');

-- Trigger for auto-updating updated_at timestamp
CREATE TRIGGER update_video_swap_jobs_updated_at
  BEFORE UPDATE ON public.video_swap_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.video_swap_jobs IS 'Stores video swap jobs using Wan 2.2 Animate Replace model - App #13';
