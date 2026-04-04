import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useInView } from 'framer-motion'
import { TrendingUp, TrendingDown, Minus, Zap, BarChart2, Globe, Shield, ChevronRight, ArrowRight } from 'lucide-react'
import AdBanner from '../components/Layout/AdBanner'
import { useAds } from '../hooks/useAds'
import { subscribe } from '../utils/api'

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
    desc: 'Crypto, commodities, and stocks signals are coming. Forex AI signals are live now — free.',
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
  { pair: 'XAU/USD', dir: 'HOLD', conf: 55, entry: '2341.20' },
  { pair: 'BTC/USD', dir: 'BUY', conf: 82, entry: '67,400' },
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
  const { ads } = useAds()
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
      {/* Hero */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-4">
        {/* Background grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'linear-gradient(rgba(88,166,255,0.15) 1px, transparent 1px), linear-gradient(90deg, rgba(88,166,255,0.15) 1px, transparent 1px)',
            backgroundSize: '50px 50px',
          }}
        />
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-accent-blue/5 blur-3xl pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent-purple/5 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
          {/* Left */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7 }}
          >
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-6"
            >
              <Zap size={12} />
              <span>AI-Powered • LightGBM • Free Forever</span>
            </motion.div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight mb-6">
              <span className="text-text-primary">AI-Powered</span>
              <br />
              <span className="bg-gradient-to-r from-accent-blue via-accent-purple to-accent-green bg-clip-text text-transparent">
                Forex Signals
              </span>
              <br />
              <span className="text-text-primary">Completely Free</span>
            </h1>

            <p className="text-text-secondary text-lg leading-relaxed mb-8 max-w-lg">
              Real-time buy/sell/hold signals for 35 forex pairs — powered by LightGBM trained on 10+ years of market data. Crypto & stocks coming soon. No subscriptions, no paywalls.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link
                to="/forex"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-accent-blue text-bg-primary font-semibold rounded-lg hover:bg-blue-400 transition-all duration-200 group"
              >
                View Live Signals
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </Link>
              <Link
                to="/methodology"
                className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-border-default text-text-primary rounded-lg hover:border-accent-blue/50 hover:text-accent-blue transition-all duration-200"
              >
                Learn Methodology
              </Link>
            </div>
          </motion.div>

          {/* Right — floating signal preview */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.7, delay: 0.2 }}
            className="relative"
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
                    <span>Confidence</span>
                    <span>78%</span>
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

            {/* Floating mini cards */}
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

        {/* Scroll indicator */}
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

      {/* Features */}
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
                  className="bg-bg-card border border-border-default rounded-xl p-6 hover:border-accent-blue/50 transition-all duration-300 group"
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

      {/* Ad slot */}
      <div className="max-w-6xl mx-auto px-4 mb-12">
        <AdBanner placement="inline" ads={ads} />
      </div>

      {/* Live Preview / Subscribe */}
      <section className="py-24 px-4 bg-bg-secondary">
        <div className="max-w-5xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">Live Signal Preview</h2>
            <p className="text-text-secondary">See the latest forex signals — updated in real time.</p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
            {previewSignals.map((s, i) => (
              <motion.div
                key={s.pair}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="bg-bg-card border border-border-default rounded-xl p-4"
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

          {/* Subscribe */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-lg mx-auto text-center"
          >
            <h3 className="text-xl font-bold text-text-primary mb-2">Get Signal Alerts</h3>
            <p className="text-text-secondary text-sm mb-6">Subscribe to receive email alerts when high-confidence signals appear.</p>
            {subStatus === 'success' ? (
              <div className="px-6 py-4 bg-accent-green/10 border border-accent-green/30 rounded-xl text-accent-green font-medium">
                ✓ Subscribed successfully! You'll receive alerts soon.
              </div>
            ) : (
              <form onSubmit={handleSubscribe} className="flex gap-3">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your@email.com"
                  required
                  className="flex-1 px-4 py-3 bg-bg-card border border-border-default rounded-lg text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue transition-colors"
                />
                <button
                  type="submit"
                  disabled={subLoading}
                  className="px-6 py-3 bg-accent-blue text-bg-primary font-semibold rounded-lg hover:bg-blue-400 transition-all disabled:opacity-60"
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

      {/* Stats */}
      <section className="py-24 px-4">
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

      {/* CTA */}
      <section className="py-24 px-4 bg-bg-secondary">
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
            Access all 35 forex pairs with AI-powered signals. No account required. Crypto &amp; stocks coming soon.
          </p>
          <Link
            to="/forex"
            className="inline-flex items-center gap-2 px-8 py-4 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 transition-all duration-200 text-lg group"
          >
            Open Dashboard
            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </motion.div>
      </section>
    </div>
  )
}
