import config from '../config.js';
import { fetchJson } from '../lib/http.js';

export function isAiAvailable() {
  return Boolean(config.ai.enabled && config.ai.apiKey);
}

export async function classifyWithAi(offer, categories) {
  if (!isAiAvailable()) return null;
  const names = categories.map((category) => category.name).filter(Boolean);
  if (!names.length) return null;

  try {
    const data = await fetchJson(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.ai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.ai.model,
        temperature: 0,
        max_tokens: 20,
        messages: [
          {
            role: 'system',
            content:
              'Voce classifica produtos em UMA categoria. Responda apenas com o nome exato da categoria, sem explicacoes.',
          },
          {
            role: 'user',
            content: `Categorias disponiveis: ${names.join(', ')}\n\nProduto: ${offer.title}\nLoja: ${offer.store || '-'}`,
          },
        ],
      }),
    }, 12000);

    const content = data?.choices?.[0]?.message?.content?.trim();
    if (!content) return null;
    const match = names.find((name) => name.toLowerCase() === content.toLowerCase());
    if (!match) return null;
    return { category: match, confidence: 0.85, method: 'ai' };
  } catch {
    return null;
  }
}

export default classifyWithAi;
