import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  TrendingUp, Zap, Globe, BarChart2, Shield, CheckCircle,
  Clock, ArrowRight, BookOpen, Database, Cpu, FileText,
} from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const roadmapPhases = [
  {
    phase: 'Phase 1',
    status: 'live',
    icon: TrendingUp,
    title: 'Forex Signal Hub',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    border: 'border-accent-green/30',
    badge: '✅ Live',
    badgeColor: 'bg-accent-green/10 text-accent-green border-accent-green/30',
    items: [
      '35 major, minor & exotic forex pairs',
      'LightGBM ML model trained on 10+ years of data',
      'BUY / SELL / HOLD signals with confidence scores',
      'Auto-calculated Take Profit & Stop Loss levels',
      'Built-in Risk Calculator for position sizing',
      '11 analysis tools: FVG, S/R breakouts, reversals & more',
      'Real-time price ticker & live market data',
      'Email alert subscription for high-confidence signals',
    ],
  },
  {
    phase: 'Phase 2',
    status: 'coming',
    icon: Globe,
    title: 'Crypto Markets',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    border: 'border-accent-yellow/30',
    badge: '⏳ Coming Soon',
    badgeColor: 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30',
    items: [
      'Bitcoin, Ethereum, Solana, BNB and 30+ crypto pairs',
      'Dedicated crypto ML model trained on 24/7 market data',
      'Cross-asset correlation analysis',
      'On-chain data integration for stronger signals',
      'Crypto volatility rankings & heatmaps',
      'DeFi & altcoin scanner',
    ],
  },
  {
    phase: 'Phase 3',
    status: 'planned',
    icon: BarChart2,
    title: 'Stocks & Commodities',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    border: 'border-accent-purple/30',
    badge: '🔮 Planned',
    badgeColor: 'bg-accent-purple/10 text-accent-purple border-accent-purple/30',
    items: [
      'US & international stock market signals',
      'Commodities: Gold, Silver, Oil, Natural Gas',
      'Earnings calendar & fundamental overlays',
      'Sector rotation scanner',
      'Portfolio-level risk scoring',
      'Multi-asset allocation insights',
    ],
  },
]

const whitepaperSections = [
  {
    icon: Database,
    title: 'Data Pipeline',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    content:
      'Historical OHLCV (Open, High, Low, Close, Volume) data is collected from multiple market data providers spanning 10+ years for each instrument. Data is cleaned, normalised, and validated before feature extraction. Rolling windows are applied to prevent lookahead bias.',
  },
  {
    icon: Zap,
    title: 'Feature Engineering',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
    content:
      'Over 40 technical indicators are computed per candle: RSI (14), MACD (12/26/9), Bollinger Bands, ATR, EMA (9/21/50/200), Stochastic Oscillator, ADX, CCI, Williams %R, OBV, VWAP, and more. Each feature is normalised and lag-shifted to form time-series sequences suitable for the gradient boosting model.',
  },
  {
    icon: Cpu,
    title: 'LightGBM Model',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
    content:
      'PiiTrade uses LightGBM — a gradient-boosted decision tree framework optimised for tabular time-series data. The model is trained to output a 3-class probability distribution (BUY / SELL / HOLD). SHAP-based feature importance is used to iteratively prune low-value features and reduce overfitting. Hyperparameters are tuned via Bayesian optimisation.',
  },
  {
    icon: Shield,
    title: 'Backtesting & Validation',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
    content:
      'Walk-forward backtesting is performed on strictly out-of-sample data to validate model accuracy. A separate held-out test set for each instrument prevents data leakage between training and evaluation. Signals are only published when the model confidence exceeds a calibrated threshold to minimise noise.',
  },
  {
    icon: FileText,
    title: 'Signal Delivery',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
    content:
      'Generated signals are served via a REST API built with FastAPI/Flask. The frontend polls or subscribes to updates, and users receive live BUY/SELL/HOLD predictions with confidence scores, auto-calculated TP/SL levels, and risk-adjusted position sizing recommendations through the built-in Risk Calculator.',
  },
  {
    icon: BookOpen,
    title: 'Transparency & Methodology',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
    content:
      'PiiTrade is committed to full transparency. The complete methodology — from data sourcing to model architecture — is documented publicly. We display confidence scores on every signal so traders understand the model\'s certainty level. We do not trade on our own signals and we never charge for access.',
  },
]

export default function Roadmap() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Hero */}
      <section className="py-20 px-4 bg-bg-secondary border-b border-border-default">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-6">
            <BookOpen size={12} />
            <span>Roadmap &amp; White Paper</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            Our Vision &amp; Technology
          </h1>
          <p className="text-text-secondary text-lg leading-relaxed">
            A transparent look at where PiiTrade is going and how our AI signal engine works under the hood.
          </p>
        </motion.div>
      </section>

      {/* Roadmap phases */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">🗺️ Product Roadmap</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              We&rsquo;re building free, professional-grade AI trading tools — one asset class at a time.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="space-y-6"
          >
            {roadmapPhases.map((phase) => {
              const Icon = phase.icon
              return (
                <motion.div
                  key={phase.phase}
                  variants={itemVariants}
                  className={`bg-bg-card border ${phase.border} rounded-2xl p-6 sm:p-8`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
                    <div className={`w-12 h-12 rounded-xl ${phase.bg} flex items-center justify-center flex-shrink-0`}>
                      <Icon size={24} className={phase.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="text-text-muted text-xs uppercase tracking-widest font-semibold">{phase.phase}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${phase.badgeColor}`}>{phase.badge}</span>
                      </div>
                      <h3 className={`text-xl font-bold ${phase.color}`}>{phase.title}</h3>
                    </div>
                  </div>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {phase.items.map((item) => (
                      <li key={item} className="flex items-start gap-2">
                        <CheckCircle size={15} className={`${phase.color} flex-shrink-0 mt-0.5`} />
                        <span className="text-text-secondary text-sm leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-16 px-4 bg-bg-secondary border-y border-border-default">
        <div className="max-w-3xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-10"
          >
            <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-3">⏱️ Estimated Timeline</h2>
            <p className="text-text-secondary">Rough milestones — we ship when it&rsquo;s ready, not before.</p>
          </motion.div>
          <div className="space-y-4">
            {[
              { period: 'Now', label: 'Phase 1 — Forex Signal Hub', status: 'live', note: '35 pairs, live signals, risk calculator' },
              { period: 'Q3 2025', label: 'Phase 2 — Crypto Markets', status: 'coming', note: 'Bitcoin, Ethereum & 30+ pairs' },
              { period: 'Q1 2026', label: 'Phase 3 — Stocks & Commodities', status: 'planned', note: 'US stocks, gold, oil & more' },
              { period: 'Beyond', label: 'Community Features & API Access', status: 'planned', note: 'Public API, custom alerts & more' },
            ].map((row, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -16 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 bg-bg-card border border-border-default rounded-xl"
              >
                <div className="flex items-center gap-3 sm:w-32 flex-shrink-0">
                  <Clock size={14} className="text-text-muted" />
                  <span className="text-text-muted text-xs font-semibold uppercase">{row.period}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-text-primary text-sm font-semibold">{row.label}</p>
                  <p className="text-text-muted text-xs mt-0.5">{row.note}</p>
                </div>
                <span className={`text-xs font-semibold px-2 py-1 rounded-full border flex-shrink-0 ${
                  row.status === 'live'
                    ? 'bg-accent-green/10 text-accent-green border-accent-green/30'
                    : row.status === 'coming'
                    ? 'bg-accent-yellow/10 text-accent-yellow border-accent-yellow/30'
                    : 'bg-accent-purple/10 text-accent-purple border-accent-purple/30'
                }`}>
                  {row.status === 'live' ? '✅ Live' : row.status === 'coming' ? '⏳ Soon' : '🔮 Planned'}
                </span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* White Paper */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-12"
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">📄 Technical White Paper</h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              How the PiiTrade AI signal engine works — from raw data to actionable trade signals.
            </p>
          </motion.div>

          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6"
          >
            {whitepaperSections.map((section) => {
              const Icon = section.icon
              return (
                <motion.div
                  key={section.title}
                  variants={itemVariants}
                  className="bg-bg-card border border-border-default rounded-xl p-6 hover:border-accent-blue/40 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-lg ${section.bg} flex items-center justify-center mb-4`}>
                    <Icon size={20} className={section.color} />
                  </div>
                  <h3 className="text-text-primary font-semibold text-base mb-3">{section.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{section.content}</p>
                </motion.div>
              )
            })}
          </motion.div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 px-4 bg-bg-secondary border-t border-border-default">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-xl mx-auto text-center"
        >
          <h2 className="text-2xl sm:text-3xl font-bold text-text-primary mb-4">Ready to Start Trading?</h2>
          <p className="text-text-secondary mb-8">
            Phase 1 is live and free. Open the dashboard and start using AI-powered forex signals today.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/forex"
              className="btn-interactive inline-flex items-center justify-center gap-2 px-7 py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 group shadow-lg shadow-accent-blue/20 no-underline"
            >
              Open Dashboard
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
