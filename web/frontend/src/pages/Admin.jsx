import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart2, Users, AlertCircle, Globe, Activity,
  CreditCard, RefreshCw, CheckCircle, XCircle, Clock,
  Shield, Database, Eye, TrendingUp, UserCheck, Trash2
} from 'lucide-react'
import {
  getAdminStats, getAdminUsers, getAdminPayments,
  adminSetSubscription, adminDeleteUser, adminApprovePayment
} from '../utils/api'

const TABS = [
  { id: 'overview',  label: 'Overview',   icon: Activity },
  { id: 'users',     label: 'Users',      icon: Users },
  { id: 'analytics', label: 'Analytics',  icon: Globe },
  { id: 'payments',  label: 'Payments',   icon: CreditCard },
]

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-accent-blue border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

function ErrorBox({ msg }) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 bg-accent-red/10 border border-accent-red/30 rounded-xl text-accent-red text-sm">
      <AlertCircle size={14} />
      {msg}
    </div>
  )
}

function Badge({ status }) {
  const map = {
    active:   'bg-accent-green/15 text-accent-green border-accent-green/30',
    inactive: 'bg-text-muted/10 text-text-muted border-text-muted/20',
    pending:  'bg-accent-yellow/15 text-accent-yellow border-accent-yellow/30',
    approved: 'bg-accent-blue/15 text-accent-blue border-accent-blue/30',
    admin:    'bg-accent-purple/15 text-accent-purple border-accent-purple/30',
  }
  return (
    <span className={`px-2 py-0.5 rounded-md text-xs border font-medium ${map[status] ?? map.inactive}`}>
      {status}
    </span>
  )
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, icon: Icon, color, sub }) {
  return (
    <div className="bg-bg-card border border-border-default rounded-xl p-5 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={14} className={color} />
        <span className="text-text-muted text-xs">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value ?? '—'}</p>
      {sub && <p className="text-text-muted text-xs">{sub}</p>}
    </div>
  )
}

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab({ stats, loading, error, onRefresh, lastUpdated }) {
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  if (!stats) return null

  const serverTime = stats.server_time
    ? new Date(stats.server_time).toLocaleTimeString([], { timeZone: 'UTC', timeZoneName: 'short' })
    : '—'

  const cards = [
    { label: 'Total Users',         value: stats.total_users,         icon: Users,      color: 'text-accent-blue',   sub: `${stats.admin_users ?? 0} admin · ${stats.regular_users ?? 0} regular` },
    { label: 'Visitors Today',      value: stats.visitors_today,      icon: Eye,        color: 'text-accent-green',  sub: `${stats.total_visitors ?? 0} total unique visitors` },
    { label: 'Total Page Views',    value: stats.total_page_views,    icon: TrendingUp, color: 'text-accent-purple', sub: `${stats.unique_countries ?? 0} countries` },
    { label: 'Active Subscriptions',value: stats.active_subscriptions,icon: UserCheck,  color: 'text-accent-yellow', sub: `${stats.pending_payments ?? 0} pending payments` },
    { label: 'Forex Pairs',         value: stats.total_pairs,         icon: BarChart2,  color: 'text-accent-blue',   sub: `${stats.cache_entries ?? 0} cache entries` },
    { label: 'Server Time (UTC)',   value: serverTime,                 icon: Clock,      color: 'text-text-secondary',sub: 'live server clock' },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-text-muted text-xs">
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '—'}
        </p>
        <button
          onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-all"
        >
          <RefreshCw size={12} /> Refresh
        </button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => <StatCard key={c.label} {...c} />)}
      </div>
    </div>
  )
}

// ─── Users Tab ────────────────────────────────────────────────────────────────
function UsersTab() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [actionMsg, setActionMsg] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminUsers()
      .then(d => setUsers(d.users ?? []))
      .catch(() => setError('Failed to load users'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const notify = (msg, isError = false) => {
    setActionMsg({ msg, isError })
    setTimeout(() => setActionMsg(null), 3500)
  }

  const handleActivate = async (username) => {
    try {
      await adminSetSubscription(username, 'activate', 'monthly')
      notify(`Activated monthly subscription for ${username}`)
      load()
    } catch { notify('Action failed', true) }
  }

  const handleDeactivate = async (username) => {
    try {
      await adminSetSubscription(username, 'deactivate')
      notify(`Deactivated subscription for ${username}`)
      load()
    } catch { notify('Action failed', true) }
  }

  const handleDelete = async (username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return
    try {
      await adminDeleteUser(username)
      notify(`Deleted ${username}`)
      load()
    } catch (e) { notify(e?.response?.data?.error ?? 'Delete failed', true) }
  }

  const filtered = users.filter(u =>
    u.username?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm border ${actionMsg.isError ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' : 'bg-accent-green/10 border-accent-green/30 text-accent-green'}`}>
          {actionMsg.msg}
        </div>
      )}
      <div className="flex items-center gap-3">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search users..."
          className="flex-1 bg-bg-card border border-border-default rounded-xl px-4 py-2.5 text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue/50 transition-colors"
        />
        <button onClick={load} className="p-2.5 bg-bg-card border border-border-default rounded-xl text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-all">
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="overflow-x-auto rounded-xl border border-border-default">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg-tertiary border-b border-border-default">
              <th className="px-4 py-3 text-left text-text-muted font-medium">Username</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Email</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Role</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Subscription</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Plan</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Expires</th>
              <th className="px-4 py-3 text-left text-text-muted font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u, i) => (
              <tr key={u.username} className={`border-b border-border-subtle last:border-0 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg-secondary'}`}>
                <td className="px-4 py-3 text-text-primary font-medium">{u.username}</td>
                <td className="px-4 py-3 text-text-secondary text-xs">{u.email || '—'}</td>
                <td className="px-4 py-3"><Badge status={u.role} /></td>
                <td className="px-4 py-3"><Badge status={u.subscription_status || 'inactive'} /></td>
                <td className="px-4 py-3 text-text-secondary capitalize">{u.plan || '—'}</td>
                <td className="px-4 py-3 text-text-muted text-xs">{u.subscription_end || '—'}</td>
                <td className="px-4 py-3">
                  {u.role !== 'admin' && (
                    <div className="flex items-center gap-1.5">
                      {u.subscription_status !== 'active' ? (
                        <button
                          onClick={() => handleActivate(u.username)}
                          title="Activate subscription"
                          className="p-1.5 rounded-lg bg-accent-green/10 text-accent-green hover:bg-accent-green/20 transition-colors"
                        >
                          <CheckCircle size={13} />
                        </button>
                      ) : (
                        <button
                          onClick={() => handleDeactivate(u.username)}
                          title="Deactivate subscription"
                          className="p-1.5 rounded-lg bg-accent-yellow/10 text-accent-yellow hover:bg-accent-yellow/20 transition-colors"
                        >
                          <XCircle size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(u.username)}
                        title="Delete user"
                        className="p-1.5 rounded-lg bg-accent-red/10 text-accent-red hover:bg-accent-red/20 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-text-muted text-sm">No users found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-text-muted text-xs">{filtered.length} of {users.length} users</p>
    </div>
  )
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────
function AnalyticsTab({ stats, loading, error }) {
  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  if (!stats) return null

  const topCountries = stats.top_countries ? Object.entries(stats.top_countries) : []
  const maxCount = topCountries.length > 0 ? Math.max(...topCountries.map(([, n]) => n)) : 1

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Visitors"   value={stats.total_visitors}   icon={Users}      color="text-accent-blue"   />
        <StatCard label="Visitors Today"   value={stats.visitors_today}   icon={Eye}        color="text-accent-green"  />
        <StatCard label="Total Page Views" value={stats.total_page_views} icon={TrendingUp} color="text-accent-purple" />
        <StatCard label="Unique Countries" value={stats.unique_countries} icon={Globe}      color="text-accent-yellow" />
      </div>

      {topCountries.length > 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-5">
          <h3 className="text-text-primary font-semibold mb-4 flex items-center gap-2">
            <Globe size={14} className="text-accent-blue" /> Top Countries
          </h3>
          <div className="space-y-3">
            {topCountries.map(([country, count]) => (
              <div key={country} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-text-secondary">{country}</span>
                  <span className="text-text-primary font-medium">{count}</span>
                </div>
                <div className="h-1.5 bg-bg-tertiary rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxCount) * 100}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                    className="h-full bg-accent-blue rounded-full"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {stats.recent_visitors?.length > 0 && (
        <div className="bg-bg-card border border-border-default rounded-xl p-5">
          <h3 className="text-text-primary font-semibold mb-4 flex items-center gap-2">
            <Activity size={14} className="text-accent-green" /> Recent Visitors
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-subtle">
                  <th className="pb-2 text-left text-text-muted font-medium text-xs">IP</th>
                  <th className="pb-2 text-left text-text-muted font-medium text-xs">Country</th>
                  <th className="pb-2 text-left text-text-muted font-medium text-xs">First Seen</th>
                  <th className="pb-2 text-left text-text-muted font-medium text-xs">Last Seen</th>
                  <th className="pb-2 text-left text-text-muted font-medium text-xs">Page Views</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent_visitors.map((v, i) => (
                  <tr key={i} className="border-b border-border-subtle last:border-0">
                    <td className="py-2 text-text-secondary font-mono text-xs">{v.ip}</td>
                    <td className="py-2 text-text-secondary text-xs">{v.country || '—'}</td>
                    <td className="py-2 text-text-muted text-xs">{v.first_seen || '—'}</td>
                    <td className="py-2 text-text-muted text-xs">{v.last_seen || '—'}</td>
                    <td className="py-2 text-accent-blue text-xs font-medium">{v.page_views}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Payments Tab ─────────────────────────────────────────────────────────────
function PaymentsTab() {
  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [actionMsg, setActionMsg] = useState(null)

  const load = useCallback(() => {
    setLoading(true)
    getAdminPayments()
      .then(d => setPayments(d.payments ?? []))
      .catch(() => setError('Failed to load payments'))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const notify = (msg, isError = false) => {
    setActionMsg({ msg, isError })
    setTimeout(() => setActionMsg(null), 3500)
  }

  const handleApprove = async (idx) => {
    try {
      await adminApprovePayment(idx)
      notify('Payment approved and subscription activated')
      load()
    } catch (e) { notify(e?.response?.data?.error ?? 'Approve failed', true) }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />

  const pending = payments.filter(p => p.status === 'pending')
  const approved = payments.filter(p => p.status === 'approved')

  return (
    <div className="space-y-4">
      {actionMsg && (
        <div className={`px-4 py-2.5 rounded-xl text-sm border ${actionMsg.isError ? 'bg-accent-red/10 border-accent-red/30 text-accent-red' : 'bg-accent-green/10 border-accent-green/30 text-accent-green'}`}>
          {actionMsg.msg}
        </div>
      )}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge status="pending" /><span className="text-text-muted text-xs">{pending.length} pending</span>
          <Badge status="approved" /><span className="text-text-muted text-xs">{approved.length} approved</span>
        </div>
        <button onClick={load} className="p-2.5 bg-bg-card border border-border-default rounded-xl text-text-secondary hover:border-accent-blue/50 hover:text-accent-blue transition-all">
          <RefreshCw size={14} />
        </button>
      </div>

      {payments.length === 0 ? (
        <div className="py-12 text-center text-text-muted text-sm">No payment confirmations</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-default">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-bg-tertiary border-b border-border-default">
                <th className="px-4 py-3 text-left text-text-muted font-medium">#</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Email</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Plan</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Status</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Submitted</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Approved At</th>
                <th className="px-4 py-3 text-left text-text-muted font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p, i) => (
                <tr key={p.idx} className={`border-b border-border-subtle last:border-0 ${i % 2 === 0 ? 'bg-bg-card' : 'bg-bg-secondary'}`}>
                  <td className="px-4 py-3 text-text-muted text-xs">{p.idx}</td>
                  <td className="px-4 py-3 text-text-secondary text-xs">{p.email || '—'}</td>
                  <td className="px-4 py-3 text-text-secondary capitalize">{p.plan || '—'}</td>
                  <td className="px-4 py-3"><Badge status={p.status || 'pending'} /></td>
                  <td className="px-4 py-3 text-text-muted text-xs">{p.submitted_at ? new Date(p.submitted_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3 text-text-muted text-xs">{p.approved_at ? new Date(p.approved_at).toLocaleString() : '—'}</td>
                  <td className="px-4 py-3">
                    {p.status === 'pending' && (
                      <button
                        onClick={() => handleApprove(p.idx)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-accent-green/10 text-accent-green border border-accent-green/30 hover:bg-accent-green/20 transition-colors"
                      >
                        <CheckCircle size={12} /> Approve
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Admin ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)
  const [lastUpdated, setLastUpdated] = useState(null)

  const loadStats = useCallback(() => {
    setStatsLoading(true)
    getAdminStats()
      .then(data => { setStats(data); setLastUpdated(Date.now()); setStatsError(null) })
      .catch(() => setStatsError('Failed to load stats'))
      .finally(() => setStatsLoading(false))
  }, [])

  useEffect(() => {
    loadStats()
    const timer = setInterval(loadStats, 30000)
    return () => clearInterval(timer)
  }, [loadStats])

  const pendingCount = stats?.pending_payments ?? 0

  return (
    <div className="min-h-screen bg-bg-primary py-20" style={{ paddingLeft: 'var(--page-margin-x)', paddingRight: 'var(--page-margin-x)' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex items-start justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield size={20} className="text-accent-blue" />
                <h1 className="text-3xl font-bold text-text-primary">Admin Dashboard</h1>
              </div>
              <p className="text-text-secondary text-sm">Real-time platform monitoring &amp; management</p>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 bg-accent-green/10 border border-accent-green/30 rounded-xl">
              <Database size={12} className="text-accent-green" />
              <span className="text-accent-green text-xs font-medium">Live</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const hasBadge = tab.id === 'payments' && pendingCount > 0
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-accent-blue text-bg-primary' : 'bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50'}`}
                >
                  <Icon size={14} />
                  {tab.label}
                  {hasBadge && (
                    <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent-red text-bg-primary text-xs rounded-full flex items-center justify-center font-bold">
                      {pendingCount}
                    </span>
                  )}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="bg-bg-secondary border border-border-default rounded-2xl p-6">
            {activeTab === 'overview' && (
              <OverviewTab
                stats={stats}
                loading={statsLoading}
                error={statsError}
                onRefresh={loadStats}
                lastUpdated={lastUpdated}
              />
            )}
            {activeTab === 'users' && <UsersTab />}
            {activeTab === 'analytics' && (
              <AnalyticsTab
                stats={stats}
                loading={statsLoading}
                error={statsError}
              />
            )}
            {activeTab === 'payments' && <PaymentsTab />}
          </div>
        </motion.div>
      </div>
    </div>
  )
}

