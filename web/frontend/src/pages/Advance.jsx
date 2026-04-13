import { useState, useEffect, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Search, RefreshCw,
  Zap, BarChart2, Layers, AlertTriangle, Flame, RefreshCcw,
  Shield, Target, Activity, ChevronRight, Globe, Lock, ExternalLink,
  X, PlayCircle, MessageCircle, Mail, BrainCircuit, Database,
  Clock, Star, ArrowRight, Newspaper, BookOpen,
} from 'lucide-react'
import {
  getPairs, getSignals, getVolatile, getReversals,
  getFvgScanner, getSrBreakouts,
} from '../utils/api'

// ─── helpers ───────────────────────────────────────────────────────────────
function dirColor(dir) {
  if (!dir) return 'text-text-secondary'
  const d = dir.toUpperCase()
  if (d === 'BUY') return 'text-accent-green'
  if (d === 'SELL') return 'text-accent-red'
  return 'text-accent-yellow'
}
function dirBg(dir) {
  if (!dir) return 'bg-bg-card border-border-default'
  const d = dir.toUpperCase()
  if (d === 'BUY') return 'bg-accent-green/10 border-accent-green/30'
  if (d === 'SELL') return 'bg-accent-red/10 border-accent-red/30'
  return 'bg-accent-yellow/10 border-accent-yellow/30'
}
function DirIcon({ dir, size = 18 }) {
  const d = dir?.toUpperCase()
  if (d === 'BUY') return <TrendingUp size={size} />
  if (d === 'SELL') return <TrendingDown size={size} />
  return <Minus size={size} />
}

const MAJOR_PAIRS = ['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD']
const FALLBACK_MINOR = ['EUR/GBP','EUR/JPY','GBP/JPY','AUD/JPY','EUR/AUD','CAD/JPY','CHF/JPY','NZD/JPY']
const FALLBACK_EXOTIC = ['USD/MXN','USD/NOK','USD/SEK','USD/SGD','USD/HKD','USD/TRY','USD/ZAR','USD/CNY']

// ─── Live Session Beacon ──────────────────────────────────────────────────────
function LiveBeacon({ label = 'LIVE SESSION' }) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center w-5 h-5">
        {/* Outer ripple rings */}
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute rounded-full border border-accent-green"
            initial={{ opacity: 0.7, scale: 0.4 }}
            animate={{ opacity: 0, scale: 2.2 }}
            transition={{
              duration: 2,
              delay: i * 0.65,
              repeat: Infinity,
              ease: 'easeOut',
            }}
            style={{ width: '100%', height: '100%' }}
          />
        ))}
        {/* Core dot */}
        <motion.span
          className="relative z-10 w-2.5 h-2.5 rounded-full bg-accent-green shadow-[0_0_8px_2px_rgba(63,185,80,0.55)]"
          animate={{ opacity: [1, 0.55, 1] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <span className="text-accent-green text-xs font-bold tracking-widest uppercase">{label}</span>
    </div>
  )
}

// ─── Pair Filter ──────────────────────────────────────────────────────────────
function PairFilter({ selected, onSelect, majorList, minorList, exoticList }) {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState('major')

  const allPairs = [...majorList, ...minorList, ...exoticList]
  const searchResults = search.trim()
    ? allPairs.filter((p) => p.toLowerCase().replace('/', '').includes(search.toLowerCase().replace('/', '')))
    : []

  const tabLists = { major: majorList, minor: minorList, exotic: exoticList }
  const displayPairs = search.trim() ? searchResults : tabLists[activeTab] || []

  const TABS = [
    { id: 'major', label: 'Major', count: majorList.length },
    { id: 'minor', label: 'Minor', count: minorList.length },
    { id: 'exotic', label: 'Exotic', count: exoticList.length },
  ]

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search pair… (e.g. EUR/USD, GBPJPY)"
          className="w-full pl-8 pr-4 py-2 bg-bg-primary border border-border-default rounded-xl text-sm text-text-primary placeholder-text-muted focus:border-accent-blue/60 focus:outline-none transition-colors"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Category tabs */}
      {!search.trim() && (
        <div className="flex gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTab === tab.id
                  ? 'bg-accent-blue text-bg-primary border-accent-blue shadow-sm shadow-accent-blue/25'
                  : 'bg-bg-primary border-border-default text-text-secondary hover:border-accent-blue/40 hover:text-text-primary'
              }`}
            >
              {tab.label}
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-bg-card text-text-muted'}`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Pair chips */}
      <AnimatePresence mode="wait">
        <motion.div
          key={search ? 'search' : activeTab}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="flex flex-wrap gap-1.5"
        >
          {displayPairs.length === 0 && search.trim() ? (
            <p className="text-text-muted text-xs py-2">No pairs found for &ldquo;{search}&rdquo;</p>
          ) : (
            displayPairs.map((pair) => (
              <motion.button
                key={pair}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => onSelect(pair)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-all ${
                  selected === pair
                    ? 'bg-accent-blue text-bg-primary border-accent-blue shadow-md shadow-accent-blue/30'
                    : 'bg-bg-primary border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-text-primary hover:bg-bg-card'
                }`}
              >
                {pair}
              </motion.button>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// ─── Live Signal Card ─────────────────────────────────────────────────────────
function LiveSignalCard({ pair }) {
  const [signal, setSignal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetch = useCallback(() => {
    setLoading(true)
    getSignals(pair)
      .then((data) => {
        setSignal(data)
        setLastUpdate(new Date())
      })
      .catch(() => setSignal(null))
      .finally(() => setLoading(false))
  }, [pair])

  useEffect(() => {
    fetch()
    const id = setInterval(fetch, 30_000)
    return () => clearInterval(id)
  }, [fetch])

  const dir = signal?.signal || signal?.direction || 'HOLD'
  const conf = signal?.confidence ?? 50
  const entry = signal?.entry_price ?? signal?.entry
  const tp = signal?.take_profit ?? signal?.tp
  const sl = signal?.stop_loss ?? signal?.sl
  const isJpy = pair?.includes('JPY')
  const dec = isJpy ? 2 : 4

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4 }}
      className={`relative border rounded-2xl p-5 overflow-hidden ${dirBg(dir)}`}
    >
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ opacity: [0.06, 0.12, 0.06] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          className={`absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl ${dir === 'BUY' ? 'bg-accent-green' : dir === 'SELL' ? 'bg-accent-red' : 'bg-accent-yellow'}`}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-text-muted text-xs mb-0.5">Selected Pair</p>
            <p className="text-2xl font-bold text-text-primary">{pair}</p>
          </div>
          <div className="text-right">
            <div className={`flex items-center gap-1.5 text-lg font-bold ${dirColor(dir)}`}>
              <DirIcon dir={dir} size={20} />
              <span>{loading ? '…' : dir.toUpperCase()}</span>
            </div>
            <p className="text-text-muted text-xs mt-0.5">AI Signal</p>
          </div>
        </div>

        {/* Confidence bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-text-secondary mb-1">
            <span>Confidence</span>
            <span className="font-bold">{loading ? '—' : `${conf}%`}</span>
          </div>
          <div className="h-2 bg-bg-primary/50 rounded-full overflow-hidden">
            <motion.div
              key={`${pair}-${conf}`}
              initial={{ width: 0 }}
              animate={{ width: loading ? '0%' : `${conf}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${conf >= 70 ? 'bg-accent-green' : conf >= 50 ? 'bg-accent-yellow' : 'bg-accent-red'}`}
            />
          </div>
        </div>

        {/* Price levels */}
        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          {[
            { label: 'Entry', value: entry != null ? Number(entry).toFixed(dec) : '—', color: 'text-text-primary' },
            { label: 'TP', value: tp != null ? Number(tp).toFixed(dec) : '—', color: 'text-accent-green' },
            { label: 'SL', value: sl != null ? Number(sl).toFixed(dec) : '—', color: 'text-accent-red' },
          ].map((item) => (
            <div key={item.label} className="bg-bg-primary/40 rounded-lg py-2">
              <p className="text-text-muted mb-0.5">{item.label}</p>
              <p className={`font-mono font-bold ${item.color}`}>{loading ? '…' : item.value}</p>
            </div>
          ))}
        </div>

        {/* Footer */}
        {lastUpdate && (
          <p className="text-text-muted text-[10px] mt-3 text-right">
            Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Tool Metric Card ──────────────────────────────────────────────────────────
function ToolCard({ icon: Icon, title, value, sub, color, bg, delay = 0 }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: '-40px' })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ scale: 1.02, y: -2 }}
      className="bg-bg-card border border-border-default rounded-xl p-4 flex flex-col gap-2 cursor-default"
    >
      <div className={`w-9 h-9 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
        <Icon size={17} className={color} />
      </div>
      <p className="text-text-secondary text-xs font-medium">{title}</p>
      <p className="text-text-primary text-xl font-bold font-mono">{value}</p>
      {sub && <p className="text-text-muted text-[11px] leading-snug">{sub}</p>}
    </motion.div>
  )
}

// ─── Volatile Mini List ────────────────────────────────────────────────────────
function VolatileList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getVolatile('24h')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.pairs || []
        setItems(list.slice(0, 5))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-6">
      <motion.div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
    </div>
  )

  const max = items.length ? Math.max(...items.map((p) => p.volatility_pct || p.volatility || 0)) : 1

  return (
    <div className="space-y-2">
      {items.map((p, i) => {
        const vol = p.volatility_pct ?? p.volatility ?? 0
        const pct = max > 0 ? (vol / max) * 100 : 0
        const isHigh = pct >= 75
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className="flex items-center gap-3"
          >
            <span className="text-text-muted text-xs w-4 text-right">{i + 1}</span>
            <span className="text-text-primary text-xs font-semibold w-20">{p.pair || '—'}</span>
            <div className="flex-1 h-1.5 bg-bg-secondary rounded-full overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${isHigh ? 'bg-accent-red' : pct >= 40 ? 'bg-accent-yellow' : 'bg-accent-green'}`}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ delay: i * 0.06 + 0.1, duration: 0.5 }}
              />
            </div>
            <span className={`text-xs font-mono font-bold w-12 text-right ${isHigh ? 'text-accent-red' : 'text-accent-yellow'}`}>
              {typeof vol === 'number' ? `${vol.toFixed(2)}%` : '—'}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Reversal Mini List ───────────────────────────────────────────────────────
function ReversalList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getReversals()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.pairs || res?.reversals || []
        setItems(list.slice(0, 5))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-6">
      <motion.div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
    </div>
  )
  if (!items.length) return <p className="text-text-muted text-xs text-center py-4">No reversals detected</p>

  return (
    <div className="space-y-2">
      {items.map((r, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-xs font-semibold">{r.pair || r.symbol || '—'}</span>
            {r.timeframe && <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-card border border-border-default text-text-muted">{r.timeframe}</span>}
          </div>
          <span className={`text-xs font-bold px-2 py-0.5 rounded border ${dirBg(r.direction)} ${dirColor(r.direction)}`}>
            {r.direction || '—'}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── FVG Mini List ────────────────────────────────────────────────────────────
function FvgList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getFvgScanner()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.gaps || res?.fvg || []
        setItems(list.slice(0, 5))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-6">
      <motion.div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
    </div>
  )
  if (!items.length) return <p className="text-text-muted text-xs text-center py-4">No FVG data available</p>

  return (
    <div className="space-y-2">
      {items.map((g, i) => {
        const isBull = (g.type || g.gap_type || '').toLowerCase().includes('bull')
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-text-primary text-xs font-semibold">{g.pair || g.symbol || '—'}</span>
            </div>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isBull ? 'bg-accent-green/10 text-accent-green border border-accent-green/25' : 'bg-accent-red/10 text-accent-red border border-accent-red/25'}`}>
              {fvgLabel(g)}
            </span>
          </motion.div>
        )
      })}
    </div>
  )
}
function isNull(v) { return v == null }
function fvgLabel(g) {
  if (isNull(g.size)) return g.type || g.gap_type || '—'
  return `${g.type || '—'} ${Number(g.size || 0).toFixed(5)}`
}

// ─── SR Breakouts Mini List ───────────────────────────────────────────────────
function SRList() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getSrBreakouts()
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.breakouts || res?.pairs || []
        setItems(list.slice(0, 5))
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) return (
    <div className="flex justify-center py-6">
      <motion.div className="w-5 h-5 border-2 border-accent-blue border-t-transparent rounded-full" animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
    </div>
  )
  if (!items.length) return <p className="text-text-muted text-xs text-center py-4">No breakouts detected</p>

  return (
    <div className="space-y-2">
      {items.map((b, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.06, duration: 0.25 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="text-text-primary text-xs font-semibold">{b.pair || b.symbol || '—'}</span>
            {b.type && <span className="text-[10px] text-text-muted">{b.type}</span>}
          </div>
          <span className={`text-xs font-bold ${dirColor(b.direction)}`}>
            {b.direction || '—'}
          </span>
        </motion.div>
      ))}
    </div>
  )
}

// ─── Feature showcase cards ───────────────────────────────────────────────────
const FEATURES = [
  {
    icon: Zap,
    title: 'ML Signal Engine',
    desc: 'LightGBM model trained on 10+ years of historical market data. Outputs BUY/SELL/HOLD with confidence scores in real-time.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    icon: Layers,
    title: 'Fair Value Gap Scanner',
    desc: 'Automatically detects bullish and bearish FVG imbalances across all pairs — updated every 30 seconds.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
  {
    icon: AlertTriangle,
    title: 'S/R Breakout Detector',
    desc: 'Monitors key support and resistance levels and fires alerts the moment price breaks structure.',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
  },
  {
    icon: Flame,
    title: 'Volatility Rankings',
    desc: 'Live ATR-based ranking of the most volatile forex pairs across 1h, 4h, and 24h timeframes.',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
  },
  {
    icon: RefreshCcw,
    title: 'Reversal Patterns',
    desc: 'BOS and CHoCH pattern recognition spotting potential market reversals before they fully develop.',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
  },
  {
    icon: Target,
    title: 'Risk Calculator',
    desc: 'Position size, margin, SL/TP pips, risk:reward ratio — all calculated instantly from your account settings.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
  {
    icon: BarChart2,
    title: 'Technical Analysis',
    desc: '40+ indicators including RSI, MACD, EMA cross, Bollinger Bands, ADX, Stochastic, Williams %R and more.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    icon: Newspaper,
    title: 'Market Intelligence',
    desc: 'Live news from ForexLive, FXStreet, DailyFX, Reuters and economic calendar events — all in one place.',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
  },
]

// ─── Advance Page Footer ───────────────────────────────────────────────────────
function AdvanceFooter() {
  return (
    <footer className="mt-16 border-t border-border-default bg-bg-secondary rounded-2xl overflow-hidden">
      <div className="p-8 md:p-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
          {/* Brand */}
          <div>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-lg font-bold text-text-primary">PiiTrade Advanced</span>
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              Professional-grade AI forex analysis. Free forever.
              Built for traders who demand precision, speed, and depth.
            </p>
            <div className="flex items-center gap-3">
              <a href="https://twitter.com/piitrade" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue transition-colors" title="X / Twitter"><X size={14} /></a>
              <a href="https://www.youtube.com/@piitrade" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-red transition-colors" title="YouTube"><PlayCircle size={14} /></a>
              <a href="https://t.me/piitrade" target="_blank" rel="noopener noreferrer" className="text-text-muted hover:text-accent-blue transition-colors" title="Telegram"><MessageCircle size={14} /></a>
              <a href="mailto:support@piitrade.com" className="text-text-muted hover:text-accent-blue transition-colors" title="Email"><Mail size={14} /></a>
              <a href="https://piitrade.com" className="text-text-muted hover:text-accent-blue transition-colors" title="Website"><Globe size={14} /></a>
            </div>
          </div>

          {/* Tools */}
          <div>
            <h4 className="text-text-primary font-semibold text-sm mb-3 flex items-center gap-2 uppercase tracking-wider">
              <BrainCircuit size={13} className="text-accent-blue" /> Advanced Tools
            </h4>
            <ul className="space-y-2">
              {[
                { icon: Zap, text: 'AI Signal Engine (LightGBM)' },
                { icon: Layers, text: 'Fair Value Gap Scanner' },
                { icon: AlertTriangle, text: 'S/R Breakout Detector' },
                { icon: Flame, text: 'Volatility Rankings' },
                { icon: RefreshCcw, text: 'Reversal Pattern Finder' },
                { icon: Target, text: 'Risk & Position Calculator' },
                { icon: BarChart2, text: '40+ Technical Indicators' },
                { icon: Activity, text: 'Pattern Scanner' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-text-secondary text-xs">
                  <Icon size={11} className="text-accent-blue flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </div>

          {/* Info + Legal */}
          <div>
            <h4 className="text-text-primary font-semibold text-sm mb-3 flex items-center gap-2 uppercase tracking-wider">
              <Database size={13} className="text-accent-blue" /> Data Sources
            </h4>
            <ul className="space-y-1.5 mb-5">
              {['ECB Frankfurter API', 'ForexLive RSS', 'FXStreet News', 'DailyFX Analysis', 'Reuters Business', 'ForexFactory Calendar'].map((src) => (
                <li key={src} className="text-text-muted text-xs flex items-start gap-1.5">
                  <span className="text-accent-blue">›</span>{src}
                </li>
              ))}
            </ul>
            <h4 className="text-text-primary font-semibold text-sm mb-2 flex items-center gap-2 uppercase tracking-wider">
              <Shield size={13} className="text-accent-red" /> Risk Warning
            </h4>
            <p className="text-text-muted text-[11px] leading-relaxed">
              Signals are for informational purposes only. Trading forex involves significant risk.
              Past performance does not guarantee future results.{' '}
              <Link to="/disclaimer" className="text-accent-blue hover:underline">Read full disclaimer.</Link>
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-border-default pt-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-text-muted">
          <span>© {new Date().getFullYear()} PiiTrade. All rights reserved.</span>
          <div className="flex items-center gap-3 flex-wrap justify-center">
            <Link to="/" className="hover:text-accent-blue transition-colors">Home</Link>
            <span className="text-border-default">|</span>
            <Link to="/forex" className="hover:text-accent-blue transition-colors">Dashboard</Link>
            <span className="text-border-default">|</span>
            <Link to="/methodology" className="hover:text-accent-blue transition-colors">Methodology</Link>
            <span className="text-border-default">|</span>
            <Link to="/disclaimer" className="hover:text-accent-blue transition-colors">Disclaimer</Link>
            <span className="text-border-default">|</span>
            <a href="https://www.exness.com/" target="_blank" rel="noopener noreferrer" className="hover:text-accent-blue transition-colors flex items-center gap-1">
              Exness Partner <ExternalLink size={9} />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Lock size={11} className="text-accent-green" />
            <span className="text-accent-green font-medium">Free Forever. No Paywall.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}

// ─── Main Advance Page ────────────────────────────────────────────────────────
export default function Advance() {
  const [allPairsData, setAllPairsData] = useState(null)
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [sessionTime, setSessionTime] = useState(new Date())
  const featuresRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-80px' })

  useEffect(() => {
    document.title = 'Advanced Trading Tools | PiiTrade'
  }, [])

  // Clock tick
  useEffect(() => {
    const id = setInterval(() => setSessionTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Load pair lists
  useEffect(() => {
    getPairs()
      .then((data) => setAllPairsData(data))
      .catch(() => setAllPairsData(null))
  }, [])

  const majorList = allPairsData?.major?.filter((p) => typeof p === 'string') ?? MAJOR_PAIRS
  const minorList = allPairsData?.minor?.filter((p) => typeof p === 'string') ?? FALLBACK_MINOR
  const exoticList = allPairsData?.exotic?.filter((p) => typeof p === 'string') ?? FALLBACK_EXOTIC

  const forexSessionLabel = (() => {
    const h = sessionTime.getUTCHours()
    if (h >= 22 || h < 7) return 'Sydney / Tokyo'
    if (h >= 7 && h < 8) return 'Tokyo'
    if (h >= 8 && h < 16) return 'London'
    return 'New York'
  })()

  return (
    <div
      className="min-h-screen bg-bg-primary"
      style={{ paddingLeft: '5%', paddingRight: '5%' }}
    >
      {/* ── Top Session Bar ── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="pt-20 pb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
      >
        <div className="flex items-center gap-4 flex-wrap">
          <LiveBeacon label="LIVE SESSION" />
          <div className="flex items-center gap-2 px-3 py-1 bg-bg-card border border-border-default rounded-full">
            <Globe size={11} className="text-accent-blue" />
            <span className="text-text-secondary text-xs font-medium">{forexSessionLabel} Session</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1 bg-bg-card border border-border-default rounded-full">
            <Clock size={11} className="text-text-muted" />
            <span className="text-text-muted text-xs font-mono">
              {sessionTime.toUTCString().slice(17, 25)} UTC
            </span>
          </div>
        </div>
        <Link
          to="/forex"
          className="flex items-center gap-1.5 text-xs text-text-muted hover:text-accent-blue transition-colors"
        >
          <ArrowRight size={12} />
          Open Full Dashboard
        </Link>
      </motion.div>

      {/* ── Hero ── */}
      <motion.section
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="relative overflow-hidden rounded-3xl bg-bg-card border border-border-default mb-8 py-10 px-6 sm:px-10"
      >
        {/* Background animation blobs */}
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-0 left-0 w-72 h-72 rounded-full bg-accent-blue/5 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -20, 0], y: [0, 20, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-accent-purple/5 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-8">
          <div className="flex-1">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-xs mb-4"
            >
              <Star size={11} />
              <span>Advanced AI Trading Suite — 8 Professional Tools</span>
            </motion.div>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight mb-4">
              <span className="text-text-primary">Trade Smarter</span>
              <br />
              <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-green bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                With Advanced AI
              </span>
            </h1>
            <p className="text-text-secondary text-base leading-relaxed mb-6 max-w-lg">
              The full suite of professional trading tools — FVG scanner, S/R breakouts, volatility rankings,
              reversal patterns, pattern scanner and live AI signals. All free, all real-time.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/forex"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 transition-colors shadow-lg shadow-accent-blue/20 text-sm"
              >
                <Zap size={14} /> Open Dashboard
              </Link>
              <Link
                to="/methodology"
                className="inline-flex items-center gap-2 px-5 py-2.5 border border-border-default text-text-primary rounded-xl hover:border-accent-blue/50 hover:text-accent-blue transition-colors text-sm"
              >
                <BookOpen size={14} /> How It Works
              </Link>
            </div>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 flex-shrink-0 w-full lg:w-64">
            {[
              { label: 'Forex Pairs', value: '51+', color: 'text-accent-blue' },
              { label: 'AI Tools', value: '8', color: 'text-accent-green' },
              { label: 'Refresh Cycle', value: '30s', color: 'text-accent-purple' },
              { label: 'Cost', value: 'Free', color: 'text-accent-yellow' },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.3 + i * 0.08 }}
                className="bg-bg-primary border border-border-default rounded-xl p-3 text-center"
              >
                <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-text-muted text-[11px] mt-0.5">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.section>

      {/* ── Pair Filter + Live Signal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-8">
        {/* Pair filter */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4 }}
          className="lg:col-span-3 bg-bg-card border border-border-default rounded-2xl p-5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-text-primary font-bold text-sm">Trading Pair</h2>
              <p className="text-text-muted text-xs mt-0.5">Select a pair to view its live signal</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-bg-primary border border-border-default rounded-full">
              <span className="text-text-primary font-bold text-sm">{selectedPair}</span>
            </div>
          </div>
          <PairFilter
            selected={selectedPair}
            onSelect={setSelectedPair}
            majorList={majorList}
            minorList={minorList}
            exoticList={exoticList}
          />
        </motion.div>

        {/* Live signal */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
          className="lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-text-primary font-bold text-sm">Live Signal</h2>
            <LiveBeacon label="UPDATING" />
          </div>
          <LiveSignalCard pair={selectedPair} />
        </motion.div>
      </div>

      {/* ── Live Data Panels ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {[
          {
            icon: Flame,
            title: 'Top Volatile Pairs',
            color: 'text-accent-red',
            bg: 'bg-accent-red/10',
            content: <VolatileList />,
          },
          {
            icon: RefreshCcw,
            title: 'Reversal Signals',
            color: 'text-accent-purple',
            bg: 'bg-accent-purple/10',
            content: <ReversalList />,
          },
          {
            icon: Layers,
            title: 'FVG Scanner',
            color: 'text-accent-blue',
            bg: 'bg-accent-blue/10',
            content: <FvgList />,
          },
          {
            icon: AlertTriangle,
            title: 'S/R Breakouts',
            color: 'text-accent-yellow',
            bg: 'bg-accent-yellow/10',
            content: <SRList />,
          },
        ].map((panel, i) => (
          <motion.div
            key={panel.title}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 * i + 0.3, duration: 0.4 }}
            className="bg-bg-card border border-border-default rounded-2xl p-4"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className={`w-7 h-7 rounded-lg ${panel.bg} flex items-center justify-center flex-shrink-0`}>
                <panel.icon size={13} className={panel.color} />
              </div>
              <h3 className="text-text-primary text-sm font-semibold">{panel.title}</h3>
            </div>
            {panel.content}
            <div className="mt-3 pt-3 border-t border-border-default">
              <Link to="/forex" className="flex items-center gap-1 text-[11px] text-text-muted hover:text-accent-blue transition-colors">
                <ChevronRight size={11} /> View all in Dashboard
              </Link>
            </div>
          </motion.div>
        ))}
      </div>

      {/* ── Feature Grid ── */}
      <section ref={featuresRef} className="mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={featuresInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4 }}
          className="text-center mb-6"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-2">
            Everything You Need to Trade Better
          </h2>
          <p className="text-text-secondary text-sm max-w-xl mx-auto">
            Eight professional tools built into one platform. No subscriptions, no paywalls.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {FEATURES.map((f, i) => (
            <ToolCard
              key={f.title}
              icon={f.icon}
              title={f.title}
              value=""
              sub={f.desc}
              color={f.color}
              bg={f.bg}
              delay={i * 0.06}
            />
          ))}
        </div>
      </section>

      {/* ── CTA ── */}
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-60px' }}
        transition={{ duration: 0.5 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-accent-blue/10 via-accent-purple/5 to-accent-green/10 border border-accent-blue/20 p-8 sm:p-12 text-center mb-4"
      >
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent-blue/10 to-accent-purple/10 pointer-events-none"
        />
        <div className="relative z-10">
          <LiveBeacon label="MARKETS OPEN NOW" />
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mt-4 mb-2">
            Start Trading With Confidence
          </h2>
          <p className="text-text-secondary text-sm mb-6 max-w-md mx-auto">
            Access the full dashboard with all 8 AI-powered tools. Completely free, no sign-up required.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/forex"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 bg-accent-blue text-bg-primary font-bold rounded-xl hover:bg-blue-400 transition-colors shadow-lg shadow-accent-blue/20 text-sm"
            >
              <Zap size={15} /> Open Live Dashboard
              <ArrowRight size={14} />
            </Link>
            <Link
              to="/methodology"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 border border-border-default text-text-primary rounded-xl hover:border-accent-blue/50 hover:text-accent-blue transition-colors text-sm"
            >
              <BookOpen size={14} /> Read Methodology
            </Link>
          </div>
        </div>
      </motion.section>

      {/* ── Professional Footer ── */}
      <AdvanceFooter />
    </div>
  )
}
