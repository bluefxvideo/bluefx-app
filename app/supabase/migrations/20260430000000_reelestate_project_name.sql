-- Add user-given project name to reelestate_listings
-- Falls back to listing_data->>'address' or 'Untitled Project' when null

ALTER TABLE reelestate_listings
  ADD COLUMN IF NOT EXISTS name TEXT;

COMMENT ON COLUMN reelestate_listings.name IS 'User-given project name. NULL for legacy rows; UI falls back to listing_data->>address or "Untitled".';

-- Backfill existing rows: use address if available, else "Manual Upload"
UPDATE reelestate_listings
SET name = COALESCE(listing_data->>'address', 'Manual Upload')
WHERE name IS NULL;
