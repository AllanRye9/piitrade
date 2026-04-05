import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import {
  TrendingUp, TrendingDown, Minus, Zap, BarChart2, Globe, Shield,
  ChevronRight, ArrowRight, CheckCircle, Users, Star, Clock, Lock,
  Activity, DollarSign, BookOpen
} from 'lucide-react'
import { subscribe } from '../utils/api'
import PartnerCards from '../components/PartnerCard'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

function AnimatedCounter({ target, suffix = '', duration = 2 }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const inView = useInView(ref, { once: true })

  useEffect(() => {
    if (!inView) return
    let start = 0
    const step = target / (duration * 60)
    const timer = setInterval(() => {
      start += step
      if (start >= target) {
        setCount(target)
        clearInterval(timer)
      } else {
        setCount(Math.floor(start))
      }
    }, 1000 / 60)
    return () => clearInterval(timer)
  }, [inView, target, duration])

  return (
    <span ref={ref} className="text-4xl font-bold text-text-primary">
      {count}{suffix}
    </span>
  )
}

const features = [
  {
    icon: Globe,
    title: '35 Forex Pairs',
    desc: 'Major, minor, and exotic forex pairs — all in one unified dashboard with live signals.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
  {
    icon: Zap,
    title: 'ML-Powered Signals',
    desc: 'LightGBM model trained on 10+ years of market data for accurate BUY/SELL/HOLD predictions.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    icon: BarChart2,
    title: 'Real-Time Prices',
    desc: 'Live market data refreshed continuously. Always know where the forex market stands.',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
  },
  {
    icon: Shield,
    title: 'Risk Calculator',
    desc: 'Built-in position sizing and risk management tools to protect your trading capital.',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
  },
  {
    icon: TrendingUp,
    title: '11 Analysis Tools',
    desc: 'FVG scanner, S/R breakouts, pattern scanner, volatility rankings, reversals and more.',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
  },
  {
    icon: ChevronRight,
    title: 'Crypto & Stocks Soon',
    desc: 'Crypto, commodities, and stocks signals on the way — free AI tools for every asset.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
]

const stats = [
  { value: 35, suffix: '', label: 'Forex Pairs' },
  { value: 11, suffix: '', label: 'Analysis Tools' },
  { value: 10, suffix: '+', label: 'Years Training Data' },
  { value: 100, suffix: '%', label: 'Free Forever' },
]

const previewSignals = [
  { pair: 'EUR/USD', dir: 'BUY', conf: 78, entry: '1.0842' },
  { pair: 'GBP/JPY', dir: 'SELL', conf: 65, entry: '196.34' },
  { pair: 'AUD/USD', dir: 'BUY', conf: 71, entry: '0.6541' },
  { pair: 'USD/JPY', dir: 'HOLD', conf: 58, entry: '154.82' },
]

const howItWorks = [
  {
    step: '01',
    icon: Activity,
    title: 'AI Analyses the Market',
    desc: 'Our LightGBM model processes 40+ technical indicators — RSI, MACD, Bollinger Bands, ATR, and more — across 35 pairs in real time.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
  {
    step: '02',
    icon: Zap,
    title: 'Signal is Generated',
    desc: 'The model outputs a BUY, SELL, or HOLD signal with a confidence score, auto-calculated take-profit, and stop-loss levels.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    step: '03',
    icon: DollarSign,
    title: 'You Trade Smarter',
    desc: 'Use the built-in Risk Calculator to size your position, set your alerts, and execute trades with confidence.',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
  },
]

const trustPoints = [
  { icon: Lock, text: 'No account required — open & free forever' },
  { icon: BookOpen, text: 'Transparent methodology — see exactly how signals work' },
  { icon: Clock, text: 'Signals refreshed continuously throughout the day' },
  { icon: Users, text: 'Built for traders of all experience levels' },
  { icon: Star, text: '100% free — no premium tier, no hidden fees' },
  { icon: CheckCircle, text: 'Works on all devices — desktop, tablet, and mobile' },
]

function SignalBadge({ dir }) {
  const map = {
    BUY: { color: 'text-accent-green bg-accent-green/10 border-accent-green/30', icon: TrendingUp },
    SELL: { color: 'text-accent-red bg-accent-red/10 border-accent-red/30', icon: TrendingDown },
    HOLD: { color: 'text-accent-yellow bg-accent-yellow/10 border-accent-yellow/30', icon: Minus },
  }
  const { color, icon: Icon } = map[dir] || map.HOLD
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${color}`}>
      <Icon size={10} />
      {dir}
    </span>
  )
}

export default function Landing() {
  const [email, setEmail] = useState('')
  const [subStatus, setSubStatus] = useState(null)
  const [subLoading, setSubLoading] = useState(false)
  const featuresRef = useRef(null)
  const featuresInView = useInView(featuresRef, { once: true, margin: '-100px' })

  const handleSubscribe = async (e) => {
    e.preventDefault()
    if (!email) return
    setSubLoading(true)
    try {
      await subscribe(email)
      setSubStatus('success')
      setEmail('')
    } catch {
      setSubStatus('error')
    } finally {
      setSubLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* ── Hero ── */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4 py-20">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-20 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(rgba(88,166,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(88,166,255,0.15) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
        <motion.div
          animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-blue/5 blur-3xl pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -25, 0], y: [0, 15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent-purple/5 blur-3xl pointer-events-none"
        />

        <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center w-full">
          {/* Left content */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, ease: [0.25, 0.46, 0.45, 0.94] }}
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.4 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-6"
            >
              <Zap size={12} />
              <span>AI-Powered • LightGBM • Free Forever</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-text-primary">AI-Powered</span>
              <br />
              <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-green bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                Forex Signals
              </span>
              <br />
              <span className="text-text-primary">Completely Free</span>
            </h1>

            <p className="text-text-secondary text-lg leading-relaxed mb-8 max-w-lg">
              Real-time buy/sell/hold signals for 35 forex pairs — powered by LightGBM trained on 10+ years of market data. Crypto & stocks coming soon. No subscriptions, no paywalls.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-8">
              <Link
                to="/forex"
                className="btn-interactive inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 group shadow-lg shadow-accent-blue/20 hover:shadow-accent-blue/40 transition-shadow duration-250"
              >
                View Live Signals
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/methodology"
                className="btn-interactive inline-flex items-center justify-center gap-2 px-6 py-3 border border-border-default text-text-primary rounded-xl hover:border-accent-blue/50 hover:text-accent-blue"
              >
                Learn Methodology
              </Link>
            </div>

            {/* Trust badges */}
            <div className="flex flex-wrap gap-3">
              {['No Account Needed', '100% Free', 'Live Data'].map((badge) => (
                <span key={badge} className="inline-flex items-center gap-1.5 text-xs text-text-muted">
                  <CheckCircle size={12} className="text-accent-green" />
                  {badge}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Right — floating signal card (visible on lg+ only) */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
              className="relative z-10"
            >
              <div className="bg-bg-card border border-border-default rounded-2xl p-6 shadow-2xl glow-blue">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-text-muted text-xs uppercase tracking-wider mb-1">Live Signal</p>
                    <p className="text-text-primary font-bold text-xl">EUR/USD</p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-2xl font-bold text-accent-green">BUY</span>
                    <span className="text-text-secondary text-sm">78% conf.</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  {[
                    { label: 'Entry', value: '1.0842', color: 'text-text-primary' },
                    { label: 'Take Profit', value: '1.0910', color: 'text-accent-green' },
                    { label: 'Stop Loss', value: '1.0800', color: 'text-accent-red' },
                  ].map((item) => (
                    <div key={item.label} className="bg-bg-secondary rounded-lg p-2 text-center">
                      <p className="text-text-muted text-xs mb-1">{item.label}</p>
                      <p className={`font-mono text-sm font-semibold ${item.color}`}>{item.value}</p>
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex justify-between text-xs text-text-muted mb-1">
                    <span>Confidence</span><span>78%</span>
                  </div>
                  <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: '78%' }}
                      transition={{ delay: 0.8, duration: 1 }}
                      className="h-full bg-accent-green rounded-full"
                    />
                  </div>
                </div>
              </div>
            </motion.div>

            {previewSignals.slice(1).map((s, i) => (
              <motion.div
                key={s.pair}
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 5 + i, repeat: Infinity, ease: 'easeInOut', delay: i * 0.5 }}
                className={`absolute ${i === 0 ? '-top-6 -right-4' : i === 1 ? 'bottom-0 -left-6' : '-bottom-4 right-8'} bg-bg-card border border-border-default rounded-xl p-3 shadow-lg`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-text-secondary text-xs font-medium">{s.pair}</span>
                  <SignalBadge dir={s.dir} />
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          animate={{ y: [0, 6, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 text-text-muted"
        >
          <div className="w-6 h-9 border-2 border-border-default rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-accent-blue rounded-full" />
          </div>
        </motion.div>
      </section>

      {/* ── Stats Banner ── */}
      <section className="py-12 px-4 bg-bg-secondary border-y border-border-default">
        <div className="max-w-4xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 text-center">
            {stats.map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <AnimatedCounter target={s.value} suffix={s.suffix} />
                <p className="text-text-secondary text-sm mt-2">{s.label}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 px-4" ref={featuresRef}>
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={featuresInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
              Everything You Need to Trade Smarter
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Professional-grade tools powered by machine learning. Free for every trader.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate={featuresInView ? 'visible' : 'hidden'}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {features.map((f) => {
              const Icon = f.icon
              return (
                <motion.div
                  key={f.title}
                  variants={itemVariants}
                  whileHover={{ y: -6, transition: { duration: 0.25, ease: 'easeOut' } }}
                  className="bg-bg-card border border-border-default rounded-xl p-6 hover:border-accent-blue/50 hover:shadow-[0_20px_30px_-10px_rgba(0,0,0,0.2)] transition-all duration-250 group cursor-pointer"
                >
                  <div className={`w-10 h-10 rounded-lg ${f.bg} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}>
                    <Icon size={20} className={f.color} />
                  </div>
                  <h3 className="text-text-primary font-semibold text-lg mb-2">{f.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{f.desc}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 px-4 bg-bg-secondary border-y border-border-default">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">How It Works</h2>
            <p className="text-text-secondary text-lg max-w-xl mx-auto">
              From raw market data to actionable signal — in three simple steps.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line for desktop */}
            <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-0.5 bg-gradient-to-r from-accent-blue/30 via-accent-green/30 to-accent-purple/30" />

            {howItWorks.map((step, i) => {
              const Icon = step.icon
              return (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.15 }}
                  className="flex flex-col items-center text-center relative"
                >
                  <div className={`w-20 h-20 rounded-2xl ${step.bg} flex items-center justify-center mb-4 relative z-10`}>
                    <Icon size={32} className={step.color} />
                    <span className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-bg-card border border-border-default flex items-center justify-center text-xs font-bold text-text-muted">
                      {step.step}
                    </span>
                  </div>
                  <h3 className="text-text-primary font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Live Signal Preview ── */}
      <section className="py-24 px-4">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">Live Signal Preview</h2>
            <p className="text-text-secondary">See the latest Forex signals — updated in real time.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {previewSignals.map((s, i) => (
              <motion.div
                key={s.pair}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-bg-card border border-border-default rounded-xl p-4 hover:border-accent-blue/30 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-text-primary font-semibold">{s.pair}</p>
                    <p className="text-text-muted text-xs font-mono">{s.entry}</p>
                  </div>
                  <SignalBadge dir={s.dir} />
                </div>
                <div>
                  <div className="flex justify-between text-xs text-text-muted mb-1">
                    <span>Confidence</span>
                    <span>{s.conf}%</span>
                  </div>
                  <div className="h-1.5 bg-bg-secondary rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${s.dir === 'BUY' ? 'bg-accent-green' : s.dir === 'SELL' ? 'bg-accent-red' : 'bg-accent-yellow'}`}
                      style={{ width: `${s.conf}%` }}
                    />
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="text-center">
            <Link
              to="/forex"
              className="btn-interactive inline-flex items-center gap-2 px-6 py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 group"
            >
              View All 35 Pairs
              <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── Partners / Sponsors ── */}
      <section className="py-16 px-4 bg-bg-secondary border-y border-border-default">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-8"
          >
            <p className="text-text-muted text-sm uppercase tracking-widest font-semibold">Our Partners</p>
            <p className="text-text-secondary text-sm mt-1">These partners help keep PiiTrade free for everyone</p>
          </motion.div>
          <PartnerCards />
        </div>
      </section>

      {/* ── Trust / Why Free ── */}
      <section className="py-24 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">Why PiiTrade?</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Professional-grade trading tools should be accessible to everyone — not just institutional traders paying thousands per month.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {trustPoints.map((point, i) => {
              const Icon = point.icon
              return (
                <motion.div
                  key={point.text}
                  initial={{ opacity: 0, y: 16 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-start gap-3 p-4 bg-bg-card border border-border-default rounded-xl hover:border-accent-green/30 transition-colors"
                >
                  <Icon size={18} className="text-accent-green flex-shrink-0 mt-0.5" />
                  <p className="text-text-secondary text-sm leading-relaxed">{point.text}</p>
                </motion.div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── Subscribe ── */}
      <section className="py-20 px-4 bg-bg-secondary border-y border-border-default">
        <div className="max-w-lg mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h3 className="text-2xl font-bold text-text-primary mb-2">Get Signal Alerts</h3>
            <p className="text-text-secondary text-sm mb-6">
              Subscribe to receive email alerts when high-confidence signals appear across 35 forex pairs.
            </p>
            {subStatus === 'success' ? (
              <div className="px-6 py-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-accent-green font-medium">
                ✓ Subscribed successfully! You'll receive alerts soon.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex flex-col sm:flex-row gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-4 py-3 bg-bg-card border border-border-default rounded-xl text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/50 transition-colors"
                />
                <button
                  type="submit"
                  disabled={subLoading}
                  className="btn-interactive px-6 py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 disabled:opacity-60 whitespace-nowrap"
                >
                  {subLoading ? '...' : 'Subscribe'}
                </button>
              </form>
            )}
            {subStatus === 'error' && (
              <p className="mt-3 text-accent-red text-sm">Something went wrong. Please try again.</p>
            )}
          </motion.div>
        </div>
      </section>

      {/* ── Roadmap ── */}
      <section className="py-20 px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-6">
            🗺️ What&rsquo;s Coming Next
          </h2>
          <div className="bg-bg-card border border-border-default rounded-2xl p-8 space-y-4 text-left">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📈</span>
              <p className="text-text-secondary leading-relaxed">
                <span className="text-accent-green font-semibold">Forex signals are live today</span>
                {' — '}free for all traders, updated continuously.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">₿</span>
              <p className="text-text-secondary leading-relaxed">
                <span className="text-accent-yellow font-semibold">Crypto markets are next</span>
                {' — '}AI-powered signals for Bitcoin, Ethereum, and more.
              </p>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">📊</span>
              <p className="text-text-secondary leading-relaxed">
                <span className="text-accent-purple font-semibold">Stocks and commodities</span>
                {' — '}professional AI tools for every asset class, all free.
              </p>
            </div>
            <div className="pt-4 border-t border-border-default flex justify-center">
              <Link
                to="/roadmap"
                className="btn-interactive inline-flex items-center gap-2 px-6 py-3 bg-accent-blue/10 border border-accent-blue/30 text-accent-blue font-semibold rounded-xl hover:bg-accent-blue/20 hover:border-accent-blue/60 transition-all duration-200 text-sm no-underline"
              >
                <BookOpen size={16} />
                Read Full Roadmap &amp; White Paper
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Final CTA ── */}
      <section className="py-24 px-4 bg-bg-secondary border-t border-border-default">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-2xl mx-auto text-center"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
            Ready to Trade Smarter?
          </h2>
          <p className="text-text-secondary text-lg mb-8">
            No account needed. No paywalls. Just open the dashboard and start trading with AI-powered signals — free forever.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/forex"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-8 py-4 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 text-lg group shadow-lg shadow-accent-blue/20 hover:shadow-accent-blue/40 transition-shadow duration-250"
            >
              Open Dashboard
              <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              to="/methodology"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-8 py-4 border border-border-default text-text-primary rounded-xl hover:border-accent-blue/50 hover:text-accent-blue text-lg"
            >
              Learn More
            </Link>
          </div>
        </motion.div>
      </section>
    </div>
  )
}
