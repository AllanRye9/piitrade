import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { User, Mail, Shield, LogOut, Star } from 'lucide-react'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, logout, isAdmin } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-bg-primary py-20 px-4">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-text-primary mb-8">Your Profile</h1>

          <div className="space-y-4">
            {/* User card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-bg-card border border-border-default rounded-2xl p-6"
            >
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent-blue to-accent-purple flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
                  {user?.username?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xl font-bold text-text-primary">{user?.username || 'User'}</h2>
                    {isAdmin && (
                      <span className="px-2 py-0.5 rounded-full bg-accent-purple/10 border border-accent-purple/30 text-accent-purple text-xs font-semibold">
                        Admin
                      </span>
                    )}
                  </div>
                  <p className="text-text-secondary text-sm">{user?.email || 'No email on file'}</p>
                </div>
              </div>
            </motion.div>

            {/* Details */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-bg-card border border-border-default rounded-2xl p-6 space-y-4"
            >
              <h3 className="text-text-primary font-semibold">Account Details</h3>
              {[
                { icon: User, label: 'Username', value: user?.username || '—' },
                { icon: Mail, label: 'Email', value: user?.email || '—' },
                { icon: Shield, label: 'Role', value: user?.role || (isAdmin ? 'Admin' : 'User') },
                { icon: Star, label: 'Member since', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
              ].map((item) => {
                const Icon = item.icon
                return (
                  <div key={item.label} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
                    <Icon size={14} className="text-text-muted flex-shrink-0" />
                    <span className="text-text-secondary text-sm w-28">{item.label}</span>
                    <span className="text-text-primary text-sm font-medium">{item.value}</span>
                  </div>
                )
              })}
            </motion.div>

            {/* Actions */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="flex flex-col sm:flex-row gap-3"
            >
              {isAdmin && (
                <button
                  onClick={() => navigate('/admin')}
                  className="flex items-center justify-center gap-2 px-6 py-3 bg-accent-purple/10 border border-accent-purple/30 text-accent-purple rounded-xl hover:bg-accent-purple/20 transition-all font-medium"
                >
                  <Shield size={16} />
                  Admin Panel
                </button>
              )}
              <button
                onClick={handleLogout}
                className="flex items-center justify-center gap-2 px-6 py-3 bg-accent-red/10 border border-accent-red/30 text-accent-red rounded-xl hover:bg-accent-red/20 transition-all font-medium"
              >
                <LogOut size={16} />
                Sign Out
              </button>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
