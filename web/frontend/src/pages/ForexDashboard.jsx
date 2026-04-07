import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Search, RefreshCw, Volume2, VolumeX,
  BarChart2, AlertTriangle, Newspaper, Bell, Target, Layers, Zap,
  Star, Award, Flame, ChevronRight, ChevronLeft,
} from 'lucide-react'
import {
  getPairs, getSignals, getTechnical, getVolatile, getReversals,
  getFvgScanner, getSrBreakouts, getPatternScanner, getNews, subscribe, getLivePrices,
  getEconomicCalendar,
} from '../utils/api'
import PriceTicker from '../components/PriceTicker'
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
  { id: 'alerts', label: '🔔 Alerts', icon: Bell },
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
  const [livePrice, setLivePrice] = useState(null)

  // Detect pip size based on pair (JPY pairs use 0.01, others 0.0001)
  const isJpy = pair?.includes('JPY')
  const pipMultiplier = isJpy ? 100 : 10000

  // Fetch live price for the selected pair
  useEffect(() => {
    const fetchPrice = () => {
      getLivePrices()
        .then((res) => {
          if (!Array.isArray(res?.prices)) return
          const match = res.prices.find((p) => p.pair === pair)
          if (match && match.price && match.price !== '—') {
            setLivePrice(match.price)
          }
        })
        .catch(() => {})
    }
    fetchPrice()
    const id = setInterval(fetchPrice, 30_000)
    return () => clearInterval(id)
  }, [pair])

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

  const positionSize = slPips > 0 ? (riskAmount / (slPips * pipValue)).toFixed(2) : '—'
  const margin = positionSize !== '—' ? (parseFloat(positionSize) * 1000 * 0.02).toFixed(2) : '—'

  // Potential profit if TP is hit
  const potentialProfit = positionSize !== '—' && tpPips > 0
    ? (parseFloat(positionSize) * tpPips * pipValue).toFixed(2)
    : '—'

  return (
    <div className="space-y-3 max-w-md">
      {livePrice && (
        <div className="flex items-center gap-2 px-3 py-2 bg-accent-blue/10 border border-accent-blue/30 rounded-lg">
          <span className="text-text-muted text-xs">Live price</span>
          <span className="font-mono text-accent-blue text-sm font-semibold">{pair}: {livePrice}</span>
        </div>
      )}

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
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Pip Value ($)</label>
          <input
            type="number" value={pipValue}
            onChange={(e) => setPipValue(parseFloat(e.target.value) || 10)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated"
          />
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
          { label: 'Margin Needed', value: margin !== '—' ? `$${margin}` : '—', color: 'text-accent-blue' },
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

// ─── Technical Tab ────────────────────────────────────────────────────────────
function TechnicalTab({ pair }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    if (!pair) return
    getTechnical(pair)
      .then((res) => { setData(res); setLoading(false); setError(null) })
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

  const supportLevels = Array.isArray(sr.support) ? sr.support : (sr.support != null ? [sr.support] : [])
  const resistanceLevels = Array.isArray(sr.resistance) ? sr.resistance : (sr.resistance != null ? [sr.resistance] : [])

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* S/R */}
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-3">Support & Resistance</h3>
          <div className="space-y-2">
            {resistanceLevels.map((lvl, i) => (
              <div key={`res-${i}`} className="flex justify-between items-center py-2 px-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
                <span className="text-accent-red text-sm">Resistance {i + 1}</span>
                <span className="font-mono text-sm text-text-primary">{typeof lvl === 'number' ? lvl.toFixed(5) : lvl}</span>
              </div>
            ))}
            {supportLevels.map((lvl, i) => (
              <div key={`sup-${i}`} className="flex justify-between items-center py-2 px-3 bg-accent-green/10 border border-accent-green/20 rounded-lg">
                <span className="text-accent-green text-sm">Support {i + 1}</span>
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
              <div key={i} className="flex justify-between items-center py-1.5 border-b border-border-subtle last:border-0">
                <div>
                  <span className={`text-xs font-semibold uppercase mr-1 ${item.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'}`}>{item.label}</span>
                  <span className="text-text-secondary text-xs">{item.type}</span>
                </div>
                <span className="font-mono text-sm text-text-primary">{typeof item.level === 'number' ? item.level.toFixed(5) : item.level}</span>
              </div>
            ))}
            {!bos.length && !choch.length && <p className="text-text-muted text-sm">No market structure data</p>}
          </div>
        </div>
      </div>

      {/* FVG Zones */}
      {fvg.length > 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-2">FVG Zones</h3>
          <div className="space-y-2">
            {fvg.slice(0, 5).map((zone, i) => (
              <div key={i} className="flex justify-between items-center py-2 px-3 bg-bg-secondary rounded-lg">
                <span className={`text-sm font-medium ${zone.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'}`}>
                  {zone.type?.toUpperCase() || 'FVG'}{zone.filled ? ' (Filled)' : ''}
                </span>
                <span className="font-mono text-xs text-text-secondary">
                  {zone.bottom ?? zone.low} – {zone.top ?? zone.high}
                </span>
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

  const fetchData = useCallback(() => {
    getFvgScanner()
      .then((res) => { setData(res); setLoading(false); setError(null) })
      .catch(() => { setError('Failed to load FVG data.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  if (loading) return <LoadingSpinner text="Scanning FVG zones…" />
  if (error && !data) return <ErrorBox msg={error} />

  const grouped = data?.grouped || {}
  const allItems = Array.isArray(data)
    ? data
    : Object.entries(grouped).flatMap(([status, list]) =>
        (list || []).map(item => ({ ...item, status }))
      )

  const filtered = statusFilter === 'all' ? allItems : allItems.filter(z => (z.status || 'active') === statusFilter)

  return (
    <div className="space-y-3">
      {/* Status filter */}
      <div className="flex flex-wrap gap-1.5">
        {['approaching', 'active', 'reached', 'rejected', 'all'].map((s) => {
          const colors = { approaching: 'text-accent-yellow border-accent-yellow/40 bg-accent-yellow/10', active: 'text-accent-blue border-accent-blue/40 bg-accent-blue/10', reached: 'text-accent-green border-accent-green/40 bg-accent-green/10', rejected: 'text-accent-red border-accent-red/40 bg-accent-red/10', all: 'text-text-secondary border-border-default bg-bg-card' }
          const activeColors = { approaching: 'bg-accent-yellow text-bg-primary border-accent-yellow', active: 'bg-accent-blue text-bg-primary border-accent-blue', reached: 'bg-accent-green text-bg-primary border-accent-green', rejected: 'bg-accent-red text-bg-primary border-accent-red', all: 'bg-text-secondary text-bg-primary border-text-secondary' }
          const count = s === 'all' ? allItems.length : allItems.filter(z => (z.status || 'active') === s).length
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border uppercase transition-all ${statusFilter === s ? activeColors[s] : colors[s]}`}
            >
              {s} {count > 0 && <span className="opacity-70">({count})</span>}
            </button>
          )
        })}
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={`No ${statusFilter === 'all' ? '' : statusFilter + ' '}FVG zones`} desc={statusFilter === 'all' ? 'No fair value gaps detected.' : `No zones with status "${statusFilter}" found.`} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {filtered.map((zone, i) => {
            const status = zone.status || 'active'
            const statusColor = status === 'approaching' ? 'text-accent-yellow' : status === 'reached' ? 'text-accent-green' : status === 'rejected' ? 'text-accent-red' : 'text-accent-blue'
            const borderColor = status === 'approaching' ? 'border-accent-yellow/30' : status === 'reached' ? 'border-accent-green/30' : status === 'rejected' ? 'border-accent-red/30' : 'border-accent-blue/30'
            return (
              <div key={i} className={`bg-bg-card border ${borderColor} rounded-xl p-3`}>
                <div className="flex justify-between items-start mb-3">
                  <span className="text-text-primary font-medium">{zone.pair || `Zone ${i + 1}`}</span>
                  <span className={`text-xs font-semibold uppercase ${statusColor}`}>{status}</span>
                </div>
                <div className="space-y-1 text-sm">
                  {(zone.top != null) && <div className="flex justify-between"><span className="text-text-muted">High</span><span className="font-mono text-text-primary">{zone.top}</span></div>}
                  {(zone.bottom != null) && <div className="flex justify-between"><span className="text-text-muted">Low</span><span className="font-mono text-text-primary">{zone.bottom}</span></div>}
                  {(zone.fvg_type || zone.type) ? <div className="flex justify-between"><span className="text-text-muted">Type</span><span className={(zone.fvg_type || zone.type) === 'bullish' ? 'text-accent-green' : 'text-accent-red'}>{zone.fvg_type || zone.type}</span></div> : null}
                  {zone.direction && <div className="flex justify-between"><span className="text-text-muted">Signal</span><span className={dirColor(zone.direction)}>{zone.direction}</span></div>}
                </div>
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
      {loading ? <LoadingSpinner text="Ranking volatile pairs…" /> : error && !data ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No data" desc="Volatility data not available." />
      ) : (
        <div className="space-y-2">
          {items.slice(0, 20).map((p, i) => (
            <div key={i} className="bg-bg-card border border-border-default rounded-lg p-3">
              <div className="flex justify-between items-center mb-2">
                <div className="flex items-center gap-3">
                  <span className="text-text-muted text-xs font-medium w-5">{i + 1}</span>
                  <span className="text-text-primary font-medium">{p.pair || p.symbol || '—'}</span>
                </div>
                <span className="text-accent-yellow font-mono text-sm">{typeof (p.volatility_pct ?? p.volatility) === 'number' ? (p.volatility_pct ?? p.volatility).toFixed(2) : (p.volatility_pct ?? p.volatility) || '—'}%</span>
              </div>
              <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-yellow rounded-full transition-all"
                  style={{ width: `${maxVol > 0 ? (((p.volatility_pct ?? p.volatility) || 0) / maxVol) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
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
      {loading ? <LoadingSpinner text="Detecting reversal patterns…" /> : error && !data ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No reversals" desc="No reversal signals detected." />
      ) : items.map((r, i) => (
        <div key={i} className="bg-bg-card border border-border-default rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-text-primary font-medium">{r.pair || r.symbol || '—'}</p>
            <p className="text-text-muted text-xs">{r.reversal_type || r.pattern || r.type || 'Reversal'}{r.strength != null ? ` — strength: ${r.strength}%` : ''}</p>
          </div>
          <div className={`flex items-center gap-2 font-semibold ${dirColor(r.direction)}`}>
            <DirIcon dir={r.direction} size={16} />
            <span>{r.direction || '—'}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Success Tab ──────────────────────────────────────────────────────────────
function SuccessTab({ allPairs }) {
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!allPairs.length) return
    setLoading(true)
    const fetchSuccess = () => {
      const top10 = allPairs.slice(0, 10)
      Promise.allSettled(top10.map((p) => getSignals(p).then((d) => ({ pair: p, acc: d.accuracy_30d ?? d.accuracy ?? null }))))
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
    const id = setInterval(fetchSuccess, 120_000) // 2-min interval (10 parallel requests)
    return () => clearInterval(id)
  }, [allPairs])

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
function ScannerTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchData = useCallback(() => {
    getPatternScanner()
      .then((res) => { setData(res); setLoading(false); setError(null) })
      .catch(() => { setError('Failed to load pattern scanner data.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchData()
    const id = setInterval(fetchData, 30_000)
    return () => clearInterval(id)
  }, [fetchData])

  const items = Array.isArray(data) ? data : data?.patterns || []

  return (
    <div className="space-y-3">
      {loading ? <LoadingSpinner text="Scanning patterns…" /> : error && !data ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No patterns" desc="No patterns detected in the scanner." />
      ) : items.map((p, i) => (
        <div key={i} className="bg-bg-card border border-border-default rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary text-sm font-medium">{p.pair || '—'}</p>
              <p className="text-text-muted text-xs mt-0.5">{p.description || p.timeframe || p.tf || ''}</p>
            </div>
            <div className="text-right space-y-1">
              <span className={`text-sm font-semibold block ${p.type?.toLowerCase().includes('bull') || p.direction === 'BUY' ? 'text-accent-green' : p.type?.toLowerCase().includes('bear') || p.direction === 'SELL' ? 'text-accent-red' : 'text-accent-yellow'}`}>
                {p.label || p.pattern || p.type || 'Pattern'}
              </span>
              {p.impact && (
                <span className={`text-xs font-semibold uppercase px-1.5 py-0.5 rounded ${p.impact === 'high' ? 'bg-accent-red/10 text-accent-red' : p.impact === 'medium' ? 'bg-accent-yellow/10 text-accent-yellow' : 'bg-accent-blue/10 text-accent-blue'}`}>
                  {p.impact}
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── News Tab ─────────────────────────────────────────────────────────────────
const NEWS_REFRESH_MS = 2.5 * 60 * 1000 // 2.5 minutes for fresher feeds

const SOURCE_COLORS = {
  ForexLive: 'bg-accent-blue/10 text-accent-blue',
  FXStreet: 'bg-accent-green/10 text-accent-green',
  'Investing.com': 'bg-accent-yellow/10 text-accent-yellow',
  DailyFX: 'bg-accent-purple/10 text-accent-purple',
  Reuters: 'bg-accent-red/10 text-accent-red',
}

function NewsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const fetchNews = useCallback(() => {
    getNews()
      .then((res) => {
        setData(res)
        setLastUpdated(new Date())
        setLoading(false)
        setError(null)
      })
      .catch(() => { setError('Failed to load market news.'); setLoading(false) })
  }, [])

  useEffect(() => {
    fetchNews()
    const id = setInterval(fetchNews, NEWS_REFRESH_MS)
    return () => clearInterval(id)
  }, [fetchNews])

  const items = Array.isArray(data) ? data : data?.news || data?.articles || []
  const sources = [...new Set(items.map((n) => n.source).filter(Boolean))]

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-text-primary text-sm font-semibold">Market News</h3>
          {items.length > 0 && (
            <span className="text-text-muted text-xs">({items.length} articles)</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-text-muted text-xs hidden sm:inline">
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={fetchNews}
            disabled={loading}
            className="p-1 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-accent-blue transition-colors"
            title="Refresh news"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>
      {/* Source badges */}
      {sources.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sources.map((src) => (
            <span key={src} className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOURCE_COLORS[src] || 'bg-bg-card text-text-muted'}`}>
              {src}
            </span>
          ))}
        </div>
      )}
      {loading && items.length === 0 ? <LoadingSpinner text="Fetching market news…" /> : error && items.length === 0 ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-bg-secondary flex items-center justify-center mb-4">
            <Newspaper size={32} className="text-text-muted" />
          </div>
          <p className="text-text-secondary font-medium mb-2">No news available</p>
          <p className="text-text-muted text-sm">Market news feed is currently empty.</p>
        </div>
      ) : items.map((n, i) => (
        <div key={i} className="bg-bg-card border border-border-default rounded-xl p-3 hover:border-accent-blue/30 transition-all">
          <div className="flex gap-3">
            <div className="flex-1">
              <a href={n.url || '#'} target="_blank" rel="noopener noreferrer" className="text-text-primary font-medium hover:text-accent-blue transition-colors leading-snug">
                {n.title || n.headline || 'News Article'}
              </a>
              {n.summary && <p className="text-text-secondary text-xs mt-1 line-clamp-2">{n.summary}</p>}
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {n.source && (
                  <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${SOURCE_COLORS[n.source] || 'bg-bg-secondary text-text-muted'}`}>
                    {n.source}
                  </span>
                )}
                {(n.published_at || n.date) && (
                  <span className="text-text-muted text-xs">{n.published_at || n.date}</span>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
const PRICE_ALERTS_KEY = 'piitrade_price_alerts'

function loadPriceAlerts() {
  try { return JSON.parse(localStorage.getItem(PRICE_ALERTS_KEY)) || [] } catch { return [] }
}
function savePriceAlerts(alerts) {
  localStorage.setItem(PRICE_ALERTS_KEY, JSON.stringify(alerts))
}

const ALERT_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'AUD/USD', 'USD/CAD', 'USD/CHF', 'NZD/USD', 'EUR/GBP', 'GBP/JPY', 'EUR/JPY']

function AlertsTab() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [priceAlerts, setPriceAlerts] = useState(loadPriceAlerts)
  const [alertPair, setAlertPair] = useState('EUR/USD')
  const [alertTarget, setAlertTarget] = useState('')
  const [alertDir, setAlertDir] = useState('above')
  const [livePrices, setLivePrices] = useState({})
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)

  // Poll live prices for active alerts using the batch endpoint
  useEffect(() => {
    const fetchPrices = () => {
      getLivePrices()
        .then((res) => {
          if (!Array.isArray(res?.prices)) return
          const map = {}
          res.prices.forEach((p) => { if (p.price !== '—') map[p.pair] = parseFloat(p.price) })
          setLivePrices(map)
        })
        .catch(() => { /* silently keep stale data */ })
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 30_000)
    return () => clearInterval(id)
  }, [])

  // Fetch economic calendar from backend (ForexFactory)
  useEffect(() => {
    const fetchCalendar = () => {
      getEconomicCalendar()
        .then((res) => {
          const list = res?.events || []
          if (list.length > 0) setEvents(list)
          setEventsLoading(false)
        })
        .catch(() => { setEventsLoading(false) })
    }
    fetchCalendar()
    const id = setInterval(fetchCalendar, 3300_000) // refresh every 55 min (backend caches for 1 hour)
    return () => clearInterval(id)
  }, [])

  // Check triggered alerts whenever live prices update
  useEffect(() => {
    if (Object.keys(livePrices).length === 0) return
    setPriceAlerts((prev) => {
      const updated = prev.map((a) => {
        if (a.triggered) return a
        const current = livePrices[a.pair]
        if (current == null) return a
        const hit = a.dir === 'above' ? current >= a.target : current <= a.target
        return hit ? { ...a, triggered: true, triggeredAt: new Date().toISOString() } : a
      })
      savePriceAlerts(updated)
      return updated
    })
  }, [livePrices])

  const addAlert = (e) => {
    e.preventDefault()
    const target = parseFloat(alertTarget)
    if (isNaN(target) || target <= 0) return
    const id = typeof crypto?.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const newAlert = { id, pair: alertPair, target, dir: alertDir, triggered: false }
    const updated = [newAlert, ...priceAlerts].slice(0, 10)
    savePriceAlerts(updated)
    setPriceAlerts(updated)
    setAlertTarget('')
  }

  const removeAlert = (id) => {
    const updated = priceAlerts.filter((a) => a.id !== id)
    savePriceAlerts(updated)
    setPriceAlerts(updated)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await subscribe(email)
      setStatus('success')
      setEmail('')
    } catch {
      setStatus('error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Price Alerts */}
      <div>
        <h3 className="text-text-primary text-sm font-semibold mb-3">🔔 Price Alerts</h3>
        <form onSubmit={addAlert} className="flex flex-wrap gap-2 mb-3">
          <select
            value={alertPair}
            onChange={(e) => setAlertPair(e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-lg px-2 py-1.5 text-text-primary text-xs input-animated"
          >
            {ALERT_PAIRS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select
            value={alertDir}
            onChange={(e) => setAlertDir(e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-lg px-2 py-1.5 text-text-primary text-xs input-animated"
          >
            <option value="above">Above</option>
            <option value="below">Below</option>
          </select>
          <input
            type="number" step="any" value={alertTarget} onChange={(e) => setAlertTarget(e.target.value)}
            placeholder="Target price" required
            className="flex-1 min-w-[110px] bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary placeholder-text-muted text-xs input-animated"
          />
          <button type="submit" className="px-3 py-1.5 bg-accent-blue text-bg-primary font-semibold rounded-lg text-xs hover:bg-blue-400 transition-all">
            Set Alert
          </button>
        </form>
        {livePrices[alertPair] != null && (
          <p className="text-text-muted text-xs mb-3">
            Live {alertPair}: <span className="font-mono text-accent-blue font-semibold">{livePrices[alertPair]}</span>
            <span className="text-text-muted ml-1">(updates every 30s)</span>
          </p>
        )}
        {priceAlerts.length > 0 ? (
          <div className="space-y-2">
            {priceAlerts.map((a) => (
              <div key={a.id} className={`flex items-center justify-between p-2.5 rounded-lg border text-xs ${a.triggered ? 'bg-accent-green/10 border-accent-green/30' : 'bg-bg-card border-border-default'}`}>
                <div className="flex items-center gap-2">
                  <Bell size={12} className={a.triggered ? 'text-accent-green' : 'text-text-muted'} />
                  <span className="text-text-primary font-medium">{a.pair}</span>
                  <span className="text-text-muted">{a.dir === 'above' ? '≥' : '≤'}</span>
                  <span className="font-mono text-text-secondary">{a.target}</span>
                  {livePrices[a.pair] != null && !a.triggered && (
                    <span className="text-text-muted">now: <span className="font-mono text-accent-blue">{livePrices[a.pair]}</span></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {a.triggered && (
                    <span className="text-accent-green font-semibold">
                      ✓ {new Date(a.triggeredAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                  <button onClick={() => removeAlert(a.id)} className="text-text-muted hover:text-accent-red transition-colors">✕</button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-text-muted text-xs">No active price alerts. Add one above.</p>
        )}
      </div>

      {/* Economic calendar */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-text-primary text-sm font-semibold">📅 Economic Calendar</h3>
          {!eventsLoading && events.length > 0 && (
            <span className="text-text-muted text-xs">This week • {events.length} events</span>
          )}
        </div>
        {eventsLoading ? (
          <LoadingSpinner text="Fetching economic calendar…" />
        ) : events.length === 0 ? (
          <p className="text-text-muted text-xs">No upcoming economic events found.</p>
        ) : (
          <>
            {/* Responsive card grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {events.slice(0, 20).map((ev, i) => (
                <div key={i} className={`bg-bg-card border rounded-xl p-3 flex items-start justify-between gap-2 ${ev.impact === 'High' ? 'border-accent-red/30' : ev.impact === 'Medium' ? 'border-accent-yellow/30' : 'border-border-default'}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-text-primary text-xs font-medium truncate">{ev.event}</p>
                    <p className="text-text-muted text-xs mt-0.5 font-mono">{ev.time} • <span className="text-accent-blue">{ev.currency}</span></p>
                    {(ev.actual != null || ev.forecast != null) && (
                      <p className="text-text-muted text-xs mt-0.5">
                        {ev.actual != null && <span className="text-accent-green mr-2">A: {ev.actual}</span>}
                        {ev.forecast != null && <span className="text-text-secondary mr-2">F: {ev.forecast}</span>}
                        {ev.previous != null && <span className="text-text-muted">P: {ev.previous}</span>}
                      </p>
                    )}
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded flex-shrink-0 ${ev.impact === 'High' ? 'bg-accent-red/10 text-accent-red' : ev.impact === 'Medium' ? 'bg-accent-yellow/10 text-accent-yellow' : 'bg-bg-secondary text-text-muted'}`}>
                    {ev.impact}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Subscribe */}
      <div className="bg-bg-card border border-border-default rounded-xl p-4">
        <h3 className="text-text-primary text-sm font-semibold mb-2">Get Signal Alerts via Email</h3>
        <p className="text-text-secondary text-sm mb-4">Subscribe for email alerts on high-confidence signals.</p>
        {status === 'success' ? (
          <div className="px-4 py-3 bg-accent-green/10 border border-accent-green/30 rounded-lg text-accent-green text-sm">
            ✓ Subscribed! You'll receive alerts soon.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required
              className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted input-animated text-sm"
            />
            <button
              type="submit" disabled={loading}
              className="px-4 py-2 bg-accent-blue text-bg-primary font-semibold rounded-lg text-sm hover:bg-blue-400 transition-all disabled:opacity-60"
            >
              {loading ? '...' : 'Alert Me'}
            </button>
          </form>
        )}
        {status === 'error' && <p className="text-accent-red text-xs mt-2">Something went wrong. Try again.</p>}
      </div>
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

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function ForexDashboard() {
  const [allPairsData, setAllPairsData] = useState(null)
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [activeTab, setActiveTab] = useState('signal')
  const [signal, setSignal] = useState(null)
  const [signalLoading, setSignalLoading] = useState(true)
  const [signalError, setSignalError] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [livePriceMap, setLivePriceMap] = useState({})
  const prevDirRef = useRef(null)
  const tabsRef = useRef(null)
  const contentRef = useRef(null)

  // Load all pairs — API returns {major, minor, exotic, all, ecb_live}
  useEffect(() => {
    getPairs()
      .then((data) => setAllPairsData(data))
      .catch(() => setAllPairsData(null))
  }, [])

  // Continuously fetch live prices for all ticker pairs every 30s
  useEffect(() => {
    const fetchPrices = () => {
      getLivePrices()
        .then((res) => {
          if (!Array.isArray(res?.prices)) return
          const map = {}
          res.prices.forEach((p) => { if (p.price && p.price !== '—') map[p.pair] = p.price })
          setLivePriceMap(map)
        })
        .catch(() => {})
    }
    fetchPrices()
    const id = setInterval(fetchPrices, 30_000)
    return () => clearInterval(id)
  }, [])

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
        {/* Price Ticker */}
        <PriceTicker />

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

        {/* Pair selector row */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="bg-bg-card border border-border-default rounded-xl p-3 flex flex-wrap items-center gap-3 card-hover"
        >
          <label className="text-text-secondary text-sm font-medium flex-shrink-0">Trading Pair:</label>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm input-animated"
          >
            {majorList.length > 0 && (
              <optgroup label="Major">
                {majorList.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            )}
            {minorList.length > 0 && (
              <optgroup label="Minor">
                {minorList.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            )}
            {exoticList.length > 0 && (
              <optgroup label="Exotic">
                {exoticList.map((p) => <option key={p} value={p}>{p}</option>)}
              </optgroup>
            )}
          </select>
          {signal && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded border ${dirBg(signal.signal || signal.direction)}`}>
              <span className={dirColor(signal.signal || signal.direction)}>
                {(signal.signal || signal.direction || '—').toUpperCase()}
              </span>
            </span>
          )}
          {/* Live current price for selected pair, updated every 30s */}
          {(livePriceMap[selectedPair] || signal?.current_price || signal?.entry_price) && (
            <span className="text-text-muted text-xs font-mono">
              <span className="text-text-muted">Live: </span>
              <span className="text-accent-blue font-semibold">
                {livePriceMap[selectedPair]
                  || (signal.current_price ? String(signal.current_price) : String(signal.entry_price))}
              </span>
            </span>
          )}
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
            {activeTab === 'success' && <SuccessTab allPairs={forexPairs} />}
            {activeTab === 'scanner' && <ScannerTab />}
            {activeTab === 'news' && <NewsTab />}
            {activeTab === 'alerts' && <AlertsTab />}
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
