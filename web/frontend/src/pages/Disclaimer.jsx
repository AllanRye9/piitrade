import { motion } from 'framer-motion'
import { AlertTriangle, Scale, BookOpen, DollarSign } from 'lucide-react'

const sections = [
  {
    icon: AlertTriangle,
    title: 'No Financial Advice',
    color: 'text-accent-red',
    bg: 'bg-accent-red/10 border-accent-red/20',
    content: `The information provided by PiiTrade, including all signals, analysis, charts, and commentary, is for informational and educational purposes only. It does not constitute financial, investment, trading, or any other type of professional advice. PiiTrade is not a licensed financial advisor, broker, or investment firm.`,
  },
  {
    icon: DollarSign,
    title: 'Risk of Loss',
    color: 'text-accent-yellow',
    bg: 'bg-accent-yellow/10 border-accent-yellow/20',
    content: `Forex and CFD trading involves a significant risk of loss and may not be suitable for all investors. Leverage can work against you as well as for you. You should never trade with money you cannot afford to lose. Before trading, you should carefully consider your investment objectives, level of experience, and risk appetite. There is a possibility that you could sustain a loss of some or all of your initial investment.`,
  },
  {
    icon: BookOpen,
    title: 'No Guarantee of Accuracy',
    color: 'text-accent-blue',
    bg: 'bg-accent-blue/10 border-accent-blue/20',
    content: `While PiiTrade uses machine learning models trained on historical data, we make no representation or warranty, express or implied, regarding the accuracy, reliability, or completeness of the signals or information provided. Past performance of any trading signal or strategy is not necessarily indicative of future results. Market conditions change, and no model can predict the future with certainty.`,
  },
  {
    icon: Scale,
    title: 'Independent Responsibility',
    color: 'text-accent-purple',
    bg: 'bg-accent-purple/10 border-accent-purple/20',
    content: `Any trading decisions you make are solely your own responsibility. PiiTrade, its owners, developers, affiliates, and employees shall not be liable for any losses, damages, or costs arising from reliance on the information or signals provided. You are strongly encouraged to seek independent financial advice from a qualified professional before making any investment decisions.`,
  },
]

export default function Disclaimer() {
  return (
    <div className="min-h-screen bg-bg-primary pt-20 pb-16" style={{ paddingLeft: 'var(--page-margin-x)', paddingRight: 'var(--page-margin-x)' }}>
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-yellow/10 border border-accent-yellow/20 text-accent-yellow text-sm mb-4">
            <AlertTriangle size={12} />
            Important Notice
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-text-primary mb-4">Disclaimer</h1>
          <p className="text-text-secondary text-lg">
            Please read this disclaimer carefully before using PiiTrade.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-6">
          {sections.map((s, i) => {
            const Icon = s.icon
            return (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
                whileHover={{ y: -4, transition: { duration: 0.25 } }}
                className={`border rounded-2xl p-6 card-hover ${s.bg}`}
              >
                <div className="flex items-start gap-3">
                  <Icon size={20} className={`${s.color} mt-0.5 flex-shrink-0`} />
                  <div>
                    <h2 className={`font-bold text-lg mb-3 ${s.color}`}>{s.title}</h2>
                    <p className="text-text-secondary text-sm leading-relaxed">{s.content}</p>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Legal footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 pt-8 border-t border-border-default text-center"
        >
          <p className="text-text-muted text-xs leading-relaxed max-w-lg mx-auto">
            By using PiiTrade you acknowledge that you have read, understood, and agree to be bound by this disclaimer. PiiTrade reserves the right to update this disclaimer at any time without prior notice. Last updated: {new Date().getFullYear()}.
          </p>
        </motion.div>
      </div>
    </div>
  )
}
