import { useState, useEffect } from 'react'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

export default function Admin() {
  const [stats, setStats] = useState(null)
  const [users, setUsers] = useState([])
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('overview')

  const load = () => {
    setLoading(true)
    setError(null)
    Promise.all([
      api.get('/api/admin/stats'),
      api.get('/api/admin/users'),
      api.get('/api/admin/payments'),
    ]).then(([s, u, p]) => {
      setStats(s.data)
      setUsers(u.data.users || [])
      setPayments(p.data.payments || [])
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const statCards = stats ? [
    { label: 'Total Users', value: stats.total_users ?? '—', icon: '👥' },
    { label: 'Active Subscriptions', value: stats.active_subscriptions ?? '—', icon: '✅' },
    { label: 'Total Visitors', value: stats.total_visitors ?? '—', icon: '👁️' },
    { label: 'Visitors Today', value: stats.visitors_today ?? '—', icon: '📅' },
  ] : []

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Admin Panel</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>Platform management</p>
        </div>
        <button onClick={load} className="px-4 py-2 rounded-lg text-sm border hover:border-[var(--accent)] transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          ↻ Refresh
        </button>
      </div>

      {loading ? <LoadingSpinner text="Loading admin data..." /> : error ? <ErrorMessage message={error} onRetry={load} /> : (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {statCards.map(({ label, value, icon }) => (
              <div key={label} className="card text-center">
                <div className="text-2xl mb-1">{icon}</div>
                <div className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            {['overview', 'users', 'payments'].map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all ${
                  tab === t ? 'tab-active' : 'tab-inactive'
                }`}>
                {t}
              </button>
            ))}
          </div>

          {tab === 'users' && (
            <div className="card">
              <h2 className="font-semibold mb-3">Users ({users.length})</h2>
              {users.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No users found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                        {['Username', 'Role', 'Status', 'Joined', 'Subscription'].map(h => (
                          <th key={h} className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium"
                            style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u, i) => (
                        <tr key={i} className="border-b hover:bg-[var(--border)] transition-colors"
                          style={{ borderColor: 'var(--border)' }}>
                          <td className="py-2.5 pr-4 font-medium">{u.username || '—'}</td>
                          <td className="py-2.5 pr-4 capitalize">
                            <span className="text-xs px-2 py-0.5 rounded"
                              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                              {u.role || 'user'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="text-xs px-2 py-0.5 rounded"
                              style={{
                                background: u.active ? 'color-mix(in srgb, var(--buy) 15%, transparent)' : 'var(--border)',
                                color: u.active ? 'var(--buy)' : 'var(--text-muted)',
                              }}>
                              {u.active ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2.5 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                            {u.subscription || 'Free'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'payments' && (
            <div className="card">
              <h2 className="font-semibold mb-3">Payments ({payments.length})</h2>
              {payments.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No payments found</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                        {['User', 'Amount', 'Status', 'Date', 'Method'].map(h => (
                          <th key={h} className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium"
                            style={{ color: 'var(--text-muted)' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((p, i) => (
                        <tr key={i} className="border-b hover:bg-[var(--border)] transition-colors"
                          style={{ borderColor: 'var(--border)' }}>
                          <td className="py-2.5 pr-4">{p.username || '—'}</td>
                          <td className="py-2.5 pr-4 font-mono" style={{ color: 'var(--buy)' }}>
                            {p.amount ? `$${p.amount}` : '—'}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className="text-xs px-2 py-0.5 rounded capitalize"
                              style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
                              {p.status || '—'}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                            {p.date ? new Date(p.date).toLocaleDateString() : '—'}
                          </td>
                          <td className="py-2.5 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>
                            {p.method || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'overview' && stats && (
            <div className="card">
              <h2 className="font-semibold mb-3">Platform Overview</h2>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {Object.entries(stats).map(([key, val]) => (
                  <div key={key} className="flex justify-between py-2 border-b"
                    style={{ borderColor: 'var(--border)' }}>
                    <span className="capitalize" style={{ color: 'var(--text-muted)' }}>
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="font-mono font-medium">{String(val)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
