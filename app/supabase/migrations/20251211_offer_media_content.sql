-- Migration: Add media content fields to affiliate_toolkit_offers
-- Date: 2025-12-11
-- Purpose: Support video/audio uploads and YouTube transcripts for offers

-- Add new columns to affiliate_toolkit_offers table
ALTER TABLE affiliate_toolkit_offers
ADD COLUMN IF NOT EXISTS media_files jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS youtube_transcripts jsonb DEFAULT '[]',
ADD COLUMN IF NOT EXISTS aggregated_content text;

-- Add comment explaining the columns
COMMENT ON COLUMN affiliate_toolkit_offers.media_files IS 'Array of uploaded media files with transcriptions: [{id, name, url, type, transcript, word_count, created_at}]';
COMMENT ON COLUMN affiliate_toolkit_offers.youtube_transcripts IS 'Array of YouTube URLs with transcriptions: [{id, url, title, transcript, word_count, created_at}]';
COMMENT ON COLUMN affiliate_toolkit_offers.aggregated_content IS 'Combined content from offer_content, media transcriptions, and YouTube transcripts';

-- Create index for faster queries on offers with content
CREATE INDEX IF NOT EXISTS idx_offers_has_content ON affiliate_toolkit_offers ((aggregated_content IS NOT NULL));
