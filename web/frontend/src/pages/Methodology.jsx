export default function Methodology() {
  const indicators = [
    'RSI (14)', 'MACD', 'EMA-20', 'EMA-50', 'EMA-200', 'Bollinger Bands',
    'ATR', 'Stochastic', 'Williams %R', 'CCI', 'ADX', 'Parabolic SAR',
    'OBV', 'MFI', 'VWAP', 'Ichimoku Cloud', 'Fibonacci Retracements',
    'Price Action', 'Candlestick Patterns', 'Volume Profile',
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-2">Methodology</h1>
      <p className="mb-10" style={{ color: 'var(--text-muted)' }}>
        How PiiTrade generates AI forex signals
      </p>

      <div className="flex flex-col gap-6">
        <div className="card">
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            🤖 Machine Learning Model
          </h2>
          <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-muted)' }}>
            PiiTrade uses a <strong style={{ color: 'var(--text)' }}>LightGBM (Light Gradient Boosting Machine)</strong> model —
            a high-performance, tree-based ML algorithm developed by Microsoft. LightGBM is specifically
            optimized for financial time-series data with its efficient handling of large datasets and
            categorical features.
          </p>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            The model classifies each currency pair into three signal states: <strong style={{ color: 'var(--buy)' }}>BUY</strong>,{' '}
            <strong style={{ color: 'var(--sell)' }}>SELL</strong>, or{' '}
            <strong style={{ color: 'var(--hold)' }}>HOLD</strong>, along with a confidence score representing
            the model's certainty.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">📊 Training Data</h2>
          <div className="grid grid-cols-3 gap-4 mb-4">
            {[
              { label: 'Years of Data', value: '10+' },
              { label: 'Currency Pairs', value: '35+' },
              { label: 'Indicators', value: '40+' },
            ].map(({ label, value }) => (
              <div key={label} className="text-center p-3 rounded-lg" style={{ background: 'var(--border)' }}>
                <div className="text-xl font-bold" style={{ color: 'var(--accent)' }}>{value}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            The model is trained on 10+ years of historical OHLCV (Open, High, Low, Close, Volume) data from
            major forex brokers. Data includes multiple timeframes (M15, H1, H4, D1) to capture both intraday
            and swing trading opportunities.
          </p>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">🔬 Technical Indicators</h2>
          <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
            40+ technical indicators are computed and fed as features to the model:
          </p>
          <div className="flex flex-wrap gap-2">
            {indicators.map(ind => (
              <span key={ind} className="text-xs px-2.5 py-1 rounded-full border font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
                {ind}
              </span>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="font-semibold text-lg mb-3">⚙️ Signal Generation Process</h2>
          <div className="flex flex-col gap-3">
            {[
              { step: '1', title: 'Data Collection', desc: 'Live price data fetched from ECB and broker APIs' },
              { step: '2', title: 'Indicator Computation', desc: '40+ technical indicators computed on rolling windows' },
              { step: '3', title: 'Feature Engineering', desc: 'Raw indicators normalized and encoded for ML input' },
              { step: '4', title: 'Model Inference', desc: 'LightGBM model outputs BUY/SELL/HOLD with probability scores' },
              { step: '5', title: 'Risk Calculation', desc: 'Entry, Take Profit, and Stop Loss levels calculated using ATR' },
            ].map(({ step, title, desc }) => (
              <div key={step} className="flex gap-4 items-start">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{ background: 'color-mix(in srgb, var(--accent) 15%, transparent)', color: 'var(--accent)' }}>
                  {step}
                </div>
                <div>
                  <div className="font-medium text-sm">{title}</div>
                  <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card border-[var(--hold)]" style={{ borderColor: 'var(--hold)' }}>
          <h2 className="font-semibold text-lg mb-3 flex items-center gap-2">
            <span>⚠️</span>
            <span style={{ color: 'var(--hold)' }}>Risk Disclaimer</span>
          </h2>
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            PiiTrade signals are generated by an AI model and are provided for <strong style={{ color: 'var(--text)' }}>educational
            and informational purposes only</strong>. Past accuracy does not guarantee future results. Forex
            trading involves substantial risk of loss. Never trade with money you cannot afford to lose.
            Always use proper risk management and consult a licensed financial advisor before trading.
          </p>
        </div>
      </div>
    </div>
  )
}
