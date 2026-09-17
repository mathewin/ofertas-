function asBool(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on', 'sim'].includes(String(value).toLowerCase());
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function isHttpUrl(value) {
  if (!value) return false;
  try {
    const url = new URL(value, 'https://local.invalid');
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

export function buildFilter(settings = {}) {
  return {
    minDiscount: Number.parseInt(settings.minDiscount ?? '20', 10) || 0,
    requireLink: asBool(settings.requireLink, true),
    requirePrice: asBool(settings.requirePrice, true),
    requireImage: asBool(settings.requireImage, false),
    blockedKeywords: String(settings.blockedKeywords || '')
      .split(',')
      .map((keyword) => normalize(keyword.trim()))
      .filter(Boolean),
    allowedCategories: String(settings.allowedCategories || '')
      .split(',')
      .map((category) => category.trim())
      .filter(Boolean),
  };
}

export function evaluateOffer(offer, filter) {
  const reasons = [];

  if (!offer.title || offer.title.trim().length < 3) {
    reasons.push('titulo invalido');
  }

  if (filter.requirePrice && !(Number(offer.price) > 0)) {
    reasons.push('preco indisponivel');
  }

  if (filter.requireLink && !(isHttpUrl(offer.product_url) || isHttpUrl(offer.affiliate_url))) {
    reasons.push('link indisponivel');
  }

  if (filter.requireImage && !offer.image_url) {
    reasons.push('imagem indisponivel');
  }

  if (filter.minDiscount > 0 && Number(offer.discount_percent || 0) < filter.minDiscount) {
    reasons.push(`desconto abaixo do minimo (${filter.minDiscount}%)`);
  }

  if (filter.blockedKeywords.length) {
    const title = normalize(offer.title);
    const blocked = filter.blockedKeywords.find((keyword) => title.includes(keyword));
    if (blocked) reasons.push(`palavra bloqueada: ${blocked}`);
  }

  if (filter.allowedCategories.length) {
    const allowed = filter.allowedCategories.some(
      (category) => normalize(category) === normalize(offer.category),
    );
    if (!allowed) reasons.push(`categoria nao permitida: ${offer.category || 'sem categoria'}`);
  }

  return { ok: reasons.length === 0, reasons };
}

export default evaluateOffer;
