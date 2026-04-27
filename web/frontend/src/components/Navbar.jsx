import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../hooks/useTheme'
import { useAuth } from '../hooks/useAuth'

const THEME_ICONS = {
  dark: '🌙',
  ocean: '🌊',
  light: '☀️',
}

export default function Navbar() {
  const { theme, cycleTheme } = useTheme()
  const { user } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const navigate = useNavigate()

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/forex', label: 'Dashboard' },
    { to: '/advance', label: 'Advanced' },
    { to: '/movers', label: 'Movers' },
    { to: '/methodology', label: 'Methodology' },
  ]

  return (
    <nav style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      className="sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2 font-bold text-lg"
            style={{ color: 'var(--accent)' }}>
            <span className="text-2xl">📈</span>
            <span>PiiTrade</span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-[var(--accent)] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-2">
            <button
              onClick={cycleTheme}
              className="p-2 rounded-md text-sm transition-colors hover:bg-[var(--border)]"
              title={`Theme: ${theme}`}
            >
              {THEME_ICONS[theme]}
            </button>

            {user ? (
              <Link
                to="/profile"
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm border"
                style={{ borderColor: 'var(--border)', color: 'var(--text)' }}
              >
                <span className="w-5 h-5 rounded-full bg-[var(--accent)] flex items-center justify-center text-xs font-bold"
                  style={{ color: 'var(--bg)' }}>
                  {user.username?.[0]?.toUpperCase()}
                </span>
                <span>{user.username}</span>
              </Link>
            ) : (
              <Link
                to="/login"
                className="hidden md:block px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
                style={{ background: 'var(--accent)', color: 'var(--bg)' }}
              >
                Login
              </Link>
            )}

            {/* Mobile menu button */}
            <button
              className="md:hidden p-2 rounded-md"
              onClick={() => setMenuOpen(!menuOpen)}
              style={{ color: 'var(--text)' }}
            >
              {menuOpen ? '✕' : '☰'}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="md:hidden overflow-hidden"
            style={{ borderTop: '1px solid var(--border)' }}
          >
            <div className="px-4 py-3 flex flex-col gap-1">
              {navLinks.map(({ to, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={to === '/'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `px-3 py-2 rounded-md text-sm font-medium ${
                      isActive ? 'text-[var(--accent)]' : 'text-[var(--text-muted)]'
                    }`
                  }
                >
                  {label}
                </NavLink>
              ))}
              {user ? (
                <Link to="/profile" onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-md text-sm" style={{ color: 'var(--text)' }}>
                  Profile ({user.username})
                </Link>
              ) : (
                <Link to="/login" onClick={() => setMenuOpen(false)}
                  className="px-3 py-2 rounded-md text-sm font-medium text-center mt-1"
                  style={{ background: 'var(--accent)', color: 'var(--bg)' }}>
                  Login
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  )
}
