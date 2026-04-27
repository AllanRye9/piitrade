import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'

function DirectionBadge({ direction }) {
  const d = direction?.toUpperCase()
  const cls = d === 'BUY' ? 'badge-buy' : d === 'SELL' ? 'badge-sell' : 'badge-hold'
  return (
    <span className={`${cls} px-3 py-1 rounded-full text-sm font-bold uppercase`}>
      {d === 'BUY' ? '▲ BUY' : d === 'SELL' ? '▼ SELL' : '◆ HOLD'}
    </span>
  )
}

function ConfidenceBar({ value }) {
  const pct = Math.min(100, Math.max(0, value || 0))
  const color = pct >= 70 ? 'var(--buy)' : pct >= 50 ? 'var(--hold)' : 'var(--sell)'
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
        <span>Confidence</span>
        <span style={{ color }}>{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="h-full rounded-full"
          style={{ background: color }}
        />
      </div>
    </div>
  )
}

function PriceRow({ label, value, color }) {
  return (
    <div className="flex justify-between items-center py-2 border-b"
      style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="font-mono font-semibold text-sm" style={{ color: color || 'var(--text)' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function SignalCard({ signal }) {
  if (!signal) return null
  return (
    <div className="card">
      <div className="flex items-start justify-between mb-4">
        <div>
          <DirectionBadge direction={signal.direction} />
          {signal.ai_label && (
            <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
              🤖 {signal.ai_label}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {signal.is_live && (
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: 'color-mix(in srgb, var(--buy) 15%, transparent)', color: 'var(--buy)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--buy)] animate-pulse" />
              LIVE
            </span>
          )}
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {signal.data_source || 'ECB'}
          </span>
        </div>
      </div>

      <ConfidenceBar value={signal.confidence} />

      <div className="mt-4">
        <PriceRow label="Entry Price" value={signal.entry_price} color="var(--accent)" />
        <PriceRow label="Take Profit" value={signal.take_profit} color="var(--buy)" />
        <PriceRow label="Stop Loss" value={signal.stop_loss} color="var(--sell)" />
      </div>

      {signal.accuracy_30d != null && (
        <div className="mt-3 p-2.5 rounded-lg text-xs text-center"
          style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', color: 'var(--text-muted)' }}>
          30-day accuracy: <span className="font-bold" style={{ color: 'var(--accent)' }}>
            {(signal.accuracy_30d * 100).toFixed(1)}%
          </span>
        </div>
      )}

      {signal.generated_at && (
        <p className="text-xs mt-2 text-right" style={{ color: 'var(--text-muted)' }}>
          Generated: {new Date(signal.generated_at).toLocaleString()}
        </p>
      )}
    </div>
  )
}

function TechnicalCard({ tech }) {
  if (!tech) return null
  const sr = tech.support_resistance || {}
  const fvgs = tech.fvg || []
  const bos = tech.bos || []
  const choch = tech.choch || []
  const hvz = tech.high_volume_zones || []

  return (
    <div className="card">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        📐 Technical Analysis
        <span className="text-xs px-2 py-0.5 rounded" style={{ background: 'var(--border)', color: 'var(--text-muted)' }}>
          {tech.pair}
        </span>
      </h3>

      {tech.current_price != null && (
        <div className="mb-3 p-2.5 rounded-lg text-center"
          style={{ background: 'var(--border)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--text-muted)' }}>Current Price</div>
          <div className="font-mono font-bold text-lg" style={{ color: 'var(--accent)' }}>
            {tech.current_price}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 mb-3">
        <div>
          <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--buy)' }}>
            Support
          </div>
          {(sr.support || []).length === 0
            ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None found</p>
            : (sr.support || []).slice(0, 4).map((s, i) => (
              <div key={i} className="font-mono text-xs py-0.5" style={{ color: 'var(--buy)' }}>{s}</div>
            ))}
        </div>
        <div>
          <div className="text-xs font-semibold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--sell)' }}>
            Resistance
          </div>
          {(sr.resistance || []).length === 0
            ? <p className="text-xs" style={{ color: 'var(--text-muted)' }}>None found</p>
            : (sr.resistance || []).slice(0, 4).map((r, i) => (
              <div key={i} className="font-mono text-xs py-0.5" style={{ color: 'var(--sell)' }}>{r}</div>
            ))}
        </div>
      </div>

      {fvgs.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-semibold mb-1.5" style={{ color: 'var(--text-muted)' }}>FVG Zones ({fvgs.length})</div>
          {fvgs.slice(0, 3).map((f, i) => (
            <div key={i} className="flex justify-between text-xs py-0.5 border-b"
              style={{ borderColor: 'var(--border)' }}>
              <span style={{ color: 'var(--text-muted)' }}>{f.type || 'FVG'}</span>
              <span className="font-mono">{f.high} / {f.low}</span>
            </div>
          ))}
        </div>
      )}

      {(bos.length > 0 || choch.length > 0) && (
        <div className="flex gap-3">
          {bos.length > 0 && (
            <div className="flex-1">
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--accent)' }}>BOS ({bos.length})</div>
              {bos.slice(0, 2).map((b, i) => (
                <div key={i} className="text-xs font-mono py-0.5" style={{ color: 'var(--text-muted)' }}>
                  {b.level || b}
                </div>
              ))}
            </div>
          )}
          {choch.length > 0 && (
            <div className="flex-1">
              <div className="text-xs font-semibold mb-1" style={{ color: 'var(--hold)' }}>CHoCH ({choch.length})</div>
              {choch.slice(0, 2).map((c, i) => (
                <div key={i} className="text-xs font-mono py-0.5" style={{ color: 'var(--text-muted)' }}>
                  {c.level || c}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function Forex() {
  const [pairs, setPairs] = useState({ major: [], minor: [], exotic: [], all: [] })
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [signal, setSignal] = useState(null)
  const [tech, setTech] = useState(null)
  const [loadingSignal, setLoadingSignal] = useState(false)
  const [loadingTech, setLoadingTech] = useState(false)
  const [errorSignal, setErrorSignal] = useState(null)
  const [errorTech, setErrorTech] = useState(null)

  useEffect(() => {
    api.get('/api/forex/pairs')
      .then(res => setPairs(res.data))
      .catch(() => {})
  }, [])

  const fetchSignal = useCallback(() => {
    setLoadingSignal(true)
    setErrorSignal(null)
    api.get('/api/forex/signals', { params: { pair: selectedPair } })
      .then(res => setSignal(res.data))
      .catch(e => setErrorSignal(e.message || 'Failed to load signal'))
      .finally(() => setLoadingSignal(false))
  }, [selectedPair])

  const fetchTech = useCallback(() => {
    setLoadingTech(true)
    setErrorTech(null)
    api.get('/api/forex/technical', { params: { pair: selectedPair } })
      .then(res => setTech(res.data))
      .catch(e => setErrorTech(e.message || 'Failed to load technical data'))
      .finally(() => setLoadingTech(false))
  }, [selectedPair])

  useEffect(() => {
    fetchSignal()
    fetchTech()
  }, [fetchSignal, fetchTech])

  const groupedPairs = [
    { label: 'Major', pairs: pairs.major || [] },
    { label: 'Minor', pairs: pairs.minor || [] },
    { label: 'Exotic', pairs: pairs.exotic || [] },
  ].filter(g => g.pairs.length > 0)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold">Forex Dashboard</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            AI-powered signals with technical analysis
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPair}
            onChange={e => setSelectedPair(e.target.value)}
            className="px-3 py-2 rounded-lg text-sm font-mono border outline-none"
            style={{
              background: 'var(--surface)',
              borderColor: 'var(--border)',
              color: 'var(--text)',
            }}
          >
            {groupedPairs.length > 0 ? (
              groupedPairs.map(({ label, pairs: ps }) => (
                <optgroup key={label} label={label}>
                  {ps.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </optgroup>
              ))
            ) : (
              <option value="EUR/USD">EUR/USD</option>
            )}
          </select>
          <button
            onClick={() => { fetchSignal(); fetchTech() }}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ background: 'var(--accent)', color: 'var(--bg)' }}
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Signal */}
        <div>
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            AI Signal — {selectedPair}
          </h2>
          {loadingSignal ? (
            <div className="card"><LoadingSpinner /></div>
          ) : errorSignal ? (
            <div className="card"><ErrorMessage message={errorSignal} onRetry={fetchSignal} /></div>
          ) : (
            <SignalCard signal={signal} />
          )}
        </div>

        {/* Technical */}
        <div>
          <h2 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
            Technical Analysis
          </h2>
          {loadingTech ? (
            <div className="card"><LoadingSpinner /></div>
          ) : errorTech ? (
            <div className="card"><ErrorMessage message={errorTech} onRetry={fetchTech} /></div>
          ) : (
            <TechnicalCard tech={tech} />
          )}
        </div>
      </div>

      {/* Signal History */}
      {signal?.history && signal.history.length > 0 && (
        <div className="mt-6 card">
          <h3 className="font-semibold mb-3">Recent Signal History</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b" style={{ borderColor: 'var(--border)' }}>
                  {['Date', 'Direction', 'Confidence', 'Entry', 'Result'].map(h => (
                    <th key={h} className="pb-2 pr-4 font-medium text-xs uppercase tracking-wide"
                      style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {signal.history.slice(0, 10).map((h, i) => (
                  <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
                    <td className="py-2 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                      {h.date ? new Date(h.date).toLocaleDateString() : '—'}
                    </td>
                    <td className="py-2 pr-4">
                      <DirectionBadge direction={h.direction} />
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs">{h.confidence != null ? `${h.confidence}%` : '—'}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{h.entry_price ?? '—'}</td>
                    <td className="py-2 text-xs" style={{
                      color: h.result === 'win' ? 'var(--buy)' : h.result === 'loss' ? 'var(--sell)' : 'var(--text-muted)'
                    }}>
                      {h.result ?? '—'}
                    </td>
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
