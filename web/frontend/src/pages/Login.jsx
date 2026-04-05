import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { TrendingUp, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const navigate = useNavigate()
  const { login } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [shakeError, setShakeError] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      await login(username, password)
      navigate('/')
    } catch (err) {
      setError(err?.response?.data?.detail || 'Invalid credentials')
      setShakeError(true)
      setTimeout(() => setShakeError(false), 400)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-primary" style={{ paddingLeft: 'var(--page-margin-x)', paddingRight: 'var(--page-margin-x)' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.34, 1.3, 0.55, 1] }}
        className="w-full max-w-md"
      >
        <div className="glass rounded-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4, ease: [0.68, -0.55, 0.265, 1.55] }}
              className="w-14 h-14 rounded-2xl bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center mb-4 glow-blue"
            >
              <TrendingUp size={28} className="text-white" />
            </motion.div>
            <h1 className="text-2xl font-bold text-text-primary">Welcome back</h1>
            <p className="text-text-secondary text-sm mt-1">Sign in to your PiiTrade account</p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex items-center gap-2 px-4 py-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-sm mb-6 ${shakeError ? 'error-shake' : ''}`}
            >
              <AlertCircle size={14} />
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-text-secondary text-sm mb-1 block">Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoComplete="username"
                placeholder="your_username"
                className={`w-full bg-bg-card border border-border-default rounded-xl px-4 py-3 text-text-primary placeholder-text-muted input-animated ${shakeError ? 'error-shake border-accent-red' : ''}`}
              />
            </div>
            <div>
              <label className="text-text-secondary text-sm mb-1 block">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className={`w-full bg-bg-card border border-border-default rounded-xl px-4 py-3 pr-12 text-text-primary placeholder-text-muted input-animated ${shakeError ? 'error-shake border-accent-red' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                >
                  {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-interactive w-full py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Processing...
                </>
              ) : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-text-muted text-sm mt-6">
            <Link to="/" className="text-accent-blue hover:underline">← Back to Home</Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
