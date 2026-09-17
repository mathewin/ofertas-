export async function fetchJson(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = { raw: text };
    }
    if (!response.ok) {
      const message = data?.message || data?.error || `HTTP ${response.status}`;
      const error = new Error(`${message}`);
      error.status = response.status;
      error.body = data;
      throw error;
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}
