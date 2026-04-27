import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

function TabBar({ tabs, active, onChange }) {
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {tabs.map(t => (
        <button
          key={t.key}
          onClick={() => onChange(t.key)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            active === t.key ? 'tab-active' : 'tab-inactive'
          }`}
        >
          {t.label}
          {t.count != null && (
            <span className="ml-1.5 text-xs opacity-70">({t.count})</span>
          )}
        </button>
      ))}
    </div>
  )
}

function ImpactBadge({ impact }) {
  if (!impact) return null
  const colors = {
    high: 'var(--sell)',
    medium: 'var(--hold)',
    low: 'var(--buy)',
  }
  const color = colors[impact?.toLowerCase()] || 'var(--text-muted)'
  return (
    <span className="text-xs px-2 py-0.5 rounded font-medium uppercase"
      style={{ color, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {impact}
    </span>
  )
}

function FVGScanner() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('approaching')

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/api/forex/fvg-scanner')
      .then(res => setData(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const grouped = data?.grouped || {}
  const tabs = ['approaching', 'reached', 'passed', 'rejected'].map(k => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    count: (grouped[k] || []).length,
  }))

  const items = grouped[tab] || []

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">FVG Scanner</h2>
        <button onClick={load} className="text-xs px-3 py-1 rounded border hover:border-[var(--accent)] transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>↻ Refresh</button>
      </div>
      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} onRetry={load} /> : (
        <>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
          {items.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              No {tab} FVG zones found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                    {['Pair', 'Type', 'High', 'Low', 'Status'].map(h => (
                      <th key={h} className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <motion.tr key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="border-b hover:bg-[var(--border)] transition-colors"
                      style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: 'var(--accent)' }}>
                        {item.pair}
                      </td>
                      <td className="py-2 pr-4 text-xs">{item.type || '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--sell)' }}>{item.high ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--buy)' }}>{item.low ?? '—'}</td>
                      <td className="py-2 text-xs capitalize" style={{ color: 'var(--text-muted)' }}>{item.status || tab}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SRBreakouts() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('soon_touching')

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/api/forex/sr-breakouts')
      .then(res => setData(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const groups = data?.sr_groups || {}
  const tabs = [
    { key: 'soon_touching', label: 'Soon Touching' },
    { key: 'touched', label: 'Touched' },
    { key: 'broke', label: 'Broke' },
  ].map(t => ({ ...t, count: (groups[t.key] || []).length }))

  const items = groups[tab] || []

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">S/R Breakouts</h2>
        <button onClick={load} className="text-xs px-3 py-1 rounded border hover:border-[var(--accent)] transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>↻ Refresh</button>
      </div>
      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} onRetry={load} /> : (
        <>
          <TabBar tabs={tabs} active={tab} onChange={setTab} />
          {items.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              No {tab.replace('_', ' ')} breakouts found
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                    {['Pair', 'Level', 'Type', 'Description'].map(h => (
                      <th key={h} className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium"
                        style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, i) => (
                    <tr key={i} className="border-b hover:bg-[var(--border)] transition-colors"
                      style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2 pr-4 font-mono font-semibold text-xs" style={{ color: 'var(--accent)' }}>
                        {item.pair}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">{item.level ?? '—'}</td>
                      <td className="py-2 pr-4 text-xs capitalize">{item.type || '—'}</td>
                      <td className="py-2 text-xs" style={{ color: 'var(--text-muted)' }}>{item.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function PatternScanner() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [timeframe, setTimeframe] = useState('1h')

  const load = (tf = timeframe) => {
    setLoading(true)
    setError(null)
    api.get('/api/forex/pattern-scanner', { params: { timeframe: tf } })
      .then(res => setData(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const patterns = data?.patterns || []

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-lg">Pattern Scanner</h2>
        <div className="flex gap-2">
          {['30m', '1h', '4h', '1day'].map(tf => (
            <button
              key={tf}
              onClick={() => { setTimeframe(tf); load(tf) }}
              className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                timeframe === tf ? 'tab-active' : 'tab-inactive'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>
      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} onRetry={() => load()} /> : (
        patterns.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            No patterns found for {timeframe}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                  {['Pair', 'Pattern', 'Direction', 'Impact', 'Description'].map(h => (
                    <th key={h} className="pb-2 pr-3 text-xs uppercase tracking-wide font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {patterns.map((p, i) => (
                  <tr key={i} className="border-b hover:bg-[var(--border)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-3 font-mono font-semibold text-xs" style={{ color: 'var(--accent)' }}>
                      {p.pair}
                    </td>
                    <td className="py-2 pr-3 text-xs font-medium">{p.type || p.label || '—'}</td>
                    <td className="py-2 pr-3">
                      {p.direction && (
                        <span className={`text-xs font-bold ${
                          p.direction?.toUpperCase() === 'BULLISH' ? 'text-[var(--buy)]' : 'text-[var(--sell)]'
                        }`}>
                          {p.direction}
                        </span>
                      )}
                    </td>
                    <td className="py-2 pr-3"><ImpactBadge impact={p.impact} /></td>
                    <td className="py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {p.description || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

function EconomicCalendar() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    api.get('/api/forex/economic-calendar')
      .then(res => setData(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])

  const events = data?.events || []

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Economic Calendar</h2>
        <button onClick={load} className="text-xs px-3 py-1 rounded border hover:border-[var(--accent)] transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>↻ Refresh</button>
      </div>
      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} onRetry={load} /> : (
        events.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No upcoming events</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                  {['Time', 'Event', 'Currency', 'Impact', 'Actual', 'Forecast', 'Previous'].map(h => (
                    <th key={h} className="pb-2 pr-3 text-xs uppercase tracking-wide font-medium"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map((ev, i) => (
                  <tr key={i} className="border-b hover:bg-[var(--border)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{ev.time || '—'}</td>
                    <td className="py-2 pr-3 text-xs font-medium">{ev.event || '—'}</td>
                    <td className="py-2 pr-3 font-mono text-xs font-bold" style={{ color: 'var(--accent)' }}>{ev.currency}</td>
                    <td className="py-2 pr-3"><ImpactBadge impact={ev.impact} /></td>
                    <td className="py-2 pr-3 text-xs font-mono" style={{ color: ev.actual ? 'var(--buy)' : 'var(--text-muted)' }}>
                      {ev.actual || '—'}
                    </td>
                    <td className="py-2 pr-3 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{ev.forecast || '—'}</td>
                    <td className="py-2 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>{ev.previous || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  )
}

export default function Advance() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Advanced Analysis</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          FVG Scanner, S/R Breakouts, Pattern Scanner, Economic Calendar
        </p>
      </div>
      <div className="flex flex-col gap-6">
        <FVGScanner />
        <SRBreakouts />
        <PatternScanner />
        <EconomicCalendar />
      </div>
    </div>
  )
}
