-- Create saved scripts table for Affiliate Toolkit
-- Run this in Supabase Dashboard SQL Editor

CREATE TABLE IF NOT EXISTS affiliate_toolkit_saved_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  offer_id uuid REFERENCES affiliate_toolkit_offers(id) ON DELETE SET NULL,
  offer_name text NOT NULL,
  script_type text NOT NULL,
  content text NOT NULL,
  custom_angle text,
  custom_prompt text,
  is_favorite boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE affiliate_toolkit_saved_scripts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own scripts" ON affiliate_toolkit_saved_scripts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own scripts" ON affiliate_toolkit_saved_scripts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scripts" ON affiliate_toolkit_saved_scripts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scripts" ON affiliate_toolkit_saved_scripts
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_scripts_user ON affiliate_toolkit_saved_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_scripts_offer ON affiliate_toolkit_saved_scripts(offer_id);
CREATE INDEX IF NOT EXISTS idx_saved_scripts_type ON affiliate_toolkit_saved_scripts(script_type);
CREATE INDEX IF NOT EXISTS idx_saved_scripts_created ON affiliate_toolkit_saved_scripts(created_at DESC);
