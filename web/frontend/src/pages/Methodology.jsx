import { motion } from 'framer-motion'
import { Database, Cpu, TrendingUp, AlertTriangle, BookOpen, LineChart } from 'lucide-react'
import PartnerCards from '../components/PartnerCard'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.12 } },
}
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
}

const pipeline = [
  {
    icon: Database,
    title: 'Data Collection',
    desc: 'Historical OHLCV data spanning 10+ years across 51 trading pairs sourced from multiple providers for comprehensive training.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
  {
    icon: LineChart,
    title: 'Feature Engineering',
    desc: 'Over 40 technical indicators computed: RSI, MACD, EMA (9/21/50/200), Bollinger Bands, ATR, Stochastic, ADX, CCI, Williams %R.',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10',
  },
  {
    icon: Cpu,
    title: 'LightGBM Training',
    desc: 'Gradient boosted decision tree model optimized for tabular time-series data with SHAP-based feature importance selection.',
    color: 'text-accent-green',
    bg: 'bg-accent-green/10',
  },
  {
    icon: TrendingUp,
    title: 'Signal Generation',
    desc: 'The model outputs a 3-class probability (BUY/SELL/HOLD) with confidence scores. Signals above the threshold are served in real-time.',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10',
  },
  {
    icon: BookOpen,
    title: 'Backtesting',
    desc: 'Walk-forward backtesting on out-of-sample data to validate accuracy. Separate test sets for each instrument prevent data leakage.',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10',
  },
  {
    icon: AlertTriangle,
    title: 'Risk Controls',
    desc: 'Auto-calculated take profit and stop loss levels based on ATR. Position sizing guidelines integrated into the Risk Calculator.',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10',
  },
]

const features = [
  'RSI (14)', 'MACD (12/26/9)', 'EMA (9/21/50/200)', 'Bollinger Bands', 'ATR (14)',
  'Stochastic Oscillator', 'ADX', 'CCI', 'Williams %R', 'OBV', 'Ichimoku Cloud',
  'Pivot Points', 'FVG Detection', 'CHoCH / BOS', 'Volume Profile',
]

export default function Methodology() {
  return (
    <div className="min-h-screen bg-bg-primary pt-20 pb-16 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm mb-4">
            <Cpu size={12} />
            Under the Hood
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">
            How PiiTrade Works
          </h1>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            A transparent look at the machine learning pipeline powering our AI-generated forex signals.
          </p>
        </motion.div>

        {/* Pipeline */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          className="space-y-4 mb-16"
        >
          {pipeline.map((step, i) => {
            const Icon = step.icon
            return (
              <motion.div
                key={step.title}
                variants={itemVariants}
                className="bg-bg-card border border-border-default rounded-xl p-6 flex gap-4 hover:border-accent-blue/30 transition-all"
              >
                <div className={`w-12 h-12 rounded-xl ${step.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon size={22} className={step.color} />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-text-muted text-xs font-mono">Step {i + 1}</span>
                  </div>
                  <h3 className="text-text-primary font-semibold text-lg mb-1">{step.title}</h3>
                  <p className="text-text-secondary text-sm leading-relaxed">{step.desc}</p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Features */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-bg-card border border-border-default rounded-2xl p-8 mb-16"
        >
          <h2 className="text-2xl font-bold text-text-primary mb-2">Technical Indicators Used</h2>
          <p className="text-text-secondary text-sm mb-6">The model is trained on the following features across multiple timeframes (1H, 4H, 1D):</p>
          <div className="flex flex-wrap gap-2">
            {features.map((f) => (
              <span
                key={f}
                className="px-3 py-1.5 bg-bg-secondary border border-border-default rounded-lg text-sm text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-colors"
              >
                {f}
              </span>
            ))}
          </div>
        </motion.div>

        {/* Limitations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="bg-accent-yellow/5 border border-accent-yellow/20 rounded-2xl p-8 mb-12"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="text-accent-yellow mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-bold text-text-primary mb-3">Known Limitations</h2>
              <ul className="space-y-2 text-text-secondary text-sm leading-relaxed list-disc list-inside">
                <li>The model does not incorporate fundamental analysis or economic news events.</li>
                <li>Accuracy varies across pairs — higher-liquidity pairs (EUR/USD, GBP/USD) tend to perform better.</li>
                <li>Signals are based on historical patterns; past performance does not guarantee future results.</li>
                <li>Black swan events and extreme market conditions can significantly degrade model performance.</li>
                <li>Models are retrained periodically but may drift between updates.</li>
              </ul>
            </div>
          </div>
        </motion.div>

        {/* Partner cards */}
        <div className="pt-4 border-t border-border-default">
          <p className="text-text-muted text-xs uppercase tracking-widest font-semibold mb-3 text-center">Our Partners</p>
          <PartnerCards />
        </div>
      </div>
    </div>
  )
}
