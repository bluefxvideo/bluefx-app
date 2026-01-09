-- Create ad_projects table for Ad Cloner / Video Production Pipeline
-- This table connects all tools in the workflow: Video Analyzer → Script Generator → Cinematographer → Video Editor
-- Date: 2026-01-09

CREATE TABLE IF NOT EXISTS ad_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,

  -- Project metadata
  name text NOT NULL DEFAULT 'Untitled Project',
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scripting', 'storyboard', 'frames', 'animation', 'voiceover', 'completed')),

  -- Source (where did this project originate?)
  source_type text CHECK (source_type IN ('video_analyzer', 'script_generator', 'manual')),
  source_video_analysis_id uuid REFERENCES video_analyses(id) ON DELETE SET NULL,
  source_script_id uuid REFERENCES affiliate_toolkit_saved_scripts(id) ON DELETE SET NULL,

  -- Business/Product reference
  offer_id uuid, -- Can reference user_business_offers or affiliate_product_library
  offer_type text CHECK (offer_type IN ('user_business', 'affiliate_library')),

  -- Script data (from Script Generator or transformed from Video Analyzer)
  script_content text,
  script_approved boolean DEFAULT false,

  -- Storyboard data
  storyboard_prompt text,
  storyboard_style text DEFAULT 'cinematic_realism',
  reference_images jsonb DEFAULT '[]', -- Array of image URLs
  grid_config jsonb DEFAULT '{"columns": 4, "rows": 4, "aspect_ratio": "16:9"}',

  -- Generated assets
  grid_image_url text,
  extracted_frames jsonb DEFAULT '[]', -- Array of {frame_number, image_url, upscaled_url}

  -- Animation data
  animated_clips jsonb DEFAULT '[]', -- Array of {frame_number, video_url, motion_prompt}

  -- Voiceover data
  voiceover_segments jsonb DEFAULT '[]', -- Array of {text, audio_url, duration}

  -- Timeline/Edit data (for Remotion)
  timeline_data jsonb, -- Full timeline state for the editor

  -- Export
  final_video_url text,

  -- Timestamps
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE ad_projects ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own projects" ON ad_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own projects" ON ad_projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own projects" ON ad_projects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own projects" ON ad_projects
  FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ad_projects_user ON ad_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_projects_status ON ad_projects(user_id, status);
CREATE INDEX IF NOT EXISTS idx_ad_projects_created ON ad_projects(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_projects_source_video ON ad_projects(source_video_analysis_id) WHERE source_video_analysis_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ad_projects_source_script ON ad_projects(source_script_id) WHERE source_script_id IS NOT NULL;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ad_projects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ad_projects_updated_at
  BEFORE UPDATE ON ad_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_ad_projects_updated_at();

-- Comments
COMMENT ON TABLE ad_projects IS 'Video production projects that flow through the Ad Cloner pipeline';
COMMENT ON COLUMN ad_projects.status IS 'Current stage: draft → scripting → storyboard → frames → animation → voiceover → completed';
COMMENT ON COLUMN ad_projects.grid_config IS 'Configuration for storyboard grid generation (columns, rows, aspect_ratio)';
COMMENT ON COLUMN ad_projects.extracted_frames IS 'Array of extracted frames with original and upscaled URLs';
COMMENT ON COLUMN ad_projects.animated_clips IS 'Array of animated video clips generated from frames';
