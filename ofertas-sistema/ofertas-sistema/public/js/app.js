const state = {
  category: 'all',
  source: 'all',
  search: '',
  sort: 'recent',
  offset: 0,
  limit: 20,
  total: 0,
  loading: false,
};

const els = {
  messages: document.getElementById('messages'),
  chat: document.getElementById('chat'),
  chips: document.getElementById('chips'),
  searchBar: document.getElementById('search-bar'),
  searchInput: document.getElementById('search-input'),
  clearSearch: document.getElementById('clear-search'),
  toggleSearch: document.getElementById('toggle-search'),
  loadMore: document.getElementById('load-more'),
  empty: document.getElementById('empty-state'),
  typing: document.getElementById('typing'),
  liveDot: document.getElementById('live-dot'),
  footerText: document.getElementById('footer-text'),
  sortSelect: document.getElementById('sort-select'),
  headerStatus: document.getElementById('header-status'),
};

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
  if (!Number.isFinite(number)) return 'R$ --';
  return number.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function renderOffer(offer) {
  const time = formatTime(offer.captured_at || offer.updated_at);
  const discount = Number(offer.discount_percent || 0);
  const hasOld = offer.previous_price && Number(offer.previous_price) > Number(offer.price);
  const url = offer.offer_url || offer.product_url || '#';
  const image = offer.image_url || `/api/placeholder/${encodeURIComponent(offer.external_id || offer.id)}`;

  return `
    <article class="message" data-id="${escapeHtml(offer.id)}" data-category="${escapeHtml(offer.category || 'Outros')}" data-search="${escapeHtml(`${offer.title} ${offer.store || ''}`.toLowerCase())}">
      <div class="message-avatar" aria-hidden="true">🤖</div>
      <div class="bubble">
        <div class="bubble-title">Oferta encontrada!</div>
        <img class="offer-image" src="${escapeHtml(image)}" alt="${escapeHtml(offer.title)}" loading="lazy"
             onerror="this.onerror=null;this.src='/api/placeholder/${encodeURIComponent(offer.external_id || offer.id)}'" />
        <h3 class="offer-title">📦 ${escapeHtml(offer.title)}</h3>
        <div class="price-row">
          ${hasOld ? `<span class="price-old">De ${formatBRL(offer.previous_price)}</span>` : ''}
          <span class="price-new">🔥 ${formatBRL(offer.price)}</span>
          ${discount ? `<span class="discount-badge">${discount}% OFF</span>` : ''}
        </div>
        <div class="offer-meta">
          <span class="offer-store">🛒 ${escapeHtml(offer.store || offer.source || 'Loja')}</span>
          <span class="offer-category">${escapeHtml(offer.category || 'Outros')}</span>
        </div>
        <a class="offer-button" href="${escapeHtml(url)}" target="_blank" rel="noopener sponsored nofollow">VER OFERTA</a>
        <div class="bubble-footer">${time}${offer.featured ? ' • destaque' : ''}</div>
      </div>
    </article>`;
}

function matchesFilters(offer) {
  if (state.category !== 'all' && offer.category !== state.category) return false;
  if (state.source !== 'all' && offer.source !== state.source) return false;
  if (state.search) {
    const haystack = `${offer.title} ${offer.store || ''} ${offer.category || ''}`.toLowerCase();
    if (!haystack.includes(state.search.toLowerCase())) return false;
  }
  return true;
}

async function loadOffers({ reset = false } = {}) {
  if (state.loading) return;
  state.loading = true;
  if (reset) {
    state.offset = 0;
    els.messages.innerHTML = '';
  }
  els.typing.hidden = false;

  const params = new URLSearchParams({
    category: state.category,
    source: state.source,
    search: state.search,
    sort: state.sort,
    limit: String(state.limit),
    offset: String(state.offset),
  });

  try {
    const response = await fetch(`/api/offers?${params.toString()}`);
    const payload = await response.json();
    const offers = payload.data || [];
    state.total = offers.length;

    if (reset) els.messages.innerHTML = '';
    els.messages.insertAdjacentHTML('beforeend', offers.map(renderOffer).join(''));

    state.offset += offers.length;
    els.empty.hidden = !(state.offset === 0);
    els.loadMore.hidden = offers.length < state.limit;
  } catch (error) {
    els.footerText.textContent = 'Falha ao carregar ofertas';
  } finally {
    state.loading = false;
    els.typing.hidden = true;
  }
}

async function loadCategories() {
  try {
    const response = await fetch('/api/categories');
    const payload = await response.json();
    const categories = payload.data || [];
    const chips = [
      `<button class="chip active" data-category="all">Todas</button>`,
      ...categories
        .filter((category) => category.total > 0 || category.id === 'outros')
        .map((category) => `<button class="chip" data-category="${escapeHtml(category.name)}">${escapeHtml(category.name)}<small>${category.total}</small></button>`),
    ];
    els.chips.innerHTML = chips.join('');
    els.chips.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        els.chips.querySelectorAll('.chip').forEach((item) => item.classList.remove('active'));
        chip.classList.add('active');
        state.category = chip.dataset.category;
        loadOffers({ reset: true });
      });
    });
  } catch {
    els.chips.innerHTML = '';
  }
}

let searchTimer = null;
els.searchInput.addEventListener('input', (event) => {
  clearTimeout(searchTimer);
  const value = event.target.value.trim();
  searchTimer = setTimeout(() => {
    state.search = value;
    loadOffers({ reset: true });
  }, 350);
});

els.toggleSearch.addEventListener('click', () => {
  els.searchBar.hidden = !els.searchBar.hidden;
  if (!els.searchBar.hidden) els.searchInput.focus();
});

els.clearSearch.addEventListener('click', () => {
  els.searchInput.value = '';
  state.search = '';
  loadOffers({ reset: true });
});

els.loadMore.addEventListener('click', () => loadOffers());

els.sortSelect.addEventListener('change', (event) => {
  state.sort = event.target.value;
  loadOffers({ reset: true });
});

function connectStream() {
  if (!('EventSource' in window)) return;
  const source = new EventSource('/api/stream');

  source.addEventListener('open', () => {
    els.liveDot.classList.add('online');
    els.footerText.textContent = 'Atualizacao automatica ativa';
  });

  source.addEventListener('error', () => {
    els.liveDot.classList.remove('online');
    els.footerText.textContent = 'Reconectando...';
  });

  source.addEventListener('offer:new', (event) => {
    try {
      const offer = JSON.parse(event.data);
      if (!matchesFilters(offer)) return;
      els.messages.insertAdjacentHTML('afterbegin', renderOffer(offer));
      els.chat.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      // ignora payload invalido
    }
  });

  source.addEventListener('offer:update', (event) => {
    try {
      const offer = JSON.parse(event.data);
      const current = els.messages.querySelector(`[data-id="${offer.id}"]`);
      if (!current) return;
      current.outerHTML = renderOffer(offer);
    } catch {
      // ignora payload invalido
    }
  });

  source.addEventListener('tracker:done', (event) => {
    try {
      const summary = JSON.parse(event.data);
      if (summary.created > 0) {
        els.footerText.textContent = `${summary.created} nova(s) oferta(s) capturada(s)`;
      }
    } catch {
      // ignora payload invalido
    }
  });
}

loadCategories();
loadOffers({ reset: true });
connectStream();
setInterval(() => {
  if (document.visibilityState === 'visible') loadOffers({ reset: true });
}, 120000);
