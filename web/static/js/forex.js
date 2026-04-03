/**
 * AI Forex Signal Hub – Frontend Logic
 * Handles: pair selection, signal display, accuracy chart, news feed,
 * risk management calculator, technical analysis, alert subscription,
 * auto-refresh, tab navigation, sound notifications, gamification,
 * and per-pair success rate tracking.
 */

'use strict';

// ─── State ───────────────────────────────────────────────────────────────────
let currentPair       = 'EUR/USD';
let signalData        = null;
let refreshTimer      = null;
let previousDirection = null;
let soundEnabled      = true;
const REFRESH_INTERVAL_MS   = 60_000; // 1 minute
const PAIR_FETCH_DELAY_MS   = 120;    // delay between sequential pair API calls (rate-limit friendly)

// ─── Gamification state (persisted in localStorage) ──────────────────────────
const GAME_KEY = 'fxHubGame';
let gameState  = loadGameState();

function loadGameState() {
  try {
    return JSON.parse(localStorage.getItem(GAME_KEY)) || defaultGameState();
  } catch {
    return defaultGameState();
  }
}

function defaultGameState() {
  return { xp: 0, level: 1, streak: 0, signalsWatched: 0, badges: [] };
}

function saveGameState() {
  try { localStorage.setItem(GAME_KEY, JSON.stringify(gameState)); } catch { /* ignore */ }
}

// XP thresholds per level (cumulative)
const XP_PER_LEVEL = 100;

function addXp(amount, label) {
  gameState.xp += amount;
  const newLevel = Math.floor(gameState.xp / XP_PER_LEVEL) + 1;
  if (newLevel > gameState.level) {
    gameState.level = newLevel;
    showToast('toast-achievement', '🎖️', `Level ${newLevel} Reached!`,
      `You've earned ${gameState.xp} XP total. Keep watching signals!`);
  }
  saveGameState();
  updateGameBar();
}

function checkAndAwardBadge(id, emoji, name, condition) {
  if (condition && !gameState.badges.includes(id)) {
    gameState.badges.push(id);
    saveGameState();
    renderBadges();
    showToast('toast-achievement', emoji, `Badge Unlocked: ${name}`, '');
  }
}

function updateGameBar() {
  const xpInLevel   = gameState.xp % XP_PER_LEVEL;
  const xpPct       = (xpInLevel / XP_PER_LEVEL) * 100;
  const xpBarFill   = document.getElementById('xp-bar-fill');
  const xpValueEl   = document.getElementById('xp-value');
  const streakEl    = document.getElementById('streak-value');
  const watchedEl   = document.getElementById('signals-watched');
  if (xpBarFill)  xpBarFill.style.width = `${xpPct}%`;
  if (xpValueEl)  xpValueEl.textContent = `${gameState.xp} (Lv ${gameState.level})`;
  if (streakEl)   streakEl.textContent  = gameState.streak;
  if (watchedEl)  watchedEl.textContent = gameState.signalsWatched;
}

function renderBadges() {
  const container = document.getElementById('gamebar-badges');
  if (!container) return;
  const BADGE_MAP = {
    first_signal:  { e: '👀', t: 'First Signal' },
    first_buy:     { e: '🟢', t: 'First BUY' },
    first_sell:    { e: '🔴', t: 'First SELL' },
    streak_3:      { e: '🔥', t: '3-Signal Streak' },
    streak_5:      { e: '⚡', t: '5-Signal Streak' },
    watched_10:    { e: '🏅', t: '10 Signals Watched' },
    watched_50:    { e: '🏆', t: '50 Signals Watched' },
    sound_on:      { e: '🔊', t: 'Sound On' },
    high_conf:     { e: '💎', t: 'High Confidence Signal' },
  };
  container.innerHTML = gameState.badges
    .filter(id => BADGE_MAP[id])
    .map(id => {
      const b = BADGE_MAP[id];
      return `<span class="achievement-badge" title="${b.t}">${b.e}</span>`;
    }).join('');
}

// ─── Sound Notifications (Web Audio API) ─────────────────────────────────────
let audioCtx = null;

function getAudioCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

/**
 * Play a short chime.
 * @param {'buy'|'sell'|'hold'|'refresh'|'achievement'} type
 */
function playSignalSound(type) {
  if (!soundEnabled) return;
  const ctx = getAudioCtx();
  if (!ctx) return;

  // Resume suspended context (autoplay policy)
  if (ctx.state === 'suspended') ctx.resume();

  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain);
  gain.connect(ctx.destination);

  const SOUNDS = {
    buy:         { freqs: [440, 554, 659], dur: 0.12, wave: 'sine' },
    sell:        { freqs: [659, 554, 440], dur: 0.12, wave: 'sine' },
    hold:        { freqs: [440, 440],      dur: 0.15, wave: 'triangle' },
    refresh:     { freqs: [523],           dur: 0.08, wave: 'sine' },
    achievement: { freqs: [523, 659, 784, 1047], dur: 0.1, wave: 'sine' },
    news:        { freqs: [880, 660], dur: 0.1, wave: 'sine' },
    fvg:         { freqs: [523, 698], dur: 0.12, wave: 'triangle' },
    breakout:    { freqs: [440, 587, 740], dur: 0.1, wave: 'sawtooth' },
  };

  const s = SOUNDS[type] || SOUNDS.refresh;
  gain.gain.setValueAtTime(0.18, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + s.freqs.length * s.dur + 0.05);
  osc.type = s.wave;

  s.freqs.forEach((freq, i) => {
    osc.frequency.setValueAtTime(freq, now + i * s.dur);
  });

  osc.start(now);
  osc.stop(now + s.freqs.length * s.dur + 0.06);
}

// Sound toggle
const soundBtn = document.getElementById('btn-sound');
if (soundBtn) {
  soundBtn.addEventListener('click', () => {
    soundEnabled = !soundEnabled;
    soundBtn.textContent = soundEnabled ? '🔔' : '🔕';
    soundBtn.classList.toggle('muted', !soundEnabled);
    soundBtn.setAttribute('aria-pressed', soundEnabled ? 'true' : 'false');
    if (soundEnabled) {
      playSignalSound('refresh');
      checkAndAwardBadge('sound_on', '🔊', 'Sound On', true);
    }
  });
}

// ─── Toast Notifications ─────────────────────────────────────────────────────
const toastContainer = document.getElementById('toast-container');

function showToast(type, icon, title, msg, durationMs = 4000) {
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-icon">${icon}</span>
    <div class="toast-body">
      <div class="toast-title">${escapeHtml(title)}</div>
      ${msg ? `<div class="toast-msg">${escapeHtml(msg)}</div>` : ''}
    </div>`;
  toastContainer.appendChild(el);

  const remove = () => {
    el.classList.add('toast-out');
    el.addEventListener('animationend', () => el.remove(), { once: true });
  };

  const timer = setTimeout(remove, durationMs);
  el.addEventListener('click', () => { clearTimeout(timer); remove(); });
}

// ─── Tab Navigation ──────────────────────────────────────────────────────────
const ALL_SECTIONS = [
  'section-signal', 'section-history', 'section-risk',
  'section-technical', 'section-fvg', 'section-sr-breaks',
  'section-volatile', 'section-reversal',
  'section-success', 'section-news', 'section-alerts',
];

// Sections belonging to each tab
const TAB_SECTIONS = {
  'section-signal':    ['section-signal', 'section-history'],
  'section-risk':      ['section-risk'],
  'section-technical': ['section-technical'],
  'section-fvg':       ['section-fvg'],
  'section-sr-breaks': ['section-sr-breaks'],
  'section-volatile':  ['section-volatile'],
  'section-reversal':  ['section-reversal'],
  'section-success':   ['section-success'],
  'section-news':      ['section-news'],
  'section-alerts':    ['section-alerts'],
};

function activateTab(targetSection) {
  // Update tab active states
  document.querySelectorAll('.fx-tab').forEach(tab => {
    const isActive = tab.dataset.section === targetSection;
    tab.classList.toggle('active', isActive);
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  // Show / hide sections
  const visible = TAB_SECTIONS[targetSection] || [targetSection];
  ALL_SECTIONS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (visible.includes(id)) {
      el.classList.remove('fx-hidden');
      // Trigger animation
      el.style.animation = 'none';
      el.offsetHeight; // reflow
      el.style.animation = '';
    } else {
      el.classList.add('fx-hidden');
    }
  });
}

document.querySelectorAll('.fx-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activateTab(tab.dataset.section);
    // Lazy-load data for new tabs
    if (tab.dataset.section === 'section-volatile' && !volatileLoaded) {
      loadVolatilePairs(currentVolatileTf);
    }
    if (tab.dataset.section === 'section-reversal' && !reversalLoaded) {
      loadReversalPairs();
    }
    if (tab.dataset.section === 'section-fvg' && !fvgLoaded) {
      loadFvgScanner();
    }
    if (tab.dataset.section === 'section-sr-breaks' && !srBreakoutsLoaded) {
      loadSrBreakouts();
    }
  });
});

// ─── DOM refs ─────────────────────────────────────────────────────────────────
const pairSelect      = document.getElementById('pair-select');
const lastUpdatedEl   = document.getElementById('last-updated');
const dataSourceBadge = document.getElementById('data-source-badge');
const refreshBtn      = document.getElementById('btn-refresh');
const directionBadge  = document.getElementById('signal-direction');
const directionArrow  = document.getElementById('direction-arrow');
const confidenceFill  = document.getElementById('confidence-fill');
const confidencePct   = document.getElementById('confidence-pct');
const accuracy30d     = document.getElementById('accuracy-30d');
const entryPrice      = document.getElementById('entry-price');
const takeProfitEl    = document.getElementById('take-profit');
const stopLossEl      = document.getElementById('stop-loss');
const featuresEl      = document.getElementById('features-list');
const modelVersionEl  = document.getElementById('model-version');
const newsListEl      = document.getElementById('news-list');
const newsLoadingEl   = document.getElementById('news-loading');
const subscribeForm   = document.getElementById('subscribe-form');
const emailInput      = document.getElementById('email-input');
const subscribeStatus = document.getElementById('subscribe-status');
const chartCanvas     = document.getElementById('accuracy-chart');

// Risk calculator DOM refs
const calcBalance   = document.getElementById('calc-balance');
const calcRiskPct   = document.getElementById('calc-risk-pct');
const calcEntry     = document.getElementById('calc-entry');
const calcSl        = document.getElementById('calc-sl');
const calcTp        = document.getElementById('calc-tp');
const calcLeverage  = document.getElementById('calc-leverage');
const calcLotType   = document.getElementById('calc-lot-type');

// Risk result DOM refs
const resRiskAmount   = document.getElementById('res-risk-amount');
const resPositionSize = document.getElementById('res-position-size');
const resPipValue     = document.getElementById('res-pip-value');
const resPipsSl       = document.getElementById('res-pips-sl');
const resPipsTp       = document.getElementById('res-pips-tp');
const resRr           = document.getElementById('res-rr');
const resProfit       = document.getElementById('res-profit');
const resMargin       = document.getElementById('res-margin');

// Technical analysis DOM refs
const taLoading       = document.getElementById('ta-loading');
const taContent       = document.getElementById('ta-content');
const taSrContent     = document.getElementById('ta-sr-content');
const taFvgContent    = document.getElementById('ta-fvg-content');
const taBosContent    = document.getElementById('ta-bos-content');
const taChochContent  = document.getElementById('ta-choch-content');
const taVolumeContent = document.getElementById('ta-volume-content');

// ─── Utility ──────────────────────────────────────────────────────────────────
function formatDate(isoStr) {
  try {
    return new Date(isoStr).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

function sentimentIcon(s) {
  return s === 'positive' ? '📈' : s === 'negative' ? '📉' : '➡️';
}

function isJpy(pair) {
  return pair && pair.includes('JPY');
}

function isGold(pair) {
  return pair && pair.startsWith('XAU');
}

function isHighPriceCommodity(pair) {
  // Pairs priced in whole-dollar units (Gold, Oil) — use 2 decimal places
  return pair && (pair.startsWith('XAU') || pair === 'USOIL');
}

function getPairDecimals(pair) {
  if (isJpy(pair) || isHighPriceCommodity(pair)) return 2;
  return 4;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Signal display ───────────────────────────────────────────────────────────
async function loadSignal(pair) {
  refreshBtn.classList.add('spinning');
  try {
    const res = await fetch(`/api/forex/signals?pair=${encodeURIComponent(pair)}`);
    if (!res.ok) throw new Error(await res.text());
    signalData = await res.json();

    const isNewSignal = previousDirection && signalData.direction !== previousDirection;

    renderSignal(signalData);
    drawChart(signalData.history);
    autoFillCalculator(signalData);
    runCalculator();
    loadTechnicalAnalysis(pair);
    updateSuccessRateCard(pair, signalData);

    // Gamification
    gameState.signalsWatched++;
    addXp(5, 'signal watched');
    checkAndAwardBadge('first_signal', '👀', 'First Signal', gameState.signalsWatched >= 1);
    checkAndAwardBadge('watched_10',   '🏅', '10 Signals Watched', gameState.signalsWatched >= 10);
    checkAndAwardBadge('watched_50',   '��', '50 Signals Watched', gameState.signalsWatched >= 50);
    checkAndAwardBadge('first_buy',    '🟢', 'First BUY',  signalData.direction === 'BUY');
    checkAndAwardBadge('first_sell',   '🔴', 'First SELL', signalData.direction === 'SELL');
    checkAndAwardBadge('high_conf',    '💎', 'High Confidence Signal', signalData.confidence >= 75);

    if (isNewSignal) {
      // New direction — streak broken, XP bonus
      gameState.streak = 1;
      addXp(20, 'new signal');
      const dir = signalData.direction;
      const soundType = dir === 'BUY' ? 'buy' : dir === 'SELL' ? 'sell' : 'hold';
      playSignalSound(soundType);
      const dirIcon = dir === 'BUY' ? '🟢' : dir === 'SELL' ? '🔴' : '🟡';
      showToast(
        `toast-${dir.toLowerCase()}`,
        dirIcon,
        `New ${dir} Signal – ${pair}`,
        `Confidence: ${signalData.confidence}% · Entry: ${formatPrice(signalData.entry_price, pair)}`,
        5000,
      );
      // Flash the signal card
      const card = document.getElementById('fx-signal-card');
      if (card) {
        card.classList.remove('signal-updated');
        card.offsetHeight;
        card.classList.add('signal-updated');
      }
    } else {
      gameState.streak = (gameState.streak || 0) + 1;
      playSignalSound('refresh');
      checkAndAwardBadge('streak_3', '🔥', '3-Signal Streak', gameState.streak >= 3);
      checkAndAwardBadge('streak_5', '⚡', '5-Signal Streak', gameState.streak >= 5);
    }

    saveGameState();
    updateGameBar();
    previousDirection = signalData.direction;
    lastDirectionByPair[pair] = signalData.direction;

  } catch (err) {
    console.error('Failed to load signal:', err);
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

function renderSignal(data) {
  const dir = data.direction;

  // Direction badge
  directionBadge.textContent = dir;
  directionBadge.className = `signal-direction-badge ${dir}`;
  directionArrow.textContent = dir === 'BUY' ? '▲' : dir === 'SELL' ? '▼' : '→';

  // Confidence bar
  confidenceFill.style.width = `${data.confidence}%`;
  confidenceFill.className = `confidence-fill ${dir}`;
  confidencePct.textContent = `${data.confidence}%`;

  // 30-day accuracy
  accuracy30d.innerHTML = `30-day model accuracy: <strong>${data.accuracy_30d}%</strong>`;

  // Price levels
  entryPrice.textContent   = formatPrice(data.entry_price, data.pair);
  takeProfitEl.textContent = formatPrice(data.take_profit, data.pair);
  stopLossEl.textContent   = formatPrice(data.stop_loss, data.pair);

  // Model info
  if (modelVersionEl) modelVersionEl.textContent = data.model_version || '';
  if (featuresEl) {
    featuresEl.innerHTML = (data.features_used || [])
      .map(f => `<span class="feature-tag">${f}</span>`)
      .join('');
  }

  // Last updated + data source badge
  lastUpdatedEl.textContent = `Updated: ${formatDate(data.generated_at)}`;
  if (dataSourceBadge) {
    const isLive = data.is_live === true;
    dataSourceBadge.textContent = isLive ? '🟢 Live' : '🟡 Cached';
    dataSourceBadge.className = `fx-data-source ${isLive ? 'live' : 'static'}`;
    dataSourceBadge.title = data.data_source || '';
  }
}

function formatPrice(price, pair) {
  return Number(price).toFixed(getPairDecimals(pair));
}

// ─── Accuracy Chart ───────────────────────────────────────────────────────────
let _chartRafId = null; // animation frame handle

/** Ease-out cubic: accelerates quickly then decelerates smoothly. */
function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function drawChart(history) {
  if (!chartCanvas || !history || history.length === 0) return;

  // Cancel any in-progress animation before starting a new one
  if (_chartRafId) { cancelAnimationFrame(_chartRafId); _chartRafId = null; }

  const dpr = window.devicePixelRatio || 1;
  const W   = chartCanvas.offsetWidth || 860;
  const H   = 400; // Increased height for better visibility
  chartCanvas.width  = W * dpr;
  chartCanvas.height = H * dpr;
  chartCanvas.style.height = H + 'px';

  const ctx = chartCanvas.getContext('2d');
  ctx.scale(dpr, dpr);

  // Extra top/bottom padding to accommodate signal pin icons
  const PAD    = { top: 42, right: 20, bottom: 52, left: 62 };
  const cw     = W - PAD.left - PAD.right;
  const ch     = H - PAD.top  - PAD.bottom;
  const n      = history.length;
  const dec    = history[0] && history[0].entry > 10 ? 2 : 4;
  const DOT_R  = 4.5; // radius of correctness dots

  const allPrices = history.flatMap(h => [h.entry, h.exit]);
  const minP  = Math.min(...allPrices);
  const maxP  = Math.max(...allPrices);
  const range = (maxP - minP) || 1;

  const xOf = i => PAD.left + (n > 1 ? (i / (n - 1)) * cw : cw / 2);
  const yOf = p => PAD.top + ch - ((p - minP) / range) * ch;

  // ── Static background: grid, axes, date labels ──
  function drawBackground() {
    ctx.clearRect(0, 0, W, H);
    const gridCount = 5;
    for (let g = 0; g <= gridCount; g++) {
      const gy = PAD.top + (g / gridCount) * ch;
      ctx.strokeStyle = 'rgba(48,54,61,0.7)';
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(PAD.left, gy); ctx.lineTo(PAD.left + cw, gy); ctx.stroke();
      const price = maxP - (g / gridCount) * range;
      ctx.fillStyle    = 'rgba(139,148,158,0.85)';
      ctx.font         = '11px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
      ctx.textAlign    = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(price.toFixed(dec), PAD.left - 6, gy);
    }
    // Axis lines
    ctx.strokeStyle = 'rgba(48,54,61,0.9)';
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PAD.left, PAD.top); ctx.lineTo(PAD.left, PAD.top + ch + 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(PAD.left - 4, PAD.top + ch); ctx.lineTo(PAD.left + cw, PAD.top + ch); ctx.stroke();
    // X-axis date labels
    ctx.fillStyle    = 'rgba(139,148,158,0.85)';
    ctx.font         = '10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'alphabetic';
    const step = Math.ceil(n / 6);
    history.forEach((h, i) => {
      if (i % step !== 0 && i !== n - 1) return;
      ctx.fillText(h.day.slice(5), xOf(i), H - PAD.bottom + 16);
    });
  }

  // ── Animated price line (exit prices) ──
  function drawPriceLine(progress) {
    if (n < 2) return;
    const progIdx = progress * (n - 1);
    ctx.beginPath();
    ctx.strokeStyle = '#58a6ff';
    ctx.lineWidth   = 2;
    ctx.lineJoin    = 'round';
    const limit = Math.floor(progIdx);
    for (let i = 0; i <= limit && i < n; i++) {
      const x = xOf(i), y = yOf(history[i].exit);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    // Interpolate the partial final segment
    if (limit < n - 1) {
      const frac = progIdx - limit;
      const x0 = xOf(limit),     y0 = yOf(history[limit].exit);
      const x1 = xOf(limit + 1), y1 = yOf(history[limit + 1].exit);
      ctx.lineTo(x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac);
    }
    ctx.stroke();
  }

  // ── Signal pin icon (thumbtack style) at the entry price ──
  function drawSignalPin(x, tipY, direction) {
    const isBuy  = direction === 'BUY';
    const isSell = direction === 'SELL';
    if (!isBuy && !isSell) return;

    const color    = isBuy ? '#3fb950' : '#f85149';
    const stemLen  = 18;
    const headR    = 6;
    const arrowHW  = 5; // half-width of arrowhead
    const arrowH   = 7; // height of arrowhead

    ctx.save();
    ctx.lineCap = 'round';

    if (isBuy) {
      // Pin above entry: arrowhead points DOWN at tipY, head circle above
      const headY = tipY - stemLen - headR;
      // Arrowhead (points down to tipY)
      ctx.beginPath();
      ctx.moveTo(x - arrowHW, tipY - arrowH);
      ctx.lineTo(x + arrowHW, tipY - arrowH);
      ctx.lineTo(x, tipY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      // Stem
      ctx.beginPath();
      ctx.moveTo(x, tipY - arrowH);
      ctx.lineTo(x, headY + headR);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();
      // Head circle
      ctx.beginPath();
      ctx.arc(x, headY, headR, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.strokeStyle = 'rgba(13,17,23,0.5)';
      ctx.lineWidth   = 1;
      ctx.fill();
      ctx.stroke();
      // Label
      ctx.fillStyle    = '#fff';
      ctx.font         = 'bold 7px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('B', x, headY);
    } else {
      // Pin below entry: arrowhead points UP at tipY, head circle below
      const headY = tipY + stemLen + headR;
      // Arrowhead (points up to tipY)
      ctx.beginPath();
      ctx.moveTo(x - arrowHW, tipY + arrowH);
      ctx.lineTo(x + arrowHW, tipY + arrowH);
      ctx.lineTo(x, tipY);
      ctx.closePath();
      ctx.fillStyle = color;
      ctx.fill();
      // Stem
      ctx.beginPath();
      ctx.moveTo(x, tipY + arrowH);
      ctx.lineTo(x, headY - headR);
      ctx.strokeStyle = color;
      ctx.lineWidth   = 2;
      ctx.stroke();
      // Head circle
      ctx.beginPath();
      ctx.arc(x, headY, headR, 0, Math.PI * 2);
      ctx.fillStyle   = color;
      ctx.strokeStyle = 'rgba(13,17,23,0.5)';
      ctx.lineWidth   = 1;
      ctx.fill();
      ctx.stroke();
      // Label
      ctx.fillStyle    = '#fff';
      ctx.font         = 'bold 7px sans-serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', x, headY);
    }

    ctx.restore();
  }

  // ── Correctness dots revealed progressively ──
  function drawSignalsAndDots(progress) {
    const upTo = Math.floor(progress * (n - 1));
    history.forEach((h, i) => {
      if (i > upTo) return;
      const x      = xOf(i);
      const exitY  = yOf(h.exit);
      // Correctness dot at exit price
      ctx.beginPath();
      ctx.arc(x, exitY, DOT_R, 0, Math.PI * 2);
      ctx.fillStyle   = h.correct ? '#3fb950' : '#f85149';
      ctx.strokeStyle = 'rgba(13,17,23,0.7)';
      ctx.lineWidth   = 1.5;
      ctx.fill();
      ctx.stroke();
    });
  }

  // ── Animation loop (ease-out cubic, 1400 ms) ──
  const DURATION = 1400;
  let startTime = null;

  function animate(ts) {
    if (!startTime) startTime = ts;
    const t    = Math.min((ts - startTime) / DURATION, 1);
    const ease = easeOutCubic(t);
    drawBackground();
    drawPriceLine(ease);
    drawSignalsAndDots(ease);
    if (t < 1) {
      _chartRafId = requestAnimationFrame(animate);
    } else {
      _chartRafId = null;
    }
  }

  _chartRafId = requestAnimationFrame(animate);
}

// ─── Risk Management Calculator ───────────────────────────────────────────────

/** Approximate pip value in USD per standard lot for a given pair/price.
 *
 * Pip sizes:  non-JPY = 0.0001 (1/10,000), JPY = 0.01 (1/100)
 * Standard lot = 100,000 units
 *
 * Formula by quote currency:
 *   - Quote is USD (e.g. EUR/USD):  pipValue = pipSize × lotSize  → always $10
 *   - Base  is USD (e.g. USD/JPY):  pipValue = (pipSize × lotSize) / entryPrice
 *   - JPY cross (e.g. EUR/JPY):     pipValue ≈ (pipSize × lotSize) / entryPrice × 100
 *       The ×100 converts the yen-denominated pip to USD via the implicit $/¥ rate
 *       (approximated as entryPrice / 100 because JPY crosses trade near ¥100–200).
 *   - Other crosses:                approximated as $10 (same as quote-USD pairs)
 */
function pipValuePerStdLot(pair, entryPriceVal) {
  const LOT = 100_000;
  const GOLD_LOT_OZ = 100; // standard gold lot = 100 troy oz
  const SILVER_LOT_OZ = 5000; // standard silver lot = 5000 troy oz
  const OIL_BARRELS = 1000; // standard WTI crude oil lot = 1000 barrels
  const jpy = isJpy(pair);
  const gold = isGold(pair);
  const silver = pair === 'XAG/USD';
  const oil = pair === 'USOIL';

  if (gold)   return 1.0 * GOLD_LOT_OZ;      // pip = $1,     lot = 100 oz  → $100 per lot
  if (silver) return 0.001 * SILVER_LOT_OZ;   // pip = $0.001, lot = 5000 oz → $5 per lot (silver has smaller pip × larger lot)
  if (oil)    return 0.01 * OIL_BARRELS;       // pip = $0.01,  lot = 1000 bbl → $10 per lot

  const pipSize = jpy ? 0.01 : 0.0001;
  const parts = pair.split('/');
  const quoteCcy = parts[1];
  const baseCcy  = parts[0];

  // If quote currency is USD → pip value = pipSize * LOT (always $10 for std lot)
  if (quoteCcy === 'USD') return pipSize * LOT;
  // If base currency is USD → pip value = pipSize * LOT / entryPrice
  if (baseCcy === 'USD') return (pipSize * LOT) / entryPriceVal;
  // Cross pairs: approximate using mid-market (simplified)
  if (jpy) return (pipSize * LOT) / entryPriceVal * 100; // rough approx for JPY crosses
  return pipSize * LOT; // fallback approximation
}

function autoFillCalculator(data) {
  if (data.entry_price) calcEntry.value = data.entry_price;
  if (data.stop_loss)   calcSl.value    = data.stop_loss;
  if (data.take_profit) calcTp.value    = data.take_profit;
}

function runCalculator() {
  const balance   = parseFloat(calcBalance.value)  || 0;
  const riskPct   = parseFloat(calcRiskPct.value)  || 0;
  const entry     = parseFloat(calcEntry.value)    || 0;
  const sl        = parseFloat(calcSl.value)       || 0;
  const tp        = parseFloat(calcTp.value)       || 0;
  const leverage  = parseFloat(calcLeverage.value) || 100;
  const lotType   = calcLotType.value;

  const lotMultiplier = lotType === 'standard' ? 1 : lotType === 'mini' ? 0.1 : 0.01;

  if (!balance || !riskPct || !entry || !sl) {
    [resRiskAmount, resPositionSize, resPipValue, resPipsSl, resPipsTp, resRr, resProfit, resMargin]
      .forEach(el => { if (el) el.textContent = '–'; });
    return;
  }

  const pair = currentPair;
  const jpy  = isJpy(pair);
  const oil  = pair === 'USOIL';
  const gold = isGold(pair);
  const pipSize = (gold || oil) ? 0.01 : (jpy ? 0.01 : 0.0001);

  const riskAmount = balance * (riskPct / 100);
  const pipsSl     = Math.abs(entry - sl) / pipSize;
  const pipsTp     = tp ? Math.abs(tp - entry) / pipSize : 0;

  const pvPerStdLot = pipValuePerStdLot(pair, entry);
  // pip value adjusted for lot type
  const pvPerLot    = pvPerStdLot * lotMultiplier;

  // Position size in lots
  const positionLots = pipsSl > 0 ? riskAmount / (pipsSl * pvPerLot) : 0;
  const positionUnits = positionLots * 100_000 * lotMultiplier;

  // RR ratio
  const rr = pipsSl > 0 && pipsTp > 0 ? pipsTp / pipsSl : 0;

  // Potential profit
  const potentialProfit = positionLots * pipsTp * pvPerLot;

  // Required margin = (positionUnits * entry) / leverage
  const margin = (positionUnits * entry) / leverage;

  // Update UI
  resRiskAmount.textContent   = `$${riskAmount.toFixed(2)}`;
  resPositionSize.textContent = `${positionLots.toFixed(2)} lots`;
  resPipValue.textContent     = `$${pvPerLot.toFixed(2)}`;
  resPipsSl.textContent       = `${pipsSl.toFixed(1)} pips`;
  resPipsTp.textContent       = tp ? `${pipsTp.toFixed(1)} pips` : '–';
  resRr.textContent           = rr > 0 ? `1 : ${rr.toFixed(2)}` : '–';
  resProfit.textContent       = potentialProfit > 0 ? `$${potentialProfit.toFixed(2)}` : '–';
  resMargin.textContent       = `$${margin.toFixed(2)}`;

  // Color RR ratio
  resRr.className = 'risk-result-value rr-value';
  if (rr >= 2) resRr.classList.add('buy');
  else if (rr > 0 && rr < 1) resRr.classList.add('sell');
}

// Attach calculator listeners
[calcBalance, calcRiskPct, calcEntry, calcSl, calcTp, calcLeverage, calcLotType]
  .forEach(el => { if (el) el.addEventListener('input', runCalculator); });

// ─── Technical Analysis ───────────────────────────────────────────────────────
async function loadTechnicalAnalysis(pair) {
  taLoading.style.display = 'block';
  taContent.style.display = 'none';
  try {
    const res = await fetch(`/api/forex/technical?pair=${encodeURIComponent(pair)}`);
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    renderTechnicalAnalysis(data);
  } catch (err) {
    taLoading.textContent = 'Could not load technical analysis.';
    console.error('Failed to load technical analysis:', err);
  }
}

function renderTechnicalAnalysis(data) {
  const dec = getPairDecimals(data.pair);
  const fmt = v => Number(v).toFixed(dec);

  // Live current price display
  const priceEl = document.getElementById('ta-current-price');
  const pairEl  = document.getElementById('ta-pair-label');
  const timeEl  = document.getElementById('ta-price-updated');
  if (priceEl) {
    priceEl.textContent = fmt(data.current_price);
    priceEl.classList.add('ta-price-flash');
    priceEl.addEventListener('animationend', () => priceEl.classList.remove('ta-price-flash'), { once: true });
  }
  if (pairEl) pairEl.textContent = data.pair;
  if (timeEl) timeEl.textContent = `Updated: ${new Date().toLocaleTimeString()}`;

  // Support & Resistance
  const sr = data.support_resistance;
  taSrContent.innerHTML = `
    <div class="sr-group">
      <div class="sr-group-title resistance-title">Resistance</div>
      ${sr.resistance.slice().reverse().map(r => `
        <div class="sr-level resistance">
          ${buildStatusSvg('resistance')}
          <span class="sr-badge">R</span>
          <span class="sr-price">${fmt(r)}</span>
        </div>`).join('')}
      <div class="sr-current">
        <span class="sr-badge current-badge">●</span>
        <span class="sr-price current-price">Current: ${fmt(data.current_price)}</span>
      </div>
      ${sr.support.map(s => `
        <div class="sr-level support">
          ${buildStatusSvg('support')}
          <span class="sr-badge">S</span>
          <span class="sr-price">${fmt(s)}</span>
        </div>`).join('')}
    </div>`;

  // Fair Value Gaps — only show unfilled/active ones, mark filled as consumed
  taFvgContent.innerHTML = data.fvg.map(g => {
    if (g.filled) {
      return `
        <div class="ta-item ${g.type} filled ta-item--consumed">
          <div class="ta-item-header">
            <span class="ta-badge ${g.type}">${g.type.toUpperCase()} FVG</span>
            <span class="ta-badge neutral">Consumed ✅</span>
            <span class="ta-date">${g.created}</span>
          </div>
          <div class="ta-price-range ta-price-range--consumed">${fmt(g.bottom)} – ${fmt(g.top)}</div>
          <div class="ta-desc">${escapeHtml(g.description)}</div>
        </div>`;
    }
    return `
      <div class="ta-item ${g.type} unfilled">
        <div class="ta-item-header">
          ${buildStatusSvg(g.type === 'bullish' ? 'reached' : 'rejected')}
          <span class="ta-badge ${g.type}">${g.type.toUpperCase()} FVG</span>
          <span class="ta-badge active">Active ⚡</span>
          <span class="ta-date">${g.created}</span>
        </div>
        <div class="ta-price-range"><span class="fvg-zone-label">Zone:</span> <strong>${fmt(g.bottom)} – ${fmt(g.top)}</strong></div>
        <div class="ta-desc">${escapeHtml(g.description)}</div>
      </div>`;
  }).join('');

  // Break of Structure
  taBosContent.innerHTML = data.bos.map(b => `
    <div class="ta-item ${b.type}">
      <div class="ta-item-header">
        ${buildStatusSvg(b.type === 'bullish' ? 'resistance' : 'support')}
        <span class="ta-badge ${b.type}">${b.type.toUpperCase()} BOS</span>
        <span class="ta-date">${b.date}</span>
      </div>
      <div class="ta-price-single">${fmt(b.level)}</div>
      <div class="ta-desc">${escapeHtml(b.description)}</div>
    </div>`).join('');

  // CHoCH
  taChochContent.innerHTML = data.choch.map(c => `
    <div class="ta-item ${c.type}">
      <div class="ta-item-header">
        ${buildStatusSvg(c.type === 'bullish' ? 'reached' : 'rejected')}
        <span class="ta-badge ${c.type}">CHoCH</span>
        <span class="ta-date">${c.date}</span>
      </div>
      <div class="ta-price-single">${fmt(c.level)}</div>
      <div class="ta-desc">${escapeHtml(c.description)}</div>
    </div>`).join('');

  // High Volume Zones
  taVolumeContent.innerHTML = data.high_volume_zones.map(z => `
    <div class="ta-item volume-zone ${z.strength}">
      <div class="ta-item-header">
        <span class="ta-badge volume-${z.strength}">${z.strength.toUpperCase()} VOLUME</span>
        <span class="ta-price-range">${fmt(z.bottom)} – ${fmt(z.top)}</span>
      </div>
      <div class="ta-desc">${escapeHtml(z.description)}</div>
    </div>`).join('');

  taLoading.style.display = 'none';
  taContent.style.display = 'grid';
}

// ─── Success Rate Tracking ────────────────────────────────────────────────────
// Map of pair → {accuracy, direction, total, correct, loaded}
const successRateCache = {};

const ALL_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD', 'GBP/JPY', 'GBP/CHF', 'AUD/JPY',
  'GBP/AUD', 'GBP/CAD', 'CAD/JPY', 'CHF/JPY',
  'XAU/USD', 'XAG/USD', 'USOIL',
];

/**
 * Compute accuracy from history array provided by the signal API.
 * Returns { accuracy: number, total: number, correct: number }
 */
function computeAccuracy(history) {
  if (!history || history.length === 0) return { accuracy: 0, total: 0, correct: 0 };
  const correct = history.filter(h => h.correct).length;
  return { accuracy: Math.round((correct / history.length) * 100), total: history.length, correct };
}

/** Update (or insert) the success-rate card for a single pair. */
function updateSuccessRateCard(pair, data) {
  const { accuracy, total, correct } = computeAccuracy(data.history);
  const dir = data.direction;
  successRateCache[pair] = { accuracy, total, correct, direction: dir };

  const grid = document.getElementById('success-rate-grid');
  if (!grid) return;

  // Remove placeholder if present
  const placeholder = document.getElementById('success-loading');
  if (placeholder) placeholder.remove();

  const cardId = `sr-card-${pair.replace('/', '-')}`;
  let card = document.getElementById(cardId);
  if (!card) {
    card = document.createElement('div');
    card.id = cardId;
    card.className = 'sr-pair-card';
    grid.appendChild(card);
  }

  const pct   = accuracy;
  const rateClass = pct >= 60 ? 'high' : pct >= 45 ? 'mid' : 'low';
  const barClass  = pct >= 60 ? ''     : pct >= 45 ? 'mid' : 'low';

  card.innerHTML = `
    <div class="sr-pair-name">
      ${escapeHtml(pair)}
      <span class="sr-direction-tag ${dir}">${dir}</span>
    </div>
    <div class="sr-rate-row">
      <div class="sr-rate-bar-wrap">
        <div class="sr-rate-bar-fill ${barClass}" style="width:${pct}%"></div>
      </div>
      <span class="sr-rate-pct ${rateClass}">${pct}%</span>
    </div>
    <div class="sr-pair-meta">
      <span>${correct}/${total} correct</span>
      <span>30-day history</span>
    </div>`;
}

/** Fetch success rates for all pairs in small parallel batches (rate-limit friendly). */
async function loadAllPairSuccessRates() {
  const btn = document.getElementById('btn-load-all-pairs');
  if (btn) { btn.disabled = true; btn.textContent = '⟳ Loading…'; }

  const grid = document.getElementById('success-rate-grid');
  const placeholder = document.getElementById('success-loading');
  if (placeholder) placeholder.remove();

  // Add skeleton cards for all pairs not yet loaded
  ALL_PAIRS.forEach(pair => {
    const cardId = `sr-card-${pair.replace('/', '-')}`;
    if (!document.getElementById(cardId) && grid) {
      const skel = document.createElement('div');
      skel.id = cardId;
      skel.className = 'sr-pair-card loading';
      skel.style.minHeight = '100px';
      grid.appendChild(skel);
    }
  });

  // Fetch in parallel batches of 3 to reduce total wait time while staying rate-limit friendly
  const BATCH_SIZE = 3;
  const pairsToLoad = ALL_PAIRS.filter(pair => !successRateCache[pair]);

  async function fetchPair(pair) {
    try {
      const res = await fetch(`/api/forex/signals?pair=${encodeURIComponent(pair)}`);
      if (res.ok) {
        const data = await res.json();
        updateSuccessRateCard(pair, data);
      }
    } catch { /* skip failed pair */ }
  }

  for (let i = 0; i < pairsToLoad.length; i += BATCH_SIZE) {
    const batch = pairsToLoad.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(fetchPair));
    // Brief pause between batches to avoid overwhelming the API
    if (i + BATCH_SIZE < pairsToLoad.length) {
      await new Promise(r => setTimeout(r, PAIR_FETCH_DELAY_MS));
    }
  }

  if (btn) { btn.disabled = false; btn.textContent = '⟳ Reload All Pairs'; }
  showToast('toast-info', '🏆', 'Success Rates Updated', `Loaded data for ${ALL_PAIRS.length} pairs.`);
}

const loadAllBtn = document.getElementById('btn-load-all-pairs');
if (loadAllBtn) loadAllBtn.addEventListener('click', loadAllPairSuccessRates);

// ─── News Feed ────────────────────────────────────────────────────────────────
// Track known headlines so we can detect newly arrived news items
let _knownNewsHeadlines = new Set();
let _newsInitialLoad = true;

async function loadNews() {
  try {
    const res = await fetch('/api/forex/news');
    if (!res.ok) throw new Error(await res.text());
    const { news } = await res.json();
    renderNews(news);
  } catch (err) {
    newsLoadingEl.textContent = 'Could not load news at this time.';
    console.error('Failed to load news:', err);
  }
}

function renderNews(items) {
  newsLoadingEl.style.display = 'none';

  // Detect new headlines (skip notification on the very first load)
  const newItems = items.filter(item => !_knownNewsHeadlines.has(item.headline));
  items.forEach(item => _knownNewsHeadlines.add(item.headline));

  if (!_newsInitialLoad && newItems.length > 0) {
    playSignalSound('news');
    const badge = document.getElementById('news-new-badge');
    if (badge) {
      badge.style.display = 'inline-flex';
      setTimeout(() => { badge.style.display = 'none'; }, 8000);
    }
    showToast(
      'toast-info', '📰',
      `${newItems.length} New Headline${newItems.length > 1 ? 's' : ''}`,
      newItems[0].headline.length > 60
        ? newItems[0].headline.slice(0, 60) + '…'
        : newItems[0].headline,
      6000,
    );
  }
  _newsInitialLoad = false;

  newsListEl.innerHTML = items.map(item => `
    <div class="news-card${newItems.some(n => n.headline === item.headline) ? ' news-card-new' : ''}">
      <span class="sentiment-icon">${sentimentIcon(item.sentiment)}</span>
      <div class="news-content">
        <div class="news-headline">${escapeHtml(item.headline)}</div>
        <div class="news-meta">
          <span class="source">${escapeHtml(item.source)}</span>
          <span>${formatDate(item.published_at)}</span>
          <span class="sentiment-badge ${item.sentiment}">${item.sentiment}</span>
        </div>
      </div>
    </div>`).join('');
}

// ─── Alert Subscription ───────────────────────────────────────────────────────
subscribeForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const pairs = [...subscribeForm.querySelectorAll('input[type="checkbox"]:checked')]
    .map(cb => cb.value);

  subscribeStatus.className = 'subscribe-status';
  subscribeStatus.textContent = '';

  if (!email) {
    showSubscribeStatus('error', 'Please enter your email address.');
    return;
  }
  if (pairs.length === 0) {
    showSubscribeStatus('error', 'Please select at least one currency pair.');
    return;
  }

  const submitBtn = subscribeForm.querySelector('.btn-subscribe');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Subscribing…';

  try {
    const res = await fetch('/api/forex/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, pairs }),
    });
    const data = await res.json();
    if (data.success) {
      showSubscribeStatus('success', data.message);
      emailInput.value = '';
    } else {
      showSubscribeStatus('error', data.error || 'Subscription failed. Please try again.');
    }
  } catch (err) {
    showSubscribeStatus('error', 'Network error. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Subscribe';
  }
});

function showSubscribeStatus(type, msg) {
  subscribeStatus.className = `subscribe-status ${type}`;
  subscribeStatus.textContent = msg;
}

// ─── FVG Scanner ─────────────────────────────────────────────────────────────
let fvgLoaded = false;
let _fvgPairFvgs = {};        // pair → all FVGs (from API response)
let _currentFvgFilter = 'approaching';  // default filter
// Track which pairs were approaching last poll to detect zone entry transitions
let _prevFvgApproaching = new Set();

const FVG_STATUS_CONFIG = {
  approaching: { icon: '📍', label: 'Approaching', cls: 'fvg-approaching' },
  reached:     { icon: '🎯', label: 'Inside Zone',  cls: 'fvg-reached' },
  rejected:    { icon: '🚫', label: 'Rejected',      cls: 'fvg-rejected' },
  passed:      { icon: '✅', label: 'Passed/Filled', cls: 'fvg-passed' },
};

/** Build an animated SVG status dot for FVG / S/R items. */
function buildStatusSvg(status) {
  const colors = {
    approaching: '#58a6ff',
    reached:     '#3fb950',
    rejected:    '#f85149',
    passed:      '#8b949e',
    resistance:  '#3fb950',
    support:     '#f85149',
  };
  const color = colors[status] || '#8b949e';
  const pulse = (status === 'passed') ? '' : `<circle class="fvg-svg-pulse" cx="9" cy="9" r="7" fill="none" stroke="${color}" stroke-width="1"/>`;
  return `<svg class="fvg-status-svg fvg-status-svg--${status}" width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    ${pulse}
    <circle cx="9" cy="9" r="4.5" fill="${color}" opacity="${status === 'passed' ? '0.45' : '1'}"/>
  </svg>`;
}

async function loadFvgScanner() {
  const loadingEl = document.getElementById('fvg-loading');
  const contentEl = document.getElementById('fvg-content');
  if (!loadingEl || !contentEl) return;

  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';

  try {
    const res = await fetch('/api/forex/fvg-scanner');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    fvgLoaded = true;
    _fvgPairFvgs = data.pair_fvgs || {};
    renderFvgScanner(data.grouped);
    applyFvgFilter(_currentFvgFilter);

    // Detect pairs that were approaching and have now entered the FVG zone
    const currentReached = new Set((data.grouped.reached || []).map(i => i.pair));
    const enteredZone = [..._prevFvgApproaching].filter(p => currentReached.has(p));
    if (enteredZone.length > 0) {
      playSignalSound('fvg');
      showToast('toast-info', '🎯', 'Price Entered FVG Zone!',
        `${enteredZone.join(', ')} — price is now inside the FVG zone`, 6000);
    } else {
      // Generic alert for any newly reached pairs
      const alertCount = (data.grouped.reached || []).length;
      if (alertCount > 0 && _prevFvgApproaching.size === 0) {
        playSignalSound('fvg');
        showToast('toast-info', '🌀', 'FVG Alert',
          `${alertCount} pair${alertCount > 1 ? 's' : ''} inside FVG zone`, 5000);
      }
    }
    // Update tracking set for next poll
    _prevFvgApproaching = new Set((data.grouped.approaching || []).map(i => i.pair));
  } catch (err) {
    loadingEl.textContent = 'Could not load FVG scanner data.';
    console.error('FVG scanner failed:', err);
  }
}

function renderFvgScanner(grouped) {
  const loadingEl = document.getElementById('fvg-loading');
  const contentEl = document.getElementById('fvg-content');

  ['approaching', 'reached', 'rejected', 'passed'].forEach(status => {
    const listEl = document.getElementById(`fvg-${status}`);
    if (!listEl) return;
    const items = grouped[status] || [];
    if (items.length === 0) {
      listEl.innerHTML = '<div class="fvg-empty">No pairs in this category right now.</div>';
      return;
    }
    listEl.innerHTML = items.map((item, idx) => {
      const cfg    = FVG_STATUS_CONFIG[status] || {};
      const dir    = item.direction || '';
      const dirCls = dir === 'BUY' ? 'buy' : dir === 'SELL' ? 'sell' : 'hold';
      const dec    = getPairDecimals(item.pair);
      const fmt    = v => Number(v).toFixed(dec);
      const rowId  = `fvg-row-${status}-${idx}`;
      const dropId = `fvg-drop-${status}-${idx}`;
      const pairKey = item.pair;
      // Show distance indicator for approaching items (how close price is to zone)
      const distBadge = (status === 'approaching' && item.dist != null)
        ? `<span class="fvg-dist-badge" title="Distance to zone">${(item.dist * 100).toFixed(3)}% away</span>`
        : '';
      return `
        <div class="fvg-row ${cfg.cls || ''}" id="${rowId}" style="animation-delay:${idx * 50}ms" data-pair="${escapeHtml(pairKey)}" data-drop="${dropId}">
          <span class="fvg-status-svg-wrap">${buildStatusSvg(status)}</span>
          <span class="fvg-pair">${escapeHtml(item.pair)}</span>
          <span class="fvg-type-badge ${item.fvg_type}">${item.fvg_type.toUpperCase()} FVG</span>
          ${distBadge}
          <span class="fvg-zone">
            <span class="fvg-zone-label">Zone:</span>
            <span class="fvg-zone-prices">${fmt(item.bottom)} – ${fmt(item.top)}</span>
          </span>
          <span class="fvg-price">
            <span class="fvg-price-label">Price:</span>
            <span class="fvg-price-value">${fmt(item.current_price)}</span>
          </span>
          <span class="volatile-dir ${dirCls}">${dir}</span>
          <button class="fvg-expand-btn" type="button" aria-expanded="false" aria-controls="${dropId}" title="Show all FVGs for ${escapeHtml(item.pair)}">
            <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true"><path d="M6 8.5L1 3.5h10L6 8.5z"/></svg>
            All FVGs
          </button>
          <div class="fvg-desc">${escapeHtml(item.description)}</div>
        </div>
        <div class="fvg-dropdown" id="${dropId}" hidden data-pair="${escapeHtml(pairKey)}"></div>`;
    }).join('');

    // Attach expand button listeners
    listEl.querySelectorAll('.fvg-expand-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const row    = btn.closest('.fvg-row');
        const dropId = row ? row.dataset.drop : null;
        const drop   = dropId ? document.getElementById(dropId) : null;
        const pair   = row ? row.dataset.pair : null;
        if (!drop) return;
        const isOpen = !drop.hidden;
        drop.hidden = isOpen;
        btn.setAttribute('aria-expanded', String(!isOpen));
        btn.classList.toggle('fvg-expand-btn--open', !isOpen);
        if (!isOpen && pair && _fvgPairFvgs[pair]) {
          renderFvgDropdown(drop, pair, _fvgPairFvgs[pair]);
        }
      });
    });
  });

  if (loadingEl) loadingEl.style.display = 'none';
  if (contentEl) contentEl.style.display = 'block';
}

/** Render all active FVGs for a pair in the dropdown panel, including magnitude data. */
function renderFvgDropdown(dropEl, pair, fvgs) {
  const dec = getPairDecimals(pair);
  const pip = dec === 2 ? 0.01 : 0.0001;
  const fmt = v => Number(v).toFixed(dec);
  if (!fvgs || fvgs.length === 0) {
    dropEl.innerHTML = '<div class="fvg-drop-empty">No FVGs available for this pair.</div>';
    return;
  }
  // Only show active (unfilled) FVGs — consumed zones are excluded
  const active = fvgs.filter(f => !f.filled);
  // Current market price is the same for all FVGs of a pair — show it once in the header
  const currentPrice = fvgs[0] ? fvgs[0].current_price : null;
  const marketPrice  = currentPrice != null ? fmt(currentPrice) : '—';

  /**
   * Classify gap size (in pips) into a magnitude label.
   * Thresholds are intentionally generous to cover both tight FX pairs (4 dec)
   * and high-priced commodities (2 dec, e.g. Gold) where pip values differ.
   */
  function magnitudeLabel(pips) {
    if (pips < 5)   return { label: 'Tiny',   cls: 'mag-tiny'   };
    if (pips < 20)  return { label: 'Small',  cls: 'mag-small'  };
    if (pips < 60)  return { label: 'Medium', cls: 'mag-medium' };
    return           { label: 'Large',  cls: 'mag-large'  };
  }

  /** Build an SVG magnitude bar whose filled width reflects gap size relative to 100 pips. */
  function magnitudeSvg(pips) {
    const pct = Math.min(100, (pips / 100) * 100);
    const color = pips < 5 ? '#8b949e' : pips < 20 ? '#d29922' : pips < 60 ? '#58a6ff' : '#f85149';
    return `<svg class="fvg-mag-bar-svg" viewBox="0 0 80 8" width="80" height="8" aria-hidden="true">
      <rect x="0" y="0" width="80" height="8" rx="4" fill="rgba(139,148,158,0.15)"/>
      <rect x="0" y="0" width="${(pct / 100) * 80}" height="8" rx="4" fill="${color}"/>
    </svg>`;
  }

  const renderGroup = items => items.map(f => {
    const typeIcon = f.type === 'bullish' ? '▲' : '▼';
    const typeCls  = f.type === 'bullish' ? 'bullish' : 'bearish';
    const midVal   = f.mid != null ? f.mid : ((f.top + f.bottom) / 2);

    // ── Magnitude ──────────────────────────────────────────────────────────────
    const gapSize  = Math.abs(f.top - f.bottom);
    const gapPips  = gapSize / pip;
    const mag      = magnitudeLabel(gapPips);

    // ── Price position relative to zone ────────────────────────────────────────
    let posLabel, posCls;
    if (currentPrice == null) {
      posLabel = '—'; posCls = '';
    } else if (currentPrice > f.top) {
      posLabel = 'Price ABOVE zone ↑'; posCls = 'pos-above';
    } else if (currentPrice < f.bottom) {
      posLabel = 'Price BELOW zone ↓'; posCls = 'pos-below';
    } else {
      posLabel = '⚡ Price INSIDE zone'; posCls = 'pos-inside';
    }

    // ── Distance from zone ─────────────────────────────────────────────────────
    let distText;
    if (currentPrice == null) {
      distText = '—';
    } else if (currentPrice >= f.bottom && currentPrice <= f.top) {
      distText = 'Inside zone';
    } else if (currentPrice > f.top) {
      const distPips = (currentPrice - f.top) / pip;
      distText = `${distPips.toFixed(1)} pips from top`;
    } else {
      const distPips = (f.bottom - currentPrice) / pip;
      distText = `${distPips.toFixed(1)} pips from bottom`;
    }

    // ── Potential target ───────────────────────────────────────────────────────
    let targetText;
    if (f.type === 'bullish') {
      targetText = currentPrice != null && currentPrice < f.bottom
        ? `If price enters → target: ${fmt(f.top)} (+${((f.top - currentPrice) / pip).toFixed(1)} pips)`
        : `Zone top: ${fmt(f.top)}`;
    } else {
      targetText = currentPrice != null && currentPrice > f.top
        ? `If price enters → target: ${fmt(f.bottom)} (${((currentPrice - f.bottom) / pip).toFixed(1)} pips)`
        : `Zone bottom: ${fmt(f.bottom)}`;
    }

    return `
      <div class="fvg-drop-item">
        <div class="fvg-drop-item-header">
          <span class="fvg-type-badge ${typeCls}">${typeIcon} ${f.type.toUpperCase()} FVG</span>
          <span class="fvg-drop-status fvg-drop-status--active">⚡ Active</span>
          <span class="fvg-drop-date">${escapeHtml(f.created)}</span>
        </div>
        <div class="fvg-drop-item-body">
          <div class="fvg-drop-data-row">
            <span class="fvg-zone-label">Zone:</span>
            <span class="fvg-drop-zone"><strong>${fmt(f.bottom)} – ${fmt(f.top)}</strong></span>
            <span class="fvg-zone-label">Mid:</span>
            <span class="fvg-drop-price fvg-price-value">${fmt(midVal)}</span>
          </div>
          <div class="fvg-drop-magnitude-row">
            <span class="fvg-zone-label">Magnitude:</span>
            <span class="fvg-mag-badge ${mag.cls}">${mag.label}</span>
            <span class="fvg-mag-pips">${gapPips.toFixed(1)} pips</span>
            ${magnitudeSvg(gapPips)}
          </div>
          <div class="fvg-drop-position-row">
            <span class="fvg-zone-label">Position:</span>
            <span class="fvg-drop-pos ${posCls}">${posLabel}</span>
            <span class="fvg-zone-label">Distance:</span>
            <span class="fvg-drop-dist">${escapeHtml(distText)}</span>
          </div>
          <div class="fvg-drop-target-row">
            <span class="fvg-zone-label">Target:</span>
            <span class="fvg-drop-target">${escapeHtml(targetText)}</span>
          </div>
        </div>
        <div class="fvg-drop-desc">${escapeHtml(f.description)}</div>
      </div>`;
  }).join('');

  dropEl.innerHTML = `
    <div class="fvg-dropdown-inner">
      <div class="fvg-drop-header">
        📊 Active FVGs for ${escapeHtml(pair)}
        <span class="fvg-drop-market-price">Market: <strong>${marketPrice}</strong></span>
      </div>
      ${active.length > 0 ? renderGroup(active) : '<div class="fvg-drop-empty">No active FVGs for this pair.</div>'}
    </div>`;
}

/** Apply FVG group visibility based on selected filter. */
function applyFvgFilter(filter) {
  _currentFvgFilter = filter;
  document.querySelectorAll('#fvg-content .fvg-group').forEach(group => {
    const groupName = group.dataset.group;
    // Never show the passed (consumed) group — it has been removed from the UI
    if (groupName === 'passed') {
      group.classList.add('fx-hidden');
      return;
    }
    group.classList.toggle('fx-hidden', groupName !== filter);
  });
  // Update active button state
  document.querySelectorAll('.fvg-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
}

// FVG filter button listeners
document.querySelectorAll('.fvg-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => applyFvgFilter(btn.dataset.filter));
});

const refreshFvgBtn = document.getElementById('btn-refresh-fvg');
if (refreshFvgBtn) {
  refreshFvgBtn.addEventListener('click', () => {
    fvgLoaded = false;
    loadFvgScanner();
  });
}

// ─── S/R Breakout Scanner ────────────────────────────────────────────────────
let srBreakoutsLoaded = false;

async function loadSrBreakouts() {
  const loadingEl  = document.getElementById('sr-loading');
  const contentEl  = document.getElementById('sr-content');
  const emptyEl    = document.getElementById('sr-empty');
  if (!loadingEl) return;

  loadingEl.style.display = 'block';
  if (contentEl) contentEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    const res = await fetch('/api/forex/sr-breakouts');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    srBreakoutsLoaded = true;
    renderSrBreakouts(data.sr_groups || {});

    const brokeCount = (data.sr_groups?.broke || []).length;
    if (brokeCount > 0) {
      playSignalSound('breakout');
      showToast('toast-info', '💥', 'S/R Breakout Detected',
        `${brokeCount} breakout${brokeCount > 1 ? 's' : ''} confirmed`, 5000);
    }
  } catch (err) {
    if (loadingEl) loadingEl.textContent = 'Could not load S/R data.';
    console.error('S/R scanner failed:', err);
  }
}

/** Build a row for an S/R level item. */
function buildSrRow(item, idx) {
  const isResistance = item.type.startsWith('resistance');
  const cls   = isResistance ? 'buy' : 'sell';
  const icon  = isResistance ? '▲' : '▼';
  const srLabel = isResistance ? 'Resistance' : 'Support';
  const dec   = (item.pair && (item.pair.includes('JPY') || item.pair.startsWith('XAU'))) ? 2 : 4;
  const fmt   = v => Number(v).toFixed(dec);
  const svgStatus = isResistance ? 'resistance' : 'support';
  const distBadge = item.dist != null ? ` <span class="fvg-dist-badge">${(item.dist * 100).toFixed(3)}%</span>` : '';
  return `
    <div class="volatile-row sr-break-row" style="animation-delay:${idx * 60}ms">
      <span class="fvg-status-svg-wrap">${buildStatusSvg(svgStatus)}</span>
      <span class="volatile-pair">${escapeHtml(item.pair)}</span>
      <span class="sr-break-label ${cls}">${icon} ${srLabel}</span>
      <span class="sr-break-level">Level: <strong>${fmt(item.level)}</strong>${distBadge}</span>
      <span class="sr-break-price">Price: <strong>${fmt(item.current_price)}</strong></span>
      <div class="sr-break-desc" style="grid-column:1/-1;font-size:.82rem;color:var(--text2);margin-top:4px">${escapeHtml(item.description)}</div>
    </div>`;
}

function renderSrBreakouts(srGroups) {
  const loadingEl  = document.getElementById('sr-loading');
  const contentEl  = document.getElementById('sr-content');
  const emptyEl    = document.getElementById('sr-empty');

  if (loadingEl) loadingEl.style.display = 'none';

  const totalItems = Object.values(srGroups).reduce((acc, arr) => acc + arr.length, 0);
  if (totalItems === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }

  // Populate each group container
  const groupMap = {
    soon_touching: document.getElementById('sr-soon-touching'),
    touched:       document.getElementById('sr-touched'),
    broke:         document.getElementById('sr-broke'),
  };

  Object.entries(groupMap).forEach(([key, listEl]) => {
    if (!listEl) return;
    const items = srGroups[key] || [];
    if (items.length === 0) {
      listEl.innerHTML = '<div class="fvg-empty">No pairs in this category right now.</div>';
    } else {
      listEl.innerHTML = items.map((item, idx) => buildSrRow(item, idx)).join('');
    }
  });

  if (contentEl) contentEl.style.display = 'block';
}

const refreshSrBtn = document.getElementById('btn-refresh-sr');
if (refreshSrBtn) {
  refreshSrBtn.addEventListener('click', () => {
    srBreakoutsLoaded = false;
    loadSrBreakouts();
  });
}

// S/R group filter (tabs within the S/R Breaks section)
function applySrFilter(filter) {
  document.querySelectorAll('.sr-group').forEach(group => {
    group.classList.toggle('fx-hidden', group.dataset.srGroup !== filter);
  });
  document.querySelectorAll('.sr-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.srFilter === filter);
  });
}

document.querySelectorAll('.sr-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => applySrFilter(btn.dataset.srFilter));
});

// ─── Event wiring ─────────────────────────────────────────────────────────────
// Per-pair last-seen direction cache so switching pairs doesn't trigger
// false "new signal" notifications on the initial load for that pair.
const lastDirectionByPair = {};

pairSelect.addEventListener('change', () => {
  currentPair = pairSelect.value;
  // Carry forward the previously seen direction for this pair (if any)
  // so the first load only fires a new-signal alert when the direction
  // has genuinely changed since the last time this pair was viewed.
  previousDirection = lastDirectionByPair[currentPair] ?? null;
  loadSignal(currentPair);
  resetAutoRefresh();
  // Keep live technical price in sync when pair changes
  if (_techPriceTimer !== null) startTechPricePolling();
});

refreshBtn.addEventListener('click', () => {
  loadSignal(currentPair);
  resetAutoRefresh();
});

function resetAutoRefresh() {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadSignal(currentPair), REFRESH_INTERVAL_MS);
}

// ─── Resize chart on window resize ───────────────────────────────────────────
let resizeDebounce = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeDebounce);
  resizeDebounce = setTimeout(() => {
    if (signalData) drawChart(signalData.history);
  }, 200);
});

// ─── Loading Overlay ──────────────────────────────────────────────────────────
const loadingOverlay = document.getElementById('piitrade-loading-overlay');
const loaderTextEl   = document.getElementById('piitrade-loader-text');
const DOT_FRAMES = [
  '.... PIITRADE ....',
  ' ... PIITRADE ... ',
  '  .. PIITRADE ..  ',
  '   . PIITRADE .   ',
];
let loaderDotIdx    = 0;
let loaderDotTimer  = null;
let pendingLoads    = 0;

function startLoaderDots() {
  if (loaderDotTimer) return;
  loaderDotTimer = setInterval(() => {
    loaderDotIdx = (loaderDotIdx + 1) % DOT_FRAMES.length;
    if (loaderTextEl) loaderTextEl.textContent = DOT_FRAMES[loaderDotIdx];
  }, 300);
}

function stopLoaderDots() {
  clearInterval(loaderDotTimer);
  loaderDotTimer = null;
}

function showPageLoader() {
  pendingLoads++;
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
    startLoaderDots();
  }
}

function hidePageLoader() {
  pendingLoads = Math.max(0, pendingLoads - 1);
  if (pendingLoads === 0 && loadingOverlay) {
    stopLoaderDots();
    loadingOverlay.classList.add('hidden');
  }
}

// ─── Init ─────────────────────────────────────────────────────────────────────
// Restore gamification state
updateGameBar();
renderBadges();

// Default tab: Signal
activateTab('section-signal');

// Show loading overlay while the initial signal + news load in parallel
showPageLoader();
Promise.all([loadSignal(currentPair), loadNews()])
  .finally(() => {
    hidePageLoader();
    // Pre-fetch all other tab resources silently in the background so that
    // when a user clicks any tab the data is already rendered and ready.
    loadFvgScanner();
    loadSrBreakouts();
    loadVolatilePairs(currentVolatileTf);
    loadReversalPairs();
    loadPatternScanner();
  });
resetAutoRefresh();

// ─── Live Price for Technical Analysis ────────────────────────────────────────
const TECH_PRICE_INTERVAL_MS = 30_000; // poll every 30 s
let _techPriceTimer = null;

function updateTechCurrentPrice(pair) {
  fetch(`/api/forex/technical?pair=${encodeURIComponent(pair)}`)
    .then(r => r.json())
    .then(data => {
      const el    = document.getElementById('ta-current-price');
      const pairL = document.getElementById('ta-pair-label');
      const time  = document.getElementById('ta-price-updated');
      const badge = document.getElementById('ta-live-price-badge');
      if (!el) return;
      const dec    = (pair.includes('JPY') || pair.startsWith('XAU')) ? 2 : 4;
      el.textContent    = Number(data.current_price).toFixed(dec);
      if (pairL) pairL.textContent  = pair;
      if (time)  time.textContent   = `Updated: ${new Date().toLocaleTimeString()}`;
      if (badge) {
        badge.textContent = '🟢 Live';
        badge.className   = 'fx-data-source live';
      }
      el.classList.add('ta-price-flash');
      el.addEventListener('animationend', () => el.classList.remove('ta-price-flash'), { once: true });
    })
    .catch(() => {
      const badge = document.getElementById('ta-live-price-badge');
      if (badge) { badge.textContent = '🟡 Cached'; badge.className = 'fx-data-source static'; }
    });
}

function startTechPricePolling() {
  if (_techPriceTimer) clearInterval(_techPriceTimer);
  updateTechCurrentPrice(currentPair);
  _techPriceTimer = setInterval(() => updateTechCurrentPrice(currentPair), TECH_PRICE_INTERVAL_MS);
}

// Start polling when Technical tab is opened
document.querySelectorAll('.fx-tab').forEach(tab => {
  if (tab.dataset.section === 'section-technical') {
    tab.addEventListener('click', () => {
      startTechPricePolling();
    });
  }
  // Reload pattern scanner when Patterns tab is opened (if not already loaded)
  if (tab.dataset.section === 'section-patterns') {
    tab.addEventListener('click', () => {
      if (!patternLoaded) loadPatternScanner();
    });
  }
});

// Also update technical price when pair changes (handled via existing pairSelect listener)

// ─── Global Disclaimer Close ──────────────────────────────────────────────────
const disclaimerClose = document.querySelector('.global-disclaimer-close');
const disclaimerEl    = document.querySelector('.global-disclaimer');
if (disclaimerClose && disclaimerEl) {
  disclaimerClose.addEventListener('click', () => {
    disclaimerEl.classList.add('global-disclaimer--hidden');
  });
}

// ─── Volatile Pairs ───────────────────────────────────────────────────────────
let currentVolatileTf = '1h';
let volatileLoaded = false;

/** Volatility percentage that maps to 100% bar width (anything above this is capped). */
const MAX_VOLATILITY_FOR_SCALE = 3.0; // 3% range → 100% bar width

function loadVolatilePairs(tf) {
  const loadingEl = document.getElementById('volatile-loading');
  const listEl    = document.getElementById('volatile-list');
  if (!loadingEl || !listEl) return;

  loadingEl.style.display = 'block';
  listEl.style.display    = 'none';

  fetch(`/api/forex/volatile?timeframe=${encodeURIComponent(tf)}`)
    .then(r => r.json())
    .then(data => {
      volatileLoaded = true;
      listEl.innerHTML = '';
      if (!data.pairs || data.pairs.length === 0) {
        listEl.innerHTML = '<div class="ta-loading">No volatile pairs found.</div>';
        loadingEl.style.display = 'none';
        listEl.style.display    = 'block';
        return;
      }
      data.pairs.forEach((item, idx) => {
        const dir   = item.direction;
        const arrow = dir === 'BUY' ? '▲' : (dir === 'SELL' ? '▼' : '→');
        const cls   = dir === 'BUY' ? 'buy' : (dir === 'SELL' ? 'sell' : 'hold');
        const rank  = idx + 1;
        const volBar = Math.min(100, (item.volatility_pct / MAX_VOLATILITY_FOR_SCALE) * 100); // scale MAX_VOLATILITY_FOR_SCALE% → 100%
        const row = document.createElement('div');
        row.className = 'volatile-row';
        row.style.animationDelay = `${idx * 60}ms`;
        row.innerHTML = `
          <span class="volatile-rank">#${rank}</span>
          <span class="volatile-pair">${escapeHtml(item.pair)}</span>
          <div class="volatile-bar-wrap" title="${item.volatility_pct}% range">
            <div class="volatile-bar-fill ${cls}" style="width:0"></div>
          </div>
          <span class="volatile-pct">${item.volatility_pct}%</span>
          <span class="volatile-dir ${cls}">${arrow} ${dir}</span>
          <span class="volatile-entry">${item.entry_price}</span>`;
        listEl.appendChild(row);
        // Animate bar width after a staggered delay so the grow is visible
        const fill = row.querySelector('.volatile-bar-fill');
        setTimeout(() => { fill.style.width = volBar + '%'; }, 80 + idx * 60);
      });
      loadingEl.style.display = 'none';
      listEl.style.display    = 'block';
    })
    .catch(() => {
      loadingEl.textContent   = '❌ Failed to load volatile pairs. Please retry.';
      loadingEl.style.display = 'block';
      listEl.style.display    = 'none';
    });
}

// Timeframe filter buttons
document.querySelectorAll('.volatile-tf-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.volatile-tf-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentVolatileTf = btn.dataset.tf;
    volatileLoaded    = false;
    loadVolatilePairs(currentVolatileTf);
  });
});

const refreshVolatileBtn = document.getElementById('btn-refresh-volatile');
if (refreshVolatileBtn) {
  refreshVolatileBtn.addEventListener('click', () => {
    volatileLoaded = false;
    loadVolatilePairs(currentVolatileTf);
  });
}

// ─── Trend Reversal Pairs ─────────────────────────────────────────────────────
let reversalLoaded = false;

function loadReversalPairs() {
  const loadingEl = document.getElementById('reversal-loading');
  const listEl    = document.getElementById('reversal-list');
  if (!loadingEl || !listEl) return;

  loadingEl.style.display = 'block';
  listEl.style.display    = 'none';

  fetch('/api/forex/reversals')
    .then(r => r.json())
    .then(data => {
      reversalLoaded = true;
      listEl.innerHTML = '';
      if (!data.pairs || data.pairs.length === 0) {
        listEl.innerHTML = '<div class="ta-loading">No reversal signals detected at this time.</div>';
        loadingEl.style.display = 'none';
        listEl.style.display    = 'block';
        return;
      }
      data.pairs.forEach((item, idx) => {
        const rev   = item.reversal_type;
        const arrow = rev === 'bullish' ? '▲' : '▼';
        const cls   = rev === 'bullish' ? 'buy' : 'sell';
        const label = rev === 'bullish' ? 'Bullish Reversal' : 'Bearish Reversal';
        const strengthBar = Math.min(100, item.strength);
        const row = document.createElement('div');
        row.className = 'volatile-row';
        row.style.animationDelay = `${idx * 60}ms`;
        row.innerHTML = `
          <span class="volatile-rank">#${idx + 1}</span>
          <span class="volatile-pair">${escapeHtml(item.pair)}</span>
          <div class="volatile-bar-wrap" title="Strength: ${item.strength}%">
            <div class="volatile-bar-fill ${cls}" style="width:0"></div>
          </div>
          <span class="volatile-pct">${item.strength}%</span>
          <span class="volatile-dir ${cls}">${arrow} ${label}</span>
          <span class="volatile-entry">${item.entry_price}</span>`;
        listEl.appendChild(row);
        const fill = row.querySelector('.volatile-bar-fill');
        setTimeout(() => { fill.style.width = strengthBar + '%'; }, 80 + idx * 60);
      });
      loadingEl.style.display = 'none';
      listEl.style.display    = 'block';
    })
    .catch(() => {
      loadingEl.textContent   = '❌ Failed to load reversal signals. Please retry.';
      loadingEl.style.display = 'block';
      listEl.style.display    = 'none';
    });
}

const refreshReversalBtn = document.getElementById('btn-refresh-reversal');
if (refreshReversalBtn) {
  refreshReversalBtn.addEventListener('click', () => {
    reversalLoaded = false;
    loadReversalPairs();
  });
}

// ─── Price Action Pattern Scanner ────────────────────────────────────────────
let patternLoaded = false;

/** Track pairs whose high-impact pattern has already triggered an alert
 *  (reset on each fresh pattern scan load to re-alert on new detections). */
const _alertedPatterns = new Set();

/** Impact definitions used throughout the pattern scanner. */
const PATTERN_IMPACT = {
  high:   { label: 'High Impact',   cls: 'impact-high',   sound: 'breakout' },
  medium: { label: 'Medium Impact', cls: 'impact-medium', sound: 'fvg'      },
  low:    { label: 'Low Impact',    cls: 'impact-low',    sound: null        },
};

/** Icon for each pattern type. */
const PATTERN_ICONS = {
  choch:         '🔄',
  bos:           '⚡',
  fvg_rejection: '🚫',
  fvg_inside:    '🎯',
  fvg_approach:  '📍',
  sr_broke:      '💥',
  sr_touched:    '🔔',
  sr_approaching:'📌',
  strong_signal: '💎',
};

/** Load all price-action patterns from the API and render them. */
async function loadPatternScanner() {
  const loadingEl = document.getElementById('pattern-loading');
  const contentEl = document.getElementById('pattern-content');
  const emptyEl   = document.getElementById('pattern-empty');
  if (!loadingEl || !contentEl) return;

  loadingEl.style.display = 'block';
  contentEl.style.display = 'none';
  if (emptyEl) emptyEl.style.display = 'none';

  try {
    const res = await fetch('/api/forex/pattern-scanner');
    if (!res.ok) throw new Error(await res.text());
    const data = await res.json();
    patternLoaded = true;
    renderPatternScanner(data.patterns || []);

    // Fire sound + toast for any new high-impact patterns
    const newHighImpact = (data.patterns || []).filter(p => {
      if (p.impact !== 'high') return false;
      const key = `${p.pair}::${p.type}`;
      if (_alertedPatterns.has(key)) return false;
      _alertedPatterns.add(key);
      return true;
    });

    if (newHighImpact.length > 0) {
      playSignalSound('breakout');
      const pairNames = [...new Set(newHighImpact.map(p => p.pair))].slice(0, 3).join(', ');
      const extra = newHighImpact.length > 3 ? ` +${newHighImpact.length - 3} more` : '';
      showToast('toast-sell', '🔮', 'Pattern Alert — High Impact!',
        `${pairNames}${extra}: ${newHighImpact[0].label}`, 7000);
    }
  } catch (err) {
    if (loadingEl) loadingEl.textContent = '❌ Failed to load pattern scanner data.';
    console.error('Pattern scanner failed:', err);
  }
}

/** Render the list of detected patterns. */
function renderPatternScanner(patterns) {
  const loadingEl = document.getElementById('pattern-loading');
  const contentEl = document.getElementById('pattern-content');
  const emptyEl   = document.getElementById('pattern-empty');
  const listEl    = document.getElementById('pattern-list');
  if (!listEl) return;

  if (loadingEl) loadingEl.style.display = 'none';

  if (patterns.length === 0) {
    if (emptyEl) { emptyEl.style.display = 'block'; return; }
  }

  // Group by impact
  const byImpact = { high: [], medium: [], low: [] };
  patterns.forEach(p => {
    const bucket = p.impact in byImpact ? p.impact : 'low';
    byImpact[bucket].push(p);
  });

  listEl.innerHTML = '';

  ['high', 'medium', 'low'].forEach(impact => {
    const items = byImpact[impact];
    if (items.length === 0) return;
    const imp = PATTERN_IMPACT[impact];

    const groupEl = document.createElement('div');
    groupEl.className = 'pattern-group';
    groupEl.innerHTML = `<div class="pattern-group-title ${imp.cls}">${imp.label} Formations (${items.length})</div>`;

    items.forEach((p, idx) => {
      const icon   = PATTERN_ICONS[p.type] || '📊';
      const dirCls = p.direction === 'BUY' ? 'buy' : p.direction === 'SELL' ? 'sell' : 'hold';
      const row    = document.createElement('div');
      row.className = 'pattern-row';
      row.style.animationDelay = `${idx * 50}ms`;
      row.innerHTML = `
        <span class="pattern-icon">${icon}</span>
        <span class="volatile-pair">${escapeHtml(p.pair)}</span>
        <span class="pattern-label">${escapeHtml(p.label)}</span>
        <span class="pattern-impact-badge ${imp.cls}">${imp.label}</span>
        <span class="volatile-dir ${dirCls}">${p.direction}</span>
        <div class="pattern-desc">${escapeHtml(p.description)}</div>`;
      groupEl.appendChild(row);
    });

    listEl.appendChild(groupEl);
  });

  if (contentEl) contentEl.style.display = 'block';
}

// Refresh button for pattern scanner
const refreshPatternBtn = document.getElementById('btn-refresh-patterns');
if (refreshPatternBtn) {
  refreshPatternBtn.addEventListener('click', () => {
    patternLoaded = false;
    _alertedPatterns.clear();
    loadPatternScanner();
  });
}
