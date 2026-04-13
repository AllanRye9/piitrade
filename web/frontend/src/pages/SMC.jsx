import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  BarChart2, Clock, Layers, TrendingUp, TrendingDown,
  Zap, Globe, AlertTriangle, Target, ArrowRight, Info,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// ─── Trading Sessions ───────────────────────────────────────────────────────
// Times in UTC
const SESSIONS = [
  {
    name: 'Sydney',
    flag: '🇦🇺',
    open: 22,
    close: 7,
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    border: 'border-accent-purple/30',
    pairs: ['AUD/USD', 'NZD/USD', 'AUD/JPY'],
    desc: 'Relatively quiet session that marks the start of the trading day. AUD and NZD pairs see the most activity.',
    pip_range: '30–50 pips avg',
  },
  {
    name: 'Tokyo',
    flag: '🇯🇵',
    open: 0,
    close: 9,
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
    pairs: ['USD/JPY', 'EUR/JPY', 'GBP/JPY'],
    desc: 'Asian session driven by JPY pairs. Often sets key support/resistance levels that London will react to.',
    pip_range: '40–80 pips avg',
  },
  {
    name: 'London',
    flag: '🇬🇧',
    open: 8,
    close: 17,
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    pairs: ['GBP/USD', 'EUR/USD', 'EUR/GBP'],
    desc: 'Highest volume session accounting for ~35% of daily forex turnover. Majority of institutional order flow executes here.',
    pip_range: '80–150 pips avg',
  },
  {
    name: 'New York',
    flag: '🇺🇸',
    open: 13,
    close: 22,
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    border: 'border-accent-yellow/30',
    pairs: ['EUR/USD', 'GBP/USD', 'USD/CAD'],
    desc: 'Overlaps with London (13:00–17:00 UTC) creating peak liquidity. US economic data releases drive major moves.',
    pip_range: '70–120 pips avg',
  },
]

function isSessionActive(open, close) {
  const now = new Date()
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60
  if (open < close) return utcH >= open && utcH < close
  return utcH >= open || utcH < close // wraps midnight
}

function SessionClock() {
  const [utc, setUtc] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setUtc(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const pad = (n) => String(n).padStart(2, '0')
  return (
    <span className="font-mono text-xs text-text-muted">
      UTC {pad(utc.getUTCHours())}:{pad(utc.getUTCMinutes())}:{pad(utc.getUTCSeconds())}
    </span>
  )
}

// ─── Order Block data ────────────────────────────────────────────────────────
const orderBlockConcepts = [
  {
    icon: TrendingUp,
    title: 'Bullish Order Block',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    desc: 'The last down-close candle before a strong impulsive move up. Institutions filled buy orders here. Price often returns to this zone to re-test before continuing higher.',
    timeframes: ['H4', 'D1', 'W1'],
  },
  {
    icon: TrendingDown,
    title: 'Bearish Order Block',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    border: 'border-accent-red/30',
    desc: 'The last up-close candle before a strong impulsive move down. Institutions filled sell orders here. Price often retraces to this zone before continuing lower.',
    timeframes: ['H4', 'D1', 'W1'],
  },
  {
    icon: Target,
    title: 'Premium & Discount OBs',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    border: 'border-accent-purple/30',
    desc: 'Order blocks in the premium (above 50% of a swing) are optimal for sells; discount OBs (below 50%) are optimal for buys. Use Fibonacci 50% level to determine premium vs discount.',
    timeframes: ['H1', 'H4', 'D1'],
  },
  {
    icon: Layers,
    title: 'HTF Key S/R Levels',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
    desc: 'Higher-timeframe support and resistance are institutional price levels with the most significance. Weekly and Daily highs/lows, session opens, and monthly candle bodies act as major confluences for entries.',
    timeframes: ['D1', 'W1', 'MN'],
  },
]

// ─── Supply & Demand zones ───────────────────────────────────────────────────
const sdZones = [
  {
    icon: TrendingUp,
    title: 'Demand Zone',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    strength: ['Rally-Base-Rally (RBR)', 'Drop-Base-Rally (DBR)'],
    desc: 'A price range where large buyers dominated. Formed by a consolidation (base) followed by a strong breakout move away. Price is likely to bounce when revisiting.',
  },
  {
    icon: TrendingDown,
    title: 'Supply Zone',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    border: 'border-accent-red/30',
    strength: ['Drop-Base-Drop (DBD)', 'Rally-Base-Drop (RBD)'],
    desc: 'A price range where large sellers dominated. Formed by a base/consolidation before a sharp downward move. Price is likely to reject when revisiting.',
  },
]

const sdCharacteristics = [
  { label: 'Strong Departure', desc: 'Zone is more significant when price leaves it quickly and with large candles.' },
  { label: 'Fresh Zones', desc: 'Untouched zones (never revisited) carry more weight than already-tested ones.' },
  { label: 'Proximal Line', desc: 'The nearest edge of the zone to current price — the actual entry trigger area.' },
  { label: 'Distal Line', desc: 'The far edge of the zone — used for stop loss placement beyond the zone.' },
  { label: 'Zone Confluence', desc: 'S/D zones that align with HTF order blocks or key S/R have the highest probability.' },
  { label: 'Time-based Decay', desc: 'Older zones lose strength over time. Prefer zones formed within the last 3–6 months.' },
]

// ─── Liquidity concepts ──────────────────────────────────────────────────────
const liquidityConcepts = [
  {
    icon: AlertTriangle,
    title: 'Buy-Side Liquidity (BSL)',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    desc: 'Clusters of stop losses from short sellers sitting above swing highs and equal highs. Institutions sweep these levels to trigger buy stops, filling their large sell orders before pushing price lower.',
    example: 'Equal highs, previous day high, session highs',
  },
  {
    icon: AlertTriangle,
    title: 'Sell-Side Liquidity (SSL)',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    desc: 'Clusters of stop losses from long traders sitting below swing lows and equal lows. Institutions sweep these levels to trigger sell stops, filling their large buy orders before pushing price higher.',
    example: 'Equal lows, previous day low, session lows',
  },
  {
    icon: Zap,
    title: 'Liquidity Sweep / Stop Hunt',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    desc: 'A sharp price spike beyond a key high or low that instantly reverses. This wicks out retail stops, absorbs liquidity for institutional orders, then reverses — offering a high-probability entry in the opposite direction.',
    example: 'Wick beyond swing high/low with fast reversal',
  },
  {
    icon: BarChart2,
    title: 'Inducement',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    desc: 'A minor high or low formed during a retracement that lures retail traders into entering a position, only to have it swept before the true move continues. Identifies trap entries set by smart money.',
    example: 'Minor swing formed during correction before continuation',
  },
]

export default function SMC() {
  useEffect(() => {
    document.title = 'SMC Analyzer – Order Blocks, Liquidity & Sessions | PiiTrade'
  }, [])

  return (
    <div className="min-h-screen bg-bg-primary">

      {/* ── Hero ── */}
      <section className="py-20 px-4 bg-bg-secondary border-b border-border-default">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 mb-6">
            <BarChart2 size={32} className="text-accent-blue" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            SMC Analyzer
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow text-sm font-semibold mb-6">
            <Clock size={14} />
            <span>AI Analyzer Coming Soon</span>
          </div>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
            Smart Money Concepts — the institutional trading framework used by professional traders worldwide.
            Understand order blocks, liquidity sweeps, supply & demand zones, and trading sessions.
          </p>
        </motion.div>
      </section>

      {/* ── Order Blocks / HTF Key S/R ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-4">
              <Layers size={12} />
              Higher Timeframes
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              📦 Order Blocks & Key S/R Levels
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Order blocks are the footprints of institutional orders. Higher-timeframe S/R levels mark price areas where smart money has previously intervened at scale.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {orderBlockConcepts.map((ob) => {
              const Icon = ob.icon
              return (
                <motion.div
                  key={ob.title}
                  variants={itemVariants}
                  className={`bg-bg-card border ${ob.border} rounded-xl p-6 hover:border-opacity-60 transition-all`}
                >
                  <div className={`w-10 h-10 rounded-lg ${ob.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={ob.color} />
                  </div>
                  <h3 className={`text-base font-bold mb-2 ${ob.color}`}>{ob.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">{ob.desc}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {ob.timeframes.map((tf) => (
                      <span key={tf} className="px-2 py-0.5 bg-bg-secondary border border-border-default rounded text-xs text-text-muted font-mono">
                        {tf}
                      </span>
                    ))}
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          {/* How to use OBs tip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mt-8 bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-5 flex gap-3"
          >
            <Info size={18} className="text-accent-blue flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-text-primary text-sm font-semibold mb-1">How to Use Order Blocks</p>
              <p className="text-text-secondary text-sm leading-relaxed">
                Start on the Daily or Weekly chart to mark HTF order blocks. Drop to the H4 or H1 chart to look for a refined entry within the OB range.
                Confirm with a BOS (Break of Structure) or a liquidity sweep before entering. Always place your stop loss beyond the OB invalidation level.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Liquidity Sweeps ── */}
      <section className="py-20 px-4 bg-bg-secondary border-y border-border-default">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 text-accent-yellow text-sm mb-4">
              <Zap size={12} />
              Smart Money Concepts
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              💧 Liquidity Sweeps
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Institutions need liquidity to fill large orders. They deliberately hunt retail stop losses to create the volume needed for their positions.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8"
          >
            {liquidityConcepts.map((lc) => {
              const Icon = lc.icon
              return (
                <motion.div
                  key={lc.title}
                  variants={itemVariants}
                  className={`bg-bg-card border border-border-default rounded-xl p-6 hover:border-accent-yellow/30 transition-all`}
                >
                  <div className={`w-10 h-10 rounded-lg ${lc.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={lc.color} />
                  </div>
                  <h3 className={`text-base font-bold mb-2 ${lc.color}`}>{lc.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed mb-3">{lc.desc}</p>
                  <div className="flex items-start gap-2 text-xs text-text-muted">
                    <span className="text-accent-yellow">📍</span>
                    <span>{lc.example}</span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Sweep process */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-bg-card border border-border-default rounded-2xl p-6"
          >
            <h3 className="text-text-primary font-bold text-lg mb-5">⚡ Typical Liquidity Sweep Sequence</h3>
            <div className="flex flex-col sm:flex-row gap-3">
              {[
                { step: '1', label: 'Liquidity Builds', desc: 'Retail traders place stops above swing high or below swing low — liquidity pools form.' },
                { step: '2', label: 'Sweep Occurs', desc: 'Price spikes beyond the level, triggering stops and creating a wick on the chart.' },
                { step: '3', label: 'Reversal Signal', desc: 'Price closes back inside the range, confirming the sweep. Look for a displacement candle.' },
                { step: '4', label: 'Entry & Target', desc: 'Enter on retracement into the FVG or order block created during the sweep displacement.' },
              ].map((s) => (
                <div key={s.step} className="flex-1 flex flex-col items-center text-center p-4 bg-bg-secondary rounded-xl">
                  <div className="w-8 h-8 rounded-full bg-accent-yellow/20 border border-accent-yellow/40 flex items-center justify-center text-accent-yellow font-bold text-sm mb-3">
                    {s.step}
                  </div>
                  <p className="text-text-primary text-xs font-semibold mb-1">{s.label}</p>
                  <p className="text-text-muted text-xs leading-relaxed">{s.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Supply & Demand Zones ── */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-sm mb-4">
              <Target size={12} />
              Price Zones
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              📊 Supply & Demand Zones
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Supply and demand zones represent price areas where significant institutional orders remain unfilled.
              Price is drawn back to these areas to fulfil pending orders.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10"
          >
            {sdZones.map((zone) => {
              const Icon = zone.icon
              return (
                <motion.div
                  key={zone.title}
                  variants={itemVariants}
                  className={`bg-bg-card border ${zone.border} rounded-xl p-6`}
                >
                  <div className={`w-10 h-10 rounded-lg ${zone.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={zone.color} />
                  </div>
                  <h3 className={`text-base font-bold mb-2 ${zone.color}`}>{zone.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">{zone.desc}</p>
                  <div>
                    <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-2">Zone Patterns</p>
                    <div className="flex flex-wrap gap-1.5">
                      {zone.strength.map((s) => (
                        <span key={s} className="px-2 py-0.5 bg-bg-secondary border border-border-default rounded text-xs text-text-secondary font-mono">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Characteristics grid */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-bg-card border border-border-default rounded-2xl p-6 sm:p-8"
          >
            <h3 className="text-text-primary font-bold text-lg mb-5">Zone Characteristics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {sdCharacteristics.map((c) => (
                <div key={c.label} className="flex flex-col gap-1">
                  <p className="text-text-primary text-xs font-semibold">{c.label}</p>
                  <p className="text-text-muted text-xs leading-relaxed">{c.desc}</p>
                </div>
              ))}
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Trading Sessions ── */}
      <section className="py-20 px-4 bg-bg-secondary border-t border-border-default">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-4"
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-green/10 border border-accent-green/20 text-accent-green text-sm mb-4">
              <Globe size={12} />
              Live Session Status
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              🌐 Trading Sessions
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Forex markets operate across four major sessions. Knowing which session is active helps you anticipate volatility, liquidity, and which pairs to focus on.
            </p>
          </motion.div>

          <div className="flex justify-center mb-8">
            <SessionClock />
          </div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-10"
          >
            {SESSIONS.map((session) => {
              const active = isSessionActive(session.open, session.close)
              return (
                <motion.div
                  key={session.name}
                  variants={itemVariants}
                  className={`bg-bg-card border rounded-xl p-6 transition-all ${active ? `${session.border} shadow-lg` : 'border-border-default'}`}
                >
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{session.flag}</span>
                      <div>
                        <h3 className={`font-bold text-base ${active ? session.color : 'text-text-primary'}`}>
                          {session.name}
                        </h3>
                        <p className="text-text-muted text-xs font-mono">
                          {String(session.open).padStart(2, '0')}:00 – {String(session.close).padStart(2, '0')}:00 UTC
                        </p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border flex-shrink-0 ${
                      active
                        ? `${session.bg} ${session.color} ${session.border}`
                        : 'bg-bg-secondary text-text-muted border-border-default'
                    }`}>
                      {active ? '🟢 Open' : '⚫ Closed'}
                    </span>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed mb-4">{session.desc}</p>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {session.pairs.map((p) => (
                      <span key={p} className="px-2 py-0.5 bg-bg-secondary border border-border-default rounded text-xs text-text-muted font-mono">
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-text-muted">
                    <BarChart2 size={11} />
                    <span>{session.pip_range}</span>
                  </div>
                </motion.div>
              )
            })}
          </motion.div>

          {/* Session overlap highlight */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-5 flex gap-3"
          >
            <Info size={18} className="text-accent-green flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-text-primary text-sm font-semibold mb-1">London–New York Overlap (13:00–17:00 UTC)</p>
              <p className="text-text-secondary text-sm leading-relaxed">
                The highest-liquidity window in forex trading. Both the London and New York sessions are simultaneously open,
                creating peak volume and the widest pip ranges. This is when the most significant institutional order flow
                executes — ideal for SMC setups involving liquidity sweeps and order block entries on EUR/USD and GBP/USD.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-20 px-4 border-t border-border-default">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow text-sm font-semibold mb-6">
            <Clock size={14} />
            <span>AI-Powered SMC Analyzer — Coming Soon</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
            Auto-detect SMC Setups
          </h2>
          <p className="text-text-secondary mb-8">
            Upload a chart and let AI automatically identify order blocks, fair value gaps, liquidity sweeps,
            and BOS/CHoCH — all in real time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/forex"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-7 py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 group shadow-lg shadow-accent-blue/20 no-underline"
            >
              Open Forex Dashboard
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/methodology"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-7 py-3 border border-border-default text-text-primary rounded-xl hover:border-accent-blue/50 hover:text-accent-blue no-underline"
            >
              View Methodology
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
