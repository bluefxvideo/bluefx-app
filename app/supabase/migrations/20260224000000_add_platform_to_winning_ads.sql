-- Add platform column to winning_ads to support multiple ad platforms (tiktok, facebook)
ALTER TABLE winning_ads ADD COLUMN IF NOT EXISTS platform VARCHAR(20) NOT NULL DEFAULT 'tiktok';

-- Replace single-column unique constraint with composite so TikTok/Facebook IDs can't collide
ALTER TABLE winning_ads DROP CONSTRAINT IF EXISTS winning_ads_tiktok_material_id_key;

DO $$ BEGIN
  ALTER TABLE winning_ads ADD CONSTRAINT winning_ads_platform_material_id_key
    UNIQUE (platform, tiktok_material_id);
EXCEPTION WHEN duplicate_table THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_winning_ads_platform ON winning_ads(platform);
