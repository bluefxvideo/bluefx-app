-- Add render_id column to reelestate_listings for Remotion async render tracking
ALTER TABLE reelestate_listings
  ADD COLUMN IF NOT EXISTS render_id TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN reelestate_listings.render_id IS 'Remotion async render ID for polling progress';
