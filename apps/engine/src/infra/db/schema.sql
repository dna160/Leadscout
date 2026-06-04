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
  error TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at TIMESTAMPTZ
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
  source_run_id UUID REFERENCES scrape_runs(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
