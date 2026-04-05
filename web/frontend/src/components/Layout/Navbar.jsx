import { useState, useEffect, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, X, TrendingUp, User } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'

const navLinks = [
  { label: 'Home', path: '/' },
  { label: 'Dashboard', path: '/forex' },
  { label: 'Methodology', path: '/methodology' },
  { label: 'Disclaimer', path: '/disclaimer' },
]

export default function Navbar() {
  const location = useLocation()
  const { user } = useAuth()
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

  const isCompact = scrolled && scrollDirection === 'down'

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{
        duration: 0.5,
        ease: [0.34, 1.3, 0.55, 1],
      }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 will-change-transform ${
        scrolled
          ? 'glass shadow-lg shadow-black/20'
          : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div
          className={`flex items-center justify-between transition-all duration-300 ${
            isCompact ? 'h-14' : 'h-16'
          }`}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <motion.div
              className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center"
              style={{
                scale: isCompact ? 0.9 : 1,
                transition: 'scale 0.3s ease',
              }}
            >
              <TrendingUp size={16} className="text-white" />
            </motion.div>
            <span className="text-xl font-bold bg-gradient-to-r from-accent-blue via-accent-purple to-accent-blue bg-[length:200%_auto] animate-shimmer bg-clip-text text-transparent">
              PiiTrade
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = location.pathname === link.path
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`nav-link relative px-4 py-2 font-medium transition-all duration-200 text-text-secondary hover:text-text-primary hover:bg-text-primary/5 rounded-lg ${
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
                  {/* Active page glow indicator */}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-accent-blue rounded-full shadow-[0_0_8px_rgba(88,166,255,0.6)]" />
                  )}
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card border border-border-default hover:border-accent-blue/50 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 text-sm"
              >
                <User size={14} className="text-accent-blue" />
                <span className="text-text-primary">{user.username || 'Account'}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg bg-accent-blue text-bg-primary text-sm font-semibold hover:bg-blue-400 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <motion.button
            onClick={() => setMenuOpen(!menuOpen)}
            whileTap={{ scale: 0.9 }}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all"
          >
            <motion.div
              animate={{ rotate: menuOpen ? 90 : 0 }}
              transition={{ duration: 0.2 }}
            >
              {menuOpen ? <X size={20} /> : <Menu size={20} />}
            </motion.div>
          </motion.button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <>
            {/* Backdrop overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black top-16 z-40"
              onClick={() => setMenuOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3, ease: [0.34, 1.3, 0.55, 1] }}
              className="md:hidden glass border-t border-border-default overflow-hidden relative z-50"
            >
              <div className="px-4 py-3 flex flex-col gap-1">
                {navLinks.map((link, i) => {
                  const isActive = location.pathname === link.path
                  return (
                    <motion.div
                      key={link.path}
                      initial={{ opacity: 0, x: -12 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05, duration: 0.2 }}
                    >
                      <Link
                        to={link.path}
                        className={`block px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
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
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.2 }}
                  className="pt-2 border-t border-border-default"
                >
                  {user ? (
                    <Link
                      to="/profile"
                      className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-card"
                    >
                      <User size={14} />
                      {user.username || 'Account'}
                    </Link>
                  ) : (
                    <Link
                      to="/login"
                      className="block w-full text-center px-4 py-3 rounded-lg bg-accent-blue text-bg-primary text-sm font-semibold"
                    >
                      Login
                    </Link>
                  )}
                </motion.div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.nav>
  )
}
