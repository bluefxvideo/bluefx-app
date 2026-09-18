-- Migration: video_roughcut_jobs
-- Rough-Cut Editor tool (app #14 in BlueFX)
-- Users upload a video; the browser extracts audio with ffmpeg.wasm and sends only
-- the MP3 to the worker. The worker runs Deepgram + Claude Opus 4.6 and writes
-- FCP 7 XML to Supabase Storage. Premiere's "locate media" flow reconnects the
-- XML to the user's original video on disk.

-- ============================================================================
-- Main jobs table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.video_roughcut_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Input
  video_filename TEXT NOT NULL,              -- original filename, used as XML pathurl
  audio_url TEXT,                            -- signed Supabase URL to extracted MP3
  audio_hash TEXT,                           -- SHA-256 of MP3 bytes (cache key)
  video_width INTEGER,
  video_height INTEGER,
  video_duration_seconds REAL,
  video_frame_rate REAL,

  -- Status
  status TEXT NOT NULL DEFAULT 'uploading'
    CHECK (status IN ('uploading', 'validating', 'queued', 'transcribing', 'analyzing', 'generating', 'done', 'failed')),
  status_reason TEXT,                        -- failure details / validation rejection reason
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),

  -- Output (populated on 'done')
  xml_url TEXT,
  transcript_json_url TEXT,
  removals JSONB,                            -- array of {start, end, text, reason} for UI "what was cut"
  segments_removed INTEGER,
  time_saved_seconds INTEGER,

  -- Accounting
  credits_used INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS video_roughcut_jobs_user_id_idx
  ON public.video_roughcut_jobs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS video_roughcut_jobs_status_idx
  ON public.video_roughcut_jobs(status)
  WHERE status NOT IN ('done', 'failed');

-- Auto-update updated_at on any change
CREATE OR REPLACE FUNCTION public.set_video_roughcut_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_video_roughcut_jobs_updated_at ON public.video_roughcut_jobs;
CREATE TRIGGER trg_video_roughcut_jobs_updated_at
  BEFORE UPDATE ON public.video_roughcut_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_video_roughcut_jobs_updated_at();

-- Row Level Security
ALTER TABLE public.video_roughcut_jobs ENABLE ROW LEVEL SECURITY;

-- Users can read their own jobs
CREATE POLICY "Users can view own roughcut jobs"
  ON public.video_roughcut_jobs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything (used by server actions and worker callbacks)
CREATE POLICY "Service role has full access to roughcut jobs"
  ON public.video_roughcut_jobs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Transcription cache (keyed on SHA-256 of audio bytes)
-- If the same audio is uploaded twice, we reuse the Deepgram result.
-- This makes re-runs and Phase 2 manual-review regenerations free of Deepgram cost.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transcription_cache (
  audio_hash TEXT PRIMARY KEY,
  transcription_json_url TEXT NOT NULL,
  silences_json_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS transcription_cache_last_used_idx
  ON public.transcription_cache(last_used_at);

-- Only service role can touch the cache
ALTER TABLE public.transcription_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages transcription cache"
  ON public.transcription_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- Storage bucket for audio inputs + XML outputs + transcription cache
-- Structure:
--   video-roughcut/audio/{user_id}/{job_id}.mp3     (auto-cleaned after 7 days)
--   video-roughcut/outputs/{user_id}/{job_id}/roughcut.xml
--   video-roughcut/outputs/{user_id}/{job_id}/transcript.json
--   video-roughcut/transcription-cache/{audio_hash}-transcript.json
--   video-roughcut/transcription-cache/{audio_hash}-silences.json
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'video-roughcut',
  'video-roughcut',
  true,                     -- public reads (XML downloads use public URLs)
  104857600,                -- 100MB limit (plenty for 60-min MP3 at 64kbps)
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-m4a', 'application/xml', 'text/xml', 'application/json']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS: users can upload to their own folder in audio/
CREATE POLICY "Users can upload own audio to video-roughcut bucket"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'video-roughcut'
    AND (storage.foldername(name))[1] = 'audio'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Users can read own audio from video-roughcut bucket"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'video-roughcut'
    AND (
      -- Own audio files
      ((storage.foldername(name))[1] = 'audio' AND (storage.foldername(name))[2] = auth.uid()::text)
      -- Or outputs (XML, transcript)
      OR ((storage.foldername(name))[1] = 'outputs' AND (storage.foldername(name))[2] = auth.uid()::text)
    )
  );

CREATE POLICY "Public can read video-roughcut outputs"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'video-roughcut');

COMMENT ON TABLE public.video_roughcut_jobs IS
  'Rough-cut editor jobs. Browser extracts audio via ffmpeg.wasm; worker does Deepgram + Claude + FCP XML.';
COMMENT ON TABLE public.transcription_cache IS
  'Hash-based cache of Deepgram transcriptions. Keyed on SHA-256 of the MP3 bytes.';
