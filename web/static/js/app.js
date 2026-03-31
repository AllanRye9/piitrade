/**
 * app.js – main application entry point
 *
 * Wires together:
 *  - File upload / drag-and-drop
 *  - PresentationViewer (slide rendering)
 *  - VoiceController    (Web Speech API, mirrors original v5.3.1 commands)
 *  - File management system (multi-file library, switch / delete)
 *  - ML learning        (records command usage, renders suggestion chips)
 *  - Landscape / portrait toggle
 *  - Colour theme selection
 *  - Read Aloud (Text-to-Speech) with voice, speed, and language options
 *  - AI slide analysis  (keyword extraction, summary, sentiment, reading time)
 */

import { VoiceController } from './voice.js';
import { PresentationViewer } from './presentation.js';

// ─── DOM references ──────────────────────────────────────────────────────
const $uploadScreen      = document.getElementById('upload-screen');
const $presentationScreen= document.getElementById('presentation-screen');
const $dropZone          = document.getElementById('drop-zone');
const $fileInput         = document.getElementById('file-input');
const $fileInputPres     = document.getElementById('file-input-pres');
const $uploadProgress    = document.getElementById('upload-progress');
const $progressFill      = document.getElementById('progress-fill');
const $progressLabel     = document.getElementById('progress-label');
const $errorToast        = document.getElementById('error-toast');
const $appToastContainer = document.getElementById('app-toast-container');
const $fileName          = document.getElementById('file-name');
const $btnVoice          = document.getElementById('btn-voice');
const $voiceStatus       = document.getElementById('voice-status');
const $langSelect        = document.getElementById('lang-select');
const $helpModal         = document.getElementById('help-modal');
const $btnHelp           = document.getElementById('btn-help');
const $btnHelpClose      = document.getElementById('btn-help-close');
const $btnFullscreen     = document.getElementById('btn-fullscreen');
const $btnBlackout       = document.getElementById('btn-blackout');
const $btnPanel          = document.getElementById('btn-panel');
const $btnFiles          = document.getElementById('btn-files');
const $btnNotes          = document.getElementById('btn-notes');
const $btnPen            = document.getElementById('btn-pen');
const $btnEraser         = document.getElementById('btn-eraser');
const $btnPointer        = document.getElementById('btn-pointer');
const $btnZoomIn         = document.getElementById('btn-zoom-in');
const $btnZoomOut        = document.getElementById('btn-zoom-out');
const $btnZoomReset      = document.getElementById('btn-zoom-reset');
const $btnNewUpload      = document.getElementById('btn-new-upload');
const $btnChooseFile     = document.getElementById('btn-choose-file');
const $navPrev           = document.getElementById('nav-prev');
const $navNext           = document.getElementById('nav-next');
const $fileSidebar       = document.getElementById('file-library-sidebar');
const $libSidebarList    = document.getElementById('lib-sidebar-list');
const $fileLibraryList   = document.getElementById('file-library-list');
const $fileLibraryEmpty  = document.getElementById('file-library-empty');
const $suggestionChips   = document.getElementById('suggestion-chips');
const $slideStage        = document.getElementById('slide-stage');

// New feature DOM refs
const $btnLandscape      = document.getElementById('btn-landscape');
const $btnTheme          = document.getElementById('btn-theme');
const $themePicker       = document.getElementById('theme-picker');
const $btnReadAloud      = document.getElementById('btn-read-aloud');
const $ttsPanel          = document.getElementById('tts-panel');
const $ttsVoiceSelect    = document.getElementById('tts-voice-select');
const $ttsRate           = document.getElementById('tts-rate');
const $ttsRateLabel      = document.getElementById('tts-rate-label');
const $ttsLangSelect     = document.getElementById('tts-lang-select');
const $btnTtsPlay        = document.getElementById('btn-tts-play');
const $btnTtsStop        = document.getElementById('btn-tts-stop');
const $btnAi             = document.getElementById('btn-ai');
const $aiPanel           = document.getElementById('ai-panel');
const $btnAiAnalyze      = document.getElementById('btn-ai-analyze');
const $btnAiAnalyzeChart = document.getElementById('btn-ai-analyze-chart');
const $btnAiClose        = document.getElementById('btn-ai-close');
const $aiResults         = document.getElementById('ai-results');
const $penOptions        = document.getElementById('pen-options');

// ─── state ───────────────────────────────────────────────────────────────
let _currentFileId = null;    // UUID of the currently-presented file
let _currentLang   = 'en';    // selected recognition language
let _isPortrait    = false;   // landscape (16:9) by default

// ─── core instances ──────────────────────────────────────────────────────
const viewer = new PresentationViewer({
  onSlideChange: (current, total) => {
    document.getElementById('slide-counter').textContent = `${current} / ${total}`;
    _updateChartButton();
  },
});

const voice = new VoiceController({
  lang: 'en-US',
  continuous: true,
  onCommand:    handleVoiceCommand,
  onTranscript: (t) => setVoiceStatus(`"${t}"`),
  onStatus:     (s) => setVoiceStatus(s),
});

// ─── upload ───────────────────────────────────────────────────────────────

$dropZone.addEventListener('click', (e) => {
  // Prevent double-open when the "Choose File" button inside the drop zone is clicked
  if (e.target.closest('button')) return;
  $fileInput.click();
});
$dropZone.addEventListener('dragover',  (e) => { e.preventDefault(); $dropZone.classList.add('drag-over'); });
$dropZone.addEventListener('dragleave', ()  => $dropZone.classList.remove('drag-over'));
$dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  $dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) uploadFile(file);
});

$btnChooseFile.addEventListener('click', (e) => {
  e.stopPropagation();
  $fileInput.click();
});

$fileInput.addEventListener('change', () => {
  if ($fileInput.files[0]) uploadFile($fileInput.files[0]);
  $fileInput.value = '';
});

// Upload from within the presentation screen (file sidebar)
$fileInputPres.addEventListener('change', () => {
  if ($fileInputPres.files[0]) uploadFile($fileInputPres.files[0], /* switchTo */ true);
  $fileInputPres.value = '';
});

$btnNewUpload.addEventListener('click', () => {
  voice.stop();
  $presentationScreen.classList.remove('active');
  $uploadScreen.style.display = 'flex';
  refreshLibraryUploadScreen();
});

async function uploadFile(file, switchTo = true) {
  const form = new FormData();
  form.append('file', file);

  showProgress('Uploading…', 15);

  try {
    let pct = 15;
    const ticker = setInterval(() => {
      pct = Math.min(pct + 5, 85);
      showProgress('Processing…', pct);
    }, 300);

    const res = await fetch('/upload', { method: 'POST', body: form });
    clearInterval(ticker);

    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Upload failed');

    showProgress('Done!', 100);
    await sleep(400);

    if (switchTo) {
      loadPresentation(data);
      showToast('success', '✅', 'File uploaded', data.filename);
    } else {
      hideProgress();
      showToast('success', '✅', 'File added to library', data.filename);
    }

    // refresh both library views
    refreshLibraryUploadScreen();
    refreshLibrarySidebar();
  } catch (err) {
    hideProgress();
    showError(err.message);
  }
}

function loadPresentation(data) {
  hideProgress();
  _currentFileId = data.file_id || null;
  $fileName.textContent = data.filename;
  viewer.load(data.slides);

  $uploadScreen.style.display = 'none';
  $presentationScreen.classList.add('active');

  refreshLibrarySidebar();
  loadSuggestions();
}

// ─── file management ─────────────────────────────────────────────────────

async function refreshLibraryUploadScreen() {
  try {
    const res  = await fetch('/api/files');
    const data = await res.json();
    renderLibraryUploadScreen(data.files || []);
  } catch (_) { /* ignore network errors */ }
}

function renderLibraryUploadScreen(files) {
  $fileLibraryEmpty.style.display = files.length ? 'none' : '';
  $fileLibraryList.innerHTML = '';
  files.forEach(f => {
    const item = document.createElement('div');
    item.className = 'lib-item';

    const thumbHtml = f.thumbnail
      ? `<img src="${f.thumbnail}" alt=""/>`
      : `<span class="lib-thumb-icon">${fileIcon(f.filename)}</span>`;

    item.innerHTML = `
      <div class="lib-item-thumb">${thumbHtml}</div>
      <div class="lib-item-info">
        <div class="lib-item-name">${_esc(f.filename)}</div>
        <div class="lib-item-meta">${f.total_slides} slide${f.total_slides !== 1 ? 's' : ''}</div>
      </div>
      <div class="lib-item-actions">
        <button class="lib-btn-open">Open</button>
        <button class="lib-btn-delete">✕</button>
      </div>`;

    item.querySelector('.lib-btn-open').addEventListener('click', (e) => {
      e.stopPropagation();
      openFileById(f.id);
    });
    item.querySelector('.lib-btn-delete').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFile(f.id, () => refreshLibraryUploadScreen());
    });
    item.addEventListener('click', () => openFileById(f.id));

    $fileLibraryList.appendChild(item);
  });
}

async function refreshLibrarySidebar() {
  try {
    const res  = await fetch('/api/files');
    const data = await res.json();
    renderLibrarySidebar(data.files || []);
  } catch (_) { /* ignore */ }
}

function renderLibrarySidebar(files) {
  $libSidebarList.innerHTML = '';
  files.forEach(f => {
    const item = document.createElement('div');
    item.className = 'lib-sidebar-item' + (f.id === _currentFileId ? ' active' : '');

    const thumbHtml = f.thumbnail
      ? `<img src="${f.thumbnail}" alt=""/>`
      : `<span style="font-size:1.2rem">${fileIcon(f.filename)}</span>`;

    item.innerHTML = `
      <div class="lib-sidebar-thumb">${thumbHtml}</div>
      <div class="lib-sidebar-name" title="${_esc(f.filename)}">${_esc(f.filename)}</div>
      <div class="lib-sidebar-meta">${f.total_slides} slide${f.total_slides !== 1 ? 's' : ''}</div>
      <button class="lib-sidebar-del">Remove</button>`;

    item.addEventListener('click', (e) => {
      if (e.target.classList.contains('lib-sidebar-del')) return;
      openFileById(f.id);
    });
    item.querySelector('.lib-sidebar-del').addEventListener('click', (e) => {
      e.stopPropagation();
      deleteFile(f.id, () => { refreshLibrarySidebar(); refreshLibraryUploadScreen(); });
    });

    $libSidebarList.appendChild(item);
  });
}

async function openFileById(fileId) {
  try {
    showProgress('Loading…', 30);
    const res  = await fetch(`/api/files/${fileId}`);
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'File not found');
    showProgress('Done!', 100);
    await sleep(300);
    loadPresentation(data);
    showToast('info', '📂', 'File opened', data.filename);
  } catch (err) {
    hideProgress();
    showError(err.message);
  }
}

async function deleteFile(fileId, onDone) {
  try {
    await fetch(`/api/files/${fileId}`, { method: 'DELETE' });
    if (fileId === _currentFileId) _currentFileId = null;
    showToast('warn', '🗑️', 'File deleted');
    onDone?.();
  } catch (err) {
    showError(err.message);
  }
}

function fileIcon(filename) {
  const ext = filename.split('.').pop().toLowerCase();
  const icons = { pdf: '📄', docx: '📝', doc: '📝', xlsx: '📊', xls: '📊',
                  txt: '📃', png: '🖼️', jpg: '🖼️', jpeg: '🖼️', gif: '🖼️',
                  bmp: '🖼️', webp: '🖼️' };
  return icons[ext] || '📁';
}

// ─── file sidebar toggle ─────────────────────────────────────────────────

$btnFiles.addEventListener('click', () => {
  $fileSidebar.classList.toggle('hidden');
  $btnFiles.classList.toggle('active', !$fileSidebar.classList.contains('hidden'));
  if (!$fileSidebar.classList.contains('hidden')) refreshLibrarySidebar();
});

// ─── landscape / portrait toggle ─────────────────────────────────────────

$btnLandscape.addEventListener('click', () => {
  _isPortrait = !_isPortrait;
  $slideStage.classList.toggle('portrait', _isPortrait);
  $btnLandscape.classList.toggle('active', _isPortrait);
  $btnLandscape.classList.toggle('portrait', _isPortrait);
  $btnLandscape.title = _isPortrait
    ? 'Switch to landscape (16:9)'
    : 'Switch to portrait (4:3)';
});

// ─── colour theme ─────────────────────────────────────────────────────────

let _currentTheme = 'dark';

$btnTheme.addEventListener('click', (e) => {
  e.stopPropagation();
  $themePicker.classList.toggle('hidden');
});

// Close theme picker when clicking outside
document.addEventListener('click', (e) => {
  if (!$themePicker.contains(e.target) && e.target !== $btnTheme) {
    $themePicker.classList.add('hidden');
  }
});

$themePicker.querySelectorAll('.theme-swatch').forEach(btn => {
  btn.addEventListener('click', () => {
    const theme = btn.dataset.theme;
    applyTheme(theme);
    $themePicker.classList.add('hidden');
  });
});

function applyTheme(theme) {
  _currentTheme = theme;
  // 'dark' is the default (:root), so remove data-theme for it
  if (theme === 'dark') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
  // update active swatch
  $themePicker.querySelectorAll('.theme-swatch').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.theme === theme);
  });
  $btnTheme.classList.toggle('active', theme !== 'dark');
  // persist choice
  try { localStorage.setItem('yot-theme', theme); } catch (_) {}
  showToast('info', '🎨', 'Theme changed', theme.charAt(0).toUpperCase() + theme.slice(1));
}

// Restore saved theme (silently, no toast on page load)
try {
  const saved = localStorage.getItem('yot-theme');
  if (saved) {
    _currentTheme = saved;
    if (saved === 'dark') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', saved);
    }
    $themePicker.querySelectorAll('.theme-swatch').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.theme === saved);
    });
    $btnTheme.classList.toggle('active', saved !== 'dark');
  }
} catch (_) {}

// ─── Read Aloud (TTS) ─────────────────────────────────────────────────────

let _ttsSpeaking = false;

// Populate voice list once available
function populateTtsVoices() {
  const voices = window.speechSynthesis?.getVoices() || [];
  if (!voices.length) return;
  $ttsVoiceSelect.innerHTML = '<option value="">Default voice</option>';
  voices.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = `${v.name} (${v.lang})`;
    $ttsVoiceSelect.appendChild(opt);
  });
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = populateTtsVoices;
  populateTtsVoices();
}

$btnReadAloud.addEventListener('click', () => {
  $ttsPanel.classList.toggle('hidden');
  const open = !$ttsPanel.classList.contains('hidden');
  $btnReadAloud.classList.toggle('active', open);
  if (open) showToast('info', '🔊', 'Read Aloud panel opened');
});

$ttsRate.addEventListener('input', () => {
  $ttsRateLabel.textContent = `${parseFloat($ttsRate.value).toFixed(1)}×`;
});

$btnTtsPlay.addEventListener('click', () => readCurrentSlideAloud());
$btnTtsStop.addEventListener('click', () => {
  window.speechSynthesis?.cancel();
  _ttsSpeaking = false;
  $btnTtsPlay.textContent = '▶ Read Slide';
});

function readCurrentSlideAloud() {
  if (!window.speechSynthesis) {
    showError('Text-to-speech is not supported in this browser.');
    return;
  }
  window.speechSynthesis.cancel();

  const text = viewer.getCurrentSlideText();
  if (!text) { showError('No text content to read on this slide.'); return; }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = parseFloat($ttsRate.value);

  // Voice selection
  const voiceIdx = parseInt($ttsVoiceSelect.value, 10);
  if (!isNaN(voiceIdx)) {
    const voices = window.speechSynthesis.getVoices();
    if (voices[voiceIdx]) utterance.voice = voices[voiceIdx];
  }

  // Language override
  const langOverride = $ttsLangSelect.value;
  if (langOverride) utterance.lang = langOverride;

  utterance.onstart = () => {
    _ttsSpeaking = true;
    $btnTtsPlay.textContent = '⏸ Reading…';
    showToast('info', '🔊', 'Reading slide aloud…');
  };
  utterance.onend = () => {
    _ttsSpeaking = false;
    $btnTtsPlay.textContent = '▶ Read Slide';
  };
  utterance.onerror = () => {
    _ttsSpeaking = false;
    $btnTtsPlay.textContent = '▶ Read Slide';
  };

  window.speechSynthesis.speak(utterance);
}

// ─── AI analysis ──────────────────────────────────────────────────────────

$btnAi.addEventListener('click', () => {
  $aiPanel.classList.toggle('hidden');
  $btnAi.classList.toggle('active', !$aiPanel.classList.contains('hidden'));
  if (!$aiPanel.classList.contains('hidden')) _updateChartButton();
});

$btnAiClose.addEventListener('click', () => {
  $aiPanel.classList.add('hidden');
  $btnAi.classList.remove('active');
});

$btnAiAnalyze.addEventListener('click', () => analyzeCurrentSlide());
$btnAiAnalyzeChart.addEventListener('click', () => analyzeCurrentChart());

/** Show/hide the "Analyze Chart" button depending on the current slide type. */
function _updateChartButton() {
  const slide = viewer.getCurrentSlide();
  const isImage = slide && slide.type === 'image';
  $btnAiAnalyzeChart.classList.toggle('hidden', !isImage);
  $btnAiAnalyze.classList.toggle('hidden', isImage);
}

async function analyzeCurrentSlide() {
  const text = viewer.getCurrentSlideText();
  if (!text) {
    $aiResults.innerHTML = '<span style="color:var(--text2)">No text content on this slide to analyze.</span>';
    return;
  }

  $aiResults.innerHTML = '<span style="color:var(--text2)">🔄 Analyzing…</span>';

  try {
    const res  = await fetch('/api/ai/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Analysis failed');
    renderAiResults(data);
    showToast('success', '🧠', 'AI analysis complete');
  } catch (err) {
    $aiResults.innerHTML = `<span style="color:var(--danger)">Error: ${_esc(err.message)}</span>`;
    showToast('error', '❌', 'AI analysis failed', err.message);
  }
}

async function analyzeCurrentChart() {
  const slide = viewer.getCurrentSlide();
  if (!slide || slide.type !== 'image' || !slide.image) {
    $aiResults.innerHTML = '<span style="color:var(--text2)">No chart image on this slide.</span>';
    return;
  }

  $aiResults.innerHTML = '<span style="color:var(--text2)">🔄 Analyzing chart…</span>';

  try {
    const res  = await fetch('/api/ai/analyze-chart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: slide.image }),
    });
    const data = await res.json();
    if (!res.ok || data.error) throw new Error(data.error || 'Chart analysis failed');
    renderChartResults(data);
    showToast('success', '📊', 'Chart analysis complete');
  } catch (err) {
    $aiResults.innerHTML = `<span style="color:var(--danger)">Error: ${_esc(err.message)}</span>`;
    showToast('error', '❌', 'Chart analysis failed', err.message);
  }
}

function renderChartResults(data) {
  const typeEmoji = { bar: '📊', pie: '🥧', line: '📈', scatter: '🔵', unknown: '❓' };
  const emoji = typeEmoji[data.chart_type_hint] || '❓';

  const colorsHtml = (data.dominant_colors || []).map(c =>
    `<span class="chart-color-swatch" style="background:${_esc(c)}" title="${_esc(c)}"></span>`
  ).join('');

  $aiResults.innerHTML = `
    <div class="ai-meta" style="flex-wrap:wrap">
      <div class="ai-meta-item">
        <span class="ai-meta-value">${emoji} ${_esc(data.chart_type_hint)}</span>
        <span class="ai-meta-label">Chart type</span>
      </div>
      <div class="ai-meta-item">
        <span class="ai-meta-value">${data.width} × ${data.height}</span>
        <span class="ai-meta-label">Dimensions</span>
      </div>
      <div class="ai-meta-item">
        <span class="ai-meta-value">${data.brightness}</span>
        <span class="ai-meta-label">Brightness</span>
      </div>
      <div class="ai-meta-item">
        <span class="ai-meta-value">${data.colorfulness}</span>
        <span class="ai-meta-label">Colorfulness</span>
      </div>
      <div class="ai-meta-item">
        <span class="ai-meta-value">${data.has_white_background ? 'Yes' : 'No'}</span>
        <span class="ai-meta-label">White bg</span>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="ai-section-title">Dominant Colors</div>
      <div class="chart-color-swatches">${colorsHtml}</div>
    </div>`;
}

function renderAiResults(data) {
  const sentimentClass = `ai-sentiment-${data.sentiment}`;
  const sentimentEmoji = data.sentiment === 'positive' ? '😊' : data.sentiment === 'negative' ? '😟' : '😐';

  const keywordsHtml = (data.keywords || []).map(kw =>
    `<span class="ai-keyword">${_esc(kw.word)}<span class="kw-score">${(kw.score * 100).toFixed(0)}%</span></span>`
  ).join('');

  $aiResults.innerHTML = `
    <div>
      <div class="ai-section-title">Keywords</div>
      <div class="ai-keywords">${keywordsHtml || '<em>—</em>'}</div>
    </div>
    <div>
      <div class="ai-section-title">Summary</div>
      <div class="ai-summary">${_esc(data.summary || '—')}</div>
    </div>
    <div class="ai-meta">
      <div class="ai-meta-item">
        <span class="ai-meta-value ${sentimentClass}">${sentimentEmoji} ${_esc(data.sentiment)}</span>
        <span class="ai-meta-label">Sentiment</span>
      </div>
      <div class="ai-meta-item">
        <span class="ai-meta-value">${data.word_count}</span>
        <span class="ai-meta-label">Words</span>
      </div>
      <div class="ai-meta-item">
        <span class="ai-meta-value">${data.reading_time_seconds}s</span>
        <span class="ai-meta-label">Read time</span>
      </div>
    </div>`;
}

// ─── ML learning & suggestions ────────────────────────────────────────────

async function sendLearnSignal(command, text, confidence) {
  try {
    await fetch('/api/learn', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, text, lang: _currentLang, confidence }),
    });
  } catch (_) { /* non-critical */ }
}

async function loadSuggestions() {
  try {
    const res  = await fetch('/api/suggestions?limit=5');
    const data = await res.json();
    renderSuggestions(data.suggestions || []);
  } catch (_) { /* ignore */ }
}

function renderSuggestions(suggestions) {
  $suggestionChips.innerHTML = '';
  if (!suggestions.length) return;

  const label = document.createElement('span');
  label.style.cssText = 'font-size:.72rem;color:var(--text2);white-space:nowrap;';
  label.textContent = '🧠';
  $suggestionChips.appendChild(label);

  suggestions.forEach(s => {
    const chip = document.createElement('button');
    chip.className = 'suggestion-chip';
    chip.title = `Used ${s.count} time${s.count !== 1 ? 's' : ''}`;
    chip.innerHTML = `${_esc(s.command.replace(/_/g, ' '))}<span class="chip-count">${s.count}</span>`;
    chip.addEventListener('click', () => {
      // Execute the command directly
      handleVoiceCommand({ action: s.command, text: s.command.replace(/_/g, ' '), confidence: 1.0 });
    });
    $suggestionChips.appendChild(chip);
  });
}

// ─── voice commands ───────────────────────────────────────────────────────

function handleVoiceCommand(cmd) {
  const label = document.createElement('span');
  label.className = 'action-tag';
  label.textContent = cmd.action.replace(/_/g, ' ');

  const msg = document.createElement('span');
  msg.textContent = ` "${cmd.text}"`;

  $voiceStatus.innerHTML = '';
  $voiceStatus.appendChild(label);
  $voiceStatus.appendChild(msg);

  switch (cmd.action) {
    case 'next_slide':  viewer.next(); break;
    case 'prev_slide':  viewer.prev(); break;
    case 'jump_slide':  viewer.jumpTo(cmd.slide); break;
    case 'first_slide': viewer.first(); break;
    case 'last_slide':  viewer.last(); break;
    case 'start_show':  viewer.toggleFullscreen(); break;
    case 'end_show':
      if (document.fullscreenElement) document.exitFullscreen?.();
      break;
    case 'blackout':    viewer.toggleBlackout(); break;
    case 'zoom_in':     viewer.zoomIn(); break;
    case 'zoom_out':    viewer.zoomOut(); break;
    case 'zoom_reset':  viewer.zoomReset(); break;
    case 'fullscreen':  viewer.toggleFullscreen(); break;
    case 'pen_tool':    activateDrawTool('pen'); break;
    case 'eraser':      activateDrawTool('eraser'); break;
    case 'pointer':     activateDrawTool('pointer'); break;
    default: break;
  }

  // record for ML learning (only meaningful commands)
  if (cmd.action !== 'unknown') {
    sendLearnSignal(cmd.action, cmd.text || '', cmd.confidence || 0.95)
      .then(() => loadSuggestions());  // refresh suggestion chips after learning
  }

  // auto-restart recognition after a recognised command so it keeps listening
  voice.enableAutoRestart();
}

// ─── voice UI ──────────────────────────────────────────────────────────

$btnVoice.addEventListener('click', () => {
  voice.toggle();
  const isListening = voice.listening;
  $btnVoice.classList.toggle('listening', isListening);
  if (isListening) {
    showToast('info', '🎤', 'Voice control active', 'Speak a command…');
  } else {
    showToast('info', '🔇', 'Voice control stopped');
  }
});

$langSelect.addEventListener('change', () => {
  _currentLang = $langSelect.value;
  voice.setLang(_currentLang);
});

function setVoiceStatus(text) {
  $voiceStatus.textContent = text;
  $btnVoice.classList.toggle('listening', voice.listening);
}

// ─── toolbar buttons ─────────────────────────────────────────────────────

$navPrev.addEventListener('click', () => viewer.prev());
$navNext.addEventListener('click', () => viewer.next());

$btnFullscreen.addEventListener('click', () => {
  viewer.toggleFullscreen();
  $btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
});

document.addEventListener('fullscreenchange', () => {
  $btnFullscreen.classList.toggle('active', !!document.fullscreenElement);
});

$btnBlackout.addEventListener('click', () => {
  viewer.toggleBlackout();
  const on = document.getElementById('blackout-overlay').classList.contains('active');
  $btnBlackout.classList.toggle('active', on);
});

$btnPanel.addEventListener('click', () => {
  viewer.togglePanel();
  $btnPanel.classList.toggle('active');
});

$btnNotes.addEventListener('click', () => viewer.toggleNotes());

$btnZoomIn.addEventListener('click',    () => viewer.zoomIn());
$btnZoomOut.addEventListener('click',   () => viewer.zoomOut());
$btnZoomReset.addEventListener('click', () => viewer.zoomReset());

// draw tools
[$btnPen, $btnEraser, $btnPointer].forEach(btn => {
  btn.addEventListener('click', () => activateDrawTool(btn.dataset.tool));
});

function activateDrawTool(tool) {
  [$btnPen, $btnEraser, $btnPointer].forEach(b => b.classList.remove('active'));
  const map = { pen: $btnPen, eraser: $btnEraser, pointer: $btnPointer };
  map[tool]?.classList.add('active');

  // Show pen options only when pen is active
  $penOptions.classList.toggle('hidden', tool !== 'pen');

  switch (tool) {
    case 'pen':     viewer.setPenTool(); break;
    case 'eraser':  viewer.setEraser();  break;
    default:        viewer.setPointer(); break;
  }
}

// ─── pen options ──────────────────────────────────────────────────────────

$penOptions.querySelectorAll('.pen-color').forEach(btn => {
  btn.addEventListener('click', () => {
    $penOptions.querySelectorAll('.pen-color').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    viewer.setPenColor(btn.dataset.color);
  });
});

$penOptions.querySelectorAll('.pen-size').forEach(btn => {
  btn.addEventListener('click', () => {
    $penOptions.querySelectorAll('.pen-size').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    viewer.setPenWidth(parseInt(btn.dataset.size, 10));
  });
});

// ─── help modal ───────────────────────────────────────────────────────────
$btnHelp.addEventListener('click',      () => $helpModal.classList.add('open'));
$btnHelpClose.addEventListener('click', () => $helpModal.classList.remove('open'));
$helpModal.addEventListener('click', (e) => {
  if (e.target === $helpModal) $helpModal.classList.remove('open');
});

// ─── progress / error helpers ─────────────────────────────────────────────

function showProgress(label, pct) {
  $uploadProgress.classList.add('visible');
  $progressLabel.textContent = label;
  $progressFill.style.width  = `${pct}%`;
}

function hideProgress() {
  $uploadProgress.classList.remove('visible');
  $progressFill.style.width = '0%';
}

let _errorTimer;
function showError(msg) {
  $errorToast.textContent = msg;
  $errorToast.classList.add('show');
  clearTimeout(_errorTimer);
  _errorTimer = setTimeout(() => $errorToast.classList.remove('show'), 5000);
}

// ─── toast notifications ──────────────────────────────────────────────────

/**
 * Show a brief toast notification.
 * @param {'info'|'success'|'error'|'warn'} type
 * @param {string} icon  Emoji icon
 * @param {string} title Short headline
 * @param {string} [msg] Optional detail line
 * @param {number} [durationMs] Auto-dismiss delay (default 3500)
 */
function showToast(type, icon, title, msg = '', durationMs = 3500) {
  if (!$appToastContainer) return;
  const el = document.createElement('div');
  el.className = `app-toast app-toast-${type}`;
  el.innerHTML = `
    <span class="app-toast-icon">${icon}</span>
    <div class="app-toast-body">
      <div class="app-toast-title">${_esc(title)}</div>
      ${msg ? `<div class="app-toast-msg">${_esc(msg)}</div>` : ''}
    </div>`;
  $appToastContainer.appendChild(el);

  const remove = () => {
    el.classList.add('app-toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };
  const timer = setTimeout(remove, durationMs);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ─── swipe gesture support ────────────────────────────────────────────────

{
  let _touchStartX = 0;
  let _touchStartY = 0;
  const $stage = document.getElementById('slide-stage');

  $stage.addEventListener('touchstart', (e) => {
    _touchStartX = e.touches[0].clientX;
    _touchStartY = e.touches[0].clientY;
  }, { passive: true });

  $stage.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - _touchStartX;
    const dy = e.changedTouches[0].clientY - _touchStartY;
    // Only trigger if horizontal swipe is dominant and > 50px
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 50) {
      if (dx < 0) viewer.next();
      else viewer.prev();
    }
  }, { passive: true });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── initialise ───────────────────────────────────────────────────────────
// Load the file library on the upload screen when the page first opens
refreshLibraryUploadScreen();

