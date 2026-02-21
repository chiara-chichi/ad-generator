-- ChiChi Ad Generator Database Migration
-- Run this in your Supabase SQL editor

-- Brand Assets table
CREATE TABLE IF NOT EXISTS brand_assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    category TEXT NOT NULL CHECK (category IN (
        'logo', 'product_photo', 'lifestyle', 'packaging', 'mascot', 'background', 'other'
    )),
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    public_url TEXT NOT NULL,
    mime_type TEXT,
    tags TEXT[],
    sku TEXT,
    flavor TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_brand_assets_category ON brand_assets(category);
CREATE INDEX IF NOT EXISTS idx_brand_assets_is_active ON brand_assets(is_active);

-- Generated Ads table
CREATE TABLE IF NOT EXISTS generated_ads (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    ad_size TEXT NOT NULL DEFAULT '1080x1080',
    template_id TEXT,
    headline TEXT,
    subheadline TEXT,
    body_copy TEXT,
    cta_text TEXT,
    reference_image_url TEXT,
    reference_analysis JSONB,
    selected_assets JSONB,
    template_vars JSONB,
    output_image_url TEXT,
    output_storage_path TEXT,
    flavor TEXT,
    sku TEXT,
    channel TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_ads_channel ON generated_ads(channel);

-- RLS policies (permissive for now)
ALTER TABLE brand_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_ads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to brand_assets" ON brand_assets
    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to generated_ads" ON generated_ads
    FOR ALL USING (true) WITH CHECK (true);

-- Storage buckets (create these manually in Supabase dashboard):
-- 1. brand-assets (public)
-- 2. generated-ads (public)
