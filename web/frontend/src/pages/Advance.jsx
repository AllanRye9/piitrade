import { useState, useEffect, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { normalizeTradingPairInput } from '../utils/forexPairs'

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

function getEventDay(event) {
  return (event?.time || '').split(' ')[0] || '—'
}

function eventMatchesTradingPair(event, value) {
  const normalized = normalizeTradingPairInput(value)
  if (!normalized) return true

  const currency = String(event?.currency || '').toUpperCase()
  if (!currency) return false

  if (normalized.includes('/')) {
    const parts = normalized.split('/').filter(Boolean)
    return parts.includes(currency)
  }

  return normalized === currency
}

function FVGScanner() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [tab, setTab] = useState('approaching')
  const [pairFilter, setPairFilter] = useState('')

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
  const tabs = ['approaching', 'reached', 'rejected'].map(k => ({
    key: k,
    label: k.charAt(0).toUpperCase() + k.slice(1),
    count: (grouped[k] || []).length,
  }))

  const items = (grouped[tab] || []).filter(item =>
    !pairFilter || (item.pair || '').toLowerCase().includes(pairFilter.toLowerCase())
  )

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
          <div className="mb-4">
            <input
              type="text"
              value={pairFilter}
              onChange={e => setPairFilter(e.target.value)}
              placeholder="Filter pair, e.g. BTC/USD"
              className="w-full md:w-64 px-3 py-2 rounded-lg text-sm font-mono border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          {items.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              No {tab} FVG zones found{pairFilter ? ` for "${pairFilter}"` : ''}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                    {['Pair', 'Type', 'Top', 'Bottom', 'Status'].map(h => (
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
                      <td className="py-2 pr-4 text-xs" style={{ color: item.fvg_type === 'bullish' ? 'var(--buy)' : 'var(--sell)' }}>
                        {item.fvg_type || '—'}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--sell)' }}>{item.top ?? '—'}</td>
                      <td className="py-2 pr-4 font-mono text-xs" style={{ color: 'var(--buy)' }}>{item.bottom ?? '—'}</td>
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
  const [pairFilter, setPairFilter] = useState('')

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
  ].map(t => ({ ...t, count: (groups[t.key] || []).length }))

  const items = (groups[tab] || []).filter(item =>
    !pairFilter || (item.pair || '').toLowerCase().includes(pairFilter.toLowerCase())
  )

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
          <div className="mb-4">
            <input
              type="text"
              value={pairFilter}
              onChange={e => setPairFilter(e.target.value)}
              placeholder="Filter pair, e.g. XAU/USD"
              className="w-full md:w-64 px-3 py-2 rounded-lg text-sm font-mono border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
            />
          </div>
          {items.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
              No {tab.replace('_', ' ')} breakouts found{pairFilter ? ` for "${pairFilter}"` : ''}
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
  const [pairFilter, setPairFilter] = useState('')
  const autoRef = useRef(null)

  const load = (tf = timeframe) => {
    setLoading(true)
    setError(null)
    api.get('/api/forex/pattern-scanner', { params: { timeframe: tf } })
      .then(res => setData(res.data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  // Auto-cycle through pairs every 4 seconds when no manual filter is set
  const allPairs = [...new Set((data?.patterns || []).map(p => p.pair))]
  const [highlightedPair, setHighlightedPair] = useState(null)
  const idxRef = useRef(0)

  useEffect(() => {
    if (pairFilter || allPairs.length === 0) {
      setHighlightedPair(null)
      idxRef.current = 0
      return
    }
    autoRef.current = setInterval(() => {
      idxRef.current = (idxRef.current + 1) % allPairs.length
      setHighlightedPair(allPairs[idxRef.current])
    }, 4000)
    return () => clearInterval(autoRef.current)
  }, [data, pairFilter])

  const patterns = (data?.patterns || []).filter(p =>
    !pairFilter || p.pair.toLowerCase().includes(pairFilter.toLowerCase())
  )

  const dirColor = (dir) => {
    const d = dir?.toUpperCase()
    if (d === 'BUY')  return 'var(--buy)'
    if (d === 'SELL') return 'var(--sell)'
    return 'var(--text-muted)'
  }

  const dirRowBg = (dir) => {
    const d = dir?.toUpperCase()
    if (d === 'BUY')  return 'color-mix(in srgb, var(--buy) 6%, transparent)'
    if (d === 'SELL') return 'color-mix(in srgb, var(--sell) 6%, transparent)'
    return 'transparent'
  }

  return (
    <motion.div
      className="card"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="font-semibold text-lg">Pattern Scanner</h2>
        <div className="flex flex-wrap gap-2 items-center">
          {/* Pair filter input */}
          <input
            type="text"
            value={pairFilter}
            onChange={e => setPairFilter(e.target.value)}
            placeholder="Filter pair…"
            className="px-3 py-1 rounded text-sm border outline-none font-mono"
            style={{
              background: 'var(--surface)',
              borderColor: pairFilter ? 'var(--accent)' : 'var(--border)',
              color: 'var(--text)',
              width: '110px',
            }}
          />
          {/* Timeframe buttons */}
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

      {/* Auto-cycling pair highlight badge */}
      <AnimatePresence mode="wait">
        {!pairFilter && highlightedPair && (
          <motion.div
            key={highlightedPair}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.3 }}
            className="mb-3 flex items-center gap-2"
          >
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Spotlight →</span>
            <span className="font-mono font-bold text-sm px-2 py-0.5 rounded"
              style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
              {highlightedPair}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} onRetry={() => load()} /> : (
        patterns.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            No patterns found{pairFilter ? ` for "${pairFilter}"` : ` for ${timeframe}`}
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
                <AnimatePresence>
                  {patterns.map((p, i) => {
                    const isHighlighted = !pairFilter && p.pair === highlightedPair
                    return (
                      <motion.tr
                        key={`${p.pair}-${p.type}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.25 }}
                        className="border-b transition-colors"
                        style={{
                          borderColor: 'var(--border)',
                          background: isHighlighted
                            ? `color-mix(in srgb, var(--accent) 8%, ${dirRowBg(p.direction)})`
                            : dirRowBg(p.direction),
                        }}
                      >
                        <td className="py-2 pr-3 font-mono font-semibold text-xs" style={{ color: 'var(--accent)' }}>
                          {p.pair}
                        </td>
                        <td className="py-2 pr-3 text-xs font-medium">{p.type || p.label || '—'}</td>
                        <td className="py-2 pr-3">
                          {p.direction && (() => {
                            const upperDir = p.direction.toUpperCase()
                            return (
                              <span
                                className="text-xs font-bold px-2 py-0.5 rounded-full"
                                style={{
                                  color: dirColor(p.direction),
                                  background: `color-mix(in srgb, ${dirColor(p.direction)} 15%, transparent)`,
                                }}
                              >
                                {upperDir === 'BUY' ? '▲' : upperDir === 'SELL' ? '▼' : '◆'} {p.direction}
                              </span>
                            )
                          })()}
                        </td>
                        <td className="py-2 pr-3"><ImpactBadge impact={p.impact} /></td>
                        <td className="py-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {p.description || '—'}
                        </td>
                      </motion.tr>
                    )
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )
      )}
    </motion.div>
  )
}

function EconomicCalendar() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [impactFilter, setImpactFilter] = useState('all')
  const [dayFilter, setDayFilter] = useState('all')
  const [pairFilter, setPairFilter] = useState('')

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
  const dayOptions = useMemo(() => [...new Set(events.map(getEventDay).filter(Boolean))], [events])
  const filteredEvents = useMemo(() => (
    events.filter(ev => {
      const impactMatches = impactFilter === 'all' || (ev.impact || '').toLowerCase() === impactFilter
      const dayMatches = dayFilter === 'all' || getEventDay(ev) === dayFilter
      const pairMatches = eventMatchesTradingPair(ev, pairFilter)
      return impactMatches && dayMatches && pairMatches
    })
  ), [dayFilter, events, impactFilter, pairFilter])
  const hasActiveFilters = impactFilter !== 'all' || dayFilter !== 'all' || pairFilter.trim() !== ''

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-lg">Economic Calendar</h2>
        <button onClick={load} className="text-xs px-3 py-1 rounded border hover:border-[var(--accent)] transition-colors"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>↻ Refresh</button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
        <select
          value={impactFilter}
          onChange={e => setImpactFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="all">All impact</option>
          <option value="high">High impact</option>
          <option value="medium">Medium impact</option>
          <option value="low">Low impact</option>
        </select>
        <select
          value={dayFilter}
          onChange={e => setDayFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        >
          <option value="all">All dates / days</option>
          {dayOptions.map(day => (
            <option key={day} value={day}>{day}</option>
          ))}
        </select>
        <input
          type="text"
          value={pairFilter}
          onChange={e => setPairFilter(e.target.value)}
          placeholder="Filter by pair, e.g. GBP/JPY"
          className="md:col-span-2 px-3 py-2 rounded-lg text-sm font-mono border outline-none"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
      </div>
      {hasActiveFilters && (
        <div className="flex justify-end mb-4">
          <button
            onClick={() => {
              setImpactFilter('all')
              setDayFilter('all')
              setPairFilter('')
            }}
            className="text-xs px-3 py-1 rounded border hover:border-[var(--accent)] transition-colors"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
          >
            Clear filters
          </button>
        </div>
      )}
      {loading ? <LoadingSpinner /> : error ? <ErrorMessage message={error} onRetry={load} /> : (
        filteredEvents.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>
            {hasActiveFilters ? 'No events match the current filters' : 'No upcoming events'}
          </p>
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
                {filteredEvents.map((ev, i) => (
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
