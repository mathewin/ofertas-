import express from 'express';
import config from '../config.js';
import { runTracker } from '../tracker/engine.js';
import { getSchedulerState } from '../tracker/scheduler.js';
import { listSourceAdapters } from '../sources/index.js';
import {
  countOffers,
  countOffersByCategory,
  getOffer,
  getSettings,
  listCategories,
  listEvents,
  listHistory,
  listOffers,
  listSources,
  logEvent,
  recordSourceRun,
  setSettings,
  setSourceEnabled,
  updateOffer,
  upsertCategory,
} from '../db/index.js';
import { serializeOffer } from './public.js';

const router = express.Router();

const ALLOWED_SETTINGS = new Set([
  'minDiscount', 'requireLink', 'requirePrice', 'requireImage', 'blockedKeywords',
  'allowedCategories', 'expireMissing', 'ttlHours', 'publishMode', 'maxPerRun',
  'intervalMinutes', 'aiEnabled',
]);

const ALLOWED_STATUS = new Set(['active', 'pending', 'hidden', 'expired', 'archived']);

router.use((req, res, next) => {
  const token = req.get('x-admin-token') || req.query.token;
  if (!token || token !== config.adminToken) {
    return res.status(401).json({ ok: false, error: 'Token administrativo invalido' });
  }
  next();
});

router.get('/session', (req, res) => {
  res.json({ ok: true, data: { authenticated: true } });
});

router.get('/dashboard', async (req, res, next) => {
  try {
    const [counts, byCategory, sources, events] = await Promise.all([
      countOffers(),
      countOffersByCategory(),
      listSources(),
      listEvents(15),
    ]);
    res.json({
      ok: true,
      data: {
        counts,
        categories: byCategory.map((row) => ({ category: row.category, total: Number(row.total) })),
        sources: sources.map((source) => ({
          id: source.id,
          name: source.name,
          enabled: Number(Boolean(source.enabled)),
          last_run_at: source.last_run_at,
          last_status: source.last_status,
          last_error: source.last_error,
          items_last_run: Number(source.items_last_run || 0),
          total_items: Number(source.total_items || 0),
        })),
        events,
        scheduler: getSchedulerState(),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/offers', async (req, res, next) => {
  try {
    const { status = 'all', category, source, search, sort, limit, offset } = req.query;
    const rows = await listOffers({
      status,
      category,
      source,
      search,
      order: sort,
      limit: Math.min(Number.parseInt(limit ?? '50', 10) || 50, 200),
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
    if (!offer) return res.status(404).json({ ok: false, error: 'Oferta nao encontrada' });
    const history = await listHistory(offer.id);
    res.json({ ok: true, data: { offer: serializeOffer(offer), history } });
  } catch (error) {
    next(error);
  }
});

router.patch('/offers/:id', async (req, res, next) => {
  try {
    const offer = await getOffer(req.params.id);
    if (!offer) return res.status(404).json({ ok: false, error: 'Oferta nao encontrada' });

    const patch = {};
    const body = req.body || {};

    if (body.status !== undefined) {
      if (!ALLOWED_STATUS.has(body.status)) {
        return res.status(400).json({ ok: false, error: 'Status invalido' });
      }
      patch.status = body.status;
      if (body.status === 'active' && !offer.published_at) patch.published_at = new Date().toISOString();
    }
    for (const field of ['title', 'description', 'image_url', 'category', 'product_url', 'affiliate_url', 'store']) {
      if (body[field] !== undefined) patch[field] = String(body[field]);
    }
    for (const field of ['price', 'previous_price']) {
      if (body[field] !== undefined) patch[field] = body[field] === null ? null : Number(body[field]);
    }
    for (const field of ['featured', 'sponsored']) {
      if (body[field] !== undefined) patch[field] = Number(Boolean(body[field]));
    }
    if (body.title || body.category || body.store) {
      patch.search_text = [body.title ?? offer.title, body.store ?? offer.store, body.category ?? offer.category]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
    }

    const updated = await updateOffer(offer.id, patch);
    await logEvent('admin', 'info', `Oferta ${offer.id} atualizada via painel`);
    res.json({ ok: true, data: serializeOffer(updated) });
  } catch (error) {
    next(error);
  }
});

router.get('/events', async (req, res, next) => {
  try {
    const limit = Math.min(Number.parseInt(req.query.limit ?? '100', 10) || 100, 500);
    res.json({ ok: true, data: await listEvents(limit) });
  } catch (error) {
    next(error);
  }
});

router.get('/sources', async (req, res, next) => {
  try {
    const sources = await listSources();
    const adapters = listSourceAdapters();
    res.json({
      ok: true,
      data: sources.map((source) => {
        const adapter = adapters.find((item) => item.id === source.id);
        return {
          ...source,
          enabled: Number(Boolean(source.enabled)),
          configured: adapter ? adapter.configured : false,
          description: adapter ? 'Adaptador oficial disponivel' : 'Sem adaptador',
        };
      }),
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/sources/:id', async (req, res, next) => {
  try {
    const { enabled } = req.body || {};
    const updated = await setSourceEnabled(req.params.id, enabled);
    if (!updated) return res.status(404).json({ ok: false, error: 'Fonte nao encontrada' });
    await logEvent('admin', 'info', `Fonte ${req.params.id} ${enabled ? 'ativada' : 'desativada'}`);
    res.json({ ok: true, data: updated });
  } catch (error) {
    next(error);
  }
});

router.post('/sources/:id/run', async (req, res, next) => {
  try {
    const summary = await runTracker({ source: req.params.id, trigger: 'manual' });
    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.post('/track', async (req, res, next) => {
  try {
    const source = req.body?.source || 'all';
    const summary = await runTracker({ source, trigger: 'manual' });
    res.json({ ok: true, data: summary });
  } catch (error) {
    next(error);
  }
});

router.get('/categories', async (req, res, next) => {
  try {
    res.json({ ok: true, data: await listCategories(false) });
  } catch (error) {
    next(error);
  }
});

router.post('/categories', async (req, res, next) => {
  try {
    const { id, name, keywords, enabled, sort_order } = req.body || {};
    if (!name) return res.status(400).json({ ok: false, error: 'Nome da categoria obrigatorio' });
    const category = await upsertCategory({ id, name, keywords, enabled, sort_order });
    res.json({ ok: true, data: category });
  } catch (error) {
    next(error);
  }
});

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSettings();
    res.json({
      ok: true,
      data: {
        settings,
        scheduler: getSchedulerState(),
        ai_available: Boolean(config.ai.enabled && config.ai.apiKey),
      },
    });
  } catch (error) {
    next(error);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const body = req.body || {};
    const filtered = {};
    for (const [key, value] of Object.entries(body)) {
      if (ALLOWED_SETTINGS.has(key)) filtered[key] = value;
    }
    if (!Object.keys(filtered).length) {
      return res.status(400).json({ ok: false, error: 'Nenhuma configuracao valida enviada' });
    }
    if (filtered.intervalMinutes !== undefined) {
      if (String(filtered.intervalMinutes).trim() === '') {
        delete filtered.intervalMinutes;
      } else {
        const minutes = Number.parseInt(filtered.intervalMinutes, 10);
        if (!Number.isFinite(minutes) || minutes < 1) {
          return res.status(400).json({ ok: false, error: 'Intervalo minimo de 1 minuto' });
        }
        filtered.intervalMinutes = String(minutes);
      }
    }
    await setSettings(filtered);
    await logEvent('admin', 'info', `Configuracoes atualizadas: ${Object.keys(filtered).join(', ')}`);
    res.json({ ok: true, data: await getSettings() });
  } catch (error) {
    next(error);
  }
});

router.post('/reset-run', async (req, res, next) => {
  try {
    for (const source of await listSources()) {
      await recordSourceRun(source.id, { status: 'idle', error: null, items: 0 });
    }
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

export default router;
