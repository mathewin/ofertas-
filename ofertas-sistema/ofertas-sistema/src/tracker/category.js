function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

export function classifyByRules(offer, categories) {
  const haystack = normalize(`${offer.title || ''} ${offer.description || ''} ${offer.store || ''}`);
  let best = null;

  for (const category of categories) {
    if (!category.enabled && category.enabled !== 1) continue;
    const keywords = String(category.keywords || '')
      .split(',')
      .map((keyword) => normalize(keyword.trim()))
      .filter(Boolean);
    if (!keywords.length) continue;

    let score = 0;
    for (const keyword of keywords) {
      if (!keyword) continue;
      if (haystack.includes(keyword)) {
        score += keyword.includes(' ') ? 3 : 2;
      }
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { category: category.name, score };
    }
  }

  if (!best) return { category: 'Outros', confidence: 0.2, method: 'rules' };
  const confidence = Math.min(0.95, 0.5 + best.score * 0.1);
  return { category: best.category, confidence, method: 'rules' };
}

export async function classifyOffer(offer, categories, aiClassifier) {
  if (offer.category) {
    return { category: offer.category, confidence: 0.99, method: 'source' };
  }
  const rules = classifyByRules(offer, categories);
  if (rules.confidence >= 0.6 || !aiClassifier) return rules;

  const ai = await aiClassifier(offer, categories);
  if (ai?.category) return ai;
  return rules;
}

export default classifyOffer;
