import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, ExternalLink, Globe } from 'lucide-react'

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
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12"
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Brand */}
          <motion.div variants={itemVariants}>
            <Link to="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                <TrendingUp size={16} className="text-white" />
              </div>
              <span className="text-xl font-bold text-text-primary">PiiTrade</span>
            </Link>
            <p className="text-text-secondary text-sm leading-relaxed">
              AI-powered forex signals for 51 trading pairs. Completely free. Powered by LightGBM machine learning.
            </p>
            <div className="flex items-center gap-3 mt-4">
              <a href="#" className="text-text-muted hover:text-accent-blue transition-colors duration-200">
                <ExternalLink size={16} />
              </a>
              <a href="#" className="text-text-muted hover:text-accent-blue transition-colors duration-200">
                <Globe size={16} />
              </a>
            </div>
          </motion.div>

          {/* Links */}
          <motion.div variants={itemVariants}>
            <h4 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider">Navigation</h4>
            <ul className="space-y-2">
              {[
                { label: 'Dashboard', path: '/forex' },
                { label: 'Methodology', path: '/methodology' },
                { label: 'Disclaimer', path: '/disclaimer' },
                { label: 'Login', path: '/login' },
              ].map((l) => (
                <li key={l.path}>
                  <Link to={l.path} className="text-text-secondary hover:text-accent-blue transition-colors duration-200 text-sm hover:translate-x-1 inline-block">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Disclaimer */}
          <motion.div variants={itemVariants}>
            <h4 className="text-text-primary font-semibold mb-4 text-sm uppercase tracking-wider">Risk Warning</h4>
            <p className="text-text-muted text-xs leading-relaxed">
              Trading forex involves significant risk of loss. PiiTrade signals are for informational purposes only and do not constitute financial advice. Past performance does not guarantee future results. Never trade with money you cannot afford to lose.
            </p>
          </motion.div>
        </div>

        <div className="border-t border-border-default mt-8 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <p className="text-text-muted text-xs">© {new Date().getFullYear()} PiiTrade. All rights reserved.</p>
          <p className="text-text-muted text-xs">Not financial advice. Trade responsibly.</p>
        </div>
      </motion.div>
    </footer>
  )
}
