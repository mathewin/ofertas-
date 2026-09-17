import config from '../config.js';
import { fetchJson } from '../lib/http.js';
import { sha256, toNumber } from '../lib/util.js';

const PRODUCT_OFFER_QUERY = `
query ProductOfferV2($keyword: String, $limit: Int, $page: Int, $sortType: Int) {
  productOfferV2(keyword: $keyword, limit: $limit, page: $page, sortType: $sortType) {
    nodes {
      itemId
      productName
      price
      priceMin
      priceMax
      priceBeforeDiscount
      priceDiscountRate
      imageUrl
      productLink
      offerLink
      shopName
      ratingStar
      sales
      commissionRate
      productCatIds
    }
    pageInfo {
      page
      limit
      hasNextPage
    }
  }
}`;

function normalizeDiscountRate(value) {
  const rate = toNumber(value);
  if (rate === null) return null;
  return rate <= 1 ? Math.round(rate * 100) : Math.round(rate);
}

function normalizeNode(node) {
  const itemId = node.itemId ?? node.productId ?? node.itemid;
  if (!itemId) return null;

  const price = toNumber(node.price ?? node.priceMin);
  if (price === null) return null;

  let previousPrice = toNumber(node.priceBeforeDiscount);
  const discountRate = normalizeDiscountRate(node.priceDiscountRate);
  if (previousPrice === null && discountRate && discountRate < 100) {
    previousPrice = Math.round((price / (1 - discountRate / 100)) * 100) / 100;
  }

  return {
    source: 'shopee',
    external_id: String(itemId),
    title: node.productName || 'Produto Shopee',
    description: '',
    image_url: node.imageUrl || '',
    price,
    previous_price: previousPrice,
    currency: 'BRL',
    store: node.shopName || 'Shopee',
    category: null,
    product_url: node.productLink || node.offerLink || '',
    affiliate_url: node.offerLink || '',
    rating: toNumber(node.ratingStar),
    sales: toNumber(node.sales) || 0,
    raw: node,
  };
}

export const shopeeSource = {
  id: 'shopee',
  name: 'Shopee',

  isConfigured() {
    const { appId, appSecret } = config.sources.shopee;
    return Boolean(appId && appSecret);
  },

  async fetchOffers() {
    const { apiUrl, appId, appSecret, keywords } = config.sources.shopee;
    const items = [];
    const errors = [];

    for (const keyword of keywords) {
      try {
        const timestamp = Math.floor(Date.now() / 1000);
        const payload = JSON.stringify({
          query: PRODUCT_OFFER_QUERY,
          variables: { keyword, limit: 50, page: 1, sortType: 2 },
        });
        const signature = sha256(`${appId}${timestamp}${payload}${appSecret}`);

        const data = await fetchJson(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
          },
          body: payload,
        });

        const nodes = data?.data?.productOfferV2?.nodes || [];
        for (const node of nodes) {
          const normalized = normalizeNode(node);
          if (normalized) items.push(normalized);
        }
      } catch (error) {
        errors.push(`Shopee [${keyword}]: ${error.message}`);
      }
    }

    return { items, rawCount: items.length, errors };
  },
};

export default shopeeSource;
