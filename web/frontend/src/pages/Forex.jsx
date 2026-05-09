import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import api from '../utils/api'
import LoadingSpinner from '../components/LoadingSpinner'
import ErrorMessage from '../components/ErrorMessage'
import { normalizeTradingPairInput, ALL_FOREX_PAIRS } from '../utils/forexPairs'
import {
  playSessionStart,
  playSessionEnd,
  playEntry,
} from '../utils/sounds'

const PRIMARY_MAJORS = new Set(['EUR/USD', 'GBP/USD', 'USD/JPY', 'USD/CHF', 'AUD/USD', 'USD/CAD', 'NZD/USD'])

function getInstrumentTypeFromPair(pair) {
  const normalized = normalizeTradingPairInput(pair || '')
  if (normalized.endsWith('/JPY')) return 'jpy'
  return 'forex'
}

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

function calcRiskPosition({ accountBalance, riskPct, entryPrice, stopLoss, takeProfit, pairType }) {
  const balance = parseFloat(accountBalance) || 0
  const riskPercent = parseFloat(riskPct) || 0
  const entry = parseFloat(entryPrice) || 0
  const sl = parseFloat(stopLoss) || 0
  const tp = parseFloat(takeProfit) || 0

  if (!balance || !riskPercent || entry <= 0 || sl <= 0) return null

  const riskAmount = balance * (riskPercent / 100)
  const priceDiffSL = Math.abs(entry - sl)
  const priceDiffTP = tp ? Math.abs(tp - entry) : null
  if (!priceDiffSL) return null

  let pipSize = 0.0001
  let pipValuePerLot = 10
  let lotSize = 100000
  if (pairType === 'jpy') {
    pipSize = 0.01
    pipValuePerLot = 1000 / entry
  }

  const slPips = priceDiffSL / pipSize
  const tpPips = priceDiffTP !== null ? priceDiffTP / pipSize : null
  const positionSizeLots = riskAmount / (slPips * pipValuePerLot)
  const positionSizeUnits = positionSizeLots * lotSize
  const rrRatio = tpPips ? (tpPips / slPips) : null

  return {
    riskAmount,
    slPips: slPips.toFixed(1),
    tpPips: tpPips?.toFixed(1),
    positionSizeLots: positionSizeLots.toFixed(2),
    positionSizeUnits,
    rrRatio: rrRatio?.toFixed(2),
    rrRatioValue: rrRatio,
  }
}

function RiskWidgetField({ label, value, onChange, placeholder, suffix, hint, step = 'any', min }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--text-muted)' }}>
        {label}
      </span>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          step={step}
          min={min}
          className="w-full px-3 py-2.5 rounded-lg text-sm font-mono border outline-none pr-12"
          style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <span className="block text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </label>
  )
}

function RiskWidgetResultRow({ label, value, tone = 'var(--text)' }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b"
      style={{ borderColor: 'color-mix(in srgb, var(--border) 75%, transparent)' }}>
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className="text-sm font-mono font-semibold text-right" style={{ color: tone }}>{value}</span>
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
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
  const [analyzedPair, setAnalyzedPair] = useState(null)
  const [riskWidgetOpen, setRiskWidgetOpen] = useState(false)
  const [riskWidgetMaximized, setRiskWidgetMaximized] = useState(false)
  const [riskWidgetOffset, setRiskWidgetOffset] = useState({ x: 0, y: 0 })
  const [riskBalance, setRiskBalance] = useState('10000')
  const [riskPct, setRiskPct] = useState('1')
  const [riskEntry, setRiskEntry] = useState('')
  const [riskStop, setRiskStop] = useState('')
  const [riskTake, setRiskTake] = useState('')
  const [riskPairType, setRiskPairType] = useState('forex')
  const [isMobileRiskLayout, setIsMobileRiskLayout] = useState(false)
  const dragRef = useRef({ pointerId: null, startX: 0, startY: 0, originX: 0, originY: 0 })

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

  const groupedPairs = useMemo(() => {
    const fromApi = [
      { label: 'Major', pairs: pairs.major || [] },
      { label: 'Minor', pairs: pairs.minor || [] },
      { label: 'Exotic', pairs: pairs.exotic || [] },
    ].filter(g => g.pairs.length > 0)

    if (fromApi.length > 0) return fromApi

    const majorFallback = ALL_FOREX_PAIRS.filter(p => PRIMARY_MAJORS.has(p))
    const exoticFallback = ALL_FOREX_PAIRS.filter(p => p.includes('USD') && !PRIMARY_MAJORS.has(p))
    const minorFallback = ALL_FOREX_PAIRS.filter(p => !majorFallback.includes(p) && !exoticFallback.includes(p))

    return [
      { label: 'Major', pairs: majorFallback },
      { label: 'Minor', pairs: minorFallback },
      { label: 'Exotic', pairs: exoticFallback },
    ]
  }, [pairs.exotic, pairs.major, pairs.minor])

  const availablePairs = useMemo(() => {
    const merged = new Set(ALL_FOREX_PAIRS)
    ;(pairs.all || []).forEach(p => merged.add(p))
    groupedPairs.forEach(g => g.pairs.forEach(p => merged.add(p)))
    return Array.from(merged)
  }, [groupedPairs, pairs.all])

  const riskResult = useMemo(() => calcRiskPosition({
    accountBalance: riskBalance,
    riskPct,
    entryPrice: riskEntry,
    stopLoss: riskStop,
    takeProfit: riskTake,
    pairType: riskPairType,
  }), [riskBalance, riskPct, riskEntry, riskStop, riskTake, riskPairType])

  const runPairAnalysis = useCallback(() => {
    const normalizedPair = normalizeTradingPairInput(pairInput)
    if (!normalizedPair) {
      setPairInputError('Enter a trading pair such as GBP/JPY.')
      return
    }
    if (availablePairs.length > 0 && !availablePairs.includes(normalizedPair)) {
      setPairInputError('That trading pair is not supported. Choose one of the trading pairs listed below.')
      return
    }
    setPairInput(normalizedPair)
    setPairInputError('')
    setAnalyzedPair(normalizedPair)
    setSignal(null)
    setTech(null)
    setShowAnalysisPopup(true)
    fetchSignalForPair(normalizedPair)
    fetchTechForPair(normalizedPair)
  }, [availablePairs, fetchSignalForPair, fetchTechForPair, pairInput])

  const copySignalToRiskCalculator = useCallback((signalData, pair) => {
    if (!signalData) return
    setRiskEntry(signalData.entry_price != null ? String(signalData.entry_price) : '')
    setRiskStop(signalData.stop_loss != null ? String(signalData.stop_loss) : '')
    setRiskTake(signalData.take_profit != null ? String(signalData.take_profit) : '')
    setRiskPairType(getInstrumentTypeFromPair(pair))
    setRiskWidgetOpen(true)
  }, [])

  const handleRiskDragStart = useCallback((e) => {
    if (isMobileRiskLayout) return
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: riskWidgetOffset.x,
      originY: riskWidgetOffset.y,
    }
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [isMobileRiskLayout, riskWidgetOffset.x, riskWidgetOffset.y])

  const handleRiskDragMove = useCallback((e) => {
    if (dragRef.current.pointerId !== e.pointerId) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    setRiskWidgetOffset({
      x: dragRef.current.originX + dx,
      y: dragRef.current.originY + dy,
    })
  }, [])

  const handleRiskDragEnd = useCallback((e) => {
    if (dragRef.current.pointerId !== e.pointerId) return
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch (err) {
      // releasePointerCapture may throw DOMException if the capture was auto-released first.
    }
    dragRef.current.pointerId = null
  }, [])

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

  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const media = window.matchMedia('(max-width: 767px)')
    const syncLayout = () => setIsMobileRiskLayout(media.matches)
    syncLayout()
    if (media.addEventListener) media.addEventListener('change', syncLayout)
    else media.addListener(syncLayout)
    return () => {
      if (media.removeEventListener) media.removeEventListener('change', syncLayout)
      else media.removeListener(syncLayout)
    }
  }, [])

  useEffect(() => {
    if (!isMobileRiskLayout) return
    setRiskWidgetOffset({ x: 0, y: 0 })
    setRiskWidgetOpen(true)
  }, [isMobileRiskLayout])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <TradingSessionBanner />

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        className="mb-6 rounded-xl border overflow-hidden"
        style={{
          borderColor: 'color-mix(in srgb, var(--accent) 45%, var(--border))',
          background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 14%, var(--surface)) 0%, var(--surface) 55%, color-mix(in srgb, var(--buy) 10%, var(--surface)) 100%)',
          boxShadow: '0 16px 48px color-mix(in srgb, var(--accent) 18%, transparent)',
        }}>
        <div className="px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">AI Trading Dashboard</h1>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Live pair intelligence, fast signal execution support, and one-click risk setup.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs px-2 py-1 rounded-full border"
              style={{ borderColor: 'color-mix(in srgb, var(--buy) 35%, transparent)', color: 'var(--buy)', background: 'color-mix(in srgb, var(--buy) 12%, transparent)' }}>
              ● Live Feeds
            </span>
            <span className="text-xs px-2 py-1 rounded-full border"
              style={{ borderColor: 'color-mix(in srgb, var(--accent) 35%, transparent)', color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 12%, transparent)' }}>
              AI-Driven
            </span>
            <span className="text-xs px-2 py-1 rounded-full border"
              style={{ borderColor: 'color-mix(in srgb, var(--hold) 35%, transparent)', color: 'var(--hold)', background: 'color-mix(in srgb, var(--hold) 12%, transparent)' }}>
              Risk-Aware
            </span>
          </div>
        </div>
      </motion.div>

      {/* AI-Powered Pair Analysis Search */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, delay: 0.08 }}
        className="mb-6 rounded-xl border overflow-hidden"
        style={{
          borderColor: 'color-mix(in srgb, var(--accent) 28%, var(--border))',
          background: 'var(--surface)',
          boxShadow: '0 10px 36px color-mix(in srgb, var(--accent) 12%, transparent)',
        }}>
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
          <div className="mt-4 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                  Trading Pairs
                </h3>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Tap any pair below to load it instantly.
                </p>
              </div>
              <span className="text-xs px-2.5 py-1 rounded-full w-fit"
                style={{
                  color: 'var(--accent)',
                  background: 'color-mix(in srgb, var(--accent) 12%, transparent)',
                }}>
                {availablePairs.length} supported pairs
              </span>
            </div>
            {groupedPairs.map(({ label, pairs: groupItems }, groupIndex) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.12 + groupIndex * 0.06 }}
                className="rounded-xl border p-3"
                style={{
                  borderColor: 'color-mix(in srgb, var(--accent) 18%, var(--border))',
                  background: 'color-mix(in srgb, var(--bg) 65%, var(--surface))',
                }}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                    {label}
                  </span>
                  <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                    {groupItems.length} pairs
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {groupItems.map(p => (
                    <motion.button
                      key={p}
                      whileHover={{ y: -1 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => { setPairInput(p); setPairInputError('') }}
                      className="px-2.5 py-1 rounded-full text-xs font-mono font-medium border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      style={{
                        borderColor: pairInput === p ? 'var(--accent)' : 'var(--border)',
                        color: pairInput === p ? 'var(--accent)' : 'var(--text-muted)',
                        background: pairInput === p ? 'color-mix(in srgb, var(--accent) 10%, transparent)' : 'transparent',
                      }}
                    >
                      {p}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </motion.div>

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
                    {signal && (
                      <button
                        onClick={() => copySignalToRiskCalculator(signal, analyzedPair)}
                        aria-label="Copy AI signal values to the dashboard risk calculator"
                        className="mt-3 w-full px-3 py-2 rounded-lg text-sm font-semibold border transition-colors hover:opacity-85"
                        style={{
                          borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
                          color: 'var(--accent)',
                          background: 'color-mix(in srgb, var(--accent) 8%, transparent)',
                        }}
                      >
                        🧮 Copy signal to Risk Calculator
                      </button>
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

      <div
        className={isMobileRiskLayout ? 'mt-8' : 'fixed z-40'}
        style={isMobileRiskLayout ? undefined : {
          right: 20,
          bottom: 20,
          transform: `translate(${riskWidgetOffset.x}px, ${riskWidgetOffset.y}px)`,
        }}
      >
        {!riskWidgetOpen && (
          <button
            onClick={() => setRiskWidgetOpen(true)}
            className={isMobileRiskLayout
              ? 'w-full rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg transition-transform hover:scale-[1.01]'
              : 'w-12 h-12 rounded-full border text-lg shadow-lg transition-transform hover:scale-105'}
            style={{
              borderColor: 'color-mix(in srgb, var(--accent) 35%, var(--border))',
              background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 24%, var(--surface)) 0%, var(--surface) 100%)',
            }}
            aria-label="Open risk calculator widget"
            title="Open risk calculator"
          >
            <span aria-hidden="true">{isMobileRiskLayout ? '🧮 Open risk calculator' : '🧮'}</span>
            <span className="sr-only">Open risk calculator</span>
          </button>
        )}
        {riskWidgetOpen && (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.25 }}
            className="rounded-xl border overflow-hidden"
            style={{
              width: isMobileRiskLayout ? '100%' : riskWidgetMaximized ? 420 : 340,
              borderColor: 'color-mix(in srgb, var(--accent) 30%, var(--border))',
              background: 'var(--surface)',
              boxShadow: '0 18px 48px rgba(0,0,0,0.45)',
            }}
          >
            <div
              className="px-3 py-2.5 border-b flex items-center justify-between gap-3"
              style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--accent) 8%, transparent)' }}
            >
              <div
                className={`min-w-0 ${isMobileRiskLayout ? '' : 'cursor-move select-none'}`}
                onPointerDown={isMobileRiskLayout ? undefined : handleRiskDragStart}
                onPointerMove={isMobileRiskLayout ? undefined : handleRiskDragMove}
                onPointerUp={isMobileRiskLayout ? undefined : handleRiskDragEnd}
                onPointerCancel={isMobileRiskLayout ? undefined : handleRiskDragEnd}
              >
                <div className="text-xs font-semibold" style={{ color: 'var(--accent)' }}>🧮 Dashboard Risk Calculator</div>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {isMobileRiskLayout ? 'Positioned below the trading pairs for quick mobile access.' : 'Drag from this header to reposition the calculator.'}
                </p>
              </div>
              <div className="flex items-center gap-1">
                {!isMobileRiskLayout && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setRiskWidgetMaximized(v => !v)
                    }}
                    className="w-7 h-7 rounded text-xs border"
                    style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                    title={riskWidgetMaximized ? 'Minimize' : 'Maximize'}
                  >
                    {riskWidgetMaximized ? '🗕' : '🗖'}
                  </button>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    setRiskWidgetOpen(false)
                  }}
                  className="w-7 h-7 rounded text-xs border"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                  title={isMobileRiskLayout ? 'Hide calculator' : 'Minimize to icon'}
                >
                  —
                </button>
              </div>
            </div>

            <div className="p-3 space-y-3">
              <div className={`grid gap-3 ${isMobileRiskLayout ? 'grid-cols-1' : 'grid-cols-2'}`}>
                <RiskWidgetField
                  label="Account balance"
                  value={riskBalance}
                  onChange={setRiskBalance}
                  placeholder="10000"
                  suffix="USD"
                  min="1"
                  hint="Your available trading capital."
                />
                <RiskWidgetField
                  label="Risk per trade"
                  value={riskPct}
                  onChange={setRiskPct}
                  placeholder="1"
                  suffix="%"
                  step="0.1"
                  min="0.1"
                  hint="Most disciplined traders stay around 1–2%."
                />
              </div>
              <div className="grid grid-cols-1 gap-3">
                <RiskWidgetField
                  label="Entry price"
                  value={riskEntry}
                  onChange={setRiskEntry}
                  placeholder="1.08500"
                  hint="Planned market entry."
                />
                <RiskWidgetField
                  label="Stop loss"
                  value={riskStop}
                  onChange={setRiskStop}
                  placeholder="1.08000"
                  hint="Invalidates the trade if reached."
                />
                <RiskWidgetField
                  label="Take profit"
                  value={riskTake}
                  onChange={setRiskTake}
                  placeholder="1.09500"
                  hint="Optional target for reward calculations."
                />
              </div>

              <label className="block">
                <span className="block text-[11px] font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text-muted)' }}>
                  Instrument type
                </span>
                <select
                  value={riskPairType}
                  onChange={e => setRiskPairType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="forex">Forex (non-JPY)</option>
                  <option value="jpy">Forex JPY pairs</option>
                </select>
              </label>

              {riskResult ? (
                <div className="rounded-xl p-3 border"
                  style={{ borderColor: 'var(--border)', background: 'color-mix(in srgb, var(--accent) 7%, transparent)' }}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>
                      Position summary
                    </span>
                    <span className="text-[11px] px-2 py-0.5 rounded-full"
                      style={{ color: 'var(--accent)', background: 'color-mix(in srgb, var(--accent) 14%, transparent)' }}>
                      Live estimate
                    </span>
                  </div>
                  <RiskWidgetResultRow
                    label="Account risk"
                    value={`$${riskResult.riskAmount.toFixed(2)}`}
                    tone="var(--sell)"
                  />
                  <RiskWidgetResultRow
                    label="Stop loss distance"
                    value={`${riskResult.slPips} pips`}
                  />
                  <RiskWidgetResultRow
                    label="Position size"
                    value={`${riskResult.positionSizeUnits.toLocaleString(undefined, { maximumFractionDigits: 0 })} units`}
                    tone="var(--accent)"
                  />
                  <RiskWidgetResultRow
                    label="Standard lots"
                    value={riskResult.positionSizeLots}
                    tone="var(--accent)"
                  />
                  {riskResult.rrRatio && (
                    <>
                      <RiskWidgetResultRow
                        label="Risk to reward"
                        value={`1:${riskResult.rrRatio}`}
                        tone={riskResult.rrRatioValue >= 2 ? 'var(--buy)' : 'var(--hold)'}
                      />
                      <RiskWidgetResultRow
                        label="Take profit distance"
                        value={`${riskResult.tpPips} pips`}
                      />
                    </>
                  )}
                  <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                    Double-check the final size with your broker before placing a live trade.
                  </p>
                </div>
              ) : (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Fill in the balance, risk %, entry, and stop loss to calculate a detailed position size.
                </p>
              )}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
