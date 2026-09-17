import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(__dirname, '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');

function loadDotEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadDotEnv();

const bool = (value, fallback = false) => {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(String(value).toLowerCase());
};

const int = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const list = (value) =>
  String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: int(process.env.PORT, 3000),
  adminToken: process.env.ADMIN_TOKEN || 'admin',

  db: {
    driver: (process.env.DB_DRIVER || 'sqlite').toLowerCase(),
    sqlitePath: path.resolve(ROOT_DIR, process.env.SQLITE_PATH || './data/ofertas.db'),
    databaseUrl: process.env.DATABASE_URL || '',
  },

  tracker: {
    intervalMinutes: int(process.env.TRACK_INTERVAL_MINUTES, 15),
    runOnStart: bool(process.env.TRACK_ON_START, true),
  },

  sources: {
    demo: {
      enabled: bool(process.env.DEMO_SOURCE_ENABLED, true),
    },
    shopee: {
      enabled: bool(process.env.SHOPEE_ENABLED, false),
      appId: process.env.SHOPEE_APP_ID || '',
      appSecret: process.env.SHOPEE_APP_SECRET || '',
      apiUrl: process.env.SHOPEE_API_URL || 'https://open-api.affiliate.shopee.com.br/graphql',
      keywords: list(process.env.SHOPEE_KEYWORDS) || ['notebook', 'celular', 'smart tv'],
    },
    tiktok: {
      enabled: bool(process.env.TIKTOK_ENABLED, false),
      appKey: process.env.TIKTOK_APP_KEY || '',
      appSecret: process.env.TIKTOK_APP_SECRET || '',
      accessToken: process.env.TIKTOK_ACCESS_TOKEN || '',
      shopCipher: process.env.TIKTOK_SHOP_CIPHER || '',
      apiUrl: process.env.TIKTOK_API_URL || 'https://open-api.tiktokglobalshop.com',
      keywords: list(process.env.TIKTOK_KEYWORDS) || ['notebook', 'celular'],
    },
  },

  ai: {
    enabled: bool(process.env.AI_ENABLED, false),
    apiKey: process.env.USER_LLM_API_KEY || '',
    baseUrl: process.env.USER_LLM_BASE_URL || 'https://api.openai.com/v1',
    model: process.env.USER_LLM_MODEL || 'gpt-4o-mini',
  },

  whatsapp: {
    enabled: bool(process.env.WHATSAPP_ENABLED, false),
    apiUrl: process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v20.0',
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || '',
    token: process.env.WHATSAPP_TOKEN || '',
    recipients: list(process.env.WHATSAPP_RECIPIENTS),
  },
};

export default config;
