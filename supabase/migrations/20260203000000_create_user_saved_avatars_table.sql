-- Create user_saved_avatars table for storing user-generated/saved avatar images
CREATE TABLE user_saved_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(100) NOT NULL,
  image_url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX idx_user_saved_avatars_user ON user_saved_avatars(user_id);

ALTER TABLE user_saved_avatars ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own avatars" ON user_saved_avatars
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own avatars" ON user_saved_avatars
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own avatars" ON user_saved_avatars
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own avatars" ON user_saved_avatars
  FOR DELETE USING (auth.uid() = user_id);
