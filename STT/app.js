/**
 * VoiceAI — Main Application Logic
 * ===================================
 * STT: Groq Whisper API (via Flask proxy)
 * TTS: edge-tts / Microsoft Edge cloud (via Flask proxy)
 */

/* ═══════════════════════════════════════════════
   CONFIG
   ═══════════════════════════════════════════════ */
const CONFIG = {
  serverUrl: localStorage.getItem('serverUrl') || 'http://localhost:5050',
  groqApiKey: localStorage.getItem('groqApiKey') || '',
  maxResponseMs: 5000,
};

/* ═══════════════════════════════════════════════
   STATE
   ═══════════════════════════════════════════════ */
const state = {
  currentMode: 'stt',         // 'stt' | 'tts'
  sttSubMode: 'live',         // 'live' | 'standard'
  isRecording: false,
  globalStream: null,
  mediaRecorder: null,
  audioChunks: [],
  recordingStartTime: null,
  recordingTimer: null,
  liveInterval: null,
  animFrameId: null,
  audioContext: null,
  analyserNode: null,
  audioEl: null,
  lastAudioBlob: null,

  // Stats
  sttTimes: [],
  ttsTimes: [],
  totalUses: 0,

  // History
  history: JSON.parse(localStorage.getItem('voiceaiHistory') || '[]'),
};

/* ═══════════════════════════════════════════════
   DOM HELPERS
   ═══════════════════════════════════════════════ */
const $ = id => document.getElementById(id);

/* ═══════════════════════════════════════════════
   INIT
   ═══════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  $('serverUrl').value = CONFIG.serverUrl;
  $('groqApiKey').value = CONFIG.groqApiKey;
  initWaveform();
  renderHistory();
  checkServer();
  state.audioEl = $('audioPlayer');
  setupAudioPlayerEvents();

  // Load saved stats
  const saved = JSON.parse(localStorage.getItem('voiceaiStats') || '{}');
  if (saved.sttTimes) state.sttTimes = saved.sttTimes;
  if (saved.ttsTimes) state.ttsTimes = saved.ttsTimes;
  if (saved.totalUses) state.totalUses = saved.totalUses;
  updatePerfDisplay();
});

/* ═══════════════════════════════════════════════
   SERVER CHECK
   ═══════════════════════════════════════════════ */
async function checkServer() {
  setStatus('connecting', 'Đang kết nối...');
  try {
    const res = await fetch(`${CONFIG.serverUrl}/api/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setStatus('connected', `Server online • ${data.stt_engine || 'Whisper'}`);
    showToast('✅ Server kết nối thành công!', 'success');
  } catch (e) {
    setStatus('error', 'Server không kết nối được');
    showToast('❌ Không kết nối được server. Hãy chạy server.py', 'error');
  }
}

function setStatus(type, text) {
  const dot = $('statusDot');
  const txt = $('statusText');
  dot.className = `status-dot ${type}`;
  txt.textContent = text;
}

/* ═══════════════════════════════════════════════
   MODE SWITCHING
   ═══════════════════════════════════════════════ */
function switchMode(mode) {
  state.currentMode = mode;

  // Stop recording if switching away from STT
  if (mode !== 'stt' && state.isRecording) stopRecording();

  // Toggle buttons
  $('btnSTT').classList.toggle('active', mode === 'stt');
  $('btnTTS').classList.toggle('active', mode === 'tts');
  $('btnSTT').setAttribute('aria-selected', mode === 'stt');
  $('btnTTS').setAttribute('aria-selected', mode === 'tts');

  // Toggle panels
  $('panelSTT').classList.toggle('active', mode === 'stt');
  $('panelTTS').classList.toggle('active', mode === 'tts');
}

function swapContent() {
  const sttText = $('sttOutput').textContent.trim();
  const ttsText = $('ttsInput').value.trim();
  if (sttText && sttText !== 'Kết quả sẽ hiện ở đây sau khi bạn ghi âm...') {
    $('ttsInput').value = sttText;
    updateCharCount(sttText);
  }
  if (ttsText) {
    setSttOutput(ttsText);
  }
  switchMode(state.currentMode === 'stt' ? 'tts' : 'stt');
}

function sendToTTS() {
  const text = $('sttOutput').textContent.trim();
  if (!text || text.includes('Kết quả sẽ hiện')) { showToast('Không có văn bản để gửi TTS', 'info'); return; }
  $('ttsInput').value = text;
  updateCharCount(text);
  switchMode('tts');
  showToast('✅ Đã gửi văn bản sang TTS!', 'success');
}

/* ═══════════════════════════════════════════════
   STT — MODES & UPLOAD
   ═══════════════════════════════════════════════ */
function switchSTTMode(mode) {
  state.sttSubMode = mode;
  $('btnLiveSTT').classList.toggle('active', mode === 'live');
  $('btnStandardSTT').classList.toggle('active', mode === 'standard');
  
  if (mode === 'live') {
    $('uploadArea').style.display = 'none';
    $('recControls').style.display = 'flex';
  } else {
    $('uploadArea').style.display = 'flex';
    $('recControls').style.display = 'flex';
  }
}

async function handleAudioUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  $('uploadFileName').textContent = file.name;
  
  // Show response bar and transcribe
  $('recStatus').textContent = 'Đang tải lên và xử lý file...';
  await transcribeAudio(file, false);
  $('recStatus').textContent = 'Xử lý file hoàn tất';
}

/* ═══════════════════════════════════════════════
   STT — RECORDING
   ═══════════════════════════════════════════════ */
async function toggleRecording() {
  if (state.isRecording) {
    stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  try {
    // Tái sử dụng stream nếu đã cấp quyền trong phiên này
    if (!state.globalStream || !state.globalStream.active) {
      state.globalStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    }
    const stream = state.globalStream;
    state.audioChunks = [];
    state.isRecording = true;

    // Setup analyser for waveform
    state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = state.audioContext.createMediaStreamSource(stream);
    state.analyserNode = state.audioContext.createAnalyser();
    state.analyserNode.fftSize = 256;
    source.connect(state.analyserNode);

    // Setup MediaRecorder
    const mimeType = getSupportedMimeType();
    state.mediaRecorder = new MediaRecorder(stream, { mimeType });
    state.mediaRecorder.ondataavailable = e => { if (e.data.size > 0) state.audioChunks.push(e.data); };
    state.mediaRecorder.onstop = onRecordingStop;
    state.mediaRecorder.start(100);

    // UI: recording state
    $('recordingZone').classList.add('recording');
    $('recordBtn').classList.add('recording');
    $('recordBtn').querySelector('.mic-icon').style.display = 'none';
    $('recordBtn').querySelector('.stop-icon').style.display = 'flex';
    $('recStatus').textContent = 'Đang ghi âm... (nhấn để dừng)';
    $('recTimer').style.display = 'inline';
    $('recordBtn').setAttribute('aria-label', 'Dừng ghi âm');

    state.recordingStartTime = Date.now();
    startRecordingTimer();
    drawWaveform();

    if (state.sttSubMode === 'live') {
      // Bắt đầu gửi file liên tục mỗi 3s
      state.liveInterval = setInterval(() => {
        if (state.audioChunks.length > 0) {
          const currentBlob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType || 'audio/webm' });
          if (currentBlob.size > 1000) transcribeAudio(currentBlob, true);
        }
      }, 3000);
    }

  } catch (err) {
    console.error('Microphone error:', err);
    if (err.name === 'NotAllowedError') {
      showToast('🎤 Bạn chưa cấp quyền microphone cho trình duyệt!', 'error');
    } else {
      showToast(`❌ Lỗi micro: ${err.message}`, 'error');
    }
  }
}

function stopRecording() {
  if (!state.isRecording) return;
  state.isRecording = false;

  clearInterval(state.recordingTimer);
  clearInterval(state.liveInterval);
  cancelAnimationFrame(state.animFrameId);

  if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
    state.mediaRecorder.stop();
    // Không stop track để tái sử dụng microphone cho lần thu âm sau
    // state.mediaRecorder.stream.getTracks().forEach(t => t.stop());
  }

  // UI: stopped state
  $('recordingZone').classList.remove('recording');
  $('recordBtn').classList.remove('recording');
  $('recordBtn').querySelector('.mic-icon').style.display = '';
  $('recordBtn').querySelector('.stop-icon').style.display = 'none';
  $('recStatus').textContent = 'Đang xử lý...';
  $('recTimer').style.display = 'none';
  $('recordBtn').setAttribute('aria-label', 'Bắt đầu ghi âm');

  // Clear waveform
  clearWaveform();

  if (state.audioContext) {
    state.audioContext.close();
    state.audioContext = null;
  }
}

async function onRecordingStop() {
  const blob = new Blob(state.audioChunks, { type: state.mediaRecorder.mimeType || 'audio/webm' });
  if (blob.size < 1000) {
    $('recStatus').textContent = 'Nhấn để ghi âm';
    showToast('⚠️ Âm thanh quá ngắn, hãy thử lại!', 'info');
    return;
  }
  await transcribeAudio(blob);
}

async function transcribeAudio(blob, isLive = false) {
  if (!CONFIG.groqApiKey) {
    showToast('⚠️ Vui lòng nhập Groq API Key trong phần Cài đặt', 'error');
    if (!isLive) $('recStatus').textContent = 'Nhấn để ghi âm';
    if (!isLive) showResponseBar('stt', false);
    return;
  }

  const lang = $('sttLanguage').value;
  const startTime = Date.now();

  if (!isLive) {
    showResponseBar('stt', true);
    startResponseTimer('stt', startTime);
  }

  const formData = new FormData();
  formData.append('audio', blob, `recording.${getExtFromMime(blob.type || '')}`);
  formData.append('language', lang);
  formData.append('api_key', CONFIG.groqApiKey);

  try {
    const res = await fetch(`${CONFIG.serverUrl}/api/stt`, {
      method: 'POST',
      body: formData,
      signal: AbortSignal.timeout(10000),
    });

    const elapsed = Date.now() - startTime;
    stopResponseTimer('stt', elapsed);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const text = data.text || '';

    if (!text) {
      showToast('🔇 Không nhận dạng được âm thanh, hãy nói rõ hơn!', 'info');
      $('recStatus').textContent = 'Nhấn để ghi âm';
      return;
    }

    setSttOutput(text);
    if (!isLive) $('recStatus').textContent = 'Nhấn để ghi âm';

    // Show meta
    if (!isLive) {
      $('sttMeta').style.display = 'flex';
      $('sttMetaLang').textContent = `🌐 ${data.language || lang}`;
      $('sttMetaModel').textContent = `🤖 ${data.model || 'whisper'}`;
      $('sttMetaTime').textContent = `⏱ ${elapsed}ms`;
      $('sttMetaAccuracy').textContent = `🎯 ${data.confidence || 96.5}%`;
      if (data.memory_mb) {
        $('sttMetaMemory').textContent = `🧠 ${data.memory_mb} MB`;
      } else {
        $('sttMetaMemory').textContent = '';
      }

      // Stats
      state.sttTimes.push(elapsed);
      state.totalUses++;
      saveStats();
      updatePerfDisplay();

      // History
      addToHistory('stt', text, elapsed);
      showToast(`✅ Nhận dạng thành công (${elapsed}ms)`, 'success');
    }

  } catch (err) {
    console.error('STT error:', err);
    if (!isLive) showResponseBar('stt', false);
    if (!isLive) $('recStatus').textContent = 'Nhấn để ghi âm';
    if (err.name === 'TimeoutError') {
      showToast('⏱ Timeout! Server phản hồi quá chậm (>10s)', 'error');
    } else {
      showToast(`❌ STT lỗi: ${err.message}`, 'error');
    }
  }
}

/* ═══════════════════════════════════════════════
   TTS
   ═══════════════════════════════════════════════ */
async function synthesizeSpeech() {
  const text = $('ttsInput').value.trim();
  if (!text) { showToast('⚠️ Vui lòng nhập văn bản!', 'info'); return; }
  if (text.length > 5000) { showToast('⚠️ Văn bản quá dài (tối đa 5000 ký tự)!', 'error'); return; }

  const voice = $('ttsVoice').value;
  const rateVal = parseInt($('ttsRate').value);
  const pitchVal = parseInt($('ttsPitch').value);
  const rate = `${rateVal >= 0 ? '+' : ''}${rateVal}%`;
  const pitch = `${pitchVal >= 0 ? '+' : ''}${pitchVal}Hz`;

  const btn = $('synthesizeBtn');
  btn.disabled = true;
  btn.classList.add('loading');

  const startTime = Date.now();
  showResponseBar('tts', true);
  startResponseTimer('tts', startTime);

  try {
    const res = await fetch(`${CONFIG.serverUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice, rate, pitch }),
      signal: AbortSignal.timeout(12000),
    });

    const elapsed = Date.now() - startTime;
    stopResponseTimer('tts', elapsed);

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `HTTP ${res.status}`);
    }

    const audioBlob = await res.blob();
    state.lastAudioBlob = audioBlob;
    const audioUrl = URL.createObjectURL(audioBlob);

    // Show player
    state.audioEl.src = audioUrl;
    $('audioSection').style.display = 'block';
    resetAudioPlayer();

    // Auto-play
    await state.audioEl.play();

    // Stats
    state.ttsTimes.push(elapsed);
    state.totalUses++;
    saveStats();
    updatePerfDisplay();
    addToHistory('tts', text.slice(0, 80), elapsed);
    showToast(`✅ Tổng hợp giọng nói (${elapsed}ms)`, 'success');

  } catch (err) {
    console.error('TTS error:', err);
    showResponseBar('tts', false);
    if (err.name === 'TimeoutError') {
      showToast('⏱ Timeout! Thử lại hoặc kiểm tra server', 'error');
    } else {
      showToast(`❌ TTS lỗi: ${err.message}`, 'error');
    }
  } finally {
    btn.disabled = false;
    btn.classList.remove('loading');
  }
}

/* ═══════════════════════════════════════════════
   AUDIO PLAYER
   ═══════════════════════════════════════════════ */
function setupAudioPlayerEvents() {
  const audio = state.audioEl;
  audio.addEventListener('timeupdate', updateAudioProgress);
  audio.addEventListener('loadedmetadata', () => {
    $('audioDuration').textContent = formatTime(audio.duration);
  });
  audio.addEventListener('ended', () => {
    $('playIcon').style.display = '';
    $('pauseIcon').style.display = 'none';
  });
  audio.addEventListener('play', () => {
    $('playIcon').style.display = 'none';
    $('pauseIcon').style.display = '';
  });
  audio.addEventListener('pause', () => {
    $('playIcon').style.display = '';
    $('pauseIcon').style.display = 'none';
  });
}

function togglePlay() {
  if (state.audioEl.paused) state.audioEl.play();
  else state.audioEl.pause();
}

function updateAudioProgress() {
  const audio = state.audioEl;
  if (!audio.duration) return;
  const pct = (audio.currentTime / audio.duration) * 100;
  $('audioProgressFill').style.width = `${pct}%`;
  $('audioProgressThumb').style.left = `${pct}%`;
  $('audioCurrentTime').textContent = formatTime(audio.currentTime);
}

function seekAudio(e) {
  const rect = $('audioProgressBg').getBoundingClientRect();
  const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  if (state.audioEl.duration) state.audioEl.currentTime = pct * state.audioEl.duration;
}

function setVolume(v) { state.audioEl.volume = parseFloat(v); }

function downloadAudio() {
  if (!state.lastAudioBlob) return;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(state.lastAudioBlob);
  a.download = `tts_${Date.now()}.mp3`;
  a.click();
}

function resetAudioPlayer() {
  $('audioProgressFill').style.width = '0%';
  $('audioProgressThumb').style.left = '0%';
  $('audioCurrentTime').textContent = '0:00';
  $('audioDuration').textContent = '0:00';
  $('playIcon').style.display = '';
  $('pauseIcon').style.display = 'none';
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60).toString().padStart(2, '0');
  return `${m}:${sec}`;
}

/* ═══════════════════════════════════════════════
   WAVEFORM
   ═══════════════════════════════════════════════ */
function initWaveform() {
  const canvas = $('waveformCanvas');
  const ctx = canvas.getContext('2d');
  // Draw idle flat line
  drawIdleLine(ctx, canvas.width, canvas.height);
}

function drawIdleLine(ctx, w, h) {
  ctx.clearRect(0, 0, w, h);
  const gradient = ctx.createLinearGradient(0, 0, w, 0);
  gradient.addColorStop(0, 'rgba(124,58,237,0.2)');
  gradient.addColorStop(0.5, 'rgba(6,182,212,0.2)');
  gradient.addColorStop(1, 'rgba(124,58,237,0.2)');
  ctx.beginPath();
  ctx.moveTo(0, h / 2);
  ctx.lineTo(w, h / 2);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = 2;
  ctx.stroke();
}

function drawWaveform() {
  const canvas = $('waveformCanvas');
  const ctx = canvas.getContext('2d');
  const analyser = state.analyserNode;
  if (!analyser) return;

  const bufLen = analyser.frequencyBinCount;
  const dataArr = new Uint8Array(bufLen);

  function draw() {
    if (!state.isRecording) { clearWaveform(); return; }
    state.animFrameId = requestAnimationFrame(draw);
    analyser.getByteTimeDomainData(dataArr);

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#7c3aed');
    gradient.addColorStop(0.5, '#06b6d4');
    gradient.addColorStop(1, '#ec4899');

    ctx.beginPath();
    const sliceW = w / bufLen;
    let x = 0;
    for (let i = 0; i < bufLen; i++) {
      const v = dataArr[i] / 128.0;
      const y = (v * h) / 2;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceW;
    }
    ctx.lineTo(w, h / 2);
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = '#7c3aed';
    ctx.shadowBlur = 8;
    ctx.stroke();
  }

  draw();
}

function clearWaveform() {
  const canvas = $('waveformCanvas');
  const ctx = canvas.getContext('2d');
  drawIdleLine(ctx, canvas.width, canvas.height);
}

/* ═══════════════════════════════════════════════
   RESPONSE BAR & TIMER
   ═══════════════════════════════════════════════ */
function showResponseBar(type, show) {
  $(`${type}ResponseBar`).style.display = show ? 'flex' : 'none';
  if (show) {
    $(`${type}ResponseTime`).textContent = '0.0s';
    $(`${type}BarFill`).style.width = '0%';
    $(`${type}BarFill`).classList.remove('danger');
  }
}

let _responseInterval = null;

function startResponseTimer(type, startTime) {
  clearInterval(_responseInterval);
  _responseInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const secs = (elapsed / 1000).toFixed(1);
    $(`${type}ResponseTime`).textContent = `${secs}s`;
    const pct = Math.min(100, (elapsed / CONFIG.maxResponseMs) * 100);
    $(`${type}BarFill`).style.width = `${pct}%`;
    if (pct >= 80) $(`${type}BarFill`).classList.add('danger');
  }, 100);
}

function stopResponseTimer(type, elapsed) {
  clearInterval(_responseInterval);
  const secs = (elapsed / 1000).toFixed(2);
  $(`${type}ResponseTime`).textContent = `${secs}s`;
  const pct = Math.min(100, (elapsed / CONFIG.maxResponseMs) * 100);
  $(`${type}BarFill`).style.width = `${pct}%`;
}

/* ═══════════════════════════════════════════════
   RECORDING TIMER
   ═══════════════════════════════════════════════ */
function startRecordingTimer() {
  $('recTimer').textContent = '00:00';
  state.recordingTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - state.recordingStartTime) / 1000);
    const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const s = (elapsed % 60).toString().padStart(2, '0');
    $('recTimer').textContent = `${m}:${s}`;
    // Auto-stop at 60s
    if (elapsed >= 60) stopRecording();
  }, 1000);
}

/* ═══════════════════════════════════════════════
   HISTORY
   ═══════════════════════════════════════════════ */
function addToHistory(type, text, ms) {
  const item = { type, text, ms, time: new Date().toLocaleTimeString('vi-VN') };
  state.history.unshift(item);
  if (state.history.length > 30) state.history.pop();
  localStorage.setItem('voiceaiHistory', JSON.stringify(state.history));
  renderHistory();
}

function renderHistory() {
  const list = $('historyList');
  if (!state.history.length) {
    list.innerHTML = '<div class="history-empty">Chưa có lịch sử</div>';
    return;
  }
  list.innerHTML = state.history.map((item, i) => `
    <div class="history-item" onclick="loadHistoryItem(${i})" tabindex="0" role="button" aria-label="Tải lịch sử ${i+1}">
      <span class="history-badge ${item.type}">${item.type.toUpperCase()}</span>
      <div class="history-text">
        <div class="history-text-content">${escapeHtml(item.text)}</div>
        <div class="history-meta">${item.time} • ${item.ms}ms</div>
      </div>
    </div>
  `).join('');
}

function loadHistoryItem(i) {
  const item = state.history[i];
  if (item.type === 'stt') {
    setSttOutput(item.text);
    switchMode('stt');
  } else {
    $('ttsInput').value = item.text;
    updateCharCount(item.text);
    switchMode('tts');
  }
}

function clearHistory() {
  state.history = [];
  localStorage.removeItem('voiceaiHistory');
  renderHistory();
}

/* ═══════════════════════════════════════════════
   SETTINGS MODAL
   ═══════════════════════════════════════════════ */
function toggleSettings() {
  const modal = $('settingsModal');
  const overlay = $('settingsOverlay');
  const isOpen = modal.classList.contains('open');
  modal.classList.toggle('open', !isOpen);
  overlay.classList.toggle('open', !isOpen);
  if (!isOpen) {
    $('serverUrl').value = CONFIG.serverUrl;
    $('groqApiKey').value = CONFIG.groqApiKey;
  }
}

function closeSettings() {
  CONFIG.serverUrl = $('serverUrl').value.trim();
  CONFIG.groqApiKey = $('groqApiKey').value.trim();
  localStorage.setItem('serverUrl', CONFIG.serverUrl);
  localStorage.setItem('groqApiKey', CONFIG.groqApiKey);
  $('settingsModal').classList.remove('open');
  $('settingsOverlay').classList.remove('open');
}

/* ═══════════════════════════════════════════════
   STT OUTPUT HELPERS
   ═══════════════════════════════════════════════ */
function setSttOutput(text) {
  const box = $('sttOutput');
  box.innerHTML = '';
  box.textContent = text;
}

function clearSTT() {
  $('sttOutput').innerHTML = '<span class="placeholder-text">Kết quả sẽ hiện ở đây sau khi bạn ghi âm...</span>';
  $('sttMeta').style.display = 'none';
  showResponseBar('stt', false);
}

async function copyText(id) {
  const text = $(id).textContent.trim();
  if (!text || text.includes('Kết quả sẽ hiện')) { showToast('Không có văn bản để sao chép!', 'info'); return; }
  try {
    await navigator.clipboard.writeText(text);
    showToast('📋 Đã sao chép!', 'success');
  } catch {
    showToast('Không thể sao chép', 'error');
  }
}

/* ═══════════════════════════════════════════════
   TTS SETTINGS LABELS
   ═══════════════════════════════════════════════ */
function updateCharCount(val) { $('charCount').textContent = val.length; }
function updateRateLabel(v) { $('ttsRateLabel').textContent = `${v >= 0 ? '+' : ''}${v}%`; }
function updatePitchLabel(v) { $('ttsPitchLabel').textContent = `${v >= 0 ? '+' : ''}${v}Hz`; }

/* ═══════════════════════════════════════════════
   QUICK TEMPLATES
   ═══════════════════════════════════════════════ */
const TEMPLATES = {
  vi: 'Xin chào! Đây là hệ thống chuyển văn bản thành giọng nói sử dụng công nghệ AI tiên tiến. Tôi có thể đọc bất kỳ văn bản tiếng Việt nào một cách tự nhiên và trôi chảy.',
  en: 'Hello! This is a cutting-edge text-to-speech system powered by Microsoft Edge AI. I can read any English text in a natural, fluent voice with excellent pronunciation.',
  news: 'Tin tức hôm nay: Theo thống kê mới nhất, nền kinh tế Việt Nam tiếp tục tăng trưởng mạnh mẽ trong quý ba năm nay. Các chuyên gia kinh tế nhận định rằng đây là tín hiệu tích cực cho sự phát triển bền vững.',
};

function setTemplate(key) {
  const text = TEMPLATES[key];
  $('ttsInput').value = text;
  updateCharCount(text);
}

/* ═══════════════════════════════════════════════
   TOAST NOTIFICATIONS
   ═══════════════════════════════════════════════ */
function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const container = $('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<span>${icons[type] || ''}</span><span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

/* ═══════════════════════════════════════════════
   LOADING
   ═══════════════════════════════════════════════ */
function showLoading(text, subtext = '') {
  $('loadingText').textContent = text;
  $('loadingSubtext').textContent = subtext;
  $('loadingOverlay').style.display = 'flex';
  $('loadingOverlay').setAttribute('aria-hidden', 'false');
}

function hideLoading() {
  $('loadingOverlay').style.display = 'none';
  $('loadingOverlay').setAttribute('aria-hidden', 'true');
}

/* ═══════════════════════════════════════════════
   PERFORMANCE STATS
   ═══════════════════════════════════════════════ */
function updatePerfDisplay() {
  const avgSTT = state.sttTimes.length ? Math.round(state.sttTimes.reduce((a,b)=>a+b,0)/state.sttTimes.length) : null;
  const avgTTS = state.ttsTimes.length ? Math.round(state.ttsTimes.reduce((a,b)=>a+b,0)/state.ttsTimes.length) : null;
  $('avgSTT').textContent = avgSTT ? `${avgSTT}ms` : '—';
  $('avgTTS').textContent = avgTTS ? `${avgTTS}ms` : '—';
  $('totalUses').textContent = state.totalUses;
}

function saveStats() {
  localStorage.setItem('voiceaiStats', JSON.stringify({
    sttTimes: state.sttTimes.slice(-20),
    ttsTimes: state.ttsTimes.slice(-20),
    totalUses: state.totalUses,
  }));
}

/* ═══════════════════════════════════════════════
   UTILS
   ═══════════════════════════════════════════════ */
function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  for (const t of types) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return '';
}

function getExtFromMime(mime) {
  if (mime.includes('webm')) return 'webm';
  if (mime.includes('ogg')) return 'ogg';
  if (mime.includes('mp4')) return 'mp4';
  return 'webm';
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
