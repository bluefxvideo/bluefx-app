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

-- Seed data: top-performing TikTok ads across all niches
-- These are initial ads so the page isn't empty before the first cron run.
-- The cron job will upsert fresh ads on its regular schedule.
INSERT INTO winning_ads (tiktok_material_id, ad_title, brand_name, niche, industry_key, likes, comments, shares, ctr, cost_level, objective, video_duration, video_cover_url, video_url, video_width, video_height, landing_page, country_codes, keywords, clone_score, date_scraped, is_active) VALUES
-- Health & Supplements (5 ads)
('hs_7301000001', 'This ONE supplement changed my mornings forever', 'VitalBloom', 'Health & Supplements', 'label_29102000000', 342500, 8200, 21400, 0.0420, 2, 'product_sales', 22.5, NULL, NULL, 720, 1280, 'https://vitalbloom.com/morning-boost', '{US}', '{supplements,morning routine,energy,wellness}', 450542, NOW() - INTERVAL '2 days', true),
('hs_7301000002', 'Doctor reacts to this gut health trend', 'GutGenius', 'Health & Supplements', 'label_29102000000', 189000, 12400, 15600, 0.0350, 3, 'product_sales', 28.0, NULL, NULL, 720, 1280, 'https://gutgenius.co/probiotic', '{US}', '{gut health,probiotics,doctor,digestion}', 305035, NOW() - INTERVAL '3 days', true),
('hs_7301000003', 'I tried collagen for 30 days — here''s what happened', 'GlowWell', 'Health & Supplements', 'label_29103000000', 275000, 6800, 18200, 0.0510, 2, 'product_sales', 19.0, NULL, NULL, 720, 1280, 'https://glowwell.com/collagen', '{US}', '{collagen,skin,anti-aging,30 day challenge}', 387451, NOW() - INTERVAL '1 day', true),
('hs_7301000004', 'Why your multivitamin is doing NOTHING', 'NutriCore', 'Health & Supplements', 'label_29102000000', 156000, 9800, 11200, 0.0280, 2, 'conversion', 35.0, NULL, NULL, 720, 1280, 'https://nutricore.co/real-vitamins', '{US}', '{vitamins,nutrition,health hack}', 241728, NOW() - INTERVAL '5 days', true),
('hs_7301000005', 'The sleep hack no one talks about', 'DreamDeep', 'Health & Supplements', 'label_29103000000', 220000, 7500, 16800, 0.0390, 1, 'product_sales', 24.0, NULL, NULL, 720, 1280, 'https://dreamdeep.com/sleep', '{US}', '{sleep,melatonin,insomnia,health}', 327339, NOW() - INTERVAL '4 days', true),

-- Skincare & Beauty (5 ads)
('sb_7302000001', 'My dermatologist said STOP doing this', 'SkinScript', 'Skincare & Beauty', 'label_14103000000', 456000, 15200, 28900, 0.0580, 3, 'product_sales', 18.0, NULL, NULL, 720, 1280, 'https://skinscript.co/routine', '{US}', '{skincare,dermatologist,acne,routine}', 647458, NOW() - INTERVAL '1 day', true),
('sb_7302000002', 'Glass skin in 3 steps (not clickbait)', 'DewyLab', 'Skincare & Beauty', 'label_14104000000', 312000, 11800, 22500, 0.0470, 2, 'product_sales', 21.0, NULL, NULL, 720, 1280, 'https://dewylab.com/glass-skin', '{US}', '{glass skin,korean skincare,beauty,serum}', 459347, NOW() - INTERVAL '2 days', true),
('sb_7302000003', 'POV: you finally found the right sunscreen', 'ShieldGlow', 'Skincare & Beauty', 'label_14000000000', 198000, 6400, 14200, 0.0320, 2, 'product_sales', 15.0, NULL, NULL, 720, 1280, 'https://shieldglow.com/spf', '{US}', '{sunscreen,SPF,skincare,UV protection}', 289532, NOW() - INTERVAL '3 days', true),
('sb_7302000004', 'I replaced my entire routine with ONE product', 'SimpleSkin', 'Skincare & Beauty', 'label_14103000000', 267000, 8900, 19600, 0.0410, 2, 'product_sales', 25.0, NULL, NULL, 720, 1280, 'https://simpleskin.co/all-in-one', '{US}', '{minimalist skincare,simple routine,beauty}', 392541, NOW() - INTERVAL '2 days', true),
('sb_7302000005', 'The vitamin C serum that broke TikTok', 'RadiantC', 'Skincare & Beauty', 'label_14104000000', 385000, 13500, 24800, 0.0530, 3, 'product_sales', 17.0, NULL, NULL, 720, 1280, 'https://radiantc.com/serum', '{US}', '{vitamin C,serum,brightening,skincare}', 550853, NOW() - INTERVAL '1 day', true),

-- Food & Recipe (5 ads)
('fr_7303000001', 'This meal prep hack saves me $200/week', 'FreshBites', 'Food & Recipe', 'label_27100000000', 289000, 9600, 32100, 0.0390, 1, 'product_sales', 26.0, NULL, NULL, 720, 1280, 'https://freshbites.co/meal-prep', '{US}', '{meal prep,budget meals,cooking,healthy eating}', 479339, NOW() - INTERVAL '2 days', true),
('fr_7303000002', 'The protein pancake recipe that went viral', 'FitFuel Kitchen', 'Food & Recipe', 'label_27100000000', 178000, 5800, 21400, 0.0280, 1, 'conversion', 20.0, NULL, NULL, 720, 1280, 'https://fitfuelkitchen.com/pancakes', '{US}', '{protein,pancakes,fitness,recipe}', 286228, NOW() - INTERVAL '4 days', true),
('fr_7303000003', '5-minute dinners that taste like 5 hours', 'QuickChef', 'Food & Recipe', 'label_27104000000', 234000, 7200, 18900, 0.0350, 1, 'product_sales', 28.0, NULL, NULL, 720, 1280, 'https://quickchef.co/5-min-dinners', '{US}', '{quick dinner,easy recipe,cooking hack}', 351635, NOW() - INTERVAL '3 days', true),
('fr_7303000004', 'Stop buying protein bars — make these instead', 'SnackSmart', 'Food & Recipe', 'label_27100000000', 156000, 4800, 12900, 0.0310, 2, 'product_sales', 24.0, NULL, NULL, 720, 1280, 'https://snacksmart.co/bars', '{US}', '{protein bars,snacks,homemade,fitness}', 236131, NOW() - INTERVAL '5 days', true),
('fr_7303000005', 'The smoothie bowl that''s better than dessert', 'BlendBliss', 'Food & Recipe', 'label_27104000000', 201000, 6100, 15200, 0.0420, 2, 'product_sales', 19.0, NULL, NULL, 720, 1280, 'https://blendbliss.com/bowls', '{US}', '{smoothie bowl,healthy dessert,acai,breakfast}', 296642, NOW() - INTERVAL '2 days', true),

-- E-Commerce & Products (5 ads)
('ec_7304000001', 'TikTok made me buy it (and I don''t regret it)', 'TrendCart', 'E-Commerce & Products', 'label_30000000000', 412000, 14200, 35600, 0.0490, 3, 'product_sales', 16.0, NULL, NULL, 720, 1280, 'https://trendcart.co/viral', '{US}', '{tiktok made me buy it,viral products,shopping}', 632649, NOW() - INTERVAL '1 day', true),
('ec_7304000002', 'This kitchen gadget is a GAME CHANGER', 'SmartHome Plus', 'E-Commerce & Products', 'label_30102000000', 287000, 8900, 22100, 0.0370, 2, 'product_sales', 22.0, NULL, NULL, 720, 1280, 'https://smarthomeplus.com/gadget', '{US}', '{kitchen gadget,home,amazon finds,must have}', 408237, NOW() - INTERVAL '3 days', true),
('ec_7304000003', 'Why is everyone buying this phone case?', 'CaseCraft', 'E-Commerce & Products', 'label_30000000000', 198000, 7200, 16800, 0.0410, 1, 'product_sales', 14.0, NULL, NULL, 720, 1280, 'https://casecraft.co/viral-case', '{US}', '{phone case,tech accessories,viral,trending}', 305241, NOW() - INTERVAL '2 days', true),
('ec_7304000004', 'The desk organizer that fixed my productivity', 'DeskFlow', 'E-Commerce & Products', 'label_30102000000', 145000, 5600, 11200, 0.0290, 2, 'product_sales', 27.0, NULL, NULL, 720, 1280, 'https://deskflow.co/organizer', '{US}', '{desk setup,productivity,work from home,organizer}', 218629, NOW() - INTERVAL '4 days', true),
('ec_7304000005', 'Unboxing the #1 trending product on TikTok', 'ViralFinds', 'E-Commerce & Products', 'label_30000000000', 356000, 12600, 29400, 0.0560, 3, 'product_sales', 20.0, NULL, NULL, 720, 1280, 'https://viralfinds.co/trending', '{US}', '{unboxing,trending,viral,tiktok shop}', 547856, NOW() - INTERVAL '1 day', true),

-- Finance & Investing (5 ads)
('fi_7305000001', 'How I built a $10K/month passive income stream', 'WealthPath', 'Finance & Investing', 'label_13000000000', 267000, 11400, 19800, 0.0340, 3, 'conversion', 29.0, NULL, NULL, 720, 1280, 'https://wealthpath.co/passive-income', '{US}', '{passive income,investing,wealth,finance}', 401534, NOW() - INTERVAL '2 days', true),
('fi_7305000002', 'The 3 bank accounts everyone needs (seriously)', 'FinanceFlow', 'Finance & Investing', 'label_13000000000', 189000, 8200, 14500, 0.0290, 2, 'conversion', 33.0, NULL, NULL, 720, 1280, 'https://financeflow.com/accounts', '{US}', '{bank accounts,budgeting,personal finance,money}', 286789, NOW() - INTERVAL '3 days', true),
('fi_7305000003', 'I asked a millionaire for ONE money tip', 'MoneyMindset', 'Finance & Investing', 'label_13000000000', 345000, 15800, 28600, 0.0480, 3, 'conversion', 25.0, NULL, NULL, 720, 1280, 'https://moneymindset.co/tip', '{US}', '{millionaire,money tip,investing,financial freedom}', 537948, NOW() - INTERVAL '1 day', true),
('fi_7305000004', 'Stop saving money — do THIS instead', 'InvestSmart', 'Finance & Investing', 'label_13000000000', 212000, 9400, 17200, 0.0360, 2, 'conversion', 21.0, NULL, NULL, 720, 1280, 'https://investsmart.co/strategy', '{US}', '{investing,stocks,ETFs,financial advice}', 327536, NOW() - INTERVAL '4 days', true),
('fi_7305000005', 'The credit card trick banks don''t want you to know', 'CreditPro', 'Finance & Investing', 'label_13000000000', 278000, 12100, 21800, 0.0400, 2, 'conversion', 18.0, NULL, NULL, 720, 1280, 'https://creditpro.co/hack', '{US}', '{credit card,credit score,money hack,finance}', 422940, NOW() - INTERVAL '2 days', true),

-- Real Estate (5 ads)
('re_7306000001', 'How I bought my first house at 24 (step by step)', 'HomeStart', 'Real Estate', 'label_24100000000', 298000, 11200, 24500, 0.0370, 3, 'conversion', 32.0, NULL, NULL, 720, 1280, 'https://homestart.co/first-home', '{US}', '{first home,real estate,house buying,mortgage}', 456937, NOW() - INTERVAL '2 days', true),
('re_7306000002', 'The real estate side hustle no one is talking about', 'PropertyPro', 'Real Estate', 'label_24100000000', 187000, 7800, 13900, 0.0310, 2, 'conversion', 27.0, NULL, NULL, 720, 1280, 'https://propertypro.co/side-hustle', '{US}', '{real estate,side hustle,passive income,property}', 280931, NOW() - INTERVAL '3 days', true),
('re_7306000003', 'Why renting is NOT throwing money away', 'RentSmart', 'Real Estate', 'label_24100000000', 234000, 14600, 18200, 0.0290, 1, 'conversion', 24.0, NULL, NULL, 720, 1280, 'https://rentsmart.co/rent-vs-buy', '{US}', '{renting,real estate,housing,finance}', 370229, NOW() - INTERVAL '4 days', true),
('re_7306000004', 'House tour: I flipped this for $85K profit', 'FlipMaster', 'Real Estate', 'label_24100000000', 356000, 9800, 27600, 0.0450, 3, 'conversion', 26.0, NULL, NULL, 720, 1280, 'https://flipmaster.co/flip', '{US}', '{house flip,real estate investing,renovation,profit}', 532945, NOW() - INTERVAL '1 day', true),
('re_7306000005', 'First-time buyer mistakes that cost thousands', 'MortgageWise', 'Real Estate', 'label_24100000000', 167000, 8500, 12100, 0.0330, 2, 'conversion', 30.0, NULL, NULL, 720, 1280, 'https://mortgagewise.co/mistakes', '{US}', '{mortgage,first time buyer,home buying,tips}', 253833, NOW() - INTERVAL '5 days', true),

-- Apps & Software (5 ads)
('as_7307000001', 'This AI app does your homework in seconds', 'BrainBoost AI', 'Apps & Software', 'label_20000000000', 478000, 18200, 42100, 0.0620, 3, 'product_sales', 15.0, NULL, NULL, 720, 1280, 'https://brainboostai.com/download', '{US}', '{AI,homework,app,study,productivity}', 755862, NOW() - INTERVAL '1 day', true),
('as_7307000002', 'The budgeting app that actually works', 'PennyPlan', 'Apps & Software', 'label_20000000000', 234000, 7800, 18900, 0.0380, 2, 'product_sales', 22.0, NULL, NULL, 720, 1280, 'https://pennyplan.co/download', '{US}', '{budgeting app,personal finance,money,savings}', 339738, NOW() - INTERVAL '2 days', true),
('as_7307000003', 'I edited this entire video on my phone (free app)', 'EditPro', 'Apps & Software', 'label_20000000000', 312000, 10400, 25600, 0.0490, 2, 'product_sales', 19.0, NULL, NULL, 720, 1280, 'https://editpro.co/mobile', '{US}', '{video editing,free app,content creator,mobile editing}', 472249, NOW() - INTERVAL '1 day', true),
('as_7307000004', 'The sleep tracking app my doctor recommended', 'SleepScore', 'Apps & Software', 'label_20000000000', 178000, 6200, 13400, 0.0310, 1, 'product_sales', 25.0, NULL, NULL, 720, 1280, 'https://sleepscore.co/app', '{US}', '{sleep tracking,health app,wellness,sleep}', 264431, NOW() - INTERVAL '4 days', true),
('as_7307000005', 'Replace 5 apps with this ONE app', 'AllInOne', 'Apps & Software', 'label_20000000000', 256000, 9200, 20100, 0.0440, 2, 'product_sales', 17.0, NULL, NULL, 720, 1280, 'https://allinone.co/download', '{US}', '{productivity,all-in-one app,workflow,tools}', 384744, NOW() - INTERVAL '2 days', true),

-- Education & Courses (5 ads)
('ed_7308000001', 'How I learned to code in 30 days (no CS degree)', 'CodeLaunch', 'Education & Courses', 'label_10000000000', 367000, 14800, 31200, 0.0510, 3, 'conversion', 28.0, NULL, NULL, 720, 1280, 'https://codelaunch.co/30-days', '{US}', '{coding,learn to code,tech,career change}', 568451, NOW() - INTERVAL '1 day', true),
('ed_7308000002', 'The online course that got me a $120K job', 'SkillUp Academy', 'Education & Courses', 'label_10000000000', 245000, 11200, 22800, 0.0430, 3, 'conversion', 24.0, NULL, NULL, 720, 1280, 'https://skillupacademy.com/career', '{US}', '{online course,career,job,education}', 393343, NOW() - INTERVAL '2 days', true),
('ed_7308000003', 'Stop watching tutorials — do THIS instead', 'BuildLearn', 'Education & Courses', 'label_10000000000', 198000, 8600, 16400, 0.0350, 2, 'conversion', 21.0, NULL, NULL, 720, 1280, 'https://buildlearn.co/start', '{US}', '{learning,tutorials,coding,practice}', 307835, NOW() - INTERVAL '3 days', true),
('ed_7308000004', 'The freelancing course that paid for itself in a week', 'FreelanceHQ', 'Education & Courses', 'label_10000000000', 289000, 10400, 21900, 0.0470, 2, 'conversion', 26.0, NULL, NULL, 720, 1280, 'https://freelancehq.co/course', '{US}', '{freelancing,side hustle,online income,course}', 430247, NOW() - INTERVAL '2 days', true),
('ed_7308000005', 'Languages I learned using only free apps', 'LingoFast', 'Education & Courses', 'label_10000000000', 156000, 5400, 11800, 0.0290, 1, 'conversion', 19.0, NULL, NULL, 720, 1280, 'https://lingofast.co/free', '{US}', '{language learning,free apps,education,polyglot}', 232529, NOW() - INTERVAL '5 days', true),

-- Home & Living (5 ads)
('hl_7309000001', 'The $20 Amazon find that transformed my bathroom', 'HomeGlow', 'Home & Living', 'label_21000000000', 334000, 8900, 26700, 0.0410, 1, 'product_sales', 18.0, NULL, NULL, 720, 1280, 'https://homeglow.co/bathroom', '{US}', '{amazon finds,bathroom,home decor,transformation}', 501241, NOW() - INTERVAL '1 day', true),
('hl_7309000002', 'Small apartment hacks that make a HUGE difference', 'SpaceSaver', 'Home & Living', 'label_21000000000', 267000, 7600, 21400, 0.0360, 1, 'product_sales', 23.0, NULL, NULL, 720, 1280, 'https://spacesaver.co/hacks', '{US}', '{small apartment,space saving,home hacks,organization}', 386836, NOW() - INTERVAL '2 days', true),
('hl_7309000003', 'POV: your room after a $50 makeover', 'RoomRevive', 'Home & Living', 'label_21000000000', 198000, 6200, 15800, 0.0340, 1, 'product_sales', 20.0, NULL, NULL, 720, 1280, 'https://roomrevive.co/makeover', '{US}', '{room makeover,budget decor,aesthetic room,DIY}', 296340, NOW() - INTERVAL '3 days', true),
('hl_7309000004', 'The candle that made my whole house smell like a spa', 'AromaHaven', 'Home & Living', 'label_21000000000', 223000, 5800, 17100, 0.0390, 2, 'product_sales', 16.0, NULL, NULL, 720, 1280, 'https://aromahaven.co/spa-candle', '{US}', '{candle,home fragrance,spa,self care}', 330239, NOW() - INTERVAL '2 days', true),
('hl_7309000005', 'Cleaning hacks that will blow your mind', 'CleanFreak', 'Home & Living', 'label_21000000000', 289000, 9200, 23400, 0.0430, 1, 'product_sales', 22.0, NULL, NULL, 720, 1280, 'https://cleanfreak.co/hacks', '{US}', '{cleaning hacks,home,organization,satisfying}', 424643, NOW() - INTERVAL '3 days', true),

-- Fashion & Apparel (5 ads)
('fa_7310000001', 'Outfit check: $30 vs $300 — can you tell?', 'StyleDupe', 'Fashion & Apparel', 'label_22000000000', 389000, 14500, 29800, 0.0550, 2, 'product_sales', 17.0, NULL, NULL, 720, 1280, 'https://styledupe.co/outfits', '{US}', '{fashion,outfit,budget style,dupe,affordable}', 583855, NOW() - INTERVAL '1 day', true),
('fa_7310000002', 'The hoodie that''s going viral for a reason', 'CozyCloud', 'Fashion & Apparel', 'label_22000000000', 245000, 7800, 19200, 0.0380, 2, 'product_sales', 14.0, NULL, NULL, 720, 1280, 'https://cozycloud.co/hoodie', '{US}', '{hoodie,streetwear,viral,comfortable,fashion}', 365238, NOW() - INTERVAL '2 days', true),
('fa_7310000003', 'How to dress like a model on a student budget', 'BudgetChic', 'Fashion & Apparel', 'label_22000000000', 312000, 11200, 24500, 0.0460, 2, 'product_sales', 24.0, NULL, NULL, 720, 1280, 'https://budgetchic.co/style', '{US}', '{student fashion,budget style,model,outfit ideas}', 470246, NOW() - INTERVAL '2 days', true),
('fa_7310000004', 'The sneakers that sell out in minutes (restock alert)', 'KicksDrop', 'Fashion & Apparel', 'label_22000000000', 278000, 9800, 21600, 0.0400, 3, 'product_sales', 15.0, NULL, NULL, 720, 1280, 'https://kicksdrop.co/restock', '{US}', '{sneakers,restock,hype,kicks,streetwear}', 416240, NOW() - INTERVAL '3 days', true),
('fa_7310000005', 'Spring wardrobe essentials under $50 each', 'Capsule Co', 'Fashion & Apparel', 'label_22000000000', 198000, 6800, 14900, 0.0330, 1, 'product_sales', 21.0, NULL, NULL, 720, 1280, 'https://capsuleco.com/spring', '{US}', '{spring fashion,capsule wardrobe,essentials,affordable}', 294933, NOW() - INTERVAL '4 days', true)

ON CONFLICT (tiktok_material_id) DO NOTHING;
