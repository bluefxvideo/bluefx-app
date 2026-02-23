-- Add has_video generated column to winning_ads for efficient video-first sorting
ALTER TABLE winning_ads
  ADD COLUMN IF NOT EXISTS has_video BOOLEAN GENERATED ALWAYS AS (video_url IS NOT NULL) STORED;

CREATE INDEX IF NOT EXISTS idx_winning_ads_has_video_score
  ON winning_ads (platform, has_video DESC, clone_score DESC)
  WHERE is_active = true;
