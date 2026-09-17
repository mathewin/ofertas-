import config from '../config.js';
import { logEvent } from '../db/index.js';
import { fetchJson } from '../lib/http.js';

function formatMessage(offer) {
  const lines = ['OFERTA ENCONTRADA', '', offer.title];
  if (offer.previous_price && offer.price) {
    lines.push(`De R$ ${Number(offer.previous_price).toFixed(2)}`);
  }
  if (offer.price) {
    lines.push(`Por R$ ${Number(offer.price).toFixed(2)}`);
  }
  if (offer.discount_percent) {
    lines.push(`${offer.discount_percent}% OFF`);
  }
  lines.push('', `Loja: ${offer.store || offer.source}`);
  const link = offer.affiliate_url || offer.product_url;
  if (link) lines.push(link);
  return lines.join('\n');
}

export const siteChannel = {
  id: 'site',
  async publish() {
    return { channel: 'site', ok: true };
  },
};

export const whatsappChannel = {
  id: 'whatsapp',
  enabled() {
    return Boolean(
      config.whatsapp.enabled &&
      config.whatsapp.token &&
      config.whatsapp.phoneNumberId &&
      config.whatsapp.recipients.length,
    );
  },
  async publish(offer) {
    if (!this.enabled()) return { channel: 'whatsapp', ok: false, skipped: true };

    const text = formatMessage(offer);
    const results = [];
    for (const to of config.whatsapp.recipients) {
      try {
        await fetchJson(
          `${config.whatsapp.apiUrl}/${config.whatsapp.phoneNumberId}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${config.whatsapp.token}`,
            },
            body: JSON.stringify({
              messaging_product: 'whatsapp',
              to,
              type: 'text',
              text: { preview_url: true, body: text },
            }),
          },
          12000,
        );
        results.push({ to, ok: true });
      } catch (error) {
        results.push({ to, ok: false, error: error.message });
        await logEvent('whatsapp', 'error', `Falha ao enviar oferta ${offer.id}: ${error.message}`);
      }
    }
    return { channel: 'whatsapp', ok: results.every((item) => item.ok), results };
  },
};

const channels = [siteChannel, whatsappChannel];

export async function dispatchOffer(offer) {
  const results = [];
  for (const channel of channels) {
    try {
      results.push(await channel.publish(offer));
    } catch (error) {
      results.push({ channel: channel.id, ok: false, error: error.message });
    }
  }
  return results;
}

export default dispatchOffer;
