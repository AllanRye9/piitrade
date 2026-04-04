import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { BarChart2, Users, Mail, Image, ToggleLeft, ToggleRight, Trash2, Plus, Upload, AlertCircle } from 'lucide-react'
import { getAdminStats, getAds, createAd, deleteAd, toggleAd } from '../utils/api'

const TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2 },
  { id: 'subscribers', label: 'Subscribers', icon: Mail },
  { id: 'ads', label: 'Ads', icon: Image },
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
    { label: 'Subscribers', value: stats.total_subscribers ?? stats.subscribers ?? '—', color: 'text-accent-green', icon: Mail },
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

// ─── Subscribers Tab ──────────────────────────────────────────────────────────
function SubscribersTab() {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    getAdminStats()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <LoadingSpinner />
  const subscribers = stats?.subscriber_list || stats?.subscribers_list || []

  return (
    <div>
      <p className="text-text-secondary text-sm mb-4">Total: <span className="text-accent-green font-semibold">{stats?.total_subscribers ?? subscribers.length}</span></p>
      {subscribers.length === 0 ? (
        <div className="text-center py-12 text-text-muted">No subscriber details available via stats endpoint.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-default">
                {['Email', 'Subscribed At'].map((h) => (
                  <th key={h} className="text-left py-3 px-4 text-text-muted font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subscribers.map((s, i) => (
                <tr key={i} className="border-b border-border-subtle">
                  <td className="py-3 px-4 text-text-primary">{s.email || s}</td>
                  <td className="py-3 px-4 text-text-muted">{s.created_at || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Ads Tab ──────────────────────────────────────────────────────────────────
function AdsTab() {
  const [ads, setAds] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ title: '', link_url: '', placement: 'banner-top', active: true })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState(null)
  const fileInputRef = useRef(null)

  const fetchAds = () => {
    setLoading(true)
    getAds()
      .then(setAds)
      .catch(() => setError('Failed to load ads'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchAds() }, [])

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => setImagePreview(ev.target.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setFormError(null)
    try {
      const fd = new FormData()
      fd.append('title', formData.title)
      fd.append('link_url', formData.link_url)
      fd.append('placement', formData.placement)
      fd.append('active', formData.active ? 'true' : 'false')
      if (imageFile) fd.append('image', imageFile)
      await createAd(fd)
      setShowForm(false)
      setFormData({ title: '', link_url: '', placement: 'banner-top', active: true })
      setImageFile(null)
      setImagePreview(null)
      fetchAds()
    } catch (err) {
      setFormError(err?.response?.data?.detail || 'Failed to create ad')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggle = async (id) => {
    try {
      await toggleAd(id)
      fetchAds()
    } catch { /* ignore */ }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this ad?')) return
    try {
      await deleteAd(id)
      fetchAds()
    } catch { /* ignore */ }
  }

  if (loading) return <LoadingSpinner />
  if (error) return <ErrorBox msg={error} />

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-text-primary font-semibold">Advertisements ({ads.length})</h3>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-accent-blue text-bg-primary text-sm font-semibold rounded-lg hover:bg-blue-400 transition-all"
        >
          <Plus size={14} />
          {showForm ? 'Cancel' : 'Add Ad'}
        </button>
      </div>

      {/* Create ad form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-bg-card border border-accent-blue/30 rounded-xl p-6"
        >
          <h4 className="text-text-primary font-semibold mb-4">New Advertisement</h4>
          {formError && <ErrorBox msg={formError} />}
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-text-secondary text-sm mb-1 block">Title</label>
                <input
                  type="text" value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required placeholder="Ad Title"
                  className="w-full bg-bg-secondary border border-border-default rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm mb-1 block">Link URL</label>
                <input
                  type="url" value={formData.link_url}
                  onChange={(e) => setFormData({ ...formData, link_url: e.target.value })}
                  required placeholder="https://example.com"
                  className="w-full bg-bg-secondary border border-border-default rounded-lg px-4 py-2.5 text-text-primary placeholder-text-muted focus:outline-none focus:border-accent-blue"
                />
              </div>
              <div>
                <label className="text-text-secondary text-sm mb-1 block">Placement</label>
                <select
                  value={formData.placement}
                  onChange={(e) => setFormData({ ...formData, placement: e.target.value })}
                  className="w-full bg-bg-secondary border border-border-default rounded-lg px-4 py-2.5 text-text-primary focus:outline-none focus:border-accent-blue"
                >
                  {['banner-top', 'banner-bottom', 'sidebar', 'inline'].map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3 pt-6">
                <label className="text-text-secondary text-sm">Active</label>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, active: !formData.active })}
                  className={`w-12 h-6 rounded-full transition-all ${formData.active ? 'bg-accent-green' : 'bg-border-default'} relative`}
                >
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all ${formData.active ? 'left-6' : 'left-0.5'}`} />
                </button>
              </div>
            </div>

            {/* Image upload */}
            <div>
              <label className="text-text-secondary text-sm mb-2 block">Ad Image</label>
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border-default rounded-xl p-6 text-center cursor-pointer hover:border-accent-blue/50 transition-colors"
              >
                {imagePreview ? (
                  <img src={imagePreview} alt="preview" className="max-h-32 mx-auto rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-text-muted">
                    <Upload size={24} />
                    <span className="text-sm">Click to upload image</span>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </div>

            <button
              type="submit" disabled={submitting}
              className="w-full py-3 bg-accent-blue text-bg-primary font-semibold rounded-xl hover:bg-blue-400 transition-all disabled:opacity-60"
            >
              {submitting ? 'Creating...' : 'Create Ad'}
            </button>
          </form>
        </motion.div>
      )}

      {/* Ads list */}
      {ads.length === 0 ? (
        <div className="text-center py-12 text-text-muted text-sm">No ads yet. Create your first advertisement.</div>
      ) : (
        <div className="space-y-4">
          {ads.map((ad) => (
            <div key={ad.id} className="bg-bg-card border border-border-default rounded-xl p-4 flex items-center gap-4">
              {ad.image_url && (
                <img src={ad.image_url} alt={ad.title} className="w-20 h-14 object-cover rounded-lg flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-text-primary font-medium truncate">{ad.title || 'Untitled'}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ad.active ? 'bg-accent-green/10 text-accent-green' : 'bg-border-default text-text-muted'}`}>
                    {ad.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-text-muted text-xs truncate">{ad.link_url}</p>
                <p className="text-accent-blue text-xs mt-0.5">{ad.placement}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={() => handleToggle(ad.id)}
                  className="p-2 rounded-lg bg-bg-secondary border border-border-default hover:border-accent-blue/50 transition-colors"
                  title={ad.active ? 'Deactivate' : 'Activate'}
                >
                  {ad.active ? <ToggleRight size={16} className="text-accent-green" /> : <ToggleLeft size={16} className="text-text-muted" />}
                </button>
                <button
                  onClick={() => handleDelete(ad.id)}
                  className="p-2 rounded-lg bg-bg-secondary border border-border-default hover:border-accent-red/50 text-text-muted hover:text-accent-red transition-colors"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main Admin ───────────────────────────────────────────────────────────────
export default function Admin() {
  const [activeTab, setActiveTab] = useState('overview')

  return (
    <div className="min-h-screen bg-bg-primary py-20 px-4">
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
            {activeTab === 'subscribers' && <SubscribersTab />}
            {activeTab === 'ads' && <AdsTab />}
          </div>
        </motion.div>
      </div>
    </div>
  )
}
