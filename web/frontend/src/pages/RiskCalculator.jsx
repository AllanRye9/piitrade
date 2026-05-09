import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'

function InputRow({ label, value, onChange, placeholder, step, min, max, suffix, hint }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
        style={{ color: 'var(--text-muted)' }}>
        {label}
      </label>
      <div className="relative">
        <input
          type="number"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          step={step || 'any'}
          min={min}
          max={max}
          className="w-full px-3 py-2.5 rounded-lg text-sm font-mono border outline-none pr-12"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--border)',
            color: 'var(--text)',
          }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
            style={{ color: 'var(--text-muted)' }}>
            {suffix}
          </span>
        )}
      </div>
      {hint && (
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{hint}</p>
      )}
    </div>
  )
}

function ResultRow({ label, value, color, large }) {
  return (
    <div className="flex justify-between items-center py-2.5 border-b"
      style={{ borderColor: 'var(--border)' }}>
      <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`font-mono font-bold ${large ? 'text-lg' : 'text-sm'}`}
        style={{ color: color || 'var(--text)' }}>
        {value}
      </span>
    </div>
  )
}

function RiskMeter({ riskPct }) {
  const pct = Math.min(100, Math.max(0, (riskPct / 5) * 100))
  const color = riskPct <= 1 ? 'var(--buy)' : riskPct <= 2 ? 'var(--hold)' : 'var(--sell)'
  const label = riskPct <= 1 ? 'Conservative' : riskPct <= 2 ? 'Moderate' : riskPct <= 3 ? 'Aggressive' : 'Very High Risk'
  return (
    <div className="mb-4">
      <div className="flex justify-between text-xs mb-1.5">
        <span style={{ color: 'var(--text-muted)' }}>Risk Level</span>
        <span className="font-semibold" style={{ color }}>{label}</span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--border)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

export default function RiskCalculator() {
  const [accountBalance, setAccountBalance] = useState('10000')
  const [riskPct, setRiskPct] = useState('1')
  const [entryPrice, setEntryPrice] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [pairType, setPairType] = useState('forex')

  const calc = useCallback(() => {
    const balance = parseFloat(accountBalance) || 0
    const riskPercent = parseFloat(riskPct) || 0
    const entry = parseFloat(entryPrice) || 0
    const sl = parseFloat(stopLoss) || 0
    const tp = parseFloat(takeProfit) || 0

    if (!balance || !riskPercent || !entry || !sl) return null

    const riskAmount = balance * (riskPercent / 100)
    const priceDiffSL = Math.abs(entry - sl)
    const priceDiffTP = tp ? Math.abs(tp - entry) : null

    if (!priceDiffSL) return null

    // Pip calculation per type
    let pipSize = 0.0001 // forex default
    if (pairType === 'jpy') pipSize = 0.01
    if (pairType === 'xauusd') pipSize = 0.1
    if (pairType === 'us30') pipSize = 1
    if (pairType === 'crypto') pipSize = 1

    const slPips = priceDiffSL / pipSize
    const tpPips = priceDiffTP !== null ? priceDiffTP / pipSize : null

    // Standard lot calculations
    const positionSizeUnits = (riskAmount / priceDiffSL)
    const positionSizeLots = positionSizeUnits / 100000

    const rrRatio = tpPips ? (tpPips / slPips) : null
    const rewardAmount = tpPips ? (riskAmount * rrRatio) : null

    return {
      riskAmount,
      slPips: slPips.toFixed(1),
      tpPips: tpPips?.toFixed(1),
      positionSizeUnits: positionSizeUnits.toFixed(0),
      positionSizeLots: positionSizeLots.toFixed(2),
      rrRatio: rrRatio?.toFixed(2),
      rewardAmount,
      riskPercent,
    }
  }, [accountBalance, riskPct, entryPrice, stopLoss, takeProfit, pairType])

  const result = calc()

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            🧮 Risk Calculator
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            Calculate position size, risk amount, and reward-to-risk ratio before entering a trade.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Panel */}
          <div className="card">
            <h2 className="font-semibold text-base mb-5 flex items-center gap-2">
              ⚙️ Trade Parameters
            </h2>

            <div className="flex flex-col gap-4">
              {/* Pair type */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text-muted)' }}>
                  Instrument Type
                </label>
                <select
                  value={pairType}
                  onChange={e => setPairType(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                >
                  <option value="forex">Forex (non-JPY)</option>
                  <option value="jpy">Forex JPY Pairs</option>
                  <option value="xauusd">Gold (XAU/USD)</option>
                  <option value="us30">US30 / Indices</option>
                  <option value="crypto">Crypto</option>
                </select>
              </div>

              <InputRow
                label="Account Balance"
                value={accountBalance}
                onChange={setAccountBalance}
                placeholder="10000"
                min="1"
                suffix="USD"
                hint="Your total trading account balance"
              />

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide mb-1.5"
                  style={{ color: 'var(--text-muted)' }}>
                  Risk Per Trade
                </label>
                <div className="flex gap-2 mb-2">
                  {[0.5, 1, 1.5, 2, 3].map(r => (
                    <button
                      key={r}
                      onClick={() => setRiskPct(String(r))}
                      className="px-2.5 py-1 rounded text-xs font-semibold transition-all"
                      style={{
                        background: parseFloat(riskPct) === r
                          ? 'var(--accent)' : 'var(--border)',
                        color: parseFloat(riskPct) === r
                          ? 'var(--bg)' : 'var(--text-muted)',
                      }}
                    >
                      {r}%
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={riskPct}
                    onChange={e => setRiskPct(e.target.value)}
                    placeholder="1"
                    step="0.1"
                    min="0.1"
                    max="10"
                    className="w-full px-3 py-2.5 rounded-lg text-sm font-mono border outline-none pr-12"
                    style={{ background: 'var(--bg)', borderColor: 'var(--border)', color: 'var(--text)' }}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold"
                    style={{ color: 'var(--text-muted)' }}>%</span>
                </div>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Pro traders risk 1–2% per trade
                </p>
              </div>

              <InputRow
                label="Entry Price"
                value={entryPrice}
                onChange={setEntryPrice}
                placeholder="1.08500"
                hint="Your planned entry price"
              />

              <InputRow
                label="Stop Loss"
                value={stopLoss}
                onChange={setStopLoss}
                placeholder="1.08000"
                hint="Your stop loss level"
              />

              <InputRow
                label="Take Profit (optional)"
                value={takeProfit}
                onChange={setTakeProfit}
                placeholder="1.09500"
                hint="Your take profit target"
              />
            </div>
          </div>

          {/* Results Panel */}
          <div className="flex flex-col gap-4">
            {result ? (
              <motion.div
                className="card"
                initial={{ opacity: 0, scale: 0.97 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="font-semibold text-base mb-4 flex items-center gap-2">
                  📊 Calculation Results
                </h2>

                <RiskMeter riskPct={result.riskPercent} />

                <ResultRow
                  label="Risk Amount"
                  value={`$${result.riskAmount.toFixed(2)}`}
                  color="var(--sell)"
                  large
                />
                <ResultRow
                  label="Stop Loss Distance"
                  value={`${result.slPips} pips`}
                  color="var(--text-muted)"
                />
                <ResultRow
                  label="Position Size (units)"
                  value={Number(result.positionSizeUnits).toLocaleString()}
                  color="var(--accent)"
                  large
                />
                <ResultRow
                  label="Position Size (lots)"
                  value={`${result.positionSizeLots} lots`}
                  color="var(--accent)"
                />
                {result.tpPips && (
                  <ResultRow
                    label="Take Profit Distance"
                    value={`${result.tpPips} pips`}
                    color="var(--text-muted)"
                  />
                )}
                {result.rrRatio && (
                  <>
                    <ResultRow
                      label="Risk : Reward Ratio"
                      value={`1 : ${result.rrRatio}`}
                      color={parseFloat(result.rrRatio) >= 2 ? 'var(--buy)' : parseFloat(result.rrRatio) >= 1 ? 'var(--hold)' : 'var(--sell)'}
                      large
                    />
                    <ResultRow
                      label="Potential Reward"
                      value={`$${result.rewardAmount.toFixed(2)}`}
                      color="var(--buy)"
                    />
                  </>
                )}
              </motion.div>
            ) : (
              <div className="card text-center py-12">
                <div className="text-4xl mb-3">🧮</div>
                <p className="font-medium mb-1">Enter trade parameters</p>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Fill in account balance, risk %, entry, and stop loss to calculate your position size.
                </p>
              </div>
            )}

            {/* Risk Tips */}
            <div className="card">
              <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
                💡 Risk Management Tips
              </h3>
              <ul className="text-sm space-y-2" style={{ color: 'var(--text-muted)' }}>
                <li className="flex gap-2">
                  <span style={{ color: 'var(--buy)' }}>✓</span>
                  Never risk more than 2% of your account on a single trade.
                </li>
                <li className="flex gap-2">
                  <span style={{ color: 'var(--buy)' }}>✓</span>
                  Target a minimum 1:2 risk-to-reward ratio for long-term profitability.
                </li>
                <li className="flex gap-2">
                  <span style={{ color: 'var(--buy)' }}>✓</span>
                  Always place your stop loss before entering a trade — not after.
                </li>
                <li className="flex gap-2">
                  <span style={{ color: 'var(--hold)' }}>⚠</span>
                  Position sizing is the most powerful risk control tool you have.
                </li>
                <li className="flex gap-2">
                  <span style={{ color: 'var(--hold)' }}>⚠</span>
                  A drawdown of 50% requires a 100% gain to recover. Keep losses small.
                </li>
              </ul>
            </div>

            {/* Disclaimer */}
            <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
              This calculator is for educational purposes only. All values are estimates.
              Always verify position sizes with your broker before trading.
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
