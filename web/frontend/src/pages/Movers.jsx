import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

const EXCLUSION_REASON_LABELS = {
  no_seed_signal: 'No seeded signal',
  no_price_history: 'No price history',
  insufficient_price_history: 'Insufficient price history',
  invalid_open_price: 'Invalid open price',
  below_threshold: 'Below threshold',
  signal_not_open: 'Signal not open',
  no_reversal_pattern: 'No reversal pattern',
}

function DirectionBadge({ direction }) {
  const d = direction?.toUpperCase()
  const cls = d === 'BUY' ? 'badge-buy' : d === 'SELL' ? 'badge-sell' : 'badge-hold'
  return <span className={`${cls} px-2 py-0.5 rounded text-xs font-bold uppercase`}>{d}</span>
}

function VolatilityBar({ value }) {
  const maxPct = 3
  const width = Math.min(100, (value / maxPct) * 100)
  const color = value > 1.5 ? 'var(--sell)' : value > 0.8 ? 'var(--hold)' : 'var(--buy)'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <div className="h-full rounded-full" style={{ width: `${width}%`, background: color }} />
      </div>
      <span className="text-xs font-mono w-14 text-right" style={{ color }}>
        {value?.toFixed(3)}%
      </span>
    </div>
  )
}

function getExclusionReasonLabel(reason) {
  if (!reason) return 'Filtered out'
  return EXCLUSION_REASON_LABELS[reason] || reason.replace(/_/g, ' ')
}

function ExcludedPairsPanel({ excluded, label }) {
  if (!excluded?.length) return null
  const reasonCounts = excluded.reduce((acc, item) => {
    const key = item?.reason || 'filtered_out'
    acc[key] = (acc[key] || 0) + 1
    return acc
  }, {})
  const sortedReasons = Object.entries(reasonCounts).sort((a, b) => b[1] - a[1])

  return (
    <details className="mt-4 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
      <summary className="cursor-pointer px-3 py-2 text-xs font-semibold uppercase tracking-wide"
        style={{ color: 'var(--text-muted)' }}>
        Excluded Pairs ({excluded.length}) - {label}
      </summary>
      <div className="px-3 pt-2 flex flex-wrap gap-1.5">
        {sortedReasons.map(([reason, count]) => (
          <span
            key={reason}
            className="text-[11px] px-2 py-0.5 rounded-full"
            style={{ background: 'var(--border)', color: 'var(--text-muted)' }}
          >
            {getExclusionReasonLabel(reason)}: {count}
          </span>
        ))}
      </div>
      <div className="px-3 pb-3 pt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
        {excluded.map((item, idx) => (
          <div key={`${item.pair}-${item.reason}-${idx}`}
            className="flex items-center justify-between rounded border px-2.5 py-1.5"
            style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
            <span className="font-mono text-xs font-semibold" style={{ color: 'var(--accent)' }}>{item.pair}</span>
            <span className="text-[11px] px-2 py-0.5 rounded"
              style={{ color: 'var(--text-muted)', background: 'var(--border)' }}>
              {getExclusionReasonLabel(item.reason)}
            </span>
          </div>
        ))}
      </div>
    </details>
  )
}

export default function Movers() {
  const [moversData, setMoversData] = useState(null)
  const [volData, setVolData] = useState(null)
  const [reversals, setReversals] = useState(null)
  const [loadingMov, setLoadingMov] = useState(true)
  const [loadingVol, setLoadingVol] = useState(false)
  const [loadingRev, setLoadingRev] = useState(true)
  const [errorMov, setErrorMov] = useState(null)
  const [errorVol, setErrorVol] = useState(null)
  const [errorRev, setErrorRev] = useState(null)
  const [moversThreshold, setMoversThreshold] = useState(0.2)
  const [timeframe, setTimeframe] = useState('24h')

  const loadMovers = (threshold = moversThreshold) => {
    setLoadingMov(true)
    setErrorMov(null)
    api.get('/api/forex/movers', { params: { threshold } })
      .then(res => setMoversData(res.data))
      .catch(e => setErrorMov(e.message))
      .finally(() => setLoadingMov(false))
  }

  const loadVolatility = (tf = timeframe) => {
    setLoadingVol(true)
    setErrorVol(null)
    api.get('/api/forex/volatile', { params: { timeframe: tf } })
      .then(res => setVolData(res.data))
      .catch(e => setErrorVol(e.message))
      .finally(() => setLoadingVol(false))
  }

  const loadReversals = () => {
    setLoadingRev(true)
    setErrorRev(null)
    api.get('/api/forex/reversals')
      .then(res => setReversals(res.data))
      .catch(e => setErrorRev(e.message))
      .finally(() => setLoadingRev(false))
  }

  useEffect(() => {
    loadMovers()
    loadVolatility()
    loadReversals()
  }, [])

  const moverPairs = moversData?.pairs || []
  const moverExcluded = moversData?.excluded_pairs || []
  const pairs = volData?.pairs || []
  const volatileExcluded = volData?.excluded_pairs || []
  const reversalPairs = reversals?.pairs || []
  const reversalExcluded = reversals?.excluded_pairs || []

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Market Movers</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          Volatile pairs and reversal opportunities
        </p>
      </div>

      {/* Session Movers */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">
            ⚡ Session Movers
            <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
              {moverPairs.length} pairs
            </span>
          </h2>
          <div className="flex gap-2">
            {[0.2, 0.5, 1.0].map(th => (
              <button
                key={th}
                onClick={() => { setMoversThreshold(th); loadMovers(th) }}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  moversThreshold === th ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {th}%+
              </button>
            ))}
          </div>
        </div>

        {loadingMov ? <LoadingSpinner /> : errorMov ? <ErrorMessage message={errorMov} onRetry={() => loadMovers()} /> : (
          moverPairs.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No movers above threshold</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Pair</th>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Change</th>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Pip Move</th>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Direction</th>
                    <th className="pb-2 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Current</th>
                  </tr>
                </thead>
                <tbody>
                  {moverPairs.map((p, i) => (
                    <motion.tr key={p.pair} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b hover:bg-[var(--border)] transition-colors"
                      style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2.5 pr-4 font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
                        {p.pair}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {p.pct_change != null ? `${p.pct_change > 0 ? '+' : ''}${p.pct_change.toFixed(3)}%` : '—'}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{p.pip_move != null ? p.pip_move.toFixed(1) : '—'}</td>
                      <td className="py-2.5 pr-4">
                        <DirectionBadge direction={p.direction} />
                      </td>
                      <td className="py-2.5 font-mono text-xs">{p.current ?? '—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        <ExcludedPairsPanel excluded={moverExcluded} label="session movers" />
      </div>

      {/* Volatile Pairs */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="font-semibold text-lg">
            🌡️ Volatile Pairs
            <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
              {pairs.length} pairs
            </span>
          </h2>
          <div className="flex gap-2">
            {['1h', '4h', '24h'].map(tf => (
              <button
                key={tf}
                onClick={() => { setTimeframe(tf); loadVolatility(tf) }}
                className={`px-3 py-1 rounded text-sm font-medium transition-all ${
                  timeframe === tf ? 'tab-active' : 'tab-inactive'
                }`}
              >
                {tf}
              </button>
            ))}
          </div>
        </div>

        {loadingVol ? <LoadingSpinner /> : errorVol ? <ErrorMessage message={errorVol} onRetry={() => loadVolatility()} /> : (
          pairs.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No data</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left" style={{ borderColor: 'var(--border)' }}>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Pair</th>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium w-40" style={{ color: 'var(--text-muted)' }}>Volatility</th>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Direction</th>
                    <th className="pb-2 pr-4 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Confidence</th>
                    <th className="pb-2 text-xs uppercase tracking-wide font-medium" style={{ color: 'var(--text-muted)' }}>Entry Price</th>
                  </tr>
                </thead>
                <tbody>
                  {pairs.map((p, i) => (
                    <motion.tr key={p.pair} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="border-b hover:bg-[var(--border)] transition-colors"
                      style={{ borderColor: 'var(--border)' }}>
                      <td className="py-2.5 pr-4 font-mono font-bold text-sm" style={{ color: 'var(--accent)' }}>
                        {p.pair}
                      </td>
                      <td className="py-2.5 pr-4 w-40">
                        <VolatilityBar value={p.volatility_pct} />
                      </td>
                      <td className="py-2.5 pr-4">
                        <DirectionBadge direction={p.direction} />
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className="text-xs font-mono">
                          {p.confidence != null ? `${p.confidence?.toFixed(1)}%` : '—'}
                        </span>
                      </td>
                      <td className="py-2.5 font-mono text-xs">{p.entry_price ?? '—'}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        <ExcludedPairsPanel excluded={volatileExcluded} label="volatile scanner" />
      </div>

      {/* Reversals */}
      <div className="card">
        <h2 className="font-semibold text-lg mb-4">
          🔄 Reversal Signals
          <span className="ml-2 text-xs px-2 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
            {reversalPairs.length} pairs
          </span>
        </h2>

        {loadingRev ? <LoadingSpinner /> : errorRev ? <ErrorMessage message={errorRev} onRetry={loadReversals} /> : (
          reversalPairs.length === 0 ? (
            <p className="text-sm py-4 text-center" style={{ color: 'var(--text-muted)' }}>No reversal signals detected</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {reversalPairs.map((r, i) => {
                const isBullish = r.reversal_type?.toLowerCase().includes('bullish')
                return (
                  <motion.div key={r.pair} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="p-4 rounded-lg border hover:border-[var(--accent)] transition-colors"
                    style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{r.pair}</span>
                      <span className="text-lg">{isBullish ? '📈' : '📉'}</span>
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs px-2 py-0.5 rounded font-medium capitalize"
                        style={{
                          color: isBullish ? 'var(--buy)' : 'var(--sell)',
                          background: `color-mix(in srgb, ${isBullish ? 'var(--buy)' : 'var(--sell)'} 15%, transparent)`
                        }}>
                        {r.reversal_type}
                      </span>
                      {r.strength != null && (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          Strength: {r.strength}
                        </span>
                      )}
                    </div>
                    <div className="flex justify-between text-xs mt-2">
                      <span style={{ color: 'var(--text-muted)' }}>Entry</span>
                      <span className="font-mono">{r.entry_price ?? '—'}</span>
                    </div>
                    {r.confidence != null && (
                      <div className="flex justify-between text-xs mt-1">
                        <span style={{ color: 'var(--text-muted)' }}>Confidence</span>
                        <span className="font-mono">{r.confidence?.toFixed(1)}%</span>
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          )
        )}

        <ExcludedPairsPanel excluded={reversalExcluded} label="reversal scanner" />
      </div>
    </div>
  )
}
