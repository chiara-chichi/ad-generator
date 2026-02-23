-- ============================================================
-- Creatomate Integration Migration
-- Run after the original supabase-migration.sql
-- ============================================================

-- 1. Creatomate Template Registry
-- Stores metadata about each template designed in Creatomate's editor.
-- New templates are synced via POST /api/templates/sync — no code changes needed.
CREATE TABLE IF NOT EXISTS creatomate_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    creatomate_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT NOT NULL CHECK (category IN (
        'hero-product', 'lifestyle-overlay', 'split-layout',
        'bold-typography', 'grid', 'collage', 'promo', 'other'
    )),
    width INTEGER NOT NULL,
    height INTEGER NOT NULL,
    tags TEXT[] DEFAULT '{}',

    -- JSON describing each editable element in the template.
    -- Example:
    -- {
    --   "Headline": { "type": "text", "default": "Your Headline Here" },
    --   "Subheadline": { "type": "text", "default": "" },
    --   "CTA": { "type": "text", "default": "Shop Now" },
    --   "Product-Image": { "type": "image", "default": null },
    --   "Background-Color": { "type": "color", "property": "fill_color", "default": "#fffbec" }
    -- }
    editable_fields JSONB NOT NULL DEFAULT '{}',

    preview_url TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creatomate_templates_category
    ON creatomate_templates(category);
CREATE INDEX IF NOT EXISTS idx_creatomate_templates_tags
    ON creatomate_templates USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_creatomate_templates_active
    ON creatomate_templates(is_active);

ALTER TABLE creatomate_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all access to creatomate_templates"
    ON creatomate_templates FOR ALL USING (true) WITH CHECK (true);


-- 2. Extend generated_ads for Creatomate output
-- These columns are added alongside existing ones — backward compatible.
-- Existing HTML-based ads keep render_engine = 'html'.
ALTER TABLE generated_ads
    ADD COLUMN IF NOT EXISTS creatomate_template_id TEXT,
    ADD COLUMN IF NOT EXISTS creatomate_render_url TEXT,
    ADD COLUMN IF NOT EXISTS creatomate_modifications JSONB,
    ADD COLUMN IF NOT EXISTS render_engine TEXT DEFAULT 'html';
