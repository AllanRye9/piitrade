import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, TrendingUp } from 'lucide-react'
import { useTheme, THEMES } from '../../context/ThemeContext'

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Dashboard', path: '/forex' },
  { label: 'Methodology', path: '/methodology' },
  { label: 'Disclaimer', path: '/disclaimer' },
]

function ThemePicker() {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = THEMES.find((t) => t.id === theme) || THEMES[0]

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-bg-card border border-border-default hover:border-accent-blue/50 text-sm text-text-secondary hover:text-text-primary transition-all duration-200"
        title="Change theme"
        aria-label="Change theme"
      >
        <span className="text-base leading-none">{current.icon}</span>
        <span className="hidden sm:inline text-xs font-medium">{current.label}</span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 w-36 rounded-xl bg-bg-card border border-border-default shadow-xl z-50 overflow-hidden"
          >
            {THEMES.map((t) => (
              <button
                key={t.id}
                onClick={() => { setTheme(t.id); setOpen(false) }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-sm transition-colors duration-150 ${
                  theme === t.id
                    ? 'bg-accent-blue/10 text-accent-blue font-semibold'
                    : 'text-text-secondary hover:bg-bg-secondary hover:text-text-primary'
                }`}
              >
                <span className="text-base">{t.icon}</span>
                {t.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default function Navbar() {
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [scrollDirection, setScrollDirection] = useState('up')
  const lastScrollY = useRef(0)

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY
      setScrolled(y > 20)
      setScrollDirection(y > lastScrollY.current && y > 80 ? 'down' : 'up')
      lastScrollY.current = y
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  // Lock body scroll when sidebar is open
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  const isCompact = scrolled && scrollDirection === 'down'

  return (
    <>
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.3, 0.55, 1] }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 will-change-transform ${
          scrolled ? 'glass shadow-lg shadow-black/20' : 'bg-transparent'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className={`flex items-center justify-between transition-all duration-300 ${isCompact ? 'h-14' : 'h-16'}`}>
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 group flex-shrink-0">
              <motion.div
                className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center"
                style={{ scale: isCompact ? 0.9 : 1, transition: 'scale 0.3s ease' }}
              >
                <TrendingUp size={16} className="text-white" />
              </motion.div>
              <span className="text-xl font-bold bg-gradient-to-r from-accent-blue via-accent-purple to-accent-blue bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
                PiiTrade
              </span>
            </Link>

            {/* Desktop nav links — hidden on mobile & tablet, shown on lg+ */}
            <div className="hidden lg:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative px-4 py-2 font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-text-primary/5 rounded-lg no-underline ${
                      isCompact ? 'text-xs' : 'text-sm'
                    }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="navbar-underline"
                        className="absolute inset-0 bg-accent-blue/10 rounded-lg"
                        transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                      />
                    )}
                    <span className={`relative z-10 ${isActive ? 'text-accent-blue' : ''}`}>
                      {link.label}
                    </span>
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent-blue rounded-full shadow-[0_0_8px_rgba(88,166,255,0.6)]" />
                    )}
                  </Link>
                )
              })}
            </div>

            {/* Right side: theme picker + hamburger */}
            <div className="flex items-center gap-2">
              <ThemePicker />
              {/* Hamburger — visible on mobile & tablet (below lg) */}
              <motion.button
                onClick={() => setMenuOpen(!menuOpen)}
                whileTap={{ scale: 0.9 }}
                className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all"
                aria-label={menuOpen ? 'Close menu' : 'Open menu'}
              >
                <Menu size={20} />
              </motion.button>
            </div>
          </div>
        </div>
      </motion.nav>

      {/* Sidebar portal — rendered at body level so `fixed` positioning is relative to viewport */}
      {createPortal(
        <AnimatePresence>
          {menuOpen && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.5 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="lg:hidden fixed inset-0 bg-black z-[60]"
                onClick={() => setMenuOpen(false)}
              />

              {/* Sidebar drawer */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ duration: 0.3, ease: [0.34, 1.3, 0.55, 1] }}
                className="lg:hidden fixed top-0 right-0 bottom-0 w-72 z-[70] flex flex-col"
                style={{ background: 'var(--glass-bg, rgba(22,27,34,0.95))', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderLeft: '1px solid var(--glass-border, rgba(48,54,61,0.8))' }}
              >
                {/* Sidebar header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-border-default">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
                      <TrendingUp size={14} className="text-white" />
                    </div>
                    <span className="text-text-primary font-semibold text-sm">Navigation</span>
                  </div>
                  <button
                    onClick={() => setMenuOpen(false)}
                    className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all"
                    aria-label="Close menu"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Sidebar nav links */}
                <nav className="flex-1 px-4 py-4 flex flex-col gap-1 overflow-y-auto">
                  {navLinks.map((link, i) => {
                    const isActive = location.pathname === link.path
                    return (
                      <motion.div
                        key={link.path}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05, duration: 0.2 }}
                      >
                        <Link
                          to={link.path}
                          onClick={() => setMenuOpen(false)}
                          className={`block px-4 py-3 rounded-xl text-sm font-medium transition-colors duration-200 no-underline ${
                            isActive
                              ? 'bg-accent-blue/10 text-accent-blue'
                              : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                          }`}
                        >
                          {link.label}
                        </Link>
                      </motion.div>
                    )
                  })}
                </nav>

                {/* Sidebar footer */}
                <div className="px-5 py-4 border-t border-border-default">
                  <p className="text-text-muted text-xs text-center">PiiTrade © {new Date().getFullYear()}</p>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
