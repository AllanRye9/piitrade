import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Users, AlertCircle } from 'lucide-react'
import { getAdminStats } from '../utils/api'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
]

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-12">
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

// ─── Overview Tab ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    setLoading(true)
    getAdminStats()
      .then(setStats)
      .catch(() => setError('Failed to load stats'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />
  if (!stats) return null

  const cards = [
    { label: 'Total Users', value: stats.total_users ?? stats.users ?? '—', color: 'text-accent-blue', icon: Users },
    { label: 'Total Visitors', value: stats.visitors ?? stats.total_visitors ?? '—', color: 'text-accent-purple', icon: BarChart2 },
    { label: 'Cache Health', value: stats.cache_health ?? '—', color: 'text-accent-yellow', icon: BarChart2 },
  ]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => {
          const Icon = c.icon
          return (
            <div key={c.label} className="bg-bg-card border border-border-default rounded-xl p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={c.color} />
                <span className="text-text-muted text-xs">{c.label}</span>
              </div>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </div>
          )
        })}
      </div>
      {stats.top_countries && (
        <div className="bg-bg-card border border-border-default rounded-xl p-5">
          <h3 className="text-text-primary font-semibold mb-4">Top Countries</h3>
          <div className="space-y-2">
            {Object.entries(stats.top_countries).slice(0, 8).map(([country, count]) => (
              <div key={country} className="flex justify-between items-center py-1.5 border-b border-border-subtle last:border-0">
                <span className="text-text-secondary text-sm">{country}</span>
                <span className="text-text-primary font-medium text-sm">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Admin ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen bg-bg-primary py-20" style={{ paddingLeft: 'var(--page-margin-x)', paddingRight: 'var(--page-margin-x)' }}>
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <h1 className="text-3xl font-bold text-text-primary mb-2">Admin Dashboard</h1>
          <p className="text-text-secondary text-sm mb-8">Manage your PiiTrade platform</p>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 flex-wrap">
            {TABS.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id ? 'bg-accent-blue text-bg-primary' : 'bg-bg-card border border-border-default text-text-secondary hover:border-accent-blue/50'}`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              )
            })}
          </div>

          {/* Content */}
          <div className="bg-bg-secondary border border-border-default rounded-2xl p-6">
            {activeTab === 'overview' && <OverviewTab />}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
