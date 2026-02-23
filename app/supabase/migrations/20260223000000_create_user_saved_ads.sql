-- Create user_saved_ads table for bookmarking winning ads
CREATE TABLE IF NOT EXISTS user_saved_ads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  winning_ad_id INTEGER REFERENCES winning_ads(id) ON DELETE CASCADE NOT NULL,
  tiktok_material_id TEXT NOT NULL,
  saved_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, winning_ad_id)
);

CREATE INDEX IF NOT EXISTS idx_user_saved_ads_user_id ON user_saved_ads(user_id);

ALTER TABLE user_saved_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own saved ads" ON user_saved_ads
  FOR ALL USING (auth.uid() = user_id);
