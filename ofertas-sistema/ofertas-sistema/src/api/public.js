import express from 'express';
import bus from '../lib/bus.js';
import { getSchedulerState } from '../tracker/scheduler.js';
import {
  countOffers,
  countOffersByCategory,
  getOffer,
  listCategories,
  listEvents,
  listHistory,
  listOffers,
  listSources,
} from '../db/index.js';

const router = express.Router();
const streams = new Set();

export function serializeOffer(row) {
  if (!row) return null;
  const { raw, search_text: searchText, ...safe } = row;
  return {
    ...safe,
    price: row.price === null ? null : Number(row.price),
    previous_price: row.previous_price === null ? null : Number(row.previous_price),
    discount_percent: Number(row.discount_percent || 0),
    rating: row.rating === null ? null : Number(row.rating),
    sales: Number(row.sales || 0),
    featured: Number(Boolean(row.featured)),
    sponsored: Number(Boolean(row.sponsored)),
    offer_url: row.affiliate_url || row.product_url || '',
  };
}

router.get('/offers', async (req, res, next) => {
  try {
    const { category, source, search, sort, limit, offset } = req.query;
    const rows = await listOffers({
      status: 'active',
      category,
      source,
      search,
      order: sort,
      limit: Math.min(Number.parseInt(limit ?? '30', 10) || 30, 100),
      offset: Number.parseInt(offset ?? '0', 10) || 0,
    });
    res.json({ ok: true, data: rows.map(serializeOffer) });
  } catch (error) {
    next(error);
  }
});

router.get('/offers/:id', async (req, res, next) => {
  try {
    const offer = await getOffer(req.params.id);
    if (!offer || offer.status === 'archived') {
      return res.status(404).json({ ok: false, error: 'Oferta nao encontrada' });
    }
    res.json({ ok: true, data: serializeOffer(offer) });
  } catch (error) {
    next(error);
  }
});

router.get('/offers/:id/history', async (req, res, next) => {
  try {
    const history = await listHistory(req.params.id);
    res.json({ ok: true, data: history });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    const categories = await listCategories(true);
    const counts = await countOffersByCategory();
    const countMap = Object.fromEntries(counts.map((row) => [row.category, Number(row.total)]));
    res.json({
      ok: true,
      data: categories.map((category) => ({
        id: category.id,
        name: category.name,
        total: countMap[category.name] || 0,
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/sources', async (req, res, next) => {
  try {
    const sources = await listSources();
    res.json({
      ok: true,
      data: sources.map((source) => ({
        id: source.id,
        name: source.name,
        enabled: Number(Boolean(source.enabled)),
        last_run_at: source.last_run_at,
        last_status: source.last_status,
        items_last_run: Number(source.items_last_run || 0),
      })),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stats', async (req, res, next) => {
  try {
    const counts = await countOffers();
    const events = await listEvents(10);
    res.json({
      ok: true,
      data: {
        offers: counts,
        scheduler: getSchedulerState(),
        last_events: events,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/stream', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders?.();
  res.write('retry: 5000\n\n');
  res.write(`event: hello\ndata: ${JSON.stringify({ at: new Date().toISOString() })}\n\n`);
  streams.add(res);

  const keepAlive = setInterval(() => {
    res.write(': ping\n\n');
  }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    streams.delete(res);
  });
});

function broadcast(event, payload) {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const stream of streams) {
    try {
      stream.write(chunk);
    } catch {
      streams.delete(stream);
    }
  }
}

bus.on('offer:new', (offer) => broadcast('offer:new', serializeOffer(offer)));
bus.on('offer:update', (offer) => broadcast('offer:update', serializeOffer(offer)));
bus.on('tracker:done', (summary) =>
  broadcast('tracker:done', {
    created: summary.created,
    updated: summary.updated,
    rejected: summary.rejected,
    expired: summary.expired,
    finished_at: summary.finished_at,
  }));

const PALETTE = ['#128C7E', '#075E54', '#25D366', '#34B7F1', '#6C63FF', '#FF8A4C'];

router.get('/placeholder/:seed', (req, res) => {
  const seed = String(req.params.seed || 'oferta');
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 100000;
  }
  const from = PALETTE[hash % PALETTE.length];
  const to = PALETTE[(hash + 3) % PALETTE.length];
  const label = seed.replace(/[^a-zA-Z0-9 ]/g, ' ').slice(0, 22).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
<stop offset="0%" stop-color="${from}"/><stop offset="100%" stop-color="${to}"/></linearGradient></defs>
<rect width="600" height="400" fill="url(#g)"/>
<circle cx="470" cy="90" r="120" fill="rgba(255,255,255,0.12)"/>
<circle cx="120" cy="330" r="90" fill="rgba(255,255,255,0.10)"/>
<text x="50%" y="52%" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#ffffff" opacity="0.95">${label}</text>
</svg>`;
  res.set('Content-Type', 'image/svg+xml');
  res.set('Cache-Control', 'public, max-age=86400');
  res.send(svg);
});

export default router;
