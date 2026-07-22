/**
 * ThoiTietVN – Weather Forecast App
 * app.js – Core application logic
 * Sử dụng OpenWeatherMap API (Current Weather + 5-day Forecast)
 */

// ════════════════════════════════════════
//  CONSTANTS & STATE
// ════════════════════════════════════════
const STORAGE_KEY  = 'owm_api_key';
const BASE_URL     = 'https://api.openweathermap.org/data/2.5';
const ICON_URL     = 'https://openweathermap.org/img/wn';

const WIND_DIRS = ['Bắc','Đông Bắc','Đông','Đông Nam','Nam','Tây Nam','Tây','Tây Bắc'];

const state = {
  city:      '',
  unit:      'metric',   // 'metric' (°C) | 'imperial' (°F)
  current:   null,
  forecast:  null,
  isLoading: false,
  lastQuery: '',
};

// ════════════════════════════════════════
//  DOM REFERENCES
// ════════════════════════════════════════
const $ = id => document.getElementById(id);

const searchForm    = $('searchForm');
const searchInput   = $('searchInput');
const clearBtn      = $('clearBtn');
const locationBtn   = $('locationBtn');
const searchBtn     = $('searchBtn');

const loadingState  = $('loadingState');
const errorState    = $('errorState');
const errorMsg      = $('errorMsg');
const retryBtn      = $('retryBtn');
const emptyState    = $('emptyState');
const resultsSection = $('resultsSection');

// Current weather
const cityNameEl    = $('cityName');
const countryNameEl = $('countryName');
const localTimeEl   = $('localTime');
const weatherDescEl = $('weatherDesc');
const weatherIconEl = $('weatherIcon');
const currentTempEl = $('currentTemp');
const tempUnitEl    = $('tempUnit');
const feelsLikeEl   = $('feelsLike');
const humidityEl    = $('humidity');
const windSpeedEl   = $('windSpeed');
const pressureEl    = $('pressure');
const visibilityEl  = $('visibility');
const sunriseEl     = $('sunrise');
const sunsetEl      = $('sunset');
const tempMinMaxEl  = $('tempMinMax');

// Forecast
const hourlyScrollEl = $('hourlyScroll');
const dailyGridEl    = $('dailyGrid');

// Env indicators
const cloudinessEl  = $('cloudiness');
const cloudBarEl    = $('cloudBar');
const humidityEnvEl = $('humidityEnv');
const humidBarEl    = $('humidBar');
const windValueEl   = $('windValue');
const windDirEl     = $('windDirection');
const feelsLikeEnvEl= $('feelsLikeEnv');
const feelsLevelEl  = $('feelsLevel');

// Settings
const settingsBtn   = $('settingsBtn');
const settingsModal = $('settingsModal');
const closeSettings = $('closeSettings');
const cancelSettings= $('cancelSettings');
const saveSettings  = $('saveSettings');
const apiKeyInput   = $('apiKeyInput');
const toggleKeyVis  = $('toggleKeyVisibility');
const testKeyBtn    = $('testKeyBtn');
const testKeyResult = $('testKeyResult');

// Unit toggle
const unitToggleBtn = $('unitToggleBtn');
const unitLabelEl   = $('unitLabel');

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
//  TOAST
// ════════════════════════════════════════
let toastTimer = null;
function showToast(message, type = 'default', duration = 3000) {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toast.className = 'toast'; }, duration);
}

// ════════════════════════════════════════
//  UI STATE
// ════════════════════════════════════════
function setUIState(uiState) {
  loadingState.hidden  = uiState !== 'loading';
  errorState.hidden    = uiState !== 'error';
  emptyState.hidden    = uiState !== 'empty';
  resultsSection.hidden = uiState !== 'results';
}

function showError(message) {
  errorMsg.textContent = message;
  setUIState('error');
  resetSearchBtn();
  state.isLoading = false;
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

// ════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════
function tempLabel(val) {
  return state.unit === 'metric' ? `${Math.round(val)}°C` : `${Math.round(val)}°F`;
}

function windLabel(ms) {
  if (state.unit === 'metric') return `${Math.round(ms)} m/s`;
  // ms là m/s, đổi sang mph
  return `${Math.round(ms * 2.237)} mph`;
}

function windDegToDir(deg) {
  const idx = Math.round(deg / 45) % 8;
  return WIND_DIRS[idx];
}

function formatTime(unix, timezoneOffset) {
  // timezoneOffset là giây lệch UTC từ API
  const date = new Date((unix + timezoneOffset) * 1000);
  const hh = String(date.getUTCHours()).padStart(2, '0');
  const mm = String(date.getUTCMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(unix, timezoneOffset, opts = {}) {
  const date = new Date((unix + timezoneOffset) * 1000);
  const defaults = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' };
  return date.toLocaleDateString('vi-VN', { ...defaults, ...opts });
}

function getDayLabel(unix, timezoneOffset) {
  const now = new Date();
  const date = new Date((unix + timezoneOffset) * 1000);
  const nowDay  = new Date((Math.floor(now.getTime()/1000) + timezoneOffset) * 1000).toISOString().slice(0,10);
  const itemDay = new Date((unix + timezoneOffset) * 1000).toISOString().slice(0,10);

  if (itemDay === nowDay) return 'Hôm nay';
  return date.toLocaleDateString('vi-VN', { weekday: 'short', timeZone: 'UTC' });
}

function iconUrl(code, size = '2x') {
  return `${ICON_URL}/${code}@${size}.png`;
}

function uvLevel(uvi) {
  if (uvi <= 2) return { label: 'Thấp', color: '#4ade80' };
  if (uvi <= 5) return { label: 'Trung bình', color: '#fbbf24' };
  if (uvi <= 7) return { label: 'Cao', color: '#fb923c' };
  if (uvi <= 10) return { label: 'Rất cao', color: '#f87171' };
  return { label: 'Cực cao', color: '#c084fc' };
}

function feelsLabel(diff) {
  if (diff < -3) return '🥶 Lạnh hơn thực tế';
  if (diff > 3)  return '🥵 Nóng hơn thực tế';
  return '😊 Gần như thực tế';
}

// ════════════════════════════════════════
//  API CALLS
// ════════════════════════════════════════
async function fetchWeather(city) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  const units = state.unit;
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?q=${encodeURIComponent(city)}&units=${units}&lang=vi&appid=${apiKey}`),
    fetch(`${BASE_URL}/forecast?q=${encodeURIComponent(city)}&units=${units}&lang=vi&cnt=40&appid=${apiKey}`),
  ]);

  if (!currentRes.ok) {
    if (currentRes.status === 401) throw new Error('API_KEY_INVALID');
    if (currentRes.status === 404) throw new Error('CITY_NOT_FOUND');
    if (currentRes.status === 429) throw new Error('API_RATE_LIMIT');
    throw new Error(`HTTP_${currentRes.status}`);
  }

  const current  = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

async function fetchWeatherByCoords(lat, lon) {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('API_KEY_MISSING');

  const units = state.unit;
  const [currentRes, forecastRes] = await Promise.all([
    fetch(`${BASE_URL}/weather?lat=${lat}&lon=${lon}&units=${units}&lang=vi&appid=${apiKey}`),
    fetch(`${BASE_URL}/forecast?lat=${lat}&lon=${lon}&units=${units}&lang=vi&cnt=40&appid=${apiKey}`),
  ]);

  if (!currentRes.ok) {
    if (currentRes.status === 401) throw new Error('API_KEY_INVALID');
    if (currentRes.status === 429) throw new Error('API_RATE_LIMIT');
    throw new Error(`HTTP_${currentRes.status}`);
  }

  const current  = await currentRes.json();
  const forecast = await forecastRes.json();
  return { current, forecast };
}

// ════════════════════════════════════════
//  RENDER
// ════════════════════════════════════════
function renderCurrentWeather(data) {
  const tz = data.timezone; // seconds offset from UTC

  cityNameEl.textContent    = data.name;
  countryNameEl.textContent = data.sys.country ? `(${data.sys.country})` : '';

  // Thời gian địa phương
  const now = Math.floor(Date.now() / 1000);
  const localDate = new Date((now + tz) * 1000);
  localTimeEl.textContent = localDate.toUTCString().replace(' GMT', '').slice(0, -3)
    .replace(/(\w+), (\d+) (\w+) (\d+) (\d+:\d+)/, '$1, $2 $3 $4 — $5');
  // Đơn giản hơn:
  localTimeEl.textContent = `📅 ${formatDate(now, tz, { weekday:'long', day:'numeric', month:'long', year:'numeric' })} · ⏰ ${formatTime(now, tz)}`;

  weatherDescEl.textContent = data.weather[0].description;

  weatherIconEl.src = iconUrl(data.weather[0].icon, '4x');
  weatherIconEl.alt = data.weather[0].description;

  currentTempEl.textContent = Math.round(data.main.temp);
  tempUnitEl.textContent    = state.unit === 'metric' ? '°C' : '°F';
  tempUnitEl.id             = 'tempUnit'; // keep ref

  feelsLikeEl.textContent   = tempLabel(data.main.feels_like);
  humidityEl.textContent    = `${data.main.humidity}%`;
  windSpeedEl.textContent   = windLabel(data.wind.speed) + (data.wind.deg ? ` ${windDegToDir(data.wind.deg)}` : '');
  pressureEl.textContent    = `${data.main.pressure} hPa`;
  visibilityEl.textContent  = data.visibility ? `${(data.visibility / 1000).toFixed(1)} km` : '–';
  sunriseEl.textContent     = formatTime(data.sys.sunrise, tz);
  sunsetEl.textContent      = formatTime(data.sys.sunset, tz);
  tempMinMaxEl.textContent  = `${tempLabel(data.main.temp_min)} / ${tempLabel(data.main.temp_max)}`;

  // Env indicators
  const clouds = data.clouds?.all ?? 0;
  cloudinessEl.textContent  = `${clouds}%`;
  cloudBarEl.style.width    = `${clouds}%`;

  const humid = data.main.humidity;
  humidityEnvEl.textContent = `${humid}%`;
  humidBarEl.style.width    = `${humid}%`;

  const wspd = windLabel(data.wind.speed);
  windValueEl.textContent   = wspd;
  windDirEl.textContent     = data.wind.deg ? `Hướng: ${windDegToDir(data.wind.deg)}` : '';

  const diff = data.main.feels_like - data.main.temp;
  feelsLikeEnvEl.textContent = tempLabel(data.main.feels_like);
  feelsLevelEl.textContent   = feelsLabel(diff);
}

function renderHourly(forecastData, tz) {
  hourlyScrollEl.innerHTML = '';
  // Lấy 24h tới (8 mục × 3h = 24h)
  const items = forecastData.list.slice(0, 9);
  items.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'hourly-card' + (i === 0 ? ' highlight' : '');
    card.setAttribute('role', 'listitem');

    const pop = item.pop ? `💧 ${Math.round(item.pop * 100)}%` : '';
    card.innerHTML = `
      <span class="hourly-time">${i === 0 ? 'Bây giờ' : formatTime(item.dt, tz)}</span>
      <img class="hourly-icon" src="${iconUrl(item.weather[0].icon)}" alt="${item.weather[0].description}" loading="lazy"/>
      <span class="hourly-temp">${tempLabel(item.main.temp)}</span>
      ${pop ? `<span class="hourly-pop">${pop}</span>` : ''}
    `;
    hourlyScrollEl.appendChild(card);
  });
}

function renderDaily(forecastData, tz) {
  dailyGridEl.innerHTML = '';

  // Group by day
  const dayMap = {};
  forecastData.list.forEach(item => {
    const day = new Date((item.dt + tz) * 1000).toISOString().slice(0, 10);
    if (!dayMap[day]) dayMap[day] = [];
    dayMap[day].push(item);
  });

  const days = Object.keys(dayMap).slice(0, 5);
  const todayKey = new Date((Math.floor(Date.now()/1000) + tz) * 1000).toISOString().slice(0, 10);

  days.forEach(dayKey => {
    const items = dayMap[dayKey];
    const firstItem = items[0];
    const temps = items.map(i => i.main.temp);
    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const maxPop  = Math.max(...items.map(i => i.pop || 0));
    // Lấy icon của giữa ngày nếu có
    const noonItem = items.find(i => {
      const h = new Date((i.dt + tz) * 1000).getUTCHours();
      return h >= 11 && h <= 13;
    }) || firstItem;

    const card = document.createElement('div');
    card.className = 'daily-card' + (dayKey === todayKey ? ' today' : '');
    card.setAttribute('role', 'listitem');
    card.style.animationDelay = `${days.indexOf(dayKey) * 80}ms`;
    card.style.animation = 'fadeIn 0.5s ease both';

    card.innerHTML = `
      <span class="daily-day">${getDayLabel(firstItem.dt, tz)}</span>
      <img class="daily-icon" src="${iconUrl(noonItem.weather[0].icon)}" alt="${noonItem.weather[0].description}" loading="lazy"/>
      <span class="daily-desc">${noonItem.weather[0].description}</span>
      <div class="daily-temps">
        <span class="daily-high">${tempLabel(maxTemp)}</span>
        <span class="daily-sep">/</span>
        <span class="daily-low">${tempLabel(minTemp)}</span>
      </div>
      ${maxPop > 0 ? `<span class="daily-pop">💧 ${Math.round(maxPop * 100)}%</span>` : ''}
    `;
    dailyGridEl.appendChild(card);
  });
}

// ════════════════════════════════════════
//  SEARCH
// ════════════════════════════════════════
async function performSearch(city) {
  if (state.isLoading) return;
  if (!city) { searchInput.focus(); return; }

  state.isLoading  = true;
  state.lastQuery  = city;

  updateSearchBtn('Đang tải...');
  setUIState('loading');

  try {
    const { current, forecast } = await fetchWeather(city);

    state.current  = current;
    state.forecast = forecast;

    const tz = current.timezone;

    renderCurrentWeather(current);
    renderHourly(forecast, tz);
    renderDaily(forecast, tz);

    setUIState('results');
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

    searchInput.value = current.name;

  } catch (err) {
    handleError(err);
  } finally {
    resetSearchBtn();
    state.isLoading = false;
  }
}

async function performSearchByCoords(lat, lon) {
  if (state.isLoading) return;

  state.isLoading = true;
  updateSearchBtn('Đang định vị...');
  setUIState('loading');

  try {
    const { current, forecast } = await fetchWeatherByCoords(lat, lon);

    state.current  = current;
    state.forecast = forecast;

    const tz = current.timezone;

    renderCurrentWeather(current);
    renderHourly(forecast, tz);
    renderDaily(forecast, tz);

    setUIState('results');
    searchInput.value = current.name;
    clearBtn.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    handleError(err);
  } finally {
    resetSearchBtn();
    state.isLoading = false;
  }
}

function handleError(err) {
  const messages = {
    'API_KEY_MISSING': '⚠️ Chưa có API Key. Nhấn vào ⚙️ để thêm OpenWeatherMap API Key.',
    'API_KEY_INVALID': '🔑 API Key không hợp lệ hoặc chưa kích hoạt. Vui lòng kiểm tra lại.',
    'CITY_NOT_FOUND':  '🔍 Không tìm thấy thành phố. Hãy thử từ khóa khác.',
    'API_RATE_LIMIT':  '⏱️ Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.',
    'Failed to fetch': '🌐 Lỗi kết nối mạng. Vui lòng kiểm tra internet.',
  };

  const key = Object.keys(messages).find(k => err.message?.includes(k));
  const message = key ? messages[key] : `Đã xảy ra lỗi: ${err.message}`;

  if (err.message === 'API_KEY_MISSING') {
    showError(message);
    openSettingsModal();
  } else if (err.message === 'CITY_NOT_FOUND') {
    setUIState('empty');
    resetSearchBtn();
    state.isLoading = false;
  } else {
    showError(message);
  }
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
//  UNIT TOGGLE
// ════════════════════════════════════════
function toggleUnit() {
  state.unit = state.unit === 'metric' ? 'imperial' : 'metric';
  unitLabelEl.textContent = state.unit === 'metric' ? '°C' : '°F';
  // Re-fetch if data exists
  if (state.lastQuery) performSearch(state.lastQuery);
}

// ════════════════════════════════════════
//  EVENT LISTENERS
// ════════════════════════════════════════

// Search form
searchForm.addEventListener('submit', e => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q) performSearch(q);
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

// ── City Browser – Region Tabs ──
const regionTabs        = document.querySelectorAll('.region-tab');
const regionPanels      = document.querySelectorAll('.region-panel');
const cityBrowser       = document.querySelector('.city-browser');
const cityBrowserToggle = $('cityBrowserToggle');

regionTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const region = tab.dataset.region;
    regionTabs.forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected','false'); });
    regionPanels.forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.querySelector(`.region-panel[data-panel="${region}"]`)?.classList.add('active');
  });
});

cityBrowserToggle.addEventListener('click', () => {
  cityBrowser.classList.toggle('collapsed');
});

// City chips – dùng tọa độ GPS (data-lat / data-lon)
document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    const lat   = chip.dataset.lat;
    const lon   = chip.dataset.lon;
    const label = chip.dataset.label || chip.textContent.trim();

    searchInput.value = label;
    clearBtn.hidden   = false;

    // Highlight chip đang active
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active-city'));
    chip.classList.add('active-city');

    // Dùng tọa độ GPS thay vì tên thành phố để tránh nhầm lẫn
    if (lat && lon) {
      state.lastQuery = label;
      performSearchByCoords(parseFloat(lat), parseFloat(lon));
    } else {
      performSearch(label);
    }
  });
});

// Retry
retryBtn.addEventListener('click', () => {
  if (state.lastQuery) performSearch(state.lastQuery);
});

// Geolocation
locationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    showToast('⚠️ Trình duyệt không hỗ trợ định vị.', 'error');
    return;
  }
  showToast('📡 Đang lấy vị trí của bạn...', 'default', 5000);
  navigator.geolocation.getCurrentPosition(
    pos => performSearchByCoords(pos.coords.latitude, pos.coords.longitude),
    ()  => showToast('⚠️ Không thể lấy vị trí. Hãy cho phép truy cập.', 'error'),
  );
});

// Unit toggle
unitToggleBtn.addEventListener('click', toggleUnit);

// Keyboard navigation
document.addEventListener('keydown', e => {
  if (!settingsModal.hidden && e.key === 'Escape') closeSettingsModal();
});

// Settings
settingsBtn.addEventListener('click', openSettingsModal);
closeSettings.addEventListener('click', closeSettingsModal);
cancelSettings.addEventListener('click', closeSettingsModal);
settingsModal.addEventListener('click', e => {
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
  // Reset test result khi lưu
  testKeyResult.hidden = true;
  testKeyResult.className = 'test-key-result';
  // Auto-search
  if (state.lastQuery) performSearch(state.lastQuery);
  else performSearch('Hanoi');
});

toggleKeyVis.addEventListener('click', () => {
  const isPassword = apiKeyInput.type === 'password';
  apiKeyInput.type = isPassword ? 'text' : 'password';
  $('eyeIcon').innerHTML = isPassword
    ? `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>`
    : `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>`;
});

// Test API Key
testKeyBtn.addEventListener('click', async () => {
  const key = apiKeyInput.value.trim();
  if (!key) {
    testKeyResult.textContent = '⚠️ Vui lòng nhập API key trước.';
    testKeyResult.className = 'test-key-result fail';
    testKeyResult.hidden = false;
    return;
  }

  testKeyBtn.disabled = true;
  testKeyBtn.textContent = '⏳ Đang kiểm tra...';
  testKeyResult.textContent = '🔄 Đang gọi OpenWeatherMap API...';
  testKeyResult.className = 'test-key-result loading';
  testKeyResult.hidden = false;

  try {
    const res = await fetch(
      `${BASE_URL}/weather?q=London&units=metric&appid=${key}`
    );
    const data = await res.json();

    if (res.ok) {
      testKeyResult.textContent =
        `✅ API Key hợp lệ! Nhiệt độ London hiện tại: ${Math.round(data.main.temp)}°C. Key đang hoạt động tốt.`;
      testKeyResult.className = 'test-key-result ok';
    } else if (res.status === 401) {
      const msg = data?.message || '';
      testKeyResult.innerHTML =
        `❌ Lỗi 401 – Key chưa kích hoạt hoặc sai.<br/>
        <span style="font-weight:400;margin-top:4px;display:block">
          • Key mới cần <strong>10–120 phút</strong> để hoạt động sau khi đăng ký.<br/>
          • Hãy chắc chắn bạn copy đúng key (không thừa dấu cách).<br/>
          • Thử lại sau ít phút hoặc dùng key khác.
        </span>`;
      testKeyResult.className = 'test-key-result fail';
    } else {
      testKeyResult.textContent = `⚠️ Lỗi HTTP ${res.status}: ${data?.message || 'Không xác định'}`;
      testKeyResult.className = 'test-key-result fail';
    }
  } catch {
    testKeyResult.textContent = '🌐 Không thể kết nối. Hãy kiểm tra internet.';
    testKeyResult.className = 'test-key-result fail';
  } finally {
    testKeyBtn.disabled = false;
    testKeyBtn.textContent = '🔍 Kiểm tra Key';
  }
});

// ════════════════════════════════════════
//  INIT
// ════════════════════════════════════════
function init() {
  const savedKey = getApiKey();
  if (!savedKey) {
    setTimeout(() => {
      showToast('👋 Hãy thiết lập OpenWeatherMap API Key để bắt đầu!', 'default', 6000);
    }, 800);
  } else {
    // Auto-load Hà Nội khi đã có key
    setTimeout(() => performSearch('Hanoi'), 400);
  }
}

init();
