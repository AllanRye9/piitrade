import { motion } from 'framer-motion'
import { useEffect, useState } from 'react'
import {
  BarChart2, Clock, Layers, TrendingUp, TrendingDown,
  Zap, Globe, AlertTriangle, Target, ArrowRight, Info,
  Activity, Eye, ChevronDown, ChevronUp, Shield, Crosshair,
  BookOpen, GitBranch,
} from 'lucide-react'
import { Link } from 'react-router-dom'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

// ─── Trading Sessions ────────────────────────────────────────────────────────
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
    desc: 'Opens the weekly cycle. Thin liquidity means tighter ranges and possible sweep of Asia lows before Tokyo opens.',
    pip_range: '30–50 pips avg',
    killzone: '22:00–00:00 UTC',
    kz_tip: "Sydney Open Killzone — watch for a sweep of the prior session's extreme.",
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
    desc: 'Asia session sets the range that London will frequently raid. Equal highs/lows formed here become premium liquidity targets.',
    pip_range: '40–80 pips avg',
    killzone: '00:00–03:00 UTC',
    kz_tip: 'Tokyo Open Killzone — ICT macro time for JPY pairs and Asia range formation.',
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
    desc: '~35% of daily volume. Frequently raids Asia highs/lows in the first 60–90 minutes before establishing the daily directional bias.',
    pip_range: '80–150 pips avg',
    killzone: '08:00–11:00 UTC',
    kz_tip: 'London Open Killzone — highest probability SMC entries of the entire day.',
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
    desc: 'NY AM (13:00–17:00 UTC) overlaps London, creating peak liquidity. NY PM sees consolidation or a second impulse leg.',
    pip_range: '70–120 pips avg',
    killzone: '13:00–16:00 UTC',
    kz_tip: 'NY Open Killzone — US economic data, major displacement candles and raid of London extremes.',
  },
]

function isSessionActive(open, close) {
  const now = new Date()
  const utcH = now.getUTCHours() + now.getUTCMinutes() / 60
  if (open < close) return utcH >= open && utcH < close
  return utcH >= open || utcH < close
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

// ─── Advanced Order Block concepts ──────────────────────────────────────────
const advancedOBConcepts = [
  {
    icon: TrendingUp,
    title: 'Bullish Order Block (BOB)',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    desc: 'The last bearish (down-close) candle before a strong bullish impulse leg. Marks institutional accumulation. The open-to-close range of that candle is the zone to monitor for re-entry.',
    timeframes: ['H4', 'D1', 'W1'],
    confluence: ['BOS above swing high', 'Discount (below 50% Fib)', 'Session killzone alignment'],
  },
  {
    icon: TrendingDown,
    title: 'Bearish Order Block (BOB)',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    border: 'border-accent-red/30',
    desc: 'The last bullish (up-close) candle before a strong bearish impulse leg. Marks institutional distribution. Ideal for sells when price retraces into the zone in premium.',
    timeframes: ['H4', 'D1', 'W1'],
    confluence: ['BOS below swing low', 'Premium (above 50% Fib)', 'Session killzone alignment'],
  },
  {
    icon: GitBranch,
    title: 'Mitigation Block',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    border: 'border-accent-purple/30',
    desc: 'A previously valid order block that has been mitigated (price returned to it and continued). Once mitigated, it may flip polarity — a former demand zone can become a supply zone.',
    timeframes: ['H1', 'H4', 'D1'],
    confluence: ['CHoCH on lower TF', 'Volume spike on re-entry', 'Opposite session sweep'],
  },
  {
    icon: Shield,
    title: 'Breaker Block',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    border: 'border-accent-blue/30',
    desc: 'Formed when an order block fails to hold and price breaks through it. The failed OB becomes a breaker — a powerful reversal zone in the new direction, used for counter-trend entries.',
    timeframes: ['H1', 'H4', 'D1'],
    confluence: ['Failed OB + BOS in new direction', 'Liquidity taken prior', 'FVG within the breaker'],
  },
  {
    icon: Target,
    title: 'Propulsion Block',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    border: 'border-accent-yellow/30',
    desc: 'A consolidation zone preceding a large displacement candle. The body of the last candle in the consolidation is the propulsion block — a very high-probability re-entry zone.',
    timeframes: ['M15', 'H1', 'H4'],
    confluence: ['Large displacement away', 'FVG immediately after', 'Inside killzone'],
  },
  {
    icon: Layers,
    title: 'Void / Fair Value Gap (FVG)',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    desc: 'A three-candle pattern where the body of the middle candle is not overlapped by the wicks of candles 1 and 3. The gap represents an imbalance in price that markets frequently fill before continuing.',
    timeframes: ['M15', 'H1', 'H4'],
    confluence: ['Aligns with OB or S/D zone', 'First touch of gap', 'HTF trend direction'],
  },
]

// ─── Liquidity Sweep advanced concepts ──────────────────────────────────────
const sweepConcepts = [
  {
    icon: AlertTriangle,
    title: 'Buy-Side Liquidity (BSL)',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    locations: ['Equal highs', 'Previous day / week high', 'Session open high', 'Round number resistance'],
    desc: 'Resting stop orders above swing highs. Institutions sweep BSL to fill large sell orders at optimal prices. After the sweep, look for bearish displacement into a premium order block.',
  },
  {
    icon: AlertTriangle,
    title: 'Sell-Side Liquidity (SSL)',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    locations: ['Equal lows', 'Previous day / week low', 'Session open low', 'Round number support'],
    desc: 'Resting stop orders below swing lows. Institutions sweep SSL to fill large buy orders. After the sweep, look for bullish displacement into a discount order block or demand zone.',
  },
  {
    icon: Zap,
    title: 'Stop Hunt / Sweep Wick',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    locations: ['Sharp wick beyond swing high/low', 'Quick close back inside range', 'Displacement candle follows'],
    desc: 'The visual signature of a sweep: a long wick that pierces a key level, immediately followed by a reversal candle. The displacement candle after the wick is the entry confirmation.',
  },
  {
    icon: BookOpen,
    title: 'Inducement (IDM)',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    locations: ['Minor swing formed during retracement', 'Appears before the real structural break', 'Often inside an FVG or OB range'],
    desc: 'A deliberately created minor swing to lure retail traders into an entry, only to be swept before the true move. Identifying IDM prevents entering too early on a corrective move.',
  },
  {
    icon: BarChart2,
    title: 'Liquidity Void',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    locations: ['Large one-sided candle with no consolidation', 'Price travels through it rapidly', 'Leaves imbalanced orderflow'],
    desc: 'A price area where market moved so quickly that little to no trading occurred. Markets tend to eventually return to fill these voids, making them target areas for partial exits or re-entries.',
  },
  {
    icon: Crosshair,
    title: 'Optimal Trade Entry (OTE)',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    locations: ['61.8%–79% Fibonacci retracement', 'Aligns with a discount OB or demand zone', 'Inside a killzone time window'],
    desc: 'The ICT concept of entering at the 62–79% retracement of the last swing. The OTE zone gives optimal risk:reward with stop below/above the swing and target at the prior liquidity pool.',
  },
]

// ─── Supply & Demand advanced concepts ──────────────────────────────────────
const sdZones = [
  {
    icon: TrendingUp,
    title: 'Demand Zone',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    patterns: ['Rally-Base-Rally (RBR)', 'Drop-Base-Rally (DBR)'],
    strength: [
      { label: 'RBR', desc: 'A rally, consolidation base, then another rally. Continuation demand — high probability.' },
      { label: 'DBR', desc: 'A drop into a base, then a sharp rally. Reversal demand — very strong if first touch.' },
    ],
    desc: 'Price area where institutional buy orders remain unfilled. Fresh demand zones (untested) on the HTF are the highest priority. Nested LTF zones within the HTF zone refine entry precision.',
  },
  {
    icon: TrendingDown,
    title: 'Supply Zone',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    border: 'border-accent-red/30',
    patterns: ['Drop-Base-Drop (DBD)', 'Rally-Base-Drop (RBD)'],
    strength: [
      { label: 'DBD', desc: 'A drop, consolidation base, then another drop. Continuation supply — high probability.' },
      { label: 'RBD', desc: 'A rally into a base, then a sharp drop. Reversal supply — most powerful at HTF.' },
    ],
    desc: 'Price area where institutional sell orders remain unfilled. The proximal (nearest) edge is the entry area; the distal (far) edge is the invalidation for stop placement.',
  },
]

const sdPrinciples = [
  { label: 'Zone Freshness', desc: 'First-touch zones carry the highest probability. Each revisit weakens the zone.' },
  { label: 'Strong Departure', desc: 'The faster and farther price left the zone, the more unfilled orders remain inside.' },
  { label: 'Proximal vs Distal', desc: 'Enter at the proximal line (nearest edge) and place stops beyond the distal line.' },
  { label: 'HTF Alignment', desc: 'Daily/Weekly S/D zones that overlap with HTF OBs create multi-confluence setups.' },
  { label: 'Zone Age', desc: 'Prefer zones formed within 3–6 months. Older zones lose relevance as market structure shifts.' },
  { label: 'Nested Refinement', desc: 'Drop to LTF (M15/H1) to find a refined OB or FVG within the HTF zone for better R:R.' },
  { label: 'Flip Zones', desc: 'A broken demand zone may flip to supply and vice versa — watch for confirmation before trading.' },
  { label: 'Volume at Zone', desc: 'High volume bars entering a zone confirm institutional activity. Low volume re-entries are less reliable.' },
]

// ─── Collapsible card ────────────────────────────────────────────────────────
function ExpandCard({ title, color, bg, icon: Icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="bg-bg-card border border-border-default rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-bg-secondary/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center flex-shrink-0`}>
            <Icon size={16} className={color} />
          </div>
          <span className={`font-semibold text-sm ${color}`}>{title}</span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown size={16} className="text-text-muted flex-shrink-0" />
        )}
      </button>
      {open && (
        <div className="px-5 pb-5 border-t border-border-default/50">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Tab navigation ──────────────────────────────────────────────────────────
const TABS = [
  { id: 'ob', label: 'Order Blocks', icon: Layers },
  { id: 'liquidity', label: 'Liquidity', icon: Zap },
  { id: 'sd', label: 'Supply & Demand', icon: Target },
  { id: 'sessions', label: 'Sessions', icon: Globe },
]

export default function Advance() {
  const [activeTab, setActiveTab] = useState('ob')

  useEffect(() => {
    document.title = 'Advanced Analysis – SMC Deep Dive | PiiTrade'
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-purple/10 border border-accent-purple/20 mb-6">
            <Activity size={32} className="text-accent-purple" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            Advanced Analysis
          </h1>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/30 text-accent-purple text-sm font-semibold mb-6">
            <Eye size={14} />
            <span>Institutional-Grade SMC Framework</span>
          </div>
          <p className="text-text-secondary text-lg leading-relaxed max-w-2xl mx-auto">
            A deep-dive into the advanced Smart Money Concepts used by institutional traders — covering breaker blocks,
            mitigation blocks, FVGs, OTE zones, inducement, and the full ICT killzone framework.
          </p>
        </motion.div>
      </section>

      {/* ── Tab bar ── */}
      <div className="sticky top-16 z-30 bg-bg-primary border-b border-border-default">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto py-2 scrollbar-none">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 flex-shrink-0 ${
                    isActive
                      ? 'bg-accent-purple/10 text-accent-purple border border-accent-purple/30'
                      : 'text-text-secondary hover:text-text-primary hover:bg-bg-card border border-transparent'
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Order Blocks tab ── */}
      {activeTab === 'ob' && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-4">
                <Layers size={12} />
                Institutional Order Flow
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
                📦 Order Blocks — Advanced
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                Beyond basic OBs: breaker blocks, mitigation blocks, propulsion blocks, and fair value gaps — each with detailed confluence requirements.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-8"
            >
              {advancedOBConcepts.map((ob) => {
                const Icon = ob.icon
                return (
                  <motion.div
                    key={ob.title}
                    variants={itemVariants}
                    className={`bg-bg-card border ${ob.border} rounded-xl p-5 hover:shadow-lg transition-all`}
                  >
                    <div className={`w-9 h-9 rounded-lg ${ob.bg} flex items-center justify-center mb-3`}>
                      <Icon size={18} className={ob.color} />
                    </div>
                    <h3 className={`text-sm font-bold mb-2 ${ob.color}`}>{ob.title}</h3>
                    <p className="text-text-secondary text-xs leading-relaxed mb-3">{ob.desc}</p>

                    <div className="mb-3">
                      <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-1.5">Best Timeframes</p>
                      <div className="flex flex-wrap gap-1">
                        {ob.timeframes.map((tf) => (
                          <span key={tf} className="px-2 py-0.5 bg-bg-secondary border border-border-default rounded text-xs text-text-muted font-mono">
                            {tf}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-1.5">Confluence Factors</p>
                      <ul className="flex flex-col gap-1">
                        {ob.confluence.map((c) => (
                          <li key={c} className="flex items-center gap-1.5 text-xs text-text-secondary">
                            <span className="w-1 h-1 rounded-full bg-accent-purple flex-shrink-0" />
                            {c}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Entry checklist */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-accent-blue/5 border border-accent-blue/20 rounded-xl p-5"
            >
              <div className="flex gap-3">
                <Info size={18} className="text-accent-blue flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-text-primary text-sm font-semibold mb-2">Multi-Timeframe OB Entry Checklist</p>
                  <ol className="flex flex-col gap-1.5 text-sm text-text-secondary">
                    {[
                      'HTF (D1/W1): Identify the dominant OB and bias direction.',
                      'Mid-TF (H4): Confirm a BOS or CHoCH in the direction of HTF bias.',
                      'Entry TF (H1/M15): Wait for price to enter the HTF OB range.',
                      'Trigger: Look for an LTF liquidity sweep followed by a displacement candle.',
                      'Entry: Place limit or market order at the 50% of the displacement candle or inside the FVG.',
                      'SL: Beyond the OB invalidation (wick low/high + 1–2 pips buffer).',
                      'TP: At the next liquidity pool, previous session high/low, or 1:3 R:R minimum.',
                    ].map((step, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="w-5 h-5 rounded-full bg-accent-blue/20 text-accent-blue text-xs flex items-center justify-center flex-shrink-0 font-bold mt-0.5">
                          {i + 1}
                        </span>
                        {step}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Liquidity tab ── */}
      {activeTab === 'liquidity' && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 text-accent-yellow text-sm mb-4">
                <Zap size={12} />
                Stop Hunts & Liquidity Pools
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
                💧 Liquidity — Advanced
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                Where liquidity rests, where it gets swept, and how to use sweep signatures to time high-probability counter-trend and continuation entries.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              className="flex flex-col gap-4 mb-8"
            >
              {sweepConcepts.map((lc) => {
                const Icon = lc.icon
                return (
                  <motion.div key={lc.title} variants={itemVariants}>
                    <ExpandCard title={lc.title} color={lc.color} bg={lc.bg} icon={lc.icon} defaultOpen={lc.title === 'Buy-Side Liquidity (BSL)'}>
                      <p className="text-text-secondary text-sm leading-relaxed mt-4 mb-4">{lc.desc}</p>
                      <div>
                        <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-2">Where It Forms</p>
                        <ul className="flex flex-col gap-1">
                          {lc.locations.map((loc) => (
                            <li key={loc} className="flex items-center gap-2 text-xs text-text-secondary">
                              <span className="w-1 h-1 rounded-full bg-accent-yellow flex-shrink-0" />
                              {loc}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </ExpandCard>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Sweep sequence */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-bg-card border border-border-default rounded-2xl p-6"
            >
              <h3 className="text-text-primary font-bold text-base mb-5">⚡ Advanced Sweep Entry Model</h3>
              <div className="flex flex-col sm:flex-row gap-3">
                {[
                  { step: '1', label: 'Mark Pools', desc: 'Identify equal highs/lows, session opens, and previous day extremes as primary liquidity pools.', color: 'bg-accent-blue/20 border-accent-blue/40 text-accent-blue' },
                  { step: '2', label: 'Await Sweep', desc: 'Drop to M5/M15 and watch for a wick beyond the pool on elevated volume or a sharp single-candle pierce.', color: 'bg-accent-yellow/20 border-accent-yellow/40 text-accent-yellow' },
                  { step: '3', label: 'Confirmation', desc: 'Require a displacement candle closing back inside the range — not just a wick return. This is the CHoCH on LTF.', color: 'bg-accent-purple/20 border-accent-purple/40 text-accent-purple' },
                  { step: '4', label: 'Refine Entry', desc: 'Enter at the 50% of the displacement candle body or inside the FVG created by the displacement.', color: 'bg-accent-green/20 border-accent-green/40 text-accent-green' },
                  { step: '5', label: 'Target', desc: 'Target the opposing liquidity pool or the next HTF order block. Trail stop after 1:1 is hit.', color: 'bg-accent-red/20 border-accent-red/40 text-accent-red' },
                ].map((s) => (
                  <div key={s.step} className="flex-1 flex flex-col items-center text-center p-4 bg-bg-secondary rounded-xl">
                    <div className={`w-8 h-8 rounded-full border flex items-center justify-center font-bold text-sm mb-3 ${s.color}`}>
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
      )}

      {/* ── Supply & Demand tab ── */}
      {activeTab === 'sd' && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-12"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-sm mb-4">
                <Target size={12} />
                Institutional Price Zones
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
                📊 Supply & Demand — Advanced
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                Identify and grade supply/demand zones by pattern type, freshness, departure speed, and multi-timeframe confluence for the highest-probability setups.
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
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
                    <div className={`w-9 h-9 rounded-lg ${zone.bg} flex items-center justify-center mb-3`}>
                      <Icon size={18} className={zone.color} />
                    </div>
                    <h3 className={`text-sm font-bold mb-2 ${zone.color}`}>{zone.title}</h3>
                    <p className="text-text-secondary text-xs leading-relaxed mb-4">{zone.desc}</p>

                    <div className="mb-3">
                      <p className="text-text-muted text-xs font-semibold uppercase tracking-widest mb-2">Zone Patterns Ranked</p>
                      <div className="flex flex-col gap-2">
                        {zone.strength.map((s, i) => (
                          <div key={s.label} className="flex items-start gap-2">
                            <span className={`text-xs font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0 ${zone.bg} ${zone.color}`}>
                              #{i + 1}
                            </span>
                            <div>
                              <p className={`text-xs font-semibold ${zone.color}`}>{s.label}</p>
                              <p className="text-text-muted text-xs">{s.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      {zone.patterns.map((p) => (
                        <span key={p} className="px-2 py-0.5 bg-bg-secondary border border-border-default rounded text-xs text-text-muted font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </motion.div>
                )
              })}
            </motion.div>

            {/* Principles grid */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="bg-bg-card border border-border-default rounded-2xl p-6 sm:p-8 mb-6"
            >
              <h3 className="text-text-primary font-bold text-base mb-5">Zone Quality Principles</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {sdPrinciples.map((p) => (
                  <div key={p.label} className="bg-bg-secondary rounded-lg p-3">
                    <p className="text-text-primary text-xs font-semibold mb-1">{p.label}</p>
                    <p className="text-text-muted text-xs leading-relaxed">{p.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 }}
              className="bg-accent-purple/5 border border-accent-purple/20 rounded-xl p-5 flex gap-3"
            >
              <Info size={18} className="text-accent-purple flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-text-primary text-sm font-semibold mb-1">S/D + OB Nested Refinement Technique</p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  When the HTF (D1/W1) marks a demand zone, drop to H4 to find the OB that caused the initial departure.
                  Then drop to H1/M15 to find an FVG or propulsion block within that OB. Entry at this nested level
                  tightens your stop significantly while keeping the same HTF target — dramatically improving R:R.
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── Sessions tab ── */}
      {activeTab === 'sessions' && (
        <section className="py-16 px-4">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-6"
            >
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-green/10 border border-accent-green/20 text-accent-green text-sm mb-4">
                <Globe size={12} />
                ICT Killzone Framework
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
                🌐 Trading Sessions — Advanced
              </h2>
              <p className="text-text-secondary text-lg max-w-2xl mx-auto">
                Each major session has specific killzone windows — high-probability time bands where institutional order flow is most active and SMC setups carry the highest edge.
              </p>
            </motion.div>

            <div className="flex justify-center mb-8">
              <SessionClock />
            </div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              animate="visible"
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

                    <div className={`${session.bg} border ${session.border} rounded-lg px-3 py-2 mb-4`}>
                      <p className={`text-xs font-bold ${session.color} mb-0.5`}>⏰ Killzone: {session.killzone}</p>
                      <p className="text-text-secondary text-xs">{session.kz_tip}</p>
                    </div>

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

            {/* ICT Macro times */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-bg-card border border-border-default rounded-2xl p-6 mb-6"
            >
              <h3 className="text-text-primary font-bold text-base mb-4">🕐 ICT Macro Time Windows (UTC)</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { time: '02:33 – 03:00', label: 'London Pre-Market', color: 'text-accent-green' },
                  { time: '04:03 – 04:30', label: 'London AM Macro', color: 'text-accent-green' },
                  { time: '08:50 – 09:10', label: 'London Open Macro', color: 'text-accent-green' },
                  { time: '09:50 – 10:10', label: 'London Mid Macro', color: 'text-accent-green' },
                  { time: '10:50 – 11:10', label: 'NY Pre-Market', color: 'text-accent-yellow' },
                  { time: '13:10 – 13:40', label: 'NY Open Macro', color: 'text-accent-yellow' },
                  { time: '15:15 – 15:45', label: 'NY PM Macro', color: 'text-accent-yellow' },
                  { time: '19:30 – 20:00', label: 'NY PM Close Macro', color: 'text-accent-yellow' },
                ].map((m) => (
                  <div key={m.time} className="flex items-center gap-3 bg-bg-secondary rounded-lg px-3 py-2.5">
                    <Clock size={13} className={m.color} />
                    <div>
                      <p className={`font-mono text-xs font-bold ${m.color}`}>{m.time}</p>
                      <p className="text-text-muted text-xs">{m.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-accent-green/5 border border-accent-green/20 rounded-xl p-5 flex gap-3"
            >
              <Info size={18} className="text-accent-green flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-text-primary text-sm font-semibold mb-1">London–New York Overlap Killzone (13:00–17:00 UTC)</p>
                <p className="text-text-secondary text-sm leading-relaxed">
                  The highest-liquidity window of the entire week. Both sessions are simultaneously active, creating the widest pip ranges
                  and the most institutional order flow. Major USD news events (CPI, NFP, FOMC) almost always fall inside this window.
                  SMC setups here — especially post-news liquidity sweeps followed by OB re-entries — carry the highest statistical edge.
                </p>
              </div>
            </motion.div>
          </div>
        </section>
      )}

      {/* ── CTA ── */}
      <section className="py-20 px-4 border-t border-border-default bg-bg-secondary">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-purple/10 border border-accent-purple/30 text-accent-purple text-sm font-semibold mb-6">
            <Activity size={14} />
            <span>Apply these concepts in the dashboard</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">
            Put the Framework into Practice
          </h2>
          <p className="text-text-secondary mb-8">
            Use the Forex Dashboard for live signals and combine them with the SMC concepts and advanced analysis covered here to build complete, high-confluence trade setups.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/forex"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-7 py-3 bg-accent-purple text-bg-primary font-semibold rounded-xl hover:bg-purple-400 group shadow-lg shadow-accent-purple/20 no-underline"
            >
              Open Forex Dashboard
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/smc"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-7 py-3 border border-border-default text-text-primary rounded-xl hover:border-accent-purple/50 hover:text-accent-purple no-underline"
            >
              Back to SMC Basics
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
