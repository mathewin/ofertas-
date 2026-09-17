-- Schema para Supabase / Postgres. Execute no SQL Editor do Supabase se preferir criar as tabelas manualmente.


CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  keywords TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  enabled INTEGER DEFAULT 1,
  last_run_at TEXT,
  last_status TEXT,
  last_error TEXT,
  items_last_run INTEGER DEFAULT 0,
  total_items INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  external_id TEXT NOT NULL,
  fingerprint TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  image_url TEXT DEFAULT '',
  price DOUBLE PRECISION,
  previous_price DOUBLE PRECISION,
  discount_percent INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  store TEXT DEFAULT '',
  category TEXT DEFAULT 'Outros',
  product_url TEXT DEFAULT '',
  affiliate_url TEXT DEFAULT '',
  rating DOUBLE PRECISION,
  sales INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  featured INTEGER DEFAULT 0,
  sponsored INTEGER DEFAULT 0,
  ai_confidence DOUBLE PRECISION,
  search_text TEXT DEFAULT '',
  raw TEXT DEFAULT '',
  captured_at TEXT,
  last_seen_at TEXT,
  published_at TEXT,
  expires_at TEXT,
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_offers_status ON offers(status);
CREATE INDEX IF NOT EXISTS idx_offers_category ON offers(category);
CREATE INDEX IF NOT EXISTS idx_offers_source ON offers(source);
CREATE INDEX IF NOT EXISTS idx_offers_last_seen ON offers(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_offers_search ON offers(search_text);

CREATE TABLE IF NOT EXISTS offer_history (
  id BIGSERIAL PRIMARY KEY,
  offer_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_offer ON offer_history(offer_id);

CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  source TEXT,
  level TEXT DEFAULT 'info',
  message TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
