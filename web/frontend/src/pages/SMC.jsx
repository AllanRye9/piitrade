import { motion } from 'framer-motion'
import { BarChart2, Clock } from 'lucide-react'

export default function SMC() {
  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full text-center"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-accent-blue/10 border border-accent-blue/20 mb-6">
          <BarChart2 size={32} className="text-accent-blue" />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold text-text-primary mb-4">
          SMC Analyzer
        </h1>

        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent-yellow/10 border border-accent-yellow/30 text-accent-yellow text-sm font-semibold mb-6">
          <Clock size={14} />
          <span>Coming Soon</span>
        </div>

        <p className="text-text-secondary text-lg leading-relaxed">
          Smart Money Concepts chart analysis is on the way. Upload a chart and
          let AI detect order blocks, fair value gaps, BOS and more — all
          automatically.
        </p>
      </motion.div>
    </div>
  )
}
