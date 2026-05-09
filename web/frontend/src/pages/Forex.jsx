import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { normalizeTradingPairInput } from '../utils/forexPairs'
import {
  playSessionStart,
  playSessionEnd,
  playEntry,
} from '../utils/sounds'

const MAX_QUICK_PAIRS = 12

// Forex trading sessions in UTC (startH/startM to endH/endM)
const SESSIONS = [
  { name: 'Sydney',   flag: '🇦🇺', startH: 21, startM: 0, endH: 6,  endM: 0,  color: '#58a6ff' },
  { name: 'Tokyo',    flag: '🇯🇵', startH: 0,  startM: 0, endH: 9,  endM: 0,  color: '#a78bfa' },
  { name: 'London',   flag: '🇬🇧', startH: 7,  startM: 0, endH: 16, endM: 0,  color: '#f0883e' },
  { name: 'New York', flag: '🇺🇸', startH: 13, startM: 0, endH: 22, endM: 0,  color: '#3fb950' },
]

// Minutes from 'from' to 'to' going forward in time, wrapping around midnight (1440 min/day)
function minutesForward(from, to) {
  if (to >= from) return to - from
  return 1440 - from + to
}

function getSessionInfo(session, nowMin) {
  const start = session.startH * 60 + session.startM
  const end   = session.endH   * 60 + session.endM
  const crossesMidnight = start > end
  const isActive = crossesMidnight
    ? (nowMin >= start || nowMin < end)
    : (nowMin >= start && nowMin < end)

  if (isActive) {
    const minsLeft = minutesForward(nowMin, end)
    return { status: minsLeft <= 30 ? 'ending' : 'active', minsLeft }
  }
  const minsToStart = minutesForward(nowMin, start)
  return { status: minsToStart <= 30 ? 'starting' : 'inactive', minsToStart }
}

function pad2(n) { return String(n).padStart(2, '0') }

function TradingSessionBanner() {
  const [now, setNow] = useState(() => new Date())
  const timerRef = useRef(null)
  const prevStatesRef = useRef({})

  useEffect(() => {
    timerRef.current = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timerRef.current)
  }, [])

  const utcH   = now.getUTCHours()
  const utcMin = now.getUTCMinutes()
  const utcS   = now.getUTCSeconds()
  const nowMin = utcH * 60 + utcMin
  const timeStr = `${pad2(utcH)}:${pad2(utcMin)}:${pad2(utcS)} UTC`

  const sessions = SESSIONS.map(s => ({ ...s, ...getSessionInfo(s, nowMin) }))
  const activeCount = sessions.filter(s => s.status === 'active' || s.status === 'ending').length
  const hasWarning  = sessions.some(s => s.status === 'ending' || s.status === 'starting')

  // Fire sounds when session state transitions happen
  // Use a stable key (comma-joined statuses) so effect only runs when states change
  const sessionStateKey = sessions.map(s => s.status).join(',')
  useEffect(() => {
    sessions.forEach(s => {
      const prev = prevStatesRef.current[s.name]
      const curr = s.status
      if (prev !== undefined && prev !== curr) {
        const wasActive = prev === 'active' || prev === 'ending'
        const isActive  = curr === 'active' || curr === 'ending'
        if (!wasActive && isActive) playSessionStart()
        if (wasActive && !isActive) playSessionEnd()
      }
      prevStatesRef.current[s.name] = curr
    })
  }, [sessionStateKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 card overflow-hidden"
      style={{ padding: '0.875rem 1.25rem' }}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: label + clock */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{
                background: activeCount > 0 ? 'var(--buy)' : 'var(--text-muted)',
                animation: activeCount > 0 ? 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
              }}
            />
            <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
              Market Sessions
            </span>
          </div>
          <span className="font-mono text-sm font-bold" style={{ color: 'var(--accent)' }}>
            {timeStr}
          </span>
          {activeCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{
                background: 'color-mix(in srgb, var(--buy) 15%, transparent)',
                color: 'var(--buy)',
                border: '1px solid color-mix(in srgb, var(--buy) 30%, transparent)',
              }}>
              {activeCount} open
            </span>
          )}
        </div>

        {/* Right: session chips */}
        <div className="flex flex-wrap gap-2">
          {sessions.map(s => {
            const isActive   = s.status === 'active'
            const isEnding   = s.status === 'ending'
            const isStarting = s.status === 'starting'
            const dim        = s.status === 'inactive'

            const borderColor = isEnding   ? 'var(--sell)'
                               : isStarting ? 'var(--hold)'
                               : isActive   ? s.color
                               : 'var(--border)'
            const bgColor     = isEnding   ? 'color-mix(in srgb, var(--sell) 12%, transparent)'
                               : isStarting ? 'color-mix(in srgb, var(--hold) 12%, transparent)'
                               : isActive   ? `color-mix(in srgb, ${s.color} 12%, transparent)`
                               : 'transparent'
            const textColor   = dim ? 'var(--text-muted)' : 'var(--text)'

            return (
              <motion.div
                key={s.name}
                animate={
                  isEnding   ? { scale: [1, 1.03, 1] } :
                  isStarting ? { scale: [1, 1.02, 1] } :
                  {}
                }
                transition={
                  (isEnding || isStarting)
                    ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' }
                    : {}
                }
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors"
                style={{ borderColor, background: bgColor, color: textColor, opacity: dim ? 0.45 : 1 }}
              >
                <span>{s.flag}</span>
                <span>{s.name}</span>

                {(isActive || isEnding) && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{
                      background: isEnding ? 'var(--sell)' : s.color,
                      animation: 'pulse 1.5s cubic-bezier(0.4,0,0.6,1) infinite',
                    }}
                  />
                )}

                {isEnding && (
                  <span className="font-semibold" style={{ color: 'var(--sell)' }}>
                    ends {s.minsLeft}m
                  </span>
                )}
                {isStarting && (
                  <span className="font-semibold" style={{ color: 'var(--hold)' }}>
                    opens {s.minsToStart}m
                  </span>
                )}
                {isActive && !isEnding && (
                  <span style={{ color: s.color, opacity: 0.8 }}>
                    {Math.floor(s.minsLeft / 60)}h{pad2(s.minsLeft % 60)}m
                  </span>
                )}
              </motion.div>
            )
          })}
        </div>
      </div>

      {/* Warning bar */}
      <AnimatePresence>
        {hasWarning && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-2.5 pt-2.5 border-t flex flex-wrap gap-2"
            style={{ borderColor: 'var(--border)' }}
          >
            {sessions.filter(s => s.status === 'ending').map(s => (
              <span key={s.name} className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'color-mix(in srgb, var(--sell) 12%, transparent)',
                  color: 'var(--sell)',
                  border: '1px solid color-mix(in srgb, var(--sell) 25%, transparent)',
                }}>
                ⚠ {s.name} closing in {s.minsLeft} min
              </span>
            ))}
            {sessions.filter(s => s.status === 'starting').map(s => (
              <span key={s.name} className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: 'color-mix(in srgb, var(--hold) 12%, transparent)',
                  color: 'var(--hold)',
                  border: '1px solid color-mix(in srgb, var(--hold) 25%, transparent)',
                }}>
                🕐 {s.name} opens in {s.minsToStart} min
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

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

function PriceRow({ label, value, color, filled, fillLabel }) {
  return (
    <div className="flex justify-between items-center py-2 border-b"
      style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center gap-1.5">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
        {filled != null && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-xs px-1.5 py-0.5 rounded font-semibold"
            style={{
              background: filled
                ? 'color-mix(in srgb, var(--buy) 18%, transparent)'
                : 'color-mix(in srgb, var(--sell) 18%, transparent)',
              color: filled ? 'var(--buy)' : 'var(--sell)',
              animation: filled ? 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite' : 'none',
            }}
          >
            {filled ? `✓ ${fillLabel || 'Filled'}` : `✗ ${fillLabel || 'Open'}`}
          </motion.span>
        )}
      </div>
      <span className="font-mono font-semibold text-sm" style={{ color: color || 'var(--text)' }}>
        {value ?? '—'}
      </span>
    </div>
  )
}

function SignalCard({ signal }) {
  const prevKeyRef = useRef(null)
  const signalKey = signal ? `${signal.generated_at}-${signal.direction}` : null

  useEffect(() => {
    if (!signal || signalKey === prevKeyRef.current) return
    prevKeyRef.current = signalKey
    const d = signal.direction?.toUpperCase()
    if (d === 'BUY' || d === 'SELL') playEntry()
  }, [signal, signalKey])

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
        <PriceRow label="Entry Price" value={signal.entry_price} color="var(--accent)" filled={true} fillLabel="Active" />
        <PriceRow label="Take Profit" value={signal.take_profit} color="var(--buy)" />
        <PriceRow label="Stop Loss"   value={signal.stop_loss}   color="var(--sell)" />
      </div>

      {signal.accuracy_30d != null && (
        <div className="mt-3 p-2.5 rounded-lg text-xs text-center"
          style={{ background: 'color-mix(in srgb, var(--accent) 8%, transparent)', color: 'var(--text-muted)' }}>
          30-day accuracy: <span className="font-bold" style={{ color: 'var(--accent)' }}>
            {Number(signal.accuracy_30d).toFixed(1)}%
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

function UpcomingSignalCard({ pair, signal, onRefresh }) {
  const outcomeLabels = {
    take_profit: 'take profit',
    stop_loss: 'stop loss',
  }
  const outcomeLabel = outcomeLabels[signal?.signal_outcome] || 'its target'
  const lastDirection = signal?.issued_direction?.toUpperCase()

  return (
    <div className="card">
      <LoadingSpinner text={`Preparing the next AI setup for ${pair}...`} />
      <div className="mt-2 text-center space-y-2">
        <p className="text-sm font-medium">
          The last {lastDirection || 'AI'} signal has already closed at {outcomeLabel}.
        </p>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          A fresh unfilled signal will appear here as soon as the next setup is ready.
        </p>
        <button
          onClick={onRefresh}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ background: 'var(--accent)', color: 'var(--bg)' }}
        >
          Check again
        </button>
      </div>
    </div>
  )
}

function TechnicalCard({ tech }) {
  if (!tech) return null
  const sr = tech.support_resistance || {}
  const fvgs = (tech.fvg || []).filter(f => !f.filled)
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
              <span style={{ color: f.type === 'bullish' ? 'var(--buy)' : 'var(--sell)' }}>
                {f.type || 'FVG'}{f.filled ? ' (filled)' : ''}
              </span>
              <span className="font-mono">{f.top} / {f.bottom}</span>
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

function AIAnalysisPanel({ pair, signal, tech, news, calendarEvents, loading }) {
  const currencies = pair ? pair.split('/').filter(Boolean) : []

  const relatedNews = useMemo(() => {
    if (!news || !news.length) return []
    return news.filter(n => {
      const text = `${n.headline} ${n.summary}`.toUpperCase()
      return currencies.some(c => text.includes(c))
    }).slice(0, 4)
  }, [news, currencies])

  const relatedEvents = useMemo(() => {
    if (!calendarEvents || !calendarEvents.length) return []
    return calendarEvents.filter(ev => {
      const cur = (ev.currency || '').toUpperCase()
      return currencies.includes(cur)
    }).slice(0, 6)
  }, [calendarEvents, currencies])

  const aiSummary = useMemo(() => {
    if (!signal) return null
    const dir = (signal.direction || 'HOLD').toUpperCase()
    const conf = Number(signal.confidence || 50).toFixed(1)
    const sr = tech?.support_resistance || {}
    const supportLevels = (sr.support || []).slice(0, 2)
    const resistanceLevels = (sr.resistance || []).slice(0, 2)
    const highEvents = (relatedEvents || []).filter(e => (e.impact || '').toLowerCase() === 'high')

    let lines = []

    if (dir === 'BUY') {
      lines.push(`📈 The AI model signals a BUY opportunity on ${pair} with ${conf}% confidence, indicating bullish momentum in current market conditions.`)
    } else if (dir === 'SELL') {
      lines.push(`📉 The AI model signals a SELL setup on ${pair} with ${conf}% confidence, reflecting bearish pressure in the current structure.`)
    } else {
      lines.push(`◆ The AI model is neutral on ${pair} (${conf}% confidence). The market lacks a clear directional bias at this time.`)
    }

    if (supportLevels.length > 0) {
      lines.push(`🔵 Key support is identified near ${supportLevels.join(', ')} — watch for price reactions at these levels.`)
    }
    if (resistanceLevels.length > 0) {
      lines.push(`🔴 Resistance sits around ${resistanceLevels.join(', ')} — a break above could accelerate the move.`)
    }
    if (highEvents.length > 0) {
      const eventNames = highEvents.map(e => e.event).join(', ')
      lines.push(`⚠️ High-impact news upcoming: ${eventNames}. Consider reducing position size or waiting for the release.`)
    } else {
      lines.push(`✅ No high-impact economic events are currently scheduled for these currencies — cleaner technical conditions.`)
    }

    const sentiments = (relatedNews || []).map(n => n.sentiment).filter(Boolean)
    const bullish = sentiments.filter(s => s === 'bullish').length
    const bearish = sentiments.filter(s => s === 'bearish').length
    if (bullish > bearish) {
      lines.push(`📰 News sentiment for ${currencies.join('/')} is predominantly bullish, supporting the technical outlook.`)
    } else if (bearish > bullish) {
      lines.push(`📰 News sentiment for ${currencies.join('/')} leans bearish — fundamental headwinds may add selling pressure.`)
    } else if (sentiments.length > 0) {
      lines.push(`📰 News sentiment is mixed — monitor headlines closely before executing.`)
    }

    return lines
  }, [signal, tech, relatedNews, relatedEvents, pair, currencies])

  if (loading) return <div className="card"><LoadingSpinner /></div>
  if (!signal && !tech) return null

  return (
    <motion.div
      className="card mb-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <span className="text-xl">🤖</span>
        <h2 className="font-bold text-base">AI-Powered Analysis — {pair}</h2>
        <span className="text-xs px-2 py-0.5 rounded-full font-medium ml-auto"
          style={{ background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
          Fundamental + Technical
        </span>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="mb-5 p-4 rounded-lg border-l-4"
          style={{ background: 'color-mix(in srgb, var(--accent) 6%, transparent)', borderColor: 'var(--accent)' }}>
          <div className="space-y-2">
            {aiSummary.map((line, i) => (
              <p key={i} className="text-sm leading-relaxed">{line}</p>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Related News */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--text-muted)' }}>
            📰 Fundamental News ({relatedNews.length})
          </h3>
          {relatedNews.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No recent news for {pair} currencies.</p>
          ) : (
            <div className="space-y-2">
              {relatedNews.map((n, i) => {
                const sentColor = n.sentiment === 'bullish' ? 'var(--buy)' : n.sentiment === 'bearish' ? 'var(--sell)' : 'var(--text-muted)'
                return (
                  <a key={i} href={n.url} target="_blank" rel="noopener noreferrer"
                    className="block p-2.5 rounded-lg border transition-colors hover:border-[var(--accent)]"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-medium leading-snug line-clamp-2">{n.headline}</p>
                      <span className="text-xs font-semibold shrink-0 capitalize"
                        style={{ color: sentColor }}>
                        {n.sentiment || '—'}
                      </span>
                    </div>
                    <div className="flex gap-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span>{n.source}</span>
                      {n.published_at && <span>· {n.published_at}</span>}
                    </div>
                  </a>
                )
              })}
            </div>
          )}
        </div>

        {/* Related Economic Events */}
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide mb-3"
            style={{ color: 'var(--text-muted)' }}>
            📅 Upcoming Events ({relatedEvents.length})
          </h3>
          {relatedEvents.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No upcoming events for {currencies.join('/')}.</p>
          ) : (
            <div className="space-y-2">
              {relatedEvents.map((ev, i) => {
                const impact = (ev.impact || '').toLowerCase()
                const impactColor = impact === 'high' ? 'var(--sell)' : impact === 'medium' ? '#3b82f6' : 'var(--text-muted)'
                return (
                  <div key={i} className="p-2.5 rounded-lg border"
                    style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium truncate mr-2">{ev.event}</span>
                      <span className="text-xs font-bold shrink-0 uppercase"
                        style={{ color: impactColor }}>
                        {ev.impact}
                      </span>
                    </div>
                    <div className="flex gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{ev.currency}</span>
                      <span>{ev.time}</span>
                      {ev.forecast && <span>Fcst: {ev.forecast}</span>}
                      {ev.previous && <span>Prev: {ev.previous}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  )
}

export default function Forex() {
  const [pairs, setPairs] = useState({ major: [], minor: [], exotic: [], all: [] })
  const [selectedPair, setSelectedPair] = useState('EUR/USD')
  const [pairInput, setPairInput] = useState('EUR/USD')
  const [pairInputError, setPairInputError] = useState('')
  const [signal, setSignal] = useState(null)
  const [tech, setTech] = useState(null)
  const [news, setNews] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [loadingSignal, setLoadingSignal] = useState(false)
  const [loadingTech, setLoadingTech] = useState(false)
  const [errorSignal, setErrorSignal] = useState(null)
  const [errorTech, setErrorTech] = useState(null)
  // Popup state — analysis is only shown when user clicks Analyze Pair
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false)
  const [showAllPairs, setShowAllPairs] = useState(false)
  const [analyzedPair, setAnalyzedPair] = useState(null)

  useEffect(() => {
    api.get('/api/forex/pairs')
      .then(res => {
        const nextPairs = res.data
        setPairs(nextPairs)
      })
      .catch(() => {})
    api.get('/api/forex/news')
      .then(res => setNews(res.data?.news || []))
      .catch(() => {})
    api.get('/api/forex/economic-calendar')
      .then(res => setCalendarEvents(res.data?.events || []))
      .catch(() => {})
  }, [])

  const fetchSignalForPair = useCallback((pair) => {
    setLoadingSignal(true)
    setErrorSignal(null)
    api.get('/api/forex/signals', { params: { pair } })
      .then(res => setSignal(res.data))
      .catch(e => setErrorSignal(e.message || 'Failed to load signal'))
      .finally(() => setLoadingSignal(false))
  }, [])

  const fetchTechForPair = useCallback((pair) => {
    setLoadingTech(true)
    setErrorTech(null)
    api.get('/api/forex/technical', { params: { pair } })
      .then(res => setTech(res.data))
      .catch(e => setErrorTech(e.message || 'Failed to load technical data'))
      .finally(() => setLoadingTech(false))
  }, [])

  const availablePairs = useMemo(() => pairs.all || [], [pairs.all])

  const groupedPairs = [
    { label: 'Major', pairs: pairs.major || [] },
    { label: 'Minor', pairs: pairs.minor || [] },
    { label: 'Exotic', pairs: pairs.exotic || [] },
  ].filter(g => g.pairs.length > 0)
  const quickPairs = useMemo(() => (availablePairs || []).slice(0, MAX_QUICK_PAIRS), [availablePairs])

  const runPairAnalysis = useCallback(() => {
    const normalizedPair = normalizeTradingPairInput(pairInput)
    if (!normalizedPair) {
      setPairInputError('Enter a trading pair such as GBP/JPY.')
      return
    }
    if (availablePairs.length > 0 && !availablePairs.includes(normalizedPair)) {
      setPairInputError('That trading pair is not supported on the dashboard yet.')
      return
    }
    setPairInput(normalizedPair)
    setPairInputError('')
    setSelectedPair(normalizedPair)
    setAnalyzedPair(normalizedPair)
    setSignal(null)
    setTech(null)
    setShowAnalysisPopup(true)
    setShowAllPairs(false)
    fetchSignalForPair(normalizedPair)
    fetchTechForPair(normalizedPair)
  }, [availablePairs, fetchSignalForPair, fetchTechForPair, pairInput])

  const closePopup = useCallback(() => {
    setShowAnalysisPopup(false)
  }, [])

  // Close popup on Escape key
  useEffect(() => {
    if (!showAnalysisPopup) return
    const handler = (e) => { if (e.key === 'Escape') closePopup() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [showAnalysisPopup, closePopup])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <TradingSessionBanner />

      {/* AI-Powered Pair Analysis Search */}
      <div className="mb-6 rounded-xl border overflow-hidden"
        style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}>
        {/* Header bar */}
        <div className="px-5 py-3 border-b flex items-center gap-2"
          style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }}>
          <span className="text-base">🤖</span>
          <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>AI-Powered Pair Analysis</span>
          <span className="text-xs ml-2 px-2 py-0.5 rounded-full"
            style={{ background: 'color-mix(in srgb, var(--buy) 15%, transparent)', color: 'var(--buy)' }}>
            ● Live
          </span>
        </div>
        {/* Search area */}
        <div className="p-5">
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Enter any forex pair to get a full technical + fundamental AI analysis including signals, support/resistance, news, and market events.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-base select-none">🔍</span>
              <input
                type="text"
                value={pairInput}
                onChange={e => {
                  setPairInput(e.target.value)
                  if (pairInputError) setPairInputError('')
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') runPairAnalysis()
                }}
                placeholder="e.g. EUR/USD, GBP/JPY, USD/JPY…"
                className="w-full pl-9 pr-4 py-3 rounded-xl text-sm font-mono border-2 outline-none transition-colors"
                style={{
                  background: 'var(--bg)',
                  borderColor: pairInputError ? 'var(--sell)' : 'color-mix(in srgb, var(--accent) 40%, var(--border))',
                  color: 'var(--text)',
                }}
              />
            </div>
            <motion.button
              onClick={runPairAnalysis}
              whileTap={{ scale: 0.97 }}
              className="px-6 py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-85 flex items-center gap-2 justify-center shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--bg)' }}
            >
              <span>Analyze Pair</span>
              <span>→</span>
            </motion.button>
          </div>
          {pairInputError && (
            <p className="text-xs mt-2 flex items-center gap-1" style={{ color: 'var(--sell)' }}>
              <span>⚠</span> {pairInputError}
            </p>
          )}
          {/* Quick pair chips */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {quickPairs.length > 0
              ? quickPairs.map(p => (
                <button
                  key={p}
                  onClick={() => { setPairInput(p); setPairInputError('') }}
                  className="px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{
                    borderColor: pairInput === p ? 'var(--accent)' : 'var(--border)',
                    color: pairInput === p ? 'var(--accent)' : 'var(--text-muted)',
                    background: pairInput === p ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  }}
                >
                  {p}
                </button>
              ))
              : ['EUR/USD', 'GBP/USD', 'USD/JPY', 'GBP/JPY', 'AUD/USD', 'USD/CAD'].map(p => (
                <button
                  key={p}
                  onClick={() => { setPairInput(p); setPairInputError('') }}
                  className="px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{
                    borderColor: pairInput === p ? 'var(--accent)' : 'var(--border)',
                    color: pairInput === p ? 'var(--accent)' : 'var(--text-muted)',
                    background: pairInput === p ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                  }}
                >
                  {p}
                </button>
              ))
            }
          </div>
          {/* Show all pairs toggle */}
          {availablePairs.length > MAX_QUICK_PAIRS && (
            <button
              onClick={() => setShowAllPairs(v => !v)}
              className="mt-2 text-xs font-medium underline underline-offset-2 transition-colors hover:opacity-70"
              style={{ color: 'var(--accent)' }}
            >
              {showAllPairs ? '▲ Hide all pairs' : `▼ Show all ${availablePairs.length} pairs`}
            </button>
          )}
          {/* All pairs list */}
          <AnimatePresence>
            {showAllPairs && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-3 overflow-hidden"
              >
                {groupedPairs.map(({ label, pairs: ps }) => (
                  <div key={label} className="mb-3">
                    <div className="text-xs font-semibold uppercase tracking-wide mb-1.5"
                      style={{ color: 'var(--text-muted)' }}>{label}</div>
                    <div className="flex flex-wrap gap-1">
                      {ps.map(p => (
                        <button
                          key={p}
                          onClick={() => {
                            setPairInput(p)
                            setPairInputError('')
                            setShowAllPairs(false)
                          }}
                          className="px-2 py-0.5 rounded text-xs font-mono font-medium border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                          style={{
                            borderColor: pairInput === p ? 'var(--accent)' : 'var(--border)',
                            color: pairInput === p ? 'var(--accent)' : 'var(--text-muted)',
                            background: pairInput === p ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                          }}
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Analysis Popup Modal */}
      <AnimatePresence>
        {showAnalysisPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-16 overflow-y-auto"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={e => { if (e.target === e.currentTarget) closePopup() }}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.97 }}
              transition={{ duration: 0.25 }}
              className="w-full max-w-5xl rounded-2xl border overflow-hidden"
              style={{ background: 'var(--bg)', borderColor: 'var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}
            >
              {/* Popup header */}
              <div className="flex items-center justify-between px-6 py-4 border-b"
                style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--accent) 6%, transparent)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-xl">🤖</span>
                  <div>
                    <h2 className="font-bold text-base" style={{ color: 'var(--accent)' }}>
                      AI Analysis — {analyzedPair}
                    </h2>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      Technical + Fundamental + AI Insights
                    </p>
                  </div>
                </div>
                <button
                  onClick={closePopup}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-lg font-bold transition-colors hover:bg-[var(--border)]"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Popup body */}
              <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                {/* AI Analysis Panel */}
                <AIAnalysisPanel
                  pair={analyzedPair}
                  signal={signal}
                  tech={tech}
                  news={news}
                  calendarEvents={calendarEvents}
                  loading={loadingSignal || loadingTech}
                />

                {/* Signal + Technical grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <div>
                    <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      AI Signal — {analyzedPair}
                    </h3>
                    {loadingSignal ? (
                      <div className="card"><LoadingSpinner /></div>
                    ) : errorSignal ? (
                      <div className="card"><ErrorMessage message={errorSignal} onRetry={() => fetchSignalForPair(analyzedPair)} /></div>
                    ) : signal?.signal_state === 'filled' ? (
                      <UpcomingSignalCard pair={analyzedPair} signal={signal} onRefresh={() => fetchSignalForPair(analyzedPair)} />
                    ) : (
                      <SignalCard signal={signal} />
                    )}
                  </div>
                  <div>
                    <h3 className="font-semibold mb-3 text-sm uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Technical Analysis
                    </h3>
                    {loadingTech ? (
                      <div className="card"><LoadingSpinner /></div>
                    ) : errorTech ? (
                      <div className="card"><ErrorMessage message={errorTech} onRetry={() => fetchTechForPair(analyzedPair)} /></div>
                    ) : (
                      <TechnicalCard tech={tech} />
                    )}
                  </div>
                </div>

                {/* Signal History */}
                {signal?.signal_state !== 'filled' && signal?.history && signal.history.length > 0 && (
                  <div className="card">
                    <h3 className="font-semibold mb-3">Recent Signal History (30 days)</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b" style={{ borderColor: 'var(--border)' }}>
                            {['Date / Time', 'Predicted', 'Actual', 'Entry', 'TP/SL Status', 'Exit', 'Result'].map(h => (
                              <th key={h} className="pb-2 pr-4 font-medium text-xs uppercase tracking-wide"
                                style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {signal.history.slice(-10).reverse().map((h, i) => {
                            const tpHit = h.correct
                            const slHit = !h.correct
                            const postedAt = h.posted_at
                              ? new Date(h.posted_at).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
                              : h.day || '—'
                            return (
                              <motion.tr
                                key={i}
                                initial={{ opacity: 0, x: -12 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.04, duration: 0.25 }}
                                className="border-b"
                                style={{ borderColor: 'var(--border)' }}
                              >
                                <td className="py-2 pr-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                                  <div>{postedAt}</div>
                                </td>
                                <td className="py-2 pr-4">
                                  <DirectionBadge direction={h.predicted} />
                                </td>
                                <td className="py-2 pr-4">
                                  <DirectionBadge direction={h.actual} />
                                </td>
                                <td className="py-2 pr-4 font-mono text-xs">{h.entry ?? '—'}</td>
                                <td className="py-2 pr-4">
                                  <div className="flex flex-col gap-1">
                                    <motion.span
                                      initial={{ scale: 0.7, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ delay: i * 0.04 + 0.1 }}
                                      className="text-xs px-1.5 py-0.5 rounded font-medium w-fit"
                                      style={{
                                        background: 'color-mix(in srgb, var(--accent) 15%, transparent)',
                                        color: 'var(--accent)',
                                      }}
                                    >
                                      ✓ Entry
                                    </motion.span>
                                    <motion.span
                                      initial={{ scale: 0.7, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ delay: i * 0.04 + 0.2 }}
                                      className="text-xs px-1.5 py-0.5 rounded font-medium w-fit"
                                      style={{
                                        background: tpHit
                                          ? 'color-mix(in srgb, var(--buy) 18%, transparent)'
                                          : 'color-mix(in srgb, var(--border) 60%, transparent)',
                                        color: tpHit ? 'var(--buy)' : 'var(--text-muted)',
                                      }}
                                    >
                                      {tpHit ? '✓ TP Hit' : '— TP'}
                                    </motion.span>
                                    <motion.span
                                      initial={{ scale: 0.7, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      transition={{ delay: i * 0.04 + 0.3 }}
                                      className="text-xs px-1.5 py-0.5 rounded font-medium w-fit"
                                      style={{
                                        background: slHit
                                          ? 'color-mix(in srgb, var(--sell) 18%, transparent)'
                                          : 'color-mix(in srgb, var(--border) 60%, transparent)',
                                        color: slHit ? 'var(--sell)' : 'var(--text-muted)',
                                      }}
                                    >
                                      {slHit ? '✓ SL Hit' : '— SL'}
                                    </motion.span>
                                  </div>
                                </td>
                                <td className="py-2 pr-4 font-mono text-xs">{h.exit ?? '—'}</td>
                                <td className="py-2 text-xs font-semibold" style={{
                                  color: h.correct ? 'var(--buy)' : 'var(--sell)'
                                }}>
                                  {h.correct ? '✓ Win' : '✗ Loss'}
                                </td>
                              </motion.tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
