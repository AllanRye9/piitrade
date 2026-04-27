import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Profile() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/')
  }

  if (!user) return null

  const isAdmin = user.role === 'admin'

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-6">Profile</h1>

      <div className="flex flex-col gap-4">
        <div className="card">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
              {user.username?.[0]?.toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-lg">{user.username}</div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{
                    background: isAdmin
                      ? 'color-mix(in srgb, var(--accent) 15%, transparent)'
                      : 'color-mix(in srgb, var(--buy) 15%, transparent)',
                    color: isAdmin ? 'var(--accent)' : 'var(--buy)',
                  }}>
                  {user.role || 'user'}
                </span>
              </div>
            </div>
          </div>

          <div className="border-t pt-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex justify-between items-center py-2 text-sm">
              <span style={{ color: 'var(--text-muted)' }}>Username</span>
              <span className="font-medium">{user.username}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm border-t"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Role</span>
              <span className="font-medium capitalize">{user.role || 'user'}</span>
            </div>
            <div className="flex justify-between items-center py-2 text-sm border-t"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Subscription</span>
              <span className="text-xs px-2 py-0.5 rounded font-medium"
                style={{ background: 'color-mix(in srgb, var(--buy) 15%, transparent)', color: 'var(--buy)' }}>
                Free Access
              </span>
            </div>
          </div>
        </div>

        {isAdmin && (
          <Link to="/admin" className="card hover:border-[var(--accent)] transition-colors block">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">Admin Panel</div>
                <div className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Manage users, view stats, and monitor payments
                </div>
              </div>
              <span style={{ color: 'var(--accent)' }}>→</span>
            </div>
          </Link>
        )}

        <button
          onClick={handleLogout}
          className="w-full py-2.5 rounded-lg font-medium text-sm border transition-colors hover:border-[var(--sell)] hover:text-[var(--sell)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}
