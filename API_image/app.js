/**
 * VisualSearch – Unsplash Image Search App
 * app.js – Core application logic
 */

// ════════════════════════════════════════
//  CONSTANTS & STATE
// ════════════════════════════════════════
const STORAGE_KEY = 'unsplash_access_key';
const DEFAULT_PER_PAGE = 20;

const state = {
  query: '',
  translatedQuery: '',
  page: 1,
  perPage: DEFAULT_PER_PAGE,
  orientation: '',
  totalPages: 0,
  results: [],
  lightboxIndex: 0,
  isLoading: false,
};

// ════════════════════════════════════════
//  DOM REFERENCES
// ════════════════════════════════════════
const $  = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const searchForm        = $('searchForm');
const searchInput       = $('searchInput');
const clearBtn          = $('clearBtn');
const searchBtn         = $('searchBtn');
const orientationFilter = $('orientationFilter');
const countFilter       = $('countFilter');

const statusBar     = $('statusBar');
const loadingState  = $('loadingState');
const errorState    = $('errorState');
const errorMsg      = $('errorMsg');
const retryBtn      = $('retryBtn');
const emptyState    = $('emptyState');
const resultsSection = $('resultsSection');
const resultsTitle  = $('resultsTitle');
const imageGrid     = $('imageGrid');
const loadMoreBtn   = $('loadMoreBtn');

const lightbox          = $('lightbox');
const lightboxClose     = $('lightboxClose');
const lightboxPrev      = $('lightboxPrev');
const lightboxNext      = $('lightboxNext');
const lightboxImg       = $('lightboxImg');
const lightboxAvatar    = $('lightboxAvatar');
const lightboxAuthorName = $('lightboxAuthorName');
const lightboxAuthorHandle = $('lightboxAuthorHandle');
const lightboxLikes     = $('lightboxLikes');
const lightboxDownloads = $('lightboxDownloads');
const lightboxDownload  = $('lightboxDownload');
const lightboxUnsplash  = $('lightboxUnsplash');

const settingsBtn     = $('settingsBtn');
const settingsModal   = $('settingsModal');
const closeSettings   = $('closeSettings');
const cancelSettings  = $('cancelSettings');
const saveSettings    = $('saveSettings');
const apiKeyInput     = $('apiKeyInput');
const toggleKeyVisibility = $('toggleKeyVisibility');

const gridViewBtn    = $('gridView');
const masonryViewBtn = $('masonryView');

const toast = $('toast');

// ════════════════════════════════════════
//  API KEY MANAGEMENT
// ════════════════════════════════════════
function getApiKey() {
  return localStorage.getItem(STORAGE_KEY) || '';
}

function saveApiKey(key) {
  localStorage.setItem(STORAGE_KEY, key.trim());
}

// ════════════════════════════════════════
//  TOAST NOTIFICATIONS
// ════════════════════════════════════════
let toastTimer = null;

function showToast(message, type = 'default', duration = 3000) {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ════════════════════════════════════════
//  UI STATE MANAGEMENT
// ════════════════════════════════════════
function setUIState(uiState) {
  loadingState.hidden  = uiState !== 'loading';
  errorState.hidden    = uiState !== 'error';
  emptyState.hidden    = uiState !== 'empty';
  resultsSection.hidden = uiState !== 'results';
  statusBar.hidden     = uiState !== 'results';
}

function showLoading(isTranslating = false) {
  setUIState('loading');
  updateSearchBtn(isTranslating ? 'Đang dịch...' : 'Đang tìm...');
}

function hideLoading() {
  resetSearchBtn();
}

function updateSearchBtn(text) {
  searchBtn.disabled = true;
  searchBtn.style.opacity = '0.7';
  const btnText = searchBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = text;
}

function resetSearchBtn() {
  searchBtn.disabled = false;
  searchBtn.style.opacity = '1';
  const btnText = searchBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Tìm kiếm';
}

function showError(message) {
  errorMsg.textContent = message;
  setUIState('error');
  hideLoading();
}

// ════════════════════════════════════════
//  AUTO-TRANSLATE (Tiếng Việt → English)
// ════════════════════════════════════════

/**
 * Phát hiện xem text có phải tiếng Việt không
 * dựa vào các ký tự đặc trưng của tiếng Việt
 */
function isVietnamese(text) {
  // Kiểm tra dấu thanh điệu và chữ cái đặc trưng tiếng Việt
  const viPattern = /[\u00e0-\u00e3\u00e8-\u00ea\u00ec\u00ed\u00f2-\u00f5\u00f9\u00fa\u00fd\u0103\u0111\u01a1\u01b0\u1ea0-\u1ef9]/;
  return viPattern.test(text);
}

/**
 * Dịch text sang tiếng Anh dùng Google Translate (không cần API key)
 * Strategy 1: Google Translate gtx endpoint
 * Strategy 2: MyMemory API (fallback)
 */
async function translateToEnglish(text) {
  if (!isVietnamese(text)) return { translated: text, wasTranslated: false };

  // ── Strategy 1: Google Translate (gtx client, free, no CORS issue) ──
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=vi&tl=en&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Response: [[ ["translated", "original", ...], ... ], null, "vi", ...]
    const parts = data?.[0];
    if (!parts || !Array.isArray(parts)) throw new Error('Bad format');

    const translated = parts
      .map(p => p?.[0] || '')
      .join('')
      .replace(/\s+/g, ' ')
      .trim();

    if (!translated) throw new Error('Empty result');
    console.log(`[Translate] VI→EN: "${text}" → "${translated}"`);
    return { translated, wasTranslated: true };

  } catch (e1) {
    console.warn('[Translate] Google failed, trying MyMemory...', e1.message);
  }

  // ── Strategy 2: MyMemory API (fallback) ──
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=vi|en&de=app@visualsearch.io`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const translated = data?.responseData?.translatedText;
    if (!translated) throw new Error('Empty result');

    const cleaned = translated.replace(/\s+/g, ' ').trim();
    console.log(`[Translate] MyMemory VI→EN: "${text}" → "${cleaned}"`);
    return { translated: cleaned, wasTranslated: true };

  } catch (e2) {
    console.warn('[Translate] Both failed, using original:', e2.message);
    return { translated: text, wasTranslated: false };
  }
}

// ════════════════════════════════════════
//  UNSPLASH API
// ════════════════════════════════════════
async function fetchImages({ query, page = 1, perPage = 20, orientation = '' }) {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error('API_KEY_MISSING');
  }

  const params = new URLSearchParams({
    query,
    page,
    per_page: perPage,
    ...(orientation && { orientation }),
  });

  const url = `https://api.unsplash.com/search/photos?${params}`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Client-ID ${apiKey}`,
      'Accept-Version': 'v1',
    },
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error('API_KEY_INVALID');
    if (response.status === 403) throw new Error('API_RATE_LIMIT');
    throw new Error(`HTTP_${response.status}`);
  }

  return response.json();
}

// ════════════════════════════════════════
//  RENDER IMAGE CARDS
// ════════════════════════════════════════
function formatNumber(num) {
  if (!num) return '0';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return String(num);
}

function createImageCard(photo, index) {
  const card = document.createElement('div');
  card.className = 'img-card';
  card.setAttribute('role', 'listitem');
  card.style.animationDelay = `${(index % 10) * 60}ms`;
  card.tabIndex = 0;
  card.setAttribute('aria-label', `Ảnh bởi ${photo.user.name}`);

  const thumbUrl = photo.urls.small;
  const authorAvatar = photo.user.profile_image?.small || '';
  const likes = formatNumber(photo.likes);
  const description = photo.alt_description || photo.description || 'Hình ảnh từ Unsplash';

  card.innerHTML = `
    <img
      src="${thumbUrl}"
      alt="${description}"
      loading="lazy"
      decoding="async"
    />
    <div class="card-overlay">
      <div class="card-author">
        <img class="card-avatar" src="${authorAvatar}" alt="${photo.user.name}" />
        <span class="card-author-name">${photo.user.name}</span>
      </div>
      <div class="card-actions">
        <button class="card-action-btn view-btn-card" data-index="${index}" aria-label="Xem ảnh lớn">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          Xem
        </button>
        <a class="card-action-btn" href="${photo.links.download + '&force=true'}" download aria-label="Tải xuống" target="_blank" rel="noopener">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0 0 18 9h-1.26A8 8 0 1 0 3 16.29"/>
          </svg>
          Tải
        </a>
      </div>
    </div>
    <div class="card-likes">❤️ ${likes}</div>
  `;

  // Click to open lightbox
  card.addEventListener('click', (e) => {
    if (e.target.closest('a')) return; // allow download link
    openLightbox(index);
  });
  card.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      openLightbox(index);
    }
  });

  // Dedicated view button
  const viewBtnCard = card.querySelector('.view-btn-card');
  viewBtnCard.addEventListener('click', (e) => {
    e.stopPropagation();
    openLightbox(index);
  });

  return card;
}

function renderResults(photos, append = false) {
  if (!append) imageGrid.innerHTML = '';

  photos.forEach((photo, i) => {
    const card = createImageCard(photo, append ? state.results.length - photos.length + i : i);
    imageGrid.appendChild(card);
  });
}

// ════════════════════════════════════════
//  SEARCH
// ════════════════════════════════════════
async function performSearch(append = false) {
  if (state.isLoading) return;

  const query = searchInput.value.trim();
  if (!query) { searchInput.focus(); return; }

  state.query        = query;
  state.orientation  = orientationFilter.value;
  state.perPage      = parseInt(countFilter.value) || DEFAULT_PER_PAGE;

  if (!append) {
    state.page           = 1;
    state.results        = [];
    state.translatedQuery = '';
  }

  state.isLoading = true;

  // ── Bước 1: Dịch (chỉ lần đầu) ──
  let searchQuery = query;
  if (!append) {
    // Hiện "Đang dịch..." nếu tiếng Việt, ngược lại "Đang tìm..."
    const vi = isVietnamese(query);
    updateSearchBtn(vi ? 'Đang dịch...' : 'Đang tìm...');
    setUIState('loading');

    if (vi) {
      const { translated, wasTranslated } = await translateToEnglish(query);
      if (wasTranslated) {
        state.translatedQuery = translated;
        searchQuery           = translated;
      }
      updateSearchBtn('Đang tìm...');
    }
  } else {
    searchQuery = state.translatedQuery || query;
    updateSearchBtn('Đang tìm...');
    setUIState('loading');
  }

  // ── Bước 2: Gọi Unsplash ──
  try {
    const data = await fetchImages({
      query:       searchQuery,
      page:        state.page,
      perPage:     state.perPage,
      orientation: state.orientation,
    });

    const photos = data.results || [];
    state.totalPages = data.total_pages;

    if (photos.length === 0 && !append) {
      setUIState('empty');
      resetSearchBtn();
      state.isLoading = false;
      return;
    }

    state.results = append ? [...state.results, ...photos] : photos;
    renderResults(photos, append);
    setUIState('results');

    // Status bar
    const totalStr = data.total.toLocaleString('vi-VN');
    const showBadge = state.translatedQuery &&
      state.translatedQuery.toLowerCase() !== query.toLowerCase();

    statusBar.innerHTML = showBadge
      ? `Tìm thấy <strong>${totalStr}</strong> kết quả cho "${query}"
         <span class="translate-badge" title="Từ khóa tiếng Anh gửi đến Unsplash">
           🌐 → "${state.translatedQuery}"
         </span>`
      : `Tìm thấy <strong>${totalStr}</strong> kết quả cho "${query}"`;

    resultsTitle.textContent = `${state.results.length} hình ảnh`;
    loadMoreBtn.hidden = state.page >= state.totalPages;

    if (!append) resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    handleError(err);
  } finally {
    resetSearchBtn();
    state.isLoading = false;
  }
}

function handleError(err) {
  const messages = {
    'API_KEY_MISSING': '⚠️ Chưa có API Key. Nhấn vào ⚙️ để thêm Unsplash Access Key.',
    'API_KEY_INVALID': '🔑 API Key không hợp lệ. Vui lòng kiểm tra lại trong cài đặt.',
    'API_RATE_LIMIT': '⏱️ Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.',
    'Failed to fetch': '🌐 Lỗi kết nối mạng. Vui lòng kiểm tra internet.',
  };

  const key = Object.keys(messages).find(k => err.message?.includes(k));
  const message = key ? messages[key] : (messages[err.message] || `Đã xảy ra lỗi: ${err.message}`);

  if (err.message === 'API_KEY_MISSING') {
    showError(message);
    openSettingsModal();
  } else {
    showError(message);
  }
}

// ════════════════════════════════════════
//  LIGHTBOX
// ════════════════════════════════════════
function openLightbox(index) {
  state.lightboxIndex = index;
  updateLightboxContent();
  lightbox.hidden = false;
  document.body.style.overflow = 'hidden';
  lightboxClose.focus();
}

function closeLightbox() {
  lightbox.hidden = true;
  document.body.style.overflow = '';
}

function updateLightboxContent() {
  const photo = state.results[state.lightboxIndex];
  if (!photo) return;

  lightboxImg.src = '';
  lightboxImg.src = photo.urls.regular;
  lightboxImg.alt = photo.alt_description || 'Hình ảnh từ Unsplash';

  lightboxAvatar.src = photo.user.profile_image?.medium || '';
  lightboxAvatar.alt = photo.user.name;
  lightboxAuthorName.textContent = photo.user.name;
  lightboxAuthorHandle.textContent = `@${photo.user.username}`;

  lightboxLikes.querySelector('span').textContent = formatNumber(photo.likes);
  lightboxDownloads.querySelector('span').textContent = photo.downloads ? formatNumber(photo.downloads) : '—';

  lightboxDownload.href = photo.links.download + '&force=true';
  lightboxUnsplash.href = photo.links.html;

  // Update nav buttons
  lightboxPrev.disabled = state.lightboxIndex === 0;
  lightboxNext.disabled = state.lightboxIndex === state.results.length - 1;
  lightboxPrev.style.opacity = state.lightboxIndex === 0 ? '0.3' : '1';
  lightboxNext.style.opacity = state.lightboxIndex === state.results.length - 1 ? '0.3' : '1';
}

// ════════════════════════════════════════
//  SETTINGS MODAL
// ════════════════════════════════════════
function openSettingsModal() {
  apiKeyInput.value = getApiKey();
  settingsModal.hidden = false;
  apiKeyInput.focus();
}

function closeSettingsModal() {
  settingsModal.hidden = true;
}

// ════════════════════════════════════════
//  VIEW TOGGLE (Grid ↔ Masonry)
// ════════════════════════════════════════
function setView(mode) {
  if (mode === 'masonry') {
    imageGrid.classList.add('masonry');
    gridViewBtn.classList.remove('active');
    masonryViewBtn.classList.add('active');
    gridViewBtn.setAttribute('aria-pressed', 'false');
    masonryViewBtn.setAttribute('aria-pressed', 'true');
  } else {
    imageGrid.classList.remove('masonry');
    gridViewBtn.classList.add('active');
    masonryViewBtn.classList.remove('active');
    gridViewBtn.setAttribute('aria-pressed', 'true');
    masonryViewBtn.setAttribute('aria-pressed', 'false');
  }
}

// ════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════

// Search form
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  performSearch(false);
});

// Clear input
searchInput.addEventListener('input', () => {
  clearBtn.hidden = !searchInput.value;
});
clearBtn.addEventListener('click', () => {
  searchInput.value = '';
  searchInput.focus();
  clearBtn.hidden = true;
});

// Suggestion chips
$$('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    searchInput.value = chip.dataset.query;
    clearBtn.hidden = false;
    performSearch(false);
  });
});

// Retry
retryBtn.addEventListener('click', () => performSearch(false));

// Load more
loadMoreBtn.addEventListener('click', () => {
  state.page += 1;
  performSearch(true);
});

// Lightbox
lightboxClose.addEventListener('click', closeLightbox);
lightbox.addEventListener('click', (e) => {
  if (e.target === lightbox) closeLightbox();
});
lightboxPrev.addEventListener('click', () => {
  if (state.lightboxIndex > 0) {
    state.lightboxIndex--;
    updateLightboxContent();
  }
});
lightboxNext.addEventListener('click', () => {
  if (state.lightboxIndex < state.results.length - 1) {
    state.lightboxIndex++;
    updateLightboxContent();
  }
});

// Keyboard navigation
document.addEventListener('keydown', (e) => {
  if (!lightbox.hidden) {
    switch (e.key) {
      case 'Escape':    closeLightbox(); break;
      case 'ArrowLeft': if (state.lightboxIndex > 0) { state.lightboxIndex--; updateLightboxContent(); } break;
      case 'ArrowRight': if (state.lightboxIndex < state.results.length - 1) { state.lightboxIndex++; updateLightboxContent(); } break;
    }
  }
  if (!settingsModal.hidden && e.key === 'Escape') closeSettingsModal();
});

// Settings
settingsBtn.addEventListener('click', openSettingsModal);
closeSettings.addEventListener('click', closeSettingsModal);
cancelSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', (e) => {
  if (e.target === settingsModal) closeSettingsModal();
});
saveSettings.addEventListener('click', () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showToast('⚠️ Vui lòng nhập API key', 'error');
    return;
  }
  saveApiKey(key);
  closeSettingsModal();
  showToast('✅ Đã lưu API key thành công!', 'success');
});

toggleKeyVisibility.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  $('eyeIcon').innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// Save on Enter in API input
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveSettings.click();
});

// View toggle
gridViewBtn.addEventListener('click', () => setView('grid'));
masonryViewBtn.addEventListener('click', () => setView('masonry'));

// ════════════════════════════════════════
//  BENCHMARK MODAL SUITE
// ════════════════════════════════════════
const benchmarkBtn     = $('benchmarkBtn');
const benchmarkModal   = $('benchmarkModal');
const closeBenchmark   = $('closeBenchmark');
const startBenchmarkBtn = $('startBenchmarkBtn');
const bmRequestCount   = $('bmRequestCount');
const bmBatchSize      = $('bmBatchSize');
const bmProgressSection = $('bmProgressSection');
const bmResultsSection  = $('bmResultsSection');

const bmSyncStatus  = $('bmSyncStatus');
const bmBatchStatus = $('bmBatchStatus');
const bmAsyncStatus = $('bmAsyncStatus');

const bmSyncBar  = $('bmSyncBar');
const bmBatchBar = $('bmBatchBar');
const bmAsyncBar = $('bmAsyncBar');

const bmSyncTime  = $('bmSyncTime');
const bmSyncTps   = $('bmSyncTps');

const bmBatchTime = $('bmBatchTime');
const bmBatchTps  = $('bmBatchTps');
const bmBatchSpeedup = $('bmBatchSpeedup');

const bmAsyncTime = $('bmAsyncTime');
const bmAsyncTps  = $('bmAsyncTps');
const bmAsyncSpeedup = $('bmAsyncSpeedup');

const bmTableBody = $('bmTableBody');

function openBenchmarkModal() {
  benchmarkModal.hidden = false;
}

function closeBenchmarkModal() {
  benchmarkModal.hidden = true;
}

if (benchmarkBtn) {
  benchmarkBtn.addEventListener('click', openBenchmarkModal);
}
if (closeBenchmark) {
  closeBenchmark.addEventListener('click', closeBenchmarkModal);
}
if (benchmarkModal) {
  benchmarkModal.addEventListener('click', (e) => {
    if (e.target === benchmarkModal) closeBenchmarkModal();
  });
}

// Keydown listener for Benchmark Modal
document.addEventListener('keydown', (e) => {
  if (benchmarkModal && !benchmarkModal.hidden && e.key === 'Escape') {
    closeBenchmarkModal();
  }
});

// Seed Prompts cho Benchmark
const SAMPLE_BENCHMARK_PROMPTS = [
  'Bình minh trên vịnh Hạ Long',
  'Thành phố tương lai rực rỡ đèn neon',
  'Chú mèo con đeo kính râm cute',
  'Rừng phong lá đỏ mùa thu Kyoto',
  'Cánh đồng hoa lavender tím ngát',
  'Phi hành gia khám phá sao Hỏa',
  'Tách cà phê espresso tỏa khói thơm',
  'Chú rồng lửa uốn lượn qua đại dương',
  'Xe hơi thể thao chạy trên đường đua',
  'Lâu đài cổ tích trên đỉnh mây trắng',
  'Robot trí tuệ nhân tạo mỉm cười',
  'Bãi biển nhiệt đới cát trắng nắng vàng',
  'Thung lũng tuyết phủ mùa đông Thụy Sĩ',
  'Vũ công múa dưới ánh đèn sân khấu',
  'Khu vườn hoa hồng nước Anh rực rỡ',
  'Con tàu không gian du hành liên ngân hà',
  'Thám hiểm rừng rậm Amazon hoang sơ',
  'Quán ăn đêm đường phố Tokyo rực sắc',
  'Hồ nước trong suốt soi bóng dãy núi Altai',
  'Cầu vồng đôi xuất hiện sau cơn mưa'
];

if (startBenchmarkBtn) {
  startBenchmarkBtn.addEventListener('click', async () => {
    const count = parseInt(bmRequestCount.value) || 12;
    const batchSize = parseInt(bmBatchSize.value) || 4;
    const prompts = SAMPLE_BENCHMARK_PROMPTS.slice(0, count);

    // Reset UI
    startBenchmarkBtn.disabled = true;
    startBenchmarkBtn.textContent = '⏳ Đang đo kiểm...';
    bmProgressSection.hidden = false;
    bmResultsSection.hidden = true;

    // Reset Status & Bars
    [bmSyncStatus, bmBatchStatus, bmAsyncStatus].forEach(el => {
      el.className = 'bm-status-pill pending';
      el.textContent = 'Đang chờ...';
    });
    bmSyncBar.style.width = '0%';
    bmBatchBar.style.width = '0%';
    bmAsyncBar.style.width = '0%';

    const updateProgressUI = (evt) => {
      const mode = evt.mode;
      let statusEl, barEl;

      if (mode === 'sync')  { statusEl = bmSyncStatus; barEl = bmSyncBar; }
      if (mode === 'batch') { statusEl = bmBatchStatus; barEl = bmBatchBar; }
      if (mode === 'async') { statusEl = bmAsyncStatus; barEl = bmAsyncBar; }

      if (!statusEl || !barEl) return;

      if (evt.status === 'started' || evt.status === 'batch_started') {
        statusEl.className = 'bm-status-pill running';
        statusEl.textContent = 'Đang chạy...';
      }

      if (evt.index !== undefined && evt.total) {
        const pct = Math.round(((evt.index + 1) / evt.total) * 100);
        barEl.style.width = `${pct}%`;
        if (pct === 100) {
          statusEl.className = 'bm-status-pill done';
          statusEl.textContent = 'Hoàn tất ✓';
        }
      }
    };

    try {
      // Thực thi bộ so sánh ApiBenchmark
      const results = await window.ApiBenchmark.runFullComparison(
        prompts,
        window.ApiBenchmark.defaultFetchFn,
        { batchSize },
        updateProgressUI
      );

      // Render Results Cards & Table
      const { sync, batch, async: asyncRes } = results;

      bmSyncTime.textContent = `${sync.totalTimeMs} ms`;
      bmSyncTps.textContent  = `${sync.throughputReqSec} req/s`;

      bmBatchTime.textContent = `${batch.totalTimeMs} ms`;
      bmBatchTps.textContent  = `${batch.throughputReqSec} req/s`;
      bmBatchSpeedup.textContent = `${batch.speedup}`;

      bmAsyncTime.textContent = `${asyncRes.totalTimeMs} ms`;
      bmAsyncTps.textContent  = `${asyncRes.throughputReqSec} req/s`;
      bmAsyncSpeedup.textContent = `${asyncRes.speedup}`;

      // Table body
      bmTableBody.innerHTML = results.summary.map(item => `
        <tr>
          <td><strong>${item.mode}</strong></td>
          <td>${item.totalTimeMs} ms</td>
          <td>${item.throughputReqSec} req/s</td>
          <td>${item.avgLatencyMs} ms</td>
          <td>${item.successCount}/${item.totalRequests}</td>
          <td><span class="card-speedup ${item.modeKey === 'async' ? 'highlight-green' : item.modeKey === 'batch' ? 'highlight' : ''}">${item.speedup}</span></td>
        </tr>
      `).join('');

      bmResultsSection.hidden = false;
      showToast('⚡ Đo kiểm Benchmark thành công!', 'success');

    } catch (err) {
      console.error('Lỗi khi chạy benchmark:', err);
      showToast('❌ Có lỗi xảy ra trong quá trình benchmark', 'error');
    } finally {
      startBenchmarkBtn.disabled = false;
      startBenchmarkBtn.textContent = '🚀 Chạy So Sánh 3 Phương Pháp';
    }
  });
}

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
function init() {
  const savedKey = getApiKey();
  if (!savedKey) {
    // Prompt user to set API key on first load
    setTimeout(() => {
      showToast('👋 Hãy thiết lập Unsplash API Key để bắt đầu!', 'default', 5000);
    }, 800);
  }
}

init();

