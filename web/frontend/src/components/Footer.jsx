import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
      className="mt-16 py-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div>
            <div className="font-bold text-lg mb-3" style={{ color: 'var(--accent)' }}>
              📈 PiiTrade
            </div>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Free AI-powered forex signals for 35+ currency pairs. LightGBM ML technology.
            </p>
          </div>
          <div>
            <div className="font-semibold mb-3 text-sm uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>Platform</div>
            <div className="flex flex-col gap-2">
              <Link to="/forex" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Dashboard</Link>
              <Link to="/advance" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Advanced Analysis</Link>
              <Link to="/movers" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Market Movers</Link>
              <Link to="/methodology" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Methodology</Link>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-3 text-sm uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>Company</div>
            <div className="flex flex-col gap-2">
              <Link to="/about" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>About</Link>
              <Link to="/blog" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Blog</Link>
              <Link to="/roadmap" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Roadmap</Link>
              <Link to="/contact" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Contact</Link>
            </div>
          </div>
          <div>
            <div className="font-semibold mb-3 text-sm uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}>Legal</div>
            <div className="flex flex-col gap-2">
              <Link to="/disclaimer" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Disclaimer</Link>
              <Link to="/privacy" className="text-sm hover:text-[var(--accent)] transition-colors"
                style={{ color: 'var(--text-muted)' }}>Privacy Policy</Link>
            </div>
          </div>
        </div>
        <div className="border-t pt-6 flex flex-col md:flex-row items-center justify-between gap-3"
          style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} PiiTrade. All rights reserved.
          </p>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            ⚠️ Trading forex involves risk. Signals are for informational purposes only.
          </p>
        </div>
      </div>
    </footer>
  )
}
