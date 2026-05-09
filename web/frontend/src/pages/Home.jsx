import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

const features = [
  {
    icon: '🤖',
    title: 'AI Signals',
    desc: 'LightGBM ML model generating BUY/SELL/HOLD signals with confidence scores for 35+ pairs.',
  },
  {
    icon: '📊',
    title: 'FVG Scanner',
    desc: 'Fair Value Gap detection — spot approaching, reached, passed, and rejected FVG zones.',
  },
  {
    icon: '📐',
    title: 'S&R Analysis',
    desc: 'Dynamic support and resistance breakout detection with level strength scoring.',
  },
  {
    icon: '📰',
    title: 'Market News',
    desc: 'Real-time forex news with sentiment analysis tagged to relevant currency pairs.',
  },
  {
    icon: '🔍',
    title: 'Pattern Scanner',
    desc: 'Multi-timeframe chart pattern recognition including engulfing, doji, hammer, and more.',
  },
  {
    icon: '🌡️',
    title: 'Volatility Rankings',
    desc: 'Rank pairs by 1h/4h/24h volatility and spot reversal opportunities instantly.',
  },
]

const stats = [
  { label: 'Currency Pairs', value: '35+' },
  { label: 'ML Accuracy (30d)', value: '~68%' },
  { label: 'Training Years', value: '10+' },
  { label: 'Indicators Used', value: '40+' },
]

const sectionReveal = {
  hidden: { opacity: 0, y: 28 },
  visible: { opacity: 1, y: 0 },
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="py-20 px-4 text-center max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6 border"
            style={{ borderColor: 'var(--accent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 10%, transparent)' }}>
            <span className="w-2 h-2 rounded-full bg-[var(--buy)] animate-pulse" />
            Live AI Signals Active
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-5 leading-tight">
            Free AI Forex Signals
            <br />
            <span style={{ color: 'var(--accent)' }}>for Every Trader</span>
          </h1>
          <p className="text-lg md:text-xl mb-8 max-w-2xl mx-auto" style={{ color: 'var(--text-muted)' }}>
            LightGBM machine learning model trained on 10+ years of data, analyzing 40+ technical
            indicators across 35+ currency pairs — completely free.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              to="/forex"
              className="px-8 py-3 rounded-lg font-semibold text-base transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              Open Dashboard →
            </Link>
            <Link
              to="/methodology"
              className="px-8 py-3 rounded-lg font-semibold text-base border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
            >
              How It Works
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Stats Bar */}
      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5 }}
        className="border-y py-5"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
          {stats.map(({ label, value }) => (
            <motion.div
              key={label}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2 }}
            >
              <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
              <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* Feature Cards */}
      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5, delay: 0.08 }}
        className="py-16 px-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-10">Everything You Need to Trade Smarter</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map(({ icon, title, desc }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: i * 0.08 }}
              whileHover={{ y: -6, scale: 1.01 }}
              className="card hover:border-[var(--accent)] transition-colors cursor-default"
            >
              <div className="text-3xl mb-3">{icon}</div>
              <h3 className="font-semibold text-base mb-1.5">{title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </motion.section>

      {/* User Value */}
      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="py-6 px-4 max-w-5xl mx-auto">
        <motion.div className="card" whileHover={{ y: -4 }} transition={{ duration: 0.2 }}>
          <h2 className="text-xl font-bold mb-4">How this helps traders in practice</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <h3 className="font-semibold mb-1">1) Build a daily routine</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Start with high-volatility pairs, confirm structure, then validate entries with risk limits.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">2) Reduce emotional trading</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Use objective data points (signal confidence, S/R, FVG state) instead of impulsive entries.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-1">3) Review and improve</h3>
              <p style={{ color: 'var(--text-muted)' }}>
                Compare outcomes over time and refine position sizing instead of chasing every market move.
              </p>
            </div>
          </div>
        </motion.div>
      </motion.section>

      {/* CTA */}
      <motion.section
        variants={sectionReveal}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        className="py-16 px-4 text-center">
        <motion.div
          className="max-w-2xl mx-auto card"
          whileHover={{ y: -4, scale: 1.01 }}
          transition={{ duration: 0.2 }}
        >
          <h2 className="text-2xl font-bold mb-3">Start Trading with AI Signals Today</h2>
          <p className="mb-6" style={{ color: 'var(--text-muted)' }}>
            No subscription required. Access all signals, scanners, and analysis tools for free.
          </p>
          <Link
            to="/forex"
            className="inline-block px-10 py-3 rounded-lg font-semibold transition-opacity hover:opacity-90"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            Launch Dashboard →
          </Link>
        </motion.div>
      </motion.section>
    </div>
  )
}
