import config from '../config.js';
import { fetchJson } from '../lib/http.js';
import { hmacSha256, toNumber } from '../lib/util.js';

const PRODUCT_SEARCH_PATH = '/product/202309/products/search';

function buildSignedUrl(path, params, bodyString, appSecret) {
  const sortedKeys = Object.keys(params).filter((key) => key !== 'sign').sort();
  const concatenated = sortedKeys.map((key) => `${key}${params[key]}`).join('');
  const stringToSign = `${path}${concatenated}${bodyString}`;
  const sign = hmacSha256(appSecret, stringToSign);

  const search = new URLSearchParams();
  for (const key of [...sortedKeys, 'sign']) {
    search.append(key, key === 'sign' ? sign : params[key]);
  }
  return `${search.toString()}`;
}

function normalizeProduct(product) {
  const id = product.id || product.product_id;
  if (!id) return null;

  const sku = product.skus?.[0] || {};
  const price = toNumber(
    sku.price?.sale_price ?? sku.price?.tax_exclusive_price ?? product.price?.sale_price,
  );
  const previousPrice = toNumber(sku.price?.original_price ?? product.price?.original_price);
  const currency = sku.price?.currency || product.price?.currency || 'BRL';

  if (price === null) return null;

  const images = product.images || product.cover_images || [];
  const image = images[0]?.urls?.[0] || images[0]?.url || product.cover_url || '';

  return {
    source: 'tiktok',
    external_id: String(id),
    title: product.title || 'Produto TikTok Shop',
    description: product.description || '',
    image_url: image,
    price,
    previous_price: previousPrice,
    currency,
    store: product.brand?.name || product.shop_name || 'TikTok Shop',
    category: null,
    product_url: `https://shop.tiktok.com/view/product/${id}`,
    affiliate_url: '',
    rating: toNumber(product.rating ?? product.product_rating),
    sales: toNumber(product.sales ?? product.sold_count) || 0,
    raw: product,
  };
}

export const tiktokSource = {
  id: 'tiktok',
  name: 'TikTok Shop',

  isConfigured() {
    const { appKey, appSecret, accessToken } = config.sources.tiktok;
    return Boolean(appKey && appSecret && accessToken);
  },

  async fetchOffers() {
    const { apiUrl, appKey, appSecret, accessToken, shopCipher, keywords } = config.sources.tiktok;
    const items = [];
    const errors = [];

    const body = {
      page_size: 50,
      sort_field: 'create_time',
      sort_order: 'DESC',
    };
    const bodyString = JSON.stringify(body);

    try {
      const params = {
        app_key: appKey,
        timestamp: Math.floor(Date.now() / 1000),
      };
      if (shopCipher) params.shop_cipher = shopCipher;

      const query = buildSignedUrl(PRODUCT_SEARCH_PATH, params, bodyString, appSecret);

      const data = await fetchJson(`${apiUrl}${PRODUCT_SEARCH_PATH}?${query}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tts-access-token': accessToken,
        },
        body: bodyString,
      });

      if (data?.code && data.code !== 0) {
        throw new Error(data.message || `TikTok Shop erro ${data.code}`);
      }

      const products = data?.data?.products || [];
      const lowered = keywords.map((keyword) => keyword.toLowerCase());
      for (const product of products) {
        const normalized = normalizeProduct(product);
        if (!normalized) continue;
        if (lowered.length) {
          const title = normalized.title.toLowerCase();
          if (!lowered.some((keyword) => title.includes(keyword))) continue;
        }
        items.push(normalized);
      }
    } catch (error) {
      errors.push(`TikTok Shop: ${error.message}`);
    }

    return { items, rawCount: items.length, errors };
  },
};

export default tiktokSource;
