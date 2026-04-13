import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Search, RefreshCw, Volume2, VolumeX,
  BarChart2, AlertTriangle, Target, Layers, Zap,
  Star, Award, Flame, ChevronRight, ChevronLeft, Newspaper, ExternalLink,
  ArrowRight,
} from 'lucide-react'
import {
  getPairs, getSignals, getTechnical, getVolatile, getReversals,
  getFvgScanner, getSrBreakouts, getPatternScanner,
  getEconomicCalendar, getNews,
} from '../utils/api'
import PartnerCards from '../components/PartnerCard'

// ─── helpers ───────────────────────────────────────────────────────────────
function dirColor(dir) {
  if (!dir) return 'text-text-secondary'
  const d = dir.toUpperCase()
  if (d === 'BUY') return 'text-accent-green'
  if (d === 'SELL') return 'text-accent-red'
  return 'text-accent-yellow'
}
function dirBg(dir) {
  if (!dir) return 'bg-bg-card'
  const d = dir.toUpperCase()
  if (d === 'BUY') return 'bg-accent-green/10 border-accent-green/30'
  if (d === 'SELL') return 'bg-accent-red/10 border-accent-red/30'
  return 'bg-accent-yellow/10 border-accent-yellow/30'
}
function dirGlow(dir) {
  if (!dir) return ''
  const d = dir.toUpperCase()
  if (d === 'BUY') return 'glow-green'
  if (d === 'SELL') return 'glow-red'
  return 'glow-yellow'
}
function DirIcon({ dir, size = 20 }) {
  const d = dir?.toUpperCase()
  if (d === 'BUY') return <TrendingUp size={size} />
  if (d === 'SELL') return <TrendingDown size={size} />
  return <Minus size={size} />
}

// ─── sound ─────────────────────────────────────────────────────────────────
function playSignalSound(dir) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.connect(g)
    g.connect(ctx.destination)
    g.gain.setValueAtTime(0.2, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
    const d = dir?.toUpperCase()
    o.frequency.setValueAtTime(d === 'BUY' ? 523 : d === 'SELL' ? 330 : 440, ctx.currentTime)
    o.start()
    o.stop(ctx.currentTime + 0.4)
  } catch { /* ignore */ }
}

// ─── gamification (localStorage) ───────────────────────────────────────────
const STORAGE_KEY = 'piitrade_gamification'
function loadGame() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { xp: 0, level: 1, streak: 0, badges: [] }
  } catch { return { xp: 0, level: 1, streak: 0, badges: [] } }
}
function saveGame(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}
function addXP(state, amount) {
  const newXP = state.xp + amount
  const newLevel = Math.floor(newXP / 100) + 1
  const badges = [...state.badges]
  if (newLevel >= 5 && !badges.includes('Pro Trader')) badges.push('Pro Trader')
  if (state.streak >= 7 && !badges.includes('Week Streak')) badges.push('Week Streak')
  return { ...state, xp: newXP, level: newLevel, badges }
}

const TABS = [
  { id: 'signal', label: '📊 Signal', icon: Zap },
  { id: 'risk', label: '📐 Risk Calc', icon: Target },
  { id: 'technical', label: '🔍 Technical', icon: BarChart2 },
  { id: 'fvg', label: '🌀 FVG', icon: Layers },
  { id: 'sr', label: '💥 S/R Breaks', icon: AlertTriangle },
  { id: 'volatile', label: '🔥 Volatile', icon: Flame },
  { id: 'reversal', label: '🔄 Reversal', icon: RefreshCw },
  { id: 'success', label: '🏆 Success', icon: Star },
  { id: 'scanner', label: '🔮 Scanner', icon: Search },
  { id: 'news', label: '📰 News', icon: Newspaper },
]

const MAJOR_PAIRS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'])
const MINOR_PAIRS = new Set(['EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD', 'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD', 'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD', 'NZD/JPY', 'NZD/CAD', 'NZD/CHF', 'CAD/JPY', 'CHF/JPY'])

// Fallback pairs if API is unreachable
const FALLBACK_PAIRS = [
  'EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD',
  'EUR/GBP', 'EUR/JPY', 'EUR/AUD', 'EUR/CAD', 'EUR/CHF', 'EUR/NZD',
  'GBP/JPY', 'GBP/CHF', 'GBP/AUD', 'GBP/CAD', 'GBP/NZD',
  'AUD/JPY', 'AUD/CAD', 'AUD/CHF', 'AUD/NZD',
  'NZD/JPY', 'NZD/CAD', 'NZD/CHF', 'CAD/JPY', 'CHF/JPY',
  'USD/MXN', 'USD/NOK', 'USD/SEK', 'USD/SGD', 'USD/HKD', 'USD/TRY', 'USD/ZAR', 'USD/CNY',
]

// ─── Advance Feature Promo Banner ────────────────────────────────────────────
function AdvancePromo() {
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem('advance_promo_dismissed') === '1' } catch { return false }
  })

  const dismiss = () => {
    try { localStorage.setItem('advance_promo_dismissed', '1') } catch { /* ignore */ }
    setDismissed(true)
  }

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.98 }}
        transition={{ duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative overflow-hidden rounded-xl border border-accent-blue/25 bg-gradient-to-r from-accent-blue/5 via-accent-purple/5 to-accent-green/5 p-3"
      >
        {/* Animated background pulse */}
        <motion.div
          animate={{ opacity: [0.04, 0.1, 0.04] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-xl bg-gradient-to-r from-accent-blue/10 to-accent-purple/10 pointer-events-none"
        />

        <div className="relative z-10 flex items-center gap-3">
          {/* Live indicator */}
          <div className="relative flex-shrink-0 flex items-center justify-center w-7 h-7">
            {[0, 1].map((i) => (
              <motion.span
                key={i}
                className="absolute rounded-full border border-accent-green"
                initial={{ opacity: 0.6, scale: 0.3 }}
                animate={{ opacity: 0, scale: 2 }}
                transition={{ duration: 1.8, delay: i * 0.9, repeat: Infinity, ease: 'easeOut' }}
                style={{ width: '100%', height: '100%' }}
              />
            ))}
            <motion.span
              className="relative z-10 w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_6px_2px_rgba(63,185,80,0.5)]"
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-text-primary text-xs font-bold">✨ Advanced Tools Available</span>
              <span className="hidden sm:inline text-text-muted text-xs">
                — FVG Scanner, S/R Breakouts, Volatility Rankings, Pattern Scanner &amp; more
              </span>
            </div>
          </div>

          {/* CTA */}
          <Link
            to="/advance"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-accent-blue text-bg-primary text-xs font-bold rounded-lg hover:bg-blue-400 transition-colors shadow-sm shadow-accent-blue/25 whitespace-nowrap"
          >
            <Zap size={11} />
            Explore
            <ArrowRight size={11} />
          </Link>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            className="flex-shrink-0 p-1 text-text-muted hover:text-text-primary transition-colors rounded"
            aria-label="Dismiss"
          >
            <span className="text-xs leading-none">✕</span>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── sub-components ─────────────────────────────────────────────────────────
function LoadingSpinner({ text = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-4">
      <div className="flex items-end gap-1 h-7">
        {[0, 1, 2, 3].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 rounded-full bg-accent-blue"
            animate={{ height: ['10px', '28px', '10px'] }}
            transition={{ duration: 0.8, delay: i * 0.14, repeat: Infinity, ease: 'easeInOut' }}
          />
        ))}
      </div>
      <p className="text-text-muted text-xs">{text}</p>
    </div>
  )
}
function EmptyState({ title, desc }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
        <BarChart2 size={24} className="text-text-muted" />
      </div>
      <h3 className="text-text-secondary font-medium mb-2">{title}</h3>
      <p className="text-text-muted text-sm">{desc}</p>
    </div>
  )
}
function ErrorBox({ msg }) {
  return (
    <div className="px-4 py-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-sm mb-4">
      {msg}
    </div>
  )
}

// ─── Signal Tab ──────────────────────────────────────────────────────────────
function SignalTab({ pair, signal, loading, error }) {
  if (loading) return <LoadingSpinner text="Generating signal…" />
  if (error) return <ErrorBox msg={error} />
  if (!signal) return <EmptyState title="No signal yet" desc="Select a pair to see its signal." />

  const dir = signal.signal || signal.direction || 'HOLD'
  const conf = signal.confidence ?? 50
  const accuracy = signal.accuracy_30d ?? signal.accuracy ?? null

  const bars = (signal.history || []).slice(-30)

  return (
    <div className="space-y-3">
      {/* AI Opportunity Label */}
      {(signal.ai_label || signal.opportunity) && (
        <motion.div
          key={signal.ai_label}
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-accent-blue/30 rounded-lg px-3 py-2 flex items-start gap-2"
        >
          <span className="text-accent-blue text-xs mt-0.5">🤖</span>
          <div>
            <p className="text-text-muted text-xs mb-0.5">AI Opportunity Label</p>
            <p className="text-sm font-semibold text-text-primary">{signal.ai_label || signal.opportunity}</p>
          </div>
        </motion.div>
      )}

      {/* Main signal card */}
      <motion.div
        key={dir}
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className={`border rounded-xl p-3 ${dirBg(dir)} ${dirGlow(dir)}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <p className="text-text-muted text-xs mb-1">Signal for {pair}</p>
            <div className={`flex items-center gap-2 ${dirColor(dir)}`}>
              <DirIcon dir={dir} size={24} />
              <span className="text-3xl font-bold">{dir.toUpperCase()}</span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-text-muted text-xs mb-0.5">Model: LightGBM</p>
            {accuracy !== null && (
              <p className="text-lg font-bold text-text-primary">{typeof accuracy === 'number' ? accuracy.toFixed(1) : accuracy}% <span className="text-xs font-normal text-text-muted">30d acc</span></p>
            )}
            {signal.is_live !== undefined && (
              <span className={`inline-block text-xs px-1.5 py-0.5 rounded mt-1 ${signal.is_live ? 'bg-accent-green/10 text-accent-green' : 'bg-accent-yellow/10 text-accent-yellow'}`}>
                {signal.is_live ? '🔴 Live' : '⚠️ Cached'}
              </span>
            )}
          </div>
        </div>
      </motion.div>

      {/* Levels */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        {[
          { label: 'Entry', value: signal.entry_price ?? signal.entry ?? '—', color: 'text-text-primary' },
          { label: 'Take Profit', value: signal.take_profit ?? signal.tp ?? '—', color: 'text-accent-green' },
          { label: 'Stop Loss', value: signal.stop_loss ?? signal.sl ?? '—', color: 'text-accent-red' },
        ].map((item) => (
          <div key={item.label} className="bg-bg-card border border-border-default rounded-lg p-3">
            <p className="text-text-muted text-xs mb-0.5">{item.label}</p>
            <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Data source & timestamp */}
      {(signal.data_source || signal.generated_at) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted">
          {signal.data_source && <span>📡 Source: {signal.data_source}</span>}
          {signal.generated_at && (
            <span>🕐 Updated: {new Date(signal.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          )}
        </div>
      )}

      {/* Confidence meter */}
      <div className="bg-bg-card border border-border-default rounded-lg p-3">
        <div className="flex justify-between text-xs text-text-secondary mb-1.5">
          <span>Confidence</span>
          <span className="font-semibold">{conf}%</span>
        </div>
        <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${conf}%` }}
            transition={{ duration: 1 }}
            className={`h-full rounded-full ${conf >= 70 ? 'bg-accent-green' : conf >= 50 ? 'bg-accent-yellow' : 'bg-accent-red'}`}
          />
        </div>
      </div>

      {/* Historical accuracy mini-chart */}
      <div className="bg-bg-card border border-border-default rounded-lg p-3">
        <p className="text-text-secondary text-xs mb-2">Historical Accuracy (last 30 data points)</p>
        {bars.length === 0 ? (
          <p className="text-text-muted text-xs">No historical data available</p>
        ) : (
          <div className="flex items-end gap-0.5 h-16">
            {bars.map((b, i) => (
              <div
                key={i}
                className={`flex-1 rounded-sm transition-colors ${b.correct ? 'bg-accent-green/60 hover:bg-accent-green' : 'bg-accent-red/40 hover:bg-accent-red'}`}
                style={{ height: b.correct ? '80%' : '30%' }}
                title={b.correct ? `${b.day}: Correct` : `${b.day}: Incorrect`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Risk Calc Tab ────────────────────────────────────────────────────────────
function RiskCalcTab({ pair }) {
  const [balance, setBalance] = useState(10000)
  const [riskPct, setRiskPct] = useState(1)
  const [entry, setEntry] = useState('')
  const [sl, setSl] = useState('')
  const [tp, setTp] = useState('')
  const [pipValue, setPipValue] = useState(10)
  const [leverage, setLeverage] = useState(100)

  // Detect pip size based on pair (JPY pairs use 0.01, others 0.0001)
  const isJpy = pair?.includes('JPY')
  const pipMultiplier = isJpy ? 100 : 10000

  const entryNum = parseFloat(entry)
  const slNum = parseFloat(sl)
  const tpNum = parseFloat(tp)

  const riskAmount = (balance * riskPct) / 100

  // Pips between entry and stop loss — respects JPY vs non-JPY
  const slPips = entry && sl && !isNaN(entryNum) && !isNaN(slNum)
    ? Math.abs(entryNum - slNum) * pipMultiplier
    : 0

  // Pips between entry and take profit
  const tpPips = entry && tp && !isNaN(entryNum) && !isNaN(tpNum)
    ? Math.abs(tpNum - entryNum) * pipMultiplier
    : 0

  // Risk:Reward ratio (e.g. 1:2 = tpPips / slPips)
  const rrRatio = slPips > 0 && tpPips > 0 ? tpPips / slPips : null

  // Position size in lots: Risk Amount / (SL pips × Pip Value per lot)
  // pipValue defaults to $10/pip which is correct for 1 standard lot (100,000 units) of EUR/USD
  const positionSizeNum = slPips > 0 ? riskAmount / (slPips * pipValue) : null
  const positionSize = positionSizeNum !== null ? positionSizeNum.toFixed(2) : '—'

  // Margin required = (lots × contract size) / leverage
  // Contract size for forex = 100,000 units per standard lot
  const CONTRACT_SIZE = 100_000
  const margin = positionSizeNum !== null && leverage > 0
    ? ((positionSizeNum * CONTRACT_SIZE) / leverage).toFixed(2)
    : '—'

  // Potential profit if TP is hit
  const potentialProfit = positionSizeNum !== null && tpPips > 0
    ? (positionSizeNum * tpPips * pipValue).toFixed(2)
    : '—'

  return (
    <div className="space-y-3 max-w-md">
      <div className="bg-bg-card border border-border-default rounded-xl p-3 space-y-3">
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Account Balance ($)</label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated"
          />
        </div>
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Risk % — {riskPct}%</label>
          <input
            type="range" min="0.1" max="5" step="0.1"
            value={riskPct}
            onChange={(e) => setRiskPct(parseFloat(e.target.value))}
            className="w-full accent-blue-400"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Entry Price</label>
            <input
              type="number" step="0.00001" value={entry}
              onChange={(e) => setEntry(e.target.value)}
              placeholder={isJpy ? '154.820' : '1.08420'}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated placeholder-text-muted"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Stop Loss</label>
            <input
              type="number" step="0.00001" value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder={isJpy ? '154.000' : '1.08000'}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated placeholder-text-muted"
            />
          </div>
        </div>
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Take Profit</label>
          <input
            type="number" step="0.00001" value={tp}
            onChange={(e) => setTp(e.target.value)}
            placeholder={isJpy ? '156.400' : '1.09260'}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated placeholder-text-muted"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Pip Value ($)</label>
            <input
              type="number" value={pipValue}
              onChange={(e) => setPipValue(parseFloat(e.target.value) || 10)}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Leverage (1:x)</label>
            <select
              value={leverage}
              onChange={(e) => setLeverage(parseInt(e.target.value, 10))}
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated"
            >
              {[10, 20, 30, 50, 100, 200, 400, 500].map(l => (
                <option key={l} value={l}>1:{l}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Risk : Reward banner */}
      {rrRatio !== null && (
        <motion.div
          key={rrRatio.toFixed(2)}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className={`border rounded-xl p-3 flex items-center justify-between ${rrRatio >= 2 ? 'bg-accent-green/10 border-accent-green/40' : rrRatio >= 1.5 ? 'bg-accent-yellow/10 border-accent-yellow/40' : 'bg-accent-red/10 border-accent-red/40'}`}
        >
          <div>
            <p className="text-text-muted text-xs mb-0.5">Risk : Reward</p>
            <p className={`text-2xl font-bold font-mono ${rrRatio >= 2 ? 'text-accent-green' : rrRatio >= 1.5 ? 'text-accent-yellow' : 'text-accent-red'}`}>
              1 : {rrRatio.toFixed(2)}
            </p>
          </div>
          <div className="text-right text-xs text-text-muted">
            <p>SL: {slPips.toFixed(1)} pips</p>
            <p>TP: {tpPips.toFixed(1)} pips</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Risk Amount', value: `$${riskAmount.toFixed(2)}`, color: 'text-accent-red' },
          { label: 'Position Size (lots)', value: positionSize, color: 'text-accent-green' },
          { label: 'SL Pips at Risk', value: slPips > 0 ? slPips.toFixed(1) : '—', color: 'text-accent-yellow' },
          { label: 'Margin Required', value: margin !== '—' ? `$${margin}` : '—', color: 'text-accent-blue' },
          { label: 'Potential Profit', value: potentialProfit !== '—' ? `$${potentialProfit}` : '—', color: 'text-accent-green' },
          { label: 'Pip Size', value: isJpy ? '0.01' : '0.0001', color: 'text-text-secondary' },
        ].map((item) => (
          <div key={item.label} className="bg-bg-card border border-border-default rounded-lg p-3">
            <p className="text-text-muted text-xs mb-0.5">{item.label}</p>
            <p className={`text-lg font-bold font-mono ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Technical Chart (SVG) ────────────────────────────────────────────────────
function TechnicalChart({ data }) {
  const currentPrice = data.current_price
  const sr = data.support_resistance || {}
  const supportLevels = Array.isArray(sr.support) ? sr.support : []
  const resistanceLevels = Array.isArray(sr.resistance) ? sr.resistance : []
  const fvgZones = data.fvg || []
  const hvzones = data.high_volume_zones || []
  const bos = data.bos || []
  const choch = data.choch || []

  const allPrices = [
    currentPrice,
    ...supportLevels, ...resistanceLevels,
    ...fvgZones.flatMap(z => [z.top, z.bottom]),
    ...hvzones.flatMap(z => [z.top, z.bottom]),
    ...bos.map(b => b.level),
    ...choch.map(c => c.level),
  ].filter(p => p != null && !isNaN(p))

  if (allPrices.length === 0) return null

  const minPrice = Math.min(...allPrices)
  const maxPrice = Math.max(...allPrices)
  const range = maxPrice - minPrice || currentPrice * 0.005
  const pad = range * 0.18
  const chartMin = minPrice - pad
  const chartMax = maxPrice + pad
  const chartRange = chartMax - chartMin
  const W = 700; const H = 300; const LW = 68

  const toY = (price) => ((chartMax - price) / chartRange) * H

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-3">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <h3 className="text-text-primary text-sm font-semibold">📊 Price Structure Chart — {data.pair}</h3>
        <div className="flex flex-wrap gap-2 text-xs">
          {[['bg-accent-green/60','Support'],['bg-accent-red/60','Resistance'],['bg-accent-blue/30','FVG Bull'],['bg-accent-red/20','FVG Bear'],['bg-accent-yellow/30','High Vol']].map(([col,lbl]) => (
            <span key={lbl} className="flex items-center gap-1 text-text-muted">
              <span className={`w-3 h-2 rounded-sm ${col} inline-block`} />{lbl}
            </span>
          ))}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ minWidth: 280, height: H }}>
          {/* Grid */}
          {[0,25,50,75,100].map(pct => {
            const price = chartMax - (pct/100)*chartRange
            const y = (pct/100)*H
            return (
              <g key={pct}>
                <line x1={LW} y1={y} x2={W} y2={y} stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
                <text x={LW-4} y={y+4} textAnchor="end" fontSize="8" fill="rgba(180,180,180,0.35)">{price.toFixed(5)}</text>
              </g>
            )
          })}
          {/* High Volume Trade Zones */}
          {hvzones.map((z,i) => {
            const y1 = toY(z.top); const y2 = toY(z.bottom)
            const y = Math.min(y1,y2); const h = Math.max(Math.abs(y2-y1),3)
            return (
              <g key={`hvz${i}`}>
                <rect x={LW} y={y} width={W-LW} height={h}
                  fill={z.strength==='high'?'rgba(251,191,36,0.13)':'rgba(251,191,36,0.07)'}
                  stroke="rgba(251,191,36,0.35)" strokeWidth="0.6" strokeDasharray="3,3"/>
                <text x={LW+5} y={y+h/2+3} fontSize="7.5" fill="rgba(251,191,36,0.75)">
                  🔥 {z.strength==='high'?'High Vol':'Med Vol'}
                </text>
              </g>
            )
          })}
          {/* FVG Zones */}
          {fvgZones.map((z,i) => {
            const y1 = toY(z.top); const y2 = toY(z.bottom)
            const y = Math.min(y1,y2); const h = Math.max(Math.abs(y2-y1),3)
            const bull = z.type==='bullish'; const filled = z.filled
            return (
              <g key={`fvg${i}`}>
                <rect x={LW+8} y={y} width={W-LW-8} height={h}
                  fill={bull?(filled?'rgba(74,222,128,0.05)':'rgba(74,222,128,0.16)'):(filled?'rgba(248,113,113,0.05)':'rgba(248,113,113,0.16)')}
                  stroke={bull?(filled?'rgba(74,222,128,0.25)':'rgba(74,222,128,0.55)'):(filled?'rgba(248,113,113,0.25)':'rgba(248,113,113,0.55)')}
                  strokeWidth="0.8"/>
                <text x={LW+13} y={y+h/2+3} fontSize="7.5"
                  fill={bull?'rgba(74,222,128,0.85)':'rgba(248,113,113,0.85)'}>
                  🌀 FVG {bull?'▲':'▼'}{filled?' (Filled)':''}
                </text>
              </g>
            )
          })}
          {/* Support lines */}
          {supportLevels.map((lvl,i) => {
            const y = toY(lvl)
            return (
              <g key={`s${i}`}>
                <line x1={LW} y1={y} x2={W} y2={y} stroke="rgba(74,222,128,0.7)" strokeWidth="1.5"/>
                <text x={W-3} y={y-3} textAnchor="end" fontSize="7.5" fill="rgba(74,222,128,0.85)">
                  S{i+1} {typeof lvl==='number'?lvl.toFixed(5):lvl}
                </text>
              </g>
            )
          })}
          {/* Resistance lines */}
          {resistanceLevels.map((lvl,i) => {
            const y = toY(lvl)
            return (
              <g key={`r${i}`}>
                <line x1={LW} y1={y} x2={W} y2={y} stroke="rgba(248,113,113,0.7)" strokeWidth="1.5"/>
                <text x={W-3} y={y-3} textAnchor="end" fontSize="7.5" fill="rgba(248,113,113,0.85)">
                  R{i+1} {typeof lvl==='number'?lvl.toFixed(5):lvl}
                </text>
              </g>
            )
          })}
          {/* BOS markers */}
          {bos.map((b,i) => {
            const y = toY(b.level); const bull = b.type==='bullish'
            return (
              <g key={`bos${i}`}>
                <line x1={LW} y1={y} x2={W-80} y2={y} stroke={bull?'rgba(74,222,128,0.45)':'rgba(248,113,113,0.45)'} strokeWidth="1" strokeDasharray="4,2"/>
                <rect x={LW+5} y={y-8} width={34} height={14} rx={3}
                  fill={bull?'rgba(74,222,128,0.12)':'rgba(248,113,113,0.12)'}
                  stroke={bull?'rgba(74,222,128,0.4)':'rgba(248,113,113,0.4)'} strokeWidth="0.5"/>
                <text x={LW+9} y={y+3.5} fontSize="7" fill={bull?'rgba(74,222,128,0.95)':'rgba(248,113,113,0.95)'} fontWeight="bold">⚡BOS</text>
              </g>
            )
          })}
          {/* CHoCH markers */}
          {choch.map((c,i) => {
            const y = toY(c.level); const bull = c.type==='bullish'
            return (
              <g key={`choch${i}`}>
                <line x1={LW} y1={y} x2={W-80} y2={y} stroke="rgba(139,92,246,0.55)" strokeWidth="1" strokeDasharray="2,2"/>
                <rect x={LW+43} y={y-8} width={44} height={14} rx={3}
                  fill="rgba(139,92,246,0.12)" stroke="rgba(139,92,246,0.4)" strokeWidth="0.5"/>
                <text x={LW+47} y={y+3.5} fontSize="7" fill="rgba(139,92,246,0.95)" fontWeight="bold">🔄CHoCH {bull?'▲':'▼'}</text>
              </g>
            )
          })}
          {/* Current price */}
          {currentPrice != null && (() => {
            const y = toY(currentPrice)
            return (
              <g>
                <line x1={LW} y1={y} x2={W} y2={y} stroke="#60a5fa" strokeWidth="2" strokeDasharray="7,3"/>
                <rect x={LW+2} y={y-9} width={78} height={17} rx={4} fill="rgba(96,165,250,0.18)" stroke="rgba(96,165,250,0.6)" strokeWidth="0.7"/>
                <text x={LW+6} y={y+3.5} fontSize="8.5" fill="#60a5fa" fontWeight="bold">
                  ● {currentPrice.toFixed(5)}
                </text>
              </g>
            )
          })()}
        </svg>
      </div>
    </div>
  )
}

// ─── Technical Tab ────────────────────────────────────────────────────────────
function TechnicalTab({ pair }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchData = useCallback(() => {
    if (!pair) return
    getTechnical(pair)
      .then((res) => { setData(res); setLoading(false); setError(null); setLastUpdated(new Date()) })
      .catch(() => { setError('Failed to load technical data.'); setLoading(false) })
  }, [pair])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return <LoadingSpinner text="Running technical analysis…" />
  if (error && !data) return <ErrorBox msg={error} />

  const sr = data.support_resistance || data.sr || {}
  const fvg = data.fvg_zones || data.fvg || []
  const bos = data.bos || []
  const choch = data.choch || []
  const hvzones = data.high_volume_zones || []

  const supportLevels = Array.isArray(sr.support) ? sr.support : (sr.support != null ? [sr.support] : [])
  const resistanceLevels = Array.isArray(sr.resistance) ? sr.resistance : (sr.resistance != null ? [sr.resistance] : [])

  return (
    <div className="space-y-3">
      {/* Price Structure Chart */}
      <TechnicalChart data={data} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* S/R */}
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-3">Support &amp; Resistance</h3>
          <div className="space-y-2">
            {resistanceLevels.map((lvl, i) => (
              <div key={`res-${i}`} className="flex justify-between items-center py-2 px-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
                <div>
                  <span className="text-accent-red text-sm">Resistance {i + 1}</span>
                </div>
                <span className="font-mono text-sm text-text-primary">{typeof lvl === 'number' ? lvl.toFixed(5) : lvl}</span>
              </div>
            ))}
            {supportLevels.map((lvl, i) => (
              <div key={`sup-${i}`} className="flex justify-between items-center py-2 px-3 bg-accent-green/10 border border-accent-green/20 rounded-lg">
                <div>
                  <span className="text-accent-green text-sm">Support {i + 1}</span>
                </div>
                <span className="font-mono text-sm text-text-primary">{typeof lvl === 'number' ? lvl.toFixed(5) : lvl}</span>
              </div>
            ))}
            {!resistanceLevels.length && !supportLevels.length && (
              <p className="text-text-muted text-sm">No S/R data available</p>
            )}
          </div>
        </div>

        {/* BOS / CHoCH */}
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-3">Market Structure</h3>
          <div className="space-y-2">
            {[...bos.map(b => ({ ...b, label: 'BOS' })), ...choch.map(c => ({ ...c, label: 'CHoCH' }))].slice(0, 6).map((item, i) => (
              <div key={i} className="py-1.5 border-b border-border-subtle last:border-0">
                <div className="flex justify-between items-center">
                  <div>
                    <span className={`text-xs font-bold uppercase mr-1 px-1.5 py-0.5 rounded ${item.label === 'BOS' ? (item.type === 'bullish' ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red') : 'bg-accent-purple/15 text-accent-purple'}`}>
                      {item.label === 'BOS' ? '⚡' : '🔄'} {item.label}
                    </span>
                    <span className={`text-xs ml-1 ${item.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'}`}>{item.type}</span>
                  </div>
                  <span className="font-mono text-sm text-text-primary">{typeof item.level === 'number' ? item.level.toFixed(5) : item.level}</span>
                </div>
                {item.description && <p className="text-text-muted text-xs mt-1 leading-snug">{item.description}</p>}
              </div>
            ))}
            {!bos.length && !choch.length && <p className="text-text-muted text-sm">No market structure data</p>}
          </div>
        </div>
      </div>

      {/* FVG Zones */}
      {fvg.length > 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-2">🌀 Fair Value Gaps</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {fvg.map((zone, i) => (
              <div key={i} className={`rounded-lg p-2.5 border ${zone.type === 'bullish' ? (zone.filled ? 'bg-accent-green/5 border-accent-green/20' : 'bg-accent-green/12 border-accent-green/40') : (zone.filled ? 'bg-accent-red/5 border-accent-red/20' : 'bg-accent-red/12 border-accent-red/40')}`}>
                <div className="flex justify-between items-center mb-1">
                  <span className={`text-xs font-bold ${zone.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'}`}>
                    {zone.type === 'bullish' ? '▲' : '▼'} {zone.type?.toUpperCase()}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${zone.filled ? 'bg-bg-secondary text-text-muted' : 'bg-accent-blue/15 text-accent-blue'}`}>
                    {zone.filled ? 'Filled' : 'Active'}
                  </span>
                </div>
                <p className="text-text-muted text-xs">High: <span className="font-mono text-text-primary">{typeof zone.top === 'number' ? zone.top.toFixed(5) : zone.top}</span></p>
                <p className="text-text-muted text-xs">Low: <span className="font-mono text-text-primary">{typeof zone.bottom === 'number' ? zone.bottom.toFixed(5) : zone.bottom}</span></p>
                {zone.created && <p className="text-text-muted text-xs mt-1">Created: {zone.created}</p>}
                {zone.description && <p className="text-text-muted text-xs mt-1 leading-snug italic">{zone.description}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* High Volume Trade Zones */}
      {hvzones.length > 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-2">🔥 High Volume Trade Zones</h3>
          <div className="space-y-2">
            {hvzones.map((zone, i) => (
              <div key={i} className={`flex items-start justify-between py-2 px-3 rounded-lg border ${zone.strength === 'high' ? 'bg-accent-yellow/10 border-accent-yellow/35' : 'bg-accent-yellow/5 border-accent-yellow/20'}`}>
                <div>
                  <span className={`text-xs font-bold uppercase ${zone.strength === 'high' ? 'text-accent-yellow' : 'text-accent-yellow/70'}`}>
                    {zone.strength === 'high' ? '🔥' : '🟡'} {zone.strength} volume
                  </span>
                  <p className="text-text-muted text-xs mt-0.5">{zone.description}</p>
                </div>
                <div className="text-right text-xs font-mono text-text-secondary ml-2 flex-shrink-0">
                  <p>{typeof zone.top === 'number' ? zone.top.toFixed(5) : zone.top}</p>
                  <p className="text-text-muted">–</p>
                  <p>{typeof zone.bottom === 'number' ? zone.bottom.toFixed(5) : zone.bottom}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── FVG Tab ──────────────────────────────────────────────────────────────────
function FVGTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [statusFilter, setStatusFilter] = useState('approaching')
  const [expandedPair, setExpandedPair] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [countdown, setCountdown] = useState(30)

  const fetchData = useCallback(() => {
    getFvgScanner()
      .then((res) => { setData(res); setLoading(false); setError(null); setLastUpdated(new Date()) })
      .catch(() => { setError('Failed to load FVG data.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  // Countdown ticker — resets whenever lastUpdated changes (i.e. after a successful fetch)
  useEffect(() => {
    setCountdown(30)
    const t = setInterval(() => setCountdown(c => c > 0 ? c - 1 : 0), 1_000)
    return () => clearInterval(t)
  }, [lastUpdated])

  if (loading) return <LoadingSpinner text="Scanning FVG zones…" />
  if (error && !data) return <ErrorBox msg={error} />

  const grouped = data?.grouped || {}
  const pairFvgs = data?.pair_fvgs || {}

  const allItems = Array.isArray(data)
    ? data
    : Object.entries(grouped).flatMap(([status, list]) =>
        (list || []).map(item => ({ ...item, status }))
      )

  const filtered = statusFilter === 'all' ? allItems : allItems.filter(z => (z.status || 'active') === statusFilter)

  const STATUS_META = {
    approaching: { emoji: '🎯', label: 'Approaching', color: 'text-accent-yellow', border: 'border-accent-yellow/30', bg: 'bg-accent-yellow/10', activeBg: 'bg-accent-yellow text-bg-primary border-accent-yellow' },
    reached:     { emoji: '✅', label: 'Reached',    color: 'text-accent-green',  border: 'border-accent-green/30',  bg: 'bg-accent-green/10',  activeBg: 'bg-accent-green text-bg-primary border-accent-green'  },
    passed:      { emoji: '✔️', label: 'Passed',     color: 'text-text-muted',    border: 'border-border-default',   bg: 'bg-bg-card',           activeBg: 'bg-text-secondary text-bg-primary border-text-secondary' },
    rejected:    { emoji: '❌', label: 'Rejected',   color: 'text-accent-red',    border: 'border-accent-red/30',    bg: 'bg-accent-red/10',    activeBg: 'bg-accent-red text-bg-primary border-accent-red'    },
    all:         { emoji: '📋', label: 'All',        color: 'text-text-secondary', border: 'border-border-default',  bg: 'bg-bg-card',           activeBg: 'bg-accent-blue text-bg-primary border-accent-blue'  },
  }

  return (
    <div className="space-y-3">
      {/* Header with live update indicator */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent-green bg-accent-green/10 border border-accent-green/30 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse inline-block"/>
            LIVE
          </span>
          {lastUpdated && (
            <span className="text-text-muted text-xs">{lastUpdated.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>
          )}
        </div>
        <span className="text-text-muted text-xs">Refresh in {countdown}s</span>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-1.5">
        {['approaching','reached','rejected','passed','all'].map((s) => {
          const meta = STATUS_META[s]
          const count = s === 'all' ? allItems.length : allItems.filter(z => (z.status || 'active') === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border uppercase transition-all ${statusFilter === s ? meta.activeBg : `${meta.color} ${meta.border} ${meta.bg}`}`}
            >
              {meta.emoji} {meta.label} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={`No ${statusFilter === 'all' ? '' : STATUS_META[statusFilter]?.label + ' '}FVG zones`} desc={statusFilter === 'all' ? 'No fair value gaps detected.' : `No zones with status "${statusFilter}" found right now.`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((zone, i) => {
            const status = zone.status || 'active'
            const meta = STATUS_META[status] || STATUS_META.all
            const fvgType = zone.fvg_type || zone.type || ''
            const isBullish = fvgType === 'bullish'
            const pairKey = zone.pair
            const pairFvgList = pairKey ? (pairFvgs[pairKey] || []) : []
            const isExpanded = expandedPair === `${pairKey}-${i}`

            return (
              <div key={i} className={`bg-bg-card border ${meta.border} rounded-xl p-3 flex flex-col gap-2`}>
                {/* Header row */}
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-text-primary font-semibold text-sm">{zone.pair || `Zone ${i + 1}`}</p>
                    <span className={`text-xs font-bold uppercase ${meta.color}`}>{meta.emoji} {status}</span>
                  </div>
                  <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${isBullish ? 'bg-accent-green/15 text-accent-green' : 'bg-accent-red/15 text-accent-red'}`}>
                    {isBullish ? '▲ Bullish' : '▼ Bearish'}
                  </span>
                </div>

                {/* Zone levels */}
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {zone.top != null && (
                    <div className="bg-bg-secondary rounded px-2 py-1">
                      <p className="text-text-muted">Zone High</p>
                      <p className="font-mono text-text-primary font-medium">{typeof zone.top === 'number' ? zone.top.toFixed(5) : zone.top}</p>
                    </div>
                  )}
                  {zone.bottom != null && (
                    <div className="bg-bg-secondary rounded px-2 py-1">
                      <p className="text-text-muted">Zone Low</p>
                      <p className="font-mono text-text-primary font-medium">{typeof zone.bottom === 'number' ? zone.bottom.toFixed(5) : zone.bottom}</p>
                    </div>
                  )}
                </div>

                {/* Distance & signal */}
                <div className="flex gap-2 text-xs flex-wrap">
                  {zone.direction && (
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${dirColor(zone.direction)} bg-bg-secondary`}>
                      Signal: {zone.direction}
                    </span>
                  )}
                  {zone.dist != null && zone.dist > 0 && (
                    <span className="text-text-muted">Dist: <span className="font-mono">{(zone.dist * 100).toFixed(3)}%</span></span>
                  )}
                  {zone.created && (
                    <span className="text-text-muted">Created: {zone.created}</span>
                  )}
                </div>

                {/* Expandable: all FVGs for this pair */}
                {pairFvgList.length > 0 && (
                  <button
                    onClick={() => setExpandedPair(isExpanded ? null : `${pairKey}-${i}`)}
                    className="text-xs text-accent-blue hover:text-accent-blue/80 text-left flex items-center gap-1 pt-1 border-t border-border-subtle"
                  >
                    {isExpanded ? '▲' : '▼'} {isExpanded ? 'Hide' : 'Show'} all {pairFvgList.length} FVGs for {pairKey}
                  </button>
                )}
                {isExpanded && (
                  <div className="space-y-1.5 pt-1">
                    {pairFvgList.map((f, fi) => (
                      <div key={fi} className={`text-xs rounded-lg px-2 py-1.5 border ${f.type === 'bullish' ? 'bg-accent-green/8 border-accent-green/25' : 'bg-accent-red/8 border-accent-red/25'}`}>
                        <div className="flex justify-between items-center mb-1">
                          <span className={f.type === 'bullish' ? 'text-accent-green font-semibold' : 'text-accent-red font-semibold'}>
                            {f.type === 'bullish' ? '▲' : '▼'} {f.type?.toUpperCase()}
                          </span>
                          <span className={`px-1 py-0.5 rounded text-xs ${f.filled ? 'bg-bg-secondary text-text-muted' : 'bg-accent-blue/15 text-accent-blue'}`}>
                            {f.filled ? 'Filled' : 'Active'}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-1 text-text-muted">
                          <div><p>High</p><p className="font-mono text-text-primary">{f.top}</p></div>
                          <div><p>Mid</p><p className="font-mono text-text-primary">{f.mid}</p></div>
                          <div><p>Low</p><p className="font-mono text-text-primary">{f.bottom}</p></div>
                        </div>
                        {f.description && <p className="text-text-muted mt-1 italic leading-snug">{f.description}</p>}
                        {f.created && <p className="text-text-muted mt-0.5">Created: {f.created}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── S/R Breakouts Tab ────────────────────────────────────────────────────────
function SRTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    getSrBreakouts()
      .then((res) => { setData(res); setLoading(false); setError(null) })
      .catch(() => { setError('Failed to load S/R breakout data.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return <LoadingSpinner text="Detecting S/R breakouts…" />
  if (error && !data) return <ErrorBox msg={error} />
  const srGroups = data?.sr_groups || {}
  const items = Array.isArray(data)
    ? data
    : Object.entries(srGroups).flatMap(([status, list]) =>
        (list || []).map(item => ({ ...item, status }))
      )

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState title="No breakouts" desc="No S/R breakouts detected at this time." />
      ) : (
        <>
          {/* Card layout — responsive grid for all screen sizes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {items.map((b, i) => (
              <div key={i} className={`bg-bg-card border rounded-xl p-3 space-y-2 ${b.type?.startsWith('support') ? 'border-accent-green/30' : 'border-accent-red/30'}`}>
                <div className="flex items-center justify-between">
                  <span className="text-text-primary font-semibold">{b.pair || '—'}</span>
                  <span className={`text-xs font-bold uppercase ${b.type?.startsWith('support') ? 'text-accent-green' : 'text-accent-red'}`}>
                    {(b.type || '—').toUpperCase()}
                  </span>
                </div>
                {b.level != null && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-text-muted">S/R Level</span>
                    <span className="font-mono text-text-primary">{typeof b.level === 'number' ? b.level.toFixed(5) : b.level}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Status</span>
                  <span className={`font-semibold uppercase px-1.5 py-0.5 rounded ${b.status === 'broke' ? 'bg-accent-red/10 text-accent-red' : b.status === 'touched' ? 'bg-accent-yellow/10 text-accent-yellow' : 'bg-accent-blue/10 text-accent-blue'}`}>
                    {b.status || '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Direction</span>
                  <span className={`font-semibold ${dirColor(b.direction)}`}>{b.direction || '—'}</span>
                </div>
                {b.description && (
                  <p className="text-text-muted text-xs leading-snug border-t border-border-subtle pt-1.5">{b.description}</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Volatile Tab ─────────────────────────────────────────────────────────────
function VolatileTab() {
  const [timeframe, setTimeframe] = useState('24h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const activeTimeframeRef = useRef(timeframe)

  useEffect(() => {
    activeTimeframeRef.current = timeframe
    const fetch = () => {
      const tf = activeTimeframeRef.current
      getVolatile(tf)
        .then((res) => { if (activeTimeframeRef.current === tf) { setData(res); setLoading(false); setError(null) } })
        .catch(() => { if (activeTimeframeRef.current === tf) { setError('Failed to load volatility data.'); setLoading(false) } })
    }
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [timeframe])

  const items = Array.isArray(data) ? data : data?.pairs || []
  const maxVol = items.length ? Math.max(...items.map((p) => p.volatility_pct || p.volatility || 0)) : 1

  return (
    <div className="space-y-3">
      {/* Timeframe selector + legend */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">
          {['1h', '4h', '24h'].map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${timeframe === tf ? 'bg-accent-blue text-bg-primary' : 'bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50'}`}
            >
              {tf}
            </button>
          ))}
        </div>
        <span className="text-text-muted text-xs">Volatility % over <span className="text-accent-yellow font-medium">{timeframe}</span></span>
      </div>

      {/* Column headers */}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-[1.5rem_1fr_4rem] sm:grid-cols-[2rem_1fr_5rem] gap-1 sm:gap-2 px-2 sm:px-3 pb-1 border-b border-border-default">
          <span className="text-text-muted text-xs">#</span>
          <span className="text-text-muted text-xs">Pair</span>
          <span className="text-text-muted text-xs text-right">Volatility</span>
        </div>
      )}

      {loading ? <LoadingSpinner text="Ranking volatile pairs…" /> : error && !data ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No data" desc="Volatility data not available." />
      ) : (
        <div className="space-y-2">
          {items.slice(0, 20).map((p, i) => {
            const volVal = typeof (p.volatility_pct ?? p.volatility) === 'number' ? (p.volatility_pct ?? p.volatility) : 0
            const barPct = maxVol > 0 ? (volVal / maxVol) * 100 : 0
            const volLabel = volVal > 0 ? volVal.toFixed(2) : (p.volatility_pct ?? p.volatility) || '—'
            const isHigh = barPct >= 75
            const barColor = isHigh ? 'bg-accent-red' : barPct >= 40 ? 'bg-accent-yellow' : 'bg-accent-green'
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, duration: 0.25 }}
                className="bg-bg-card border border-border-default rounded-lg p-3"
              >
                <div className="grid grid-cols-[1.5rem_1fr_4rem] sm:grid-cols-[2rem_1fr_5rem] gap-1 sm:gap-2 items-center mb-2">
                  <span className="text-text-muted text-xs font-medium">{i + 1}</span>
                  <div className="min-w-0">
                    <span className="text-text-primary font-semibold text-xs sm:text-sm truncate block">{p.pair || p.symbol || '—'}</span>
                    {p.atr != null && (
                      <span className="text-text-muted text-xs">ATR: {Number(p.atr).toFixed(5)}</span>
                    )}
                  </div>
                  <span className={`font-mono text-xs sm:text-sm font-bold text-right whitespace-nowrap ${isHigh ? 'text-accent-red' : 'text-accent-yellow'}`}>
                    {volLabel}%
                  </span>
                </div>
                <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full ${barColor} rounded-full`}
                    initial={{ width: 0 }}
                    animate={{ width: `${barPct}%` }}
                    transition={{ delay: i * 0.03 + 0.1, duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Reversal Tab ─────────────────────────────────────────────────────────────
function ReversalTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    getReversals()
      .then((res) => { setData(res); setLoading(false); setError(null) })
      .catch(() => { setError('Failed to load reversal data.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  const items = Array.isArray(data) ? data : data?.pairs || data?.reversals || []

  return (
    <div className="space-y-3">
      {/* Header */}
      {!loading && !error && items.length > 0 && (
        <div className="flex items-center justify-between px-1 pb-1 border-b border-border-default">
          <span className="text-text-muted text-xs uppercase tracking-wider">Reversal Signals Detected</span>
          <span className="text-accent-blue text-xs font-medium">{items.length} pair{items.length !== 1 ? 's' : ''}</span>
        </div>
      )}
      {loading ? <LoadingSpinner text="Detecting reversal patterns…" /> : error && !data ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No reversals" desc="No reversal signals detected." />
      ) : items.map((r, i) => {
        const strength = r.strength != null ? Number(r.strength) : null
        const tf = r.timeframe || r.tf || null
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.25 }}
            className="bg-bg-card border border-border-default rounded-xl p-3"
          >
            <div className="flex items-start justify-between gap-2 sm:gap-3 mb-2">
              {/* Left: pair + type */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-text-primary font-semibold text-xs sm:text-sm">{r.pair || r.symbol || '—'}</p>
                  {tf && (
                    <span className="px-1.5 py-0.5 rounded bg-bg-secondary border border-border-default text-text-muted text-xs">{tf}</span>
                  )}
                </div>
                <p className="text-text-muted text-xs mt-0.5 truncate">{r.reversal_type || r.pattern || r.type || 'Reversal'}</p>
              </div>
              {/* Right: direction badge */}
              <div className={`flex items-center gap-1 sm:gap-1.5 px-1.5 sm:px-2.5 py-0.5 sm:py-1 rounded-lg border font-semibold text-xs sm:text-sm flex-shrink-0 ${dirBg(r.direction)} ${dirColor(r.direction)}`}>
                <DirIcon dir={r.direction} size={12} />
                <span>{r.direction || '—'}</span>
              </div>
            </div>
            {/* Strength bar */}
            {strength != null && (
              <div className="mt-1">
                <div className="flex justify-between text-xs text-text-muted mb-1">
                  <span>Signal Strength</span>
                  <span className="font-mono font-semibold text-text-secondary">{strength}%</span>
                </div>
                <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${strength >= 70 ? 'bg-accent-green' : strength >= 40 ? 'bg-accent-yellow' : 'bg-accent-red'}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${strength}%` }}
                    transition={{ delay: i * 0.04 + 0.15, duration: 0.5, ease: 'easeOut' }}
                  />
                </div>
              </div>
            )}
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Success Tab ──────────────────────────────────────────────────────────────
function SuccessTab({ allPairs, loadAll }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  const pairsToFetch = loadAll ? allPairs : allPairs.slice(0, 10)

  useEffect(() => {
    if (!pairsToFetch.length) return
    setLoading(true)
    const fetchSuccess = () => {
      Promise.allSettled(pairsToFetch.map((p) => getSignals(p).then((d) => ({ pair: p, acc: d.accuracy_30d ?? d.accuracy ?? null }))))
        .then((settled) => {
          const list = settled
            .filter((s) => s.status === 'fulfilled' && s.value.acc != null)
            .map((s) => s.value)
          list.sort((a, b) => b.acc - a.acc)
          setResults(list)
        })
        .finally(() => setLoading(false))
    }
    fetchSuccess()
    const id = setInterval(fetchSuccess, 120_000)
    return () => clearInterval(id)
  }, [allPairs, loadAll])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-3">
      {loading ? <LoadingSpinner text="Calculating success rates…" /> : results.length === 0 ? (
        <EmptyState title="No data" desc="Accuracy data unavailable." />
      ) : results.map((r, i) => (
        <div key={r.pair} className="bg-bg-card border border-border-default rounded-xl p-3 flex items-center gap-3">
          <span className="text-text-muted font-bold w-6 text-center">{i + 1}</span>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-text-primary font-medium">{r.pair}</span>
              <span className="text-accent-green font-semibold">{typeof r.acc === 'number' ? r.acc.toFixed(1) : r.acc}%</span>
            </div>
            <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-accent-green rounded-full" style={{ width: `${Math.min(r.acc ?? 0, 100)}%` }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Scanner Tab ──────────────────────────────────────────────────────────────
const SCANNER_TIMEFRAMES = [
  { id: '30m', label: '30m', desc: '30 Minutes' },
  { id: '1h',  label: '1H',  desc: '1 Hour'    },
  { id: '4h',  label: '4H',  desc: '4 Hours'   },
  { id: '1day', label: '1D', desc: '1 Day'     },
]

function ScannerTab() {
  const [timeframe, setTimeframe] = useState('1h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const activeTimeframeRef = useRef(timeframe)

  useEffect(() => {
    activeTimeframeRef.current = timeframe
    const fetch = () => {
      const tf = activeTimeframeRef.current
      setLoading(true)
      setError(null)
      getPatternScanner(tf)
        .then((res) => {
          if (activeTimeframeRef.current === tf) {
            setData(res)
            setLoading(false)
            setError(null)
          }
        })
        .catch(() => {
          if (activeTimeframeRef.current === tf) {
            setError('Failed to load pattern scanner data.')
            setLoading(false)
          }
        })
    }
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [timeframe])

  const items = Array.isArray(data) ? data : data?.patterns || []

  const buyItems  = items.filter(p => (p.direction || '').toUpperCase() === 'BUY'  || p.type?.toLowerCase().includes('bull'))
  const sellItems = items.filter(p => (p.direction || '').toUpperCase() === 'SELL' || p.type?.toLowerCase().includes('bear'))
  const holdItems = items.filter(p => !buyItems.includes(p) && !sellItems.includes(p))

  return (
    <div className="space-y-3">
      {/* Timeframe tabs */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {SCANNER_TIMEFRAMES.map((tf) => (
          <button
            key={tf.id}
            onClick={() => setTimeframe(tf.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${timeframe === tf.id ? 'bg-accent-blue text-bg-primary shadow-sm' : 'bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'}`}
          >
            {tf.label}
            <span className={`ml-1 text-xs ${timeframe === tf.id ? 'opacity-80' : 'text-text-muted'}`}>({tf.desc})</span>
          </button>
        ))}
        {data?.generated_at && (
          <span className="ml-auto text-text-muted text-xs self-center hidden sm:inline">
            🕐 {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>

      {loading ? <LoadingSpinner text="Scanning patterns…" /> : error && !data ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No patterns" desc={`No market structure patterns detected on the ${timeframe} timeframe.`} />
      ) : (
        <div className="space-y-3">
          {/* Summary row */}
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            {[['BUY/Bullish', buyItems.length, 'text-accent-green bg-accent-green/10 border-accent-green/25'],
              ['SELL/Bearish', sellItems.length, 'text-accent-red bg-accent-red/10 border-accent-red/25'],
              ['Neutral/Hold', holdItems.length, 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/25'],
            ].map(([lbl, cnt, cls]) => (
              <div key={lbl} className={`rounded-lg border p-2 ${cls}`}>
                <p className="font-bold text-base">{cnt}</p>
                <p className="opacity-80">{lbl}</p>
              </div>
            ))}
          </div>

          {/* Pattern cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((p, i) => {
              const isBull = p.type?.toLowerCase().includes('bull') || (p.direction || '').toUpperCase() === 'BUY'
              const isBear = p.type?.toLowerCase().includes('bear') || (p.direction || '').toUpperCase() === 'SELL'
              const dirCls = isBull ? 'text-accent-green' : isBear ? 'text-accent-red' : 'text-accent-yellow'
              const borderCls = isBull ? 'border-accent-green/25' : isBear ? 'border-accent-red/25' : 'border-accent-yellow/25'
              return (
                <div key={i} className={`bg-bg-card border ${borderCls} rounded-xl p-3`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <p className="text-text-primary text-sm font-semibold">{p.pair || '—'}</p>
                      <p className={`text-xs font-bold mt-0.5 ${dirCls}`}>
                        {p.label || p.pattern || p.type || 'Pattern'}
                      </p>
                      {p.description && (
                        <p className="text-text-muted text-xs mt-1 leading-snug">{p.description}</p>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0 space-y-1">
                      {p.direction && (
                        <span className={`text-xs font-bold block px-1.5 py-0.5 rounded ${dirColor(p.direction)} bg-bg-secondary`}>
                          {p.direction}
                        </span>
                      )}
                      {p.confidence != null && (
                        <span className="text-text-muted text-xs block">
                          {p.confidence}% conf
                        </span>
                      )}
                      {p.impact && (
                        <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded block ${p.impact === 'high' ? 'bg-accent-red/10 text-accent-red' : p.impact === 'medium' ? 'bg-accent-yellow/10 text-accent-yellow' : 'bg-accent-blue/10 text-accent-blue'}`}>
                          {p.impact}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Confidence bar if available */}
                  {p.confidence != null && (
                    <div className="mt-2">
                      <div className="h-1 bg-bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${isBull ? 'bg-accent-green' : isBear ? 'bg-accent-red' : 'bg-accent-yellow'}`}
                          style={{ width: `${Math.min(p.confidence, 100)}%` }}
                        />
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2 mt-2 text-xs text-text-muted flex-wrap">
                    {(p.timeframe || p.tf) && <span>TF: {p.timeframe || p.tf}</span>}
                    {p.entry_price != null && <span>Entry: <span className="font-mono text-text-secondary">{p.entry_price}</span></span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Gamebar ──────────────────────────────────────────────────────────────────
function Gamebar() {
  const [game, setGame] = useState(loadGame)
  const xpInLevel = game.xp % 100
  const xpToNext = 100

  useEffect(() => {
    const updated = addXP(loadGame(), 5)
    saveGame(updated)
    setGame(updated)
  }, [])

  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-2 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white font-bold text-xs">
          {game.level}
        </div>
        <div>
          <p className="text-text-primary text-xs font-semibold">Lv.{game.level} Trader</p>
          <p className="text-text-muted text-xs">{game.xp} XP</p>
        </div>
      </div>
      <div className="flex-1 min-w-[80px]">
        <div className="flex justify-between text-xs text-text-muted mb-0.5">
          <span>XP</span>
          <span>{xpInLevel}/{xpToNext}</span>
        </div>
        <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
          <motion.div
            animate={{ width: `${(xpInLevel / xpToNext) * 100}%` }}
            className="h-full bg-gradient-to-r from-accent-blue to-accent-purple rounded-full"
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Flame size={12} className="text-accent-yellow" />
        <span className="text-text-secondary text-xs">{game.streak} streak</span>
      </div>
      {game.badges.length > 0 && (
        <div className="flex gap-1">
          {game.badges.map((b) => (
            <span key={b} className="flex items-center gap-1 px-1.5 py-0.5 bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs rounded-full">
              <Award size={8} />
              {b}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── News Tab ─────────────────────────────────────────────────────────────────
function NewsTab() {
  const [articles, setArticles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = () => {
      getNews()
        .then((res) => {
          setArticles(res.news || [])
          setLoading(false)
          setError(null)
        })
        .catch(() => {
          setError('Unable to load news. Please try again later.')
          setLoading(false)
        })
    }
    fetch()
    const id = setInterval(fetch, 300_000) // refresh every 5 min
    return () => clearInterval(id)
  }, [])

  if (loading) return <LoadingSpinner text="Loading market news…" />
  if (error && articles.length === 0) return <ErrorBox msg={error} />
  if (articles.length === 0) return <EmptyState title="No news available" desc="Market news will appear here when available." />

  return (
    <div className="space-y-2">
      <p className="text-text-muted text-xs mb-3">
        Live headlines from ForexLive, FXStreet, DailyFX, Reuters &amp; more — updated every 5 minutes.
      </p>
      {articles.map((article, i) => (
        <a
          key={i}
          href={article.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block bg-bg-card border border-border-default rounded-lg p-3 hover:border-accent-blue/50 transition-all group"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <h4 className="text-text-primary text-sm font-medium leading-snug group-hover:text-accent-blue transition-colors line-clamp-2">
                {article.title}
              </h4>
              {article.summary && (
                <p className="text-text-muted text-xs mt-1 leading-relaxed line-clamp-2">{article.summary}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                {article.source && (
                  <span className="text-accent-blue text-xs font-medium">{article.source}</span>
                )}
                {article.published_at && (
                  <span className="text-text-muted text-xs">{article.published_at}</span>
                )}
              </div>
            </div>
            <ExternalLink size={14} className="text-text-muted flex-shrink-0 mt-0.5 group-hover:text-accent-blue transition-colors" />
          </div>
        </a>
      ))}
    </div>
  )
}

// ─── Pair Selector ────────────────────────────────────────────────────────────
function PairSelector({ selectedPair, onSelect, majorList, minorList, exoticList }) {
  const [search, setSearch] = useState('')
  const [showAll, setShowAll] = useState(false)

  const allPairs = [...majorList, ...minorList, ...exoticList]
  const filteredPairs = search.trim().length > 0
    ? allPairs.filter((p) => p.toLowerCase().replace('/', '').includes(search.toLowerCase().replace('/', '')))
    : []

  const handleSelect = (pair) => {
    onSelect(pair)
    setSearch('')
    setShowAll(false)
  }

  return (
    <div className="space-y-2">
      {/* Major pairs quick-access row */}
      <div className="flex flex-wrap gap-1.5">
        {majorList.map((pair) => (
          <button
            key={pair}
            onClick={() => handleSelect(pair)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all btn-interactive ${
              selectedPair === pair
                ? 'bg-accent-blue text-bg-primary border-accent-blue shadow-sm shadow-accent-blue/30'
                : 'bg-bg-secondary border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'
            }`}
          >
            {pair}
          </button>
        ))}
        {(minorList.length > 0 || exoticList.length > 0) && (
          <button
            onClick={() => { setShowAll((v) => !v); setSearch('') }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all btn-interactive ${
              showAll
                ? 'bg-accent-purple/20 border-accent-purple/50 text-accent-purple'
                : 'bg-bg-secondary border-border-default text-text-muted hover:border-accent-purple/40 hover:text-text-primary'
            }`}
          >
            {showAll ? '▲ Less' : '▼ More'}
          </button>
        )}
      </div>

      {/* Search input */}
      <div className="relative">
        <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowAll(false) }}
          placeholder="Search pair (e.g. GBP/JPY, EURCAD…)"
          className="w-full pl-7 pr-3 py-1.5 bg-bg-secondary border border-border-default rounded-lg text-sm text-text-primary placeholder-text-muted input-animated focus:border-accent-blue/50 outline-none"
        />
      </div>

      {/* Search results */}
      {search.trim().length > 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-2 max-h-40 overflow-y-auto">
          {filteredPairs.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {filteredPairs.map((p) => (
                <button
                  key={p}
                  onClick={() => handleSelect(p)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all btn-interactive ${
                    selectedPair === p
                      ? 'bg-accent-blue text-bg-primary border-accent-blue'
                      : 'bg-bg-secondary border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-text-muted text-xs px-1">No pairs found for &ldquo;{search}&rdquo;</p>
          )}
        </div>
      )}

      {/* Expanded minor / exotic list */}
      {showAll && search.trim().length === 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-3 space-y-3">
          {minorList.length > 0 && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5">Minor Pairs</p>
              <div className="flex flex-wrap gap-1.5">
                {minorList.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSelect(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all btn-interactive ${
                      selectedPair === p
                        ? 'bg-accent-blue text-bg-primary border-accent-blue'
                        : 'bg-bg-secondary border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {exoticList.length > 0 && (
            <div>
              <p className="text-text-muted text-xs uppercase tracking-wider font-semibold mb-1.5">Exotic Pairs</p>
              <div className="flex flex-wrap gap-1.5">
                {exoticList.map((p) => (
                  <button
                    key={p}
                    onClick={() => handleSelect(p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all btn-interactive ${
                      selectedPair === p
                        ? 'bg-accent-blue text-bg-primary border-accent-blue'
                        : 'bg-bg-secondary border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ForexDashboard() {
  const [allPairsData, setAllPairsData] = useState(null)
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [activeTab, setActiveTab] = useState('signal')
  const [signal, setSignal] = useState(null)
  const [signalLoading, setSignalLoading] = useState(true)
  const [signalError, setSignalError] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [successTabClicks, setSuccessTabClicks] = useState(0)
  const prevDirRef = useRef(null)
  const tabsRef = useRef(null)
  const contentRef = useRef(null)

  // Load all pairs — API returns {major, minor, exotic, all, ecb_live}
  useEffect(() => {
    getPairs()
      .then((data) => setAllPairsData(data))
      .catch(() => setAllPairsData(null))
  }, [])

  // Update page title dynamically for SEO
  useEffect(() => {
    const dir = signal?.signal || signal?.direction
    const titleDir = dir ? ` – ${dir.toUpperCase()}` : ''
    document.title = `${selectedPair}${titleDir} AI Forex Signal | PiiTrade`
  }, [selectedPair, signal])

  // Fetch signal when pair changes
  const fetchSignal = useCallback(async () => {
    if (!selectedPair) return
    setSignalLoading(true)
    setSignalError(null)
    try {
      const data = await getSignals(selectedPair)
      setSignal(data)
      const dir = data.signal || data.direction
      if (dir && dir !== prevDirRef.current && soundEnabled) {
        playSignalSound(dir)
        prevDirRef.current = dir
      }
    } catch (err) {
      setSignalError(err?.response?.data?.detail || 'Failed to fetch signal. Please try again.')
    } finally {
      setSignalLoading(false)
    }
  }, [selectedPair, soundEnabled])

  useEffect(() => {
    fetchSignal()
    const interval = setInterval(fetchSignal, 30000)
    return () => clearInterval(interval)
  }, [fetchSignal])

  // Build flat pair list — filtered to strings only
  const forexPairs = ((allPairsData?.all && allPairsData.all.length > 0)
    ? allPairsData.all
    : FALLBACK_PAIRS
  ).filter((p) => typeof p === 'string' && p.length > 0)

  const scrollTabs = (dir) => {
    if (tabsRef.current) tabsRef.current.scrollBy({ left: dir * 120, behavior: 'smooth' })
  }

  // On mobile, scroll the tab content area into view when a tab is selected
  const handleTabChange = (tabId) => {
    setActiveTab(tabId)
    if (tabId === 'success') setSuccessTabClicks((c) => c + 1)
    if (window.innerWidth < 768 && contentRef.current) {
      // Delay slightly so React has re-rendered the new tab before scrolling
      setTimeout(() => {
        contentRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 60)
    }
  }

  // Auto-scroll active tab into view when changed
  useEffect(() => {
    if (!tabsRef.current) return
    const activeEl = tabsRef.current.querySelector('[data-active="true"]')
    if (activeEl) activeEl.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [activeTab])

  // Build select optgroups
  const majorList = allPairsData?.major
    ? allPairsData.major.filter((p) => typeof p === 'string' && p.length > 0)
    : forexPairs.filter((p) => MAJOR_PAIRS.has(p))
  const minorList = allPairsData?.minor
    ? allPairsData.minor.filter((p) => typeof p === 'string' && p.length > 0)
    : forexPairs.filter((p) => MINOR_PAIRS.has(p))
  const exoticList = allPairsData?.exotic
    ? allPairsData.exotic.filter((p) => typeof p === 'string' && p.length > 0)
    : forexPairs.filter((p) => !MAJOR_PAIRS.has(p) && !MINOR_PAIRS.has(p))

  return (
    <div className="min-h-screen bg-bg-primary py-3" style={{ paddingLeft: 'var(--page-margin-x)', paddingRight: 'var(--page-margin-x)' }}>
      <div className="max-w-5xl mx-auto space-y-3">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="flex items-center justify-between"
        >
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">📊 PiiTrade</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="btn-interactive p-1.5 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-text-primary"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button
              onClick={fetchSignal}
              disabled={signalLoading}
              className="btn-interactive p-1.5 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-accent-blue"
              title="Refresh signal"
            >
              <RefreshCw size={13} className={signalLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </motion.div>

        {/* Advance feature promo */}
        <AdvancePromo />

        {/* Pair selector row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-bg-card border border-border-default rounded-xl p-3 card-hover"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-text-secondary text-sm font-medium">Trading Pair:</span>
              <span className="text-text-primary font-bold text-sm">{selectedPair}</span>
              {signal && (
                <span className={`text-xs font-bold px-2 py-0.5 rounded border ${dirBg(signal.signal || signal.direction)}`}>
                  <span className={dirColor(signal.signal || signal.direction)}>
                    {(signal.signal || signal.direction || '—').toUpperCase()}
                  </span>
                </span>
              )}
            </div>
          </div>
          <PairSelector
            selectedPair={selectedPair}
            onSelect={setSelectedPair}
            majorList={majorList}
            minorList={minorList}
            exoticList={exoticList}
          />
        </motion.div>

        {/* Gamebar */}
        <Gamebar />

        {/* Tab navigation */}
        <div className="relative flex items-center gap-1">
          <button onClick={() => scrollTabs(-1)} className="flex-shrink-0 p-1 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-text-primary flex">
            <ChevronLeft size={13} />
          </button>
          <div ref={tabsRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 pb-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                data-active={activeTab === tab.id ? 'true' : undefined}
                onClick={() => handleTabChange(tab.id)}
                className={`btn-interactive px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'bg-accent-blue text-bg-primary shadow-sm shadow-accent-blue/30' : 'bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => scrollTabs(1)} className="flex-shrink-0 p-1 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-text-primary flex">
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            ref={contentRef}
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="bg-bg-secondary border border-border-default rounded-xl p-3 min-h-64"
          >
            {activeTab === 'signal' && <SignalTab pair={selectedPair} signal={signal} loading={signalLoading} error={signalError} />}
            {activeTab === 'risk' && <RiskCalcTab pair={selectedPair} />}
            {activeTab === 'technical' && <TechnicalTab key={selectedPair} pair={selectedPair} />}
            {activeTab === 'fvg' && <FVGTab />}
            {activeTab === 'sr' && <SRTab />}
            {activeTab === 'volatile' && <VolatileTab />}
            {activeTab === 'reversal' && <ReversalTab />}
            {activeTab === 'success' && <SuccessTab allPairs={forexPairs} loadAll={successTabClicks > 1} />}
            {activeTab === 'scanner' && <ScannerTab />}
            {activeTab === 'news' && <NewsTab />}
          </motion.div>
        </AnimatePresence>

        {/* Partner cards */}
        <div className="pt-4 border-t border-border-default">
          <p className="text-text-muted text-xs uppercase tracking-widest font-semibold mb-3 text-center">Our Partners</p>
          <PartnerCards />
        </div>
      </div>
    </div>
  )
}
