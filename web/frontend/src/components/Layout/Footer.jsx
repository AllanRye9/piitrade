import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, ExternalLink, Globe, Shield, BarChart2, BrainCircuit, Clock, Mail, BookOpen, Zap, Target, Newspaper, Activity, Database, Lock } from 'lucide-react'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0 },
}

export default function Footer() {
  return (
    <footer className="bg-bg-secondary border-t border-border-default mt-auto">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10">

          {/* Brand */}
          <motion.div variants={itemVariants} className="lg:col-span-1">
            <Link to="/" className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-xl font-bold text-text-primary">PiiTrade</span>
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed mb-3">
              PiiTrade is a free, AI-driven forex signal platform delivering real-time predictions across
              51 currency pairs. Built on cutting-edge LightGBM machine learning models, we help traders
              make data-informed decisions with confidence.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-2">
              Trusted by thousands of traders worldwide. No subscriptions, no paywalls — just powerful signals.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-2">
              Our platform combines 11 analytical tools — from FVG scanning and S/R breakout detection
              to pattern recognition and news sentiment — giving every trader the edge they need to
              navigate today's fast-moving forex markets.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-4">
              PiiTrade aggregates data from multiple institutional-grade sources including the European
              Central Bank (ECB) Frankfurter API, live RSS news feeds from ForexLive, FXStreet, DailyFX,
              Reuters, and MarketWatch, plus real-time economic calendar events.
            </p>
            <div className="flex items-center gap-3 mt-2">
              <a href="https://www.exness.com/" target="_blank" rel="noopener noreferrer"
                className="text-text-muted hover:text-accent-blue transition-colors duration-200" title="Partner: Exness">
                <ExternalLink size={15} />
              </a>
              <a href="https://piitrade.com" className="text-text-muted hover:text-accent-blue transition-colors duration-200" title="PiiTrade Website">
                <Globe size={15} />
              </a>
              <a href="mailto:support@piitrade.com" className="text-text-muted hover:text-accent-blue transition-colors duration-200" title="Contact us">
                <Mail size={15} />
              </a>
            </div>
          </motion.div>

          {/* Navigation */}
          <motion.div variants={itemVariants}>
            <h4 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
              <BookOpen size={14} className="text-accent-blue" /> Navigation
            </h4>
            <ul className="space-y-2.5">
              {[
                { label: 'Home', path: '/' },
                { label: 'Live Dashboard', path: '/forex' },
                { label: 'Methodology', path: '/methodology' },
                { label: 'Roadmap', path: '/roadmap' },
                { label: 'Disclaimer', path: '/disclaimer' },
                { label: 'Login', path: '/login' },
              ].map((l) => (
                <li key={l.path}>
                  <Link to={l.path}
                    className="text-text-secondary hover:text-accent-blue transition-all duration-200 text-sm hover:translate-x-1 inline-block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>

            <h4 className="text-text-primary font-semibold mt-6 mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
              <Database size={14} className="text-accent-blue" /> Data Sources
            </h4>
            <ul className="space-y-1.5">
              {[
                'ECB Frankfurter API (live rates)',
                'ForexLive RSS Feed',
                'FXStreet News Feed',
                'DailyFX Analysis Feed',
                'Reuters Business News',
                'MarketWatch Forex Feed',
                'ForexFactory Economic Calendar',
              ].map((src) => (
                <li key={src} className="text-text-muted text-xs flex items-start gap-1.5">
                  <span className="text-accent-blue mt-0.5 flex-shrink-0">›</span>
                  {src}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Features */}
          <motion.div variants={itemVariants}>
            <h4 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
              <BrainCircuit size={14} className="text-accent-blue" /> What We Offer
            </h4>
            <ul className="space-y-2.5">
              {[
                { icon: BarChart2,   text: 'AI-Powered Forex Signals' },
                { icon: TrendingUp,  text: '51 Currency Pairs Covered' },
                { icon: Clock,       text: 'Real-Time Market Updates' },
                { icon: Shield,      text: 'Risk Management & Position Sizing' },
                { icon: BrainCircuit,text: 'LightGBM ML Models' },
                { icon: Globe,       text: 'Technical Analysis Suite' },
                { icon: Activity,    text: 'Live Price Structure Chart' },
                { icon: Zap,         text: 'Break of Structure (BOS) Detection' },
                { icon: Target,      text: 'Fair-Value Gap (FVG) Scanner' },
                { icon: TrendingUp,  text: 'Support & Resistance Breakouts' },
                { icon: Globe,       text: 'Change of Character (CHoCH)' },
                { icon: BarChart2,   text: 'High Volume Trade Zones' },
                { icon: Globe,       text: 'Pattern Recognition Scanner' },
                { icon: Newspaper,   text: 'Live Market News & Sentiment' },
                { icon: Clock,       text: 'Economic Calendar Integration' },
                { icon: Lock,        text: 'Secure & Privacy-First' },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-2 text-text-secondary text-sm">
                  <Icon size={13} className="text-accent-blue flex-shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Risk Warning + Mission */}
          <motion.div variants={itemVariants}>
            <h4 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
              <Shield size={14} className="text-red-400" /> Risk Warning
            </h4>
            <p className="text-text-muted text-xs leading-relaxed mb-3">
              Trading forex and CFDs involves significant risk of loss and may not be suitable for all investors.
              Leverage can work against you. PiiTrade signals are for <span className="text-text-secondary font-medium">informational purposes only</span> and
              do not constitute financial advice or investment recommendations.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-3">
              Past performance is not indicative of future results. You should carefully consider your
              investment objectives, level of experience, and risk appetite before investing.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-3">
              Never trade with funds you cannot afford to lose. Seek independent financial advice if necessary.
              PiiTrade does not hold any regulatory licence and is not authorised to provide financial advice.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-4">
              By using this platform you confirm that you have read, understood, and agree to our
              <Link to="/disclaimer" className="text-accent-blue hover:underline ml-1">full disclaimer</Link>.
              All signal outputs are generated by automated machine-learning models and may contain errors.
            </p>

            <h4 className="text-text-primary font-semibold mb-3 text-sm uppercase tracking-wider flex items-center gap-2">
              <Zap size={14} className="text-accent-blue" /> Our Mission
            </h4>
            <p className="text-text-muted text-xs leading-relaxed mb-2">
              PiiTrade was built to democratize access to institutional-grade forex analysis. We believe
              every trader — from beginner to professional — deserves accurate, timely, and intelligible
              market intelligence without paying premium subscription fees.
            </p>
            <p className="text-text-muted text-xs leading-relaxed mb-2">
              We continuously improve our AI models, expand our data sources, and enhance our analytical
              toolkit so that traders can visit daily to acquire, analyze, and research quality forex
              information on a consistent basis.
            </p>
            <p className="text-text-muted text-xs leading-relaxed">
              Our platform is built on transparency — every signal comes with its confidence score,
              data source attribution, and an explanation of what market conditions led to the prediction.
            </p>
          </motion.div>
        </div>

        {/* Partner strip */}
        <motion.div variants={itemVariants} className="border-t border-border-default mt-10 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="text-text-muted text-xs">Proud Partner:</span>
              <a
                href="https://www.exness.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 transition-colors text-xs font-semibold"
              >
                <img src="/img/exness.png" alt="Exness" className="h-5 w-auto object-contain rounded" />
                Exness — Ultra-Low Spreads
                <ExternalLink size={10} className="opacity-60" />
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3 text-text-muted text-xs">
              <span>© {new Date().getFullYear()} PiiTrade. All rights reserved.</span>
              <span className="hidden sm:inline text-border-default">|</span>
              <a href="https://piitrade.com" className="hover:text-accent-blue transition-colors">piitrade.com</a>
              <span className="hidden sm:inline text-border-default">|</span>
              <span>Not financial advice. Trade responsibly.</span>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </footer>
  )
}
