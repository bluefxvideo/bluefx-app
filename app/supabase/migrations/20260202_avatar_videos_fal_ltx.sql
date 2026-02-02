-- Add columns to avatar_videos table for fal.ai LTX Audio-to-Video integration
-- Run this in Supabase Dashboard SQL Editor

-- Add new columns for fal.ai LTX integration
ALTER TABLE avatar_videos
ADD COLUMN IF NOT EXISTS fal_request_id TEXT,
ADD COLUMN IF NOT EXISTS video_source TEXT DEFAULT 'hedra',
ADD COLUMN IF NOT EXISTS resolution_width INTEGER,
ADD COLUMN IF NOT EXISTS resolution_height INTEGER,
ADD COLUMN IF NOT EXISTS audio_duration_seconds DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS action_prompt TEXT;

-- Add index for fal_request_id lookups (used by webhook handler)
CREATE INDEX IF NOT EXISTS idx_avatar_videos_fal_request_id
ON avatar_videos(fal_request_id) WHERE fal_request_id IS NOT NULL;

-- Mark existing records as hedra source
UPDATE avatar_videos SET video_source = 'hedra' WHERE video_source IS NULL;

-- Add comment explaining video_source values
COMMENT ON COLUMN avatar_videos.video_source IS 'Video generation provider: hedra (legacy) or fal-ltx (new)';
COMMENT ON COLUMN avatar_videos.fal_request_id IS 'fal.ai queue request ID for LTX Audio-to-Video generations';
COMMENT ON COLUMN avatar_videos.action_prompt IS 'Optional prompt describing visual style and movements for LTX generation';
COMMENT ON COLUMN avatar_videos.audio_duration_seconds IS 'Duration of input audio in seconds (max 60 for fal.ai LTX)';
