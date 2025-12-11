-- Migration: Restructure for Business Tools (Library + User Business)
-- Date: 2025-12-11
-- Purpose: Rename affiliate_toolkit_offers to affiliate_product_library and create user_business_offers

-- Step 1: Rename existing table to affiliate_product_library
ALTER TABLE affiliate_toolkit_offers RENAME TO affiliate_product_library;

-- Step 2: Add display_order column for admin reordering
ALTER TABLE affiliate_product_library
ADD COLUMN IF NOT EXISTS display_order integer DEFAULT 0;

-- Step 3: Create user_business_offers table for user's own products
CREATE TABLE IF NOT EXISTS user_business_offers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  niche text,
  offer_content text,
  media_files jsonb DEFAULT '[]',
  youtube_transcripts jsonb DEFAULT '[]',
  aggregated_content text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Step 4: Create indexes
CREATE INDEX IF NOT EXISTS idx_user_business_offers_user_id ON user_business_offers(user_id);
CREATE INDEX IF NOT EXISTS idx_affiliate_product_library_display_order ON affiliate_product_library(display_order);

-- Step 5: Enable RLS on user_business_offers
ALTER TABLE user_business_offers ENABLE ROW LEVEL SECURITY;

-- Step 6: RLS policies for user_business_offers (users can only access their own)
CREATE POLICY "Users can view their own business offers" ON user_business_offers
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own business offers" ON user_business_offers
FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own business offers" ON user_business_offers
FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own business offers" ON user_business_offers
FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- Step 7: RLS policies for affiliate_product_library (everyone can read, admin can write)
-- Keep existing policies or update them
-- All authenticated users can read the library
CREATE POLICY "Anyone can view library products" ON affiliate_product_library
FOR SELECT TO authenticated
USING (true);

-- Add comments
COMMENT ON TABLE affiliate_product_library IS 'Pre-trained affiliate products managed by admin';
COMMENT ON TABLE user_business_offers IS 'User-created business/product offers for content generation';
COMMENT ON COLUMN affiliate_product_library.display_order IS 'Order for display in the library (lower = first)';
