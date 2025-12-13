-- Create activity_log table for tracking all tool usage across all users
-- Run this in Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tool_name text NOT NULL,
  action text DEFAULT 'visit',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can insert their own activity
CREATE POLICY "Users can insert own activity" ON activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can view their own activity
CREATE POLICY "Users can view own activity" ON activity_log
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all activity
CREATE POLICY "Admins can view all activity" ON activity_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_activity_log_user ON activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_tool ON activity_log(tool_name);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_log_date ON activity_log(DATE(created_at));
