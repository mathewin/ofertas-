const TOKEN_KEY = 'ofertas.admin.token';

const state = {
  token: localStorage.getItem(TOKEN_KEY) || '',
  view: 'dashboard',
  offers: { offset: 0, limit: 50, status: 'all', source: 'all', search: '', sort: 'recent' },
  categories: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatBRL(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '--';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

let toastTimer = null;
function toast(message, isError = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('error', isError);
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 3500);
}

async function api(path, options = {}) {
  const response = await fetch(`/api/admin${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-token': state.token,
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (response.status === 401) {
    showLogin();
    throw new Error('Sessao expirada');
  }
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `Erro ${response.status}`);
  }
  return payload.data;
}

// ------------------------------------------------------------------ login
function showLogin() {
  $('#login-screen').hidden = false;
  $('#app').hidden = true;
  localStorage.removeItem(TOKEN_KEY);
  state.token = '';
}

function showApp() {
  $('#login-screen').hidden = true;
  $('#app').hidden = false;
}

$('#login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = $('#token-input').value.trim();
  state.token = token;
  try {
    await api('/session');
    localStorage.setItem(TOKEN_KEY, token);
    $('#login-error').hidden = true;
    showApp();
    boot();
  } catch (error) {
    $('#login-error').hidden = false;
  }
});

$('#logout').addEventListener('click', showLogin);

// ------------------------------------------------------------------ views
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  offers: 'Ofertas',
  sources: 'Fontes',
  categories: 'Categorias',
  settings: 'Configuracoes',
  events: 'Eventos',
};

function setView(view) {
  state.view = view;
  $$('.nav-item').forEach((item) => item.classList.toggle('active', item.dataset.view === view));
  $$('.view').forEach((section) => {
    section.hidden = section.id !== `view-${view}`;
  });
  $('#view-title').textContent = VIEW_TITLES[view] || view;
  loadView();
}

$('#nav').addEventListener('click', (event) => {
  const button = event.target.closest('.nav-item');
  if (button) setView(button.dataset.view);
});

async function loadView() {
  try {
    if (state.view === 'dashboard') await loadDashboard();
    else if (state.view === 'offers') await loadOffers();
    else if (state.view === 'sources') await loadSources();
    else if (state.view === 'categories') await loadCategories();
    else if (state.view === 'settings') await loadSettings();
    else if (state.view === 'events') await loadEvents();
  } catch (error) {
    toast(error.message, true);
  }
}

// -------------------------------------------------------------- dashboard
async function loadDashboard() {
  const data = await api('/dashboard');
  const { counts, categories, sources, events, scheduler } = data;

  $('#dash-cards').innerHTML = [
    { label: 'Ofertas capturadas', value: counts.total || 0, tone: '' },
    { label: 'Ativas no site', value: counts.active || 0, tone: 'green' },
    { label: 'Pendentes', value: counts.pending || 0, tone: 'amber' },
    { label: 'Expiradas', value: counts.expired || 0, tone: 'red' },
    { label: 'Ocultas', value: counts.hidden || 0, tone: '' },
    { label: 'Arquivadas', value: counts.archived || 0, tone: '' },
  ].map((card) => `
    <div class="stat-card ${card.tone}">
      <span>${card.label}</span>
      <strong>${card.value}</strong>
    </div>`).join('');

  $('#dash-sources').innerHTML = sources.map((source) => {
    const tone = source.last_status === 'error' ? 'error'
      : source.last_status === 'ok' ? 'ok'
        : source.last_status === 'partial' ? 'warn' : 'neutral';
    return `
      <div class="source-row">
        <div>
          <strong>${escapeHtml(source.name)}</strong>
          <small>Ultima: ${formatDate(source.last_run_at)} • ${source.items_last_run} item(ns)</small>
          ${source.last_error ? `<small style="color:var(--red)">${escapeHtml(source.last_error)}</small>` : ''}
        </div>
        <span class="badge ${tone}">${escapeHtml(source.last_status || 'idle')}</span>
      </div>`;
  }).join('') || '<p class="muted">Nenhuma fonte cadastrada.</p>';

  const maxCategory = Math.max(1, ...categories.map((item) => item.total));
  $('#dash-categories').innerHTML = categories.map((item) => `
    <div class="bar-row">
      <div class="bar-label"><span>${escapeHtml(item.category)}</span><span>${item.total}</span></div>
      <div class="bar-track"><div class="bar-fill" style="width:${(item.total / maxCategory) * 100}%"></div></div>
    </div>`).join('') || '<p class="muted">Sem dados.</p>';

  renderEvents($('#dash-events'), events);
  $('#scheduler-info').textContent =
    `Proxima captura: ${formatDate(scheduler.next_run_at)} • intervalo ${scheduler.interval_minutes} min`;
}

function renderEvents(container, events) {
  container.innerHTML = events.map((event) => `
    <div class="event-row ${escapeHtml(event.level)}">
      <time>${formatDate(event.created_at)}</time>
      <span class="event-source">${escapeHtml(event.source || '-')}</span>
      <span class="event-message">${escapeHtml(event.message || '')}</span>
    </div>`).join('') || '<p class="muted">Nenhum evento.</p>';
}

// ----------------------------------------------------------------- offers
function offerStatusBadge(status) {
  const tone = status === 'active' ? 'ok'
    : status === 'pending' ? 'warn'
      : status === 'expired' ? 'error' : 'neutral';
  return `<span class="badge ${tone}">${escapeHtml(status)}</span>`;
}

async function loadOffers() {
  const { offset, limit, status, source, search, sort } = state.offers;
  const params = new URLSearchParams({
    status,
    source,
    search,
    sort,
    limit: String(limit),
    offset: String(offset),
  });
  const offers = await api(`/offers?${params.toString()}`);

  $('#offers-page').textContent = `Pagina ${Math.floor(offset / limit) + 1}`;
  $('#offers-prev').disabled = offset === 0;
  $('#offers-next').disabled = offers.length < limit;

  $('#offers-body').innerHTML = offers.map((offer) => `
    <tr>
      <td>
        <div class="product-cell">
          <img src="${escapeHtml(offer.image_url || `/api/placeholder/${encodeURIComponent(offer.external_id)}`)}" alt="" loading="lazy"
               onerror="this.onerror=null;this.src='/api/placeholder/${encodeURIComponent(offer.external_id)}'" />
          <div>
            <div class="product-title">${escapeHtml(offer.title)}</div>
            <small>${escapeHtml(offer.source)} • ${formatDate(offer.captured_at)}</small>
          </div>
        </div>
      </td>
      <td>${formatBRL(offer.price)}${offer.previous_price ? `<br><small class="muted"><s>${formatBRL(offer.previous_price)}</s></small>` : ''}</td>
      <td>${offer.discount_percent}%</td>
      <td>${escapeHtml(offer.store || '-')}</td>
      <td>${escapeHtml(offer.category || '-')}</td>
      <td>${escapeHtml(offer.source)}</td>
      <td>${offerStatusBadge(offer.status)}${offer.featured ? ' <span class="badge warn">destaque</span>' : ''}</td>
      <td>
        <div class="actions">
          <button data-action="publish" data-id="${offer.id}">Publicar</button>
          <button data-action="hide" data-id="${offer.id}">Ocultar</button>
          <button data-action="feature" data-id="${offer.id}" data-value="${offer.featured ? 0 : 1}">${offer.featured ? 'Remover destaque' : 'Destacar'}</button>
          <button data-action="edit" data-id="${offer.id}">Editar</button>
          <button data-action="archive" data-id="${offer.id}" class="danger">Excluir</button>
        </div>
      </td>
    </tr>`).join('') || '<tr><td colspan="8" class="muted">Nenhuma oferta encontrada.</td></tr>';
}

$('#offers-body').addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const { action, id } = button.dataset;
  try {
    if (action === 'publish') await api(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'active' }) });
    else if (action === 'hide') await api(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'hidden' }) });
    else if (action === 'archive') await api(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ status: 'archived' }) });
    else if (action === 'feature') await api(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify({ featured: Number(button.dataset.value) }) });
    else if (action === 'edit') return editOffer(id);
    toast('Oferta atualizada');
    await loadOffers();
  } catch (error) {
    toast(error.message, true);
  }
});

async function editOffer(id) {
  const { offer } = await api(`/offers/${id}`);
  const title = prompt('Titulo do produto:', offer.title);
  if (title === null) return;
  const price = prompt('Preco atual (ex: 1499.90):', offer.price);
  if (price === null) return;
  const category = prompt('Categoria:', offer.category || 'Outros');
  if (category === null) return;
  const store = prompt('Loja:', offer.store || '');
  if (store === null) return;
  const url = prompt('Link da oferta:', offer.product_url || offer.affiliate_url || '');
  if (url === null) return;

  await api(`/offers/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      title,
      price: Number(price),
      category,
      store,
      product_url: url,
    }),
  });
  toast('Oferta salva');
  await loadOffers();
}

$('#offers-search').addEventListener('input', (event) => {
  clearTimeout(window.__offersSearchTimer);
  window.__offersSearchTimer = setTimeout(() => {
    state.offers.search = event.target.value.trim();
    state.offers.offset = 0;
    loadOffers().catch((error) => toast(error.message, true));
  }, 350);
});

for (const [id, key] of [['#offers-status', 'status'], ['#offers-source', 'source'], ['#offers-sort', 'sort']]) {
  $(id).addEventListener('change', (event) => {
    state.offers[key] = event.target.value;
    state.offers.offset = 0;
    loadOffers().catch((error) => toast(error.message, true));
  });
}

$('#offers-prev').addEventListener('click', () => {
  state.offers.offset = Math.max(0, state.offers.offset - state.offers.limit);
  loadOffers().catch((error) => toast(error.message, true));
});
$('#offers-next').addEventListener('click', () => {
  state.offers.offset += state.offers.limit;
  loadOffers().catch((error) => toast(error.message, true));
});

// ---------------------------------------------------------------- sources
async function loadSources() {
  const sources = await api('/sources');
  $('#sources-grid').innerHTML = sources.map((source) => `
    <div class="source-card">
      <header>
        <h3>${escapeHtml(source.name)}</h3>
        <label class="switch">
          <input type="checkbox" data-source-toggle="${source.id}" ${source.enabled ? 'checked' : ''} />
          ativa
        </label>
      </header>
      <dl>
        <dt>Credenciais</dt><dd>${source.configured ? 'configuradas' : 'nao configuradas'}</dd>
        <dt>Ultima captura</dt><dd>${formatDate(source.last_run_at)}</dd>
        <dt>Status</dt><dd>${escapeHtml(source.last_status || 'idle')}</dd>
        <dt>Itens</dt><dd>${source.items_last_run || 0}</dd>
        <dt>Erro</dt><dd>${escapeHtml(source.last_error || '-')}</dd>
      </dl>
      <button data-source-run="${source.id}">Rodar agora</button>
    </div>`).join('');

  $$('[data-source-toggle]').forEach((input) => {
    input.addEventListener('change', async () => {
      try {
        await api(`/sources/${input.dataset.sourceToggle}`, {
          method: 'PATCH',
          body: JSON.stringify({ enabled: input.checked }),
        });
        toast('Fonte atualizada');
      } catch (error) {
        toast(error.message, true);
      }
    });
  });

  $$('[data-source-run]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.disabled = true;
      button.textContent = 'Capturando...';
      try {
        const summary = await api(`/sources/${button.dataset.sourceRun}/run`, { method: 'POST' });
        toast(`${summary.created} nova(s), ${summary.updated} atualizada(s)`);
        await loadSources();
      } catch (error) {
        toast(error.message, true);
      } finally {
        button.disabled = false;
        button.textContent = 'Rodar agora';
      }
    });
  });
}

// ------------------------------------------------------------- categories
async function loadCategories() {
  state.categories = await api('/categories');
  $('#categories-list').innerHTML = state.categories.map((category) => `
    <div class="category-row">
      <div>
        <strong>${escapeHtml(category.name)}</strong>
        <small>${escapeHtml(category.keywords || 'sem palavras-chave')}</small>
      </div>
      <div class="actions">
        <button data-category-edit="${category.id}">Editar</button>
        <button data-category-toggle="${category.id}" data-value="${category.enabled ? 0 : 1}">${category.enabled ? 'Desativar' : 'Ativar'}</button>
      </div>
    </div>`).join('') || '<p class="muted">Nenhuma categoria.</p>';

  $$('[data-category-edit]').forEach((button) => {
    button.addEventListener('click', () => {
      const category = state.categories.find((item) => item.id === button.dataset.categoryEdit);
      const form = $('#category-form');
      form.id.value = category.id;
      form.name.value = category.name;
      form.keywords.value = category.keywords || '';
      form.sort_order.value = category.sort_order || 0;
      form.enabled.checked = Boolean(category.enabled);
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  });

  $$('[data-category-toggle]').forEach((button) => {
    button.addEventListener('click', async () => {
      const category = state.categories.find((item) => item.id === button.dataset.categoryToggle);
      try {
        await api('/categories', {
          method: 'POST',
          body: JSON.stringify({
            id: category.id,
            name: category.name,
            keywords: category.keywords,
            sort_order: category.sort_order,
            enabled: Number(button.dataset.value),
          }),
        });
        toast('Categoria atualizada');
        await loadCategories();
      } catch (error) {
        toast(error.message, true);
      }
    });
  });
}

$('#category-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.target;
  try {
    await api('/categories', {
      method: 'POST',
      body: JSON.stringify({
        id: form.id.value || undefined,
        name: form.name.value.trim(),
        keywords: form.keywords.value.trim(),
        sort_order: Number(form.sort_order.value) || 0,
        enabled: form.enabled.checked ? 1 : 0,
      }),
    });
    form.reset();
    form.sort_order.value = '0';
    form.enabled.checked = true;
    toast('Categoria salva');
    await loadCategories();
  } catch (error) {
    toast(error.message, true);
  }
});

// -------------------------------------------------------------- settings
const SETTINGS_FIELDS = [
  { key: 'minDiscount', label: 'Desconto minimo (%)', type: 'number' },
  { key: 'ttlHours', label: 'Validade da oferta (horas)', type: 'number' },
  { key: 'maxPerRun', label: 'Maximo por captura', type: 'number' },
  { key: 'intervalMinutes', label: 'Intervalo de atualizacao (minutos)', type: 'number' },
  { key: 'publishMode', label: 'Modo de publicacao', type: 'select', options: [['auto', 'Automatico'], ['manual', 'Manual (revisar)']] },
  { key: 'blockedKeywords', label: 'Palavras bloqueadas (virgula)', type: 'text' },
  { key: 'allowedCategories', label: 'Categorias permitidas (vazio = todas)', type: 'text' },
  { key: 'requireLink', label: 'Exigir link valido', type: 'boolean' },
  { key: 'requirePrice', label: 'Exigir preco valido', type: 'boolean' },
  { key: 'requireImage', label: 'Exigir imagem', type: 'boolean' },
  { key: 'expireMissing', label: 'Expirar ofertas ausentes na captura', type: 'boolean' },
  { key: 'aiEnabled', label: 'Usar IA para classificar (opcional)', type: 'boolean' },
];

async function loadSettings() {
  const data = await api('/settings');
  const form = $('#settings-form');
  form.innerHTML = SETTINGS_FIELDS.map((field) => {
    const value = data.settings[field.key] ?? '';
    if (field.type === 'boolean') {
      const checked = ['true', '1', 'on'].includes(String(value).toLowerCase());
      return `<label class="checkbox"><input type="checkbox" name="${field.key}" ${checked ? 'checked' : ''} /> ${field.label}</label>`;
    }
    if (field.type === 'select') {
      return `<label>${field.label}<select name="${field.key}">${field.options
        .map(([optionValue, optionLabel]) => `<option value="${optionValue}" ${String(value) === optionValue ? 'selected' : ''}>${optionLabel}</option>`)
        .join('')}</select></label>`;
    }
    return `<label>${field.label}<input name="${field.key}" type="${field.type}" value="${escapeHtml(value)}" /></label>`;
  }).join('') + `
    <button type="submit">Salvar configuracoes</button>
    <p class="muted">${data.ai_available ? 'IA disponivel e pronta para uso.' : 'IA nao configurada (sistema funciona por regras).'}</p>`;

  form.onsubmit = async (event) => {
    event.preventDefault();
    const payload = {};
    for (const field of SETTINGS_FIELDS) {
      const input = form.elements[field.key];
      if (!input) continue;
      payload[field.key] = field.type === 'boolean'
        ? (input.checked ? 'true' : 'false')
        : input.value;
    }
    try {
      await api('/settings', { method: 'PUT', body: JSON.stringify(payload) });
      toast('Configuracoes salvas');
      await loadSettings();
    } catch (error) {
      toast(error.message, true);
    }
  };
}

// ---------------------------------------------------------------- events
async function loadEvents() {
  const events = await api('/events?limit=200');
  renderEvents($('#events-list'), events);
}

// ------------------------------------------------------------------- run
$('#run-now').addEventListener('click', async () => {
  const button = $('#run-now');
  button.disabled = true;
  button.textContent = 'Capturando...';
  try {
    const summary = await api('/track', { method: 'POST', body: JSON.stringify({ source: 'all' }) });
    toast(`${summary.created} nova(s), ${summary.updated} atualizada(s), ${summary.expired} expirada(s)`);
    await loadView();
  } catch (error) {
    toast(error.message, true);
  } finally {
    button.disabled = false;
    button.textContent = 'Capturar agora';
  }
});

// ------------------------------------------------------------------ boot
async function boot() {
  try {
    await api('/session');
    showApp();
    setView('dashboard');
  } catch {
    showLogin();
  }
}

boot();
