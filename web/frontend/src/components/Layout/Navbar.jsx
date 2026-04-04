import { useState, useEffect } from 'react'
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? 'glass shadow-lg shadow-black/20' : 'bg-transparent'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
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
                  className="relative px-4 py-2 text-sm font-medium transition-colors duration-200 text-text-secondary hover:text-text-primary"
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
                </Link>
              )
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            {user ? (
              <Link
                to="/profile"
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-bg-card border border-border-default hover:border-accent-blue/50 transition-all duration-200 text-sm"
              >
                <User size={14} className="text-accent-blue" />
                <span className="text-text-primary">{user.username || 'Account'}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="px-4 py-2 rounded-lg bg-accent-blue text-bg-primary text-sm font-semibold hover:bg-blue-400 transition-all duration-200"
              >
                Login
              </Link>
            )}
          </div>

          {/* Mobile hamburger */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="md:hidden p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-bg-card transition-all"
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden glass border-t border-border-default overflow-hidden"
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map((link) => {
                const isActive = location.pathname === link.path
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                      isActive
                        ? 'bg-accent-blue/10 text-accent-blue'
                        : 'text-text-secondary hover:text-text-primary hover:bg-bg-card'
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              <div className="pt-2 border-t border-border-default">
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
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
