CREATE TABLE IF NOT EXISTS keyword_sets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment TEXT NOT NULL,
  label TEXT NOT NULL,
  keywords JSONB NOT NULL DEFAULT '[]',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS target_cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  query TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS scrape_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL,
  mode TEXT NOT NULL,
  apify_run_id TEXT,
  queries JSONB,
  cities JSONB,
  places_found INTEGER DEFAULT 0,
  new_leads INTEGER DEFAULT 0,
  estimated_cost NUMERIC(10,4),
  actual_cost NUMERIC(10,4),
  enrichment BOOLEAN NOT NULL DEFAULT false,
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS filter_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,   -- 'category_block' | 'name_block' | 'price_min' | 'rating_min' | 'reviews_min'
  value TEXT NOT NULL,  -- for block rules: the string; for floor rules: the number as text
  action TEXT NOT NULL DEFAULT 'block',  -- 'block' or 'min'
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  place_key TEXT UNIQUE NOT NULL,
  place_id TEXT,
  name TEXT NOT NULL,
  category TEXT,
  segment TEXT,
  matched_keyword TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  whatsapp TEXT,
  website TEXT,
  email TEXT,
  instagram TEXT,
  maps_url TEXT,
  rating NUMERIC(3,1),
  reviews INTEGER,
  price_level INTEGER,
  status TEXT NOT NULL DEFAULT 'active',
  reject_layer TEXT,
  reject_reason TEXT,
  triage_verdict TEXT,
  matched_keywords JSONB NOT NULL DEFAULT '[]',
  first_seen_run UUID REFERENCES scrape_runs(id),
  last_seen_run UUID REFERENCES scrape_runs(id),
  source_run_id UUID REFERENCES scrape_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
