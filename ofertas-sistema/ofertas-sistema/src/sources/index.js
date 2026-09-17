import config from '../config.js';
import { demoSource } from './demo.js';
import { shopeeSource } from './shopee.js';
import { tiktokSource } from './tiktok.js';

const registry = new Map([
  [demoSource.id, demoSource],
  [shopeeSource.id, shopeeSource],
  [tiktokSource.id, tiktokSource],
]);

export function getSourceAdapter(id) {
  return registry.get(id) || null;
}

export function listSourceAdapters() {
  return [...registry.values()].map((adapter) => ({
    id: adapter.id,
    name: adapter.name,
    configured: adapter.isConfigured(),
  }));
}

export function isSourceAvailable(id) {
  const adapter = getSourceAdapter(id);
  return Boolean(adapter && adapter.isConfigured());
}

export function sourceDefaults() {
  return {
    demo: config.sources.demo.enabled,
    shopee: config.sources.shopee.enabled,
    tiktok: config.sources.tiktok.enabled,
  };
}

export default { getSourceAdapter, listSourceAdapters, isSourceAvailable, sourceDefaults };
