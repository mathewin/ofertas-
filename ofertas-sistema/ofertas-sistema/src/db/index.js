import config from '../config.js';
import { uuid } from '../lib/util.js';
import {
  SQLITE_SCHEMA,
  POSTGRES_SCHEMA,
  DEFAULT_CATEGORIES,
  DEFAULT_SETTINGS,
} from './schema.js';
import { createSqliteDriver } from './drivers/sqlite.js';
import { createPostgresDriver } from './drivers/postgres.js';

let driver = null;

export function getDriver() {
  if (!driver) throw new Error('Banco de dados nao inicializado. Chame initDb() primeiro.');
  return driver;
}

function createDriver() {
  if (config.db.driver === 'postgres' || config.db.driver === 'supabase') {
    return createPostgresDriver(config.db.databaseUrl);
  }
  return createSqliteDriver(config.db.sqlitePath);
}

export async function initDb() {
  if (driver) return driver;
  driver = createDriver();
  await migrate();
  await seed();
  return driver;
}

export async function migrate() {
  const schema = driver.dialect === 'postgres' ? POSTGRES_SCHEMA : SQLITE_SCHEMA;
  await driver.exec(schema);
}

export async function seed() {
  const now = new Date().toISOString();

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await driver.execute(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING',
      [key, value],
    );
  }

  for (const category of DEFAULT_CATEGORIES) {
    await driver.execute(
      `INSERT INTO categories (id, name, keywords, enabled, sort_order)
       VALUES (?, ?, ?, 1, ?) ON CONFLICT(id) DO NOTHING`,
      [category.id, category.name, category.keywords || '', category.sort_order ?? 0],
    );
  }

  const sourceRows = [
    { id: 'demo', name: 'Demonstracao', enabled: config.sources.demo.enabled ? 1 : 0 },
    { id: 'shopee', name: 'Shopee', enabled: config.sources.shopee.enabled ? 1 : 0 },
    { id: 'tiktok', name: 'TikTok Shop', enabled: config.sources.tiktok.enabled ? 1 : 0 },
  ];

  for (const source of sourceRows) {
    await driver.execute(
      `INSERT INTO sources (id, name, enabled, last_status)
       VALUES (?, ?, ?, 'idle') ON CONFLICT(id) DO NOTHING`,
      [source.id, source.name, source.enabled],
    );
  }

  await driver.execute(
    'INSERT INTO events (source, level, message, created_at) VALUES (?, ?, ?, ?)',
    ['system', 'info', 'Sistema inicializado', now],
  );
}

// ---------------------------------------------------------------- settings
export async function getSettings() {
  const rows = await driver.query('SELECT key, value FROM settings');
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}

export async function getSetting(key, fallback = null) {
  const rows = await driver.query('SELECT value FROM settings WHERE key = ?', [key]);
  return rows[0]?.value ?? fallback;
}

export async function setSetting(key, value) {
  await driver.execute(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, String(value ?? '')],
  );
}

export async function setSettings(entries) {
  for (const [key, value] of Object.entries(entries)) {
    await setSetting(key, value);
  }
}

// -------------------------------------------------------------- categories
export async function listCategories(onlyEnabled = false) {
  const sql = onlyEnabled
    ? 'SELECT * FROM categories WHERE enabled = 1 ORDER BY sort_order ASC, name ASC'
    : 'SELECT * FROM categories ORDER BY sort_order ASC, name ASC';
  return driver.query(sql);
}

export async function getCategory(id) {
  const rows = await driver.query('SELECT * FROM categories WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function upsertCategory(category) {
  const id = category.id || uuid();
  await driver.execute(
    `INSERT INTO categories (id, name, keywords, enabled, sort_order)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       keywords = excluded.keywords,
       enabled = excluded.enabled,
       sort_order = excluded.sort_order`,
    [
      id,
      category.name,
      category.keywords || '',
      category.enabled === undefined ? 1 : Number(Boolean(category.enabled)),
      category.sort_order ?? 0,
    ],
  );
  return getCategory(id);
}

// ----------------------------------------------------------------- sources
export async function listSources() {
  return driver.query('SELECT * FROM sources ORDER BY id ASC');
}

export async function getSource(id) {
  const rows = await driver.query('SELECT * FROM sources WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function setSourceEnabled(id, enabled) {
  await driver.execute('UPDATE sources SET enabled = ? WHERE id = ?', [Number(Boolean(enabled)), id]);
  return getSource(id);
}

export async function recordSourceRun(id, { status, error = null, items = 0, at = new Date().toISOString() }) {
  await driver.execute(
    `UPDATE sources SET last_run_at = ?, last_status = ?, last_error = ?, items_last_run = ?,
       total_items = COALESCE(total_items, 0) + ?
     WHERE id = ?`,
    [at, status, error, items, items, id],
  );
  return getSource(id);
}

// ------------------------------------------------------------------ offers
export async function findOfferByFingerprint(fingerprint) {
  const rows = await driver.query('SELECT * FROM offers WHERE fingerprint = ?', [fingerprint]);
  return rows[0] || null;
}

export async function findOfferByUrl(source, url) {
  if (!url) return null;
  const rows = await driver.query(
    'SELECT * FROM offers WHERE source = ? AND (product_url = ? OR affiliate_url = ?) LIMIT 1',
    [source, url, url],
  );
  return rows[0] || null;
}

export async function getOffer(id) {
  const rows = await driver.query('SELECT * FROM offers WHERE id = ?', [id]);
  return rows[0] || null;
}

export async function upsertOffer(offer) {
  const id = offer.id || uuid();
  const now = new Date().toISOString();
  await driver.execute(
    `INSERT INTO offers (
       id, source, external_id, fingerprint, title, description, image_url, price, previous_price,
       discount_percent, currency, store, category, product_url, affiliate_url, rating, sales,
       status, featured, sponsored, ai_confidence, search_text, raw, captured_at, last_seen_at,
       published_at, expires_at, updated_at
     ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(fingerprint) DO UPDATE SET
       title = excluded.title,
       description = excluded.description,
       image_url = excluded.image_url,
       price = excluded.price,
       previous_price = excluded.previous_price,
       discount_percent = excluded.discount_percent,
       currency = excluded.currency,
       store = excluded.store,
       category = excluded.category,
       product_url = excluded.product_url,
       affiliate_url = excluded.affiliate_url,
       rating = excluded.rating,
       sales = excluded.sales,
       ai_confidence = excluded.ai_confidence,
       search_text = excluded.search_text,
       raw = excluded.raw,
       last_seen_at = excluded.last_seen_at,
       expires_at = excluded.expires_at,
       updated_at = excluded.updated_at`,
    [
      id,
      offer.source,
      offer.external_id,
      offer.fingerprint,
      offer.title,
      offer.description ?? '',
      offer.image_url ?? '',
      offer.price ?? null,
      offer.previous_price ?? null,
      offer.discount_percent ?? 0,
      offer.currency ?? 'BRL',
      offer.store ?? '',
      offer.category ?? 'Outros',
      offer.product_url ?? '',
      offer.affiliate_url ?? '',
      offer.rating ?? null,
      offer.sales ?? 0,
      offer.status ?? 'active',
      offer.featured ?? 0,
      offer.sponsored ?? 0,
      offer.ai_confidence ?? null,
      offer.search_text ?? '',
      offer.raw ?? '',
      offer.captured_at ?? now,
      offer.last_seen_at ?? now,
      offer.published_at ?? (offer.status === 'active' ? now : null),
      offer.expires_at ?? null,
      now,
    ],
  );
  const rows = await driver.query('SELECT * FROM offers WHERE fingerprint = ?', [offer.fingerprint]);
  return rows[0] || null;
}

const OFFER_UPDATABLE = new Set([
  'external_id', 'fingerprint', 'title', 'description', 'image_url', 'price', 'previous_price',
  'discount_percent', 'currency', 'store', 'category', 'product_url', 'affiliate_url', 'rating',
  'sales', 'status', 'featured', 'sponsored', 'ai_confidence', 'search_text', 'raw',
  'published_at', 'expires_at', 'last_seen_at',
]);

export async function updateOffer(id, patch) {
  const entries = Object.entries(patch).filter(([key]) => OFFER_UPDATABLE.has(key));
  if (!entries.length) return getOffer(id);
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  const values = entries.map(([, value]) => {
    if (typeof value === 'boolean') return value ? 1 : 0;
    return value;
  });
  values.push(new Date().toISOString(), id);
  await driver.execute(`UPDATE offers SET ${assignments}, updated_at = ? WHERE id = ?`, values);
  return getOffer(id);
}

export async function listOffers(options = {}) {
  const {
    status = 'active',
    category,
    source,
    featured,
    sponsored,
    search,
    limit = 30,
    offset = 0,
    order = 'recent',
  } = options;

  const where = [];
  const params = [];

  if (status && status !== 'all') {
    where.push('status = ?');
    params.push(status);
  }
  if (category && category !== 'all') {
    where.push('category = ?');
    params.push(category);
  }
  if (source && source !== 'all') {
    where.push('source = ?');
    params.push(source);
  }
  if (featured !== undefined && featured !== null && featured !== 'all') {
    where.push('featured = ?');
    params.push(Number(Boolean(featured)));
  }
  if (sponsored !== undefined && sponsored !== null && sponsored !== 'all') {
    where.push('sponsored = ?');
    params.push(Number(Boolean(sponsored)));
  }
  if (search) {
    where.push('search_text LIKE ?');
    params.push(`%${String(search).toLowerCase()}%`);
  }

  const orderBy = order === 'discount'
    ? 'discount_percent DESC, captured_at DESC'
    : order === 'price'
      ? 'price ASC'
      : 'featured DESC, sponsored DESC, captured_at DESC';

  const sql = `SELECT * FROM offers
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY ${orderBy}
    LIMIT ? OFFSET ?`;

  return driver.query(sql, [...params, Number(limit), Number(offset)]);
}

export async function countOffers() {
  const rows = await driver.query('SELECT status, COUNT(*) AS total FROM offers GROUP BY status');
  const counts = { total: 0 };
  for (const row of rows) {
    counts[row.status] = Number(row.total);
    counts.total += Number(row.total);
  }
  return counts;
}

export async function countOffersByCategory() {
  return driver.query(
    `SELECT category, COUNT(*) AS total FROM offers WHERE status = 'active'
     GROUP BY category ORDER BY total DESC`,
  );
}

export async function expireStaleOffers(source, seenFingerprints, beforeIso) {
  const seen = new Set(seenFingerprints);
  const rows = await driver.query(
    `SELECT id, fingerprint FROM offers WHERE source = ? AND status = 'active'`,
    [source],
  );
  let expired = 0;
  for (const row of rows) {
    if (seen.has(row.fingerprint)) continue;
    if (beforeIso && row.last_seen_at && row.last_seen_at >= beforeIso) continue;
    await updateOffer(row.id, { status: 'expired' });
    await logEvent(source, 'info', `Oferta expirada (nao encontrada na ultima captura): ${row.id}`);
    expired += 1;
  }
  return expired;
}

export async function expireByTtl(nowIso) {
  const rows = await driver.query(
    `SELECT id FROM offers WHERE status = 'active' AND expires_at IS NOT NULL AND expires_at <= ?`,
    [nowIso],
  );
  for (const row of rows) {
    await updateOffer(row.id, { status: 'expired' });
  }
  return rows.length;
}

// ----------------------------------------------------------------- history
export async function addHistory(offerId, field, oldValue, newValue) {
  await driver.execute(
    'INSERT INTO offer_history (offer_id, field, old_value, new_value, changed_at) VALUES (?, ?, ?, ?, ?)',
    [offerId, field, oldValue === null ? null : String(oldValue), newValue === null ? null : String(newValue), new Date().toISOString()],
  );
}

export async function listHistory(offerId, limit = 50) {
  return driver.query(
    'SELECT * FROM offer_history WHERE offer_id = ? ORDER BY changed_at DESC LIMIT ?',
    [offerId, Number(limit)],
  );
}

// ------------------------------------------------------------------ events
export async function logEvent(source, level, message) {
  await driver.execute(
    'INSERT INTO events (source, level, message, created_at) VALUES (?, ?, ?, ?)',
    [source, level, message, new Date().toISOString()],
  );
}

export async function listEvents(limit = 50) {
  return driver.query('SELECT * FROM events ORDER BY created_at DESC LIMIT ?', [Number(limit)]);
}

export const db = {
  initDb,
  getDriver,
  migrate,
  seed,
  getSettings,
  getSetting,
  setSetting,
  setSettings,
  listCategories,
  getCategory,
  upsertCategory,
  listSources,
  getSource,
  setSourceEnabled,
  recordSourceRun,
  findOfferByFingerprint,
  findOfferByUrl,
  getOffer,
  upsertOffer,
  updateOffer,
  listOffers,
  countOffers,
  countOffersByCategory,
  expireStaleOffers,
  expireByTtl,
  addHistory,
  listHistory,
  logEvent,
  listEvents,
};

export default db;
