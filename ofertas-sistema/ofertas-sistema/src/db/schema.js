export const SQLITE_SCHEMA = `
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
  price REAL,
  previous_price REAL,
  discount_percent INTEGER DEFAULT 0,
  currency TEXT DEFAULT 'BRL',
  store TEXT DEFAULT '',
  category TEXT DEFAULT 'Outros',
  product_url TEXT DEFAULT '',
  affiliate_url TEXT DEFAULT '',
  rating REAL,
  sales INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  featured INTEGER DEFAULT 0,
  sponsored INTEGER DEFAULT 0,
  ai_confidence REAL,
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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  offer_id TEXT NOT NULL,
  field TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_history_offer ON offer_history(offer_id);

CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,
  level TEXT DEFAULT 'info',
  message TEXT,
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_events_created ON events(created_at);
`;

export const POSTGRES_SCHEMA = `
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
`;

export const DEFAULT_CATEGORIES = [
  { id: 'eletronicos', name: 'Eletronicos', keywords: 'tv,smart tv,televisao,caixa de som,soundbar,headset,echo,pulseira,relogio inteligente', sort_order: 1 },
  { id: 'celulares', name: 'Celulares', keywords: 'celular,smartphone,iphone,galaxy,moto,redmi,poco,xiaomi,capinha,película,pelicula,carregador', sort_order: 2 },
  { id: 'informatica', name: 'Informatica', keywords: 'notebook,laptop,pc,computador,monitor,teclado,mouse,ssd,hd,memoria ram,placa de video,impressora,tablet', sort_order: 3 },
  { id: 'casa', name: 'Casa', keywords: 'air fryer,panela,cafeteira,liquidificador,aspirador,ventilador,geladeira,microondas,jogo de lençol,cozinha', sort_order: 4 },
  { id: 'games', name: 'Games', keywords: 'console,playstation,xbox,nintendo,controle,jogo,game,ps5,switch,cadeira gamer', sort_order: 5 },
  { id: 'moda', name: 'Moda', keywords: 'camisa,camiseta,tenis,tênis,calca,calça,vestido,jaqueta,bolsa,relogio,bone,boné,sapato', sort_order: 6 },
  { id: 'beleza', name: 'Beleza', keywords: 'perfume,creme,shampoo,maquiagem,batom,hidratante,skincare,protetor solar,cabelo', sort_order: 7 },
  { id: 'outros', name: 'Outros', keywords: '', sort_order: 99 },
];

export const DEFAULT_SETTINGS = {
  minDiscount: '20',
  requireLink: 'true',
  requirePrice: 'true',
  requireImage: 'false',
  blockedKeywords: '',
  allowedCategories: '',
  expireMissing: 'true',
  ttlHours: '72',
  publishMode: 'auto',
  maxPerRun: '60',
  intervalMinutes: '15',
  aiEnabled: 'false',
};
