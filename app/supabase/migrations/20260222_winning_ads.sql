-- Create winning_ads table for storing top-performing TikTok ads
CREATE TABLE IF NOT EXISTS winning_ads (
    id SERIAL PRIMARY KEY,
    tiktok_material_id VARCHAR(50) UNIQUE NOT NULL,
    ad_title TEXT,
    brand_name VARCHAR(255),
    niche VARCHAR(100) NOT NULL,
    industry_key VARCHAR(100),
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    ctr DECIMAL(5,4) DEFAULT 0,
    cost_level INTEGER,
    objective VARCHAR(100),
    video_duration DECIMAL(8,3),
    video_cover_url TEXT,
    video_url TEXT,
    video_width INTEGER,
    video_height INTEGER,
    landing_page TEXT,
    country_codes TEXT[] DEFAULT '{}',
    keywords TEXT[] DEFAULT '{}',
    clone_score INTEGER DEFAULT 0,
    date_scraped TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_winning_ads_niche ON winning_ads(niche);
CREATE INDEX IF NOT EXISTS idx_winning_ads_clone_score ON winning_ads(clone_score DESC);
CREATE INDEX IF NOT EXISTS idx_winning_ads_active ON winning_ads(is_active);
CREATE INDEX IF NOT EXISTS idx_winning_ads_material_id ON winning_ads(tiktok_material_id);
