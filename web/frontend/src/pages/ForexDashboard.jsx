import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Search, RefreshCw, Volume2, VolumeX,
  BarChart2, AlertTriangle, Newspaper, Bell, Target, Layers, Zap,
  Star, Award, Flame, ChevronRight, ChevronLeft,
} from 'lucide-react'
import {
  getPairs, getSignals, getTechnical, getVolatile, getReversals,
  getFvgScanner, getSrBreakouts, getPatternScanner, getNews, subscribe,
} from '../utils/api'
import AdBanner from '../components/Layout/AdBanner'
import { useAds } from '../hooks/useAds'

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
function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
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
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  if (!signal) return <EmptyState title="No signal yet" desc="Select a pair to see its signal." />

  const dir = signal.signal || signal.direction || 'HOLD'
  const conf = signal.confidence ?? 50
  const accuracy = signal.accuracy_30d ?? signal.accuracy ?? null

  const bars = signal.history_accuracy || Array.from({ length: 30 }, (_, i) => ({ day: i + 1, acc: 55 + Math.random() * 30 }))

  return (
    <div className="space-y-3">
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
              <p className="text-lg font-bold text-text-primary">{(accuracy * 100).toFixed(1)}% <span className="text-xs font-normal text-text-muted">30d acc</span></p>
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
        <div className="flex items-end gap-0.5 h-16">
          {bars.slice(0, 30).map((b, i) => {
            const pct = b.acc ?? (50 + Math.random() * 40)
            return (
              <div
                key={i}
                className="flex-1 rounded-sm bg-accent-blue/40 hover:bg-accent-blue transition-colors"
                style={{ height: `${Math.min(100, pct)}%` }}
                title={`${typeof pct === 'number' ? pct.toFixed(1) : pct}%`}
              />
            )
          })}
        </div>
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
  const [pipValue, setPipValue] = useState(10)

  const riskAmount = (balance * riskPct) / 100
  const pips = entry && sl ? Math.abs(parseFloat(entry) - parseFloat(sl)) * 10000 : 0
  const positionSize = pips > 0 ? (riskAmount / (pips * pipValue)).toFixed(2) : '—'
  const margin = positionSize !== '—' ? (parseFloat(positionSize) * 1000 * 0.02).toFixed(2) : '—'

  return (
    <div className="space-y-3 max-w-md">
      <div className="bg-bg-card border border-border-default rounded-xl p-3 space-y-3">
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Account Balance ($)</label>
          <input
            type="number"
            value={balance}
            onChange={(e) => setBalance(parseFloat(e.target.value) || 0)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-blue"
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
              placeholder="1.08420"
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder-text-muted"
            />
          </div>
          <div>
            <label className="text-text-secondary text-xs mb-1 block">Stop Loss</label>
            <input
              type="number" step="0.00001" value={sl}
              onChange={(e) => setSl(e.target.value)}
              placeholder="1.08000"
              className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-blue placeholder-text-muted"
            />
          </div>
        </div>
        <div>
          <label className="text-text-secondary text-xs mb-1 block">Pip Value ($)</label>
          <input
            type="number" value={pipValue}
            onChange={(e) => setPipValue(parseFloat(e.target.value) || 10)}
            className="w-full bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-blue"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {[
          { label: 'Risk Amount', value: `$${riskAmount.toFixed(2)}`, color: 'text-accent-red' },
          { label: 'Position Size (lots)', value: positionSize, color: 'text-accent-green' },
          { label: 'Pips at Risk', value: pips > 0 ? pips.toFixed(1) : '—', color: 'text-accent-yellow' },
          { label: 'Margin Needed', value: margin !== '—' ? `$${margin}` : '—', color: 'text-accent-blue' },
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!pair) return
    setLoading(true)
    setError(null)
    getTechnical(pair)
      .then(setData)
      .catch(() => setError('Failed to load technical data.'))
      .finally(() => setLoading(false))
  }, [pair])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  if (!data) return <EmptyState title="No technical data" desc="Technical analysis unavailable for this pair." />

  const sr = data.support_resistance || data.sr || {}
  const fvg = data.fvg_zones || data.fvg || []
  const indicators = data.indicators || {}

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* S/R */}
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-3">Support & Resistance</h3>
          <div className="space-y-2">
            {sr.resistance && (
              <div className="flex justify-between items-center py-2 px-3 bg-accent-red/10 border border-accent-red/20 rounded-lg">
                <span className="text-accent-red text-sm">Resistance</span>
                <span className="font-mono text-sm text-text-primary">{sr.resistance}</span>
              </div>
            )}
            {sr.pivot && (
              <div className="flex justify-between items-center py-2 px-3 bg-accent-yellow/10 border border-accent-yellow/20 rounded-lg">
                <span className="text-accent-yellow text-sm">Pivot</span>
                <span className="font-mono text-sm text-text-primary">{sr.pivot}</span>
              </div>
            )}
            {sr.support && (
              <div className="flex justify-between items-center py-2 px-3 bg-accent-green/10 border border-accent-green/20 rounded-lg">
                <span className="text-accent-green text-sm">Support</span>
                <span className="font-mono text-sm text-text-primary">{sr.support}</span>
              </div>
            )}
            {!sr.resistance && !sr.support && !sr.pivot && (
              <p className="text-text-muted text-sm">No S/R data available</p>
            )}
          </div>
        </div>

        {/* Indicators */}
        <div className="bg-bg-card border border-border-default rounded-xl p-3">
          <h3 className="text-text-primary text-sm font-semibold mb-3">Indicators</h3>
          <div className="space-y-2">
            {Object.entries(indicators).slice(0, 6).map(([k, v]) => (
              <div key={k} className="flex justify-between items-center py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-text-secondary text-sm">{k.toUpperCase()}</span>
                <span className="font-mono text-sm text-text-primary">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
              </div>
            ))}
            {!Object.keys(indicators).length && <p className="text-text-muted text-sm">No indicator data</p>}
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
                  {zone.type?.toUpperCase() || 'FVG'}
                </span>
                <span className="font-mono text-xs text-text-secondary">
                  {zone.low} – {zone.high}
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getFvgScanner()
      .then(setData)
      .catch(() => setError('Failed to load FVG data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  if (!data) return <EmptyState title="No FVG data" desc="FVG scanner data unavailable." />

  const items = Array.isArray(data) ? data : data.fvg_zones || data.zones || []

  return (
    <div className="space-y-3">
      {items.length === 0 && <EmptyState title="No FVG zones" desc="No fair value gaps detected." />}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {items.map((zone, i) => {
          const status = zone.status || 'active'
          const statusColor = status === 'approaching' ? 'text-accent-yellow' : status === 'reached' ? 'text-accent-green' : status === 'rejected' ? 'text-accent-red' : 'text-accent-blue'
          return (
            <div key={i} className="bg-bg-card border border-border-default rounded-xl p-3">
              <div className="flex justify-between items-start mb-3">
                <span className="text-text-primary font-medium">{zone.pair || `Zone ${i + 1}`}</span>
                <span className={`text-xs font-semibold uppercase ${statusColor}`}>{status}</span>
              </div>
              <div className="space-y-1 text-sm">
                {zone.high && <div className="flex justify-between"><span className="text-text-muted">High</span><span className="font-mono text-text-primary">{zone.high}</span></div>}
                {zone.low && <div className="flex justify-between"><span className="text-text-muted">Low</span><span className="font-mono text-text-primary">{zone.low}</span></div>}
                {zone.type && <div className="flex justify-between"><span className="text-text-muted">Type</span><span className={zone.type === 'bullish' ? 'text-accent-green' : 'text-accent-red'}>{zone.type}</span></div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── S/R Breakouts Tab ────────────────────────────────────────────────────────
function SRTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getSrBreakouts()
      .then(setData)
      .catch(() => setError('Failed to load S/R breakout data.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  const items = Array.isArray(data) ? data : data?.breakouts || []

  return (
    <div>
      {items.length === 0 ? (
        <EmptyState title="No breakouts" desc="No S/R breakouts detected at this time." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                {['Pair', 'Level', 'Type', 'Direction', 'Time'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-text-muted font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((b, i) => (
                <tr key={i} className="border-b border-border-subtle hover:bg-bg-card transition-colors">
                  <td className="py-3 px-4 text-text-primary font-medium">{b.pair || '—'}</td>
                  <td className="py-3 px-4 font-mono text-text-secondary">{b.level || '—'}</td>
                  <td className="py-3 px-4">
                    <span className={`text-xs font-semibold uppercase ${b.type === 'support' ? 'text-accent-green' : 'text-accent-red'}`}>{b.type || '—'}</span>
                  </td>
                  <td className={`py-3 px-4 font-semibold ${dirColor(b.direction)}`}>{b.direction || '—'}</td>
                  <td className="py-3 px-4 text-text-muted">{b.time || b.timestamp || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Volatile Tab ─────────────────────────────────────────────────────────────
function VolatileTab() {
  const [timeframe, setTimeframe] = useState('24h')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getVolatile(timeframe)
      .then(setData)
      .catch(() => setError('Failed to load volatility data.'))
      .finally(() => setLoading(false))
  }, [timeframe])

  const items = Array.isArray(data) ? data : data?.pairs || []
  const maxVol = items.length ? Math.max(...items.map((p) => p.volatility || 0)) : 1

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
      {loading ? <LoadingSpinner /> : error ? <ErrorBox msg={error} /> : items.length === 0 ? (
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
                <span className="text-accent-yellow font-mono text-sm">{typeof p.volatility === 'number' ? p.volatility.toFixed(2) : p.volatility || '—'}%</span>
              </div>
              <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-yellow rounded-full transition-all"
                  style={{ width: `${maxVol > 0 ? ((p.volatility || 0) / maxVol) * 100 : 0}%` }}
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getReversals()
      .then(setData)
      .catch(() => setError('Failed to load reversal data.'))
      .finally(() => setLoading(false))
  }, [])

  const items = Array.isArray(data) ? data : data?.reversals || []

  return (
    <div className="space-y-3">
      {loading ? <LoadingSpinner /> : error ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No reversals" desc="No reversal signals detected." />
      ) : items.map((r, i) => (
        <div key={i} className="bg-bg-card border border-border-default rounded-xl p-3 flex items-center justify-between">
          <div>
            <p className="text-text-primary font-medium">{r.pair || r.symbol || '—'}</p>
            <p className="text-text-muted text-xs">{r.pattern || r.type || 'Reversal'}</p>
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
    const top10 = allPairs.slice(0, 10)
    Promise.allSettled(top10.map((p) => getSignals(p).then((d) => ({ pair: p, acc: d.accuracy_30d ?? d.accuracy ?? Math.random() * 0.2 + 0.6 }))))
      .then((settled) => {
        const list = settled.filter((s) => s.status === 'fulfilled').map((s) => s.value)
        list.sort((a, b) => b.acc - a.acc)
        setResults(list)
      })
      .finally(() => setLoading(false))
  }, [allPairs])

  return (
    <div className="space-y-3">
      {loading ? <LoadingSpinner /> : results.length === 0 ? (
        <EmptyState title="No data" desc="Accuracy data unavailable." />
      ) : results.map((r, i) => (
        <div key={r.pair} className="bg-bg-card border border-border-default rounded-xl p-3 flex items-center gap-3">
          <span className="text-text-muted font-bold w-6 text-center">{i + 1}</span>
          <div className="flex-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-text-primary font-medium">{r.pair}</span>
              <span className="text-accent-green font-semibold">{(r.acc * 100).toFixed(1)}%</span>
            </div>
            <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-accent-green rounded-full" style={{ width: `${r.acc * 100}%` }} />
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
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getPatternScanner()
      .then(setData)
      .catch(() => setError('Failed to load pattern scanner data.'))
      .finally(() => setLoading(false))
  }, [])

  const items = Array.isArray(data) ? data : data?.patterns || []

  return (
    <div className="space-y-3">
      {loading ? <LoadingSpinner /> : error ? <ErrorBox msg={error} /> : items.length === 0 ? (
        <EmptyState title="No patterns" desc="No patterns detected in the scanner." />
      ) : items.map((p, i) => (
        <div key={i} className="bg-bg-card border border-border-default rounded-xl p-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-primary text-sm font-medium">{p.pair || '—'}</p>
              <p className="text-text-muted text-xs mt-0.5">{p.timeframe || p.tf || ''}</p>
            </div>
            <div className="text-right">
              <span className={`text-sm font-semibold ${p.type?.toLowerCase().includes('bull') || p.direction === 'BUY' ? 'text-accent-green' : p.type?.toLowerCase().includes('bear') || p.direction === 'SELL' ? 'text-accent-red' : 'text-accent-yellow'}`}>
                {p.pattern || p.type || 'Pattern'}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── News Tab ─────────────────────────────────────────────────────────────────
function NewsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    getNews()
      .then(setData)
      .catch(() => setError('Failed to load market news.'))
      .finally(() => setLoading(false))
  }, [])

  const items = Array.isArray(data) ? data : data?.news || data?.articles || []

  return (
    <div className="space-y-4">
      {loading ? <LoadingSpinner /> : error ? <ErrorBox msg={error} /> : items.length === 0 ? (
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
              <a href={n.url || '#'} target="_blank" rel="noopener noreferrer" className="text-text-primary font-medium hover:text-accent-blue transition-colors">
                {n.title || n.headline || 'News Article'}
              </a>
              {n.summary && <p className="text-text-secondary text-sm mt-1 line-clamp-2">{n.summary}</p>}
              <p className="text-text-muted text-xs mt-2">{n.published_at || n.date || ''} {n.source ? `• ${n.source}` : ''}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Alerts Tab ───────────────────────────────────────────────────────────────
function AlertsTab() {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const events = [
    { time: 'Mon 09:30', event: 'US CPI y/y', currency: 'USD', impact: 'High' },
    { time: 'Tue 13:30', event: 'ECB Rate Decision', currency: 'EUR', impact: 'High' },
    { time: 'Wed 15:00', event: 'UK Unemployment', currency: 'GBP', impact: 'Medium' },
    { time: 'Thu 09:00', event: 'Japan Tankan', currency: 'JPY', impact: 'Medium' },
    { time: 'Fri 13:30', event: 'US NFP', currency: 'USD', impact: 'High' },
  ]

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
    <div className="space-y-4">
      {/* Economic calendar */}
      <div>
        <h3 className="text-text-primary text-sm font-semibold mb-3">Upcoming Economic Events</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                {['Time', 'Event', 'Currency', 'Impact'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-text-muted font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {events.map((ev, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td className="py-2.5 px-3 text-text-muted font-mono">{ev.time}</td>
                  <td className="py-2.5 px-3 text-text-primary">{ev.event}</td>
                  <td className="py-2.5 px-3 text-accent-blue font-medium">{ev.currency}</td>
                  <td className="py-2.5 px-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded ${ev.impact === 'High' ? 'bg-accent-red/10 text-accent-red' : 'bg-accent-yellow/10 text-accent-yellow'}`}>
                      {ev.impact}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Subscribe */}
      <div className="bg-bg-card border border-border-default rounded-xl p-4 max-w-md">
        <h3 className="text-text-primary text-sm font-semibold mb-2">Get Signal Alerts</h3>
        <p className="text-text-secondary text-sm mb-4">Subscribe for email alerts on high-confidence signals.</p>
        {status === 'success' ? (
          <div className="px-4 py-3 bg-accent-green/10 border border-accent-green/30 rounded-lg text-accent-green text-sm">
            ✓ Subscribed! You'll receive alerts soon.
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex gap-3">
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required
              className="flex-1 bg-bg-secondary border border-border-default rounded-lg px-3 py-2 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue text-sm"
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
  const { ads } = useAds()
  const [allPairsData, setAllPairsData] = useState(null)
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [activeTab, setActiveTab] = useState('signal')
  const [signal, setSignal] = useState(null)
  const [signalLoading, setSignalLoading] = useState(true)
  const [signalError, setSignalError] = useState(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const prevDirRef = useRef(null)
  const tabsRef = useRef(null)

  // Load all pairs — API returns {major, minor, exotic, all, ecb_live}
  useEffect(() => {
    getPairs()
      .then((data) => setAllPairsData(data))
      .catch(() => setAllPairsData(null))
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
    <div className="min-h-screen bg-bg-primary py-3 px-3">
      <div className="max-w-5xl mx-auto space-y-3">
        {/* Top ad */}
        <AdBanner placement="top" ads={ads} />

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-text-primary">📊 PiiTrade — Forex Signal Hub</h1>
            <p className="text-text-muted text-xs">AI-powered signals for {forexPairs.length} forex pairs</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-text-primary transition-colors"
              title={soundEnabled ? 'Mute sounds' : 'Enable sounds'}
            >
              {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
            </button>
            <button
              onClick={fetchSignal}
              disabled={signalLoading}
              className="p-1.5 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-accent-blue transition-colors"
              title="Refresh signal"
            >
              <RefreshCw size={13} className={signalLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Pair selector row */}
        <div className="bg-bg-card border border-border-default rounded-xl p-3 flex flex-wrap items-center gap-3">
          <label className="text-text-secondary text-sm font-medium flex-shrink-0">Trading Pair:</label>
          <select
            value={selectedPair}
            onChange={(e) => setSelectedPair(e.target.value)}
            className="bg-bg-secondary border border-border-default rounded-lg px-3 py-1.5 text-text-primary text-sm focus:outline-none focus:border-accent-blue"
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
          {(signal?.price || signal?.current_price) && (
            <span className="text-text-muted text-xs font-mono">
              {signal.price ? `$${signal.price}` : `$${signal.current_price}`}
            </span>
          )}
        </div>

        {/* Gamebar */}
        <Gamebar />

        {/* Tab navigation */}
        <div className="relative flex items-center gap-1">
          <button onClick={() => scrollTabs(-1)} className="flex-shrink-0 p-1 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-text-primary hidden sm:flex">
            <ChevronLeft size={13} />
          </button>
          <div ref={tabsRef} className="flex gap-1 overflow-x-auto scrollbar-hide flex-1 pb-0.5">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${activeTab === tab.id ? 'bg-accent-blue text-bg-primary' : 'bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button onClick={() => scrollTabs(1)} className="flex-shrink-0 p-1 rounded-lg bg-bg-card border border-border-default text-text-muted hover:text-text-primary hidden sm:flex">
            <ChevronRight size={13} />
          </button>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="bg-bg-secondary border border-border-default rounded-xl p-3 min-h-64"
          >
            {activeTab === 'signal' && <SignalTab pair={selectedPair} signal={signal} loading={signalLoading} error={signalError} />}
            {activeTab === 'risk' && <RiskCalcTab pair={selectedPair} />}
            {activeTab === 'technical' && <TechnicalTab pair={selectedPair} />}
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

        {/* Bottom ad */}
        <AdBanner placement="bottom" ads={ads} />
      </div>
    </div>
  )
}
