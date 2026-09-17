import bus from '../lib/bus.js';
import { addHours, nowIso } from '../lib/util.js';
import {
  addHistory,
  expireByTtl,
  expireStaleOffers,
  findOfferByFingerprint,
  findOfferByUrl,
  getSettings,
  listCategories,
  listSources,
  logEvent,
  recordSourceRun,
  updateOffer,
  upsertOffer,
} from '../db/index.js';
import { getSourceAdapter } from '../sources/index.js';
import { classifyOffer } from './category.js';
import { classifyWithAi, isAiAvailable } from './ai.js';
import { buildFilter, evaluateOffer } from './filter.js';
import { dispatchOffer } from '../channels/index.js';

let running = false;

export function isRunning() {
  return running;
}

function computeDiscount(offer) {
  const price = Number(offer.price);
  const previous = Number(offer.previous_price);
  const informed = Number(offer.discount_percent || 0);
  if (previous > 0 && price > 0 && previous > price) {
    return Math.max(Math.round(((previous - price) / previous) * 100), informed);
  }
  return informed;
}

function buildSearchText(offer) {
  return [offer.title, offer.store, offer.category]
    .filter(Boolean)
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function toDbOffer(draft, settings) {
  const ttlHours = Number.parseInt(settings.ttlHours ?? '72', 10) || 72;
  const publishMode = settings.publishMode || 'auto';
  const status = publishMode === 'manual' ? 'pending' : 'active';
  const now = nowIso();

  return {
    source: draft.source,
    external_id: draft.external_id,
    fingerprint: `${draft.source}:${draft.external_id}`,
    title: draft.title,
    description: draft.description || '',
    image_url: draft.image_url || '',
    price: draft.price ?? null,
    previous_price: draft.previous_price ?? null,
    discount_percent: draft.discount_percent ?? 0,
    currency: draft.currency || 'BRL',
    store: draft.store || '',
    category: draft.category || 'Outros',
    product_url: draft.product_url || '',
    affiliate_url: draft.affiliate_url || '',
    rating: draft.rating ?? null,
    sales: draft.sales ?? 0,
    status,
    featured: 0,
    sponsored: 0,
    ai_confidence: draft.ai_confidence ?? null,
    search_text: buildSearchText(draft),
    raw: JSON.stringify(draft.raw ?? {}),
    captured_at: draft.captured_at ?? now,
    last_seen_at: now,
    published_at: status === 'active' ? now : null,
    expires_at: addHours(ttlHours),
  };
}

async function processSource(source, context) {
  const { adapter, settings, filter, categories, maxPerRun } = context;
  const result = { id: source.id, name: source.name, fetched: 0, created: 0, updated: 0, rejected: 0, expired: 0, errors: [] };

  if (!adapter) {
    result.errors.push('Fonte sem adaptador implementado');
    await recordSourceRun(source.id, { status: 'error', error: result.errors[0] });
    await logEvent(source.id, 'error', result.errors[0]);
    return result;
  }

  if (!adapter.isConfigured()) {
    result.errors.push('Credenciais nao configuradas para esta fonte');
    await recordSourceRun(source.id, { status: 'disabled', error: result.errors[0] });
    await logEvent(source.id, 'warn', `${source.name}: ${result.errors[0]}`);
    return result;
  }

  let payload;
  try {
    payload = await adapter.fetchOffers();
  } catch (error) {
    result.errors.push(error.message);
    await recordSourceRun(source.id, { status: 'error', error: error.message });
    await logEvent(source.id, 'error', `${source.name}: ${error.message}`);
    return result;
  }

  result.fetched = payload.items.length;
  for (const error of payload.errors || []) {
    result.errors.push(error);
    await logEvent(source.id, 'error', error);
  }

  const seenFingerprints = [];
  const aiClassifier = isAiAvailable() ? classifyWithAi : null;

  for (const draft of payload.items) {
    if (result.created >= maxPerRun) break;
    seenFingerprints.push(`${draft.source}:${draft.external_id}`);

    const enriched = { ...draft, discount_percent: computeDiscount(draft) };
    const classification = await classifyOffer(enriched, categories, aiClassifier);
    enriched.category = classification.category;
    if (classification.method === 'ai') enriched.ai_confidence = classification.confidence;

    const fingerprint = `${enriched.source}:${enriched.external_id}`;
    let existing = await findOfferByFingerprint(fingerprint);
    if (!existing) {
      existing = await findOfferByUrl(enriched.source, enriched.product_url);
    }

    const evaluation = evaluateOffer(enriched, filter);

    if (!evaluation.ok) {
      result.rejected += 1;
      if (existing && existing.status === 'active') {
        await updateOffer(existing.id, { status: 'expired' });
        result.expired += 1;
        await logEvent(source.id, 'info', `Oferta expirada pelo filtro (${evaluation.reasons.join(', ')}): ${existing.title}`);
      }
      continue;
    }

    const dbOffer = toDbOffer(enriched, settings);

    if (!existing) {
      const created = await upsertOffer(dbOffer);
      result.created += 1;
      await addHistory(created.id, 'price', null, created.price);
      await logEvent(source.id, 'info', `Nova oferta: ${created.title}`);
      bus.emit('offer:new', created);
      if (created.status === 'active') await dispatchOffer(created);
      continue;
    }

    const previousPrice = Number(existing.price);
    const newPrice = Number(dbOffer.price);
    const priceChanged = Number.isFinite(previousPrice) && Number.isFinite(newPrice) && Math.abs(previousPrice - newPrice) >= 0.01;

    if (priceChanged) {
      await addHistory(existing.id, 'price', previousPrice, newPrice);
    }

    let nextStatus = dbOffer.status;
    if (['active', 'hidden', 'archived'].includes(existing.status)) {
      nextStatus = existing.status;
    }

    const updated = await updateOffer(existing.id, {
      external_id: dbOffer.external_id,
      fingerprint: dbOffer.fingerprint,
      title: dbOffer.title,
      description: dbOffer.description,
      image_url: dbOffer.image_url,
      price: dbOffer.price,
      previous_price: dbOffer.previous_price,
      discount_percent: dbOffer.discount_percent,
      currency: dbOffer.currency,
      store: dbOffer.store,
      category: dbOffer.category,
      product_url: dbOffer.product_url,
      affiliate_url: dbOffer.affiliate_url,
      rating: dbOffer.rating,
      sales: dbOffer.sales,
      ai_confidence: dbOffer.ai_confidence,
      search_text: dbOffer.search_text,
      raw: dbOffer.raw,
      last_seen_at: dbOffer.last_seen_at,
      expires_at: dbOffer.expires_at,
      status: nextStatus,
    });

    result.updated += 1;
    if (priceChanged) {
      bus.emit('offer:update', updated);
      await logEvent(source.id, 'info', `Preco atualizado: ${updated.title} (R$ ${previousPrice} -> R$ ${newPrice})`);
    }
  }

  const expireMissing = String(settings.expireMissing ?? 'true').toLowerCase() === 'true';
  const hasPartialErrors = (payload.errors || []).length > 0;
  if (expireMissing && seenFingerprints.length > 0 && !hasPartialErrors) {
    result.expired += await expireStaleOffers(source.id, seenFingerprints, context.startedAt);
  }

  await recordSourceRun(source.id, {
    status: result.errors.length ? 'partial' : 'ok',
    error: result.errors.length ? result.errors.join(' | ') : null,
    items: result.fetched,
  });

  return result;
}

export async function runTracker(options = {}) {
  const { source = 'all', trigger = 'manual' } = options;

  if (running) {
    return { skipped: true, reason: 'Captura ja em andamento' };
  }

  running = true;
  const startedAt = nowIso();
  const summary = {
    trigger,
    started_at: startedAt,
    finished_at: null,
    duration_ms: 0,
    created: 0,
    updated: 0,
    rejected: 0,
    expired: 0,
    sources: [],
    errors: [],
  };

  try {
    const settings = await getSettings();
    const filter = buildFilter(settings);
    const categories = await listCategories(true);
    const maxPerRun = Number.parseInt(settings.maxPerRun ?? '60', 10) || 60;
    const allSources = await listSources();
    const targets = allSources.filter(
      (item) => Number(item.enabled) === 1 && (source === 'all' || item.id === source),
    );

    for (const target of targets) {
      const adapter = getSourceAdapter(target.id);
      const result = await processSource(target, {
        adapter,
        settings,
        filter,
        categories,
        maxPerRun,
        startedAt,
      });
      summary.sources.push(result);
      summary.created += result.created;
      summary.updated += result.updated;
      summary.rejected += result.rejected;
      summary.expired += result.expired;
      summary.errors.push(...result.errors.map((error) => ({ source: target.id, error })));
    }

    summary.expired += await expireByTtl(nowIso());
    summary.finished_at = nowIso();
    summary.duration_ms = new Date(summary.finished_at) - new Date(startedAt);

    await logEvent('tracker', 'info',
      `Captura ${trigger} finalizada: ${summary.created} novas, ${summary.updated} atualizadas, ${summary.rejected} filtradas, ${summary.expired} expiradas`);

    bus.emit('tracker:done', summary);
    return summary;
  } catch (error) {
    summary.finished_at = nowIso();
    summary.errors.push({ source: 'tracker', error: error.message });
    await logEvent('tracker', 'error', `Falha na captura: ${error.message}`);
    bus.emit('tracker:done', summary);
    return summary;
  } finally {
    running = false;
  }
}

export default runTracker;
